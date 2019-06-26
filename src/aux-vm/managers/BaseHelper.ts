import {
    FilesState,
    getActiveObjects,
    File,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';

/**
 * Defines a base class for file helper-like managers.
 */
export abstract class BaseHelper<TFile extends File> {
    private _userId: string;

    /**
     * Creates a new file helper.
     * @param userFileId The ID of the user's file.
     */
    constructor(userFileId: string) {
        this._userId = userFileId;
    }

    /**
     * Gets the ID of the user's file.
     */
    get userId() {
        return this._userId;
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
        var objs = this.filesState[this._userId];
        if (objs.length > 0) {
            return objs[0];
        }
        return null;
    }

    /**
     * Gets the globals file for the simulation.
     */
    get globalsFile(): TFile {
        let objs = this.filesState[GLOBALS_FILE_ID];
        if (objs.length > 0) {
            return objs[0];
        }
        return null;
    }

    /**
     * Gets the current local file state.
     */
    abstract get filesState(): FilesState;
}
