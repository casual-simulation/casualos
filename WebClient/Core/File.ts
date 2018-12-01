import * as uuid from 'uuid/v4';
import {FileData} from './FileData';
import {WorkspaceData} from './WorkspaceData';
import {
    cloneDeep
} from 'lodash';

export type FileType = "file" | "workspace";
export type Data = FileData | WorkspaceData;


/**
 * Represents a file. That is, an object that has an ID and can be saved to 
 * a .file file.
 */
export class File {
    /**
     * The data that was in the original file.
     */
    private _data: Data;

    /**
     * The GUID of the file.
     */
    id: string;

    /**
     * The type of the file.
     */
    type: FileType;

    /**
     * The data currently contained in the file.
     */
    data: Data;

    /**
     * Gets whether this file has changed.
     */
    get changed(): boolean {
        const old = JSON.stringify(this._data);
        const newData = JSON.stringify(this.data);
        return old !== newData;
    }

    /**
     * Gets the filename of the file.
     */
    get filename(): string {
        return `${this.id}.${this.extension}`;
    }

    /**
     * Gets the extension of the file.
     */
    get extension(): string {
        if(this.type === "file") {
            return "file";
        } else {
            return "ws";
        }
    }

    /**
     * Gets the text content contained in this file.
     * For the parsed version, use the data property.
     */
    get content(): string {
        return JSON.stringify(this.data);
    }

    /**
     * Tells the file that it was saved to the disk and therefore does not have changes.
     */
    saved(): void {
        this._data = JSON.parse(JSON.stringify(this.data));
    }

    constructor(id: string, type: FileType, data?: FileData | WorkspaceData) {
        this.id = id;
        this.type = type;
        this._data = data ? cloneDeep(data) : null;
        this.data = data;
        if (!this.data && this.type === 'file') {
            this.data = {
                id: id,
                position: {x: 0, y: 0},
                tags: {},
                workspace: null
            };
        } else if(!this.data) {
            this.data = {
                id: id,
                position: {x: 0, y: 0}
            };
        }
    }

    /**
     * Creates a new file with a random UUID.
     */
    static createFile(type: FileType): File {
        return new File(uuid(), type);
    }

    /**
     * Parses the given JSON into a file.
     * @param json 
     */
    static parseFile(type: FileType, json: string): File {
        const data: FileData | WorkspaceData = JSON.parse(json);
        return new File(data.id, type, data);
    }
}