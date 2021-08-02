import axios from 'axios';
import { Magic } from 'magic-sdk';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { AppMetadata } from '../../shared/AuthMetadata';

const EMAIL_KEY = 'userEmail';

export class AuthManager {
    private _magic: Magic;

    private _email: string;
    private _userId: string;
    private _idToken: string;
    private _appMetadata: AppMetadata;

    private _loginState: Subject<boolean>;

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

    get name() {
        return this._appMetadata?.name;
    }

    get userInfoLoaded() {
        return !!this._userId && !!this._email && !!this._idToken;
    }

    get loginState(): Observable<boolean> {
        return this._loginState;
    }

    async loadUserInfo() {
        const {
            email,
            issuer,
            publicAddress,
        } = await this.magic.user.getMetadata();
        this._idToken = await this.magic.user.getIdToken();
        this._email = email;
        this._userId = issuer;

        if (this._email) {
            this._saveEmail(this._email);
        }

        this._appMetadata = await this._loadOrCreateAppMetadata();

        this._loginState.next(this.userInfoLoaded);
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

    async changeEmail(newEmail: string) {
        // TODO: Handle errors
        await this.magic.user.updateEmail({
            email: newEmail,
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

    private async _loadOrCreateAppMetadata(): Promise<AppMetadata> {
        try {
            const response = await axios.get(
                `/api/${encodeURIComponent(this._userId)}/metadata`
            );
            return response.data;
        } catch (e) {
            if (e.response) {
                if (e.response.status === 404) {
                    return this._createAppMetadata();
                }
            } else {
                throw e;
            }
        }
    }

    private async _createAppMetadata(): Promise<AppMetadata> {
        const response = await axios.put(
            `/api/${encodeURIComponent(this._userId)}/metadata`
        );
        return response.data;
    }
}

declare var MAGIC_API_KEY: string;

const authManager = new AuthManager(MAGIC_API_KEY);

export { authManager };
