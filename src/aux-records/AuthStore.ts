/**
 * Defines an interface that represents an auth store.
 */
export interface AuthStore {
    /**
     * Saves the given user.
     * @param user The user that should be saved.
     */
    saveUser(user: AuthUser): Promise<void>;

    /**
     * Finds the user that represents the given address.
     * @param address The address.
     * @param addressType The type of the address.
     */
    findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser>;

    /**
     * Finds a login request for the given user and request ID.
     * @param userId The ID of the user.
     * @param requestId The ID of the request.
     */
    findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest>;

    /**
     * Finds a login session for the given user and session ID.
     * @param userId The ID of the user.
     * @param sessionId The ID of the session.
     */
    findSession(userId: string, sessionId: string): Promise<AuthSession>;

    /**
     * Saves the given login request.
     * @param request The request that should be saved.
     */
    saveLoginRequest(request: AuthLoginRequest): Promise<AuthLoginRequest>;

    /**
     * Increments the attempt count for the given login request.
     * @param userId The ID of the user.
     * @param requestId The ID of the login request.
     */
    incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void>;

    /**
     * Saves the given login session.
     * @param session The session that should be saved.
     */
    saveSession(session: AuthSession): Promise<void>;
}

export type AddressType = 'email' | 'phone';

export interface AuthUser {
    id: string;
    email: string | null;
    phoneNumber: string | null;
}

/**
 * Defines an interface that represents the data a login request contains.
 */
export interface AuthLoginRequest {
    /**
     * The ID of the user that the login request is for.
     */
    userId: string;

    /**
     * The ID of the request.
     */
    requestId: string;

    /**
     * The hash that the request should match.
     */
    secretHash: string;

    /**
     * The unix timestamp in miliseconds that the request was made at.
     */
    requestTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the request was completed at.
     * If null, then the request has not been completed.
     */
    completedTimeMs: number;

    /**
     * The number of attempts made to complete the request.
     */
    attemptCount: number;

    /**
     * The address that the request is for.
     */
    address: string;

    /**
     * The type of address that the request is for.
     */
    addressType: AddressType;
}

/**
 * Defines an interface that represents a login session for the user.
 */
export interface AuthSession {
    /**
     * The ID of the user that the session is for.
     */
    userId: string;

    /**
     * The ID of the session.
     */
    sessionId: string;

    /**
     * The hash of the token that provides access to this session.
     */
    secretHash: string;

    /**
     * The unix timestamp in miliseconds that the session was granted at.
     */
    grantedTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the session will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix timestamp in miliseconds that the session was revoked at.
     * If null, then the session has not been revoked.
     */
    revokeTimeMs: number;

    /**
     * The ID of the login request that was used to obtain this session.
     */
    requestId: string;
}
