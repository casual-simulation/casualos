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
                let modules = new Map<string, string>();
                let entryCode = '';
                let bots = sortBy(values(this._state), (b) => b.id);

                for (let entrypoint of portal.entrypoints) {
                    let tagModules = bots
                        .map((b) => ({
                            name: `${b.id}-${entrypoint.tag}`,
                            code: b.values[entrypoint.tag],
                        }))
                        .filter((value) => isEntrypointTag(value.code))
                        .map((m) => ({
                            ...m,
                            code: trimEntrypointTag(m.code),
                        }));

                    for (let m of tagModules) {
                        modules.set(m.name, m.code);
                    }
                }

                for (let [name, code] of modules) {
                    entryCode += `import ${JSON.stringify(name)};\n`;
                }

                // bundle it
                rollup({
                    input: 'main',
                    plugins: [
                        {
                            name: 'test',
                            resolveId(importee, importer) {
                                if (!importer) {
                                    return importee;
                                }

                                return importee;
                            },
                            load(id) {
                                if (id === 'main') {
                                    return entryCode;
                                }

                                const code = modules.get(id);

                                if (!code) {
                                    throw new Error(
                                        `Missing module ${id}. Maybe it was not a script?`
                                    );
                                }

                                return code;
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
