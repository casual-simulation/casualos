import {
    BotsState,
    getActiveObjects,
    Bot,
} from '@casual-simulation/aux-common';

/**
 * Defines a base class for bot helper-like managers.
 */
export abstract class BaseHelper<TBot extends Bot> {
    private _configBotId: string = null;

    /**
     * Creates a new bot helper.
     * @param configBotId The ID of the config bot.
     */
    constructor(configBotId: string) {
        this._configBotId = configBotId;
    }

    /**
     * Gets the ID of the user's bot.
     * @deprecated Use configBotId instead.
     */
    get userId() {
        return this._configBotId;
    }

    /**
     * Sets the ID of the user's bot.
     */
    set userId(id: string) {
        this._configBotId = id;
    }

    /**
     * Gets the ID of the config bot.
     */
    get configBotId() {
        return this._configBotId;
    }

    /**
     * Gets all the bots that represent an object.
     */
    get objects(): TBot[] {
        return <TBot[]>getActiveObjects(this.botsState);
    }

    /**
     * Gets the bot for the current user.
     * @deprecated Use configBot instead.
     */
    get userBot(): TBot {
        return this.configBot;
    }

    /**
     * Gets the config bot.
     */
    get configBot(): TBot {
        if (!this._configBotId) {
            return null;
        }
        if (!this.botsState) {
            return null;
        }
        return <TBot>this.botsState[this._configBotId];
    }

    /**
     * Gets the current local bot state.
     */
    abstract get botsState(): BotsState;
}
