import {
    AuthController,
    LOGIN_REQUEST_CODE_BYTE_LENGTH,
    LOGIN_REQUEST_ID_BYTE_LENGTH,
    LOGIN_REQUEST_LIFETIME_MS,
} from './AuthController';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { hashPasswordWithSalt } from '@casual-simulation/crypto';

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
                });

                expect(response).toEqual({
                    success: true,
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
                });

                expect(response).toEqual({
                    success: true,
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
});
