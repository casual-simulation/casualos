import axios from 'axios';
import { Subject, BehaviorSubject, Observable, from } from 'rxjs';
import { AppMetadata } from '../../../aux-backend/shared/AuthMetadata';
import {
    CreatePublicRecordKeyResult,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import type {
    CompleteLoginResult,
    LoginRequestResult,
    ListSessionsResult,
    RevokeSessionResult,
    RevokeAllSessionsResult,
    ListedSession,
    ReplaceSessionResult,
} from '@casual-simulation/aux-records/AuthController';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import type {
    GetSubscriptionStatusResult,
    SubscriptionStatus,
    CreateManageSubscriptionResult,
    GetSubscriptionStatusSuccess,
    CreateManageSubscriptionRequest,
} from '@casual-simulation/aux-records/SubscriptionController';
import { omitBy } from 'lodash';

const EMAIL_KEY = 'userEmail';
const ACCEPTED_TERMS_KEY = 'acceptedTerms';
const SESSION_KEY = 'sessionKey';

declare const ASSUME_SUBSCRIPTIONS_SUPPORTED: boolean;

if (typeof (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED === 'undefined') {
    (globalThis as any).ASSUME_SUBSCRIPTIONS_SUPPORTED = false;
}

export class AuthManager {
    private _userId: string;
    private _sessionId: string;
    private _appMetadata: AppMetadata;
    private _subscriptionsSupported: boolean;

    private _loginState: Subject<boolean>;
    private _apiEndpoint: string;
    private _gitTag: string;

    constructor(apiEndpoint: string, gitTag: string) {
        this._apiEndpoint = apiEndpoint;
        this._gitTag = gitTag;
        this._loginState = new BehaviorSubject<boolean>(false);
        this._subscriptionsSupported = ASSUME_SUBSCRIPTIONS_SUPPORTED;
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

    get subscriptionsSupported() {
        return this._subscriptionsSupported;
    }

    get hasActiveSubscription() {
        return this._appMetadata?.hasActiveSubscription;
    }

    get subscriptionTier() {
        return this._appMetadata?.subscriptionTier;
    }

    get openAiKey() {
        return this._appMetadata?.openAiKey;
    }

    get userInfoLoaded() {
        return !!this._userId && !!this.savedSessionKey && !!this._appMetadata;
    }

    get loginState(): Observable<boolean> {
        return this._loginState;
    }

    async validateEmail(email: string): Promise<boolean> {
        // Validation is handled on the server
        const indexOfAt = email.indexOf('@');
        if (indexOfAt < 0 || indexOfAt >= email.length) {
            return false;
        }

        return true;
    }

    async validateSmsNumber(sms: string): Promise<boolean> {
        // Validation is handled on the server
        return true;
    }

    isLoggedIn(): boolean {
        const sessionKey = this.savedSessionKey;
        if (!sessionKey) {
            return false;
        }
        const parsed = parseSessionKey(sessionKey);
        if (!parsed) {
            return false;
        }

        const [userId, sessionId, sessionSecret, expireTimeMs] = parsed;
        if (Date.now() >= expireTimeMs) {
            return false;
        }

        return true;
    }

    async loadUserInfo() {
        const [userId, sessionId, sessionSecret, expireTimeMs] =
            parseSessionKey(this.savedSessionKey);
        this._userId = userId;
        this._sessionId = sessionId;
        this._appMetadata = await this._loadAppMetadata();

        if (!this._appMetadata) {
            this._userId = null;
            this._sessionId = null;
            this.savedSessionKey = null;
        } else {
            this._saveAcceptedTerms(true);
            if (this.email) {
                this._saveEmail(this.email);
            }
        }

        this._loginState.next(this.userInfoLoaded);
        return this.userInfoLoaded;
    }

    async createPublicRecordKey(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        if (!this.userInfoLoaded) {
            await this.loadUserInfo();
        }
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/records/key`,
            {
                recordName: recordName,
                policy: policy,
            },
            {
                headers: this._authenticationHeaders(),
                validateStatus: (status) => status < 500,
            }
        );
        return response.data;
    }

    async logout(revokeSessionKey: boolean = true) {
        const sessionKey = this.savedSessionKey;
        if (sessionKey) {
            this.savedSessionKey = null;
            if (revokeSessionKey) {
                await this._revokeSessionKey(sessionKey);
            }
        }
        this._userId = null;
        this._sessionId = null;
        this._appMetadata = null;
        this._saveEmail(null);
        this._loginState.next(false);
    }

    async listSessions(expireTimeMs: number = null): Promise<ListedSession[]> {
        const query = omitBy(
            {
                expireTimeMs,
            },
            (o) => typeof o === 'undefined' || o === null
        );
        const url = new URL(`${this.apiEndpoint}/api/v2/sessions`);
        for (let key in query) {
            url.searchParams.set(key, query[key].toString());
        }
        const response = await axios.get(url.href, {
            headers: this._authenticationHeaders(),
        });

        const result = response.data as ListSessionsResult;

        if (result.success) {
            return result.sessions;
        } else {
            return [];
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

    private async _revokeSessionKey(sessionKey: string): Promise<void> {
        try {
            const response = await axios.post(
                `${this.apiEndpoint}/api/v2/revokeSession`,
                {
                    sessionKey: sessionKey,
                },
                {
                    headers: {
                        Authorization: `Bearer ${sessionKey}`,
                    },
                }
            );
            console.log('[AuthManager] Session key revoked!');
        } catch (err) {
            console.log('[AuthManager] Could not revoke session key:', err);
        }
    }

    async loginWithEmail(email: string) {
        return this._login(email, 'email');
    }

    async loginWithPhoneNumber(phoneNumber: string) {
        return this._login(phoneNumber, 'phone');
    }

    async completeLogin(
        userId: string,
        requestId: string,
        code: string
    ): Promise<CompleteLoginResult> {
        const result = await this._completeLoginRequest(
            userId,
            requestId,
            code
        );

        if (result.success === true) {
            this.savedSessionKey = result.sessionKey;
            this._userId = result.userId;
        }

        return result;
    }

    async revokeSession(
        userId: string,
        sessionId: string
    ): Promise<RevokeSessionResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/revokeSession`,
            {
                userId,
                sessionId,
            },
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as RevokeSessionResult;

        if (
            result.success &&
            userId === this.userId &&
            sessionId === this.sessionId
        ) {
            this.savedSessionKey = null;
            await this.logout();
        }

        return result;
    }

    async revokeAllSessions(userId?: string): Promise<RevokeAllSessionsResult> {
        if (!userId) {
            userId = this.userId;
        }

        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/revokeAllSessions`,
            {
                userId,
            },
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as RevokeAllSessionsResult;

        if (result.success && userId === this.userId) {
            this.savedSessionKey = null;
            await this.logout();
        }

        return result;
    }

    async replaceSession(): Promise<ReplaceSessionResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/replaceSession`,
            {},
            {
                validateStatus: (status) => status < 500,
                headers: this._authenticationHeaders(),
            }
        );

        const result = response.data as ReplaceSessionResult;

        if (result.success && result.userId === this.userId) {
            this.savedSessionKey = result.sessionKey;
        }

        return result;
    }

    private async _completeLoginRequest(
        userId: string,
        requestId: string,
        code: string
    ): Promise<CompleteLoginResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/completeLogin`,
            {
                userId,
                requestId,
                code,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return response.data;
    }

    private async _login(
        address: string,
        addressType: AddressType
    ): Promise<LoginRequestResult> {
        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/login`,
            {
                address: address,
                addressType: addressType,
            },
            {
                validateStatus: (status) => status < 500,
            }
        );

        return response.data;
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

    get savedSessionKey(): string {
        return localStorage.getItem(SESSION_KEY);
    }

    set savedSessionKey(value: string) {
        if (!value) {
            localStorage.removeItem(SESSION_KEY);
        } else {
            localStorage.setItem(SESSION_KEY, value);
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
            name: this.name,
            email: this.email,
            phoneNumber: this.phone,
            openAiKey: this.openAiKey,
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
            'hasActiveSubscription' | 'subscriptionTier'
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

    private _authenticationHeaders(): any {
        return {
            Authorization: `Bearer ${this.savedSessionKey}`,
        };
    }

    get apiEndpoint(): string {
        return this._apiEndpoint;
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