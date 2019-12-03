/**
 * Defines an interface for the configuration that the web client should try to pull from the server.
 */
export interface WebConfig {
    /**
     * Whether the client currently represents an AUX Builder.
     */
    isBuilder: boolean;

    /**
     * Whether the client currently represents an AUX Player.
     */
    isPlayer: boolean;

    /**
     * The Sentry DSN that should be used to report errors.
     */
    sentryDsn: string;

    /**
     * The protocol version.
     */
    version: 1 | 2;
}
