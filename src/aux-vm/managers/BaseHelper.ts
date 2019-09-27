import {
    BotsState,
    getActiveObjects,
    Bot,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';

/**
 * Defines a base class for bot helper-like managers.
 */
export abstract class BaseHelper<TFile extends Bot> {
    private _userId: string = null;

    /**
     * Creates a new bot helper.
     * @param userFileId The ID of the user's bot.
     */
    constructor() {}

    /**
     * Gets the ID of the user's bot.
     */
    get userId() {
        return this._userId;
    }

    /**
     * Sets the ID of the user's bot.
     */
    set userId(id: string) {
        this._userId = id;
    }

    /**
     * Gets all the bots that represent an object.
     */
    get objects(): TFile[] {
        return <TFile[]>getActiveObjects(this.botsState);
    }

    /**
     * Gets the bot for the current user.
     */
    get userFile(): TFile {
        if (!this._userId) {
            return null;
        }
        if (!this.botsState) {
            return null;
        }
        return <TFile>this.botsState[this._userId];
    }

    /**
     * Gets the globals bot for the simulation.
     */
    get globalsFile(): TFile {
        if (!this.botsState) {
            return null;
        }
        return <TFile>this.botsState[GLOBALS_FILE_ID];
    }

    /**
     * Gets the current local bot state.
     */
    abstract get botsState(): BotsState;
}
