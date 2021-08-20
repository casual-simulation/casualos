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
 * Defines a class that implements the backend for an AuxAuth instance.
 */
export class AuthHandler implements AuxAuth {
    private _loggedIn: boolean = false;
    private _loginData: AuthData;
    private _userId: string;

    async isLoggedIn(): Promise<boolean> {
        return this._loggedIn;
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
}
