import * as Sentry from '@sentry/browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, using, SubscriptionLike } from 'rxjs';
import { FileManager } from './FileManager';
import { SocketManager } from './SocketManager';
import { flatMap, map, scan } from 'rxjs/operators';

export interface User {
    email: string;
    username: string;
    name: string;
}

export class AppManager {

    private _userSubject: BehaviorSubject<User>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _fileManager: FileManager;
    private _socketManager: SocketManager;
    private _initPromise: Promise<void>;
    private _user: User;

    constructor() {
        this._socketManager = new SocketManager();
        this._fileManager = new FileManager(this, this._socketManager);
        this._initPromise = this._init();
    }

    get initPromise() {
        return this._initPromise;
    }

    get socketManager() {
        return this._socketManager;
    }

    get fileManager() {
        if (this.user) {
            return this._fileManager;
        }
    }

    get userObservable(): Observable<User> {
        return this._userSubject;
    }

    get user(): User {
        return this._user;
    }

    /**
     * Gets an observable that resolves with true once an application update is available.
     */
    get updateAvailableObservable(): Observable<boolean> {
        return this._updateAvailable;
    }

    /**
     * Helper function that ensures services are only running while the user is logged in.
     * The provided setup function will be run once the user logs in or if they are already logged in
     * and the returned subscriptions will be unsubscribed once the user logs out.
     * @param setup 
     */
    whileLoggedIn(setup: (user: User, fileManager: FileManager) => SubscriptionLike[]): SubscriptionLike {
        return this.userObservable.pipe(
            scan((subs: SubscriptionLike[], user: User, index) => {
                if (subs) {
                    subs.forEach(s => s.unsubscribe());
                }
                if (user) {   
                    return setup(user, this.fileManager);
                } else {
                    return null;
                }
            }, null)
        ).subscribe();
    }

    private async _init() {
        this._initSentry();
        this._initOffline();
        await this._initUser();
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
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default'
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
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default'
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
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default'
                });
            }
        });
    }

    private async _initUser() {
        const localStorage = window.localStorage;
        const user: User = JSON.parse(localStorage.getItem("user"));

        this._user = null;
        this._userSubject = new BehaviorSubject<User>(null);
        this._userSubject.subscribe(user => {
            Sentry.configureScope(scope => {
                if (user) {
                    scope.setUser(this._userSubject);
                } else {
                    scope.clear();
                }
            });
        });

        if (user) {
            this._user = user;
            await this._fileManager.init();
            this._userSubject.next(this._user);
        }
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
                type: 'default',
                level: Sentry.Severity.Info,
            });
            console.log("[AppManager] Logout");

            this._fileManager.dispose();
            this._user = null;
            this._userSubject.next(null);
            this._saveUser();
        }
    }

    async loginOrCreateUser(email: string): Promise<boolean> {
        if (this.user)
            return true;

        try {
            const result = await Axios.post('/api/users', {
                email: email
            });

            if (result.status === 200) {
                Sentry.addBreadcrumb({
                    message: 'Login Success!',
                    category: 'auth',
                    level: Sentry.Severity.Info,
                    type: 'default'
                });
                console.log('[AppManager] Login Success!', result);

                this._user = result.data;
                await this._fileManager.init();
                this._userSubject.next(this._user);
                this._saveUser();
                return true;
            } else {
                Sentry.addBreadcrumb({
                    message: 'Login failure',
                    category: 'auth',
                    level: Sentry.Severity.Error,
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