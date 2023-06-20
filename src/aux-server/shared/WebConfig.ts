import {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '@casual-simulation/aux-common';

/**
 * Defines an interface for the configuration that the web client should try to pull from the server.
 */
export interface WebConfig {
    /**
     * The protocol version.
     */
    version: 1 | 2 | null;

    /**
     * The protocol that should be used for realtime connections.
     */
    causalRepoConnectionProtocol: RemoteCausalRepoProtocol;

    /**
     * The URL that should be used for realtime connections.
     */
    causalRepoConnectionUrl?: string | null;

    /**
     * The version of the shared partitions that should be used.
     */
    sharedPartitionsVersion?: SharedPartitionsVersion | null;

    /**
     * The HTTP Origin that should be used for VM Iframes.
     */
    vmOrigin?: string | null;

    /**
     * The HTTP origin that should be used for auth iframes.
     */
    authOrigin?: string | null;

    /**
     * The HTTP origin that should be used for records.
     */
    recordsOrigin?: string | null;

    /**
     * Whether collaboration should be disabled.
     * Setting this to true will replace the shared partition of simulations
     * with tempLocal partitions.
     */
    disableCollaboration?: boolean | null;

    /**
     * The URL that should be used to bootstrap AB1.
     */
    ab1BootstrapURL?: string | null;

    /**
     * The API key that should be used for the ArcGIS mapping API.
     */
    arcGisApiKey?: string | null;

    /**
     * The app name that should be used for the Jitsi meet portal.
     */
    jitsiAppName?: string | null;

    /**
     * The API Key that should be used for what3words integration.
     */
    what3WordsApiKey?: string | null;

    /**
     * Gets the player mode of this CasualOS version.
     *
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode?: 'player' | 'builder' | null;
}
