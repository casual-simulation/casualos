import { 
    plugins as gitPlugins,
    clone, 
    log,
    pull,
    add,
} from 'isomorphic-git';
import * as uuid from 'uuid/v4';
import * as BrowserFS from 'browserfs';
import * as pify from 'pify';
import { FSModule } from 'browserfs/dist/node/core/FS';

export interface Config {
    default_project_url: string;
    local_project_dir: string;
}

export interface Vector2 {
    x: number;
    y: number;
}

export interface FileData {
    id: string;
    position: Vector2;
}


/**
 * Represents a file. That is, an object that has an ID and can be saved to 
 * a .file file.
 */
export class File {
    /**
     * The GUID of the file.
     */
    id: string;

    /**
     * The data contained in the file.
     */
    data: FileData;

    /**
     * Gets the filename of the file.
     */
    get filename(): string {
        return `${this.id}.file`;
    }

    /**
     * Gets the text content contained in this file.
     * For the parsed version, use the data property.
     */
    get content(): string {
        return JSON.stringify(this.data);
    }

    constructor(id: string, data?: FileData) {
        this.id = id;
        this.data = data || {
            id: this.id,
            position: { x: 0, y: 0 }
        };
    }

    /**
     * Creates a new file with a random UUID.
     */
    static createFile(): File {
        return new File(uuid());
    }

    /**
     * Parses the given JSON into a file.
     * @param json 
     */
    static parseFile(json: string): File {
        const data: FileData = JSON.parse(json);
        return new File(data.id, data);
    }
}

export class GitManager {
    private _fs: FSModule;
    private _pfs: any;
    private _config: Config;
    private _started: boolean = false;
    private _startPromise: Promise<any> = null;

    constructor(config: Config) {
        this._config = config;
    }
    
    get fs(): any {
        return this._pfs;
    }

    get projectDir(): string {
        return this._config.local_project_dir;
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
            dir: this._config.local_project_dir,
            url: this._config.default_project_url,
            ref: 'master'
        });
    }

    async updateProject(): Promise<any> {
        await pull({
            dir: this._config.local_project_dir,
            ref: 'master'
        });
    }

    async commitLog(): Promise<git.CommitDescription[]> {
        return await log({
            dir: this._config.local_project_dir
        });
    }

    /**
     * Creates a new file.
     */
    createNewFile():File {
        return File.createFile();
    }

    /**
     * Saves the given file to the filesystem and adds it to the index.
     */
    async saveFile(file: File): Promise<any> {
        await this._pfs.writeFile(this._path(file), file.content);

        await add({
            dir: this._config.local_project_dir,
            filepath: file.filename
        });
    }

    async exists(path: string): Promise<boolean> {
        try {
            return await this._pfs.exists(path);
        } catch(ex) {
            return ex;
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

export const gitManager = new GitManager(config);
