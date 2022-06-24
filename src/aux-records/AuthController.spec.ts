import {
    AuthController,
    formatV1SessionKey,
    INVALID_KEY_ERROR_MESSAGE,
    LOGIN_REQUEST_CODE_BYTE_LENGTH,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
    parseSessionKey,
    SESSION_LIFETIME_MS,
} from './AuthController';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { hashPasswordWithSalt } from '@casual-simulation/crypto';
import { toBase64String } from './Utils';

const originalDateNow = Date.now;

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

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
                const code = new Uint8Array([4, 5, 6]);

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
                            fromByteArray(code),
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
                        code: fromByteArray(code),
                    },
                ]);

                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_ID_BYTE_LENGTH
                );
                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_CODE_BYTE_LENGTH
                );
            });

            it('should create a new login request for the existing user', async () => {
                await authStore.saveUser({
                    id: 'myid',
                    email: type === 'email' ? address : null,
                    phoneNumber: type === 'phone' ? address : null,
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6]);

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
                            fromByteArray(code),
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
                        code: fromByteArray(code),
                    },
                ]);

                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_ID_BYTE_LENGTH
                );
                expect(randomBytesMock).toHaveBeenCalledWith(
                    LOGIN_REQUEST_CODE_BYTE_LENGTH
                );
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
                    errorCode: 'invalid_address',
                    errorMessage: 'The address is invalid.',
                });

                const salt = new Uint8Array([1, 2, 3]);
                const code = new Uint8Array([4, 5, 6]);

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
                    errorCode: 'invalid_address',
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
    });

    describe('completeLogin()', () => {
        const cases = [
            ['email', 'test@example.com'] as const,
            ['phone', '+15559321234'] as const,
        ];

        describe.each(cases)('%s', (type, address) => {
            it('should create a new session and return the session token', async () => {
                const requestId = fromByteArray(new Uint8Array([1, 2, 3]));
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
                        fromByteArray(sessionSecret)
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
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
                const code = fromByteArray(new Uint8Array([4, 5, 6]));
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
    });

    describe('validateSessionKey()', () => {
        describe('v1 keys', () => {
            it('should return the User ID if given a valid key', async () => {
                const requestId = 'requestId';
                const sessionId = 'sessionId';
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(userId, sessionId, code);

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(
                        code,
                        toBase64String(sessionId)
                    ),
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
                });
            });

            it('should fail if the session secret doesnt match the hash', async () => {
                const requestId = 'requestId';
                const sessionId = 'sessionId';
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(
                    userId,
                    sessionId,
                    'wrong'
                );

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(
                        code,
                        toBase64String(sessionId)
                    ),
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
                const sessionId = 'sessionId';
                const code = 'code';
                const userId = 'myid';

                const sessionKey = 'wrong';

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(
                        code,
                        toBase64String(sessionId)
                    ),
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

            it('should fail if the session has expired', async () => {
                const requestId = 'requestId';
                const sessionId = 'sessionId';
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(userId, sessionId, code);

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(
                        code,
                        toBase64String(sessionId)
                    ),
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
                const sessionId = 'sessionId';
                const code = 'code';
                const userId = 'myid';

                const sessionKey = formatV1SessionKey(userId, sessionId, code);

                await authStore.saveSession({
                    requestId,
                    sessionId,
                    secretHash: hashPasswordWithSalt(
                        code,
                        toBase64String(sessionId)
                    ),
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
        });
    });

    describe('revokeSessionKey()', () => {
        it('should mark the given session as revoked', async () => {
            const requestId = 'requestId';
            const sessionId = 'sessionId';
            const code = 'code';
            const userId = 'myid';

            await authStore.saveSession({
                requestId,
                sessionId,
                secretHash: hashPasswordWithSalt(
                    code,
                    toBase64String(sessionId)
                ),
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
            const userId = 'myid';

            nowMock.mockReturnValue(400);

            const result = await controller.revokeSession({
                userId: userId,
                sessionId: 'missing',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'session_not_found',
                errorMessage: 'The session was not found.',
            });
        });

        it('should fail if the session is already revoked', async () => {
            const userId = 'myid';

            await authStore.saveSession({
                requestId: 'requestId',
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
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'session_revoked',
                errorMessage: 'The session has already been revoked.',
            });
        });
    });
});

describe('formatV1SessionKey()', () => {
    it('should combine the given user id, session id, and password', () => {
        const result = formatV1SessionKey('userId', 'sessionId', 'password');

        const [version, userId, sessionId, password] = result.split('.');

        expect(version).toBe('vSK1');
        expect(userId).toBe(toBase64String('userId'));
        expect(sessionId).toBe(toBase64String('sessionId'));
        expect(password).toBe(toBase64String('password'));
    });
});

describe('parseSessionKey()', () => {
    describe('v1', () => {
        it('should parse the given key into the userId, sessionId, and password', () => {
            const key = formatV1SessionKey('userId', 'sessionId', 'password');
            const [userId, sessionId, password] = parseSessionKey(key);

            expect(userId).toBe('userId');
            expect(sessionId).toBe('sessionId');
            expect(password).toBe('password');
        });

        it('should return null if given an empty string', () => {
            const result = parseSessionKey('');

            expect(result).toBe(null);
        });

        it('should return null if given a string with the wrong version', () => {
            const result = parseSessionKey('vK1');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no data', () => {
            const result = parseSessionKey('vSK1.');

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session ID', () => {
            const result = parseSessionKey(`vSK1.${toBase64String('userId')}`);

            expect(result).toBe(null);
        });

        it('should return null if given a string with no session password', () => {
            const result = parseSessionKey(
                `vSK1.${toBase64String('userId')}.${toBase64String(
                    'sessionId'
                )}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseSessionKey(null);

            expect(result).toBe(null);
        });
    });
});
