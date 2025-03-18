export const PrivoStore = Symbol.for('PrivoStore');

/**
 * Defines an interface for services that can store information that is needed for Privo integration.
 */
export interface PrivoStore {
    /**
     * Gets the stored privo credentials.
     * Returns the stored credentials or null if there are none stored credentials.
     */
    getStoredCredentials(): Promise<PrivoClientCredentials | null>;

    /**
     * Saves the given credentials.
     * @param credentials The credentials to save.
     */
    saveCredentials(credentials: PrivoClientCredentials): Promise<void>;
}

export interface PrivoClientCredentials {
    /**
     * The ID of these credentials in the database.
     */
    id: string;

    /**
     * The unix time in seconds that these credentials expire at.
     */
    expiresAtSeconds: number;

    /**
     * The access token.
     */
    accessToken: string;

    /**
     * The refresh token.
     */
    refreshToken: string | null | undefined;

    /**
     * The scope that was granted.
     */
    scope: string;
}
