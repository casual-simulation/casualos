import {
    applyUpdates,
    BotIndex,
    BotIndexEvent,
    BotsState,
    calculateBotValue,
    PrecalculatedBotsState,
    stateUpdatedEvent,
    StateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { rollup } from 'rollup';
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
    stateUpdated(event: StateUpdatedEvent) {
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

        this._updateBundles(event, batch);
    }

    /**
     * Registers a custom portal with the given ID.
     * @param portalId The ID of the portal.
     */
    registerCustomPortal(portalId: string): boolean {
        if (!this._portals.has(portalId)) {
            this._portals.set(portalId, {
                portalId,
                entrypoints: [],
            });
            return true;
        }

        return false;
    }

    /**
     * Adds an entry point to the portal with the given ID.
     * @param portalId The ID of the portal.
     * @param entrypoint The entrypoint.
     */
    addEntryPoint(portalId: string, entrypoint: PortalEntrypoint): void {
        let portal = this._portals.get(portalId);
        if (portal) {
            portal.entrypoints.push({
                tag: trimEntrypointTag(entrypoint.tag),
                botId: entrypoint.botId,
            });

            this._updateBundle(
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
                return isEntrypointTag(
                    calculateBotValue(null, event.bot, event.tag)
                );
            } else if (event.type === 'bot_tag_removed') {
                return isEntrypointTag(
                    calculateBotValue(null, event.oldBot, event.tag)
                );
            } else if (event.type === 'bot_tag_updated') {
                const wasEntrypointTag = isEntrypointTag(
                    calculateBotValue(null, event.oldBot, event.tag)
                );
                const isEntrypoint = isEntrypointTag(
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
                        name: auxModuleId(b.id, entrypoint.tag),
                        code: b.values[entrypoint.tag],
                    }))
                    .filter((value) => isEntrypointTag(value.code))
                    .map((m) => ({
                        ...m,
                        code: trimEntrypointTag(m.code),
                    }));

                for (let m of tagModules) {
                    entryModules.add(m.name);
                }
            }

            for (let name of entryModules) {
                entryCode += `import ${JSON.stringify(name)};\n`;
            }

            let warnings = [] as string[];

            const _this = this;

            // bundle it
            return rollup({
                input: '__entry',
                cache: this._buildCache.get(portal.portalId),
                onwarn: (warning, defaultHandler) => {
                    warnings.push(warning.message);
                },
                plugins: [
                    {
                        name: 'test',
                        resolveId: function (importee, importer) {
                            if (!importer) {
                                return importee;
                            }

                            if (isEntrypointTag(importee)) {
                                const tag = trimEntrypointTag(importee);
                                const bot = bots.find((b) =>
                                    isEntrypointTag(b.values[tag])
                                );

                                if (!bot) {
                                    this.error(
                                        `Unable to resolve "📖${tag}". No matching script could be found.`
                                    );
                                }

                                return auxModuleId(bot.id, tag);
                            }

                            if (isAuxModuleId(importee)) {
                                return importee;
                            }

                            if (/https?/.test(importee)) {
                                return importee;
                            }

                            // convert to HTTP(S) import.
                            if (
                                importee.startsWith('/') ||
                                importee.startsWith('./')
                            ) {
                                // use importer as base URL
                                if (!importer.endsWith('/')) {
                                    importer = importer + '/';
                                }
                                const url = new URL(importee, importer);
                                return url.href;
                            } else {
                                return `${_this._baseModuleUrl}/${importee}`;
                            }
                        },
                        load: async function (id) {
                            if (id === '__entry') {
                                return entryCode;
                            }
                            const { botId, tag } = parseAuxModuleId(id);
                            if (botId && tag) {
                                const bot = _this._state[botId];
                                if (!bot) {
                                    this.error(
                                        `Unable to import "📖${tag}". No matching script could be found.`
                                    );
                                }
                                const code = bot.values[tag];
                                return trimEntrypointTag(code);
                            }

                            if (/https?/.test(id)) {
                                try {
                                    const cached = _this._httpCache.get(id);
                                    if (typeof cached !== 'undefined') {
                                        return await cached;
                                    }

                                    let promise = axios
                                        .get(id)
                                        .then((response) => {
                                            if (
                                                typeof response.data ===
                                                'string'
                                            ) {
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
                                    this.error(`${err}`);
                                }
                            }

                            this.error(
                                `Did you forget to use 📖 when importing?`
                            );
                        },
                    },
                ],
            })
                .then(async (bundle) => {
                    this._buildCache.set(portal.portalId, bundle.cache);
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
                })
                .catch((err) => {
                    this._onBundleUpdated.next({
                        portalId: portal.portalId,
                        warnings: warnings,
                        error: err,
                    });
                });
        }

        return Promise.resolve();
    }
}

/**
 * Trims the leading script symbol off the given tag.
 */
export function trimEntrypointTag(tag: string): string {
    if (tag.startsWith('📖')) {
        return tag.substring('📖'.length);
    }
    return tag;
}

/**
 * Determines if the given value is for a script entrypoint.
 * @param value The value to check.
 */
export function isEntrypointTag(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('📖');
}

function auxModuleId(botId: string, tag: string) {
    return `${botId}.${tag}?auxmodule`;
}

function parseAuxModuleId(id: string): { botId: string; tag: string } {
    if (isAuxModuleId(id)) {
        const dotIndex = id.indexOf('.');
        const botId = id.slice(0, dotIndex);
        const tag = id.slice(dotIndex + 1, id.length - '?auxmodule'.length);

        return {
            botId,
            tag,
        };
    }
    return { botId: null, tag: null };
}

function isAuxModuleId(id: string) {
    return id.endsWith('?auxmodule');
}
