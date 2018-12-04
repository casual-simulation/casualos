import Axios from 'axios';
import { Subject } from 'rxjs';

export interface User {
    email: string;
    username: string;
    name: string;
}

export class AppManager {

    private _user: User = null;

    constructor() {
        const localStorage = window.localStorage;
        const u = localStorage.getItem("user");
        if (u) {
            this._user = JSON.parse(u);
        }
    }

    get user(): User {
        return this._user;
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
        console.log("[AppManager] Logout");
        this._user = null;
        this._saveUser();
    }

    async loginOrCreateUser(email: string): Promise<boolean> {
        if (this.user !== null)
            return true;

        try {
            const result = await Axios.post('/api/users', {
                email: email
            });

            if (result.status === 200) {
                this._user = result.data;
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