import {
    AuthController,
    CompleteLoginSuccess,
    INVALID_KEY_ERROR_MESSAGE,
    ListSessionsSuccess,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
    SESSION_LIFETIME_MS,
} from './AuthController';
import {
    formatV1OpenAiKey,
    formatV1SessionKey,
    parseSessionKey,
} from './AuthUtils';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray, toByteArray } from 'base64-js';
import {
    hashHighEntropyPasswordWithSalt,
    hashPasswordWithSalt,
} from '@casual-simulation/crypto';
import { fromBase64String, toBase64String } from './Utils';
import { padStart } from 'lodash';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';

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
    let authStore: MemoryAuthStore;
    let messenger: MemoryAuthMessenger;
    let controller: AuthController;
    let subscriptionConfig: SubscriptionConfiguration;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        nowMock = Date.now = jest.fn();
        authStore = new MemoryAuthStore();
        messenger = new MemoryAuthMessenger();
        subscriptionConfig = {
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
        };
        controller = new AuthController(
            authStore,
            messenger,
            subscriptionConfig
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
                    expect(authStore.users).toEqual([
                        {
                            id: 'uuid1',
                            email: address,
                            phoneNumber: null,
                            currentLoginRequestId: fromByteArray(salt),
                            allSessionRevokeTimeMs: null,
                        },
                    ]);
                } else {
                    expect(authStore.users).toEqual([
                        {
                            id: 'uuid1',
                            email: null,
                            phoneNumber: address,
                            currentLoginRequestId: fromByteArray(salt),
                            allSessionRevokeTimeMs: null,
                        },
                    ]);
                }

                expect(authStore.loginRequests).toEqual([
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
                await authStore.saveUser({
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

                expect(authStore.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: fromByteArray(salt),
                    },
                ]);

                expect(authStore.loginRequests).toEqual([
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
                await authStore.saveUser({
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
                    authStore.emailRules.push({
                        pattern: `^${address}$`,
                        type: 'deny',
                    });
                } else {
                    authStore.smsRules.push({
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

                expect(authStore.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        currentLoginRequestId: fromByteArray(salt),
                    },
                ]);

                expect(authStore.loginRequests).toEqual([
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

                expect(authStore.users).toEqual([]);
                expect(authStore.loginRequests).toEqual([]);
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

                expect(authStore.users).toEqual([]);
                expect(authStore.loginRequests).toEqual([]);
                expect(messenger.messages).toEqual([]);

                expect(randomBytesMock).toHaveBeenCalled();
                expect(randomBytesMock).toHaveBeenCalled();
                expect(uuidMock).toHaveBeenCalled();
            });

            it('should fail if the user is banned', async () => {
                await authStore.saveUser({
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

                expect(authStore.users).toEqual([
                    {
                        id: 'myid',
                        email: type === 'email' ? address : null,
                        phoneNumber: type === 'phone' ? address : null,
                        banTimeMs: 1,
                        banReason: 'terms_of_service_violation',
                    },
                ]);

                expect(authStore.loginRequests).toEqual([]);
                expect(messenger.messages).toEqual([]);
            });
        });

        it('should fail if the given email is longer than 200 characters long', async () => {
            const salt = new Uint8Array([1, 2, 3]);
            const code = new Uint8Array([4, 5, 6, 7]);

            nowMock.mockReturnValue(100);
            randomBytesMock.mockReturnValueOnce(salt).mockReturnValueOnce(code);
            uuidMock.mockReturnValueOnce('uuid1');

            authStore.emailRules.push({
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

            expect(authStore.users).toEqual([]);
            expect(authStore.loginRequests).toEqual([]);
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

            authStore.emailRules.push({
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

            expect(authStore.users).toEqual([]);
            expect(authStore.loginRequests).toEqual([]);
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

            authStore.emailRules.push({
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

            expect(authStore.users).toEqual([]);
            expect(authStore.loginRequests).toEqual([]);
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

            authStore.smsRules.push({
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

            expect(authStore.users).toEqual([]);
            expect(authStore.loginRequests).toEqual([]);
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

                    expect(authStore.users).toEqual([]);
                    expect(authStore.loginRequests).toEqual([]);
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

                    expect(authStore.users).toEqual([]);
                    expect(authStore.loginRequests).toEqual([]);
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

                    expect(authStore.users).toEqual([]);
                    expect(authStore.loginRequests).toEqual([]);
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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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
                    expireTimeMs: 150 + SESSION_LIFETIME_MS,
                });

                expect(randomBytesMock).toHaveBeenCalledTimes(2);
                expect(randomBytesMock).toHaveBeenNthCalledWith(1, 16); // Should request 16 bytes (128 bits) for the session ID
                expect(randomBytesMock).toHaveBeenNthCalledWith(2, 16); // Should request 16 bytes (128 bits) for the session secret

                expect(authStore.sessions).toEqual([
                    {
                        userId: 'myid',
                        sessionId: fromByteArray(sessionId),

                        // It should treat session secrets as high-entropy
                        secretHash: hashHighEntropyPasswordWithSalt(
                            fromByteArray(sessionSecret),
                            fromByteArray(sessionId)
                        ),
                        grantedTimeMs: 150,
                        expireTimeMs: 150 + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: requestId,
                        previousSessionId: null,
                        nextSessionId: null,
                        ipAddress: '127.0.0.1',
                    },
                ]);
                expect(authStore.loginRequests).toEqual([
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
                expect(authStore.users).toEqual([
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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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
                    await authStore.findLoginRequest('myid', requestId)
                ).toHaveProperty('attemptCount', 1);
            });

            it('should fail if the login request has expired', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = codeNumber(new Uint8Array([4, 5, 6, 7]));
                const sessionId = new Uint8Array([7, 8, 9]);
                const sessionSecret = new Uint8Array([10, 11, 12]);

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: requestId,
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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

                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                    currentLoginRequestId: 'wrong',
                    allSessionRevokeTimeMs: undefined,
                });

                await authStore.saveLoginRequest({
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
                    .mockReturnValueOnce(sessionSecret);

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
                    expect(authStore.sessions).toEqual([]);
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
                    expect(authStore.sessions).toEqual([]);
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
                    expect(authStore.sessions).toEqual([]);
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
                    expect(authStore.sessions).toEqual([]);
                }
            );
        });
    });

    describe('validateSessionKey()', () => {
        describe('v1 keys', () => {
            beforeEach(async () => {
                await authStore.saveUser({
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

                    await authStore.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashPasswordWithSalt(code, sessionId),
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

                    await authStore.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashPasswordWithSalt(code, sessionId),
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

                    await authStore.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
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

                    await authStore.saveSession({
                        requestId,
                        sessionId,
                        secretHash: hashHighEntropyPasswordWithSalt(
                            code,
                            sessionId
                        ),
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
            });

            it('should fail if the key is malformed', async () => {
                const requestId = 'requestId';
                const sessionId = toBase64String('sessionId');
                const code = 'code';
                const userId = 'myid';

                const sessionKey = 'wrong';

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(code, sessionId),
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

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(code, sessionId),
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

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(code, sessionId),
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

                await authStore.saveUser({
                    id: userId,
                    email: 'email',
                    phoneNumber: 'phonenumber',
                    allSessionRevokeTimeMs: 101,
                    currentLoginRequestId: requestId,
                });

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(code, sessionId),
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

            await authStore.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
            });

            await authStore.saveLoginRequest({
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
                .mockReturnValueOnce(sessionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

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

            await authStore.saveUser({
                id: 'myid',
                email: address,
                phoneNumber: address,
                currentLoginRequestId: requestId,
                allSessionRevokeTimeMs: undefined,
            });

            await authStore.saveLoginRequest({
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
                .mockReturnValueOnce(sessionSecret);

            const response = (await controller.completeLogin({
                userId: 'myid',
                requestId: requestId,
                code: code,
                ipAddress: '127.0.0.1',
            })) as CompleteLoginSuccess;

            await authStore.saveUser({
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

    describe('revokeSessionKey()', () => {
        beforeEach(async () => {
            await authStore.saveUser({
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
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
            expect(await authStore.findSession(userId, 'otherSession')).toEqual(
                {
                    requestId,
                    sessionId: 'otherSession',
                    secretHash: 'otherHash',
                    expireTimeMs: 1000,
                    grantedTimeMs: 100,
                    previousSessionId: null,
                    nextSessionId: null,
                    revokeTimeMs: 400,
                    userId,
                    ipAddress: '127.0.0.1',
                }
            );
        });

        it('should fail if the session could not be found', async () => {
            const requestId = 'requestId';
            const sessionId = toBase64String('sessionId');
            const code = 'code';
            const userId = 'myid';

            const sessionKey = formatV1SessionKey(userId, sessionId, code, 200);

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId: 'wrong user',
                ipAddress: '127.0.0.1',
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId: 'wrong user',
                ipAddress: '127.0.0.1',
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: 200,
                userId,
                ipAddress: '127.0.0.1',
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'otherSession',
                secretHash: 'otherHash',
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
            await authStore.saveUser({
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

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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
            expect(await authStore.findUser(userId)).toEqual({
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

        beforeEach(async () => {
            await authStore.saveUser({
                id: 'myid',
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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

            nowMock.mockReturnValue(150);
            randomBytesMock
                .mockReturnValueOnce(newSessionId)
                .mockReturnValueOnce(newSessionSecret);

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
                expireTimeMs: 150 + SESSION_LIFETIME_MS,
            });

            expect(await authStore.findSession(userId, sessionId)).toEqual({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
                nextSessionId: fromByteArray(newSessionId),
                revokeTimeMs: 150,
                userId,
                ipAddress: '127.0.0.1',
            });

            expect(
                await authStore.findSession(userId, fromByteArray(newSessionId))
            ).toEqual({
                previousSessionId: sessionId,
                nextSessionId: null,
                sessionId: fromByteArray(newSessionId),
                userId,
                secretHash: hashPasswordWithSalt(
                    fromByteArray(newSessionSecret),
                    fromByteArray(newSessionId)
                ),
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
            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 999,
                previousSessionId: null,
                nextSessionId: null,
                revokeTimeMs: null,
                userId,
                ipAddress: '127.0.0.1',
            });

            for (let i = 0; i < 20; i++) {
                await authStore.saveSession({
                    requestId,
                    sessionId: 'session' + (i + 1),
                    secretHash: 'hash' + (i + 1),
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
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                allSessionRevokeTimeMs: 111,
                currentLoginRequestId: undefined,
            });

            await authStore.saveSession({
                requestId,
                sessionId: 'session20',
                secretHash: 'hash20',
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
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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
                openAiKey: null,
            });
        });

        it('should work if there is no subscription config', async () => {
            subscriptionConfig = null as any;
            controller = new AuthController(
                authStore,
                messenger,
                subscriptionConfig,
                false
            );

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
                openAiKey: null,
            });
        });

        it('should include the openAiKey if the user has an active subscription', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'active',
                openAiKey: 'api_key',
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
                subscriptionTier: 'beta', // should use the default subscription
                openAiKey: 'api_key',
            });
        });

        it('should include the subscription tier from the subscription matching the user subscriptionId', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'active',
                subscriptionId: 'sub_2',
                openAiKey: 'api_key',
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
                openAiKey: 'api_key',
            });
        });

        it('should not include the openAiKey if the user has an inactive subscription', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'canceled',
                openAiKey: 'api_key',
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
                hasActiveSubscription: false,
                subscriptionTier: null,
                openAiKey: null,
            });
        });

        it('should include the openAiKey if subscription features are force automatically enabled', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'canceled',
                openAiKey: 'api_key',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            controller = new AuthController(
                authStore,
                messenger,
                subscriptionConfig,
                true
            );

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
                subscriptionTier: 'beta',
                openAiKey: 'api_key',
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
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
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

            const user = await authStore.findUser(userId);

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

        it('should be able to update the openAiKey if the user has an active subscription', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'active',
                openAiKey: 'old api key',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    name: 'New Name',
                    avatarUrl: 'New Avatar URL',
                    avatarPortraitUrl: 'New Portrait',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                    openAiKey: 'new API Key',
                },
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await authStore.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'New Avatar URL',
                avatarPortraitUrl: 'New Portrait',
                email: 'new email',
                phoneNumber: 'new phone number',
                subscriptionStatus: 'active',
                openAiKey: expect.any(String),
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            expect(user.openAiKey).toBe(formatV1OpenAiKey('new API Key'));
        });

        it('should not be able to update the openAiKey if the user does not have an active subscription', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'canceled',
                openAiKey: 'old api key',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    name: 'New Name',
                    avatarUrl: 'New Avatar URL',
                    avatarPortraitUrl: 'New Portrait',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                    openAiKey: 'new API Key',
                },
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await authStore.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'New Avatar URL',
                avatarPortraitUrl: 'New Portrait',
                email: 'new email',
                phoneNumber: 'new phone number',
                subscriptionStatus: 'canceled',
                openAiKey: 'old api key',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });
        });

        it('should be able to update the openAiKey if subscription features are force enabled', async () => {
            await authStore.saveUser({
                id: userId,
                email: 'email',
                phoneNumber: 'phonenumber',
                name: 'Test',
                avatarUrl: 'avatar url',
                avatarPortraitUrl: 'avatar portrait url',
                subscriptionStatus: 'canceled',
                openAiKey: 'old api key',
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            controller = new AuthController(
                authStore,
                messenger,
                subscriptionConfig,
                true
            );

            const result = await controller.updateUserInfo({
                userId,
                sessionKey,
                update: {
                    name: 'New Name',
                    avatarUrl: 'New Avatar URL',
                    avatarPortraitUrl: 'New Portrait',
                    email: 'new email',
                    phoneNumber: 'new phone number',
                    openAiKey: 'new API Key',
                },
            });

            expect(result).toEqual({
                success: true,
                userId: userId,
            });

            const user = await authStore.findUser(userId);

            expect(user).toEqual({
                id: userId,
                name: 'New Name',
                avatarUrl: 'New Avatar URL',
                avatarPortraitUrl: 'New Portrait',
                email: 'new email',
                phoneNumber: 'new phone number',
                subscriptionStatus: 'canceled',
                openAiKey: expect.any(String),
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
            });

            expect(user.openAiKey).toBe(formatV1OpenAiKey('new API Key'));
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

            const user = await authStore.findUser(userId);

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

            const user = await authStore.findUser(userId);

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

            const user = await authStore.findUser(userId);

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
            authStore.emailRules.push({
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
            authStore.smsRules.push({
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
