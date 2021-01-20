import { StateUpdatedEvent } from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';

export interface PortalEntrypoint {
    botId?: string;
    tag: string;
}

export interface Bundle {
    source: string;
}

/**
 * Defines a class that is used to bundle scripts for portals.
 * It listens for state updates and is able to asynchrounously emit bundles that should be injected into custom portals.
 */
export class PortalBundler {
    private _onBundleUpdated: Subject<Bundle>;

    /**
     * An observable that emits when a bundle is updated.
     */
    get onBundleUpdated(): Observable<Bundle> {
        return this._onBundleUpdated;
    }

    constructor() {
        this._onBundleUpdated = new Subject();
    }

    /**
     * Processes the given state update event.
     */
    stateUpdated(event: StateUpdatedEvent) {}

    /**
     * Registers a custom portal with the given ID.
     * @param portalId The ID of the portal.
     */
    registerCustomPortal(portalId: string): void {}

    /**
     * Adds an entry point to the portal with the given ID.
     * @param portalId The ID of the portal.
     * @param entrypoint The entrypoint.
     */
    addEntryPoint(portalId: string, entrypoint: PortalEntrypoint): void {}
}
