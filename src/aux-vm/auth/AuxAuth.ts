/**
 * Defines an interface for an object that is able to communicate with an authentication service.
 */
export interface AuxAuth {
    /**
     * Determines whether the user is authenticated.
     */
    isLoggedIn(): Promise<boolean>;

    /**
     * Logs the user in.
     * Returns a promise that resolves with data about the user.
     */
    login(): Promise<LoginData>;
}

/**
 * Data about the logged in user.
 */
export interface LoginData {
    /**
     * The ID of the user.
     */
    userId: string;

    /**
     * The token that the service is authorized to use.
     */
    token: string;

    /**
     * The service that was authorized by the user.
     */
    service: string;
}
