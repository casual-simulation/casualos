import Axios from 'axios';
import * as Sentry from '@sentry/browser';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
    email: string;
    username: string;
    name: string;
}

export class AppManager {

    private _user: BehaviorSubject<User>;

    constructor() {
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

    get userObservable(): Observable<User> {
        return this._user;
    }

    get user(): User {
        return this._user.value;
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