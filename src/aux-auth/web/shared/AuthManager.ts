import axios from 'axios';
import { Subject, BehaviorSubject, Observable, from } from 'rxjs';
import { AppMetadata } from '../../shared/AuthMetadata';
import {
    CreatePublicRecordKeyResult,
    PublicRecordKeyPolicy,
} from '@casual-simulation/aux-records';
import { isStringValid, RegexRule } from './Utils';
import { parseSessionKey } from '@casual-simulation/aux-records/AuthUtils';
import {
    CompleteLoginResult,
    LoginRequestResult,
} from '@casual-simulation/aux-records/AuthController';
import { AddressType } from '@casual-simulation/aux-records/AuthStore';
import { map, switchMap } from 'rxjs/operators';

const EMAIL_KEY = 'userEmail';
const ACCEPTED_TERMS_KEY = 'acceptedTerms';
const SESSION_KEY = 'sessionKey';

export class AuthManager {
    private _userId: string;
    private _appMetadata: AppMetadata;

    private _loginState: Subject<boolean>;
    private _emailRules: RegexRule[];
    private _phoneRules: RegexRule[];
    private _apiEndpoint: string;
    private _gitTag: string;

    constructor(apiEndpoint: string, gitTag: string) {
        this._apiEndpoint = apiEndpoint;
        this._gitTag = gitTag;
        this._loginState = new BehaviorSubject<boolean>(false);
    }

    get userId() {
        return this._userId;
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

    get userInfoLoaded() {
        return !!this._userId && !!this.savedSessionKey && !!this._appMetadata;
    }

    get loginState(): Observable<boolean> {
        return this._loginState;
    }

    async validateEmail(email: string): Promise<boolean> {
        if (!this._emailRules) {
            const rules = await this._getEmailRules();
            this._emailRules = rules.map((r) => ({
                type: r.type,
                pattern: r.pattern,
            }));
        }

        return isStringValid(email, this._emailRules);
    }

    async validateSmsNumber(sms: string): Promise<boolean> {
        if (!this._phoneRules) {
            const rules = await this._getSmsRules();
            this._phoneRules = rules.map((r) => ({
                type: r.type,
                pattern: r.pattern,
            }));
        }

        return isStringValid(sms, this._phoneRules);
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
        this._appMetadata = await this._loadAppMetadata();

        this._saveAcceptedTerms(true);
        if (this.email) {
            this._saveEmail(this.email);
        }

        this._loginState.next(this.userInfoLoaded);
    }

    async createPublicRecordKey(
        recordName: string,
        policy: PublicRecordKeyPolicy
    ): Promise<CreatePublicRecordKeyResult> {
        if (!this.userInfoLoaded) {
            await this.loadUserInfo();
        }
        const token = this.savedSessionKey;

        const response = await axios.post(
            `${this.apiEndpoint}/api/v2/records/key`,
            {
                recordName: recordName,
                policy: policy,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    }

    async logout() {
        const sessionKey = this.savedSessionKey;
        if (sessionKey) {
            this.savedSessionKey = null;
            await this._revokeSessionKey(sessionKey);
        }
        this._userId = null;
        this._appMetadata = null;
        this._saveEmail(null);
        this._loginState.next(false);
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
        localStorage.setItem(SESSION_KEY, value);
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
                    headers: {
                        Authorization: `Bearer ${this.savedSessionKey}`,
                    },
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

    private async _putAppMetadata(metadata: AppMetadata): Promise<AppMetadata> {
        // TODO:
        const response = await axios.put(
            `${this.apiEndpoint}/api/${encodeURIComponent(
                this.savedSessionKey
            )}/metadata`,
            metadata
        );
        return response.data;
    }

    private async _getEmailRules(): Promise<RegexRule[]> {
        const response = await axios.get(`${this.apiEndpoint}/api/emailRules`);
        return response.data;
    }

    private async _getSmsRules(): Promise<RegexRule[]> {
        try {
            const response = await axios.get(
                `${this.apiEndpoint}/api/smsRules`
            );
            return response.data;
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response.status === 404) {
                    return [];
                }
            }
            throw err;
        }
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
