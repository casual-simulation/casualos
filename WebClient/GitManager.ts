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
    commit,
    currentBranch,
} from 'isomorphic-git';
import {EventEmitter} from 'events';
import * as BrowserFS from 'browserfs';
import * as pify from 'pify';
import { FSModule } from 'browserfs/dist/node/core/FS';
import {Subject} from 'rxjs';
import { AppManager, appManager } from './AppManager';
import {File, FileType} from './Core/File';
import {commitAdded, CommitAddedEvent} from './Core/Event';

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
    private _index: string[];
    private _emitter: EventEmitter;

    constructor(config: Config, appManager: AppManager) {
        this._config = config;
        this._appManager = appManager;
        this._index = [];
        this._emitter = new EventEmitter();

        this._emitter.on('message', (message) => this._handleGitMessage(message));
        this._emitter.on('progress', (progress) => this._handleGitProgress(progress));
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

    get email(): string {
        return this._appManager.user.email;
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
    
        window.localStorage.setItem('debug', 'isomorphic-git');

        // Initialize isomorphic-git with our new file system
        (<any>gitPlugins).set('fs', this._fs);
        (<any>gitPlugins).set('emitter', this._emitter);
    
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
        await checkout({
            dir: this.projectDir,
            ref: 'master'
        });

        await pull({
            dir: this.projectDir,
            ref: 'master'
        });

        await this.checkoutOrCreate(this.localUserBranch);

        console.log(`[GitManager] Pulling ${this.localUserBranch}...`);
        await pull({
            dir: this.projectDir,
            ref: this.localUserBranch
        });

        console.log(`[GitManager] Merging "master" into "${this.localUserBranch}"...`);
        const masterIntoLocalReport = await merge({
            dir: this._config.local_project_dir,
            theirs: 'master'
        });

        console.log('[GitManager] Merge Report', masterIntoLocalReport);

        await this.pushIfNeeded(this.localUserBranch);

        await this.checkoutOrCreate(this.localUserBranch);

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
     * Gets a list of files (.file or .ws) that are currently in the repository.
     */
    async listFiles(): Promise<File[]> {
        const list: string[] = await this.fs.readdir(this.projectDir);
        const fileList = list.filter(filename => /\.file$/.test(filename) || /\.ws$/.test(filename));

        const files = await Promise.all(
            fileList.map(async file => {
                const type = /\.file$/.test(file) ? "file" : "workspace";
                const data: string = await this.fs.readFile(`${this.projectDir}/${file}`, 'utf8');
                return File.parseFile(type, data);
            })
        );

        return files;
    }

    /**
     * Saves the given file to the filesystem and adds it to the index.
     */
    async saveFile(file: File): Promise<void> {
        if (!file.changed) {
            return;
        }
        await this._pfs.writeFile(this._path(file), file.content);
        file.saved();

        await this._add(file.filename);
    }

    /**
     * Determines if a commit can be created.
     * Basically just checks if anything has been added to the index.
     */
    canCommit(): boolean {
        const changedFiles = this.index();
        return changedFiles.length > 0;
    }

    /**
     * Commits the files that were added to the index.
     */
    async commit(message: string): Promise<void> {
        console.log(`[GitManager] Committing...`);
        const sha = await commit({
            dir: this.projectDir,
            message: message,
            author: {
                email: this.email,
                name: this.username
            }
        });
        this._clearIndex();
        console.log(`[GitManager] Committed ${sha}.`);
        
        const branch = await currentBranch({
            dir: this.projectDir
        });

        console.log(`[GitManager] Merging "${branch}" into "master"...`);

        await merge({
            dir: this.projectDir,
            theirs: branch,
            ours: 'master'
        });

        await this.pushIfNeeded('master');

        this._appManager.events.next(commitAdded(sha, branch, this.email, this.username));
        console.log(`[GitManager] Sent commit notification.`);
    }

    /**
     * Gets the list of files added to the git index.
     */
    index(): string[] {
        return this._index;
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
            await this._checkout(branchName);
        } catch(err) {
            await branch({
                dir: this.projectDir,
                ref: branchName
            });

            await this._checkout(branchName);

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
        console.log(`[GitManager] Pushing "${branchName}"...`);

        const remoteCommit = await this.resolveRef(`refs/remotes/origin/${branchName}`);
        const localCommit = await this.resolveRef(branchName);

        if (remoteCommit !== localCommit) {
            await push({
                dir: this.projectDir,
                ref: branchName,
                username: this.username,
                password: this.password
            });
            console.log(`[GitManager] Pushed.`);
        } else {
            console.log(`[GitManager] Push not needed.`);
        }
    }

    async resolveRef(ref: string): Promise<string> {
        try {
            const commitSha = await resolveRef({
                dir: this.projectDir,
                ref: ref
            });

            return commitSha;
        } catch(err) {
            return null;
        }
    }

    private _path(file: File): string {
        return `${this._config.local_project_dir}/${file.filename}`;
    }

    private async _checkout(branch: string) {
        await checkout({
            dir: this.projectDir,
            ref: branch
        });
        this._clearIndex();
    }

    private async _add(path: string) {
        this._index.push(path);
        await add({
            dir: this.projectDir,
            filepath: path
        });
    }

    private _clearIndex() {
        this._index.splice(0, this._index.length);
    }

    private _handleGitMessage(message: string) {
        console.log('[GitManager]:', message);
    }

    private _handleGitProgress(progress: any) {
        // console.log(`[GitManager]: ${Math.floor((progress.loaded / progress.total) * 100)}%`);
    }
}


export const config: Config = {
    default_project_url: 'http://localhost:3000/git/root/default.git',
    local_project_dir: 'default'
};

export const gitManager = new GitManager(config, appManager);
