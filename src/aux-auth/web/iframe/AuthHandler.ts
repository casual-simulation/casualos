import { AuxAuth } from '@casual-simulation/aux-vm';
import { AuthData } from '@casual-simulation/aux-common';
import {
    listenForChannel,
    listenForChannels,
    setupChannel,
    waitForLoad,
} from '../../../aux-vm-browser/html/IFrameHelpers';
import { authManager } from '../shared/AuthManager';

/**
 * The number of seconds that the token should be refreshed before it expires.
 */
const REFRESH_BUFFER_SECONDS = 5;

/**
 * Defines a class that implements the backend for an AuxAuth instance.
 */
export class AuthHandler implements AuxAuth {
    private _loggedIn: boolean = false;
    private _loginData: AuthData;
    private _userId: string;
    private _listeners: ((error: string, data: AuthData) => void)[] = [];

    async isLoggedIn(): Promise<boolean> {
        if (this._loggedIn) {
            const expiry = this._getTokenExpirationTime(this._loginData.token);
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

        const service = this._getDefaultService();

        if (!service) {
            throw new Error('Unable to login without an auxCode');
        }

        console.log('[AuthHandler] Attempting login.');
        if (await this._checkLoginStatus()) {
            console.log('[AuthHandler] Already logged in.');
            await this._authorizeService(service);
            return this._loginData;
        } else {
            this._userId = await this._loginWithNewTab();
            await this._authorizeService(service);
            return this._loginData;
        }
    }

    addTokenListener(listener: (error: string, data: AuthData) => void) {
        this._listeners.push(listener);
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

    private async _authorizeService(service: string) {
        console.log('[AuthHandler] Authorizing Service...', service);
        if (await authManager.isServiceAuthorized(service)) {
            await authManager.loadUserInfo();
            const token = await authManager.authorizeService(service);
            this._loginData = {
                userId: this._userId ?? authManager.userId,
                service: service,
                token: token,
                avatarUrl: authManager.avatarUrl,
                name: authManager.name,
            };

            this._queueTokenRefresh(token);
            this._loggedIn = true;
            console.log('[AuthHandler] Authorized!', service);
        }
    }

    private _loginWithNewTab(): Promise<string> {
        console.log('[AuthHandler] Opening login tab...');
        const url = new URL('/', location.origin);
        let service = this._getDefaultService();
        if (service) {
            url.searchParams.set('service', service);
        }
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

    private _getDefaultService() {
        try {
            const url = new URL(window.location.href);
            const auxCode =
                url.searchParams.get('autoLoad') ??
                url.searchParams.get('auxCode');
            return auxCode;
        } catch (ex) {
            console.error('[AuthSelect] Unable to find auxCode.', ex);
            return null;
        }
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

            const token = await authManager.authorizeService(
                this._loginData.service
            );

            this._loginData = {
                ...this._loginData,
                token: token,
            };

            console.log('[AuthHandler] Token refreshed!');

            try {
                for (let listener of this._listeners) {
                    listener(null, this._loginData);
                }
            } catch (err) {
                console.error(
                    '[AuthHandler] Error while running listener',
                    err
                );
            }

            this._queueTokenRefresh(token);
        } catch (ex) {
            console.error('[AuthHandler] Failed to refresh token.', ex);

            try {
                for (let listener of this._listeners) {
                    listener(ex.toString(), null);
                }
            } catch (err) {
                console.error(
                    '[AuthHandler] Error while running listener',
                    err
                );
            }
        }
    }
}
