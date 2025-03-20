/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { BotsState, Bot } from '@casual-simulation/aux-common';
import { getActiveObjects } from '@casual-simulation/aux-common';

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
