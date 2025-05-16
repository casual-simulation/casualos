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
import axios from 'axios';
import type { Subject, Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import type { AppMetadata } from '../../../aux-backend/shared/AuthMetadata';
import { isExpired, parseSessionKey } from '@casual-simulation/aux-common';
import type {
    CompleteLoginResult,
    LoginRequestResult,
    PrivoSignUpRequestResult,
    ProcessOpenIDAuthorizationCodeResult,
    CompleteOpenIDLoginResult,
    IsValidEmailAddressResult,
    RequestWebAuthnLoginResult,
    RequestWebAuthnRegistrationResult,
    CompleteWebAuthnLoginResult,
    CompleteWebAuthnRegistrationResult,
    CompleteWebAuthnLoginSuccess,
    CompleteLoginSuccess,
    ValidateSessionKeyFailure,
    RevokeSessionSuccess,
} from '@casual-simulation/aux-records/AuthController';
import type { AddressType } from '@casual-simulation/aux-records/AuthStore';
import type {
    GetSubscriptionStatusResult,
    CreateManageSubscriptionResult,
    GetSubscriptionStatusSuccess,
    CreateManageSubscriptionRequest,
    GetSubscriptionStatusRequest,
} from '@casual-simulation/aux-records/SubscriptionController';
import type { PrivoSignUpInfo } from '@casual-simulation/aux-vm';
import type { RemoteCausalRepoProtocol } from '@casual-simulation/aux-common';

import {
    startAuthentication,
    startRegistration,
} from '@simplewebauthn/browser';

/* eslint-disable casualos/no-non-type-imports */
import { createRecordsClient } from '@casual-simulation/aux-records/RecordsClient';

const EMAIL_KEY = 'userEmail';
const ACCEPTED_TERMS_KEY = 'acceptedTerms';
const SESSION_KEY = 'sessionKey';
const CONNECTION_KEY = 'connectionKey';
export const OAUTH_LOGIN_CHANNEL_NAME = 'aux-login-oauth';

declare const ASSUME_SUBSCRIPTIONS_SUPPORTED: boolean;

if (typeof (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED === 'undefined') {
    (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED = false;
}

console.log(
    `[AuthManager] Assume subscriptions supported: ${ASSUME_SUBSCRIPTIONS_SUPPORTED}`
);

declare const ASSUME_STUDIOS_SUPPORTED: boolean;

if (typeof (globalThis as any).ASSUME_STUDIOS_SUPPORTED === 'undefined') {
    (globalThis as any).ASSUME_STUDIOS_SUPPORTED = false;
}

console.log(
    `[AuthManager] Assume studios supported: ${ASSUME_STUDIOS_SUPPORTED}`
);

declare const USE_PRIVO_LOGIN: boolean;

if (typeof (globalThis as any).USE_PRIVO_LOGIN === 'undefined') {
    (globalThis as any).USE_PRIVO_LOGIN = false;
}

console.log(`[AuthManager] Use Privo Login: ${USE_PRIVO_LOGIN}`);

declare let ENABLE_SMS_AUTHENTICATION: boolean;

declare let SUPPORT_URL: string;

export class AuthManager {
    private _userId: string;
    private _sessionId: string;
    private _appMetadata: AppMetadata;
    private _subscriptionsSupported: boolean;
    private _studiosSupported: boolean;
    private _usePrivoLogin: boolean;

    private _loginState: Subject<boolean>;
    private _apiEndpoint: string;
    private _websocketEndpoint: string;
    private _websocketProtocol: RemoteCausalRepoProtocol;
    private _gitTag: string;
    private _client: ReturnType<typeof createRecordsClient>;

    private _temporarySessionKey: string;
    private _temporaryConnectionKey: string;

    constructor(
        apiEndpoint: string,
        websocketEndpoint: string,
        websocketProtocol: RemoteCausalRepoProtocol,
        gitTag: string
    ) {
        this._apiEndpoint = apiEndpoint;
        this._websocketEndpoint = websocketEndpoint;
        this._websocketProtocol = websocketProtocol;
        this._gitTag = gitTag;
        this._loginState = new BehaviorSubject<boolean>(false);
        this._subscriptionsSupported = ASSUME_SUBSCRIPTIONS_SUPPORTED;
        this._studiosSupported = ASSUME_STUDIOS_SUPPORTED;
        this._usePrivoLogin = USE_PRIVO_LOGIN;
        this._client = createRecordsClient(this.apiEndpoint);
        this._updateClientSessionKey();
    }

    get supportUrl() {
        return SUPPORT_URL;
    }

    get userId() {
        return this._userId;
    }

    get sessionId() {
        return this._sessionId;
    }

    get email() {
        return this._appMetadata?.email;
    }

    get phone() {
        return this._appMetadata?.phoneNumber;
    }

    get avatarUrl() {
        return this._appMetadata?.avatarUrl;
    }

    get avatarPortraitUrl() {
        return this._appMetadata?.avatarPortraitUrl;
    }

    get name() {
        return this._appMetadata?.name;
    }

    get displayName() {
        return this._appMetadata?.displayName;
    }

    get privacyFeatures() {
        return this._appMetadata?.privacyFeatures;
    }

    get subscriptionsSupported() {
        return this._subscriptionsSupported;
    }

    get hasActiveSubscription() {
        return this._appMetadata?.hasActiveSubscription;
    }

    get subscriptionTier() {
        return this._appMetadata?.subscriptionTier;
    }

    get studiosSupported() {
        return this._studiosSupported;
    }

    get usePrivoLogin() {
        return this._usePrivoLogin;
    }

    get supportsSms() {
        return ENABLE_SMS_AUTHENTICATION === true;
    }

    get userInfoLoaded() {
        return (
            !!this._userId && !!this.currentSessionKey && !!this._appMetadata
        );
    }

    get loginState(): Observable<boolean> {
        return this._loginState;
    }

    get client() {
        return this._client;
    }

    /**
     * Determines if the given email address is valid.
     * @param email The email address to check.
     * @param structureOnly Whether to only check that the email address is structured correctly.
     * @returns
     */
    async validateEmail(
        email: string,
        structureOnly?: boolean
    ): Promise<boolean> {
        const result = await this.isValidEmailAddress(email, structureOnly);

        if (result.success) {
            return result.allowed;
        } else {
            // Return true so that the server can validate when we get a server error.
            return true;
        }
    }

    /**
     * Determines if the given email address is valid.
     * @param email The email address to check.
     * @param structureOnly Whether to only check that the email address is structured correctly.
     * @returns
     */
    async isValidEmailAddress(
        email: string,
        structureOnly?: boolean
    ): Promise<IsValidEmailAddressResult> {
        // Validation is handled on the server
        const indexOfAt = email.indexOf('@');
        if (indexOfAt < 0 || indexOfAt >= email.length) {
            return {
                success: true,
                allowed: false,
            };
        }

        if (structureOnly) {
            return {
                success: true,
                allowed: true,
            };
        }

        return this.client.isEmailValid({
            email,
        });
    }

    async validateSmsNumber(sms: string): Promise<boolean> {
        // Validation is handled on the server
        return true;
    }

    isLoggedIn(): boolean {
        const sessionKey = this.currentSessionKey;
        if (!sessionKey) {
            return false;
        }
        const parsed = parseSessionKey(sessionKey);
        if (!parsed) {
            return false;
        }

        const [userId, sessionId, sessionSecret, expireTimeMs] = parsed;
        if (isExpired(expireTimeMs)) {
            return false;
        }

        return true;
    }

    async loadUserInfo() {
        const [userId, sessionId, sessionSecret, expireTimeMs] =
            parseSessionKey(this.currentSessionKey);
        this._userId = userId;
        this._sessionId = sessionId;
        this._appMetadata = await this._loadAppMetadata();

        if (!this._appMetadata) {
            this._userId = null;
            this._sessionId = null;
            if (this._temporarySessionKey) {
                this._temporarySessionKey = null;
                this._temporaryConnectionKey = null;
            } else {
                this.savedSessionKey = null;
                this.savedConnectionKey = null;
            }
        } else {
            this._saveAcceptedTerms(true);
            if (this.email) {
                this._saveEmail(this.email);
            }
        }

        this._loginState.next(this.userInfoLoaded);
        return this.userInfoLoaded;
    }

    async loginWithWebAuthn(
        useBrowserAutofill?: boolean
    ): Promise<CompleteWebAuthnLoginResult | RequestWebAuthnLoginResult> {
        const optionsResult = await this.client.getWebAuthnLoginOptions();
        if (optionsResult.success === true) {
            try {
                const response = await startAuthentication(
                    optionsResult.options,
                    useBrowserAutofill
                );
                const result = await this.client.completeWebAuthnLogin({
                    requestId: optionsResult.requestId,
                    response,
                });

                if (result.success === true) {
                    this.updateLoginStateFromResult(result);
                }

                return result;
            } catch (err) {
                console.error(
                    '[AuthManager] Error while logging in with WebAuthn:',
                    err
                );
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'Error: ' + err.message,
                };
            }
        }
        return optionsResult;
    }

    updateLoginStateFromResult(
        result: CompleteLoginSuccess | CompleteWebAuthnLoginSuccess
    ): void {
        this.savedSessionKey = result.sessionKey;
        this.savedConnectionKey = result.connectionKey;
        this._userId = result.userId;

        this._temporarySessionKey = null;
        this._temporaryConnectionKey = null;
    }

    useTemporaryKeys(sessionKey: string, connectionKey: string) {
        if (sessionKey && connectionKey) {
            console.log('[AuthManager] Using temporary keys.');
            const [userId, sessionId] = parseSessionKey(sessionKey);
            this._temporarySessionKey = sessionKey;
            this._temporaryConnectionKey = connectionKey;
            this._sessionId = sessionId;
            this._userId = userId;
            this._updateClientSessionKey();
        }
    }

    private _updateClientSessionKey() {
        this._client.sessionKey = this.currentSessionKey;
    }

    async addPasskeyWithWebAuthn(): Promise<
        | RequestWebAuthnRegistrationResult
        | CompleteWebAuthnRegistrationResult
        | ValidateSessionKeyFailure
    > {
        const optionsResult =
            await this.client.getWebAuthnRegistrationOptions();
        if (optionsResult.success === true) {
            try {
                const response = await startRegistration(optionsResult.options);
                const result = await this.client.registerWebAuthn({
                    response,
                });
                return result;
            } catch (error) {
                console.error(error);
                if (error.name === 'InvalidStateError') {
                    return {
                        success: true,
                    };
                } else {
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'Error: ' + error.message,
                    };
                }
            }
        }
        return optionsResult;
    }

    async logout(revokeSessionKey: boolean = true) {
        let logoutUrl: string;
        if (this.currentSessionKey === this.savedSessionKey) {
            const sessionKey = this.savedSessionKey;
            if (sessionKey) {
                this.savedSessionKey = null;
                if (revokeSessionKey) {
                    const result = await this._revokeSessionKey(sessionKey);
                    logoutUrl = result?.logoutUrl;
                }
            }
            this.savedConnectionKey = null;
        }
        this._temporaryConnectionKey = null;
        this._temporarySessionKey = null;
        this._userId = null;
        this._sessionId = null;
        this._appMetadata = null;
        this._saveEmail(null);
        this._loginState.next(false);

        if (logoutUrl) {
            if (inIframe()) {
                console.log('[AuthManager] Logging out in iframe', logoutUrl);
                window.open(logoutUrl);
            } else {
                location.href = logoutUrl;
            }
        }
    }

    async listSubscriptions(): Promise<GetSubscriptionStatusSuccess> {
        const url = new URL(
            `${this.apiEndpoint}/api/${this.userId}/subscription`
        );
        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as GetSubscriptionStatusResult;

        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
            return null;
        }
    }

    async listSubscriptionsV2(
        request: Pick<GetSubscriptionStatusRequest, 'studioId' | 'userId'>
    ): Promise<GetSubscriptionStatusSuccess> {
        const url = new URL(`${this.apiEndpoint}/api/v2/subscriptions`);

        if ('studioId' in request) {
            url.searchParams.set('studioId', request.studioId);
        }
        if ('userId' in request) {
            url.searchParams.set('userId', request.userId);
        }

        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
            validateStatus: (status) => status < 500 || status === 501,
        });

        const result = response.data as GetSubscriptionStatusResult;

        if (result.success === true) {
            return result;
        } else {
            if (result.errorCode === 'not_supported') {
                return null;
            }
            return null;
        }
    }

    async manageSubscriptions(
        options?: Pick<
            CreateManageSubscriptionRequest,
            'subscriptionId' | 'expectedPrice'
        >
    ): Promise<void> {
        const url = new URL(
            `${this.apiEndpoint}/api/${this.userId}/subscription/manage`
        );
        const response = await axios.post(url.href, !!options ? options : {}, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as CreateManageSubscriptionResult;

        if (result.success === true) {
            location.href = result.url;
        } else {
            console.error(
                '[AuthManager] Unable to manage subscriptions!',
                result
            );
        }
    }

    async manageSubscriptionsV2(
        options: Pick<
            CreateManageSubscriptionRequest,
            'subscriptionId' | 'expectedPrice' | 'userId' | 'studioId'
        >
    ): Promise<void> {
        const url = new URL(`${this.apiEndpoint}/api/v2/subscriptions/manage`);
        const response = await axios.post(url.href, options, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as CreateManageSubscriptionResult;

        if (result.success === true) {
            location.href = result.url;
        } else {
            console.error(
                '[AuthManager] Unable to manage subscriptions!',
                result
            );
        }
    }

    getComIdFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('comId') || params.has('comID')) {
            return params.get('comId') ?? params.get('comID');
        } else {
            return null;
        }
    }

    getSessionKeyFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('sessionKey')) {
            return params.get('sessionKey');
        } else {
            return null;
        }
    }

    getConnectionKeyFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('connectionKey')) {
            return params.get('connectionKey');
        } else {
            return null;
        }
    }

    private async _revokeSessionKey(
        sessionKey: string
    ): Promise<RevokeSessionSuccess | null> {
        try {
            const result = await this.client.revokeSession(
                {
                    sessionKey,
                },
                { sessionKey }
            );

            if (result.success) {
                console.log('[AuthManager] Session key revoked!');
                return result;
            } else {
                console.log(
                    '[AuthManager] Could not revoke session key:',
                    result
                );
            }
        } catch (err) {
            console.log('[AuthManager] Could not revoke session key:', err);
        }
        return null;
    }

    async loginWithEmail(email: string) {
        return this._login(email, 'email');
    }

    async loginWithPhoneNumber(phoneNumber: string) {
        return this._login(phoneNumber, 'phone');
    }

    async loginWithPrivo() {
        return this.client.requestPrivoLogin({});
    }

    async signUpWithPrivo(info: PrivoSignUpInfo) {
        return await this._privoRegister(info);
    }

    async processAuthCode(
        params: object
    ): Promise<ProcessOpenIDAuthorizationCodeResult> {
        return this.client.processOAuthCode({
            ...params,
        });
    }

    async completeOAuthLogin(
        requestId: string
    ): Promise<CompleteOpenIDLoginResult> {
        const result = await this.client.completeOAuthLogin({
            requestId,
        });

        if (result.success === true) {
            this.updateLoginStateFromResult(result);
        }

        return result;
    }

    private async _privoRegister(
        info: PrivoSignUpInfo
    ): Promise<PrivoSignUpRequestResult> {
        const result = await this.client.requestPrivoSignUp({
            email: !!info.email ? info.email : undefined,
            displayName: info.displayName,
            name: info.name,
            dateOfBirth: info.dateOfBirth,
            parentEmail: info.parentEmail || undefined,
        });

        if (result.success === true) {
            this.updateLoginStateFromResult(result);
        }

        return result;
    }

    async completeLogin(
        userId: string,
        requestId: string,
        code: string
    ): Promise<CompleteLoginResult> {
        const result = await this.client.completeLogin({
            userId,
            requestId,
            code,
        });

        if (result.success === true) {
            this.updateLoginStateFromResult(result);
        }

        return result;
    }

    async revokeSession(userId: string, sessionId: string) {
        const result = await this.client.revokeSession({
            userId,
            sessionId,
        });

        if (
            result.success &&
            userId === this.userId &&
            sessionId === this.sessionId
        ) {
            this.savedSessionKey = null;
            this.savedConnectionKey = null;
            await this.logout();
        }

        return result;
    }

    async revokeAllSessions(userId?: string) {
        if (!userId) {
            userId = this.userId;
        }

        const result = await this.client.revokeAllSessions({
            userId,
        });

        if (result.success && userId === this.userId) {
            this.savedSessionKey = null;
            this.savedConnectionKey = null;
            await this.logout();
        }

        return result;
    }

    async replaceSession() {
        const result = await this.client.replaceSession();

        if (result.success && result.userId === this.userId) {
            this.savedSessionKey = result.sessionKey;
            this.savedConnectionKey = result.connectionKey;
        }

        return result;
    }

    private async _login(
        address: string,
        addressType: AddressType
    ): Promise<LoginRequestResult> {
        return this.client.requestLogin({
            address,
            addressType,
        });
    }

    get version(): string {
        return this._gitTag;
    }

    get savedEmail(): string {
        return localStorage.getItem(EMAIL_KEY);
    }

    get hasAcceptedTerms(): boolean {
        return localStorage.getItem(ACCEPTED_TERMS_KEY) === 'true';
    }

    get currentSessionKey(): string {
        return this._temporarySessionKey ?? this.savedSessionKey;
    }

    get currentConnectionKey(): string {
        return this._temporaryConnectionKey ?? this.savedConnectionKey;
    }

    get savedSessionKey(): string {
        return localStorage.getItem(SESSION_KEY);
    }

    set savedSessionKey(value: string) {
        if (!value) {
            localStorage.removeItem(SESSION_KEY);
        } else {
            localStorage.setItem(SESSION_KEY, value);
        }
        this._updateClientSessionKey();
    }

    get savedConnectionKey(): string {
        return localStorage.getItem(CONNECTION_KEY);
    }

    set savedConnectionKey(value: string) {
        if (!value) {
            localStorage.removeItem(CONNECTION_KEY);
        } else {
            localStorage.setItem(CONNECTION_KEY, value);
        }
    }

    async changeEmail(newEmail: string) {
        // TODO: Implement
        // await this.magic.user.updateEmail({
        //     email: newEmail,
        // });
        // await this.loadUserInfo();
    }

    async updateMetadata(newMetadata: Partial<AppMetadata>) {
        // TODO: Handle errors
        await this._putAppMetadata({
            avatarUrl: this.avatarUrl,
            avatarPortraitUrl: this.avatarPortraitUrl,
            displayName: this.displayName,
            name: this.name,
            email: this.email,
            phoneNumber: this.phone,
            ...newMetadata,
        });
        await this.loadUserInfo();
    }

    private _saveEmail(email: string) {
        if (email) {
            localStorage.setItem(EMAIL_KEY, email);
        } else {
            localStorage.removeItem(EMAIL_KEY);
        }
    }

    private _saveAcceptedTerms(acceptedTerms: boolean) {
        if (acceptedTerms) {
            localStorage.setItem(ACCEPTED_TERMS_KEY, 'true');
        } else {
            localStorage.removeItem(ACCEPTED_TERMS_KEY);
        }
    }

    private async _loadAppMetadata(): Promise<AppMetadata> {
        try {
            const response = await axios.get(
                `${this.apiEndpoint}/api/${encodeURIComponent(
                    this.userId
                )}/metadata`,
                {
                    headers: this._authenticationHeaders(),
                }
            );

            return response.data;
        } catch (err) {
            if (err.response) {
                if (err.response.status === 404) {
                    return null;
                } else if (err.response.status === 403) {
                    return null;
                } else if (err.response.status === 401) {
                    return null;
                }
            }
        }
    }

    private async _putAppMetadata(
        metadata: Omit<
            AppMetadata,
            'hasActiveSubscription' | 'subscriptionTier' | 'privacyFeatures'
        >
    ): Promise<AppMetadata> {
        const response = await axios.put(
            `${this.apiEndpoint}/api/${encodeURIComponent(
                this.userId
            )}/metadata`,
            metadata,
            {
                headers: this._authenticationHeaders(),
            }
        );
        return response.data;
    }

    getAuthenticationHeaders(): Record<string, string> {
        return this._authenticationHeaders();
    }

    private _authenticationHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.currentSessionKey}`,
        };
    }

    get apiEndpoint(): string {
        return this._apiEndpoint ?? location.origin;
    }

    get websocketEndpoint(): string {
        return this._websocketEndpoint;
    }

    get websocketProtocol(): RemoteCausalRepoProtocol {
        return this._websocketProtocol ?? 'websocket';
    }
}

export type LoginEvent = LoginRequestSent | LoginRequestNotSent | LoginComplete;

export interface LoginRequestSent {
    type: 'login_request_sent';
}

export interface LoginRequestNotSent {
    type: 'login_request_not_sent';
}

export interface LoginComplete {
    type: 'login_complete';
    sessionKey: string;
}

function inIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}
