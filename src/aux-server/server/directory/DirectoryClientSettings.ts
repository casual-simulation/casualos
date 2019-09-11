export const DEFAULT_PING_INTERVAL = 5;

/**
 * The settings that the directory client currently has.
 */
export interface DirectoryClientSettings {
    /**
     * The amount of time between pings in minutes.
     */
    pingInterval: number;

    /**
     * The password that the client is using.
     */
    password: string;

    /**
     * The JWT that the client last got from the server.
     */
    token: string;
}
