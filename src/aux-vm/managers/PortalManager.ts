import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { startWith, tap } from 'rxjs/operators';
import { PortalEvent } from '../vm/PortalEvents';
import { AuxVM } from '../vm/AuxVM';
import { DNA_TAG_PREFIX, hasValue } from '@casual-simulation/aux-common';
import { remove } from 'lodash';

/**
 * The list of default script prefixes.
 */
export const DEFAULT_SCRIPT_PREFIXES: ScriptPrefix[] = [
    {
        portalId: null,
        prefix: '@',
        language: 'javascript',
    },
    {
        portalId: null,
        prefix: DNA_TAG_PREFIX,
        language: 'json',
    },
];

/**
 * Defines a class that is able to manage portals and their interactions.
 */
export class PortalManager implements SubscriptionLike {
    private _portals: Map<string, PortalData>;
    private _prefixes: Map<string, ScriptPrefix>;

    private _portalsDiscovered: Subject<PortalData[]>;
    private _portalsUpdated: Subject<PortalUpdate[]>;
    private _prefixesDiscovered: Subject<ScriptPrefix[]>;
    private _prefixesRemoved: Subject<string[]>;
    private _sub: Subscription;

    /**
     * Gets an observable that resolves when a new portal is discovered.
     */
    get portalsDiscovered(): Observable<PortalData[]> {
        return this._portalsDiscovered.pipe(
            startWith([...this._portals.values()])
        );
    }

    /**
     * Gets an observable that resolves when a portal is updated.
     */
    get portalsUpdated(): Observable<PortalUpdate[]> {
        return this._portalsUpdated;
    }

    /**
     * Gets an observable that resolves when a script prefix has been discovered.
     */
    get prefixesDiscovered(): Observable<ScriptPrefix[]> {
        return this._prefixesDiscovered.pipe(
            startWith([...this._prefixes.values()])
        );
    }

    /**
     * Gets an observable that resolves when a script prefix has been removed.
     */
    get prefixesRemoved(): Observable<string[]> {
        return this._prefixesRemoved;
    }

    /**
     * Gets the script prefixes that are currently in use.
     */
    get scriptPrefixes(): ScriptPrefix[] {
        return [...this._prefixes.values()];
    }

    constructor(vm: AuxVM) {
        this._portals = new Map();
        this._prefixes = new Map();
        this._portalsDiscovered = new Subject();
        this._portalsUpdated = new Subject();
        this._prefixesDiscovered = new Subject();
        this._prefixesRemoved = new Subject();
        this._sub = new Subscription();

        for (let p of DEFAULT_SCRIPT_PREFIXES) {
            this._prefixes.set(p.prefix, p);
        }

        this._sub.add(
            vm.portalEvents
                .pipe(tap((events) => this._onPortalEvents(events)))
                .subscribe()
        );
    }

    private _onPortalEvents(events: PortalEvent[]): void {
        let newPortals: PortalData[] = [];
        let newPrefixes: ScriptPrefix[] = [];
        let updatedPortals: Map<string, PortalUpdate> = new Map();
        let removedPrefixes: Set<string> = new Set();

        for (let event of events) {
            if (event.type === 'register_portal') {
                if (this._portals.has(event.portalId)) {
                    const currentPortal = this._portals.get(event.portalId);
                    // TODO: update properties
                    const nextPortal: PortalData = {
                        id: event.portalId,
                        source: currentPortal.source,
                        scriptPrefixes: event.options.scriptPrefixes,
                        style: event.options.style,
                    };

                    this._portals.set(event.portalId, nextPortal);

                    let currentUpdate = updatedPortals.get(event.portalId);
                    if (!currentUpdate) {
                        currentUpdate = {
                            oldPortal: currentPortal,
                            portal: nextPortal,
                        };
                        updatedPortals.set(event.portalId, currentUpdate);
                    } else {
                        currentUpdate.portal = nextPortal;
                    }

                    if (currentPortal.scriptPrefixes) {
                        for (let prefix of currentPortal.scriptPrefixes) {
                            this._prefixes.delete(prefix);
                            removedPrefixes.add(prefix);
                        }
                    }

                    if (nextPortal.scriptPrefixes) {
                        for (let prefix of nextPortal.scriptPrefixes) {
                            let prefixData: ScriptPrefix = {
                                portalId: nextPortal.id,
                                prefix,
                                language: 'javascript',
                            };
                            this._prefixes.set(prefix, prefixData);
                            if (removedPrefixes.has(prefix)) {
                                removedPrefixes.delete(prefix);
                            } else {
                                newPrefixes.push(prefixData);
                            }
                        }
                    }
                } else {
                    const newPortal: PortalData = {
                        id: event.portalId,
                        source: null,
                        scriptPrefixes: event.options.scriptPrefixes,
                        style: event.options.style,
                    };

                    this._portals.set(event.portalId, newPortal);

                    if (newPortal.scriptPrefixes) {
                        for (let prefix of newPortal.scriptPrefixes) {
                            let prefixData: ScriptPrefix = {
                                portalId: newPortal.id,
                                prefix,
                                language: 'javascript',
                            };
                            this._prefixes.set(prefix, prefixData);
                            if (removedPrefixes.has(prefix)) {
                                removedPrefixes.delete(prefix);
                            } else {
                                newPrefixes.push(prefixData);
                            }
                        }
                    }
                }
            } else if (event.type === 'update_portal_source') {
                const currentPortal = this._portals.get(event.portalId);

                if (currentPortal) {
                    const nextPortal: PortalData = {
                        ...currentPortal,
                        source: event.source,
                    };
                    if (hasValue(nextPortal.source)) {
                        this._portals.set(event.portalId, nextPortal);
                        if (hasValue(currentPortal.source)) {
                            // it is an update
                            let currentUpdate = updatedPortals.get(
                                event.portalId
                            );
                            if (!currentUpdate) {
                                currentUpdate = {
                                    oldPortal: currentPortal,
                                    portal: nextPortal,
                                };
                                updatedPortals.set(
                                    event.portalId,
                                    currentUpdate
                                );
                            } else {
                                currentUpdate.portal = nextPortal;
                            }
                        } else {
                            // it is a portal that does not have source yet
                            newPortals.push(nextPortal);
                        }
                    }
                }
            }
        }

        if (newPortals.length > 0) {
            this._portalsDiscovered.next(newPortals);
        }
        if (updatedPortals.size > 0) {
            this._portalsUpdated.next([...updatedPortals.values()]);
        }
        if (newPrefixes.length > 0) {
            this._prefixesDiscovered.next(newPrefixes);
        }
        if (removedPrefixes.size > 0) {
            this._prefixesRemoved.next([...removedPrefixes.values()]);
        }
    }

    unsubscribe(): void {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}

/**
 * Defines data about a script prefix.
 */
export interface ScriptPrefix {
    /**
     * The ID of the portal that defines this script prefix.
     * If null, then it is system defined.
     */
    portalId: string | null;

    /**
     * The prefix.
     */
    prefix: string;

    /**
     * The language that the prefix is for.
     */
    language: 'javascript' | 'json' | 'plaintext';
}

/**
 * Defines data about a portal.
 */
export interface PortalData {
    /**
     * The ID of the portal.
     */
    id: string;

    /**
     * The source code that the portal should use.
     */
    source: string;

    /**
     * The possible script prefixes for the portal.
     */
    scriptPrefixes: string[];

    /**
     * The CSS styles that the portal iframe should have.
     */
    style: any;
}

/**
 * Contains information about a portal update.
 */
export interface PortalUpdate {
    /**
     * The updated portal.
     */
    portal: PortalData;

    /**
     * The old portal.
     */
    oldPortal: PortalData;
}
