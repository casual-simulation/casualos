/**
 * Defines an interface for the configuration that the web client should try to pull from the server.
 */
export interface WebConfig {
    /**
     * The Sentry DSN that should be used to report errors.
     */
    sentryDsn: string;

    /**
     * The protocol version.
     */
    version: 1 | 2;
}
