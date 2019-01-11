import * as Sentry from '@sentry/browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
    email: string;
    username: string;
    name: string;
}

export class AppManager {

    private _user: BehaviorSubject<User>;
    private _updateAvailable: BehaviorSubject<boolean>;

    constructor() {
        this._initSentry();
        this._initOffline();
        this._initUser();
    }

    get userObservable(): Observable<User> {
        return this._user;
    }

    get user(): User {
        return this._user.value;
    }

    /**
     * Gets an observable that resolves with true once an application update is available.
     */
    get updateAvailableObservable(): Observable<boolean> {
        return this._updateAvailable;
    }

    private _initSentry() {
        const sentryEnv = PRODUCTION ? 'prod' : 'dev';

        if (SENTRY_DSN) {
            Sentry.init({
                dsn: SENTRY_DSN,
                integrations: [new Sentry.Integrations.Vue({ Vue: Vue })],
                release: GIT_HASH,
                environment: sentryEnv,
                enabled: ENABLE_SENTRY
            });
        } else {
            console.log('Skipping Sentry Initialization');
        }
    }

    private _initOffline() {
        this._updateAvailable = new BehaviorSubject<boolean>(false);

        OfflinePluginRuntime.install({
            onUpdating: () => {
                console.log('[ServiceWorker]: Updating...');
                Sentry.addBreadcrumb({
                    message: 'Updating service worker.',
                    type: 'info',
                    category: 'app'
                });
            },
            onUpdateReady: () => {
                console.log('[ServiceWorker]: Update Ready.');
                OfflinePluginRuntime.applyUpdate();
            },
            onUpdated: () => {
                console.log('[ServiceWorker]: Updated.');
                Sentry.addBreadcrumb({
                    message: 'Updated service worker.',
                    type: 'info',
                    category: 'app'
                });
                this._updateAvailable.next(true);
            },
            onUpdateFailed: () => {
                console.log('[ServiceWorker]: Update failed.');
                Sentry.captureMessage('Service Worker update failed', Sentry.Severity.Error);
            },
            onInstalled: () => {
                console.log('[ServiceWorker]: Installed.');
                Sentry.addBreadcrumb({
                    message: 'Installed service worker.',
                    type: 'info',
                    category: 'app'
                });
            }
        });
    }

    private _initUser() {
        const localStorage = window.localStorage;
        const u = localStorage.getItem("user");
        if (u) {
            this._user = new BehaviorSubject<User>(JSON.parse(u));
        } else {
            this._user = new BehaviorSubject<User>(null);
        }

        this._user.subscribe(user => {
            Sentry.configureScope(scope => {
                if (user) {
                    scope.setUser(this._user);
                } else {
                    scope.clear();
                }
            });
        });
    }

    private _saveUser() {
        const localStorage = window.localStorage;

        if (this.user) {
            localStorage.setItem("user", JSON.stringify(this.user));
        } else {
            localStorage.removeItem("user");
        }
    }

    logout() {
        if (this.user) {
            Sentry.addBreadcrumb({
                message: 'Logout',
                category: 'auth',
                type: 'info'
            });
            console.log("[AppManager] Logout");
            this._user.next(null);
            this._saveUser();
        }
    }

    async loginOrCreateUser(email: string): Promise<boolean> {
        if (this.user !== null)
            return true;

        try {
            const result = await Axios.post('/api/users', {
                email: email
            });

            if (result.status === 200) {
                Sentry.addBreadcrumb({
                    message: 'Login Success!',
                    category: 'auth',
                    type: 'default'
                });
                console.log('[AppManager] Login Success!', result);
                this._user.next(result.data);
                this._saveUser();
                return true;
            } else {
                Sentry.addBreadcrumb({
                    message: 'Login failure',
                    category: 'auth',
                    type: 'error'
                });
                console.error(result);
                return false;
            }
        } catch (ex) {
            Sentry.captureException(ex);
            console.error(ex);
            return false;
        }
    }
}

export const appManager = new AppManager();