import * as uuid from 'uuid/v4';
import {FileData} from './FileData';
import {WorkspaceData} from './WorkspaceData';

export type FileType = "file" | "workspace";

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
     * The type of the file.
     */
    type: FileType;

    /**
     * The data contained in the file.
     */
    data: FileData | WorkspaceData;

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

    constructor(id: string, type: FileType, data?: FileData | WorkspaceData) {
        this.id = id;
        this.type = type;
        this.data = data || {
            id: this.id,
            position: { x: 0, y: 0 }
        };
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