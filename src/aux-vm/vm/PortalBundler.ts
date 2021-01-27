import {
    applyUpdates,
    BotIndex,
    BotIndexEvent,
    BotsState,
    calculateBotValue,
    getScriptPrefix,
    hasPortalScript,
    isPortalScript,
    PrecalculatedBot,
    PrecalculatedBotsState,
    RegisterCustomPortalOptions,
    stateUpdatedEvent,
    StateUpdatedEvent,
    trimPortalScript,
    trimPrefixedScript,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import values from 'lodash/values';
import { isEqual, pick, sortBy } from 'lodash';
import axios from 'axios';
import type ESBuild from 'esbuild';
import * as esbuild from 'esbuild';

export interface PortalEntrypoint {
    botId?: string;
    tag: string;
}

export interface Bundle {
    portalId: string;
    warnings: string[];
    source?: string;
    error?: string;
}

export interface Portal {
    portalId: string;
    entrypoints: PortalEntrypoint[];
    scriptPrefixes: string[];
    style: any;
}

export const DEFAULT_BASE_MODULE_URL: string = 'https://cdn.skypack.dev';

/**
 * Defines a class that is used to bundle scripts for portals.
 * It listens for state updates and is able to asynchrounously emit bundles that should be injected into custom portals.
 */
export class PortalBundler {
    private _esbuildService: ESBuild.Service;
    private _portals: Map<string, Portal>;
    private _state: PrecalculatedBotsState;
    private _onBundleUpdated: Subject<Bundle>;
    private _baseModuleUrl: string = DEFAULT_BASE_MODULE_URL;
    private _httpCache: Map<string, Promise<string>>;
    private _buildCache: Map<string, any>;
    private _index: BotIndex;
    private _esbuildWasmUrl: string;

    /**
     * An observable that emits when a bundle is updated.
     */
    get onBundleUpdated(): Observable<Bundle> {
        return this._onBundleUpdated;
    }

    constructor(options: { esbuildWasmUrl?: string } = {}) {
        this._portals = new Map();
        this._httpCache = new Map();
        this._buildCache = new Map();
        this._index = new BotIndex();
        this._onBundleUpdated = new Subject();
        this._esbuildWasmUrl = options.esbuildWasmUrl || null;
    }

    /**
     * Processes the given state update event.
     */
    stateUpdated(event: StateUpdatedEvent): Promise<void[]> {
        this._state = applyUpdates(this._state, event);
        const batch = this._index.batch(() => {
            const added = event.addedBots.map((id) => this._state[id]);
            const tagUpdates = event.updatedBots
                .map((id) => {
                    let u = event.state[id];
                    let tags = u && u.tags ? Object.keys(u.tags) : [];
                    let valueTags = u && u.values ? Object.keys(u.values) : [];
                    let bot = this._state[id];
                    return {
                        bot,
                        tags: new Set([...tags, ...valueTags]),
                    };
                })
                .filter((u) => !!u.bot);
            if (added.length > 0) {
                this._index.addBots(added);
            }
            if (event.removedBots.length > 0) {
                this._index.removeBots(event.removedBots);
            }
            if (tagUpdates.length > 0) {
                this._index.updateBots(tagUpdates);
            }
        });

        return this._updateBundles(event, batch);
    }

    getPortal(portalId: string) {
        return this._portals.get(portalId);
    }

    /**
     * Registers a custom portal with the given ID.
     * @param portalId The ID of the portal.
     * @param options The options for the portal.
     */
    registerCustomPortal(
        portalId: string,
        options: RegisterCustomPortalOptions
    ): Promise<void> {
        const currentPortal = this._portals.get(portalId);

        if (currentPortal) {
            const prefixesChanged = !isEqual(
                currentPortal.scriptPrefixes,
                options.scriptPrefixes
            );
            const newPortal: Portal = {
                ...currentPortal,
                scriptPrefixes: options.scriptPrefixes,
                style: options.style,
            };

            this._portals.set(portalId, newPortal);

            if (prefixesChanged && newPortal.entrypoints.length > 0) {
                return this._updateBundle(
                    stateUpdatedEvent(this._state),
                    this._index.initialEvents(),
                    newPortal
                );
            }
        } else {
            this._portals.set(portalId, {
                portalId,
                entrypoints: [],
                scriptPrefixes: options.scriptPrefixes,
                style: options.style,
            });
        }

        return Promise.resolve();
    }

    /**
     * Adds an entry point to the portal with the given ID.
     * @param portalId The ID of the portal.
     * @param entrypoint The entrypoint.
     */
    addEntryPoint(
        portalId: string,
        entrypoint: PortalEntrypoint
    ): Promise<void> {
        let portal = this._portals.get(portalId);
        if (portal) {
            portal.entrypoints.push({
                tag: trimPortalScript(portal.scriptPrefixes, entrypoint.tag),
                botId: entrypoint.botId,
            });

            return this._updateBundle(
                stateUpdatedEvent(this._state),
                this._index.initialEvents(),
                portal
            );
        }
    }

    private _updateBundles(
        event: StateUpdatedEvent,
        indexEvents: BotIndexEvent[]
    ) {
        let promises = [] as Promise<void>[];
        for (let portal of this._portals.values()) {
            if (portal.entrypoints.length > 0) {
                promises.push(this._updateBundle(event, indexEvents, portal));
            }
        }
        return Promise.all(promises);
    }

    private _updateBundle(
        event: StateUpdatedEvent,
        indexEvents: BotIndexEvent[],
        portal: Portal
    ) {
        let hasUpdate = indexEvents.some((event) => {
            if (event.type === 'bot_tag_added') {
                return hasPortalScript(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.bot, event.tag)
                );
            } else if (event.type === 'bot_tag_removed') {
                return hasPortalScript(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.oldBot, event.tag)
                );
            } else if (event.type === 'bot_tag_updated') {
                const wasEntrypointTag = hasPortalScript(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.oldBot, event.tag)
                );
                const isEntrypoint = hasPortalScript(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.bot, event.tag)
                );
                return isEntrypoint || wasEntrypointTag;
            }
        });

        if (hasUpdate) {
            let entryModules = new Set<string>();
            let entryCode = '';
            let bots = sortBy(values(this._state), (b) => b.id);

            for (let entrypoint of portal.entrypoints) {
                let tagModules = bots
                    .map((b) => ({
                        prefix: getScriptPrefix(
                            portal.scriptPrefixes,
                            b.values[entrypoint.tag]
                        ),
                        tag: entrypoint.tag,
                        id: b.id,
                        code: b.values[entrypoint.tag],
                    }))
                    .filter((value) => value.prefix !== null)
                    .map((m) => ({
                        name: auxModuleId(m.prefix, m.id, m.tag),
                        code: trimPrefixedScript(m.prefix, m.code),
                    }));

                for (let m of tagModules) {
                    entryModules.add(m.name);
                }
            }

            for (let name of entryModules) {
                entryCode += `import ${JSON.stringify(name)};\n`;
            }

            return this._esbuild(portal, entryCode, bots);
        }

        return Promise.resolve();
    }

    private async _esbuild(
        portal: Portal,
        entryCode: string,
        bots: PrecalculatedBot[]
    ) {
        if (!this._esbuildService) {
            let options: ESBuild.ServiceOptions = {};
            if (this._esbuildWasmUrl) {
                options.wasmURL = this._esbuildWasmUrl;
            }
            this._esbuildService = await esbuild.startService(options);
        }

        try {
            const result = await this._esbuildService.build({
                entryPoints: ['__entry'],
                bundle: true,
                format: 'iife',
                write: false,
                plugins: [
                    this._esbuildPlugin(portal.scriptPrefixes, entryCode, bots),
                ],
            });

            let final = '';
            for (let file of result.outputFiles) {
                final += file.text;
            }

            const warnings = result.warnings.map((w) => w.text);

            this._onBundleUpdated.next({
                portalId: portal.portalId,
                source: final,
                warnings: warnings,
            });
        } catch (err) {
            this._onBundleUpdated.next({
                portalId: portal.portalId,
                warnings: [],
                error: err.toString(),
            });
        }
    }

    private _esbuildPlugin(
        prefixes: string[],
        entryCode: string,
        bots: PrecalculatedBot[]
    ): ESBuild.Plugin {
        return {
            name: 'casualos',
            setup: (build) => {
                build.onResolve({ filter: /^__entry$/ }, (args) => ({
                    path: args.path,
                    namespace: 'entry-ns',
                }));

                build.onLoad(
                    { filter: /^__entry$/, namespace: 'entry-ns' },
                    (args) => ({
                        contents: entryCode,
                        loader: 'js',
                    })
                );

                build.onResolve({ filter: /\\?auxmodule$/ }, (args) => ({
                    path: args.path,
                    namespace: 'aux-ns',
                }));

                for (let p of prefixes) {
                    let prefix = p;
                    build.onResolve(
                        { filter: new RegExp(`^${prefix}`) },
                        (args) => {
                            const tag = trimPrefixedScript(prefix, args.path);
                            const bot = bots.find((b) =>
                                isPortalScript(prefix, b.values[tag])
                            );

                            if (!bot) {
                                return {
                                    errors: [
                                        {
                                            text: `Unable to resolve "${prefixes[0]}${tag}". No matching script could be found.`,
                                        },
                                    ],
                                };
                            }

                            return {
                                path: auxModuleId(prefix, bot.id, tag),
                                namespace: 'aux-ns',
                            };
                        }
                    );
                }

                build.onLoad(
                    { filter: /\\?auxmodule$/, namespace: 'aux-ns' },
                    (args) => {
                        const { prefix, botId, tag } = parseAuxModuleId(
                            prefixes,
                            args.path
                        );
                        if (prefix && botId && tag) {
                            const bot = this._state[botId];
                            if (!bot) {
                                return {
                                    errors: [
                                        {
                                            text: `Unable to import "${prefix}${tag}". No matching script could be found.`,
                                        },
                                    ],
                                };
                            }
                            const code = bot.values[tag];
                            return {
                                contents: trimPrefixedScript(prefix, code),
                                loader: 'js',
                            };
                        }

                        return {
                            errors: [
                                {
                                    text: `Did you forget to use 📖 when importing?`,
                                },
                            ],
                        };
                    }
                );

                build.onResolve({ filter: /^https?/ }, (args) => ({
                    path: args.path,
                    namespace: 'http-ns',
                }));

                build.onResolve({ filter: /.*/ }, (args) => {
                    const importee = args.path;
                    let importer = args.importer;
                    // convert to HTTP(S) import.
                    if (importee.startsWith('/') || importee.startsWith('./')) {
                        // use importer as base URL
                        if (!importer.endsWith('/')) {
                            importer = importer + '/';
                        }
                        const url = new URL(importee, importer);
                        return { path: url.href, namespace: 'http-ns' };
                    } else {
                        return {
                            path: `${this._baseModuleUrl}/${importee}`,
                            namespace: 'http-ns',
                        };
                    }
                });

                build.onLoad(
                    { filter: /^https?/, namespace: 'http-ns' },
                    async (args) => {
                        try {
                            const cached = this._httpCache.get(args.path);
                            if (typeof cached !== 'undefined') {
                                return {
                                    contents: await cached,
                                    loader: 'js',
                                };
                            }

                            let promise = axios
                                .get(args.path)
                                .then((response) => {
                                    if (typeof response.data === 'string') {
                                        const script = response.data;
                                        return script;
                                    } else {
                                        throw new Error(
                                            `The module server did not return a string.`
                                        );
                                    }
                                });

                            this._httpCache.set(args.path, promise);

                            const script = await promise;
                            return {
                                contents: script,
                                loader: 'js',
                            };
                        } catch (err) {
                            return {
                                errors: [
                                    {
                                        text: `${err}`,
                                    },
                                ],
                            };
                        }
                    }
                );
            },
        };
    }
}

function auxModuleId(prefix: string, botId: string, tag: string) {
    return `${prefix}${botId}.${tag}?auxmodule`;
}

function parseAuxModuleId(
    prefixes: string[],
    id: string
): { prefix: string; botId: string; tag: string } {
    if (isAuxModuleId(id)) {
        for (let prefix of prefixes) {
            if (id.startsWith(prefix)) {
                id = id.substring(prefix.length);
                const dotIndex = id.indexOf('.');
                const botId = id.slice(0, dotIndex);
                const tag = id.slice(
                    dotIndex + 1,
                    id.length - '?auxmodule'.length
                );

                return {
                    prefix,
                    botId,
                    tag,
                };
            }
        }
    }
    return { prefix: null, botId: null, tag: null };
}

function isAuxModuleId(id: string) {
    return id.endsWith('?auxmodule');
}
