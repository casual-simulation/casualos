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

/**
 * The number of miliseconds that a login request should be valid for before expiration.
 */
export const LOGIN_REQUEST_LIFETIME_MS = 1000 * 60 * 5; // 5 minutes

/**
 * The number of bytes that should be used for login request IDs.
 */
export const LOGIN_REQUEST_ID_BYTE_LENGTH = 16; // 128 bit

/**
 * The number of bytes that should be used for login request codes.
 */
export const LOGIN_REQUEST_CODE_BYTE_LENGTH = 2; // 16 bit

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
            const code = fromByteArray(
                randomBytes(LOGIN_REQUEST_CODE_BYTE_LENGTH)
            );

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
                    sessionSecret
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
    errorCode: 'invalid_address' | 'address_type_not_supported' | ServerError;

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
    errorCode: 'invalid_code' | 'invalid_request' | ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

/**
 * Formats the given user ID, session ID, and session secret into a key that is used to authenticate a user to a particular session.
 * @param userId The ID of the user.
 * @param sessionId The ID of the session.
 * @param sessionSecret The secret for the session.
 */
export function formatV1SessionKey(
    userId: string,
    sessionId: string,
    sessionSecret: string
): string {
    return `vSK1.${toBase64String(userId)}.${toBase64String(
        sessionId
    )}.${toBase64String(sessionSecret)}`;
}

/**
 * Parses the given session token into a user ID and session ID, and session secret array.
 * Returns null if the key cannot be parsed.
 * @param key The key to parse.
 */
export function parseSessionKey(
    key: string | null
): [userId: string, sessionId: string, sessionSecret: string] {
    return parseV1SessionKey(key);
}

/**
 * Parses a version 2 record key into a name, password, and policy trio.
 * Returns null if the key cannot be parsed or if it is not a V2 key.
 * @param key The key to parse.
 */
export function parseV1SessionKey(
    key: string
): [userId: string, sessionId: string, sessionSecret: string] {
    if (!key) {
        return null;
    }

    if (!key.startsWith('vSK1.')) {
        return null;
    }

    const withoutVersion = key.slice('vSK1.'.length);
    let periodAfterUserId = withoutVersion.indexOf('.');
    if (periodAfterUserId < 0) {
        return null;
    }

    const userIdBase64 = withoutVersion.slice(0, periodAfterUserId);
    const sessionIdPlusPassword = withoutVersion.slice(periodAfterUserId + 1);

    if (userIdBase64.length <= 0 || sessionIdPlusPassword.length <= 0) {
        return null;
    }

    const periodAfterSessionId = sessionIdPlusPassword.indexOf('.');
    if (periodAfterSessionId < 0) {
        return null;
    }

    const sessionIdBase64 = sessionIdPlusPassword.slice(
        0,
        periodAfterSessionId
    );
    const passwordBase64 = sessionIdPlusPassword.slice(
        periodAfterSessionId + 1
    );

    if (sessionIdBase64.length <= 0 || passwordBase64.length <= 0) {
        return null;
    }

    try {
        const userId = fromBase64String(userIdBase64);
        const sessionId = fromBase64String(sessionIdBase64);
        const password = fromBase64String(passwordBase64);

        return [userId, sessionId, password];
    } catch (err) {
        return null;
    }
}
