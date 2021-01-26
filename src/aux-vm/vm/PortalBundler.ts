import {
    applyUpdates,
    BotIndex,
    BotIndexEvent,
    BotsState,
    calculateBotValue,
    PrecalculatedBot,
    PrecalculatedBotsState,
    RegisterCustomPortalOptions,
    stateUpdatedEvent,
    StateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { rollup, Plugin, PluginContext } from 'rollup';
import values from 'lodash/values';
import { pick, sortBy } from 'lodash';
import axios from 'axios';

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
}

export const DEFAULT_BASE_MODULE_URL: string = 'https://cdn.skypack.dev';

/**
 * Defines a class that is used to bundle scripts for portals.
 * It listens for state updates and is able to asynchrounously emit bundles that should be injected into custom portals.
 */
export class PortalBundler {
    private _portals: Map<string, Portal>;
    private _state: PrecalculatedBotsState;
    private _onBundleUpdated: Subject<Bundle>;
    private _baseModuleUrl: string = DEFAULT_BASE_MODULE_URL;
    private _httpCache: Map<string, Promise<string>>;
    private _buildCache: Map<string, any>;
    private _index: BotIndex;

    /**
     * An observable that emits when a bundle is updated.
     */
    get onBundleUpdated(): Observable<Bundle> {
        return this._onBundleUpdated;
    }

    constructor() {
        this._portals = new Map();
        this._httpCache = new Map();
        this._buildCache = new Map();
        this._index = new BotIndex();
        this._onBundleUpdated = new Subject();
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

    /**
     * Registers a custom portal with the given ID.
     * @param portalId The ID of the portal.
     * @param options The options for the portal.
     */
    registerCustomPortal(
        portalId: string,
        options: RegisterCustomPortalOptions
    ): void {
        this._portals.set(portalId, {
            portalId,
            entrypoints: [],
            scriptPrefixes: options.scriptPrefixes,
        });
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
                tag: trimEntrypointTag(portal.scriptPrefixes, entrypoint.tag),
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

    private _plugin(
        prefixes: string[],
        entryCode: string,
        bots: PrecalculatedBot[]
    ) {
        let _this = this;
        return {
            name: 'test',
            resolveId,
            load,
        } as Plugin;

        function resolveId(
            this: PluginContext,
            importee: string,
            importer: string
        ) {
            if (!importer) {
                return importee;
            }

            if (isAuxModuleId(importee)) {
                return importee;
            }

            const prefix = getScriptPrefix(prefixes, importee);
            if (prefix) {
                const tag = trimPrefixedTag(prefix, importee);
                const bot = bots.find((b) =>
                    isEntrypointTag(prefix, b.values[tag])
                );

                if (!bot) {
                    this.error(
                        `Unable to resolve "${prefixes[0]}${tag}". No matching script could be found.`
                    );
                }

                return auxModuleId(prefix, bot.id, tag);
            }

            if (/https?/.test(importee)) {
                return importee;
            }

            // convert to HTTP(S) import.
            if (importee.startsWith('/') || importee.startsWith('./')) {
                // use importer as base URL
                if (!importer.endsWith('/')) {
                    importer = importer + '/';
                }
                const url = new URL(importee, importer);
                return url.href;
            } else {
                return `${_this._baseModuleUrl}/${importee}`;
            }
        }

        async function load(this: PluginContext, id: string) {
            if (id === '__entry') {
                return entryCode;
            }
            const { prefix, botId, tag } = parseAuxModuleId(prefixes, id);
            if (prefix && botId && tag) {
                const bot = _this._state[botId];
                if (!bot) {
                    return this.error(
                        `Unable to import "${prefix}${tag}". No matching script could be found.`
                    );
                }
                const code = bot.values[tag];
                return trimPrefixedTag(prefix, code);
            }

            if (/https?/.test(id)) {
                try {
                    const cached = _this._httpCache.get(id);
                    if (typeof cached !== 'undefined') {
                        return await cached;
                    }

                    let promise = axios.get(id).then((response) => {
                        if (typeof response.data === 'string') {
                            const script = response.data;
                            return script;
                        } else {
                            throw new Error(
                                `The module server did not return a string.`
                            );
                        }
                    });

                    _this._httpCache.set(id, promise);

                    return await promise;
                } catch (err) {
                    return this.error(`${err}`);
                }
            }

            return this.error(`Did you forget to use 📖 when importing?`);
        }
    }

    private _updateBundle(
        event: StateUpdatedEvent,
        indexEvents: BotIndexEvent[],
        portal: Portal
    ) {
        let hasUpdate = indexEvents.some((event) => {
            if (event.type === 'bot_tag_added') {
                return hasEntrypointTag(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.bot, event.tag)
                );
            } else if (event.type === 'bot_tag_removed') {
                return hasEntrypointTag(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.oldBot, event.tag)
                );
            } else if (event.type === 'bot_tag_updated') {
                const wasEntrypointTag = hasEntrypointTag(
                    portal.scriptPrefixes,
                    calculateBotValue(null, event.oldBot, event.tag)
                );
                const isEntrypoint = hasEntrypointTag(
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
                        code: trimPrefixedTag(m.prefix, m.code),
                    }));

                for (let m of tagModules) {
                    entryModules.add(m.name);
                }
            }

            for (let name of entryModules) {
                entryCode += `import ${JSON.stringify(name)};\n`;
            }

            let warnings = [] as string[];

            return new Promise<void>((resolve, reject) => {
                try {
                    // bundle it
                    rollup({
                        input: '__entry',
                        cache: this._buildCache.get(portal.portalId),
                        onwarn: (warning, defaultHandler) => {
                            warnings.push(warning.message);
                        },
                        plugins: [
                            this._plugin(
                                portal.scriptPrefixes,
                                entryCode,
                                bots
                            ),
                        ],
                    })
                        .then(async (bundle) => {
                            this._buildCache.set(portal.portalId, bundle.cache);

                            if (bundle.getTimings) {
                                const timings = bundle.getTimings();
                                console.log(timings);
                            }

                            const result = await bundle.generate({
                                format: 'iife',
                            });

                            const { output } = result;

                            let final = '';
                            for (let chunkOrAsset of output) {
                                if (chunkOrAsset.type === 'chunk') {
                                    final += chunkOrAsset.code;
                                }
                            }

                            this._onBundleUpdated.next({
                                portalId: portal.portalId,
                                source: final,
                                warnings: warnings,
                            });
                            resolve();
                        })
                        .catch((err) => {
                            const bundle = {
                                portalId: portal.portalId,
                                warnings: warnings,
                                error: err,
                            };
                            this._onBundleUpdated.next(bundle);
                            resolve();
                        });
                } catch (err) {
                    const bundle = {
                        portalId: portal.portalId,
                        warnings: warnings,
                        error: err,
                    };
                    this._onBundleUpdated.next(bundle);
                    resolve();
                }
            });
        }

        return Promise.resolve();
    }
}

/**
 * Trims the leading script symbol off the given tag.
 */
export function trimEntrypointTag(
    scriptPrefixes: string[],
    tag: string
): string {
    const prefix = getScriptPrefix(scriptPrefixes, tag);
    if (prefix) {
        return tag.substring(prefix.length);
    }
    return tag;
}

/**
 * Trims the leading script symbol off the given tag.
 */
export function trimPrefixedTag(prefix: string, tag: string): string {
    if (tag.startsWith(prefix)) {
        return tag.substring(prefix.length);
    }
    return tag;
}

/**
 * Determines if the given value is for a script entrypoint.
 * @param prefix The prefix to check against.
 * @param value The value to check.
 */
export function isEntrypointTag(prefix: string, value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(prefix);
}

export function hasEntrypointTag(prefixes: string[], value: unknown): boolean {
    return getScriptPrefix(prefixes, value) !== null;
}

export function getScriptPrefix(prefixes: string[], value: unknown): string {
    if (typeof value === 'string') {
        for (let prefix of prefixes) {
            if (value.startsWith(prefix)) {
                return prefix;
            }
        }
    }
    return null;
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
