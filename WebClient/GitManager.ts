import { 
    plugins as gitPlugins,
    clone, 
    log,
    pull,
    push,
    add,
    checkout,
    merge,
    branch,
    resolveRef,
    listFiles,
} from 'isomorphic-git';
import * as BrowserFS from 'browserfs';
import * as pify from 'pify';
import { FSModule } from 'browserfs/dist/node/core/FS';
import { AppManager, appManager } from './AppManager';
import {File} from './Core/File';

export interface Config {
    default_project_url: string;
    local_project_dir: string;
}

export class GitManager {
    private _fs: FSModule;
    private _pfs: any;
    private _config: Config;
    private _started: boolean = false;
    private _startPromise: Promise<any> = null;
    private _appManager: AppManager;

    constructor(config: Config, appManager: AppManager) {
        this._config = config;
        this._appManager = appManager;
    }
    
    get fs(): any {
        return this._pfs;
    }

    get projectDir(): string {
        return this._config.local_project_dir;
    }

    get localUserBranch(): string {
        return this._appManager.user.username;
    }

    get remoteUserBranch(): string {
        return `refs/remotes/origin/${this.localUserBranch}`;
    }

    get username(): string {
        return this._appManager.user.username;
    }

    get password(): string {
        return 'buggycar';
    }

    private async _start(): Promise<any> {
        console.log('[GitManager] Start');
        let fsOptions = {
            fs: 'IndexedDB',
            options: {}
        };
            
        let configureAsync = pify(BrowserFS.configure);
    
        await configureAsync(fsOptions);
        this._fs = BrowserFS.BFSRequire('fs');
    
        // Initialize isomorphic-git with our new file system
        gitPlugins.set('fs', this._fs);
    
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
        await clone({
            dir: this.projectDir,
            url: this._config.default_project_url,
            ref: 'master'
        });
    }

    async updateProject(): Promise<any> {
        console.log('[GitManager] Updating Project...');
        
        console.log('[GitManager] Pulling "master"...');
        await pull({
            dir: this.projectDir,
            ref: 'master'
        });

        await this.checkoutOrCreate(this.localUserBranch);

        console.log(`[GitManager] Merging "master" into "${this.localUserBranch}"...`);
        await merge({
            dir: this._config.local_project_dir,
            theirs: 'master'
        });

        await this.pushIfNeeded(this.localUserBranch);

        console.log('[GitManager] Project Updated!');
    }

    async commitLog(): Promise<git.CommitDescription[]> {
        return await log({
            dir: this.projectDir
        });
    }

    /**
     * Creates a new file.
     */
    createNewFile():File {
        return File.createFile("file");
    }

    /**
     * Creates a new workspace.
     */
    createNewWorkspace(): File {
        return File.createFile("workspace");
    }

    /**
     * Saves the given file to the filesystem and adds it to the index.
     */
    async saveFile(file: File): Promise<void> {
        await this._pfs.writeFile(this._path(file), file.content);

        await add({
            dir: this.projectDir,
            filepath: file.filename
        });
    }

    /**
     * Gets the list of files added to the git index.
     */
    async index(): Promise<string[]> {
        return await listFiles({
            dir: this.projectDir
        });
    }

    async exists(path: string): Promise<boolean> {
        try {
            return await this._pfs.exists(path);
        } catch(ex) {
            return ex;
        }
    }

    async checkoutOrCreate(branchName: string): Promise<void> {
        console.log(`[GitManager] Checking out "${this.localUserBranch}"...`);
        try {
            await checkout({
                dir: this.projectDir,
                ref: branchName
            });
        } catch(err) {
            await branch({
                dir: this.projectDir,
                ref: branchName
            });

            await checkout({
                dir: this.projectDir,
                ref: branchName
            });

            await push({
                dir: this.projectDir,
                ref: branchName,
                username: this.username,
                password: this.password
            });
        }
    }

    /**
     * Pushes the given branch to the remote repository if the reference has been updated.
     */
    async pushIfNeeded(branchName: string): Promise<void> {
        console.log(`[GitManager] Pushing "${this.localUserBranch}"...`);

        const remoteCommit = await this.resolveRef(this.remoteUserBranch);
        const localCommit = await this.resolveRef(this.localUserBranch);

        if (remoteCommit !== localCommit) {
            await push({
                dir: this.projectDir,
                ref: this.localUserBranch,
                username: this.username,
                password: this.password
            });
        }
    }

    async resolveRef(ref: string): Promise<string> {
        try {
            const remoteCommit = await resolveRef({
                dir: this.projectDir,
                ref: this.remoteUserBranch
            });
        } catch(err) {
            return null;
        }
    }

    private _path(file: File): string {
        return `${this._config.local_project_dir}/${file.filename}`;
    }
}


export const config: Config = {
    default_project_url: 'http://localhost:3000/git/root/default.git',
    local_project_dir: 'default'
};

export const gitManager = new GitManager(config, appManager);
