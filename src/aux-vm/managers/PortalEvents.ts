import { OpenCustomPortalOptions } from '@casual-simulation/aux-common';

/**
 * Defines a list of portal events.
 */
export type PortalEvent = RegisterPortalEvent | UpdatePortalSourceEvent;

/**
 * Defines an event that indicates a portal was registered.
 */
export interface RegisterPortalEvent {
    type: 'register_portal';

    /**
     * The ID of the portal to register.
     */
    portalId: string;

    /**
     * The options for the portal.
     */
    options: OpenCustomPortalOptions;
}

/**
 * Defines an event that indicates the source code for a portal should be updated.
 */
export interface UpdatePortalSourceEvent {
    type: 'update_portal_source';

    /**
     * The ID of the portal.
     */
    portalId: string;

    /**
     * The source code to use.
     */
    source: string;

    /**
     * The error that the portal ran into.
     */
    error: string;
}
