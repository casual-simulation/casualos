import {
    RemoteCausalRepoProtocol,
    SharedPartitionsVersion,
} from '@casual-simulation/aux-common';

/**
 * The possible BIOS options.
 *
 * - "enter join code" indicates that the user should be prompted to enter a join code.
 * - "staticInst" indicates that the instance should be loaded statically.
 * - "publicInst" indicates that the instance should be loaded from the public partition.
 * - "privateInst" indicates that the instance should be loaded from the private partition.
 * - "sign in" indicates that the user should be prompted to sign in.
 * - "sign up" indicates that the user should be prompted to sign up.
 * - "sign out" indicates that the user should be logged out.
 */
export type BiosOption =
    | 'enter join code'
    | 'static inst'
    | 'public inst'
    | 'private inst'
    | 'sign in'
    | 'sign up'
    | 'sign out';

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
     * Whether collaborative repositories should be persisted locally.
     * Defaults to false.
     */
    collaborativeRepoLocalPersistence?: boolean;

    /**
     * Whether static repositories should be persisted locally.
     * Defaults to true.
     */
    staticRepoLocalPersistence?: boolean;

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

    /**
     * The preferred source for loading instances.
     * - "public" means that public instances should be loaded by default.
     * - "private" means that private instances should be loaded if possible.
     *
     * Defaults to "private".
     */
    preferredInstSource?: 'public' | 'private';

    /**
     * Whetehr to require that users login with Privo before they can access collaboration features.
     */
    requirePrivoLogin?: boolean;

    /**
     * The allowed BIOS options.
     * If omitted, then all options are allowed.
     */
    allowedBiosOptions?: BiosOption[];

    // /**
    //  * Whether to require that age verification runs before the user can access collaboration features.
    //  * Defaults to false.
    //  */
    // requirePrivoAgeVerification?: boolean;

    // /**
    //  * The URL that the Privo Age Verification API script should be loaded from.
    //  */
    // privoAgeVerificationApiScriptUrl?: string;

    // /**
    //  * The service identifier that should be used for the Privo Age Verification API.
    //  */
    // privoAgeVerificationServiceId?: string;
}
