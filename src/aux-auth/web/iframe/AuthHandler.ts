import { AuxAuth } from '@casual-simulation/aux-vm';
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
    private _userId: string;

    async isLoggedIn(): Promise<boolean> {
        return this._loggedIn;
    }

    async login(): Promise<string> {
        if (await this.isLoggedIn()) {
            return this._userId;
        }

        console.log('[AuthHandler] Attempting login.');
        if (await this._checkLoginStatus()) {
            console.log('[AuthHandler] Already logged in.');
            return this._userId;
        } else {
            this._userId = await this._loginWithNewTab();
            this._loggedIn = true;
            return this._userId;
        }
    }

    private async _checkLoginStatus() {
        console.log('[AuthHandler] Checking login status...');
        const loggedIn = await authManager.magic.user.isLoggedIn();
        console.log('[AuthHandler] Login result:', loggedIn);

        if (loggedIn) {
            await authManager.loadUserInfo();
            this._userId = authManager.userId;
            this._loggedIn = true;
        }
        return loggedIn;
    }

    private _loginWithNewTab(): Promise<string> {
        console.log('[AuthHandler] Opening login tab...');
        const url = new URL('/', location.origin).href;
        const newTab = window.open(url, '_blank');

        return new Promise((resolve, reject) => {
            let handled = false;
            let sub = listenForChannels(newTab.origin).subscribe((port) => {
                port.addEventListener('message', (message) => {
                    if (message.data.type === 'close') {
                        if (!handled) {
                            console.log('[AuthHandler] Login canceled.');
                            sub.unsubscribe();
                            reject(new Error('Login failed'));
                        }
                    } else if (message.data.type === 'login') {
                        console.log('[AuthHandler] Login successful.');
                        handled = true;
                        sub.unsubscribe();
                        resolve(message.data.userId);
                    }
                });

                if (port.start) {
                    port.start();
                }
            });
        });
    }
}
