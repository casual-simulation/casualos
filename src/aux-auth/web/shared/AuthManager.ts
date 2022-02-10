import axios from 'axios';
import { Magic } from 'magic-sdk';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { AppMetadata } from '../../shared/AuthMetadata';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';
import { isEmailValid, EmailRule } from './Utils';

const EMAIL_KEY = 'userEmail';
const ACCEPTED_TERMS_KEY = 'acceptedTerms';

// 1000 years
const PERMANENT_TOKEN_LIFESPAN_SECONDS = 1000 * 365 * 24 * 60 * 60;

declare const API_ENDPOINT: string;

export class AuthManager {
    private _magic: Magic;

    private _email: string;
    private _userId: string;
    private _idToken: string;
    private _appMetadata: AppMetadata;

    private _loginState: Subject<boolean>;
    private _emailRules: EmailRule[];

    constructor(magicApiKey: string) {
        this._magic = new Magic(magicApiKey, {
            testMode: false,
        });
        this._loginState = new BehaviorSubject<boolean>(false);
    }

    get magic() {
        return this._magic;
    }

    get userId() {
        return this._userId;
    }

    get email() {
        return this._email;
    }

    get idToken() {
        return this._idToken;
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
        return !!this._userId && !!this._idToken;
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

        return isEmailValid(email, this._emailRules);
    }

    async loadUserInfo() {
        const { email, issuer, publicAddress } =
            await this.magic.user.getMetadata();
        this._idToken = await this.magic.user.getIdToken();
        this._email = email;
        this._userId = issuer;

        this._saveAcceptedTerms(true);
        if (this._email) {
            this._saveEmail(this._email);
        }

        this._appMetadata = await this._loadOrCreateAppMetadata();

        this._loginState.next(this.userInfoLoaded);
    }

    async createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult> {
        if (!this.userInfoLoaded) {
            await this.loadUserInfo();
        }
        const token = this.idToken;

        const response = await axios.post(
            `${API_ENDPOINT}/api/v2/records/key`,
            {
                recordName: recordName,
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
        await this.magic.user.logout();
        this._email = null;
        this._userId = null;
        this._idToken = null;
        this._saveEmail(null);
        this._loginState.next(false);
    }

    get version(): string {
        return GIT_TAG;
    }

    get savedEmail(): string {
        return localStorage.getItem(EMAIL_KEY);
    }

    get hasAcceptedTerms(): boolean {
        return localStorage.getItem(ACCEPTED_TERMS_KEY) === 'true';
    }

    async changeEmail(newEmail: string) {
        // TODO: Handle errors
        await this.magic.user.updateEmail({
            email: newEmail,
        });
        await this.loadUserInfo();
    }

    async updateMetadata(newMetadata: Partial<AppMetadata>) {
        // TODO: Handle errors
        await this._putAppMetadata({
            avatarUrl: this.avatarUrl,
            avatarPortraitUrl: this.avatarPortraitUrl,
            name: this.name,
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

    private async _loadOrCreateAppMetadata(): Promise<AppMetadata> {
        try {
            const response = await axios.get(
                `${API_ENDPOINT}/api/${encodeURIComponent(
                    this.userId
                )}/metadata`
            );
            return response.data;
        } catch (e) {
            if (e.response) {
                if (e.response.status === 404) {
                    return this._putAppMetadata({
                        name: null,
                        avatarUrl: null,
                        avatarPortraitUrl: null,
                    });
                }
            } else {
                throw e;
            }
        }
    }

    private async _putAppMetadata(metadata: AppMetadata): Promise<AppMetadata> {
        const response = await axios.put(
            `${API_ENDPOINT}/api/${encodeURIComponent(this.idToken)}/metadata`,
            metadata
        );
        return response.data;
    }

    private async _getEmailRules(): Promise<EmailRule[]> {
        const response = await axios.get(`${API_ENDPOINT}/api/emailRules`);
        return response.data;
    }
}

declare var MAGIC_API_KEY: string;

const authManager = new AuthManager(MAGIC_API_KEY);

export { authManager };
