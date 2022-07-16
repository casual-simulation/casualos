import {
    AuthController,
    CompleteLoginSuccess,
    INVALID_KEY_ERROR_MESSAGE,
    ListSessionsSuccess,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
    SESSION_LIFETIME_MS,
} from './AuthController';
import { formatV1SessionKey, parseSessionKey } from './AuthUtils';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { hashPasswordWithSalt } from '@casual-simulation/crypto';
import { toBase64String } from './Utils';
import { padStart } from 'lodash';

const originalDateNow = Date.now;

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();

const randomBytesMock: jest.Mock<Uint8Array, [number]> = <any>randomBytes;
jest.mock('tweetnacl');

describe('AuthController', () => {
    let authStore: MemoryAuthStore;
    let messenger: MemoryAuthMessenger;
    let controller: AuthController;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        nowMock = Date.now = jest.fn();
        authStore = new MemoryAuthStore();
        messenger = new MemoryAuthMessenger();
        controller = new AuthController(authStore, messenger);

        uuidMock.mockReset();
        randomBytesMock.mockReset();
    });

    afterEach(() => {
        Date.now = originalDateNow;
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
                        },
                    ]);
                } else {
                    expect(authStore.users).toEqual([
                        {
                            id: 'uuid1',
                            email: null,
                            phoneNumber: address,
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

                expect(authStore.sessions).toEqual([
                    {
                        userId: 'myid',
                        sessionId: fromByteArray(sessionId),
                        secretHash: hashPasswordWithSalt(
                            fromByteArray(sessionSecret),
                            fromByteArray(sessionId)
                        ),
                        grantedTimeMs: 150,
                        expireTimeMs: 150 + SESSION_LIFETIME_MS,
                        revokeTimeMs: null,
                        requestId: requestId,
                        previousSessionId: null,
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
                });
            });

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
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.validateSessionKey(sessionKey);

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
                    revokeTimeMs: null,
                    userId,
                    ipAddress: '127.0.0.1',
                });

                const result = await controller.validateSessionKey(sessionKey);

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
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
                });

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(code, sessionId),
                    expireTimeMs: 1000,
                    grantedTimeMs: 100,
                    previousSessionId: null,
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
            });

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(code, sessionId),
                expireTimeMs: 1000,
                grantedTimeMs: 100,
                previousSessionId: null,
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
                    grantedTimeMs: 100,
                    previousSessionId: null,
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
                grantedTimeMs: 100,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
            });
            expect(result.sessions[9]).toEqual({
                sessionId: 'session11',
                userId: 'myid',
                expireTimeMs: 1011,
                grantedTimeMs: 100,
                revokeTimeMs: null,
                ipAddress: '127.0.0.1',
                currentSession: false,
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
});

function codeNumber(code: Uint8Array): string {
    const v = new Uint32Array(code.buffer);
    const value = v[0];
    return padStart(value.toString().substring(0, 6), 6, '0');
}
