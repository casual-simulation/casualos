import Axios from 'axios';
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
                this._user.next(result.data);
                this._saveUser();
                console.log('[AppManager] Login Success!', result);
                return true;
            } else {
                console.error(result);
                return false;
            }
        } catch (ex) {
            console.error(ex);
            return false;
        }
    }
}

export const appManager = new AppManager();