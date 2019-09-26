import {
    FilesState,
    getActiveObjects,
    Bot,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';

/**
 * Defines a base class for file helper-like managers.
 */
export abstract class BaseHelper<TFile extends Bot> {
    private _userId: string = null;

    /**
     * Creates a new file helper.
     * @param userFileId The ID of the user's file.
     */
    constructor() {}

    /**
     * Gets the ID of the user's file.
     */
    get userId() {
        return this._userId;
    }

    /**
     * Sets the ID of the user's file.
     */
    set userId(id: string) {
        this._userId = id;
    }

    /**
     * Gets all the files that represent an object.
     */
    get objects(): TFile[] {
        return <TFile[]>getActiveObjects(this.filesState);
    }

    /**
     * Gets the file for the current user.
     */
    get userFile(): TFile {
        if (!this._userId) {
            return null;
        }
        if (!this.filesState) {
            return null;
        }
        return <TFile>this.filesState[this._userId];
    }

    /**
     * Gets the globals file for the simulation.
     */
    get globalsFile(): TFile {
        if (!this.filesState) {
            return null;
        }
        return <TFile>this.filesState[GLOBALS_FILE_ID];
    }

    /**
     * Gets the current local file state.
     */
    abstract get filesState(): FilesState;
}
