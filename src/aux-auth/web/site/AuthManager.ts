import { Magic } from 'magic-sdk';
import { Subject, BehaviorSubject, Observable } from 'rxjs';

export class AuthManager {
    private _magic: Magic;

    private _email: string;
    private _userId: string;
    private _idToken: string;

    private _loginState: Subject<boolean>;

    constructor(magicApiKey: string) {
        this._magic = new Magic(magicApiKey, {
            testMode: !PRODUCTION,
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

        this._loginState.next(this.userInfoLoaded);
    }

    async logout() {
        await this.magic.user.logout();
        this._email = null;
        this._userId = null;
        this._idToken = null;

        this._loginState.next(false);
    }

    get version(): string {
        return GIT_TAG;
    }
}

declare var MAGIC_API_KEY: string;

const authManager = new AuthManager(MAGIC_API_KEY);

export { authManager };
