import { AuxAuth, LoginStatus } from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/AuthManager';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';
import { BehaviorSubject } from 'rxjs';

/**
 * The number of seconds that the token should be refreshed before it expires.
 */
const REFRESH_BUFFER_SECONDS = 5;

const NULL_SERVICE = '(null)';

/**
 * Defines a class that implements the backend for an AuxAuth instance.
 */
export class AuthHandler implements AuxAuth {
    private _loggedIn: boolean = false;
    private _loginData: AuthData;
    private _userId: string;
    private _token: string;
    private _refreshTimeout: any;
    private _loginStatus: BehaviorSubject<LoginStatus> = new BehaviorSubject(
        {}
    );

    async isLoggedIn(): Promise<boolean> {
        if (this._loggedIn) {
            const expiry = this._getTokenExpirationTime(this._token);
            if (this._nowInSeconds() < expiry) {
                return true;
            }
        }
        return false;
    }

    async login(backgroundLogin?: boolean): Promise<AuthData> {
        if (await this.isLoggedIn()) {
            return this._loginData;
        }
        this._loginStatus.next({
            isLoggingIn: true,
        });

        if (await this._checkLoginStatus()) {
            console.log('[AuthHandler] Already logged in.');
            await this._loadUserInfo();
            return this._loginData;
        } else if (!backgroundLogin) {
            console.log('[AuthHandler] Attempting login with UI.');
            this._userId = await this._loginWithNewTab();
            await this._loadUserInfo();
            return this._loginData;
        } else {
            console.log('[AuthHandler] Skipping login with UI.');
        }

        return this._loginData;
    }

    async createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult> {
        console.log('[AuthHandler] Creating public record key:', recordName);
        if (!(await this.isLoggedIn())) {
            await this.login();
        }

        if (!(await this.isLoggedIn())) {
            console.log(
                '[AuthHandler] Unauthorized to create public record key.'
            );
            return {
                success: false,
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'User is not logged in.',
            };
        }

        console.log('[AuthHandler] Record key created.');
        return await authManager.createPublicRecordKey(recordName);
    }

    async getAuthToken(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._token;
        }

        return null;
    }

    async openAccountPage(): Promise<void> {
        const url = new URL('/', location.origin);
        window.open(url.href, '_blank');
    }

    async addLoginStatusCallback(
        callback: (status: LoginStatus) => void
    ): Promise<void> {
        this._loginStatus.subscribe((status) => callback(status));
    }

    private _getTokenExpirationTime(token: string) {
        const [proof, claimJson] = JSON.parse(atob(token));
        const claim = JSON.parse(claimJson);
        return claim.ext;
    }

    private _nowInSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    private async _checkLoginStatus() {
        console.log('[AuthHandler] Checking login status...');
        const loggedIn = await authManager.magic.user.isLoggedIn();
        console.log('[AuthHandler] Login result:', loggedIn);

        if (loggedIn && !authManager.userInfoLoaded) {
            await authManager.loadUserInfo();
        }
        return loggedIn;
    }

    private async _loadUserInfo() {
        if (!authManager.userInfoLoaded) {
            await authManager.loadUserInfo();
        }
        this._token = authManager.idToken;
        this._loginData = {
            userId: this._userId ?? authManager.userId,
            avatarUrl: authManager.avatarUrl,
            avatarPortraitUrl: authManager.avatarPortraitUrl,
            name: authManager.name,
        };

        this._queueTokenRefresh(this._token);
        this._loggedIn = true;
        console.log('[AuthHandler] Logged In!');

        this._loginStatus.next({
            authData: this._loginData,
        });
    }

    private _loginWithNewTab(): Promise<string> {
        console.log('[AuthHandler] Opening login tab...');
        const url = new URL('/', location.origin);
        const newTab = window.open(url.href, '_blank');

        return new Promise((resolve, reject) => {
            let handled = false;
            let userId: string;
            const sub = listenForChannels(newTab.origin).subscribe((port) => {
                const handleClose = () => {
                    if (!handled) {
                        console.log('[AuthHandler] Login canceled.');
                        sub.unsubscribe();
                        reject(new Error('Login failed'));
                    }
                };

                newTab.onclose = () => {
                    handleClose();
                };

                port.addEventListener('message', (message) => {
                    if (message.data.type === 'close') {
                        handleClose();
                    } else if (message.data.type === 'login') {
                        console.log('[AuthHandler] Got User ID.');
                        userId = message.data.userId;
                        handled = true;
                        sub.unsubscribe();
                        newTab.close();
                        resolve(userId);
                    } else if (message.data.type === 'token') {
                        console.log('[AuthHandler] Got token.');
                    }
                });

                if (port.start) {
                    port.start();
                }
            });
        });
    }

    private _queueTokenRefresh(token: string) {
        if (this._refreshTimeout) {
            clearTimeout(this._refreshTimeout);
        }
        const expiry = this._getTokenExpirationTime(token);
        const now = this._nowInSeconds();
        const lifetimeSeconds = expiry - now;

        const refreshTime = lifetimeSeconds - REFRESH_BUFFER_SECONDS;

        console.log(
            '[AuthHandler] Refreshing token in',
            refreshTime,
            'seconds'
        );

        this._refreshTimeout = setTimeout(() => {
            this._refreshToken();
        }, refreshTime * 1000);
    }

    private async _refreshToken() {
        try {
            console.log('[AuthHandler] Refreshing token...');

            if (!this._loginData) {
                console.log('[AuthHandler] Unable to refresh. No login data.');
                return;
            }

            const token = await authManager.magic.user.getIdToken();
            this._token = token;

            console.log('[AuthHandler] Token refreshed!');
            this._refreshTimeout = null;
            this._queueTokenRefresh(token);
        } catch (ex) {
            console.error('[AuthHandler] Failed to refresh token.', ex);
        }
    }
}
