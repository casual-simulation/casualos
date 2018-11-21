import Axios from 'axios';
import * as git from 'isomorphic-git';
import * as BrowserFS from 'browserfs';
import * as pify from 'pify';
import { FSModule } from 'browserfs/dist/node/core/FS';

export interface User {
    email: string;
    username: string;
    name: string;
}

export interface Config {
    default_project_url: string;
    local_project_dir: string;
}

export class AppManager {

    private _user: User = null;
    private _fs: FSModule;
    private _pfs: any;
    private _config: Config;
    private _started: boolean = false;
    private _startPromise: Promise<any> = null;

    constructor(config: Config) {
        this._config = config;

        const localStorage = window.localStorage;
        const u = localStorage.getItem("user");
        if (u) {
            this._user = JSON.parse(u);
        }
    }

    get user(): User {
        return this._user;
    }

    get fs(): any {
        return this._pfs;
    }

    get projectDir(): string {
        return this._config.local_project_dir;
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
                console.log('Success!', result);
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

    private async _start(): Promise<any> {
        let fsOptions = {
            fs: 'IndexedDB',
            options: {}
        };
            
        let configureAsync = pify(BrowserFS.configure);
    
        await configureAsync(fsOptions);
        this._fs = BrowserFS.BFSRequire('fs');
    
        // Initialize isomorphic-git with our new file system
        git.plugins.set('fs', this._fs);
    
        this._pfs = pify(this._fs);
        let dir = 'default';
    }

    async startIfNeeded(): Promise<any> {
        if(!this._started) {
            if(this._startPromise) {
                await this._startPromise;
            } else {
                this._startPromise = this._start();
                await this._startPromise;
            }
        }
    }

    async isProjectCloned(): Promise<boolean> {
        return this.exists(this._config.local_project_dir);
    }

    async cloneProject(): Promise<any> {
        await git.clone({
            dir: this._config.local_project_dir,
            url: this._config.default_project_url,
            ref: 'master'
        });
    }

    async updateProject(): Promise<any> {
        await git.pull({
            dir: this._config.local_project_dir,
            ref: 'master'
        });
    }

    async exists(path: string): Promise<boolean> {
        try {
            return await this._pfs.exists(path);
        } catch(ex) {
            return ex;
        }
    }
}

export const config: Config = {
    default_project_url: 'http://localhost:3000/git/root/default.git',
    local_project_dir: 'default'
};

export const appManager = new AppManager(config);