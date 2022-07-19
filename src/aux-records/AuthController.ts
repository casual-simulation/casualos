import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
} from './AuthStore';
import { ServerError } from './Errors';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import {
    hashPasswordWithSalt,
    verifyPassword,
    verifyPasswordAgainstHashes,
} from '@casual-simulation/crypto';
import { fromByteArray } from 'base64-js';
import { AuthMessenger } from './AuthMessenger';
import { fromBase64String, toBase64String } from './Utils';
import { formatV1SessionKey, parseSessionKey, randomCode } from './AuthUtils';

/**
 * The number of miliseconds that a login request should be valid for before expiration.
 */
export const LOGIN_REQUEST_LIFETIME_MS = 1000 * 60 * 5; // 5 minutes

/**
 * The number of bytes that should be used for login request IDs.
 */
export const LOGIN_REQUEST_ID_BYTE_LENGTH = 16; // 128 bit

/**
 * The number of bytes that should be used for session IDs.
 */
export const SESSION_ID_BYTE_LENGTH = 16; // 128 bit

/**
 * The number of bytes that should be used for session secrets.
 */
export const SESSION_SECRET_BYTE_LENGTH = 16; // 128 bit

/**
 * The number of miliseconds that a login session should be valid for before expiration.
 */
export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * The error message that should be used for invalid_request error messages.
 */
export const INVALID_REQUEST_ERROR_MESSAGE = 'The login request is invalid.';

/**
 * The maximum allowed number of attempts for completing a login request.
 */
export const MAX_LOGIN_REQUEST_ATTEMPTS = 5;

/**
 * The error message that should be used for invalid_key error messages.
 */
export const INVALID_KEY_ERROR_MESSAGE = 'The session key is invalid.';

/**
 * Defines a class that is able to authenticate users.
 */
export class AuthController {
    private _store: AuthStore;
    private _messenger: AuthMessenger;

    constructor(authStore: AuthStore, messenger: AuthMessenger) {
        this._store = authStore;
        this._messenger = messenger;
    }

    async requestLogin(request: LoginRequest): Promise<LoginRequestResult> {
        if (typeof request.address !== 'string' || request.address === '') {
            return {
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage:
                    'The given address is invalid. It must be a string.',
            };
        } else if (
            typeof request.addressType !== 'string' ||
            !(
                request.addressType === 'email' ||
                request.addressType === 'phone'
            )
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_address_type',
                errorMessage:
                    'The given address type is invalid. It must be a string containing either "email" or "phone".',
            };
        } else if (
            typeof request.ipAddress !== 'string' ||
            request.ipAddress === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_ip_address',
                errorMessage:
                    'The given IP address is invalid. It must be a string.',
            };
        }

        try {
            let newUser = false;
            const supported = await this._messenger.supportsAddressType(
                request.addressType
            );
            if (!supported) {
                return {
                    success: false,
                    errorCode: 'address_type_not_supported',
                    errorMessage:
                        request.addressType === 'email'
                            ? 'Email addresses are not supported.'
                            : 'Phone numbers are not supported',
                };
            }

            let user = await this._store.findUserByAddress(
                request.address,
                request.addressType
            );
            if (!user) {
                newUser = true;
                user = {
                    id: uuid(),
                    email:
                        request.addressType === 'email'
                            ? request.address
                            : null,
                    phoneNumber:
                        request.addressType === 'phone'
                            ? request.address
                            : null,
                };
            }

            const requestTime = Date.now();
            const requestId = fromByteArray(
                randomBytes(LOGIN_REQUEST_ID_BYTE_LENGTH)
            );
            const code = randomCode();

            const hash = hashPasswordWithSalt(code, requestId);

            const loginRequest: AuthLoginRequest = {
                userId: user.id,
                requestId: requestId,
                secretHash: hash,
                address: request.address,
                addressType: request.addressType,
                attemptCount: 0,
                requestTimeMs: requestTime,
                expireTimeMs: requestTime + LOGIN_REQUEST_LIFETIME_MS,
                completedTimeMs: null,
                ipAddress: request.ipAddress,
            };
            const result = await this._messenger.sendCode(
                loginRequest.address,
                loginRequest.addressType,
                code
            );

            if (result.success === true) {
                if (newUser) {
                    const result = await this._store.saveNewUser(user);
                    if (result.success === false) {
                        user = await this._store.findUserByAddress(
                            request.address,
                            request.addressType
                        );
                        if (!user) {
                            console.log(
                                '[AuthController] Could not find user even though it is supposed to already exist.'
                            );
                            return {
                                success: false,
                                errorCode: 'server_error',
                                errorMessage:
                                    'The server encountered an error.',
                            };
                        }
                        loginRequest.userId = user.id;
                    }
                }
                await this._store.saveLoginRequest(loginRequest);
                await this._store.setCurrentLoginRequest(
                    loginRequest.userId,
                    loginRequest.requestId
                );

                return {
                    success: true,
                    requestId: loginRequest.requestId,
                    userId: loginRequest.userId,
                    address: request.address,
                    addressType: request.addressType,
                    expireTimeMs: loginRequest.expireTimeMs,
                };
            } else {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                };
            }
        } catch (err) {
            console.error(
                '[AuthController] Error Occurred while Creating Login Request',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async completeLogin(
        request: CompleteLoginRequest
    ): Promise<CompleteLoginResult> {
        if (typeof request.userId !== 'string' || request.userId === '') {
            return {
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given userId is invalid. It must be a string.',
            };
        } else if (
            typeof request.requestId !== 'string' ||
            request.requestId === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_request_id',
                errorMessage:
                    'The given requestId is invalid. It must be a string.',
            };
        } else if (typeof request.code !== 'string' || request.code === '') {
            return {
                success: false,
                errorCode: 'unacceptable_code',
                errorMessage: 'The given code is invalid. It must be a string.',
            };
        } else if (
            typeof request.ipAddress !== 'string' ||
            request.ipAddress === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_ip_address',
                errorMessage:
                    'The given IP address is invalid. It must be a string.',
            };
        }

        try {
            const loginRequest = await this._store.findLoginRequest(
                request.userId,
                request.requestId
            );
            if (!loginRequest) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            let validRequest = true;
            if (Date.now() >= loginRequest.expireTimeMs) {
                validRequest = false;
            } else if (loginRequest.completedTimeMs > 0) {
                validRequest = false;
            } else if (
                loginRequest.attemptCount >= MAX_LOGIN_REQUEST_ATTEMPTS
            ) {
                validRequest = false;
            } else if (loginRequest.ipAddress !== request.ipAddress) {
                validRequest = false;
            }

            if (!validRequest) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            let validCode = false;
            try {
                if (
                    verifyPasswordAgainstHashes(
                        request.code,
                        loginRequest.requestId,
                        [loginRequest.secretHash]
                    )
                ) {
                    validCode = true;
                }
            } catch (err) {
                console.error(
                    '[AuthController] Error occurred while verifying login request code',
                    err
                );
            }

            if (!validCode) {
                await this._store.incrementLoginRequestAttemptCount(
                    loginRequest.userId,
                    loginRequest.requestId
                );
                return {
                    success: false,
                    errorCode: 'invalid_code',
                    errorMessage: 'The code is invalid.',
                };
            }

            const user = await this._store.findUser(loginRequest.userId);

            if (!user) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            if (user.currentLoginRequestId !== loginRequest.requestId) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            const sessionId = fromByteArray(
                randomBytes(SESSION_ID_BYTE_LENGTH)
            );
            const sessionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const now = Date.now();

            const session: AuthSession = {
                userId: loginRequest.userId,
                sessionId: sessionId,
                requestId: loginRequest.requestId,
                secretHash: hashPasswordWithSalt(sessionSecret, sessionId),
                grantedTimeMs: now,
                revokeTimeMs: null,
                expireTimeMs: now + SESSION_LIFETIME_MS,
                previousSessionId: null,
                ipAddress: request.ipAddress,
            };
            await this._store.markLoginRequestComplete(
                loginRequest.userId,
                loginRequest.requestId,
                now
            );
            await this._store.saveSession(session);

            return {
                success: true,
                userId: session.userId,
                sessionKey: formatV1SessionKey(
                    loginRequest.userId,
                    sessionId,
                    sessionSecret,
                    session.expireTimeMs
                ),
                expireTimeMs: session.expireTimeMs,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error occurred while completing login request',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async validateSessionKey(key: string): Promise<ValidateSessionKeyResult> {
        if (typeof key !== 'string' || key === '') {
            return {
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a correctly formatted string.',
            };
        }
        try {
            const keyValues = parseSessionKey(key);
            if (!keyValues) {
                console.log(
                    '[AuthController] [validateSessionKey] Could not parse key.'
                );
                return {
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                };
            }

            const [userId, sessionId, sessionSecret] = keyValues;
            const session = await this._store.findSession(userId, sessionId);

            if (!session) {
                console.log(
                    '[AuthController] [validateSessionKey] Could not find session.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            if (
                !verifyPasswordAgainstHashes(sessionSecret, session.sessionId, [
                    session.secretHash,
                ])
            ) {
                console.log(
                    '[AuthController] [validateSessionKey] Session secret was invalid.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const now = Date.now();
            if (session.revokeTimeMs && now >= session.revokeTimeMs) {
                console.log(
                    '[AuthController] [validateSessionKey] Session has been revoked.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            if (now >= session.expireTimeMs) {
                console.log(
                    '[AuthController] [validateSessionKey] Session has expired.'
                );
                return {
                    success: false,
                    errorCode: 'session_expired',
                    errorMessage: 'The session has expired.',
                };
            }

            const userInfo = await this._store.findUser(userId);

            if (!userInfo) {
                console.log(
                    '[AuthController] [validateSessionKey] Unable to find user!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            } else {
                if (typeof userInfo.allSessionRevokeTimeMs === 'number') {
                    if (
                        userInfo.allSessionRevokeTimeMs >= session.grantedTimeMs
                    ) {
                        return {
                            success: false,
                            errorCode: 'invalid_key',
                            errorMessage: INVALID_KEY_ERROR_MESSAGE,
                        };
                    }
                }
            }

            return {
                success: true,
                userId: session.userId,
                sessionId: session.sessionId,
                allSessionsRevokedTimeMs: userInfo.allSessionRevokeTimeMs,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while validating a session key',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async revokeSession(
        request: RevokeSessionRequest
    ): Promise<RevokeSessionResult> {
        if (typeof request.userId !== 'string' || request.userId === '') {
            return {
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given userId is invalid. It must be a string.',
            };
        } else if (
            typeof request.sessionId !== 'string' ||
            request.sessionId === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_session_id',
                errorMessage:
                    'The given sessionId is invalid. It must be a string.',
            };
        } else if (
            typeof request.sessionKey !== 'string' ||
            request.sessionKey === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a string.',
            };
        }
        try {
            const keyResult = await this.validateSessionKey(request.sessionKey);
            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const session = await this._store.findSession(
                request.userId,
                request.sessionId
            );
            if (!session) {
                return {
                    success: false,
                    errorCode: 'session_not_found',
                    errorMessage: 'The session was not found.',
                };
            }

            if (session.revokeTimeMs) {
                return {
                    success: false,
                    errorCode: 'session_already_revoked',
                    errorMessage: 'The session has already been revoked.',
                };
            }

            const newSession: AuthSession = {
                ...session,
                revokeTimeMs: Date.now(),
            };

            await this._store.saveSession(newSession);

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while revoking session',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error ocurred.',
            };
        }
    }

    /**
     * Attempts to revoke all the sessions for the specified user.
     * @param request The request.
     */
    async revokeAllSessions(
        request: RevokeAllSessionsRequest
    ): Promise<RevokeAllSessionsResult> {
        if (typeof request.userId !== 'string' || request.userId === '') {
            return {
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given userId is invalid. It must be a string.',
            };
        } else if (
            typeof request.sessionKey !== 'string' ||
            request.sessionKey === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a string.',
            };
        }

        try {
            const keyResult = await this.validateSessionKey(request.sessionKey);
            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            await this._store.setRevokeAllSessionsTimeForUser(
                request.userId,
                Date.now()
            );

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while revoking all sessions',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Lists all the sessions for a given user.
     * @param request The request.
     */
    async listSessions(
        request: ListSessionsRequest
    ): Promise<ListSessionsResult> {
        if (typeof request.userId !== 'string' || request.userId === '') {
            return {
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given userId is invalid. It must be a string.',
            };
        } else if (
            typeof request.expireTimeMs !== 'number' &&
            request.expireTimeMs !== null &&
            typeof request.expireTimeMs !== 'undefined'
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_expire_time',
                errorMessage:
                    'The given expiration time is invalid. It must be a number or null.',
            };
        } else if (
            typeof request.sessionKey !== 'string' ||
            request.sessionKey === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a string.',
            };
        }

        try {
            const keyResult = await this.validateSessionKey(request.sessionKey);
            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const result = await this._store.listSessions(
                request.userId,
                request.expireTimeMs
            );

            if (result.success === false) {
                return result;
            }

            return {
                success: true,
                sessions: result.sessions.map((s) => ({
                    userId: s.userId,
                    sessionId: s.sessionId,
                    grantedTimeMs: s.grantedTimeMs,
                    expireTimeMs: s.expireTimeMs,
                    revokeTimeMs:
                        keyResult.allSessionsRevokedTimeMs >= s.grantedTimeMs &&
                        (!s.revokeTimeMs ||
                            s.revokeTimeMs > keyResult.allSessionsRevokedTimeMs)
                            ? keyResult.allSessionsRevokedTimeMs
                            : s.revokeTimeMs,
                    currentSession: s.sessionId === keyResult.sessionId,
                    ipAddress: s.ipAddress,
                })),
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while listing sessions',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

export interface LoginRequest {
    /**
     * The address that the login is for.
     */
    address: string;

    /**
     * The type of the address.
     */
    addressType: AddressType;

    /**
     * The IP address that the login is from.
     */
    ipAddress: string;
}

export type LoginRequestResult = LoginRequestSuccess | LoginRequestFailure;

export interface LoginRequestSuccess {
    success: true;

    /**
     * The ID of the user that the request is for.
     */
    userId: string;

    /**
     * The ID of the generated login request.
     */
    requestId: string;

    /**
     * The address that the login request is for.
     */
    address: string;

    /**
     * The type of the address.
     */
    addressType: AddressType;

    /**
     * The unix timestamp in miliseconds that the login request will expire at.
     */
    expireTimeMs: number;
}

export interface LoginRequestFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode:
        | 'unacceptable_address'
        | 'unacceptable_address_type'
        | 'unacceptable_ip_address'
        | 'address_type_not_supported'
        | ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

export interface CompleteLoginRequest {
    /**
     * The ID of the user that the login request is for.
     */
    userId: string;

    /**
     * The ID of the login request.
     */
    requestId: string;

    /**
     * The code that was sent to the address.
     */
    code: string;

    /**
     * The IP address that the request is coming from.
     */
    ipAddress: string;
}

export type CompleteLoginResult = CompleteLoginSuccess | CompleteLoginFailure;

export interface CompleteLoginSuccess {
    success: true;

    /**
     * The ID of the user that the session is for.
     */
    userId: string;

    /**
     * The secret key that provides access for the session.
     */
    sessionKey: string;

    /**
     * The unix timestamp in miliseconds that the session will expire at.
     */
    expireTimeMs: number;
}

export interface CompleteLoginFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode:
        | 'unacceptable_user_id'
        | 'unacceptable_request_id'
        | 'unacceptable_code'
        | 'invalid_code'
        | 'unacceptable_ip_address'
        | 'invalid_request'
        | ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

export type ValidateSessionKeyResult =
    | ValidateSessionKeySuccess
    | ValidateSessionKeyFailure;

export interface ValidateSessionKeySuccess {
    success: true;
    userId: string;
    sessionId: string;

    allSessionsRevokedTimeMs?: number;
}

export interface ValidateSessionKeyFailure {
    success: false;
    errorCode:
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | ServerError;
    errorMessage: string;
}

export interface RevokeSessionRequest {
    /**
     * The ID of the user whose session should be revoked.
     */
    userId: string;

    /**
     * The ID of the session that should be revoked.
     */
    sessionId: string;

    /**
     * The session key that should authenticate the request.
     */
    sessionKey: string;
}

export type RevokeSessionResult = RevokeSessionSuccess | RevokeSessionFailure;

export interface RevokeSessionSuccess {
    success: true;
}

export interface RevokeSessionFailure {
    success: false;
    errorCode:
        | 'unacceptable_user_id'
        | 'unacceptable_session_id'
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | 'session_not_found'
        | 'session_already_revoked'
        | ServerError;
    errorMessage: string;
}

export interface RevokeAllSessionsRequest {
    /**
     * The ID of the user whose sessions should be revoked.
     */
    userId: string;

    /**
     * The session key that should authenticate the request.
     */
    sessionKey: string;
}

export type RevokeAllSessionsResult =
    | RevokeAllSessionsSuccess
    | RevokeAllSessionsFailure;

export interface RevokeAllSessionsSuccess {
    success: true;
}

export interface RevokeAllSessionsFailure {
    success: false;
    errorCode:
        | 'unacceptable_user_id'
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | ServerError;
    errorMessage: string;
}

export interface ListSessionsRequest {
    /**
     * The ID of the user whose sessions should be listed.
     */
    userId: string;

    /**
     * The expiration time that the listing should start after.
     */
    expireTimeMs?: number | null;

    /**
     * The key that should be used to authorize the request.
     */
    sessionKey: string;
}

export type ListSessionsResult = ListSessionsSuccess | ListSessionsFailure;

export interface ListSessionsSuccess {
    success: true;

    /**
     *
     */
    sessions: ListedSession[];
}

export interface ListSessionsFailure {
    success: false;
    errorCode:
        | 'unacceptable_user_id'
        | 'unacceptable_expire_time'
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | ServerError;
    errorMessage: string;
}

/**
 * Defines an interface for a session that has been listed.
 */
export interface ListedSession {
    /**
     * The ID of the user that this session belongs to.
     */
    userId: string;

    /**
     * The ID of the session.
     */
    sessionId: string;

    /**
     * The unix time that the session was granted at.
     */
    grantedTimeMs: number;

    /**
     * The unix time that the session will expire at.
     */
    expireTimeMs: number;

    /**
     * The unix time that the session was revoked at.
     */
    revokeTimeMs: number;

    /**
     * The IP address that the session was granted to.
     */
    ipAddress: string;

    /**
     * Whether this session represents the session key that was used to access the session list.
     */
    currentSession: boolean;
}
