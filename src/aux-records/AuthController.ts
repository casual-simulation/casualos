import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
} from './AuthStore';
import { ServerError } from '@casual-simulation/aux-common/Errors';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import {
    hashHighEntropyPasswordWithSalt,
    hashPasswordWithSalt,
    verifyPassword,
    verifyPasswordAgainstHashes,
} from '@casual-simulation/crypto';
import { fromByteArray } from 'base64-js';
import { AuthMessenger } from './AuthMessenger';
import {
    cleanupObject,
    isActiveSubscription,
    isStringValid,
    RegexRule,
} from './Utils';
import {
    formatV1ConnectionKey,
    formatV1OpenAiKey,
    formatV1SessionKey,
    parseSessionKey,
    randomCode,
    verifyConnectionToken,
} from './AuthUtils';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { ConfigurationStore } from './ConfigurationStore';
import { parseConnectionToken } from '@casual-simulation/aux-common';

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
export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14; // 2 weeks

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
 * The error message that should be used for invalid_token error messages.
 */
export const INVALID_TOKEN_ERROR_MESSAGE = 'The connection token is invalid.';

/**
 * The maximum allowed length for an email address.
 */
export const MAX_EMAIL_ADDRESS_LENGTH = 200;

/**
 * The maximum allowed length for an SMS address.
 */
export const MAX_SMS_ADDRESS_LENGTH = 30;

/**
 * The maximum allowed length for an OpenAI API key.
 */
export const MAX_OPEN_AI_API_KEY_LENGTH = 100;

/**
 * Defines a class that is able to authenticate users.
 */
export class AuthController {
    private _store: AuthStore;
    private _messenger: AuthMessenger;
    private _forceAllowSubscriptionFeatures: boolean;
    private _config: ConfigurationStore;
    // private _subscriptionConfig: SubscriptionConfiguration | null;

    constructor(
        authStore: AuthStore,
        messenger: AuthMessenger,
        configStore: ConfigurationStore,
        forceAllowSubscriptionFeatures: boolean = false
    ) {
        this._store = authStore;
        this._messenger = messenger;
        this._config = configStore;
        this._forceAllowSubscriptionFeatures = forceAllowSubscriptionFeatures;
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

        if (request.addressType === 'email') {
            if (request.address.length > MAX_EMAIL_ADDRESS_LENGTH) {
                return {
                    success: false,
                    errorCode: 'unacceptable_address',
                    errorMessage: `The given email address is too long. It must be ${MAX_EMAIL_ADDRESS_LENGTH} characters or shorter in length.`,
                };
            }
        } else if (request.addressType === 'phone') {
            if (request.address.length > MAX_SMS_ADDRESS_LENGTH) {
                return {
                    success: false,
                    errorCode: 'unacceptable_address',
                    errorMessage: `The given SMS address is too long. It must be ${MAX_SMS_ADDRESS_LENGTH} digits or shorter in length.`,
                };
            }
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
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                };

                if (
                    !(await this._validateAddress(
                        request.address,
                        request.addressType
                    ))
                ) {
                    console.log(
                        `[AuthController] [requestLogin] Login attempt rejected for new user with address (type: ${request.addressType}) that is not allowed.`
                    );
                    return {
                        success: false,
                        errorCode: 'unacceptable_address',
                        errorMessage: 'The given address is not accepted.',
                    };
                }
            }

            if (user.banTimeMs > 0) {
                return {
                    success: false,
                    errorCode: 'user_is_banned',
                    errorMessage: 'The user has been banned.',
                    banReason: user.banReason,
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

    private async _validateAddress(
        address: string,
        addressType: AddressType
    ): Promise<boolean> {
        try {
            const rules =
                addressType === 'email'
                    ? await this._store.listEmailRules()
                    : await this._store.listSmsRules();

            if (rules) {
                return isStringValid(address, rules);
            } else {
                return true;
            }
        } catch (err) {
            return false;
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
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const now = Date.now();

            const session: AuthSession = {
                userId: loginRequest.userId,
                sessionId: sessionId,
                requestId: loginRequest.requestId,
                // sessionSecret and sessionId are high-entropy (128 bits of random data)
                // so we should use a hash that is optimized for high-entropy inputs.
                secretHash: hashHighEntropyPasswordWithSalt(
                    sessionSecret,
                    sessionId
                ),
                connectionSecret: connectionSecret,
                grantedTimeMs: now,
                revokeTimeMs: null,
                expireTimeMs: now + SESSION_LIFETIME_MS,
                previousSessionId: null,
                nextSessionId: null,
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
                connectionKey: formatV1ConnectionKey(
                    loginRequest.userId,
                    sessionId,
                    connectionSecret,
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

                if (userInfo.banTimeMs > 0) {
                    return {
                        success: false,
                        errorCode: 'user_is_banned',
                        errorMessage: 'The user has been banned.',
                        banReason: userInfo.banReason,
                    };
                }
            }

            const { subscriptionId, subscriptionTier } =
                await this._getSubscriptionInfo(userInfo);

            return {
                success: true,
                userId: session.userId,
                sessionId: session.sessionId,
                allSessionsRevokedTimeMs: userInfo.allSessionRevokeTimeMs,

                subscriptionId: subscriptionId ?? undefined,
                subscriptionTier: subscriptionTier ?? undefined,
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

    async validateConnectionToken(
        token: string
    ): Promise<ValidateConnectionTokenResult> {
        if (typeof token !== 'string' || token === '') {
            return {
                success: false,
                errorCode: 'unacceptable_connection_token',
                errorMessage:
                    'The given connection token is invalid. It must be a correctly formatted string.',
            };
        }

        try {
            const tokenValues = parseConnectionToken(token);
            if (!tokenValues) {
                console.log(
                    '[AuthController] [validateConnectionToken] Could not parse token.'
                );
                return {
                    success: false,
                    errorCode: 'unacceptable_connection_token',
                    errorMessage:
                        'The given connection token is invalid. It must be a correctly formatted string.',
                };
            }

            const [userId, sessionId, connectionId, recordName, inst, hash] =
                tokenValues;
            const session = await this._store.findSession(userId, sessionId);

            if (!session) {
                console.log(
                    '[AuthController] [validateConnectionToken] Could not find session.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                };
            }

            if (!verifyConnectionToken(token, session.connectionSecret)) {
                console.log(
                    '[AuthController] [validateConnectionToken] Connection token was invalid.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                };
            }

            const now = Date.now();
            if (session.revokeTimeMs && now >= session.revokeTimeMs) {
                console.log(
                    '[AuthController] [validateConnectionToken] Session has been revoked.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                };
            }

            if (now >= session.expireTimeMs) {
                console.log(
                    '[AuthController] [validateConnectionToken] Session has expired.'
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
                    '[AuthController] [validateConnectionToken] Unable to find user!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                };
            } else {
                if (typeof userInfo.allSessionRevokeTimeMs === 'number') {
                    if (
                        userInfo.allSessionRevokeTimeMs >= session.grantedTimeMs
                    ) {
                        return {
                            success: false,
                            errorCode: 'invalid_token',
                            errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                        };
                    }
                }

                if (userInfo.banTimeMs > 0) {
                    return {
                        success: false,
                        errorCode: 'user_is_banned',
                        errorMessage: 'The user has been banned.',
                        banReason: userInfo.banReason,
                    };
                }
            }

            const { subscriptionId, subscriptionTier } =
                await this._getSubscriptionInfo(userInfo);

            return {
                success: true,
                userId: session.userId,
                sessionId: session.sessionId,
                connectionId: connectionId,
                recordName: recordName,
                inst: inst,
                allSessionsRevokedTimeMs: userInfo.allSessionRevokeTimeMs,
                subscriptionId: subscriptionId ?? undefined,
                subscriptionTier: subscriptionTier ?? undefined,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while validating a connection token',
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
     * Attempts to replace the given session key with a new key.
     * @param request The request.
     */
    async replaceSession(
        request: ReplaceSessionRequest
    ): Promise<ReplaceSessionResult> {
        if (
            typeof request.sessionKey !== 'string' ||
            request.sessionKey === ''
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given sessionKey is invalid. It must be a string.',
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
            const keyResult = await this.validateSessionKey(request.sessionKey);

            if (keyResult.success === false) {
                return keyResult;
            }

            const userId = keyResult.userId;
            const now = Date.now();

            const newSessionId = fromByteArray(
                randomBytes(SESSION_ID_BYTE_LENGTH)
            );
            const newSessionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const newConnectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );

            const newSession: AuthSession = {
                userId: userId,
                sessionId: newSessionId,
                requestId: null,
                secretHash: hashPasswordWithSalt(
                    newSessionSecret,
                    newSessionId
                ),
                connectionSecret: newConnectionSecret,
                grantedTimeMs: now,
                revokeTimeMs: null,
                expireTimeMs: now + SESSION_LIFETIME_MS,
                previousSessionId: keyResult.sessionId,
                nextSessionId: null,
                ipAddress: request.ipAddress,
            };

            const session = await this._store.findSession(
                userId,
                keyResult.sessionId
            );

            if (!session) {
                console.log(
                    '[AuthController] [replaceSession] Could not find session.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            await this._store.replaceSession(session, newSession, now);

            return {
                success: true,
                userId: userId,
                sessionKey: formatV1SessionKey(
                    userId,
                    newSessionId,
                    newSessionSecret,
                    newSession.expireTimeMs
                ),
                connectionKey: formatV1ConnectionKey(
                    userId,
                    newSessionId,
                    newConnectionSecret,
                    newSession.expireTimeMs
                ),
                expireTimeMs: newSession.expireTimeMs,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while replacing session',
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
                    nextSessionId: s.nextSessionId,
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

    /**
     * Gets the information for a specific user.
     * @param request The request.
     */
    async getUserInfo(request: GetUserInfoRequest): Promise<GetUserInfoResult> {
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
                console.log(
                    '[AuthController] [getUserInfo] Request User ID doesnt match session key User ID!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const result = await this._store.findUser(request.userId);

            if (!result) {
                throw new Error(
                    'Unable to find user even though a valid session key was presented!'
                );
            }

            const { hasActiveSubscription, subscriptionTier: tier } =
                await this._getSubscriptionInfo(result);

            return {
                success: true,
                userId: result.id,
                name: result.name,
                email: result.email,
                phoneNumber: result.phoneNumber,
                avatarPortraitUrl: result.avatarPortraitUrl,
                avatarUrl: result.avatarUrl,
                hasActiveSubscription: hasActiveSubscription,
                subscriptionTier: hasActiveSubscription ? tier : null,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while getting user info',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private async _getSubscriptionInfo(user: AuthUser) {
        const hasActiveSubscription =
            this._forceAllowSubscriptionFeatures ||
            isActiveSubscription(user.subscriptionStatus);

        let tier: string = null;
        let sub: SubscriptionConfiguration['subscriptions'][0] = null;
        if (hasActiveSubscription) {
            const subscriptionConfig =
                await this._config.getSubscriptionConfiguration();
            if (user.subscriptionId) {
                sub = subscriptionConfig?.subscriptions.find(
                    (s) => s.id === user.subscriptionId
                );
            }
            if (!sub) {
                sub = subscriptionConfig?.subscriptions.find(
                    (s) => s.defaultSubscription
                );
                if (sub) {
                    console.log(
                        '[AuthController] [getUserInfo] Using default subscription for user.'
                    );
                }
            }

            if (!sub) {
                sub = subscriptionConfig?.subscriptions[0];
                if (sub) {
                    console.log(
                        '[AuthController] [getUserInfo] Using first subscription for user.'
                    );
                }
            }

            tier = 'beta';
            if (sub && sub.tier) {
                tier = sub.tier;
            }
        }

        return {
            hasActiveSubscription,
            subscriptionId: sub?.id,
            subscriptionTier: tier,
        };
    }

    /**
     * Attempts to update a user's metadata.
     * @param request The request for the operation.
     */
    async updateUserInfo(
        request: UpdateUserInfoRequest
    ): Promise<UpdateUserInfoResult> {
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
        } else if (
            typeof request.update !== 'object' ||
            request.update === null ||
            Array.isArray(request.update)
        ) {
            return {
                success: false,
                errorCode: 'unacceptable_update',
                errorMessage:
                    'The given update is invalid. It must be an object.',
            };
        }

        try {
            const keyResult = await this.validateSessionKey(request.sessionKey);
            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                console.log(
                    '[AuthController] [updateUserInfo] Request User ID doesnt match session key User ID!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const user = await this._store.findUser(request.userId);

            if (!user) {
                throw new Error(
                    'Unable to find user even though a valid session key was presented!'
                );
            }

            const cleaned = cleanupObject({
                name: request.update.name,
                avatarUrl: request.update.avatarUrl,
                avatarPortraitUrl: request.update.avatarPortraitUrl,
                email: request.update.email,
                phoneNumber: request.update.phoneNumber,
            });

            await this._store.saveUser({
                ...user,
                ...cleaned,
            });

            return {
                success: true,
                userId: user.id,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while getting user info',
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
     * Lists the email rules that should be used.
     */
    async listEmailRules(): Promise<ListEmailRulesResult> {
        try {
            const rules = await this._store.listEmailRules();

            return {
                success: true,
                rules,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while listing email rules',
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
     * Lists the SMS rules that should be used.
     */
    async listSmsRules(): Promise<ListSmsRulesResult> {
        try {
            const rules = await this._store.listSmsRules();

            return {
                success: true,
                rules,
            };
        } catch (err) {
            console.error(
                '[AuthController] Error ocurred while listing email rules',
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
        | 'user_is_banned'
        | ServerError;

    /**
     * The error message for the failure.
     */
    errorMessage: string;

    /**
     * The ban reason for the user.
     */
    banReason?: AuthUser['banReason'];
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
     * The connection key that provides websocket access for the session.
     */
    connectionKey: string;

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

    /**
     * The subscription ID for the user.
     */
    subscriptionTier?: string;

    /**
     * The ID of the subscription that the user is subscribed to.
     */
    subscriptionId?: string;
}

export interface ValidateSessionKeyFailure {
    success: false;
    errorCode:
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | 'user_is_banned'
        | ServerError;
    errorMessage: string;

    banReason?: AuthUser['banReason'];
}

export type ValidateConnectionTokenResult =
    | ValidateConnectionTokenSuccess
    | ValidateConnectionTokenFailure;

export interface ValidateConnectionTokenSuccess {
    success: true;
    /**
     * The ID of the user that owns the connection token.
     */
    userId: string;

    /**
     * The ID of the session that the connection token is for.
     */
    sessionId: string;

    /**
     * The ID that the client wants for the connection.
     */
    connectionId: string;

    /**
     * The name of the record that the connection token was generated for.
     */
    recordName: string;

    /**
     * The instance that the connection token was generated for.
     */
    inst: string;

    allSessionsRevokedTimeMs?: number;

    /**
     * The subscription ID for the user.
     */
    subscriptionTier?: string;

    /**
     * The ID of the subscription that the user is subscribed to.
     */
    subscriptionId?: string;
}

export interface ValidateConnectionTokenFailure {
    success: false;
    errorCode:
        | 'unacceptable_connection_token'
        | 'invalid_token'
        | 'session_expired'
        | 'user_is_banned'
        | ServerError;
    errorMessage: string;

    banReason?: AuthUser['banReason'];
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
        | 'user_is_banned'
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
        | 'user_is_banned'
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
     *The list of sessions.
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
        | 'user_is_banned'
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

    /**
     * The ID of the session that replaced this session.
     */
    nextSessionId: string;
}

export interface ReplaceSessionRequest {
    /**
     * The session key that should be replaced.
     */
    sessionKey: string;

    /**
     * The IP Address that is making this request.
     */
    ipAddress: string;
}

export type ReplaceSessionResult =
    | ReplaceSessionSuccess
    | ReplaceSessionFailure;

export interface ReplaceSessionSuccess {
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
     * The connection key that provides websocket access for the session.
     */
    connectionKey: string;

    /**
     * The unix timestamp in miliseconds that the session will expire at.
     */
    expireTimeMs: number;
}

export interface ReplaceSessionFailure {
    success: false;
    errorCode:
        | 'unacceptable_session_key'
        | 'unacceptable_ip_address'
        | ValidateSessionKeyFailure['errorCode']
        | ServerError;
    errorMessage: string;
}

/**
 * Defines an interface for requests to get a user's info.
 */
export interface GetUserInfoRequest {
    /**
     * The session key that should be used to authenticate the request.
     */
    sessionKey: string;

    /**
     * The ID of the user whose info should be retrieved.
     */
    userId: string;
}

export type GetUserInfoResult = GetUserInfoSuccess | GetUserInfoFailure;

export interface GetUserInfoSuccess {
    success: true;
    /**
     * The ID of the user that was retrieved.
     */
    userId: string;

    /**
     * The name of the user.
     */
    name: string;

    /**
     * The URL of the avatar for the user.
     */
    avatarUrl: string;

    /**
     * The URL of the avatar portrait for the user.
     */
    avatarPortraitUrl: string;

    /**
     * The email address of the user.
     */
    email: string;

    /**
     * The phone number of the user.
     */
    phoneNumber: string;

    /**
     * Whether the user has an active subscription.
     */
    hasActiveSubscription: boolean;

    /**
     * The subscription tier that the user is subscribed to.
     */
    subscriptionTier: string;
}

export interface GetUserInfoFailure {
    success: false;
    errorCode:
        | 'unacceptable_user_id'
        | ValidateSessionKeyFailure['errorCode']
        | ServerError;
    errorMessage: string;
}

/**
 * Defines an interface for a request to update user info.
 */
export interface UpdateUserInfoRequest {
    /**
     * The session key that should be used to authenticate the request.
     */
    sessionKey: string;

    /**
     * The ID of the user whose info should be updated.
     */
    userId: string;

    /**
     * The new info for the user.
     */
    update: Partial<
        Pick<
            AuthUser,
            'name' | 'email' | 'phoneNumber' | 'avatarUrl' | 'avatarPortraitUrl'
        >
    >;
}

export type UpdateUserInfoResult =
    | UpdateUserInfoSuccess
    | UpdateUserInfoFailure;

export interface UpdateUserInfoSuccess {
    success: true;
    /**
     * The ID of the user that was retrieved.
     */
    userId: string;
}

export interface UpdateUserInfoFailure {
    success: false;
    errorCode:
        | 'unacceptable_user_id'
        | 'unacceptable_update'
        | ValidateSessionKeyFailure['errorCode']
        | ServerError;
    errorMessage: string;
}

export type ListEmailRulesResult =
    | ListEmailRulesSuccess
    | ListEmailRulesFailure;

export interface ListEmailRulesSuccess {
    success: true;
    rules: RegexRule[];
}

export interface ListEmailRulesFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type ListSmsRulesResult = ListSmsRulesSuccess | ListSmsRulesFailure;

export interface ListSmsRulesSuccess {
    success: true;
    rules: RegexRule[];
}

export interface ListSmsRulesFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}
