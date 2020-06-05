import {
    BotsState,
    getActiveObjects,
    Bot,
} from '@casual-simulation/aux-common';

/**
 * Defines a base class for bot helper-like managers.
 */
export abstract class BaseHelper<TBot extends Bot> {
    private _userId: string = null;

    /**
     * Creates a new bot helper.
     * @param userBotId The ID of the user's bot.
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
    get objects(): TBot[] {
        return <TBot[]>getActiveObjects(this.botsState);
    }

    /**
     * Gets the bot for the current user.
     */
    get userBot(): TBot {
        if (!this._userId) {
            return null;
        }
        if (!this.botsState) {
            return null;
        }
        return <TBot>this.botsState[this._userId];
    }

    /**
     * Gets the current local bot state.
     */
    abstract get botsState(): BotsState;
}
