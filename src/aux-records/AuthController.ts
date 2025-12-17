/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    AddressType,
    AuthListedUserAuthenticator,
    AuthLoginRequest,
    AuthOpenIDLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    AuthUserAuthenticator,
    SaveNewUserFailure,
    UserLoginMetadata,
} from './AuthStore';
import type {
    NotAuthorizedError,
    NotLoggedInError,
    NotSupportedError,
    ServerError,
} from '@casual-simulation/aux-common/Errors';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import {
    hashHighEntropyPasswordWithSalt,
    hashLowEntropyPasswordWithSalt,
    verifyPasswordAgainstHashes,
} from './InstrumentedHashHelpers';
import { fromByteArray } from 'base64-js';
import type { AuthMessenger } from './AuthMessenger';
import type { RegexRule } from './Utils';
import { cleanupObject, isActiveSubscription, isStringValid } from './Utils';
import { randomCode } from './CryptoUtils';
import type { ContractFeaturesConfiguration } from './SubscriptionConfiguration';
import {
    getContractFeatures,
    getSubscription,
    type SubscriptionConfiguration,
} from './SubscriptionConfiguration';
import type { ConfigurationStore } from './ConfigurationStore';
import type {
    PrivacyFeatures,
    PublicUserInfo,
    UserRole,
} from '@casual-simulation/aux-common';
import {
    parseConnectionToken,
    formatV1ConnectionKey,
    formatV1SessionKey,
    isSuperUserRole,
    parseSessionKey,
    verifyConnectionToken,
} from '@casual-simulation/aux-common';
import type {
    PrivoClientInterface,
    PrivoFeatureStatus,
    PrivoPermission,
    ResendConsentRequestFailure,
} from './PrivoClient';
import { DateTime } from 'luxon';
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { ZodIssue } from 'zod';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    RegistrationResponseJSON,
    PublicKeyCredentialRequestOptionsJSON,
    AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
    base64URLStringToBuffer,
    bufferToBase64URLString,
} from './Base64UrlUtils';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { SEMATTRS_ENDUSER_ID } from '@opentelemetry/semantic-conventions';
import type {
    StripeAccountStatus,
    StripeRequirementsStatus,
} from './StripeInterface';
import type { RecordsStore } from './RecordsStore';

const TRACE_NAME = 'AuthController';

/**
 * The number of miliseconds that a login request should be valid for before expiration.
 */
export const LOGIN_REQUEST_LIFETIME_MS = 1000 * 60 * 5; // 5 minutes

/**
 * The number of miliseconds that an Open ID login request should be valid for before expiration.
 */
export const OPEN_ID_LOGIN_REQUEST_LIFETIME_MS = 1000 * 60 * 20; // 20 minutes

/**
 * The number of miliseconds that a WebAuthN request should be valid for before expiration.
 */
export const WEB_AUTHN_LOGIN_REQUEST_LIFETIME_MS = 1000 * 60 * 5; // 5 minutes

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
 * The error message that should be used for invalid_request error messages.
 */
export const INVALID_AUTHORIZATION_REQUEST_ERROR_MESSAGE =
    'The authorization request is invalid.';

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
 * The name of the Privo Open ID provider.
 */
export const PRIVO_OPEN_ID_PROVIDER = 'privo';

export interface RelyingParty {
    /**
     * The human readable name of the relying party.
     */
    name: string;

    /**
     * The domain of the relying party.
     */
    id: string;

    /**
     * The HTTP origin that the relying party is hosted on.
     */
    origin: string;
}

/**
 * Defines a class that is able to authenticate users.
 */
export class AuthController {
    private _store: AuthStore;
    private _records: RecordsStore;
    private _messenger: AuthMessenger;
    private _config: ConfigurationStore;
    private _privoClient: PrivoClientInterface = null;
    private _webAuthNRelyingParties: RelyingParty[];
    private _privoEnabled: boolean;

    get relyingParties() {
        return this._webAuthNRelyingParties;
    }

    set relyingParties(value: RelyingParty[]) {
        this._webAuthNRelyingParties = value;
    }

    constructor(
        authStore: AuthStore,
        messenger: AuthMessenger,
        configStore: ConfigurationStore,
        recordsStore: RecordsStore,
        privoClient: PrivoClientInterface = null,
        relyingParties: RelyingParty[] = []
    ) {
        this._store = authStore;
        this._messenger = messenger;
        this._config = configStore;
        this._records = recordsStore;
        this._privoClient = privoClient;
        this._webAuthNRelyingParties = relyingParties;
        this._privoEnabled = this._privoClient !== null;
    }

    /**
     * Gets whether Privo-features are enabled.
     */
    get privoEnabled() {
        return this._privoEnabled;
    }

    /**
     * Sets whether Privo-features are enabled.
     */
    set privoEnabled(value: boolean) {
        this._privoEnabled = value;
    }

    /**
     * Gets the privo client interface.
     */
    get privoClient(): PrivoClientInterface {
        return this._privoClient;
    }

    /**
     * Sets the privo client interface.
     */
    set privoClient(value: PrivoClientInterface) {
        this._privoClient = value;
    }

    @traced(TRACE_NAME)
    async createAccount(
        request: CreateAccountRequest
    ): Promise<CreateAccountResult> {
        try {
            const createSession = request.createSession ?? true;
            if (!isSuperUserRole(request.userRole)) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                };
            }

            const newUser: AuthUser = {
                id: uuid(),
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            };

            const result = await this._store.saveNewUser(newUser);
            if (result.success === false) {
                return result;
            }

            if (createSession) {
                const { info } = await this._issueSession({
                    userId: newUser.id,
                    lifetimeMs: null,
                    ipAddress: request.ipAddress,
                    revocable: false,
                });

                return {
                    success: true,
                    ...info,
                };
            } else {
                return {
                    success: true,
                    userId: newUser.id,
                    sessionKey: null,
                    connectionKey: null,
                    expireTimeMs: null,
                    metadata: {
                        hasUserAuthenticator: false,
                        userAuthenticatorCredentialIds: [],
                        hasPushSubscription: false,
                        pushSubscriptionIds: [],
                    },
                };
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error occurred while creating account',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async issueSession(
        request: IssueSessionRequest
    ): Promise<IssueSessionResult> {
        try {
            if (request.requestingUserRole !== 'system') {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                };
            }

            const lifetimeMs =
                request.lifetimeMs === undefined
                    ? SESSION_LIFETIME_MS
                    : request.lifetimeMs;

            const { info } = await this._issueSession({
                userId: request.userId,
                lifetimeMs,
                ipAddress: request.ipAddress,
            });

            return {
                success: true,
                ...info,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error occurred while issuing session',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    private _hashHighEntropyPasswordWithSalt(
        sessionSecret: string,
        sessionId: string
    ): string {
        return hashHighEntropyPasswordWithSalt(sessionSecret, sessionId);
    }

    @traced(TRACE_NAME)
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

        if (request.loginStudioId && request.comId) {
            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'Cannot specify both loginStudioId and comId.',
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

            let loginStudioId = request.loginStudioId;

            if (request.comId) {
                const studio = await this._records.getStudioByComId(
                    request.comId
                );

                if (!studio) {
                    return {
                        success: false,
                        errorCode: 'not_found',
                        errorMessage: 'The specified comID was not found.',
                    };
                }

                console.log(
                    `[AuthController] [requestLogin] Logging into studio (${studio.id}) for comID: ${request.comId}.`
                );
                loginStudioId = studio.id;
            } else if (request.hostname) {
                const customDomain =
                    await this._records.getVerifiedCustomDomainByName(
                        request.hostname
                    );

                if (customDomain) {
                    console.log(
                        `[AuthController] [requestLogin] Logging into studio (${customDomain.studioId}) for custom domain: ${request.hostname}.`
                    );
                    loginStudioId = customDomain.studioId;
                }
            }

            let user = await this._store.findUserByAddress(
                request.address,
                request.addressType,
                loginStudioId
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
                    loginStudioId: loginStudioId,
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

            const hash = hashLowEntropyPasswordWithSalt(code, requestId);
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
                            request.addressType,
                            loginStudioId
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
            console.error(
                `[AuthController] Error occurred while validating address`,
                err
            );
            return false;
        }
    }

    @traced(TRACE_NAME)
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
                    this.verifyPasswordAgainstHashes(
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

            const { info } = await this._issueSession({
                userId: loginRequest.userId,
                lifetimeMs: SESSION_LIFETIME_MS,
                requestId: loginRequest.requestId,
                ipAddress: request.ipAddress,
            });

            return {
                success: true,
                ...info,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
    async requestOpenIDLogin(
        request: OpenIDLoginRequest
    ): Promise<OpenIDLoginRequestResult> {
        try {
            if (request.provider !== PRIVO_OPEN_ID_PROVIDER) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'The given provider is not supported.',
                };
            }

            if (!this._privoClient) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const config = await this._config.getPrivoConfiguration();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const requestId = uuid();
            const state = uuid();
            const result = await this._privoClient.generateAuthorizationUrl(
                state
            );

            const loginRequest: AuthOpenIDLoginRequest = {
                requestId: requestId,
                state: state,
                provider: PRIVO_OPEN_ID_PROVIDER,
                codeMethod: result.codeMethod,
                codeVerifier: result.codeVerifier,
                authorizationUrl: result.authorizationUrl,
                redirectUrl: result.redirectUrl,
                completedTimeMs: null,
                ipAddress: request.ipAddress,
                scope: result.scope,
                requestTimeMs: Date.now(),
                expireTimeMs: Date.now() + OPEN_ID_LOGIN_REQUEST_LIFETIME_MS,
            };

            await this._store.saveOpenIDLoginRequest(loginRequest);

            return {
                success: true,
                authorizationUrl: result.authorizationUrl,
                requestId: requestId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error occurred while requesting Privo login',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async processOpenIDAuthorizationCode(
        request: ProcessOpenIDAuthorizationCodeRequest
    ): Promise<ProcessOpenIDAuthorizationCodeResult> {
        try {
            if (!this._privoClient) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const config = await this._config.getPrivoConfiguration();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const state = request.state;
            const loginRequest =
                await this._store.findOpenIDLoginRequestByState(state);

            if (!loginRequest) {
                console.log('[AuthController] Could not find login request.');
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_AUTHORIZATION_REQUEST_ERROR_MESSAGE,
                };
            }

            let validRequest = true;
            if (Date.now() >= loginRequest.expireTimeMs) {
                validRequest = false;
            } else if (loginRequest.completedTimeMs > 0) {
                validRequest = false;
            } else if (loginRequest.authorizationTimeMs > 0) {
                validRequest = false;
            } else if (loginRequest.ipAddress !== request.ipAddress) {
                validRequest = false;
            }

            if (!validRequest) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_AUTHORIZATION_REQUEST_ERROR_MESSAGE,
                };
            }

            if (loginRequest.provider !== PRIVO_OPEN_ID_PROVIDER) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_AUTHORIZATION_REQUEST_ERROR_MESSAGE,
                };
            }

            await this._store.saveOpenIDLoginRequestAuthorizationCode(
                loginRequest.requestId,
                request.authorizationCode,
                Date.now()
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error occurred while processing Privo authorization code',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async completeOpenIDLogin(
        request: CompleteOpenIDLoginRequest
    ): Promise<CompleteOpenIDLoginResult> {
        try {
            if (!this._privoClient) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const config = await this._config.getPrivoConfiguration();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const requestId = request.requestId;
            const loginRequest = await this._store.findOpenIDLoginRequest(
                requestId
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

            if (loginRequest.provider !== PRIVO_OPEN_ID_PROVIDER) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            if (
                !loginRequest.authorizationTimeMs ||
                !loginRequest.authorizationCode
            ) {
                return {
                    success: false,
                    errorCode: 'not_completed',
                    errorMessage: 'The login request has not been completed.',
                };
            }

            const result = await this._privoClient.processAuthorizationCallback(
                {
                    code: loginRequest.authorizationCode,
                    state: loginRequest.state,
                    codeVerifier: loginRequest.codeVerifier,
                    redirectUrl: loginRequest.redirectUrl,
                }
            );

            const serviceId = result.userInfo.serviceId;
            const email = result.userInfo.email;

            if (
                result.userInfo.roleIdentifier !== config.roleIds.adult &&
                result.userInfo.roleIdentifier !== config.roleIds.child
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        "The login request is invalid. You attempted to sign into an account that is associated with a parent email address. This is not allowed because we don't ask consent for parent accounts, but all accounts must have consent. Please sign up with a new account instead.",
                };
            }

            let user: AuthUser;
            if (serviceId) {
                user = await this._store.findUserByPrivoServiceId(
                    result.userInfo.serviceId
                );
            }

            if (!user && email) {
                user = await this._store.findUserByAddress(email, 'email');
            }

            if (!user) {
                console.log(
                    '[AuthController] [completeOpenIDLogin] Could not find user.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            if (!user.privoServiceId) {
                console.log(
                    `[AuthController] [completeOpenIDLogin] Updating user service ID.`
                );
                user = {
                    ...user,
                    privoServiceId: serviceId,
                };
                await this._store.saveUser({
                    ...user,
                });
            } else if (user.privoServiceId !== serviceId) {
                console.log(
                    `[AuthController] [completeOpenIDLogin] User's service ID (${user.privoServiceId}) doesnt match the one returned by Privo (${serviceId}).`
                );
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            const privacyFeatures = getPrivacyFeaturesFromPermissions(
                config.featureIds,
                result.userInfo.permissions
            );

            if (
                user.privacyFeatures?.publishData !==
                    privacyFeatures.publishData ||
                user.privacyFeatures?.allowPublicData !==
                    privacyFeatures.allowPublicData ||
                user.privacyFeatures?.allowAI !== privacyFeatures.allowAI ||
                user.privacyFeatures?.allowPublicInsts !==
                    privacyFeatures.allowPublicInsts
            ) {
                console.log(
                    `[AuthController] [completeOpenIDLogin] Updating user privacy features.`
                );

                user = {
                    ...user,
                    privacyFeatures,
                };
                await this._store.saveUser({
                    ...user,
                });
            }

            const now = Date.now();
            const expiry = now + result.expiresIn * 1000;

            const { info } = await this._issueSession({
                userId: user.id,
                lifetimeMs: SESSION_LIFETIME_MS,
                oidRequestId: loginRequest.requestId,
                oidAccessToken: result.accessToken,
                oidRefreshToken: result.refreshToken,
                oidIdToken: result.idToken,
                oidScope: loginRequest.scope,
                oidTokenType: result.tokenType,
                oidExpiresAtMs: expiry,
                oidProvider: loginRequest.provider,
                ipAddress: request.ipAddress,
            });

            return {
                success: true,
                ...info,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error occurred while completing Privo login',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async requestPrivoSignUp(
        request: PrivoSignUpRequest
    ): Promise<PrivoSignUpRequestResult> {
        try {
            if (!this._privoClient) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const config = await this._config.getPrivoConfiguration();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const lowercaseName = request.name.trim().toLowerCase();
            const lowercaseDisplayName = request.displayName
                .trim()
                .toLowerCase();

            if (lowercaseDisplayName.includes(lowercaseName)) {
                return {
                    success: false,
                    errorCode: 'invalid_display_name',
                    errorMessage: 'The display name cannot contain your name.',
                };
            }

            if (
                request.email &&
                request.parentEmail &&
                request.parentEmail.localeCompare(request.email, undefined, {
                    sensitivity: 'base',
                }) === 0
            ) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The parent email must be different from the child email.',
                };
            }

            const now = new Date(Date.now());
            const years = Math.floor(
                -DateTime.fromJSDate(request.dateOfBirth)
                    .diff(DateTime.fromJSDate(now), 'years')
                    .as('years')
            );
            let updatePasswordUrl: string;
            let serviceId: string;
            let parentServiceId: string;
            let consentUrl: string;
            if (years < 0) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given date of birth cannot be in the future.',
                };
            }

            let privacyFeatures: PrivacyFeatures;
            if (years < config.ageOfConsent) {
                if (!request.parentEmail) {
                    return {
                        success: false,
                        errorCode: 'parent_email_required',
                        errorMessage:
                            'A parent email is required to sign up a child.',
                    };
                }

                const result = await this._privoClient.createChildAccount({
                    childFirstName: request.name,
                    childDateOfBirth: request.dateOfBirth,
                    childEmail: request.email,
                    childDisplayName: request.displayName,
                    parentEmail: request.parentEmail,
                    featureIds: [
                        config.featureIds.childPrivoSSO,
                        config.featureIds.joinAndCollaborate,
                        config.featureIds.projectDevelopment,
                        config.featureIds.publishProjects,
                        config.featureIds.buildAIEggs,
                    ],
                });

                if (result.success === false) {
                    return result;
                }

                serviceId = result.childServiceId;
                parentServiceId = result.parentServiceId;
                updatePasswordUrl = result.updatePasswordLink;
                consentUrl = result.consentUrl;
                privacyFeatures = getPrivacyFeaturesFromPermissions(
                    config.featureIds,
                    result.features
                );
            } else {
                if (!request.email) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'An email is required to sign up an adult.',
                    };
                }

                const result = await this._privoClient.createAdultAccount({
                    adultFirstName: request.name,
                    adultEmail: request.email,
                    adultDateOfBirth: request.dateOfBirth,
                    adultDisplayName: request.displayName,
                    featureIds: [
                        config.featureIds.adultPrivoSSO,
                        config.featureIds.joinAndCollaborate,
                        config.featureIds.projectDevelopment,
                        config.featureIds.publishProjects,
                        config.featureIds.buildAIEggs,
                    ],
                });

                if (result.success === false) {
                    return result;
                }

                serviceId = result.adultServiceId;
                updatePasswordUrl = result.updatePasswordLink;
                consentUrl = result.consentUrl;
                privacyFeatures = getPrivacyFeaturesFromPermissions(
                    config.featureIds,
                    result.features
                );
            }

            const user: AuthUser = {
                id: uuid(),
                email: null, // We don't store the email because it is stored in Privo.
                phoneNumber: null,
                name: null, // We don't store the name because it is stored in Privo.
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                privoServiceId: serviceId,
                privoParentServiceId: parentServiceId,
                privoConsentUrl: consentUrl,
                privacyFeatures,
            };

            // TODO: Add user to DB
            const saveUserResult = await this._store.saveNewUser(user);

            if (saveUserResult.success === false) {
                console.error(
                    '[AuthController] Error saving new user',
                    saveUserResult
                );
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                };
            }

            const userId = user.id;

            const { info } = await this._issueSession({
                userId,
                lifetimeMs: SESSION_LIFETIME_MS,
                ipAddress: request.ipAddress,
            });

            return {
                success: true,
                ...info,
                updatePasswordUrl,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while requesting Privo sign up`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async requestWebAuthnRegistration(
        request: RequestWebAuthnRegistration
    ): Promise<RequestWebAuthnRegistrationResult> {
        try {
            if (this._webAuthNRelyingParties.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'WebAuthn is not supported on this server.',
                };
            }

            const relyingParty = findRelyingPartyForOrigin(
                this._webAuthNRelyingParties,
                request.originOrHost
            );

            if (!relyingParty) {
                return {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                };
            }

            const user = await this._store.findUser(request.userId);
            if (!user) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You need to be logged in for the operation to work.',
                };
            }

            const authenticators = await this._store.listUserAuthenticators(
                user.id
            );
            const options = await generateRegistrationOptions({
                rpName: relyingParty.name,
                rpID: relyingParty.id,
                userID: user.id,
                userName: user.email ?? user.phoneNumber,
                attestationType: 'none',
                excludeCredentials: authenticators.map((auth) => ({
                    id: base64URLStringToBuffer(auth.credentialId),
                    type: 'public-key',
                    transports: auth.transports,
                })),
                authenticatorSelection: {
                    residentKey: 'preferred',
                    userVerification: 'preferred',
                    authenticatorAttachment: 'platform',
                },
            });

            await this._store.setCurrentWebAuthnChallenge(
                user.id,
                options.challenge
            );

            return {
                success: true,
                options,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while requesting WebAuthn registration options`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async completeWebAuthnRegistration(
        request: CompleteWebAuthnRegistrationRequest
    ): Promise<CompleteWebAuthnRegistrationResult> {
        try {
            if (this._webAuthNRelyingParties.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'WebAuthn is not supported on this server.',
                };
            }

            const relyingParty = findRelyingPartyForOrigin(
                this._webAuthNRelyingParties,
                request.originOrHost
            );

            if (!relyingParty) {
                return {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                };
            }

            const user = await this._store.findUser(request.userId);

            if (!user) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You need to be logged in for the operation to work.',
                };
            }

            const currentChallenge = user.currentWebAuthnChallenge;

            try {
                const verification = await verifyRegistrationResponse({
                    response: request.response,
                    expectedChallenge: currentChallenge,
                    expectedOrigin: relyingParty.origin,
                    expectedRPID: relyingParty.id,
                });

                if (verification.verified) {
                    const registration = verification.registrationInfo;
                    const credentialId = bufferToBase64URLString(
                        registration.credentialID
                    );
                    const authenticator: AuthUserAuthenticator = {
                        id: uuid(),
                        userId: user.id,
                        credentialId,
                        credentialPublicKey: registration.credentialPublicKey,
                        counter: registration.counter,
                        credentialBackedUp: registration.credentialBackedUp,
                        credentialDeviceType: registration.credentialDeviceType,
                        transports: request.response.response.transports,
                        aaguid: verification.registrationInfo.aaguid,
                        registeringUserAgent: request.userAgent,
                        createdAtMs: Date.now(),
                    };

                    await this._store.setCurrentWebAuthnChallenge(
                        user.id,
                        null
                    );
                    await this._store.saveUserAuthenticator(authenticator);

                    return {
                        success: true,
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'The registration response was not authorized.',
                    };
                }
            } catch (err) {
                console.error(
                    `[AuthController] Error occurred while verifying WebAuthn registration response`,
                    err
                );
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage: err.message,
                };
            }
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while completing WebAuthn registration`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async requestWebAuthnLogin(
        request: RequestWebAuthnLogin
    ): Promise<RequestWebAuthnLoginResult> {
        try {
            if (this._webAuthNRelyingParties.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'WebAuthn is not supported on this server.',
                };
            }

            const relyingParty = findRelyingPartyForOrigin(
                this._webAuthNRelyingParties,
                request.originOrHost
            );

            if (!relyingParty) {
                return {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                };
            }

            const options = await generateAuthenticationOptions({
                rpID: relyingParty.id,
                userVerification: 'preferred',
            });

            const requestId = uuid();
            const nowMs = Date.now();
            await this._store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: options.challenge,
                requestTimeMs: nowMs,
                expireTimeMs: nowMs + WEB_AUTHN_LOGIN_REQUEST_LIFETIME_MS,
                completedTimeMs: null,
                ipAddress: request.ipAddress,
                userId: null,
            });

            return {
                success: true,
                requestId,
                options,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while requesting WebAuthn login`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async completeWebAuthnLogin(
        request: CompleteWebAuthnLoginRequest
    ): Promise<CompleteWebAuthnLoginResult> {
        try {
            if (this._webAuthNRelyingParties.length <= 0) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'WebAuthn is not supported on this server.',
                };
            }

            const relyingParty = findRelyingPartyForOrigin(
                this._webAuthNRelyingParties,
                request.originOrHost
            );

            if (!relyingParty) {
                return {
                    success: false,
                    errorCode: 'invalid_origin',
                    errorMessage:
                        'The request must be made from an authorized origin.',
                };
            }

            const loginRequest = await this._store.findWebAuthnLoginRequest(
                request.requestId
            );

            if (!loginRequest) {
                console.error('could not find login request!');
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            let validRequest = true;
            if (Date.now() >= loginRequest.expireTimeMs) {
                console.error('Expired!');
                validRequest = false;
            } else if (loginRequest.completedTimeMs > 0) {
                console.error('Completed!');
                validRequest = false;
            } else if (loginRequest.ipAddress !== request.ipAddress) {
                console.error('Wrong IP!');
                validRequest = false;
            }

            if (!validRequest) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            const { authenticator, user } =
                await this._store.findUserAuthenticatorByCredentialId(
                    request.response.id
                );

            if (!authenticator) {
                console.error('No Authenticator!');
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                };
            }

            if (user.banTimeMs > 0) {
                return {
                    success: false,
                    errorCode: 'user_is_banned',
                    errorMessage: 'The user has been banned.',
                    banReason: user.banReason,
                };
            }

            try {
                const options = await verifyAuthenticationResponse({
                    response: request.response,
                    expectedChallenge: loginRequest.challenge,
                    expectedOrigin: relyingParty.origin,
                    expectedRPID: relyingParty.id,
                    authenticator: {
                        credentialID: new Uint8Array(
                            base64URLStringToBuffer(authenticator.credentialId)
                        ),
                        counter: authenticator.counter,
                        credentialPublicKey: authenticator.credentialPublicKey,
                        transports: authenticator.transports,
                    },
                });

                if (!options.verified) {
                    console.error('Not verified!');
                    return {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: INVALID_REQUEST_ERROR_MESSAGE,
                    };
                }

                await this._store.saveUserAuthenticatorCounter(
                    authenticator.id,
                    options.authenticationInfo.newCounter
                );
            } catch (err) {
                console.error(
                    `[AuthController] Error occurred while verifying WebAuthn login response`,
                    err
                );
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: err.message,
                };
            }

            const { info } = await this._issueSession({
                userId: user.id,
                lifetimeMs: SESSION_LIFETIME_MS,
                ipAddress: request.ipAddress,
                webauthnRequestId: loginRequest.requestId,
                oidRequestId: null,
            });

            return {
                success: true,
                ...info,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while requesting WebAuthn login`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async listUserAuthenticators(
        userId: string
    ): Promise<ListUserAuthenticatorsResult> {
        try {
            if (!userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You need to be logged in for the operation to work.',
                };
            }

            const authenticators = await this._store.listUserAuthenticators(
                userId
            );
            return {
                success: true,
                authenticators: authenticators.map((a) => ({
                    id: a.id,
                    aaguid: a.aaguid,
                    userId: a.userId,
                    credentialId: a.credentialId,
                    credentialDeviceType: a.credentialDeviceType,
                    credentialBackedUp: a.credentialBackedUp,
                    counter: a.counter,
                    transports: a.transports,
                    registeringUserAgent: a.registeringUserAgent,
                    createdAtMs: a.createdAtMs,
                })),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while listing user authenticators`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async deleteUserAuthenticator(
        userId: string,
        authenticatorId: string
    ): Promise<DeleteUserAuthenticatorResult> {
        try {
            if (!userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You need to be logged in for the operation to work.',
                };
            }

            const numDeleted = await this._store.deleteUserAuthenticator(
                userId,
                authenticatorId
            );
            if (numDeleted <= 0) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The given authenticator was not found.',
                };
            }
            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                `[AuthController] Error occurred while deleting a user authenticator`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
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
                !this.verifyPasswordAgainstHashes(
                    sessionSecret,
                    session.sessionId,
                    [session.secretHash]
                )
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

            if (
                typeof session.expireTimeMs === 'number' &&
                now >= session.expireTimeMs
            ) {
                console.log(
                    '[AuthController] [validateSessionKey] Session has expired.',
                    session
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
                        userInfo.allSessionRevokeTimeMs >=
                            session.grantedTimeMs &&
                        (session.revocable !== false || !!session.revokeTimeMs)
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
                privacyFeatures: userInfo.privacyFeatures,
                role: userInfo.role,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
    verifyPasswordAgainstHashes(
        sessionSecret: string,
        sessionId: string,
        hashes: string[]
    ) {
        return verifyPasswordAgainstHashes(sessionSecret, sessionId, hashes);
    }

    @traced(TRACE_NAME)
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

            if (
                typeof session.expireTimeMs === 'number' &&
                now >= session.expireTimeMs
            ) {
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
                        userInfo.allSessionRevokeTimeMs >=
                            session.grantedTimeMs &&
                        (session.revocable !== false || !!session.revokeTimeMs)
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
                privacyFeatures: userInfo.privacyFeatures,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
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

            if (session.revocable === false) {
                return {
                    success: false,
                    errorCode: 'session_is_not_revokable',
                    errorMessage: 'The session cannot be revoked.',
                };
            }

            const newSession: AuthSession = {
                ...session,
                revokeTimeMs: Date.now(),
            };

            await this._store.saveSession(newSession);

            let logoutUrl: string;
            if (session.oidProvider === PRIVO_OPEN_ID_PROVIDER) {
                logoutUrl = await this._privoClient.generateLogoutUrl(
                    session.oidIdToken ?? session.oidAccessToken
                );
            }

            return {
                success: true,
                logoutUrl,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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

            if (session.revocable === false) {
                console.log(
                    '[AuthController] [replaceSession] Session is irrevokable.'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const { info } = await this._issueSession({
                userId,
                lifetimeMs: SESSION_LIFETIME_MS,
                previousSession: session,
                ipAddress: request.ipAddress,
            });

            return {
                success: true,
                ...info,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
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
            } else if (
                !isSuperUserRole(keyResult.role) &&
                keyResult.userId !== request.userId
            ) {
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
    async getUserInfo(request: GetUserInfoRequest): Promise<GetUserInfoResult> {
        try {
            const requestedUserId = request.requestedUserId ?? request.userId;
            if (
                !isSuperUserRole(request.userRole) &&
                request.userId !== requestedUserId
            ) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                };
            }

            const result = await this._store.findUser(requestedUserId);

            if (!result) {
                return {
                    success: false,
                    errorCode: 'user_not_found',
                    errorMessage: 'The user was not found.',
                };
            }
            return await this.getPrivateInfoForUser(result);
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
     * Gets the user info for the given auth user.
     *
     * Not for public use.
     * @param user The user to get the info for.
     * @returns
     */
    async getPrivateInfoForUser(user: AuthUser): Promise<GetUserInfoSuccess> {
        const { hasActiveSubscription, subscriptionTier: tier } =
            await this._getSubscriptionInfo(user);
        const { privacyFeatures, displayName, email, name } =
            await this._getUserPrivoInfo(user);

        // let accountBalance: number | null = undefined;
        // let accountCurrency: string | null = undefined;
        // if (this._financialController && user.accountId) {
        //     const account = await this._financialController.getAccount(
        //         user.accountId
        //     );

        //     if (isSuccess(account)) {
        //         accountBalance = getAccountBalance(account.value);
        //         accountCurrency = getAccountCurrency(account.value);
        //     } else {
        //         console.error(
        //             '[AuthController] Error getting account balance for user',
        //             account.error
        //         );
        //     }
        // }

        const subscriptionConfig: SubscriptionConfiguration =
            await this._config.getSubscriptionConfiguration();
        const contractFeatures = getContractFeatures(
            subscriptionConfig,
            user.subscriptionStatus,
            user.subscriptionId,
            'user',
            user.subscriptionPeriodStartMs,
            user.subscriptionPeriodEndMs
        );

        return {
            success: true,
            userId: user.id,
            name: name,
            displayName,
            email: email,
            phoneNumber: user.phoneNumber,
            avatarPortraitUrl: user.avatarPortraitUrl,
            avatarUrl: user.avatarUrl,
            hasActiveSubscription: hasActiveSubscription,
            subscriptionTier: tier ?? null,
            privacyFeatures: privacyFeatures,
            role: user.role ?? 'none',
            // accountId: user.accountId,
            // accountBalance,
            // accountCurrency,
            requestedRate: user.requestedRate,
            stripeAccountId: user.stripeAccountId,
            stripeAccountRequirementsStatus:
                user.stripeAccountRequirementsStatus,
            stripeAccountStatus: user.stripeAccountStatus,
            contractFeatures: contractFeatures.allowed
                ? contractFeatures
                : undefined,
        };
    }

    private async _getUserPrivoInfo(user: AuthUser) {
        let privacyFeatures: PrivacyFeatures;
        let displayName: string = null;
        let email: string = user.email;
        let name: string = user.name;
        const privoConfig = await this._config.getPrivoConfiguration();
        if (privoConfig && user.privoServiceId) {
            const userInfo = await this._privoClient.getUserInfo(
                user.privoServiceId
            );
            privacyFeatures = getPrivacyFeaturesFromPermissions(
                privoConfig.featureIds,
                userInfo.permissions
            );
            displayName = userInfo.displayName;
            email = userInfo.email;
            name = userInfo.givenName;

            if (
                user.privacyFeatures?.publishData !==
                    privacyFeatures.publishData ||
                user.privacyFeatures?.allowPublicData !==
                    privacyFeatures.allowPublicData ||
                user.privacyFeatures?.allowAI !== privacyFeatures.allowAI ||
                user.privacyFeatures?.allowPublicInsts !==
                    privacyFeatures.allowPublicInsts
            ) {
                await this._store.saveUser({
                    ...user,
                    privacyFeatures: {
                        ...privacyFeatures,
                    },
                });
            }
        } else if (user.privacyFeatures) {
            privacyFeatures = {
                ...user.privacyFeatures,
            };
        } else {
            privacyFeatures = {
                publishData: true,
                allowPublicData: true,
                allowAI: true,
                allowPublicInsts: true,
            };
        }

        return {
            privacyFeatures,
            displayName,
            email,
            name,
        };
    }

    /**
     * Gets the public information for a specific user.
     * @param userId The ID of the user whose information is being requested.
     */
    @traced(TRACE_NAME)
    async getPublicUserInfo(userId: string): Promise<GetPublicUserInfoResult> {
        if (typeof userId !== 'string' || userId === '') {
            return {
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given userId is invalid. It must be a string.',
            };
        }

        try {
            const result = await this._store.findUser(userId);

            if (!result) {
                return {
                    success: true,
                    user: null,
                };
            }

            let displayName: string = null;
            const privoConfig = await this._config.getPrivoConfiguration();
            if (privoConfig && result.privoServiceId) {
                const userInfo = await this._privoClient.getUserInfo(
                    result.privoServiceId
                );
                displayName = userInfo.displayName;
            }

            return {
                success: true,
                user: {
                    userId: result.id,
                    name: result.name,
                    email: result.email,
                    displayName,
                },
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
        let tier: string = null;
        const subscriptionConfig: SubscriptionConfiguration =
            await this._config.getSubscriptionConfiguration();

        const sub = getSubscription(
            subscriptionConfig,
            user.subscriptionStatus,
            user.subscriptionId,
            'user',
            user.subscriptionPeriodStartMs,
            user.subscriptionPeriodEndMs
        );

        if (sub) {
            tier = sub.tier || 'beta';
        }

        return {
            hasActiveSubscription:
                !!sub &&
                isActiveSubscription(
                    user.subscriptionStatus,
                    user.subscriptionPeriodStartMs,
                    user.subscriptionPeriodEndMs
                ),
            subscriptionId: sub?.id,
            subscriptionTier: tier,
        };
    }

    /**
     * Gets the subscription information for a user.
     *
     * Not for public use.
     * @param user The user to get the subscription information for.
     * @returns
     */
    getUserSubscriptionInfo(user: AuthUser) {
        return this._getSubscriptionInfo(user);
    }

    /**
     * Attempts to update a user's metadata.
     * @param request The request for the operation.
     */
    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
     * Attempts to request a change in privacy features for a user.
     */
    @traced(TRACE_NAME)
    async requestPrivacyFeaturesChange(
        request: RequestPrivacyFeaturesChangeRequest
    ): Promise<RequestPrivacyFeaturesChangeResult> {
        try {
            if (!this._privoClient) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const config = await this._config.getPrivoConfiguration();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const keyResult = await this.validateSessionKey(request.sessionKey);
            if (keyResult.success === false) {
                return keyResult;
            } else if (
                keyResult.userId !== request.userId &&
                keyResult.role !== 'superUser'
            ) {
                console.log(
                    '[AuthController] [requestPrivacyFeaturesChange] Request User ID doesnt match session key User ID!'
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

            if (!user.privoServiceId) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                };
            }

            const result = await this._privoClient.resendConsentRequest(
                user.privoServiceId,
                user.privoParentServiceId ?? user.privoServiceId
            );

            if (result.success === false) {
                return result;
            }

            console.log(
                `[AuthController] [requestPrivacyFeaturesChange] [userId: ${request.userId}] Requested privacy features change.`
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error ocurred while requesting a change in privacy features',
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
    @traced(TRACE_NAME)
    async listEmailRules(): Promise<ListEmailRulesResult> {
        try {
            const rules = await this._store.listEmailRules();

            return {
                success: true,
                rules,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
    @traced(TRACE_NAME)
    async listSmsRules(): Promise<ListSmsRulesResult> {
        try {
            const rules = await this._store.listSmsRules();

            return {
                success: true,
                rules,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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

    @traced(TRACE_NAME)
    async isValidEmailAddress(
        email: string
    ): Promise<IsValidEmailAddressResult> {
        try {
            const valid = await this._validateAddress(email, 'email');

            if (!valid) {
                return {
                    success: true,
                    allowed: false,
                };
            }

            if (this._privoClient) {
                const config = await this._config.getPrivoConfiguration();
                if (config) {
                    const result = await this._privoClient.checkEmail(email);
                    const allowed = result.available && !result.profanity;

                    return {
                        success: true,
                        allowed,
                        suggestions: result.suggestions,
                        profanity: result.profanity,
                    };
                }
            }

            return {
                success: true,
                allowed: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error ocurred while checking if email address is valid',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async isValidDisplayName(
        displayName: string,
        name?: string
    ): Promise<IsValidDisplayNameResult> {
        try {
            if (this._privoClient) {
                if (name) {
                    const lowercaseName = name.trim().toLowerCase();
                    const lowercaseDisplayName = displayName
                        .trim()
                        .toLowerCase();
                    if (lowercaseDisplayName.includes(lowercaseName)) {
                        return {
                            success: true,
                            allowed: false,
                            containsName: true,
                        };
                    }
                }

                const config = await this._config.getPrivoConfiguration();
                if (config) {
                    const result = await this._privoClient.checkDisplayName(
                        displayName
                    );
                    const allowed = result.available && !result.profanity;

                    return {
                        success: true,
                        allowed,
                        suggestions: result.suggestions,
                        profanity: result.profanity,
                    };
                }
            }

            return {
                success: true,
                allowed: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[AuthController] Error ocurred while checking if display name is valid',
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
     * Issues a new session for the given user.
     * @param userId The ID of the user to issue the session for.
     * @param lifetimeMs The lifetime of the session in milliseconds. If null, then the session will not expire.
     * @param previousSession The previous session that this session is replacing. If null, then this session is not related to another session.
     * @param ipAddress The IP address that the session is being issued to. Should be null if the ip address is not known.
     */
    private async _issueSession({
        userId,
        lifetimeMs,
        previousSession,
        ipAddress,
        requestId,
        ...rest
    }: IssueSessionOptions): Promise<{
        newSession: AuthSession;
        info: AuthSessionInfo;
    }> {
        const now = Date.now();
        const newSessionId = fromByteArray(randomBytes(SESSION_ID_BYTE_LENGTH));
        const newSessionSecret = fromByteArray(
            randomBytes(SESSION_SECRET_BYTE_LENGTH)
        );
        const newConnectionSecret = fromByteArray(
            randomBytes(SESSION_SECRET_BYTE_LENGTH)
        );

        const newSession: AuthSession = {
            ...rest,
            userId: userId,
            sessionId: newSessionId,
            requestId: requestId ?? null,
            secretHash: this._hashHighEntropyPasswordWithSalt(
                newSessionSecret,
                newSessionId
            ),
            connectionSecret: newConnectionSecret,
            grantedTimeMs: now,
            revokeTimeMs: null,
            expireTimeMs: lifetimeMs ? now + lifetimeMs : null,
            previousSessionId: previousSession?.sessionId ?? null,
            nextSessionId: null,
            ipAddress: ipAddress,
        };

        if (requestId) {
            await this._store.markLoginRequestComplete(userId, requestId, now);
        }
        if (rest.webauthnRequestId) {
            await this._store.markWebAuthnLoginRequestComplete(
                rest.webauthnRequestId,
                userId,
                now
            );
        }
        if (rest.oidRequestId) {
            await this._store.markOpenIDLoginRequestComplete(
                rest.oidRequestId,
                now
            );
        }

        if (previousSession) {
            await this._store.replaceSession(previousSession, newSession, now);
        } else {
            await this._store.saveSession(newSession);
        }

        const metadata = await this._store.findUserLoginMetadata(userId);

        const info: AuthSessionInfo = {
            userId,
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
            metadata: {
                hasUserAuthenticator: metadata?.hasUserAuthenticator ?? false,
                userAuthenticatorCredentialIds:
                    metadata?.userAuthenticatorCredentialIds ?? [],
                hasPushSubscription: metadata?.hasPushSubscription ?? false,
                pushSubscriptionIds: metadata?.pushSubscriptionIds ?? [],
            },
        };

        console.log(
            `[AuthController] [issueSession userId: ${userId} newSessionId: ${newSessionId} expiresAt: ${newSession.expireTimeMs}] Issued session.`
        );

        return {
            newSession,
            info,
        };
    }
}

/**
 * Validates the given session key using the given auth controller.
 * @param sessionKey The session key to validate.
 */
export async function validateSessionKey(
    auth: AuthController,
    sessionKey: string | null
): Promise<ValidateSessionKeyResult | NoSessionKeyResult> {
    if (!sessionKey) {
        return {
            success: false,
            userId: null,
            role: null,
            errorCode: 'no_session_key',
            errorMessage:
                'A session key was not provided, but it is required for this operation.',
        };
    }
    const result = await auth.validateSessionKey(sessionKey);
    if (result.success === true) {
        const span = trace.getActiveSpan();
        if (span) {
            span.setAttributes({
                [SEMATTRS_ENDUSER_ID]: result.userId,
                ['request.userId']: result.userId,
                ['request.userRole']: result.role,
                ['request.sessionId']: result.sessionId,
                ['request.subscriptionId']: result.subscriptionId,
                ['request.subscriptionTier']: result.subscriptionTier,
            });
        }
    }
    return result;
}

export interface IssueSessionRequest {
    /**
     * The ID of the user to issue the session for.
     */
    userId: string;

    /**
     * The role of the user that is requesting the session.
     */
    requestingUserRole: UserRole;

    /**
     * The ID of the user that is requesting the session.
     * Null if the session is not being requested by another user.
     */
    requestingUserId: string | null;

    /**
     * The number of miliseconds that the session should last.
     * If null, then the session will not expire.
     * If undefined, then the default session lifetime will be used.
     */
    lifetimeMs?: number | null | undefined;

    /**
     * The IP address that the session is being issued from.
     */
    ipAddress: string | null;
}

export type IssueSessionResult = IssueSessionSuccess | IssueSessionFailure;

export interface IssueSessionSuccess extends AuthSessionInfo {
    success: true;
}

export interface IssueSessionFailure {
    success: false;
    errorCode: ServerError | 'not_authorized';
    errorMessage: string;
}

export interface IssueSessionOptions
    extends Omit<
        AuthSession,
        | 'secretHash'
        | 'sessionId'
        | 'connectionSecret'
        | 'revokeTimeMs'
        | 'grantedTimeMs'
        | 'nextSessionId'
        | 'previousSessionId'
        | 'expireTimeMs'
        | 'requestId'
    > {
    /**
     * The lifetime of the session in milliseconds. If null, then the session will not expire.
     */
    lifetimeMs: number | null;

    /**
     * The previous session that is being used to issue this session.
     * If null, then the session is not being issued from another session.
     */
    previousSession?: AuthSession | null;

    /**
     * The ID of the login request that this session is being issued from.
     */
    requestId?: string | null;
}

export interface AuthSessionInfo {
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
     * If null, then the session will not expire.
     */
    expireTimeMs: number | null;

    /**
     * Extra metadata for the user.
     */
    metadata: UserLoginMetadata;
}

export interface NoSessionKeyResult {
    success: false;
    userId: null;
    role: null;
    errorCode: 'no_session_key';
    errorMessage: string;
}

export interface PrivoSignUpRequest {
    /**
     * The email address of the user.
     */
    email: string | null;

    /**
     * The display name of the user.
     */
    displayName: string;

    /**
     * The name of the user.
     */
    name: string;

    /**
     * The date of birth of the user.
     */
    dateOfBirth: Date;

    /**
     * The email address of the user's parent.
     * Null if none was provided in the request.
     */
    parentEmail: string | null;

    /**
     * The IP address that the sign up is from.
     */
    ipAddress: string;
}

export interface OpenIDLoginRequest {
    /**
     * The Open ID provider that the login request is for.
     */
    provider: string;

    /**
     * The IP address that the request is from.
     */
    ipAddress: string;
}

export type OpenIDLoginRequestResult =
    | OpenIDLoginRequestSuccess
    | OpenIDLoginRequestFailure;

export interface OpenIDLoginRequestSuccess {
    success: true;

    /**
     * The URL that should be presented to the user in order for them to login.
     */
    authorizationUrl: string;

    /**
     * The ID of the request that was made.
     */
    requestId: string;
}

export interface OpenIDLoginRequestFailure {
    success: false;
    errorCode: ServerError | 'not_supported';
    errorMessage: string;
}

export interface ProcessOpenIDAuthorizationCodeRequest {
    /**
     * The state that was included in the callback.
     */
    state: string;

    /**
     * The authorization code that was included in the callback.
     */
    authorizationCode: string;

    /**
     * The IP address that the request is from.
     */
    ipAddress: string;
}

export type ProcessOpenIDAuthorizationCodeResult =
    | ProcessOpenIDAuthorizationCodeSuccess
    | ProcessOpenIDAuthorizationCodeFailure;

export interface ProcessOpenIDAuthorizationCodeSuccess {
    success: true;
}

export interface ProcessOpenIDAuthorizationCodeFailure {
    success: false;
    errorCode: ServerError | 'not_supported' | 'invalid_request';
    errorMessage: string;
}

export interface CompleteOpenIDLoginRequest {
    /**
     * The ID of the login request.
     */
    requestId: string;

    /**
     * The IP address that the request is from.
     */
    ipAddress: string;
}

export type CompleteOpenIDLoginResult =
    | CompleteOpenIDLoginSuccess
    | CompleteOpenIDLoginFailure;

export interface CompleteOpenIDLoginSuccess extends AuthSessionInfo {
    success: true;
}

export interface CompleteOpenIDLoginFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_supported'
        | 'invalid_request'
        | 'not_completed';
    errorMessage: string;
}

export type PrivoSignUpRequestResult =
    | PrivoSignUpRequestSuccess
    | PrivoSignUpRequestFailure;

export interface PrivoSignUpRequestSuccess extends AuthSessionInfo {
    success: true;

    /**
     * The URL that the user can be sent to in order to complete the sign up and set their password.
     */
    updatePasswordUrl: string;
}

export interface PrivoSignUpRequestFailure {
    success: false;

    /**
     * The code of the error.
     */
    errorCode:
        | 'unacceptable_request'
        | 'email_already_exists'
        | 'parent_email_already_exists'
        | 'child_email_already_exists'
        | 'parent_email_required'
        | 'invalid_display_name'
        | NotSupportedError
        | ServerError;

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The issues that were found with the request.
     */
    issues?: ZodIssue[];
}

export interface CreateAccountRequest {
    /**
     * The role of the logged in user.
     */
    userRole: UserRole;

    /**
     * The IP Address that the request is being made from.
     * Can be set to null if not creating a session.
     */
    ipAddress: string | null;

    /**
     * Whether or not to create a session for the user.
     * Defaults to true.
     */
    createSession?: boolean;
}

export type CreateAccountResult = CreateAccountSuccess | CreateAccountFailure;

export interface CreateAccountSuccess extends AuthSessionInfo {
    success: true;
}

export interface CreateAccountFailure {
    success: false;

    /**
     * The code of the error.
     */
    errorCode:
        | 'unacceptable_request'
        | 'not_logged_in'
        | 'not_authorized'
        | 'invalid_display_name'
        | NotSupportedError
        | SaveNewUserFailure['errorCode']
        | ServerError;

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The issues that were found with the request.
     */
    issues?: ZodIssue[];
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

    /**
     * The ID of the studio that the login is for.
     *
     * If null, then the user is logging into CasualOS proper.
     */
    loginStudioId?: string | null;

    /**
     * The ID of the comID that the login is for.
     */
    comId?: string | null;

    /**
     * The hostname that the login is for.
     *
     * If specified, then the hostname will be used to determine the studio/comID that the login is for.
     */
    hostname?: string | null;
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

    /**
     * The URL that the user should be redirected to in order to complete the login.
     * If null, then the user should be shown a code input.
     */
    redirectUrl?: string | null;
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
        | 'unacceptable_request'
        | 'address_type_not_supported'
        | 'user_is_banned'
        | 'not_found'
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

export interface CompleteLoginSuccess extends AuthSessionInfo {
    success: true;
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

    /**
     * The privacy features that the user has specified.
     * If null or omitted, then all features are enabled.
     */
    privacyFeatures?: PrivacyFeatures;

    /**
     * The role of the user.
     */
    role?: UserRole;
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

    /**
     * The privacy features that the user has specified.
     * If null or omitted, then all features are enabled.
     */
    privacyFeatures?: PrivacyFeatures;
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

    /**
     * The URL that the user can be redirected to in order to logout completely.
     */
    logoutUrl?: string;
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
        | 'session_is_not_revokable'
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

export interface ReplaceSessionSuccess extends AuthSessionInfo {
    success: true;
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
     * The ID of the currently logged in user.
     */
    userId: string;

    /**
     * The role of the currently logged in user.
     */
    userRole?: UserRole;

    /**
     * The ID of the user that should be retrieved.
     * If omitted, then the logged in user info will be retrieved.
     */
    requestedUserId?: string;
}

export interface UserInfo {
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
     * The public display name of the user.
     */
    displayName: string;

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

    /**
     * The privacy-related features that the user has enabled.
     */
    privacyFeatures: PrivacyFeatures;

    /**
     * The role that the user has in the system.
     */
    role: UserRole;

    /**
     * The contracting features that the user has access to.
     */
    contractFeatures?: ContractFeaturesConfiguration;

    // /**
    //  * The ID of the associated financial account.
    //  */
    // accountId: string | null;

    // /**
    //  * The balance of the user's financial account.
    //  * Denominated in the smallest unit of the account's currency (e.g., cents for credits/usd).
    //  * Null if the user does not have a financial account.
    //  */
    // accountBalance: number | null;

    // /**
    //  * The currency code that the user's financial account is in.
    //  */
    // accountCurrency: string | null;

    /**
     * The rate at which the user is requesting payment (null if not yet specified)
     */
    requestedRate: number | null;

    /**
     * The user's connected stripe account ID.
     */
    stripeAccountId: string | null;

    /**
     * The user's connected stripe account requirements status.
     */
    stripeAccountRequirementsStatus: StripeRequirementsStatus | null;

    /**
     * The user's connected stripe account status.
     */
    stripeAccountStatus: StripeAccountStatus | null;
}

export type GetUserInfoResult = GetUserInfoSuccess | GetUserInfoFailure;

export interface GetUserInfoSuccess extends UserInfo {
    success: true;
}

export interface GetUserInfoFailure {
    success: false;
    errorCode: 'user_not_found' | NotAuthorizedError | ServerError;
    errorMessage: string;
}

export type GetPublicUserInfoResult =
    | GetPublicUserInfoSuccess
    | GetPublicUserInfoFailure;

export interface GetPublicUserInfoSuccess {
    success: true;

    /**
     * The user info. Null if the user wasn't found.
     */
    user: PublicUserInfo | null;
}

export interface GetPublicUserInfoFailure {
    success: false;
    errorCode: 'unacceptable_user_id' | ServerError;
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

export type IsValidEmailAddressResult =
    | IsValidEmailAddressSuccess
    | IsValidEmailAddressFailure;

export interface IsValidEmailAddressSuccess {
    success: true;
    /**
     * Whether the email address can be used.
     */
    allowed: boolean;

    /**
     * The suggestions for alternate email addresses.
     */
    suggestions?: string[];

    /**
     * Whether the email contains profanity.
     */
    profanity?: boolean;
}

export interface IsValidEmailAddressFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type IsValidDisplayNameResult =
    | IsValidDisplayNameSuccess
    | IsValidDisplayNameFailure;

export interface IsValidDisplayNameSuccess {
    success: true;
    /**
     * Whether the email address can be used.
     */
    allowed: boolean;

    /**
     * The suggestions for alternate email addresses.
     */
    suggestions?: string[];

    /**
     * Whether the email contains profanity.
     */
    profanity?: boolean;

    /**
     * Whether the display name contains the user's name.
     */
    containsName?: boolean;
}

export interface RequestWebAuthnRegistration {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /*
     * The HTTP origin or host that the request is coming from.
     */
    originOrHost: string | null;
}

export type RequestWebAuthnRegistrationResult =
    | RequestWebAuthnRegistrationSuccess
    | RequestWebAuthnRegistrationFailure;

export interface RequestWebAuthnRegistrationSuccess {
    success: true;
    options: PublicKeyCredentialCreationOptionsJSON;
}

export interface RequestWebAuthnRegistrationFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | 'invalid_origin';
    errorMessage: string;
}

export interface CompleteWebAuthnRegistrationRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The registration response.
     */
    response: RegistrationResponseJSON;

    /**
     * The HTTP origin or host that the request was made from.
     */
    originOrHost: string;

    /**
     * The user agent that the request was made from.
     */
    userAgent: string | null;
}

export interface RequestWebAuthnLogin {
    /**
     * The IP Address that the login request is from.
     */
    ipAddress: string;

    /**
     * The HTTP origin or host that the request is coming from.
     * Null if the request is coming from the same origin as the server.
     */
    originOrHost: string | null;
}

export type RequestWebAuthnLoginResult =
    | RequestWebAuthnLoginSuccess
    | RequestWebAuthnLoginFailure;

export interface RequestWebAuthnLoginSuccess {
    success: true;
    /**
     * The ID of the login request.
     */
    requestId: string;

    /**
     * The options for the login request.
     */
    options: PublicKeyCredentialRequestOptionsJSON;
}

export interface RequestWebAuthnLoginFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | LoginRequestFailure['errorCode']
        | 'invalid_origin';
    errorMessage: string;
}

export interface CompleteWebAuthnLoginRequest {
    /**
     * The ID of the login request.
     */
    requestId: string;

    /**
     * The response to the login request.
     */
    response: AuthenticationResponseJSON;

    /**
     * The IP Address that the login request is from.
     */
    ipAddress: string;

    /**
     * The HTTP origin or host that the request is coming from.
     * Null if the origin is from the same origin as the server.
     */
    originOrHost: string | null;
}

export type CompleteWebAuthnLoginResult =
    | CompleteWebAuthnLoginSuccess
    | CompleteWebAuthnLoginFailure;

export interface CompleteWebAuthnLoginSuccess {
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

export interface CompleteWebAuthnLoginFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | CompleteLoginFailure['errorCode']
        | LoginRequestFailure['errorCode']
        | 'invalid_origin';
    errorMessage: string;

    /**
     * The ban reason for the user.
     */
    banReason?: AuthUser['banReason'];
}

export type CompleteWebAuthnRegistrationResult =
    | CompleteWebAuthnRegistrationSuccess
    | CompleteWebAuthnRegistrationFailure;

export interface CompleteWebAuthnRegistrationSuccess {
    success: true;
}

export interface CompleteWebAuthnRegistrationFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | NotAuthorizedError
        | 'invalid_origin'
        | 'unacceptable_request';
    errorMessage: string;
}

export type ListUserAuthenticatorsResult =
    | ListUserAuthenticatorsSuccess
    | ListUserAuthenticatorsFailure;

export interface ListUserAuthenticatorsSuccess {
    success: true;
    authenticators: AuthListedUserAuthenticator[];
}

export interface ListUserAuthenticatorsFailure {
    success: false;
    errorCode: ServerError | NotLoggedInError;
    errorMessage: string;
}

export type DeleteUserAuthenticatorResult =
    | DeleteUserAuthenticatorSuccess
    | DeleteUserAuthenticatorFailure;

export interface DeleteUserAuthenticatorSuccess {
    success: true;
}

export interface DeleteUserAuthenticatorFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | 'not_found';
    errorMessage: string;
}

export interface IsValidDisplayNameFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export function getPrivacyFeaturesFromPermissions(
    featureIds: PrivoConfiguration['featureIds'],
    permissions: (PrivoPermission | PrivoFeatureStatus)[]
): PrivacyFeatures {
    const publishData = permissions.some(
        (p) => p.on && p.featureId === featureIds.projectDevelopment
    );
    const allowPublicData =
        publishData &&
        permissions.some(
            (p) => p.on && p.featureId === featureIds.publishProjects
        );

    // TODO:
    // Whether the AI features are enabled.
    const allowAI = permissions.some(
        (p) => p.on && p.featureId === featureIds.buildAIEggs
    );

    // Whether the public insts features are enabled.
    const allowPublicInsts =
        publishData &&
        permissions.some(
            (p) => p.on && p.featureId === featureIds.joinAndCollaborate
        );
    return {
        publishData,
        allowPublicData,
        allowAI,
        allowPublicInsts,
    };
}

export function findRelyingPartyForOrigin(
    relyingParties: RelyingParty[],
    originOrHost: string
): RelyingParty {
    if (!originOrHost) {
        return relyingParties[0];
    }
    return relyingParties.find((rp) => {
        const matchesOrigin = rp.origin === originOrHost;

        if (matchesOrigin) {
            return true;
        }

        const originUrl = new URL(rp.origin);
        const host = originUrl.host;
        return originOrHost === host;
    });
}

export interface RequestPrivacyFeaturesChangeRequest {
    /**
     * The ID of the user that the request is for.
     */
    userId: string;

    /**
     * The session key that should authorize the request.
     */
    sessionKey: string;
}

export type RequestPrivacyFeaturesChangeResult =
    | RequestPrivacyFeaturesChangeSuccess
    | RequestPrivacyFeaturesChangeFailure;

export interface RequestPrivacyFeaturesChangeSuccess {
    success: true;
}

export interface RequestPrivacyFeaturesChangeFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | NotSupportedError
        | ValidateSessionKeyFailure['errorCode']
        | ResendConsentRequestFailure['errorCode'];
    errorMessage: string;
}
