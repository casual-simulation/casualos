import { AuxAuth } from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/AuthManager';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';

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

    async isLoggedIn(): Promise<boolean> {
        if (this._loggedIn) {
            const expiry = this._getTokenExpirationTime(this._token);
            if (this._nowInSeconds() < expiry) {
                return true;
            }
        }
        return false;
    }

    async login(): Promise<AuthData> {
        if (await this.isLoggedIn()) {
            return this._loginData;
        }

        console.log('[AuthHandler] Attempting login.');
        if (await this._checkLoginStatus()) {
            console.log('[AuthHandler] Already logged in.');
            await this._loadUserInfo();
            return this._loginData;
        } else {
            this._userId = await this._loginWithNewTab();
            await this._loadUserInfo();
            return this._loginData;
        }
    }

    async createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult> {
        if (!(await this.isLoggedIn())) {
            await this.login();
        }

        if (!(await this.isLoggedIn())) {
            return {
                success: false,
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'User is not logged in.',
            };
        }

        return await authManager.createPublicRecordKey(recordName);
    }

    async getAuthToken(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._token;
        }

        return null;
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

        if (loggedIn) {
            await authManager.loadUserInfo();
        }
        return loggedIn;
    }

    private async _loadUserInfo() {
        await authManager.loadUserInfo();
        this._token = authManager.idToken;
        this._loginData = {
            userId: this._userId ?? authManager.userId,
            avatarUrl: authManager.avatarUrl,
            name: authManager.name,
        };

        this._queueTokenRefresh(this._token);
        this._loggedIn = true;
        console.log('[AuthHandler] Logged In!');
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
        const expiry = this._getTokenExpirationTime(token);
        const now = this._nowInSeconds();
        const lifetimeSeconds = expiry - now;

        const refreshTime = lifetimeSeconds - REFRESH_BUFFER_SECONDS;

        console.log(
            '[AuthHandler] Refreshing token in',
            refreshTime,
            'seconds'
        );

        setTimeout(() => {
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
            this._queueTokenRefresh(token);
        } catch (ex) {
            console.error('[AuthHandler] Failed to refresh token.', ex);
        }
    }
}
