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
    CompleteLoginSuccess,
    ListSessionsSuccess,
    RelyingParty,
    RequestWebAuthnLoginSuccess,
    RequestWebAuthnRegistrationSuccess,
} from './AuthController';
import {
    AuthController,
    findRelyingPartyForOrigin,
    getPrivacyFeaturesFromPermissions,
    INVALID_KEY_ERROR_MESSAGE,
    INVALID_TOKEN_ERROR_MESSAGE,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
    OPEN_ID_LOGIN_REQUEST_LIFETIME_MS,
    PRIVO_OPEN_ID_PROVIDER,
    SESSION_LIFETIME_MS,
} from './AuthController';
import {
    formatV1ConnectionKey,
    formatV1SessionKey,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-common';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import {
    hashHighEntropyPasswordWithSalt,
    hashLowEntropyPasswordWithSalt,
} from '@casual-simulation/crypto';
import { toBase64String } from '@casual-simulation/aux-common';
import { padStart } from 'lodash';
import { allowAllFeatures } from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';
import { DateTime } from 'luxon';
import type { PrivoClientInterface } from './PrivoClient';
import type {
    VerifiedRegistrationResponse,
    VerifyAuthenticationResponseOpts,
    GenerateRegistrationOptionsOpts,
    GenerateAuthenticationOptionsOpts,
    VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import {
    verifyRegistrationResponse,
    generateRegistrationOptions,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import type { UserLoginMetadata } from './AuthStore';

jest.mock('tweetnacl', () => {
    const originalModule = jest.requireActual('tweetnacl');

    //Mock the default export and named export 'foo'
    return {
        __esModule: true,
        ...originalModule,
        randomBytes: jest.fn(),
    };
});

const originalDateNow = Date.now;

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

jest.mock('@simplewebauthn/server');
let verifyRegistrationResponseMock: jest.Mock<
    Promise<VerifiedRegistrationResponse>,
    [VerifyAuthenticationResponseOpts]
> = verifyRegistrationResponse as any;
let generateRegistrationOptionsMock: jest.Mock<
    Promise<PublicKeyCredentialCreationOptionsJSON>,
    [GenerateRegistrationOptionsOpts]
> = generateRegistrationOptions as any;
let generateAuthenticationOptionsMock: jest.Mock<
    Promise<PublicKeyCredentialRequestOptionsJSON>,
    [GenerateAuthenticationOptionsOpts]
> = generateAuthenticationOptions as any;

let verifyAuthenticationResponseMock: jest.Mock<
    Promise<VerifiedAuthenticationResponse>,
    [VerifyAuthenticationResponseOpts]
> = verifyAuthenticationResponse as any;

generateRegistrationOptionsMock.mockImplementation(async (opts) => {
    const generateRegistrationOptions = jest.requireActual(
        '@simplewebauthn/server'
    ).generateRegistrationOptions;
    return generateRegistrationOptions(opts);
});

verifyRegistrationResponseMock.mockImplementation(async (opts) => {
    const verifyRegistrationResponse = jest.requireActual(
        '@simplewebauthn/server'
    ).verifyRegistrationResponse;
    return verifyRegistrationResponse(opts);
});

generateAuthenticationOptionsMock.mockImplementation(async (opts) => {
    const generateAuthenticationOptions = jest.requireActual(
        '@simplewebauthn/server'
    ).generateAuthenticationOptions;
    return generateAuthenticationOptions(opts);
});

verifyAuthenticationResponseMock.mockImplementation(async (opts) => {
    const verifyAuthenticationResponse = jest.requireActual(
        '@simplewebauthn/server'
    ).verifyAuthenticationResponse;
    return verifyAuthenticationResponse(opts);
});

console.log = jest.fn();
console.error = jest.fn();

const randomBytesMock: jest.Mock<Uint8Array, [number]> = <any>randomBytes;

describe('AuthController', () => {
    let store: MemoryStore;
    let messenger: MemoryAuthMessenger;
    let controller: AuthController;
    let privoClient: PrivoClientInterface;
    let privoClientMock: jest.MockedObject<PrivoClientInterface>;
    let nowMock: jest.Mock<number>;
    let relyingParty: RelyingParty;

    beforeEach(() => {
        nowMock = Date.now = jest.fn();
        store = new MemoryStore({
            subscriptions: {
                subscriptions: [
                    {
                        id: 'sub_2',
                        product: 'product_2',
                        eligibleProducts: ['product_2'],
                        featureList: [],
                        purchasable: true,
                        tier: 'alpha',
                    },
                    {
                        id: 'sub_1',
                        product: 'product_1',
                        eligibleProducts: ['product_1'],
                        featureList: [],
                        purchasable: true,
                        tier: 'beta',
                    },
                ],
                webhookSecret: 'webhook',
                successUrl: 'success_url',
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                tiers: {},
                defaultFeatures: {
                    user: allowAllFeatures(),
                    studio: allowAllFeatures(),
                },
            },
        });
        messenger = new MemoryAuthMessenger();

        privoClient = privoClientMock = {
            createAdultAccount: jest.fn(),
            createChildAccount: jest.fn(),
            getUserInfo: jest.fn(),
            generateAuthorizationUrl: jest.fn(),
            processAuthorizationCallback: jest.fn(),
            checkEmail: jest.fn(),
            checkDisplayName: jest.fn(),
            generateLogoutUrl: jest.fn(),
            resendConsentRequest: jest.fn(),
            lookupServiceId: jest.fn(),
        };

        relyingParty = {
            name: 'example relying party',
            id: 'example.com',
            origin: 'https://example.com',
        };

        controller = new AuthController(
            store,
            messenger,
            store,
            undefined,
            privoClient,
            [relyingParty]
        );

        uuidMock.mockReset();
        randomBytesMock.mockReset();
    });

    afterEach(() => {
        Date.now = originalDateNow;
    });

    describe('lifetimes', () => {
        const oneMinute = 1000 * 60;
        const oneHour = oneMinute * 60;
        const oneDay = oneHour * 24;
        const twoWeeks = oneDay * 14;

        it('should create sessions with a lifetime of 2 weeks', () => {
            expect(SESSION_LIFETIME_MS).toEqual(twoWeeks);
        });

        it('should create login requests with a lifetime of 5 minutes', () => {
            expect(LOGIN_REQUEST_LIFETIME_MS).toEqual(oneMinute * 5);
        });
    });

    describe('createAccount()', () => {
        it('should create a new account and return the session key for the user', async () => {
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            uuidMock.mockReturnValueOnce('uuid1');

            const result = await controller.createAccount({
                userRole: 'superUser',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'uuid1',
                sessionKey: formatV1SessionKey(
                    'uuid1',
                    fromByteArray(sessionId),
                    fromByteArray(sessionSecret),
                    Infinity
                ),
                connectionKey: formatV1ConnectionKey(
                    'uuid1',
                    fromByteArray(sessionId),
                    fromByteArray(connectionSecret),
                    Infinity
                ),
                expireTimeMs: null,
                metadata: expect.any(Object),
            });

            const user = await store.findUser('uuid1');

            expect(user).toEqual({
                id: 'uuid1',
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            const session = await store.findSession(
                'uuid1',
                fromByteArray(sessionId)
            );

            expect(session).toEqual({
                userId: 'uuid1',
                sessionId: fromByteArray(sessionId),
                secretHash: expect.any(String),
                requestId: null,

                connectionSecret: fromByteArray(connectionSecret),
                grantedTimeMs: 150,
                expireTimeMs: null,
                revokeTimeMs: null,
                previousSessionId: null,
                nextSessionId: null,
                ipAddress: '127.0.0.1',

                revocable: false,
            });
        });

        it('should require that the user is a superUser', async () => {
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            uuidMock.mockReturnValueOnce('uuid1');

            const result = await controller.createAccount({
                userRole: 'none',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            });

            const user = await store.findUser('uuid1');
            expect(user).toBeFalsy();
        });

        it('should be able to create an account without creating a session key', async () => {
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            uuidMock.mockReturnValueOnce('uuid1');

            const result = await controller.createAccount({
                userRole: 'superUser',
                ipAddress: null,
                createSession: false,
            });

            expect(result).toEqual({
                success: true,
                userId: 'uuid1',
                sessionKey: null,
                connectionKey: null,
                expireTimeMs: null,
                metadata: expect.any(Object),
            });

            const user = await store.findUser('uuid1');

            expect(user).toEqual({
                id: 'uuid1',
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            const session = await store.findSession(
                'uuid1',
                fromByteArray(sessionId)
            );

            expect(session).toBeFalsy();
        });
    });

    describe('issueSession()', () => {
        const userId = 'myid';
        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
        });

        it('should issue a new session for the user for the system role', async () => {
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);
            uuidMock.mockReturnValueOnce('uuid1');

            const response = await controller.issueSession({
                userId,
                requestingUserId: null,
                requestingUserRole: 'system',
                ipAddress: null,
            });

            expect(response).toEqual({
                success: true,
                userId,
                sessionKey: formatV1SessionKey(
                    userId,
                    fromByteArray(sessionId),
                    fromByteArray(sessionSecret),
                    150 + SESSION_LIFETIME_MS
                ),
                connectionKey: formatV1ConnectionKey(
                    userId,
                    fromByteArray(sessionId),
                    fromByteArray(connectionSecret),
                    150 + SESSION_LIFETIME_MS
                ),
                expireTimeMs: 150 + SESSION_LIFETIME_MS,
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });
        });

        const notAuthorizedCases = [
            ['superUser'] as const,
            ['none'] as const,
        ] as const;

        it.each(notAuthorizedCases)(
            'should return not_authorized if the requesting user role is %s',
            async (role) => {
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                nowMock.mockReturnValue(150);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);
                uuidMock.mockReturnValueOnce('uuid1');

                const response = await controller.issueSession({
                    userId,
                    requestingUserId: null,
                    requestingUserRole: role,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                });
            }
        );
    });

    describe('requestLogin()', () => {
        const cases = [
            ['email', 'test@example.com'] as const,
            ['phone', '+15559321234'] as const,
        ];

        describe.each(cases)('%s', (type, address) => {
            it('should save a new user and login request for the user', async () => {
                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6, 7]);

                nowMock.mockReturnValue(100);
                randomBytesMock
                    .mockReturnValueOnce(salt)
                    .mockReturnValueOnce(code);
                uuidMock.mockReturnValueOnce('uuid1');

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: true,
                    userId: 'uuid1',
                    requestId: fromByteArray(salt),
                    address: address,
                    addressType: type,
                    expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                });

                if (type === 'email') {
                    expect(store.users).toEqual([
                        {
                            id: 'uuid1',
                            email: address,
                            phoneNumber: null,
                            currentLoginRequestId: fromByteArray(salt),
                            allSessionRevokeTimeMs: null,
                        },
                    ]);
                } else {
                    expect(store.users).toEqual([
                        {
                            id: 'uuid1',
                            email: null,
                            phoneNumber: address,
                            currentLoginRequestId: fromByteArray(salt),
                            allSessionRevokeTimeMs: null,
                        },
                    ]);
                }

                expect(store.loginRequests).toEqual([
                    {
                        userId: 'uuid1',
                        requestId: fromByteArray(salt),
                        secretHash: hashLowEntropyPasswordWithSalt(
                            codeNumber(code),
                            fromByteArray(salt)
                        ),
                        requestTimeMs: 100,
                        expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                        completedTimeMs: null,
                        attemptCount: 0,
                        address: address,
                        addressType: type,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(messenger.messages).toEqual([
                    {
                        address: address,
                        addressType: type,
                        code: codeNumber(code),
                    },
                ]);

                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_ID_BYTE_LENGTH
                );
                expect(randomBytesMock).toHaveBeenCalledWith(4);
            });

            it('should create a new login request for the existing user', async () => {
                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6, 7]);

                nowMock.mockReturnValue(100);
                randomBytesMock
                    .mockReturnValueOnce(salt)
                    .mockReturnValueOnce(code);
                uuidMock.mockReturnValueOnce('uuid1');

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: true,
                    userId: 'myid',
                    requestId: fromByteArray(salt),
                    address: address,
                    addressType: type,
                    expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                });

                expect(store.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: fromByteArray(salt),
                    },
                ]);

                expect(store.loginRequests).toEqual([
                    {
                        userId: 'myid',
                        requestId: fromByteArray(salt),
                        secretHash: hashLowEntropyPasswordWithSalt(
                            codeNumber(code),
                            fromByteArray(salt)
                        ),
                        requestTimeMs: 100,
                        expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                        completedTimeMs: null,
                        attemptCount: 0,
                        address: address,
                        addressType: type,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(messenger.messages).toEqual([
                    {
                        address: address,
                        addressType: type,
                        code: codeNumber(code),
                    },
                ]);

                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_ID_BYTE_LENGTH
                );
                expect(randomBytesMock).toHaveBeenCalledWith(4);
                expect(uuidMock).not.toHaveBeenCalled();
            });

            it('should create a new login request for the existing user even if the address is denied by a rule', async () => {
                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6, 7]);

                nowMock.mockReturnValue(100);
                randomBytesMock
                    .mockReturnValueOnce(salt)
                    .mockReturnValueOnce(code);
                uuidMock.mockReturnValueOnce('uuid1');

                if (type === 'email') {
                    store.emailRules.push({
                        pattern: `^${address}$`,
                        type: 'deny',
                    });
                } else {
                    store.smsRules.push({
                        pattern: `^${address}$`,
                        type: 'deny',
                    });
                }

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: true,
                    userId: 'myid',
                    requestId: fromByteArray(salt),
                    address: address,
                    addressType: type,
                    expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                });

                expect(store.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: fromByteArray(salt),
                    },
                ]);

                expect(store.loginRequests).toEqual([
                    {
                        userId: 'myid',
                        requestId: fromByteArray(salt),
                        secretHash: hashLowEntropyPasswordWithSalt(
                            codeNumber(code),
                            fromByteArray(salt)
                        ),
                        requestTimeMs: 100,
                        expireTimeMs: 100 + LOGIN_REQUEST_LIFETIME_MS,
                        completedTimeMs: null,
                        attemptCount: 0,
                        address: address,
                        addressType: type,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(messenger.messages).toEqual([
                    {
                        address: address,
                        addressType: type,
                        code: codeNumber(code),
                    },
                ]);

                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_ID_BYTE_LENGTH
                );
                expect(randomBytesMock).toHaveBeenCalledWith(4);
                expect(uuidMock).not.toHaveBeenCalled();
            });

            it('should fail if the given address type is not supported by the messenger', async () => {
                const mockFn = (messenger.supportsAddressType = jest.fn());
                mockFn.mockReturnValue(false);

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'address_type_not_supported',
                    errorMessage:
                        type === 'email'
                            ? 'Email addresses are not supported.'
                            : 'Phone numbers are not supported',
                });

                expect(store.users).toEqual([]);
                expect(store.loginRequests).toEqual([]);
                expect(messenger.messages).toEqual([]);

                expect(randomBytesMock).not.toHaveBeenCalled();
                expect(randomBytesMock).not.toHaveBeenCalled();
                expect(uuidMock).not.toHaveBeenCalled();
            });

            it('should fail if the given address is flagged as invalid by the messenger', async () => {
                const mockFn = (messenger.sendCode = jest.fn());
                mockFn.mockResolvedValue({
                    success: false,
                    errorCode: 'unacceptable_address',
                    errorMessage: 'The address is invalid.',
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6, 7]);

                nowMock.mockReturnValue(100);
                randomBytesMock
                    .mockReturnValueOnce(salt)
                    .mockReturnValueOnce(code);
                uuidMock.mockReturnValueOnce('uuid1');

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'unacceptable_address',
                    errorMessage: 'The address is invalid.',
                });

                expect(store.users).toEqual([]);
                expect(store.loginRequests).toEqual([]);
                expect(messenger.messages).toEqual([]);

                expect(randomBytesMock).toHaveBeenCalled();
                expect(randomBytesMock).toHaveBeenCalled();
                expect(uuidMock).toHaveBeenCalled();
            });

            it('should fail if the user is banned', async () => {
                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    banTimeMs: 1,
                    banReason: 'terms_of_service_violation',
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6, 7]);

                nowMock.mockReturnValue(100);
                randomBytesMock
                    .mockReturnValueOnce(salt)
                    .mockReturnValueOnce(code);
                uuidMock.mockReturnValueOnce('uuid1');

                const response = await controller.requestLogin({
                    address: address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'user_is_banned',
                    errorMessage: 'The user has been banned.',
                    banReason: 'terms_of_service_violation',
                });

                expect(store.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        banTimeMs: 1,
                        banReason: 'terms_of_service_violation',
                    },
                ]);

                expect(store.loginRequests).toEqual([]);
                expect(messenger.messages).toEqual([]);
            });
        });

        it('should fail if the given email is longer than 200 characters long', async () => {
            const salt = new Uint8Array([1, 2, 3]);
            const code = new Uint8Array([4, 5, 6, 7]);

            nowMock.mockReturnValue(100);
            randomBytesMock.mockReturnValueOnce(salt).mockReturnValueOnce(code);
            uuidMock.mockReturnValueOnce('uuid1');

            store.emailRules.push({
                pattern: '^test@casualsimulation\\.org$',
                type: 'deny',
            });

            const address = 'a'.repeat(201);

            const response = await controller.requestLogin({
                address: address,
                addressType: 'email',
                ipAddress: '127.0.0.1',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage:
                    'The given email address is too long. It must be 200 characters or shorter in length.',
            });

            expect(store.users).toEqual([]);
            expect(store.loginRequests).toEqual([]);
            expect(messenger.messages).toEqual([]);

            expect(randomBytesMock).not.toHaveBeenCalled();
            expect(randomBytesMock).not.toHaveBeenCalled();
        });

        it('should fail if the given phone number is longer than 30 characters long', async () => {
            const salt = new Uint8Array([1, 2, 3]);
            const code = new Uint8Array([4, 5, 6, 7]);

            nowMock.mockReturnValue(100);
            randomBytesMock.mockReturnValueOnce(salt).mockReturnValueOnce(code);
            uuidMock.mockReturnValueOnce('uuid1');

            store.emailRules.push({
                pattern: '^test@casualsimulation\\.org$',
                type: 'deny',
            });

            const address = '5'.repeat(31);

            const response = await controller.requestLogin({
                address: address,
                addressType: 'phone',
                ipAddress: '127.0.0.1',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage:
                    'The given SMS address is too long. It must be 30 digits or shorter in length.',
            });

            expect(store.users).toEqual([]);
            expect(store.loginRequests).toEqual([]);
            expect(messenger.messages).toEqual([]);

            expect(randomBytesMock).not.toHaveBeenCalled();
            expect(randomBytesMock).not.toHaveBeenCalled();
        });

        it('should fail if the given email does not match an email rule', async () => {
            const salt = new Uint8Array([1, 2, 3]);
            const code = new Uint8Array([4, 5, 6, 7]);

            nowMock.mockReturnValue(100);
            randomBytesMock.mockReturnValueOnce(salt).mockReturnValueOnce(code);
            uuidMock.mockReturnValueOnce('uuid1');

            store.emailRules.push({
                pattern: '^test@casualsimulation\\.org$',
                type: 'deny',
            });

            const response = await controller.requestLogin({
                address: 'test@casualsimulation.org',
                addressType: 'email',
                ipAddress: '127.0.0.1',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage: 'The given address is not accepted.',
            });

            expect(store.users).toEqual([]);
            expect(store.loginRequests).toEqual([]);
            expect(messenger.messages).toEqual([]);

            expect(randomBytesMock).not.toHaveBeenCalled();
            expect(randomBytesMock).not.toHaveBeenCalled();
        });

        it('should fail if the given phone number does not match an SMS rule', async () => {
            const salt = new Uint8Array([1, 2, 3]);
            const code = new Uint8Array([4, 5, 6, 7]);

            nowMock.mockReturnValue(100);
            randomBytesMock.mockReturnValueOnce(salt).mockReturnValueOnce(code);
            uuidMock.mockReturnValueOnce('uuid1');

            store.smsRules.push({
                pattern: '^5555555555$',
                type: 'deny',
            });

            const response = await controller.requestLogin({
                address: '5555555555',
                addressType: 'phone',
                ipAddress: '127.0.0.1',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'unacceptable_address',
                errorMessage: 'The given address is not accepted.',
            });

            expect(store.users).toEqual([]);
            expect(store.loginRequests).toEqual([]);
            expect(messenger.messages).toEqual([]);

            expect(randomBytesMock).not.toHaveBeenCalled();
            expect(randomBytesMock).not.toHaveBeenCalled();
        });

        describe('data validation', () => {
            const invalidAddressCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidAddressCases)(
                'should fail if given a %s address',
                async (desc, address) => {
                    const response = await controller.requestLogin({
                        address: address,
                        addressType: 'email',
                        ipAddress: '127.0.0.1',
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_address',
                        errorMessage:
                            'The given address is invalid. It must be a string.',
                    });

                    expect(store.users).toEqual([]);
                    expect(store.loginRequests).toEqual([]);
                    expect(messenger.messages).toEqual([]);

                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(uuidMock).not.toHaveBeenCalled();
                }
            );

            const invalidAddressTypeCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
                ['missing', 'missing'],
            ];
            it.each(invalidAddressTypeCases)(
                'should fail if given a %s address type',
                async (desc, addressType) => {
                    const response = await controller.requestLogin({
                        address: 'address',
                        addressType: addressType,
                        ipAddress: '127.0.0.1',
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_address_type',
                        errorMessage:
                            'The given address type is invalid. It must be a string containing either "email" or "phone".',
                    });

                    expect(store.users).toEqual([]);
                    expect(store.loginRequests).toEqual([]);
                    expect(messenger.messages).toEqual([]);

                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(uuidMock).not.toHaveBeenCalled();
                }
            );

            const invalidIpAddressCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];
            it.each(invalidIpAddressCases)(
                'should fail if given a %s ip address',
                async (desc, ipAddress) => {
                    const response = await controller.requestLogin({
                        address: 'address',
                        addressType: 'email',
                        ipAddress: ipAddress,
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_ip_address',
                        errorMessage:
                            'The given IP address is invalid. It must be a string.',
                    });

                    expect(store.users).toEqual([]);
                    expect(store.loginRequests).toEqual([]);
                    expect(messenger.messages).toEqual([]);

                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(randomBytesMock).not.toHaveBeenCalled();
                    expect(uuidMock).not.toHaveBeenCalled();
                }
            );
        });
    });

    describe('completeLogin()', () => {
        const cases = [
            ['email', 'test@example.com'] as const,
            ['phone', '+15559321234'] as const,
        ];

        describe.each(cases)('%s', (type, address) => {
            it('should create a new session and return the session token', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 200,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(150);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: true,
                    userId: 'myid',
                    sessionKey: formatV1SessionKey(
                        'myid',
                        fromByteArray(sessionId),
                        fromByteArray(sessionSecret),
                        150 + SESSION_LIFETIME_MS
                    ),
                    connectionKey: formatV1ConnectionKey(
                        'myid',
                        fromByteArray(sessionId),
                        fromByteArray(connectionSecret),
                        150 + SESSION_LIFETIME_MS
                    ),
                    expireTimeMs: 150 + SESSION_LIFETIME_MS,
                    metadata: {
                        hasUserAuthenticator: false,
                        userAuthenticatorCredentialIds: [],
                        hasPushSubscription: false,
                        pushSubscriptionIds: [],
                    },
                });

                expect(randomBytesMock).toHaveBeenCalledTimes(3);
                expect(randomBytesMock).toHaveBeenNthCalledWith(1, 16); // Should request 16 bytes (128 bits) for the session ID
                expect(randomBytesMock).toHaveBeenNthCalledWith(2, 16); // Should request 16 bytes (128 bits) for the session secret
                expect(randomBytesMock).toHaveBeenNthCalledWith(3, 16); // Should request 16 bytes (128 bits) for the connection secret

                expect(store.sessions).toEqual([
                    {
                        userId: 'myid',
                        sessionId: fromByteArray(sessionId),

                        // It should treat session secrets as high-entropy
                        secretHash: hashHighEntropyPasswordWithSalt(
                            fromByteArray(sessionSecret),
                            fromByteArray(sessionId)
                        ),
                        connectionSecret: fromByteArray(connectionSecret),
                        grantedTimeMs: 150,
                        expireTimeMs: 150 + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: requestId,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(store.loginRequests).toEqual([
                    {
                        userId: 'myid',
                        requestId: requestId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            requestId
                        ),
                        expireTimeMs: 200,
                        requestTimeMs: 100,
                        completedTimeMs: 150,
                        attemptCount: 0,
                        address,
                        addressType: type,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(store.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: requestId,
                    },
                ]);
            });

            it('should fail if the request doesnt exist', async () => {
                const response = await controller.completeLogin({
                    userId: 'myid',
                    code: 'abc',
                    requestId: 'def',
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should fail if the code doesnt match', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 200,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(150);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: 'wrong',
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_code',
                    errorMessage: 'The code is invalid.',
                });
                expect(
                    await store.findLoginRequest('myid', requestId)
                ).toHaveProperty('attemptCount', 1);
            });

            it('should fail if the login request has expired', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 200,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(200);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should fail if the login request has been completed', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 1000,
                    requestTimeMs: 100,
                    completedTimeMs: 300,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should fail if the login request has 5 attempts', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 1000,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 5,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should fail if attempting to complete the request from a different IP Address', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 1000,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: 'different',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should fail if another login request was made', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: 'wrong',
                    allSessionRevokeTimeMs: undefined,
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 1000,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should include metadata after login is completed', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);
                const connectionSecret = new Uint8Array([11, 12, 13]);

                await store.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                const findUserLoginMeta = (store.findUserLoginMetadata =
                    jest.fn<Promise<UserLoginMetadata>, [string]>());
                findUserLoginMeta.mockResolvedValueOnce({
                    hasUserAuthenticator: true,
                    userAuthenticatorCredentialIds: ['authenticatorId'],
                    hasPushSubscription: true,
                    pushSubscriptionIds: ['id1', 'id2'],
                });

                await store.saveLoginRequest({
                    userId: 'myid',
                    requestId: requestId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                    expireTimeMs: 200,
                    requestTimeMs: 100,
                    completedTimeMs: null,
                    attemptCount: 0,
                    address,
                    addressType: type,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(150);
                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                const response = await controller.completeLogin({
                    userId: 'myid',
                    requestId: requestId,
                    code: code,
                    ipAddress: '127.0.0.1',
                });

                expect(response).toEqual({
                    success: true,
                    userId: 'myid',
                    sessionKey: formatV1SessionKey(
                        'myid',
                        fromByteArray(sessionId),
                        fromByteArray(sessionSecret),
                        150 + SESSION_LIFETIME_MS
                    ),
                    connectionKey: formatV1ConnectionKey(
                        'myid',
                        fromByteArray(sessionId),
                        fromByteArray(connectionSecret),
                        150 + SESSION_LIFETIME_MS
                    ),
                    expireTimeMs: 150 + SESSION_LIFETIME_MS,
                    metadata: {
                        hasUserAuthenticator: true,
                        userAuthenticatorCredentialIds: ['authenticatorId'],
                        hasPushSubscription: true,
                        pushSubscriptionIds: ['id1', 'id2'],
                    },
                });

                expect(randomBytesMock).toHaveBeenCalledTimes(3);
                expect(randomBytesMock).toHaveBeenNthCalledWith(1, 16); // Should request 16 bytes (128 bits) for the session ID
                expect(randomBytesMock).toHaveBeenNthCalledWith(2, 16); // Should request 16 bytes (128 bits) for the session secret
                expect(randomBytesMock).toHaveBeenNthCalledWith(3, 16); // Should request 16 bytes (128 bits) for the connection secret

                expect(store.sessions).toEqual([
                    {
                        userId: 'myid',
                        sessionId: fromByteArray(sessionId),

                        // It should treat session secrets as high-entropy
                        secretHash: hashHighEntropyPasswordWithSalt(
                            fromByteArray(sessionSecret),
                            fromByteArray(sessionId)
                        ),
                        connectionSecret: fromByteArray(connectionSecret),
                        grantedTimeMs: 150,
                        expireTimeMs: 150 + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: requestId,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(store.loginRequests).toEqual([
                    {
                        userId: 'myid',
                        requestId: requestId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            requestId
                        ),
                        expireTimeMs: 200,
                        requestTimeMs: 100,
                        completedTimeMs: 150,
                        attemptCount: 0,
                        address,
                        addressType: type,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(store.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: requestId,
                    },
                ]);
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'should fail if given a %s userId',
                async (desc, id) => {
                    const response = await controller.completeLogin({
                        userId: id,
                        requestId: 'requestId',
                        code: 'code',
                        ipAddress: 'different',
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given userId is invalid. It must be a string.',
                    });
                    expect(store.sessions).toEqual([]);
                }
            );

            it.each(invalidIdCases)(
                'should fail if given a %s requestId',
                async (desc, id) => {
                    const response = await controller.completeLogin({
                        userId: 'userid',
                        requestId: id,
                        code: 'code',
                        ipAddress: 'different',
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_request_id',
                        errorMessage:
                            'The given requestId is invalid. It must be a string.',
                    });
                    expect(store.sessions).toEqual([]);
                }
            );

            it.each(invalidIdCases)(
                'should fail if given a %s code',
                async (desc, id) => {
                    const response = await controller.completeLogin({
                        userId: 'userid',
                        requestId: 'requestid',
                        code: id,
                        ipAddress: 'different',
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_code',
                        errorMessage:
                            'The given code is invalid. It must be a string.',
                    });
                    expect(store.sessions).toEqual([]);
                }
            );

            it.each(invalidIdCases)(
                'should fail if given a %s ip address',
                async (desc, id) => {
                    const response = await controller.completeLogin({
                        userId: 'userid',
                        requestId: 'requestid',
                        code: 'code',
                        ipAddress: id,
                    });

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_ip_address',
                        errorMessage:
                            'The given IP address is invalid. It must be a string.',
                    });
                    expect(store.sessions).toEqual([]);
                }
            );
        });
    });

    describe('requestPrivoSignUp()', () => {
        const sessionId = new Uint8Array([7, 8, 9]);
        const sessionSecret = new Uint8Array([10, 11, 12]);
        const connectionSecret = new Uint8Array([11, 12, 13]);

        beforeEach(() => {
            // Jan 1, 2023 in miliseconds
            nowMock.mockReturnValue(
                DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis()
            );

            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                // verificationIntegration: 'verificationIntegration',
                // verificationServiceId: 'verificationServiceId',
                // verificationSiteId: 'verificationSiteId',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };
        });

        it('should return not_supported when no privo client is configured', async () => {
            controller = new AuthController(store, messenger, store);

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage:
                    'Privo features are not supported on this server.',
            });
        });

        it('should return not_supported when there is no privo configuration in the store', async () => {
            controller = new AuthController(
                store,
                messenger,
                store,
                undefined,
                privoClient
            );
            store.privoConfiguration = null;

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage:
                    'Privo features are not supported on this server.',
            });
        });

        it('should request that a child be signed up when given a child birth date and a parent email', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'userId',
                updatePasswordUrl: 'link',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                metadata: expect.any(Object),
            });

            expect(privoClientMock.createChildAccount).toHaveBeenCalledWith({
                parentEmail: 'parent@example.com',
                childEmail: 'test@example.com',
                childFirstName: 'test name',
                childDisplayName: 'displayName',
                childDateOfBirth: new Date(2010, 1, 1),
                featureIds: [
                    'childAccount',
                    'joinAndCollaborate',
                    'dev',
                    'publish',
                    'buildaieggs',
                ],
            });
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();

            expect(await store.findUser('userId')).toEqual({
                id: 'userId',
                name: null,
                email: null,
                phoneNumber: null,
                privoServiceId: 'childServiceId',
                privoParentServiceId: 'parentServiceId',
                privoConsentUrl: 'consentUrl',
                currentLoginRequestId: null,
                allSessionRevokeTimeMs: null,
                privacyFeatures: {
                    publishData: false,
                    allowPublicData: false,
                    allowAI: false,
                    allowPublicInsts: false,
                },
            });

            expect(await store.listSessions('userId', Infinity)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),
                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: null,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ],
            });
        });

        it('should return the error from the privo client', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'The request is unacceptable.',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'The request is unacceptable.',
            });
        });

        it('should support child sign ups without an email address', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                email: null,
                displayName: 'displayName',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'userId',
                updatePasswordUrl: 'link',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                metadata: expect.any(Object),
            });

            expect(privoClientMock.createChildAccount).toHaveBeenCalledWith({
                parentEmail: 'parent@example.com',
                childEmail: null,
                childFirstName: 'test name',
                childDisplayName: 'displayName',
                childDateOfBirth: new Date(2010, 1, 1),
                featureIds: [
                    'childAccount',
                    'joinAndCollaborate',
                    'dev',
                    'publish',
                    'buildaieggs',
                ],
            });
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();

            expect(await store.findUser('userId')).toEqual({
                id: 'userId',
                name: null,
                email: null,
                phoneNumber: null,
                privoServiceId: 'childServiceId',
                privoParentServiceId: 'parentServiceId',
                privoConsentUrl: 'consentUrl',
                currentLoginRequestId: null,
                allSessionRevokeTimeMs: null,
                privacyFeatures: {
                    publishData: false,
                    allowPublicData: false,
                    allowAI: false,
                    allowPublicInsts: false,
                },
            });

            expect(await store.listSessions('userId', Infinity)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),
                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: null,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ],
            });
        });

        it('should save the privacy features to the child account', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [
                    {
                        on: true,
                        featureId: 'joinAndCollaborate',
                    },
                    {
                        on: true,
                        featureId: 'publish',
                    },
                    {
                        on: true,
                        featureId: 'dev',
                    },
                    {
                        on: true,
                        featureId: 'buildaieggs',
                    },
                ],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'userId',
                updatePasswordUrl: 'link',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                metadata: expect.any(Object),
            });

            expect(privoClientMock.createChildAccount).toHaveBeenCalledWith({
                parentEmail: 'parent@example.com',
                childEmail: 'test@example.com',
                childFirstName: 'test name',
                childDisplayName: 'displayName',
                childDateOfBirth: new Date(2010, 1, 1),
                featureIds: [
                    'childAccount',
                    'joinAndCollaborate',
                    'dev',
                    'publish',
                    'buildaieggs',
                ],
            });
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();

            expect(await store.findUser('userId')).toEqual({
                id: 'userId',
                name: null,
                email: null,
                phoneNumber: null,
                privoServiceId: 'childServiceId',
                privoParentServiceId: 'parentServiceId',
                privoConsentUrl: 'consentUrl',
                currentLoginRequestId: null,
                allSessionRevokeTimeMs: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });

            expect(await store.listSessions('userId', Infinity)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),
                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: null,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ],
            });
        });

        it('should return a parent_email_required error code when given a child birth date and no parent email', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: null,
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'parent_email_required',
                errorMessage: 'A parent email is required to sign up a child.',
            });

            expect(privoClientMock.createChildAccount).not.toHaveBeenCalled();
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();
        });

        it('should return a unacceptable_request error code when given a child email that matches the parent email', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'test@example.com',
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'The parent email must be different from the child email.',
            });

            expect(privoClientMock.createChildAccount).not.toHaveBeenCalled();
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();
        });

        it('should return a invalid_display_name error code when the display name contains the users name', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createChildAccount.mockResolvedValueOnce({
                success: true,
                parentServiceId: 'parentServiceId',
                childServiceId: 'childServiceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: 'parent@example.com',
                name: 'name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2010, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_display_name',
                errorMessage: 'The display name cannot contain your name.',
            });

            expect(privoClientMock.createChildAccount).not.toHaveBeenCalled();
            expect(privoClientMock.createAdultAccount).not.toHaveBeenCalled();
        });

        it('should request that an adult be signed up when given a adult birth date', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createAdultAccount.mockResolvedValueOnce({
                success: true,
                adultServiceId: 'serviceId',
                features: [],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: null,
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2000, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'userId',
                updatePasswordUrl: 'link',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: expect.any(Object),
            });

            expect(privoClientMock.createAdultAccount).toHaveBeenCalledWith({
                adultEmail: 'test@example.com',
                adultDisplayName: 'displayName',
                adultFirstName: 'test name',
                adultDateOfBirth: new Date(2000, 1, 1),
                featureIds: [
                    'adultAccount',
                    'joinAndCollaborate',
                    'dev',
                    'publish',
                    'buildaieggs',
                ],
            });
            expect(privoClientMock.createChildAccount).not.toHaveBeenCalled();

            expect(await store.findUser('userId')).toEqual({
                id: 'userId',
                name: null,
                email: null,
                phoneNumber: null,
                privoServiceId: 'serviceId',
                privoConsentUrl: 'consentUrl',
                currentLoginRequestId: null,
                allSessionRevokeTimeMs: null,
                privacyFeatures: {
                    publishData: false,
                    allowPublicData: false,
                    allowAI: false,
                    allowPublicInsts: false,
                },
            });

            expect(await store.listSessions('userId', Infinity)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),
                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: null,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ],
            });
        });

        it('should save the privacy features to the adult account', async () => {
            uuidMock.mockReturnValueOnce('userId');

            privoClientMock.createAdultAccount.mockResolvedValueOnce({
                success: true,
                adultServiceId: 'serviceId',
                features: [
                    {
                        on: true,
                        featureId: 'joinAndCollaborate',
                    },
                    {
                        on: true,
                        featureId: 'publish',
                    },
                    {
                        on: true,
                        featureId: 'dev',
                    },
                    {
                        on: true,
                        featureId: 'buildaieggs',
                    },
                ],
                updatePasswordLink: 'link',
                consentUrl: 'consentUrl',
            });

            const result = await controller.requestPrivoSignUp({
                parentEmail: null,
                name: 'test name',
                displayName: 'displayName',
                email: 'test@example.com',
                dateOfBirth: new Date(2000, 1, 1),
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId: 'userId',
                updatePasswordUrl: 'link',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: expect.any(Object),
            });

            expect(privoClientMock.createAdultAccount).toHaveBeenCalledWith({
                adultEmail: 'test@example.com',
                adultDisplayName: 'displayName',
                adultFirstName: 'test name',
                adultDateOfBirth: new Date(2000, 1, 1),
                featureIds: [
                    'adultAccount',
                    'joinAndCollaborate',
                    'dev',
                    'publish',
                    'buildaieggs',
                ],
            });
            expect(privoClientMock.createChildAccount).not.toHaveBeenCalled();

            expect(await store.findUser('userId')).toEqual({
                id: 'userId',
                name: null,
                email: null,
                phoneNumber: null,
                privoServiceId: 'serviceId',
                privoConsentUrl: 'consentUrl',
                currentLoginRequestId: null,
                allSessionRevokeTimeMs: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });

            expect(await store.listSessions('userId', Infinity)).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),
                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: null,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ],
            });
        });
    });

    describe('requestOpenIDLogin()', () => {
        const sessionId = new Uint8Array([7, 8, 9]);
        const sessionSecret = new Uint8Array([10, 11, 12]);
        const connectionSecret = new Uint8Array([11, 12, 13]);

        describe('privo', () => {
            beforeEach(() => {
                // Jan 1, 2023 in miliseconds
                nowMock.mockReturnValue(
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis()
                );

                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };
            });

            it('should return not_supported when no privo client is configured', async () => {
                store.privoConfiguration = null;

                const result = await controller.requestOpenIDLogin({
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                });
            });

            it('should return the redirect URL', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid')
                    .mockReturnValueOnce('uuid2');
                privoClientMock.generateAuthorizationUrl.mockResolvedValueOnce({
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    scope: 'scope',
                });
                const result = await controller.requestOpenIDLogin({
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: true,
                    authorizationUrl: 'https://mock_authorization_url',
                    requestId: 'uuid',
                });

                expect(store.openIdLoginRequests).toEqual([
                    {
                        requestId: 'uuid',
                        state: 'uuid2',
                        provider: 'privo',
                        codeVerifier: 'verifier',
                        codeMethod: 'method',
                        authorizationUrl: 'https://mock_authorization_url',
                        redirectUrl: 'https://redirect_url',
                        scope: 'scope',
                        requestTimeMs: DateTime.utc(
                            2023,
                            1,
                            1,
                            0,
                            0,
                            0
                        ).toMillis(),
                        expireTimeMs:
                            DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() +
                            OPEN_ID_LOGIN_REQUEST_LIFETIME_MS,
                        completedTimeMs: null,
                        ipAddress: '127.0.0.1',
                    },
                ]);

                expect(
                    privoClientMock.generateAuthorizationUrl
                ).toHaveBeenCalledWith('uuid2');
            });

            it('should return an error if the privo client throws an error', async () => {
                privoClientMock.generateAuthorizationUrl.mockRejectedValueOnce(
                    new Error('mock error')
                );
                const result = await controller.requestOpenIDLogin({
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'A server error occurred.',
                });
            });
        });

        it('should return an not_supported error if given an unsupported provider', async () => {
            const result = await controller.requestOpenIDLogin({
                provider: 'unsupported',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'The given provider is not supported.',
            });
        });
    });

    describe('requestWebAuthnRegistration()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 1,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);
        });

        it('should return the generated options', async () => {
            const response = (await controller.requestWebAuthnRegistration({
                userId,
                originOrHost: relyingParty.origin,
            })) as RequestWebAuthnRegistrationSuccess;

            expect(response).toEqual({
                success: true,
                options: {
                    challenge: expect.any(String),
                    rp: {
                        name: relyingParty.name,
                        id: relyingParty.id,
                    },
                    user: {
                        id: userId,
                        name: 'email',
                        displayName: 'email',
                    },
                    pubKeyCredParams: [
                        {
                            alg: -8,
                            type: 'public-key',
                        },
                        {
                            alg: -7,
                            type: 'public-key',
                        },
                        {
                            alg: -257,
                            type: 'public-key',
                        },
                    ],
                    timeout: 60000,
                    attestation: 'none',
                    excludeCredentials: [],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        requireResidentKey: false,
                        residentKey: 'preferred',
                        userVerification: 'preferred',
                    },
                    extensions: {
                        credProps: true,
                    },
                },
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(
                response.options.challenge
            );
        });

        it('should work when not given an origin', async () => {
            const response = (await controller.requestWebAuthnRegistration({
                userId,
                originOrHost: null,
            })) as RequestWebAuthnRegistrationSuccess;

            expect(response).toEqual({
                success: true,
                options: {
                    challenge: expect.any(String),
                    rp: {
                        name: relyingParty.name,
                        id: relyingParty.id,
                    },
                    user: {
                        id: userId,
                        name: 'email',
                        displayName: 'email',
                    },
                    pubKeyCredParams: [
                        {
                            alg: -8,
                            type: 'public-key',
                        },
                        {
                            alg: -7,
                            type: 'public-key',
                        },
                        {
                            alg: -257,
                            type: 'public-key',
                        },
                    ],
                    timeout: 60000,
                    attestation: 'none',
                    excludeCredentials: [],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        requireResidentKey: false,
                        residentKey: 'preferred',
                        userVerification: 'preferred',
                    },
                    extensions: {
                        credProps: true,
                    },
                },
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(
                response.options.challenge
            );
        });

        it('should return not_supported if no relying party has been configured', async () => {
            controller.relyingParties = [];
            const response = await controller.requestWebAuthnRegistration({
                userId,
                originOrHost: relyingParty.origin,
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'WebAuthn is not supported on this server.',
            });
        });

        it('should return invalid_origin if the request comes from a wrong origin', async () => {
            const response = await controller.requestWebAuthnRegistration({
                userId,
                originOrHost: 'wrong',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'invalid_origin',
                errorMessage:
                    'The request must be made from an authorized origin.',
            });
        });
    });

    describe('completeWebAuthnRegistration()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 1,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);
        });

        it('should complete the registration', async () => {
            uuidMock.mockReturnValueOnce('authenticatorId');
            verifyRegistrationResponseMock.mockResolvedValueOnce({
                verified: true,
                registrationInfo: {
                    credentialID: new Uint8Array([1, 2, 3]),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    origin: relyingParty.origin,
                    userVerified: true,
                    credentialBackedUp: false,
                    credentialDeviceType: 'singleDevice',
                    credentialType: 'public-key',
                    attestationObject: new Uint8Array([7, 8, 9]),
                    aaguid: 'aaguid',
                    fmt: 'tpm',
                    authenticatorExtensionResults: {},
                    rpID: relyingParty.id,
                },
            });
            const response = await controller.completeWebAuthnRegistration({
                userId,
                response: {
                    id: 'id',
                    rawId: 'rawId',
                    response: {
                        attestationObject: 'attestation',
                        clientDataJSON: 'clientDataJSON',
                        authenticatorData: 'authenticatorData',
                        publicKey: 'publicKey',
                        publicKeyAlgorithm: -7,
                        transports: ['usb'],
                    },
                    clientExtensionResults: {},
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: relyingParty.origin,
                userAgent: 'ua',
            });

            expect(response).toEqual({
                success: true,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(null);

            const authenticators = await store.listUserAuthenticators(userId);

            expect(authenticators).toEqual([
                {
                    id: 'authenticatorId',
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    credentialDeviceType: 'singleDevice',
                    credentialBackedUp: false,
                    transports: ['usb'],
                    aaguid: 'aaguid',
                    registeringUserAgent: 'ua',
                    createdAtMs: 400,
                },
            ]);
        });

        it('should work when not given an origin', async () => {
            uuidMock.mockReturnValueOnce('authenticatorId');
            verifyRegistrationResponseMock.mockResolvedValueOnce({
                verified: true,
                registrationInfo: {
                    credentialID: new Uint8Array([1, 2, 3]),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    origin: relyingParty.origin,
                    userVerified: true,
                    credentialBackedUp: false,
                    credentialDeviceType: 'singleDevice',
                    credentialType: 'public-key',
                    attestationObject: new Uint8Array([7, 8, 9]),
                    aaguid: 'aaguid',
                    fmt: 'tpm',
                    authenticatorExtensionResults: {},
                    rpID: relyingParty.id,
                },
            });
            const response = await controller.completeWebAuthnRegistration({
                userId,
                response: {
                    id: 'id',
                    rawId: 'rawId',
                    response: {
                        attestationObject: 'attestation',
                        clientDataJSON: 'clientDataJSON',
                        authenticatorData: 'authenticatorData',
                        publicKey: 'publicKey',
                        publicKeyAlgorithm: -7,
                        transports: ['usb'],
                    },
                    clientExtensionResults: {},
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },

                // Non-cross-origin requests don't include the origin header
                originOrHost: null,
                userAgent: 'ua',
            });

            expect(response).toEqual({
                success: true,
            });

            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBe(null);

            const authenticators = await store.listUserAuthenticators(userId);

            expect(authenticators).toEqual([
                {
                    id: 'authenticatorId',
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    counter: 100,
                    credentialDeviceType: 'singleDevice',
                    credentialBackedUp: false,
                    transports: ['usb'],
                    aaguid: 'aaguid',
                    registeringUserAgent: 'ua',
                    createdAtMs: 400,
                },
            ]);
        });

        it('should return not_supported if no relying party has been configured', async () => {
            controller.relyingParties = [];
            const response = await controller.completeWebAuthnRegistration({
                userId,
                response: {} as any,
                originOrHost: relyingParty.origin,
                userAgent: 'ua',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'WebAuthn is not supported on this server.',
            });
        });

        it('should return invalid_origin if the request comes from a wrong origin', async () => {
            const response = await controller.completeWebAuthnRegistration({
                userId,
                response: {} as any,
                originOrHost: 'wrong',
                userAgent: 'ua',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'invalid_origin',
                errorMessage:
                    'The request must be made from an authorized origin.',
            });
        });
    });

    describe('requestWebAuthnLogin()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 1,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);
        });

        it('should return the generated options', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            const response = (await controller.requestWebAuthnLogin({
                ipAddress: '123.456.789',
                originOrHost: relyingParty.origin,
            })) as RequestWebAuthnLoginSuccess;

            expect(response).toEqual({
                success: true,
                requestId: 'requestId',
                options: {
                    userVerification: 'preferred',
                    allowCredentials: undefined,
                    rpId: relyingParty.id,
                    challenge: expect.any(String),
                    timeout: 60000,
                },
            });

            // Requesting a login should not change the currentWebAuthnChallenge
            // because logging in can use the conditional UI flow.
            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBeFalsy();

            const loginRequest = await store.findWebAuthnLoginRequest(
                'requestId'
            );
            expect(loginRequest).toEqual({
                requestId: 'requestId',
                userId: null,
                challenge: response.options.challenge,
                requestTimeMs: 400,
                expireTimeMs: 400 + LOGIN_REQUEST_LIFETIME_MS,
                completedTimeMs: null,
                ipAddress: '123.456.789',
            });
        });

        it('should work when not given an origin', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            const response = (await controller.requestWebAuthnLogin({
                ipAddress: '123.456.789',

                // non-cross-origin requests don't include the origin header
                originOrHost: null,
            })) as RequestWebAuthnLoginSuccess;

            expect(response).toEqual({
                success: true,
                requestId: 'requestId',
                options: {
                    userVerification: 'preferred',
                    allowCredentials: undefined,
                    rpId: relyingParty.id,
                    challenge: expect.any(String),
                    timeout: 60000,
                },
            });

            // Requesting a login should not change the currentWebAuthnChallenge
            // because logging in can use the conditional UI flow.
            const user = await store.findUser(userId);
            expect(user.currentWebAuthnChallenge).toBeFalsy();

            const loginRequest = await store.findWebAuthnLoginRequest(
                'requestId'
            );
            expect(loginRequest).toEqual({
                requestId: 'requestId',
                userId: null,
                challenge: response.options.challenge,
                requestTimeMs: 400,
                expireTimeMs: 400 + LOGIN_REQUEST_LIFETIME_MS,
                completedTimeMs: null,
                ipAddress: '123.456.789',
            });
        });

        it('should return a not_supported result if no relying party is configured', async () => {
            controller.relyingParties = [];
            const response = await controller.requestWebAuthnLogin({
                ipAddress: '123.456.789',
                originOrHost: relyingParty.origin,
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'WebAuthn is not supported on this server.',
            });
        });

        it('should return a invalid_origin result if the request comes from the wrong origin', async () => {
            const response = await controller.requestWebAuthnLogin({
                ipAddress: '123.456.789',
                originOrHost: 'wrong',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'invalid_origin',
                errorMessage:
                    'The request must be made from an authorized origin.',
            });
        });
    });

    describe('completeWebAuthnLogin()', () => {
        const userId = 'myid';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            nowMock.mockReturnValue(400);
        });

        it('should return the generated options', async () => {
            const requestId = 'requestId';
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);
            uuidMock.mockReturnValueOnce('sessionId');
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: 1000,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '',
                registeringUserAgent: 'ua',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {
                    newCounter: 1,
                    credentialBackedUp: true,
                    credentialDeviceType: 'singleDevice',
                    credentialID: new Uint8Array([1, 2, 3]),
                    origin: relyingParty.origin,
                    rpID: relyingParty.id,
                    userVerified: true,
                },
            });

            const response = await controller.completeWebAuthnLogin({
                requestId: requestId,
                ipAddress: '123.456.789',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: relyingParty.origin,
            });

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: formatV1SessionKey(
                    'myid',
                    fromByteArray(sessionId),
                    fromByteArray(sessionSecret),
                    400 + SESSION_LIFETIME_MS
                ),
                connectionKey: formatV1ConnectionKey(
                    'myid',
                    fromByteArray(sessionId),
                    fromByteArray(connectionSecret),
                    400 + SESSION_LIFETIME_MS
                ),
                expireTimeMs: 400 + SESSION_LIFETIME_MS,
                metadata: {
                    hasUserAuthenticator: true,
                    userAuthenticatorCredentialIds: ['authenticatorId'],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            expect(randomBytesMock).toHaveBeenCalledTimes(3);
            expect(randomBytesMock).toHaveBeenNthCalledWith(1, 16); // Should request 16 bytes (128 bits) for the session ID
            expect(randomBytesMock).toHaveBeenNthCalledWith(2, 16); // Should request 16 bytes (128 bits) for the session secret
            expect(randomBytesMock).toHaveBeenNthCalledWith(3, 16); // Should request 16 bytes (128 bits) for the connection secret

            expect(store.sessions).toEqual([
                {
                    userId: 'myid',
                    sessionId: fromByteArray(sessionId),

                    // It should treat session secrets as high-entropy
                    secretHash: hashHighEntropyPasswordWithSalt(
                        fromByteArray(sessionSecret),
                        fromByteArray(sessionId)
                    ),
                    connectionSecret: fromByteArray(connectionSecret),
                    grantedTimeMs: 400,
                    expireTimeMs: 400 + SESSION_LIFETIME_MS,
                    revokeTimeMs: null,
                    requestId: null,
                    oidRequestId: null,
                    webauthnRequestId: 'requestId',
                    previousSessionId: null,
                    nextSessionId: null,
                    ipAddress: '123.456.789',
                },
            ]);
            expect(store.webauthnLoginRequests).toEqual([
                {
                    userId: 'myid',
                    challenge: 'challenge',
                    requestId: requestId,
                    requestTimeMs: 300,
                    expireTimeMs: 1000,
                    completedTimeMs: 400,
                    ipAddress: '123.456.789',
                },
            ]);
            expect(store.users).toEqual([
                {
                    id: 'myid',
                    email: 'email',
                    phoneNumber: 'phonenumber',
                },
            ]);

            expect(
                await store.findUserAuthenticatorByCredentialId(
                    fromByteArray(new Uint8Array([1, 2, 3]))
                )
            ).toEqual({
                authenticator: {
                    id: 'authenticatorId',
                    userId: userId,
                    credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                    counter: 1,
                    credentialBackedUp: true,
                    credentialDeviceType: 'singleDevice',
                    credentialPublicKey: new Uint8Array([4, 5, 6]),
                    transports: ['usb'],
                    aaguid: '',
                    registeringUserAgent: 'ua',
                    createdAtMs: 100,
                },
                user: {
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                },
            });
        });

        it('should work if not given an origin', async () => {
            const requestId = 'requestId';
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);
            uuidMock.mockReturnValueOnce('sessionId');
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: 1000,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '',
                registeringUserAgent: 'ua',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const response = await controller.completeWebAuthnLogin({
                requestId: requestId,
                ipAddress: '123.456.789',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: null,
            });

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: formatV1SessionKey(
                    'myid',
                    fromByteArray(sessionId),
                    fromByteArray(sessionSecret),
                    400 + SESSION_LIFETIME_MS
                ),
                connectionKey: formatV1ConnectionKey(
                    'myid',
                    fromByteArray(sessionId),
                    fromByteArray(connectionSecret),
                    400 + SESSION_LIFETIME_MS
                ),
                expireTimeMs: 400 + SESSION_LIFETIME_MS,
                metadata: {
                    hasUserAuthenticator: true,
                    userAuthenticatorCredentialIds: ['authenticatorId'],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            expect(randomBytesMock).toHaveBeenCalledTimes(3);
            expect(randomBytesMock).toHaveBeenNthCalledWith(1, 16); // Should request 16 bytes (128 bits) for the session ID
            expect(randomBytesMock).toHaveBeenNthCalledWith(2, 16); // Should request 16 bytes (128 bits) for the session secret
            expect(randomBytesMock).toHaveBeenNthCalledWith(3, 16); // Should request 16 bytes (128 bits) for the connection secret

            expect(store.sessions).toEqual([
                {
                    userId: 'myid',
                    sessionId: fromByteArray(sessionId),

                    // It should treat session secrets as high-entropy
                    secretHash: hashHighEntropyPasswordWithSalt(
                        fromByteArray(sessionSecret),
                        fromByteArray(sessionId)
                    ),
                    connectionSecret: fromByteArray(connectionSecret),
                    grantedTimeMs: 400,
                    expireTimeMs: 400 + SESSION_LIFETIME_MS,
                    revokeTimeMs: null,
                    requestId: null,
                    oidRequestId: null,
                    webauthnRequestId: 'requestId',
                    previousSessionId: null,
                    nextSessionId: null,
                    ipAddress: '123.456.789',
                },
            ]);
            expect(store.webauthnLoginRequests).toEqual([
                {
                    userId: 'myid',
                    challenge: 'challenge',
                    requestId: requestId,
                    requestTimeMs: 300,
                    expireTimeMs: 1000,
                    completedTimeMs: 400,
                    ipAddress: '123.456.789',
                },
            ]);
            expect(store.users).toEqual([
                {
                    id: 'myid',
                    email: 'email',
                    phoneNumber: 'phonenumber',
                },
            ]);
        });

        it('should reject the login if the user is banned', async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
                banTimeMs: 300,
            });

            const requestId = 'requestId';
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([11, 12, 13]);
            uuidMock.mockReturnValueOnce('sessionId');
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            await store.saveWebAuthnLoginRequest({
                requestId: requestId,
                challenge: 'challenge',
                requestTimeMs: 300,
                expireTimeMs: 1000,
                completedTimeMs: null,
                ipAddress: '123.456.789',
                userId: null,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '',
                registeringUserAgent: 'ua',
                createdAtMs: 100,
            });

            verifyAuthenticationResponseMock.mockResolvedValueOnce({
                verified: true,
                authenticationInfo: {} as any,
            });

            const response = await controller.completeWebAuthnLogin({
                requestId: requestId,
                ipAddress: '123.456.789',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: relyingParty.origin,
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'user_is_banned',
                errorMessage: 'The user has been banned.',
            });

            expect(randomBytesMock).not.toHaveBeenCalled();
            expect(store.sessions).toEqual([]);
        });

        it('should return a not_supported result if no relying party is configured', async () => {
            controller.relyingParties = [];
            const response = await controller.completeWebAuthnLogin({
                requestId: 'requestId',
                ipAddress: '123.456.789',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: relyingParty.origin,
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'WebAuthn is not supported on this server.',
            });
        });

        it('should return a invalid_origin result if the request comes from the wrong origin', async () => {
            const response = await controller.completeWebAuthnLogin({
                requestId: 'requestId',
                ipAddress: '123.456.789',
                response: {
                    id: fromByteArray(new Uint8Array([1, 2, 3])),
                    rawId: 'rawId',
                    clientExtensionResults: {},
                    response: {
                        authenticatorData: 'authenticatorData',
                        clientDataJSON: 'clientDataJSON',
                        signature: 'signature',
                    },
                    type: 'public-key',
                    authenticatorAttachment: 'platform',
                },
                originOrHost: 'wrong',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'invalid_origin',
                errorMessage:
                    'The request must be made from an authorized origin.',
            });
        });
    });

    describe('listUserAuthenticators()', () => {
        const userId = 'myid';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua1',
                createdAtMs: 400,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua2',
                createdAtMs: 400,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId3',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4, 5])),
                credentialPublicKey: new Uint8Array([4, 5, 6, 7, 8]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua3',
                createdAtMs: 400,
            });

            nowMock.mockReturnValue(400);
        });

        it('should return the list of authenticators that are registered for the user', async () => {
            const response = await controller.listUserAuthenticators(userId);

            expect(response).toEqual({
                success: true,
                authenticators: [
                    {
                        id: 'authenticatorId',
                        counter: 0,
                        credentialBackedUp: true,
                        credentialDeviceType: 'singleDevice',
                        credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                        transports: ['usb'],
                        aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                        registeringUserAgent: 'ua1',
                        createdAtMs: 400,
                        userId: userId,
                    },
                    {
                        id: 'authenticatorId2',
                        counter: 0,
                        credentialBackedUp: true,
                        credentialDeviceType: 'singleDevice',
                        credentialId: fromByteArray(
                            new Uint8Array([1, 2, 3, 4])
                        ),
                        transports: ['usb'],
                        aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                        registeringUserAgent: 'ua2',
                        createdAtMs: 400,
                        userId: userId,
                    },
                    {
                        id: 'authenticatorId3',
                        counter: 0,
                        credentialBackedUp: true,
                        credentialDeviceType: 'singleDevice',
                        credentialId: fromByteArray(
                            new Uint8Array([1, 2, 3, 4, 5])
                        ),
                        transports: ['usb'],
                        aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                        registeringUserAgent: 'ua3',
                        createdAtMs: 400,
                        userId: userId,
                    },
                ],
            });
        });
    });

    describe('deleteUserAuthenticator()', () => {
        const userId = 'myid';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3])),
                credentialPublicKey: new Uint8Array([4, 5, 6]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua1',
                createdAtMs: 400,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId2',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4])),
                credentialPublicKey: new Uint8Array([4, 5, 6, 7]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua2',
                createdAtMs: 400,
            });

            await store.saveUserAuthenticator({
                id: 'authenticatorId3',
                userId: userId,
                counter: 0,
                credentialBackedUp: true,
                credentialDeviceType: 'singleDevice',
                credentialId: fromByteArray(new Uint8Array([1, 2, 3, 4, 5])),
                credentialPublicKey: new Uint8Array([4, 5, 6, 7, 8]),
                transports: ['usb'],
                aaguid: '771b48fd-d3d4-4f74-9232-fc157ab0507a',
                registeringUserAgent: 'ua3',
                createdAtMs: 400,
            });

            nowMock.mockReturnValue(400);
        });

        it('should delete the given user authenticator', async () => {
            expect(store.userAuthenticators).toHaveLength(3);

            const response = await controller.deleteUserAuthenticator(
                userId,
                'authenticatorId3'
            );

            expect(response).toEqual({
                success: true,
            });

            expect(store.userAuthenticators).toHaveLength(2);
        });

        it('should return authenticator_not_found if the authenticator doesnt exist', async () => {
            const response = await controller.deleteUserAuthenticator(
                userId,
                'missingId'
            );

            expect(response).toEqual({
                success: false,
                errorCode: 'not_found',
                errorMessage: 'The given authenticator was not found.',
            });
        });
    });

    describe('processOpenIDAuthorizationCode()', () => {
        describe('privo', () => {
            beforeEach(() => {
                // Jan 1, 2023 in miliseconds
                nowMock.mockReturnValue(
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis()
                );

                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };
            });

            it('should return not_supported when no privo client is configured', async () => {
                store.privoConfiguration = null;

                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage:
                        'Privo features are not supported on this server.',
                });
            });

            it('should save the info to the request', async () => {
                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    redirectUrl: 'https://redirect_url',
                    authorizationUrl: 'https://mock_authorization_url',
                    codeMethod: 'method',
                    codeVerifier: 'verifier',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    completedTimeMs: null,
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(store.openIdLoginRequests).toEqual([
                    {
                        requestId: 'requestId',
                        state: 'state',
                        redirectUrl: 'https://redirect_url',
                        authorizationUrl: 'https://mock_authorization_url',
                        codeMethod: 'method',
                        codeVerifier: 'verifier',
                        requestTimeMs: Date.now() - 100,
                        expireTimeMs: Date.now() + 100,
                        completedTimeMs: null,
                        provider: PRIVO_OPEN_ID_PROVIDER,
                        scope: 'scope1 scope2',
                        ipAddress: '127.0.0.1',
                        authorizationCode: 'code',
                        authorizationTimeMs: Date.now(),
                    },
                ]);
            });

            it('should return an error if the request already is authorized', async () => {
                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    redirectUrl: 'https://redirect_url',
                    authorizationUrl: 'https://mock_authorization_url',
                    codeMethod: 'method',
                    codeVerifier: 'verifier',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    completedTimeMs: null,
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                    ipAddress: '127.0.0.1',
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                });

                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The authorization request is invalid.',
                });
            });

            it('should return an error if the request already is complete', async () => {
                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    redirectUrl: 'https://redirect_url',
                    authorizationUrl: 'https://mock_authorization_url',
                    codeMethod: 'method',
                    codeVerifier: 'verifier',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                    ipAddress: '127.0.0.1',
                    completedTimeMs: Date.now(),
                });

                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The authorization request is invalid.',
                });
            });

            it('should return an error if the request expired', async () => {
                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    redirectUrl: 'https://redirect_url',
                    authorizationUrl: 'https://mock_authorization_url',
                    codeMethod: 'method',
                    codeVerifier: 'verifier',
                    requestTimeMs: Date.now() - 200,
                    expireTimeMs: Date.now() - 100,
                    completedTimeMs: null,
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The authorization request is invalid.',
                });
            });

            it('should return an error if the request is missing', async () => {
                const result = await controller.processOpenIDAuthorizationCode({
                    state: 'state',
                    authorizationCode: 'code',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The authorization request is invalid.',
                });
            });
        });
    });

    describe('completeOpenIDLogin()', () => {
        const sessionId = new Uint8Array([7, 8, 9]);
        const sessionSecret = new Uint8Array([10, 11, 12]);
        const connectionSecret = new Uint8Array([11, 12, 13]);

        describe('privo', () => {
            beforeEach(() => {
                // Jan 1, 2023 in miliseconds
                nowMock.mockReturnValue(
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis()
                );

                randomBytesMock
                    .mockReturnValueOnce(sessionId)
                    .mockReturnValueOnce(sessionSecret)
                    .mockReturnValueOnce(connectionSecret);

                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };
            });

            it('should return the login info for the user', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: true,
                    userId: 'userId',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                    metadata: {
                        hasUserAuthenticator: false,
                        userAuthenticatorCredentialIds: [],
                        hasPushSubscription: false,
                        pushSubscriptionIds: [],
                    },
                });

                expect(await store.findOpenIDLoginRequest('requestId')).toEqual(
                    {
                        requestId: 'requestId',
                        state: 'state',
                        authorizationUrl: 'https://mock_authorization_url',
                        redirectUrl: 'https://redirect_url',
                        codeVerifier: 'verifier',
                        codeMethod: 'method',
                        requestTimeMs:
                            DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                        expireTimeMs:
                            DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                        authorizationCode: 'code',
                        authorizationTimeMs: Date.now(),
                        completedTimeMs: Date.now(),
                        ipAddress: '127.0.0.1',
                        provider: PRIVO_OPEN_ID_PROVIDER,
                        scope: 'scope1 scope2',
                    }
                );

                expect(store.sessions).toEqual([
                    {
                        userId: 'userId',
                        sessionId: fromByteArray(sessionId),
                        requestId: null,
                        oidRequestId: 'requestId',
                        oidProvider: 'privo',
                        oidAccessToken: 'accessToken',
                        oidRefreshToken: 'refreshToken',
                        oidIdToken: 'idToken',
                        oidTokenType: 'Bearer',
                        oidExpiresAtMs: Date.now() + 1000 * 1000,
                        oidScope: 'scope1 scope2',
                        secretHash: expect.any(String),
                        connectionSecret: expect.any(String),

                        grantedTimeMs: Date.now(),
                        expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,

                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ]);

                expect(await store.findUser('userId')).toEqual({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',

                    // Should save the privacy features
                    privacyFeatures: {
                        publishData: false,
                        allowPublicData: false,
                        allowAI: false,
                        allowPublicInsts: false,
                    },
                });

                expect(
                    privoClientMock.processAuthorizationCallback
                ).toHaveBeenCalledWith({
                    code: 'code',
                    state: 'state',
                    codeVerifier: 'verifier',
                    redirectUrl: 'https://redirect_url',
                });
            });

            it('should save the privacy features for the user', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'joinAndCollaborate',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'publish',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'dev',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'buildaieggs',
                                    active: true,
                                    category: 'Standard',
                                },
                            ],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: true,
                    userId: 'userId',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                    metadata: {
                        hasUserAuthenticator: false,
                        userAuthenticatorCredentialIds: [],
                        hasPushSubscription: false,
                        pushSubscriptionIds: [],
                    },
                });

                expect(await store.findUser('userId')).toEqual({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',

                    // Should save the privacy features
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                });

                expect(
                    privoClientMock.processAuthorizationCallback
                ).toHaveBeenCalledWith({
                    code: 'code',
                    state: 'state',
                    codeVerifier: 'verifier',
                    redirectUrl: 'https://redirect_url',
                });
            });

            it('should support adult roles', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'adultRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'joinAndCollaborate',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'publish',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'dev',
                                    active: true,
                                    category: 'Standard',
                                },
                                {
                                    on: true,
                                    consentDateSeconds: 1234567890,
                                    featureId: 'buildaieggs',
                                    active: true,
                                    category: 'Standard',
                                },
                            ],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: true,
                    userId: 'userId',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    expireTimeMs: Date.now() + SESSION_LIFETIME_MS,
                    metadata: {
                        hasUserAuthenticator: false,
                        userAuthenticatorCredentialIds: [],
                        hasPushSubscription: false,
                        pushSubscriptionIds: [],
                    },
                });

                expect(await store.findUser('userId')).toEqual({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',

                    // Should save the privacy features
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                });

                expect(
                    privoClientMock.processAuthorizationCallback
                ).toHaveBeenCalledWith({
                    code: 'code',
                    state: 'state',
                    codeVerifier: 'verifier',
                    redirectUrl: 'https://redirect_url',
                });
            });

            it('should return invalid_request if it has expired', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    requestId: 'requestId',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return not_completed if no authorization code has been saved', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 100,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    requestId: 'requestId',
                    ipAddress: '127.0.0.1',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_completed',
                    errorMessage: 'The login request has not been completed.',
                });
            });

            it('should return invalid_request if it has already been completed', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: 1,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if the request is from a different IP address', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: 'wrong',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if the request is for a non-privo provider', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: 'wrong',
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if a user cannot be found', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if the user has a different service ID', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'DIFFERENT',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() - 200,
                    expireTimeMs:
                        DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if the login request doesnt exist', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'childRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The login request is invalid.',
                });
            });

            it('should return invalid_request if the user has a parent role', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'parentRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        "The login request is invalid. You attempted to sign into an account that is associated with a parent email address. This is not allowed because we don't ask consent for parent accounts, but all accounts must have consent. Please sign up with a new account instead.",
                });
            });

            it('should return invalid_request if the user has an unknown role', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                privoClientMock.processAuthorizationCallback.mockResolvedValueOnce(
                    {
                        accessToken: 'accessToken',
                        refreshToken: 'refreshToken',
                        tokenType: 'Bearer',
                        idToken: 'idToken',
                        expiresIn: 1000,

                        userInfo: {
                            roleIdentifier: 'unknownRole',
                            serviceId: 'serviceId',
                            email: 'test@example.com',
                            emailVerified: true,
                            givenName: 'name',
                            locale: 'en-US',
                            permissions: [],
                            displayName: 'displayName',
                        },
                    }
                );

                await store.saveNewUser({
                    id: 'userId',
                    email: 'test@example.com',
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',
                });

                await store.saveOpenIDLoginRequest({
                    requestId: 'requestId',
                    state: 'state',
                    authorizationUrl: 'https://mock_authorization_url',
                    redirectUrl: 'https://redirect_url',
                    codeVerifier: 'verifier',
                    codeMethod: 'method',
                    requestTimeMs: Date.now() - 100,
                    expireTimeMs: Date.now() + 100,
                    authorizationCode: 'code',
                    authorizationTimeMs: Date.now(),
                    completedTimeMs: null,
                    ipAddress: '127.0.0.1',
                    provider: PRIVO_OPEN_ID_PROVIDER,
                    scope: 'scope1 scope2',
                });

                const result = await controller.completeOpenIDLogin({
                    ipAddress: '127.0.0.1',
                    requestId: 'requestId',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        "The login request is invalid. You attempted to sign into an account that is associated with a parent email address. This is not allowed because we don't ask consent for parent accounts, but all accounts must have consent. Please sign up with a new account instead.",
                });
            });
        });
    });

    describe('validateSessionKey()', () => {
        describe('v1 keys', () => {
            beforeEach(async () => {
                await store.saveUser({
                    id: 'myid',
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                });
                nowMock.mockReturnValue(101);
            });

            describe('v1 hashes', () => {
                it('should return the User ID if given a valid key', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                    });
                });

                it('should allow session keys that dont expire', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        Infinity
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: null,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                    });
                });

                it('should include the user role', async () => {
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                        role: 'superUser',
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        role: 'superUser',
                    });
                });

                it('should fail if the session secret doesnt match the hash', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        'wrong',
                        123
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_key',
                        errorMessage: INVALID_KEY_ERROR_MESSAGE,
                    });
                });

                it('should include the users subscription tier', async () => {
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                        subscriptionId: 'sub_2',
                        subscriptionStatus: 'active',
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        subscriptionTier: 'alpha',
                        subscriptionId: 'sub_2',
                    });
                });

                it('should use the default subscription if the user doesnt have one', async () => {
                    store.subscriptionConfiguration.subscriptions[1].defaultSubscription =
                        true;
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashLowEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        subscriptionTier: 'beta',
                        subscriptionId: 'sub_1',
                    });
                });
            });

            describe('v2 hashes', () => {
                it('should return the User ID if given a valid key', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                    });
                });

                it('should allow sessions that dont expire', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        Infinity
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: null,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                    });
                });

                it('should include the user role', async () => {
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                        role: 'superUser',
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        role: 'superUser',
                    });
                });

                it('should fail if the session secret doesnt match the hash', async () => {
                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        'wrong',
                        123
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_key',
                        errorMessage: INVALID_KEY_ERROR_MESSAGE,
                    });
                });

                it('should include the users subscription tier', async () => {
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                        subscriptionId: 'sub_2',
                        subscriptionStatus: 'active',
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        subscriptionTier: 'alpha',
                        subscriptionId: 'sub_2',
                    });
                });

                it('should use the default subscription if the user doesnt have one', async () => {
                    store.subscriptionConfiguration.subscriptions[1].defaultSubscription =
                        true;
                    await store.saveUser({
                        id: 'myid',
                        email: 'email',
                        phoneNumber: 'phonenumber',
                        allSessionRevokeTimeMs: undefined,
                        currentLoginRequestId: undefined,
                    });

                    const requestId = 'requestId';
                    const sessionId = toBase64String('sessionId');
                    const code = 'code';
                    const userId = 'myid';

                    const sessionKey = formatV1SessionKey(
                        userId,
                        sessionId,
                        code,
                        200
                    );

                    await store.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
                        connectionSecret: code,
                        expireTimeMs: 200,
                        grantedTimeMs: 100,
                        previousSessionId: null,
                        nextSessionId: null,
                        revokeTimeMs: null,
                        userId,
                        ipAddress: '127.0.0.1',
                    });

                    const result = await controller.validateSessionKey(
                        sessionKey
                    );

                    expect(result).toEqual({
                        success: true,
                        userId: userId,
                        sessionId: sessionId,
                        subscriptionTier: 'beta',
                        subscriptionId: 'sub_1',
                    });
                });
            });

            it('should fail if the key is malformed', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = 'wrong';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                });
            });

            it('should fail if the session has expired', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    code,
                    999
                );

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'session_expired',
                    errorMessage: 'The session has expired.',
                });
            });

            it('should fail if the session has been revoked', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    code,
                    1000
                );

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: 1000,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: 300,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should fail if the session was granted before all session were revoked', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    code,
                    999
                );

                await store.saveUser({
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: 101,
                    currentLoginRequestId: requestId,
                });

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: 1000,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                nowMock.mockReturnValue(400);

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should work if the session was granted before all sessions were revoked but the session is not revocable and also doesnt have a revoke time', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    code,
                    999
                );

                await store.saveUser({
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: 101,
                    currentLoginRequestId: requestId,
                });

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: 1000,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                    revocable: false,
                });

                nowMock.mockReturnValue(400);

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    allSessionsRevokedTimeMs: 101,
                });
            });
        });

        it('should work with sessions created by completeLogin()', async () => {
            const address = 'myAddress';
            const addressType = 'email';
            const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
            const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([13, 14, 15]);

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
            });

            await store.saveLoginRequest({
                userId: 'myid',
                requestId: requestId,
                secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                expireTimeMs: 200,
                requestTimeMs: 100,
                completedTimeMs: null,
                attemptCount: 0,
                address,
                addressType,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            const validateResponse = await controller.validateSessionKey(
                response.sessionKey
            );

            expect(validateResponse).toEqual({
                success: true,
                userId: 'myid',
                sessionId: fromByteArray(sessionId),
            });
        });

        it('should return the privacy features that the user has enabled', async () => {
            const address = 'myAddress';
            const addressType = 'email';
            const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
            const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([13, 14, 15]);

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });

            await store.saveLoginRequest({
                userId: 'myid',
                requestId: requestId,
                secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                expireTimeMs: 200,
                requestTimeMs: 100,
                completedTimeMs: null,
                attemptCount: 0,
                address,
                addressType,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            const validateResponse = await controller.validateSessionKey(
                response.sessionKey
            );

            expect(validateResponse).toEqual({
                success: true,
                userId: 'myid',
                sessionId: fromByteArray(sessionId),
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });
        });

        it('should reject users who are banned', async () => {
            const address = 'myAddress';
            const addressType = 'email';
            const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
            const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([13, 14, 15]);

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
            });

            await store.saveLoginRequest({
                userId: 'myid',
                requestId: requestId,
                secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                expireTimeMs: 200,
                requestTimeMs: 100,
                completedTimeMs: null,
                attemptCount: 0,
                address,
                addressType,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
                banTimeMs: 1,
                banReason: 'terms_of_service_violation',
            });

            const validateResponse = await controller.validateSessionKey(
                response.sessionKey
            );

            expect(validateResponse).toEqual({
                success: false,
                errorCode: 'user_is_banned',
                errorMessage: 'The user has been banned.',
                banReason: 'terms_of_service_violation',
            });
        });

        describe('data validation', () => {
            const invalidKeyCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];
            it.each(invalidKeyCases)(
                'should fail if given a %s key',
                async (desc, key) => {
                    const response = await controller.validateSessionKey(key);

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given session key is invalid. It must be a correctly formatted string.',
                    });
                }
            );
        });
    });

    describe('validateConnectionToken()', () => {
        describe('v1 tokens', () => {
            beforeEach(async () => {
                await store.saveUser({
                    id: 'myid',
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                });

                nowMock.mockReturnValue(101);
            });

            it('should return the User ID if given a valid key', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    connectionId: 'connectionId',
                    recordName: 'recordName',
                    inst: 'inst',
                });
            });

            it('should give the user the default subscription', async () => {
                store.subscriptionConfiguration.subscriptions[1].defaultSubscription =
                    true;
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    connectionId: 'connectionId',
                    recordName: 'recordName',
                    inst: 'inst',
                    subscriptionTier: 'beta',
                    subscriptionId: 'sub_1',
                });
            });

            it('should support connection tokens that have a null record name', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    null,
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    connectionId: 'connectionId',
                    recordName: null,
                    inst: 'inst',
                });
            });

            it('should support connection tokens that dont expire', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: null,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    null,
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    connectionId: 'connectionId',
                    recordName: null,
                    inst: 'inst',
                });
            });

            it('should fail if the token doesnt match the connection secret', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String('wrong'),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: 'The connection token is invalid.',
                });
            });

            it('should include the users subscription tier', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveUser({
                    id: 'myid',
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'active',
                });

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );
                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    sessionId: sessionId,
                    connectionId: 'connectionId',
                    recordName: 'recordName',
                    inst: 'inst',
                    subscriptionTier: 'alpha',
                    subscriptionId: 'sub_2',
                });
            });

            it('should fail if the token is malformed', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.validateConnectionToken(
                    'wrong token'
                );

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_connection_token',
                    errorMessage:
                        'The given connection token is invalid. It must be a correctly formatted string.',
                });
            });

            it('should fail if the session has expired', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );

                nowMock.mockReturnValue(400);

                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'session_expired',
                    errorMessage: 'The session has expired.',
                });
            });

            it('should fail if the session has been revoked', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: 150,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );

                nowMock.mockReturnValue(175);

                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                });
            });

            it('should fail if the session was granted before all sessions were revoked', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                await store.saveUser({
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: 101,
                    currentLoginRequestId: requestId,
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );

                nowMock.mockReturnValue(175);

                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_token',
                    errorMessage: INVALID_TOKEN_ERROR_MESSAGE,
                });
            });

            it('should work if the session was granted before all sessions were revoked but is not revocable and also has no expiration time', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const connectionSecret = 'connectionSecret';
                const userId = 'myid';

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashHighEntropyPasswordWithSalt(
                        code,
                        sessionId
                    ),
                    connectionSecret: toBase64String(connectionSecret),
                    expireTimeMs: 200,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                    revocable: false,
                });

                await store.saveUser({
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: 101,
                    currentLoginRequestId: requestId,
                });

                const connectionKey = formatV1ConnectionKey(
                    userId,
                    sessionId,
                    toBase64String(connectionSecret),
                    200
                );
                const token = generateV1ConnectionToken(
                    connectionKey,
                    'connectionId',
                    'recordName',
                    'inst'
                );

                nowMock.mockReturnValue(175);

                const result = await controller.validateConnectionToken(token);

                expect(result).toEqual({
                    success: true,
                    userId,
                    sessionId,
                    inst: 'inst',
                    recordName: 'recordName',
                    connectionId: 'connectionId',
                    allSessionsRevokedTimeMs: 101,
                });
            });
        });

        it('should work with keys created by completeLogin()', async () => {
            const address = 'myAddress';
            const addressType = 'email';
            const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
            const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([13, 14, 15]);

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
            });

            await store.saveLoginRequest({
                userId: 'myid',
                requestId: requestId,
                secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                expireTimeMs: 200,
                requestTimeMs: 100,
                completedTimeMs: null,
                attemptCount: 0,
                address,
                addressType,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            const token = generateV1ConnectionToken(
                response.connectionKey,
                'connectionId',
                'recordName',
                'inst'
            );

            const validateResponse = await controller.validateConnectionToken(
                token
            );

            expect(validateResponse).toEqual({
                success: true,
                userId: 'myid',
                sessionId: fromByteArray(sessionId),
                connectionId: 'connectionId',
                recordName: 'recordName',
                inst: 'inst',
            });
        });

        it('should return the privacy features that the user has enabled', async () => {
            const address = 'myAddress';
            const addressType = 'email';
            const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
            const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
            const sessionId = new Uint8Array([7, 8, 9]);
            const sessionSecret = new Uint8Array([10, 11, 12]);
            const connectionSecret = new Uint8Array([13, 14, 15]);

            await store.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });

            await store.saveLoginRequest({
                userId: 'myid',
                requestId: requestId,
                secretHash: hashLowEntropyPasswordWithSalt(code, requestId),
                expireTimeMs: 200,
                requestTimeMs: 100,
                completedTimeMs: null,
                attemptCount: 0,
                address,
                addressType,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(sessionId)
                .mockReturnValueOnce(sessionSecret)
                .mockReturnValueOnce(connectionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            expect(response).toEqual({
                success: true,
                userId: 'myid',
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: expect.any(Number),
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            const token = generateV1ConnectionToken(
                response.connectionKey,
                'connectionId',
                'recordName',
                'inst'
            );

            const validateResponse = await controller.validateConnectionToken(
                token
            );

            expect(validateResponse).toEqual({
                success: true,
                userId: 'myid',
                sessionId: fromByteArray(sessionId),
                connectionId: 'connectionId',
                recordName: 'recordName',
                inst: 'inst',
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });
        });

        describe('data validation', () => {
            const invalidKeyCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];
            it.each(invalidKeyCases)(
                'should fail if given a %s key',
                async (desc, key) => {
                    const response = await controller.validateConnectionToken(
                        key
                    );

                    expect(response).toEqual({
                        success: false,
                        errorCode: 'unacceptable_connection_token',
                        errorMessage:
                            'The given connection token is invalid. It must be a correctly formatted string.',
                    });
                }
            );
        });
    });

    describe('revokeSessionKey()', () => {
        beforeEach(async () => {
            await store.saveUser({
                id: 'myid',
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should mark the given session as revoked', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: true,
            });
            expect(await store.findSession(userId, 'otherSession')).toEqual({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 400,
                userId,
                ipAddress: '127.0.0.1',
            });
        });

        it('should fail if the session could not be found', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'missing',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'session_not_found',
                errorMessage: 'The session was not found.',
            });
        });

        it('should fail if the session is already revoked', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 999,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'session_already_revoked',
                errorMessage: 'The session has already been revoked.',
            });
        });

        it('should fail if the given session key is for a different user', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(
                'wrong user',
                sessionId,
                code,
                5000
            );

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId: 'wrong user',
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: 'The session key is invalid.',
            });
        });

        it('should fail if the given an unparsable session key', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId: 'wrong user',
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectinoSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: 'badly formatted session key',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a correctly formatted string.',
            });
        });

        it('should fail if the given session key is for an revoked session', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(
                'wrong user',
                sessionId,
                code,
                200
            );

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 200,
                userId,
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: 'The session key is invalid.',
            });
        });

        it('should fail if the session is able to be revoked', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            await store.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
                connectionSecret: 'connectionSecret',
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',

                revocable: false,
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'otherSession',
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'session_is_not_revokable',
                errorMessage: 'The session cannot be revoked.',
            });
        });

        describe('privo', () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            beforeEach(async () => {
                // Jan 1, 2023 in miliseconds
                nowMock.mockReturnValue(
                    DateTime.utc(2023, 1, 1, 0, 0, 0).toMillis()
                );

                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };

                await store.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                    connectionSecret: code,
                    expireTimeMs: DateTime.utc(2023, 1, 1, 1, 0, 0).toMillis(), // one hour after "now",
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',

                    oidProvider: PRIVO_OPEN_ID_PROVIDER,
                    oidAccessToken: 'accessToken',
                    oidExpiresAtMs: DateTime.utc(
                        2023,
                        1,
                        1,
                        1,
                        0,
                        0
                    ).toMillis(), // one hour after "now"
                    oidIdToken: 'accessToken',
                    oidRefreshToken: 'refreshToken',
                    oidRequestId: 'oidRequestId',
                    oidScope: 'scope1 scope2',
                    oidTokenType: 'Bearer',
                });
            });

            it('should include a URL that the user can be redirected to in order to logout', async () => {
                privoClientMock.generateLogoutUrl.mockResolvedValue(
                    'http://example.com/logout?id_token_hint=accessToken'
                );

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    code,
                    200
                );

                const result = await controller.revokeSession({
                    sessionId: sessionId,
                    sessionKey: sessionKey,
                    userId: userId,
                });

                expect(result).toEqual({
                    success: true,
                    logoutUrl:
                        'http://example.com/logout?id_token_hint=accessToken',
                });
                expect(privoClientMock.generateLogoutUrl).toHaveBeenCalledWith(
                    'accessToken'
                );
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'it should fail if given a %s userId',
                async (desc, id) => {
                    const result = await controller.revokeSession({
                        userId: id,
                        sessionId: 'sessionId',
                        sessionKey: 'key',
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given userId is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'it should fail if given a %s sessionId',
                async (desc, id) => {
                    const result = await controller.revokeSession({
                        userId: 'userId',
                        sessionId: id,
                        sessionKey: 'key',
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_id',
                        errorMessage:
                            'The given sessionId is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'it should fail if given a %s sessionKey',
                async (desc, id) => {
                    const result = await controller.revokeSession({
                        userId: 'userId',
                        sessionId: 'sessionId',
                        sessionKey: id,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given session key is invalid. It must be a string.',
                    });
                }
            );
        });
    });

    describe('revokeAllSessions()', () => {
        const userId = 'myid';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should update the time that all sessions are revoked at', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(400);

            const result = await controller.revokeAllSessions({
                userId: userId,
                sessionKey: sessionKey,
            });

            expect(result).toEqual({
                success: true,
            });
            expect(await store.findUser(userId)).toEqual({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: 400,
                currentLoginRequestId: undefined,
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'it should fail if given a %s userId',
                async (desc, id) => {
                    const result = await controller.revokeAllSessions({
                        userId: id,
                        sessionKey: 'key',
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given userId is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'it should fail if given a %s session key',
                async (desc, id) => {
                    const result = await controller.revokeAllSessions({
                        userId: 'userId',
                        sessionKey: id,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given session key is invalid. It must be a string.',
                    });
                }
            );
        });
    });

    describe('replaceSession()', () => {
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';
        const userId = 'myid';
        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);
        const connectionKey = formatV1ConnectionKey(
            userId,
            sessionId,
            code,
            200
        );

        beforeEach(async () => {
            await store.saveUser({
                id: 'myid',
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashHighEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });
        });

        it('should issue a new session and revoke the given session', async () => {
            const newSessionId = new Uint8Array([7, 8, 9]);
            const newSessionSecret = new Uint8Array([10, 11, 12]);
            const newConnectionSecret = new Uint8Array([13, 14, 15]);

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(newSessionId)
                .mockReturnValueOnce(newSessionSecret)
                .mockReturnValueOnce(newConnectionSecret);

            const result = await controller.replaceSession({
                sessionKey: sessionKey,
                ipAddress: '127.0.0.2',
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                sessionKey: formatV1SessionKey(
                    userId,
                    fromByteArray(newSessionId),
                    fromByteArray(newSessionSecret),
                    150 + SESSION_LIFETIME_MS
                ),
                connectionKey: formatV1ConnectionKey(
                    userId,
                    fromByteArray(newSessionId),
                    fromByteArray(newConnectionSecret),
                    150 + SESSION_LIFETIME_MS
                ),
                expireTimeMs: 150 + SESSION_LIFETIME_MS,
                metadata: {
                    hasUserAuthenticator: false,
                    userAuthenticatorCredentialIds: [],
                    hasPushSubscription: false,
                    pushSubscriptionIds: [],
                },
            });

            expect(await store.findSession(userId, sessionId)).toEqual({
                requestId,
                sessionId,
                secretHash: hashHighEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: fromByteArray(newSessionId),
                revokeTimeMs: 150,
                userId,
                ipAddress: '127.0.0.1',
            });

            expect(
                await store.findSession(userId, fromByteArray(newSessionId))
            ).toEqual({
                previousSessionId: sessionId,
                nextSessionId: null,
                sessionId: fromByteArray(newSessionId),
                userId,
                secretHash: hashHighEntropyPasswordWithSalt(
                    fromByteArray(newSessionSecret),
                    fromByteArray(newSessionId)
                ),
                connectionSecret: fromByteArray(newConnectionSecret),
                expireTimeMs: 150 + SESSION_LIFETIME_MS,
                grantedTimeMs: 150,
                revokeTimeMs: null,
                requestId: null,
                ipAddress: '127.0.0.2',
            });
        });

        it('should fail if given an invalid session key', async () => {
            const result = await controller.replaceSession({
                sessionKey: 'wrong',
                ipAddress: '127.0.0.2',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_session_key',
                errorMessage:
                    'The given session key is invalid. It must be a correctly formatted string.',
            });
        });

        it('should fail if given a revoked session key', async () => {
            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashHighEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 150,
                userId,
                ipAddress: '127.0.0.1',
            });

            nowMock.mockReturnValue(200);

            const result = await controller.replaceSession({
                sessionKey: sessionKey,
                ipAddress: '127.0.0.2',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: INVALID_KEY_ERROR_MESSAGE,
            });
        });

        it('should fail if the session is not revocable', async () => {
            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashHighEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',

                revocable: false,
            });

            nowMock.mockReturnValue(200);

            const result = await controller.replaceSession({
                sessionKey: sessionKey,
                ipAddress: '127.0.0.2',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: INVALID_KEY_ERROR_MESSAGE,
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'should fail if given a %s sessionKey',
                async (desc, id) => {
                    const result = await controller.replaceSession({
                        sessionKey: id,
                        ipAddress: '123.456.789',
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given sessionKey is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'should fail if given a %s ipAddress',
                async (desc, id) => {
                    const result = await controller.replaceSession({
                        sessionKey: 'key',
                        ipAddress: id,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_ip_address',
                        errorMessage:
                            'The given IP address is invalid. It must be a string.',
                    });
                }
            );
        });
    });

    describe('listSessions()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 999,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            for (let i = 0; i < 20; i++) {
                await store.saveSession({
                    requestId,
                    sessionId: 'session' + (i + 1),
                    secretHash: 'hash' + (i + 1),
                    connectionSecret: 'connectionSecret' + (i + 1),
                    expireTimeMs: 1000 + (i + 1),
                    grantedTimeMs: 100 + (i + 1),
                    previousSessionId: null,
                    nextSessionId: i === 14 ? 'nextSessionId' : null,
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });
            }
        });

        it('should return the first 10 sessions ordered by when they expire decending', async () => {
            nowMock.mockReturnValue(400);
            const result = (await controller.listSessions({
                userId: 'myid',
                sessionKey: sessionKey,
            })) as ListSessionsSuccess;

            expect(result.success).toBe(true);
            expect(result.sessions).toHaveLength(10);
            expect(result.sessions[0]).toEqual({
                sessionId: 'session20',
                userId: 'myid',
                expireTimeMs: 1020,
                grantedTimeMs: 120,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: null,
            });
            expect(result.sessions[5]).toEqual({
                sessionId: 'session15',
                userId: 'myid',
                expireTimeMs: 1015,
                grantedTimeMs: 115,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: 'nextSessionId',
            });
            expect(result.sessions[9]).toEqual({
                sessionId: 'session11',
                userId: 'myid',
                expireTimeMs: 1011,
                grantedTimeMs: 111,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: null,
            });
        });

        it('should return not_authorized if requesting sessions for someone else', async () => {
            nowMock.mockReturnValue(400);
            const result = (await controller.listSessions({
                userId: 'otheruserId',
                sessionKey: sessionKey,
            })) as ListSessionsSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: 'The session key is invalid.',
            });
        });

        it('should use the time that all sessions were revoked at if the token was granted before all sessions were revoked', async () => {
            nowMock.mockReturnValue(400);
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: 111,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId: 'session20',
                secretHash: 'hash20',
                connectionSecret: 'connectionSecret20',
                expireTimeMs: 1020,
                grantedTimeMs: 120,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 199,
                userId,
                ipAddress: '127.0.0.1',
            });

            const result = (await controller.listSessions({
                userId: 'myid',
                sessionKey: sessionKey,
            })) as ListSessionsSuccess;

            expect(result.success).toBe(true);
            expect(result.sessions).toHaveLength(10);
            expect(result.sessions[0]).toEqual({
                sessionId: 'session20',
                userId: 'myid',
                expireTimeMs: 1020,
                grantedTimeMs: 120,
                revokeTimeMs: 199,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: null,
            });
            expect(result.sessions[5]).toEqual({
                sessionId: 'session15',
                userId: 'myid',
                expireTimeMs: 1015,
                grantedTimeMs: 115,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: 'nextSessionId',
            });
            expect(result.sessions[9]).toEqual({
                sessionId: 'session11',
                userId: 'myid',
                expireTimeMs: 1011,
                grantedTimeMs: 111,
                revokeTimeMs: 111,
                ipAddress: '127.0.0.1',
                currentSession: false,
                nextSessionId: null,
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'it should fail if given a %s userId',
                async (desc, id) => {
                    const result = await controller.listSessions({
                        userId: id,
                        sessionKey: 'key',
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given userId is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'it should fail if given a %s session key',
                async (desc, id) => {
                    const result = await controller.listSessions({
                        userId: 'userId',
                        sessionKey: id,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given session key is invalid. It must be a string.',
                    });
                }
            );
        });

        describe('superUser', () => {
            const superUserId = 'superUserId';
            const superUserSessionId = toBase64String('superUserSessionId');
            const superUserSessionKey = formatV1SessionKey(
                superUserId,
                superUserSessionId,
                code,
                200
            );

            beforeEach(async () => {
                await store.saveUser({
                    id: superUserId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: null,
                    avatarPortraitUrl: null,
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    role: 'superUser',
                });

                await store.saveSession({
                    requestId: null,
                    sessionId: superUserSessionId,
                    secretHash: hashLowEntropyPasswordWithSalt(
                        code,
                        superUserSessionId
                    ),
                    connectionSecret: code,
                    expireTimeMs: 1000,
                    grantedTimeMs: 999,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: null,
                    userId: superUserId,
                    ipAddress: '127.0.0.1',
                });
            });

            it('should allow the sessions to be listed if requested by a super user', async () => {
                nowMock.mockReturnValue(400);
                const result = (await controller.listSessions({
                    userId: 'myid',
                    sessionKey: superUserSessionKey,
                })) as ListSessionsSuccess;

                expect(result.success).toBe(true);
                expect(result.sessions).toHaveLength(10);
                expect(result.sessions[0]).toEqual({
                    sessionId: 'session20',
                    userId: 'myid',
                    expireTimeMs: 1020,
                    grantedTimeMs: 120,
                    revokeTimeMs: null,
                    ipAddress: '127.0.0.1',
                    currentSession: false,
                    nextSessionId: null,
                });
                expect(result.sessions[5]).toEqual({
                    sessionId: 'session15',
                    userId: 'myid',
                    expireTimeMs: 1015,
                    grantedTimeMs: 115,
                    revokeTimeMs: null,
                    ipAddress: '127.0.0.1',
                    currentSession: false,
                    nextSessionId: 'nextSessionId',
                });
                expect(result.sessions[9]).toEqual({
                    sessionId: 'session11',
                    userId: 'myid',
                    expireTimeMs: 1011,
                    grantedTimeMs: 111,
                    revokeTimeMs: null,
                    ipAddress: '127.0.0.1',
                    currentSession: false,
                    nextSessionId: null,
                });
            });
        });
    });

    describe('getUserInfo()', () => {
        const userId = 'myid';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should return the info for the current user', async () => {
            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: null,
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should return the info for the given user ID if it matches the current user', async () => {
            const result = await controller.getUserInfo({
                userId,
                requestedUserId: userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: null,
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should include the privacy features that are stored for the user', async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
            });

            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: null,
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: false,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should work if there is no subscription config', async () => {
            store.subscriptionConfiguration = null;

            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: null,
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should include the subscription tier from the subscription matching the user subscriptionId', async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'active',
                subscriptionId: 'sub_2',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: true,
                subscriptionTier: 'alpha',
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should use the default subscription if configured', async () => {
            store.subscriptionConfiguration.subscriptions[1].defaultSubscription =
                true;
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: 'beta',
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should use the default subscription if the user has an inactive subscription', async () => {
            store.subscriptionConfiguration.subscriptions[1].defaultSubscription =
                true;
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'canceled',
                subscriptionId: 'sub_2',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.getUserInfo({
                userId,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                hasActiveSubscription: false,
                subscriptionTier: 'beta',
                displayName: null,
                privacyFeatures: {
                    publishData: true,
                    allowPublicData: true,
                    allowAI: true,
                    allowPublicInsts: true,
                },
                role: 'none',
            });
        });

        it('should return a not_authorized response when the current user doesnt match the given user', async () => {
            const result = await controller.getUserInfo({
                userId: 'myOtherUser',
                requestedUserId: userId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            });
        });

        describe('privo', () => {
            beforeEach(async () => {
                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    // verificationIntegration: 'verificationIntegration',
                    // verificationServiceId: 'verificationServiceId',
                    // verificationSiteId: 'verificationSiteId',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };

                await store.saveUser({
                    id: userId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    privoServiceId: 'serviceId',
                });
            });

            it('should get the features for the user and return them', async () => {
                privoClientMock.getUserInfo.mockResolvedValue({
                    serviceId: 'serviceId',
                    emailVerified: true,
                    email: 'privoemail',
                    givenName: 'name',
                    locale: 'en-US',
                    roleIdentifier: 'ab1Child',
                    displayName: 'displayName',
                    permissions: [
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'joinAndCollaborate',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: false,
                            consentDateSeconds: 1234567890,
                            featureId: 'publish',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'dev',
                            active: true,
                            category: 'Standard',
                        },
                    ],
                });

                const result = await controller.getUserInfo({
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'privoemail',
                    phoneNumber: null,
                    name: 'name',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: 'displayName',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: false,
                        allowAI: false,
                        allowPublicInsts: true,
                    },
                    role: 'none',
                });

                expect(privoClientMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId'
                );
            });

            it('should update the users features if the privo ones dont match the stored ones', async () => {
                privoClientMock.getUserInfo.mockResolvedValue({
                    serviceId: 'serviceId',
                    emailVerified: true,
                    email: 'email',
                    givenName: 'name',
                    locale: 'en-US',
                    roleIdentifier: 'ab1Child',
                    displayName: 'displayName',
                    permissions: [
                        {
                            on: false,
                            consentDateSeconds: 1234567890,
                            featureId: 'joinAndCollaborate',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: false,
                            consentDateSeconds: 1234567890,
                            featureId: 'publish',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'dev',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'buildaieggs',
                            active: true,
                            category: 'Standard',
                        },
                    ],
                });

                const result = await controller.getUserInfo({
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'email',
                    phoneNumber: null,
                    name: 'name',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: 'displayName',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: false,
                        allowAI: true,
                        allowPublicInsts: false,
                    },
                    role: 'none',
                });

                expect(privoClientMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId'
                );

                expect(await store.findUser(userId)).toEqual({
                    id: userId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    privoServiceId: 'serviceId',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: false,
                        allowAI: true,
                        allowPublicInsts: false,
                    },
                });
            });

            it('should update the users features if ai permissions was changed', async () => {
                await store.saveUser({
                    ...(await store.findUser(userId)),
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: false,
                        allowPublicInsts: true,
                    },
                });

                privoClientMock.getUserInfo.mockResolvedValue({
                    serviceId: 'serviceId',
                    emailVerified: true,
                    email: 'email',
                    givenName: 'name',
                    locale: 'en-US',
                    roleIdentifier: 'ab1Child',
                    displayName: 'displayName',
                    permissions: [
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'joinAndCollaborate',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'publish',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'dev',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'buildaieggs',
                            active: true,
                            category: 'Standard',
                        },
                    ],
                });

                const result = await controller.getUserInfo({
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'email',
                    phoneNumber: null,
                    name: 'name',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: 'displayName',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    role: 'none',
                });

                expect(privoClientMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId'
                );

                expect(await store.findUser(userId)).toEqual({
                    id: userId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    privoServiceId: 'serviceId',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                });
            });

            it('should update the users features if public insts permissions was changed', async () => {
                await store.saveUser({
                    ...(await store.findUser(userId)),
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: false,
                    },
                });

                privoClientMock.getUserInfo.mockResolvedValue({
                    serviceId: 'serviceId',
                    emailVerified: true,
                    email: 'email',
                    givenName: 'name',
                    locale: 'en-US',
                    roleIdentifier: 'ab1Child',
                    displayName: 'displayName',
                    permissions: [
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'joinAndCollaborate',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'publish',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'dev',
                            active: true,
                            category: 'Standard',
                        },
                        {
                            on: true,
                            consentDateSeconds: 1234567890,
                            featureId: 'buildaieggs',
                            active: true,
                            category: 'Standard',
                        },
                    ],
                });

                const result = await controller.getUserInfo({
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'email',
                    phoneNumber: null,
                    name: 'name',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: 'displayName',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    role: 'none',
                });

                expect(privoClientMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId'
                );

                expect(await store.findUser(userId)).toEqual({
                    id: userId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    privoServiceId: 'serviceId',
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                });
            });
        });

        describe('superUser', () => {
            const superUserId = 'superUserId';

            beforeEach(async () => {
                await store.saveUser({
                    id: superUserId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: null,
                    avatarPortraitUrl: null,
                    allSessionRevokeTimeMs: undefined,
                    currentLoginRequestId: undefined,
                    role: 'superUser',
                });
            });

            it('should include the role of the user', async () => {
                const result = await controller.getUserInfo({
                    userId: superUserId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: superUserId,
                    email: null,
                    phoneNumber: null,
                    name: null,
                    avatarUrl: null,
                    avatarPortraitUrl: null,
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    role: 'superUser',
                });
            });

            it('should include the financial info for the account', async () => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    accountId: 'accountId',
                    stripeAccountId: 'stripeAccountId',
                    requestedRate: 123,
                    stripeAccountStatus: 'pending',
                    stripeAccountRequirementsStatus: 'incomplete',
                });
                const result = await controller.getUserInfo({
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    name: 'Test',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    role: 'none',
                    accountId: 'accountId',
                    stripeAccountId: 'stripeAccountId',
                    requestedRate: 123,
                    stripeAccountStatus: 'pending',
                    stripeAccountRequirementsStatus: 'incomplete',
                });
            });

            it('should allow super users to get other users info', async () => {
                const result = await controller.getUserInfo({
                    userId: superUserId,
                    userRole: 'superUser',
                    requestedUserId: userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    name: 'Test',
                    avatarUrl: 'avatar url',
                    avatarPortraitUrl: 'avatar portrait url',
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: null,
                    privacyFeatures: {
                        publishData: true,
                        allowPublicData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                    role: 'none',
                });
            });
        });
    });

    describe('updateUserInfo()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 999,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });
        });

        it('should update the info for the given user ID', async () => {
            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    name: 'New Name',
                    avatarUrl: 'New Avatar URL',
                    avatarPortraitUrl: 'New Portrait',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                },
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await store.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'New Avatar URL',
                avatarPortraitUrl: 'New Portrait',
                email: 'new email',
                phoneNumber: 'new phone number',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should return an invalid_key result if the user ID doesnt match the session key', async () => {
            const result = await controller.updateUserInfo({
                userId: 'wrong',
                sessionKey,
                update: {
                    name: 'New Name',
                    avatarUrl: 'New Avatar URL',
                    avatarPortraitUrl: 'New Portrait',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: INVALID_KEY_ERROR_MESSAGE,
            });

            const user = await store.findUser(userId);

            expect(user).toEqual({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should preserve values that arent included in the update', async () => {
            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    name: 'New Name',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                },
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await store.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                email: 'new email',
                phoneNumber: 'new phone number',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should not update special properties for the user', async () => {
            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    id: 'new id',
                    allSessionRevokeTimeMs: 99,
                    currentLoginRequestId: 'request id',
                    name: 'New Name',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                } as any,
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await store.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                email: 'new email',
                phoneNumber: 'new phone number',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        describe('data validation', () => {
            const invalidIdCases = [
                ['null', null as any],
                ['empty', ''],
                ['number', 123],
                ['boolean', false],
                ['object', {}],
                ['array', []],
                ['undefined', undefined],
            ];

            it.each(invalidIdCases)(
                'it should fail if given a %s userId',
                async (desc, id) => {
                    const result = await controller.updateUserInfo({
                        userId: id,
                        sessionKey: 'key',
                        update: {
                            name: 'New Name',
                            avatarUrl: 'New Avatar URL',
                            avatarPortraitUrl: 'New Portrait',
                            email: 'new email',
                            phoneNumber: 'new phone number',
                        },
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_user_id',
                        errorMessage:
                            'The given userId is invalid. It must be a string.',
                    });
                }
            );

            it.each(invalidIdCases)(
                'it should fail if given a %s session key',
                async (desc, id) => {
                    const result = await controller.updateUserInfo({
                        userId: 'userId',
                        sessionKey: id,
                        update: {
                            name: 'New Name',
                            avatarUrl: 'New Avatar URL',
                            avatarPortraitUrl: 'New Portrait',
                            email: 'new email',
                            phoneNumber: 'new phone number',
                        },
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_session_key',
                        errorMessage:
                            'The given session key is invalid. It must be a string.',
                    });
                }
            );

            const invalidUpdateCases = [
                ['null', null as any] as const,
                ['string', 'abc'] as const,
                ['boolean', true] as const,
                ['number', 123] as const,
                ['array', []] as const,
                ['undefined', undefined as any] as const,
            ];

            it.each(invalidUpdateCases)(
                'it should fail if given a %s update',
                async (desc, update) => {
                    const result = await controller.updateUserInfo({
                        userId: userId,
                        sessionKey: sessionKey,
                        update: update as any,
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_update',
                        errorMessage:
                            'The given update is invalid. It must be an object.',
                    });
                }
            );
        });
    });

    describe('getPublicUserInfo()', () => {
        it('should return the public info for the given user ID', async () => {
            await store.saveUser({
                id: 'myid',
                email: 'email@example.com',
                phoneNumber: null,
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.getPublicUserInfo('myid');

            expect(result).toEqual({
                success: true,
                user: {
                    userId: 'myid',
                    name: 'Test',
                    displayName: null,
                    email: 'email@example.com',
                },
            });
        });

        it('should return null if the user doesnt exist', async () => {
            const result = await controller.getPublicUserInfo('myid');

            expect(result).toEqual({
                success: true,
                user: null,
            });
        });
    });

    describe('requestPrivacyFeaturesChange()', () => {
        const userId = 'myid';
        const requestId = 'requestId';
        const sessionId = toBase64String('sessionId');
        const code = 'code';

        const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

        beforeEach(async () => {
            store.privoConfiguration = {
                gatewayEndpoint: 'endpoint',
                featureIds: {
                    adultPrivoSSO: 'adultAccount',
                    childPrivoSSO: 'childAccount',
                    joinAndCollaborate: 'joinAndCollaborate',
                    publishProjects: 'publish',
                    projectDevelopment: 'dev',
                    buildAIEggs: 'buildaieggs',
                },
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                publicEndpoint: 'publicEndpoint',
                roleIds: {
                    child: 'childRole',
                    adult: 'adultRole',
                    parent: 'parentRole',
                },
                clientTokenScopes: 'scope1 scope2',
                userTokenScopes: 'scope1 scope2',
                // verificationIntegration: 'verificationIntegration',
                // verificationServiceId: 'verificationServiceId',
                // verificationSiteId: 'verificationSiteId',
                redirectUri: 'redirectUri',
                ageOfConsent: 18,
            };

            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
                privoServiceId: 'serviceId',
            });

            await store.saveSession({
                requestId,
                sessionId,
                secretHash: hashLowEntropyPasswordWithSalt(code, sessionId),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 999,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            privoClientMock.resendConsentRequest.mockResolvedValue({
                success: true,
            });
        });

        it('should resend the consent request to the user', async () => {
            const result = await controller.requestPrivacyFeaturesChange({
                userId,
                sessionKey,
            });

            expect(result).toEqual({
                success: true,
            });

            expect(privoClientMock.resendConsentRequest).toHaveBeenCalledWith(
                'serviceId',
                'serviceId'
            );
        });

        it('should resend the consent request to the parent', async () => {
            await store.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
                privoServiceId: 'serviceId',
                privoParentServiceId: 'parentServiceId',
            });

            const result = await controller.requestPrivacyFeaturesChange({
                userId,
                sessionKey,
            });

            expect(result).toEqual({
                success: true,
            });

            expect(privoClientMock.resendConsentRequest).toHaveBeenCalledWith(
                'serviceId',
                'parentServiceId'
            );
        });

        it('should return not_authorized if trying to send a request for another user', async () => {
            const result = await controller.requestPrivacyFeaturesChange({
                userId: 'otherUserId',
                sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: 'The session key is invalid.',
            });

            expect(privoClientMock.resendConsentRequest).not.toHaveBeenCalled();
        });

        it('super users should be able to send requests for other users', async () => {
            const superUserRequestId = 'superUserRequestId';
            const superUserSessionId = toBase64String('superUserSessionId');
            const superUserId = 'superUserId';
            const superUserSessionKey = formatV1SessionKey(
                superUserId,
                superUserSessionId,
                code,
                200
            );
            await store.saveUser({
                id: superUserId,
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
                role: 'superUser',
            });

            await store.saveSession({
                requestId: superUserRequestId,
                sessionId: superUserSessionId,
                secretHash: hashLowEntropyPasswordWithSalt(
                    code,
                    superUserSessionId
                ),
                connectionSecret: code,
                expireTimeMs: 1000,
                grantedTimeMs: 999,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId: superUserId,
                ipAddress: '127.0.0.1',
            });

            const result = await controller.requestPrivacyFeaturesChange({
                userId,
                sessionKey: superUserSessionKey,
            });

            expect(result).toEqual({
                success: true,
            });

            expect(privoClientMock.resendConsentRequest).toHaveBeenCalledWith(
                'serviceId',
                'serviceId'
            );
        });
    });

    describe('listEmailRules()', () => {
        it('should return the list of email rules stored in the store', async () => {
            store.emailRules.push({
                type: 'allow',
                pattern: 'abc',
            });

            const result = await controller.listEmailRules();

            expect(result).toEqual({
                success: true,
                rules: [
                    {
                        type: 'allow',
                        pattern: 'abc',
                    },
                ],
            });
        });
    });

    describe('listSmsRules()', () => {
        it('should return the list of email rules stored in the store', async () => {
            store.smsRules.push({
                type: 'allow',
                pattern: 'abc',
            });

            const result = await controller.listSmsRules();

            expect(result).toEqual({
                success: true,
                rules: [
                    {
                        type: 'allow',
                        pattern: 'abc',
                    },
                ],
            });
        });
    });

    describe('isValidEmailAddress()', () => {
        it('should return true if the email address matches the email rules', async () => {
            store.emailRules.push({
                type: 'allow',
                pattern: 'abc',
            });

            const result = await controller.isValidEmailAddress('abc');

            expect(result).toEqual({
                success: true,
                allowed: true,
            });
        });

        it('should return true if there are no email rules', async () => {
            const result = await controller.isValidEmailAddress('no rules');

            expect(result).toEqual({
                success: true,
                allowed: true,
            });
        });

        describe('privo', () => {
            beforeEach(() => {
                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    // verificationIntegration: 'verificationIntegration',
                    // verificationServiceId: 'verificationServiceId',
                    // verificationSiteId: 'verificationSiteId',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };
            });

            it('should check the privo client if the email is valid', async () => {
                privoClientMock.checkEmail.mockResolvedValueOnce({
                    available: true,
                });

                const result = await controller.isValidEmailAddress('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: true,
                });
            });

            it('should return the suggestions', async () => {
                privoClientMock.checkEmail.mockResolvedValueOnce({
                    available: false,
                    suggestions: ['suggestion1', 'suggestion2'],
                });

                const result = await controller.isValidEmailAddress('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: false,
                    suggestions: ['suggestion1', 'suggestion2'],
                });
            });

            it('should return false if the check says the email contains profanity', async () => {
                privoClientMock.checkEmail.mockResolvedValueOnce({
                    available: true,
                    profanity: true,
                });

                const result = await controller.isValidEmailAddress('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: false,
                    profanity: true,
                });
            });
        });
    });

    describe('isValidDisplayName()', () => {
        it('should return true if there is no privo configuration', async () => {
            const result = await controller.isValidDisplayName('no rules');

            expect(result).toEqual({
                success: true,
                allowed: true,
            });
        });

        describe('privo', () => {
            beforeEach(() => {
                store.privoConfiguration = {
                    gatewayEndpoint: 'endpoint',
                    featureIds: {
                        adultPrivoSSO: 'adultAccount',
                        childPrivoSSO: 'childAccount',
                        joinAndCollaborate: 'joinAndCollaborate',
                        publishProjects: 'publish',
                        projectDevelopment: 'dev',
                        buildAIEggs: 'buildaieggs',
                    },
                    clientId: 'clientId',
                    clientSecret: 'clientSecret',
                    publicEndpoint: 'publicEndpoint',
                    roleIds: {
                        child: 'childRole',
                        adult: 'adultRole',
                        parent: 'parentRole',
                    },
                    clientTokenScopes: 'scope1 scope2',
                    userTokenScopes: 'scope1 scope2',
                    // verificationIntegration: 'verificationIntegration',
                    // verificationServiceId: 'verificationServiceId',
                    // verificationSiteId: 'verificationSiteId',
                    redirectUri: 'redirectUri',
                    ageOfConsent: 18,
                };
            });

            it('should return false if the display name contains the given name', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: true,
                });

                const result = await controller.isValidDisplayName(
                    'displayName',
                    'name'
                );

                expect(result).toEqual({
                    success: true,
                    allowed: false,
                    containsName: true,
                });
            });

            it('should return true if the name is empty', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: true,
                });

                const result = await controller.isValidDisplayName(
                    'displayName',
                    ''
                );

                expect(result).toEqual({
                    success: true,
                    allowed: true,
                });
            });

            it('should return true if the name is null', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: true,
                });

                const result = await controller.isValidDisplayName(
                    'displayName',
                    null
                );

                expect(result).toEqual({
                    success: true,
                    allowed: true,
                });
            });

            it('should check the privo client if the display name is valid', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: true,
                });

                const result = await controller.isValidDisplayName('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: true,
                });
            });

            it('should return the suggestions', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: false,
                    suggestions: ['suggestion1', 'suggestion2'],
                });

                const result = await controller.isValidDisplayName('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: false,
                    suggestions: ['suggestion1', 'suggestion2'],
                });
            });

            it('should return false if the check says the display name contains profanity', async () => {
                privoClientMock.checkDisplayName.mockResolvedValueOnce({
                    available: true,
                    profanity: true,
                });

                const result = await controller.isValidDisplayName('abc');

                expect(result).toEqual({
                    success: true,
                    allowed: false,
                    profanity: true,
                });
            });
        });
    });
});

describe('getPrivacyFeaturesFromPermissions()', () => {
    it('should disable all the features if no features are provided', () => {
        const result = getPrivacyFeaturesFromPermissions(
            {
                adultPrivoSSO: 'aSSO',
                childPrivoSSO: 'cSSO',
                joinAndCollaborate: 'joinAndCollaborate',
                projectDevelopment: 'projectDevelopment',
                publishProjects: 'publishProjects',
                buildAIEggs: 'buildaieggs',
            },
            []
        );

        expect(result).toEqual({
            publishData: false,
            allowPublicData: false,
            allowAI: false,
            allowPublicInsts: false,
        });
    });

    it('should disable the allowPublicData feature if the publishProjects feature is disabled', () => {
        const result = getPrivacyFeaturesFromPermissions(
            {
                adultPrivoSSO: 'aSSO',
                childPrivoSSO: 'cSSO',
                joinAndCollaborate: 'joinAndCollaborate',
                projectDevelopment: 'projectDevelopment',
                publishProjects: 'publishProjects',
                buildAIEggs: 'buildaieggs',
            },
            [
                {
                    featureId: 'projectDevelopment',
                    on: true,
                },
                {
                    featureId: 'joinAndCollaborate',
                    on: true,
                },
                {
                    featureId: 'publishProjects',
                    on: false,
                },
                {
                    featureId: 'buildaieggs',
                    on: true,
                },
            ]
        );

        expect(result).toEqual({
            publishData: true,
            allowPublicData: false,
            allowAI: true,
            allowPublicInsts: true,
        });
    });

    it('should disable the allowPublicInsts feature if the joinAndCollaborate feature is disabled', () => {
        const result = getPrivacyFeaturesFromPermissions(
            {
                adultPrivoSSO: 'aSSO',
                childPrivoSSO: 'cSSO',
                joinAndCollaborate: 'joinAndCollaborate',
                projectDevelopment: 'projectDevelopment',
                publishProjects: 'publishProjects',
                buildAIEggs: 'buildaieggs',
            },
            [
                {
                    featureId: 'projectDevelopment',
                    on: true,
                },
                {
                    featureId: 'joinAndCollaborate',
                    on: false,
                },
                {
                    featureId: 'publishProjects',
                    on: true,
                },
                {
                    featureId: 'buildaieggs',
                    on: true,
                },
            ]
        );

        expect(result).toEqual({
            publishData: true,
            allowPublicData: true,
            allowAI: true,
            allowPublicInsts: false,
        });
    });

    it('should disable the allowAI feature if the buildAIEggs feature is disabled', () => {
        const result = getPrivacyFeaturesFromPermissions(
            {
                adultPrivoSSO: 'aSSO',
                childPrivoSSO: 'cSSO',
                joinAndCollaborate: 'joinAndCollaborate',
                projectDevelopment: 'projectDevelopment',
                publishProjects: 'publishProjects',
                buildAIEggs: 'buildaieggs',
            },
            [
                {
                    featureId: 'projectDevelopment',
                    on: true,
                },
                {
                    featureId: 'joinAndCollaborate',
                    on: true,
                },
                {
                    featureId: 'publishProjects',
                    on: true,
                },
                {
                    featureId: 'buildaieggs',
                    on: false,
                },
            ]
        );

        expect(result).toEqual({
            publishData: true,
            allowPublicData: true,
            allowAI: false,
            allowPublicInsts: true,
        });
    });
});

describe('findRelyingPartyForOrigin()', () => {
    const parties: RelyingParty[] = [
        {
            id: 'example',
            name: 'Test',
            origin: 'https://example.com',
        },
        {
            id: 'example',
            name: 'Test Port',
            origin: 'https://example.com:3000',
        },
        {
            id: 'different',
            name: 'Different with port',
            origin: 'https://different.com:3000',
        },
    ];

    it('should return the first relying party if there is no origin', () => {
        expect(findRelyingPartyForOrigin(parties, null)).toEqual(parties[0]);
    });

    it('should return the relying party that exactly matches the given origin', () => {
        expect(
            findRelyingPartyForOrigin(parties, 'https://different.com:3000')
        ).toEqual(parties[2]);
    });

    it('should return the relying party that matches the given domain and port', () => {
        expect(findRelyingPartyForOrigin(parties, 'example.com:3000')).toEqual(
            parties[1]
        );
    });
});

function codeNumber(code: Uint8Array): string {
    const v = new Uint32Array(code.buffer);
    const value = v[0];
    return padStart(value.toString().substring(0, 6), 6, '0');
}
