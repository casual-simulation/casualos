import {
    applyUpdates,
    BotsState,
    PrecalculatedBotsState,
    StateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { rollup } from 'rollup';
import values from 'lodash/values';
import { sortBy } from 'lodash';

export interface PortalEntrypoint {
    botId?: string;
    tag: string;
}

export interface Bundle {
    portalId: string;
    source: string;
}

export interface Portal {
    portalId: string;
    entrypoints: PortalEntrypoint[];
}

/**
 * Defines a class that is used to bundle scripts for portals.
 * It listens for state updates and is able to asynchrounously emit bundles that should be injected into custom portals.
 */
export class PortalBundler {
    private _portals: Map<string, Portal>;
    private _state: PrecalculatedBotsState;
    private _onBundleUpdated: Subject<Bundle>;

    /**
     * An observable that emits when a bundle is updated.
     */
    get onBundleUpdated(): Observable<Bundle> {
        return this._onBundleUpdated;
    }

    constructor() {
        this._portals = new Map();
        this._onBundleUpdated = new Subject();
    }

    /**
     * Processes the given state update event.
     */
    stateUpdated(event: StateUpdatedEvent) {
        this._state = applyUpdates(this._state, event);

        for (let portal of this._portals.values()) {
            let hasEntrypointUpdate = false;
            for (let id in event.state) {
                const updatedBot = event.state[id];
                hasEntrypointUpdate = portal.entrypoints.some(
                    (e) => e.tag in updatedBot.values
                );

                if (hasEntrypointUpdate) {
                    break;
                }
            }

            if (hasEntrypointUpdate) {
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

                // bundle it
                rollup({
                    input: '__entry',
                    plugins: [
                        {
                            name: 'test',
                            resolveId: (importee, importer) => {
                                if (!importer) {
                                    return importee;
                                }

                                if (isEntrypointTag(importee)) {
                                    const tag = trimEntrypointTag(importee);
                                    const bot = bots.find((b) =>
                                        isEntrypointTag(b.values[tag])
                                    );

                                    if (!bot) {
                                        throw new Error(
                                            `Unable to resolve "📖${tag}". No matching script could be found.`
                                        );
                                    }

                                    return auxModuleId(bot.id, tag);
                                }

                                return importee;
                            },
                            load: (id) => {
                                if (id === '__entry') {
                                    return entryCode;
                                }
                                const { botId, tag } = parseAuxModuleId(id);
                                if (botId && tag) {
                                    const bot = this._state[botId];
                                    if (!bot) {
                                        throw new Error(
                                            `Unable to import "📖${tag}". No matching script could be found.`
                                        );
                                    }
                                    const code = bot.values[tag];
                                    return trimEntrypointTag(code);
                                }

                                throw new Error(
                                    `Unable to import "${id}". Did you forget to use 📖 when importing?`
                                );
                            },
                        },
                    ],
                }).then(async (bundle) => {
                    const { output } = await bundle.generate({
                        format: 'iife',
                    });

                    let final = '';
                    for (let chunkOrAsset of output) {
                        if (chunkOrAsset.type === 'chunk') {
                            final += chunkOrAsset.code;
                        }
                    }

                    this._onBundleUpdated.next({
                        portalId: portal.portalId,
                        source: final,
                    });
                });
            }
        }
    }

    /**
     * Registers a custom portal with the given ID.
     * @param portalId The ID of the portal.
     */
    registerCustomPortal(portalId: string): void {
        this._portals.set(portalId, {
            portalId,
            entrypoints: [],
        });
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
        }
    }
}

/**
 * Trims the leading # symbol off the given tag.
 */
export function trimEntrypointTag(tag: string): string {
    if (tag.startsWith('📖')) {
        return tag.substring('📖'.length);
    }
    return tag;
}

export function isEntrypointTag(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith('📖');
}

function auxModuleId(botId: string, tag: string) {
    return `${botId}.${tag}?auxmodule`;
}

function parseAuxModuleId(id: string): { botId: string; tag: string } {
    if (id.endsWith('?auxmodule')) {
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
