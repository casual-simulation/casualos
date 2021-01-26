import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { startWith, tap } from 'rxjs/operators';
import { PortalEvent } from '../vm/PortalEvents';
import { AuxVM } from '../vm/AuxVM';
import { hasValue } from '@casual-simulation/aux-common';

/**
 * Defines a class that is able to manage portals and their interactions.
 */
export class PortalManager implements SubscriptionLike {
    private _portals: Map<string, PortalData>;

    private _portalsDiscovered: Subject<PortalData[]>;
    private _portalsUpdated: Subject<PortalUpdate[]>;
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

    constructor(vm: AuxVM) {
        this._portals = new Map();
        this._portalsDiscovered = new Subject();
        this._portalsUpdated = new Subject();
        this._sub = new Subscription();

        this._sub.add(
            vm.portalEvents
                .pipe(tap((events) => this._onPortalEvents(events)))
                .subscribe()
        );
    }

    private _onPortalEvents(events: PortalEvent[]): void {
        let newPortals: PortalData[] = [];
        let updatedPortals: Map<string, PortalUpdate> = new Map();

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
                } else {
                    const newPortal: PortalData = {
                        id: event.portalId,
                        source: null,
                        scriptPrefixes: event.options.scriptPrefixes,
                        style: event.options.style,
                    };

                    this._portals.set(event.portalId, newPortal);
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
