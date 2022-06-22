import { AddressType, AuthLoginRequest, AuthStore } from './AuthStore';
import { ServerError } from './Errors';
import { v4 as uuid } from 'uuid';
import { randomBytes } from 'tweetnacl';
import { hashPasswordWithSalt } from '@casual-simulation/crypto';
import { fromByteArray } from 'base64-js';
import { AuthMessenger } from './AuthMessenger';

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
            };
            const result = await this._messenger.sendCode(
                loginRequest.address,
                loginRequest.addressType,
                code
            );

            if (result.success === true) {
                if (newUser) {
                    await this._store.saveUser(user);
                }
                await this._store.saveLoginRequest(loginRequest);

                return {
                    success: true,
                    requestId: loginRequest.requestId,
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
            console.error('[AuthController] Error Occurred', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    // async completeLogin(request: CompleteLoginRequest): Promise<CompleteLoginResult> {

    // }
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
}

export type LoginRequestResult = LoginRequestSuccess | LoginRequestFailure;

export interface LoginRequestSuccess {
    success: true;

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
     * The ID of the login request.
     */
    requestId: string;

    /**
     * The code that was sent to the address.
     */
    code: string;
}

export type CompleteLoginResult = CompleteLoginSuccess | CompleteLoginFailure;

export interface CompleteLoginSuccess {
    success: true;

    /**
     * The ID of the user that the session is for.
     */
    userId: string;

    /**
     * The secret token that provides access for the session.
     */
    sessionToken: string;

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
