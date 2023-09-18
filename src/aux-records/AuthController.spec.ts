import {
    AuthController,
    CompleteLoginSuccess,
    INVALID_KEY_ERROR_MESSAGE,
    INVALID_TOKEN_ERROR_MESSAGE,
    ListSessionsSuccess,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
    SESSION_LIFETIME_MS,
} from './AuthController';
import {
    formatV1ConnectionKey,
    formatV1OpenAiKey,
    formatV1SessionKey,
    generateV1ConnectionToken,
    parseSessionKey,
} from './AuthUtils';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray, toByteArray } from 'base64-js';
import {
    hashHighEntropyPasswordWithSalt,
    hashPasswordWithSalt,
} from '@casual-simulation/crypto';
import {
    fromBase64String,
    toBase64String,
} from '@casual-simulation/aux-common';
import { padStart } from 'lodash';
import {
    allowAllFeatures,
    SubscriptionConfiguration,
} from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';

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

console.log = jest.fn();

const randomBytesMock: jest.Mock<Uint8Array, [number]> = <any>randomBytes;

describe('AuthController', () => {
    let store: MemoryStore;
    let messenger: MemoryAuthMessenger;
    let controller: AuthController;
    let nowMock: jest.Mock<number>;

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
                        defaultSubscription: true,
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

        controller = new AuthController(store, messenger, store);

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
                        secretHash: hashPasswordWithSalt(
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
                        secretHash: hashPasswordWithSalt(
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
                        secretHash: hashPasswordWithSalt(
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                        secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                    secretHash: hashPasswordWithSalt(code, requestId),
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
                        secretHash: hashPasswordWithSalt(code, sessionId),
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
                        secretHash: hashPasswordWithSalt(code, sessionId),
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
                        secretHash: hashPasswordWithSalt(code, sessionId),
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
                    secretHash: hashPasswordWithSalt(code, sessionId),
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
                    secretHash: hashPasswordWithSalt(code, sessionId),
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
                    secretHash: hashPasswordWithSalt(code, sessionId),
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
                    secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, requestId),
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
                secretHash: hashPasswordWithSalt(code, requestId),
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
                secretHash: hashPasswordWithSalt(code, requestId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
            });

            expect(await store.findSession(userId, sessionId)).toEqual({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
    });

    describe('getUserInfo()', () => {
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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

        it('should return the info for the given user ID', async () => {
            const result = await controller.getUserInfo({
                userId,
                sessionKey,
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
            });
        });

        it('should work if there is no subscription config', async () => {
            store.subscriptionConfiguration = null;

            const result = await controller.getUserInfo({
                userId,
                sessionKey,
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
                sessionKey,
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
            });
        });

        it('should return a invalid_key response when the user ID doesnt match the given session key', async () => {
            const result = await controller.getUserInfo({
                userId: 'myOtherUser',
                sessionKey,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: INVALID_KEY_ERROR_MESSAGE,
            });
        });

        it('should return a invalid_key response given an invalid session key', async () => {
            const result = await controller.getUserInfo({
                userId,
                sessionKey: formatV1SessionKey(
                    userId,
                    sessionId,
                    'wrong session secret',
                    1000
                ),
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
                'it should fail if given a %s userId',
                async (desc, id) => {
                    const result = await controller.getUserInfo({
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
                    const result = await controller.getUserInfo({
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
                secretHash: hashPasswordWithSalt(code, sessionId),
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
});

function codeNumber(code: Uint8Array): string {
    const v = new Uint32Array(code.buffer);
    const value = v[0];
    return padStart(value.toString().substring(0, 6), 6, '0');
}
