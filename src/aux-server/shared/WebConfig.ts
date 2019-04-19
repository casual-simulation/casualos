/**
 * Defines an interface for the configuration that the web client should try to pull from the server.
 */
export interface WebConfig {
    /**
     * Gets the base URL of the projector.
     */
    projectorBaseUrl: string;

    /**
     * Gets the base URL of the player.
     */
    playerBaseUrl: string;

    /**
     * Whether the client currently represents an AUX Builder.
     */
    isBuilder: boolean;

    /**
     * Whether the client currently represents an AUX Player.
     */
    isPlayer: boolean;
}
