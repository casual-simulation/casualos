import { ServerError } from './Errors';

/**
 * Defines an interface that represents an auth store.
 */
export interface AuthStore {
    /**
     * Adds or updates the given user.
     * @param user The user that should be saved.
     */
    saveUser(user: AuthUser): Promise<void>;

    /**
     * Attempts to save the given user as a new user.
     * @param user The user that should be saved.
     */
    saveNewUser(user: AuthUser): Promise<SaveNewUserResult>;

    /**
     * Finds the user with the given ID.
     * @param userId The ID of the user.
     */
    findUser(userId: string): Promise<AuthUser>;

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
     * Marks the login request as completed.
     * @param userId The ID oof the user.
     * @param requestId The ID of the request.
     * @param completedTimeMs The time that the request was completed.
     */
    markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void>;

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

    /**
     * Lists the sessions that belong to the given user.
     * @param userId The ID of the user.
     * @param expireTimeMs The expiration time that the list should start after.
     */
    listSessions(
        userId: string,
        expireTimeMs: number | null
    ): Promise<ListSessionsDataResult>;

    /**
     * Sets the time that all sessions are revoked on the specified user.
     * @param userId The ID of the user that all sessions should be revoked for.
     * @param allSessionRevokeTimeMs The unix time that should be recorded.
     */
    setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void>;

    /**
     * Sets the ID of the login request that is allowed to be completed for the given user.
     * At any particular moment, only one login request is allowed to be completed by a user.
     * This is used to help mitigate distributed brute force attacks. (i.e. attacks that try generating a lot of login requests and guessing the codes)
     * @param userId The ID of the user.
     * @param requestId The ID of the login request.
     */
    setCurrentLoginRequest(userId: string, requestId: string): Promise<void>;
}

export type AddressType = 'email' | 'phone';

export interface AuthUser {
    id: string;
    name?: string | null;
    email: string | null;
    phoneNumber: string | null;
    avatarUrl?: string | null;
    avatarPortraitUrl?: string | null;

    /**
     * The last Unix time that all the sessions were revoked at.
     */
    allSessionRevokeTimeMs: number | null | undefined;

    /**
     * The ID of the current login request.
     * At any particular moment, only one login request is allowed to be completed by a user.
     * This is used to help mitigate distributed brute force attacks. (i.e. attacks that try generating a lot of login requests and guessing the codes)
     */
    currentLoginRequestId: string | null | undefined;
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
    completedTimeMs: number | null;

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

    /**
     * The IP Address that the request came from.
     */
    ipAddress: string;
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
    revokeTimeMs: number | null;

    /**
     * The ID of the login request that was used to obtain this session.
     */
    requestId: string | null;

    /**
     * The ID of the previous session that was used to obtain this session.
     */
    previousSessionId: string | null;

    /**
     * The IP Address that the session was granted to.
     */
    ipAddress: string;
}

export type SaveNewUserResult = SaveNewUserSuccess | SaveNewUserFailure;

export interface SaveNewUserSuccess {
    success: true;
}

export interface SaveNewUserFailure {
    success: false;
    errorCode: 'user_already_exists' | ServerError;
    errorMessage: string;
}

export type ListSessionsDataResult =
    | ListSessionsDataSuccess
    | ListSessionsDataFailure;

export interface ListSessionsDataSuccess {
    success: true;
    sessions: AuthSession[];
}

export interface ListSessionsDataFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}
