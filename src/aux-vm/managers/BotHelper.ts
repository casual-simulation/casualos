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
import type {
    PartialBot,
    Bot,
    BotAction,
    BotsState,
    BotCalculationContext,
    PrecalculatedBot,
    PrecalculatedBotsState,
    ShoutAction,
    BotSpace,
    UpdateBotAction,
} from '@casual-simulation/aux-common';
import {
    createBot,
    action,
    addState,
    calculateFormattedBotValue,
    calculateBotValue,
    calculateDestroyBotEvents,
    botAdded,
    botUpdated,
    isPrecalculated,
    formatValue,
    createPrecalculatedContext,
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
    hasValue,
    EDITING_TAG_SPACE,
    EDITING_TAG,
    EDITING_BOT,
    createBotLink,
} from '@casual-simulation/aux-common';
import { BaseHelper } from './BaseHelper';
import type { AuxVM } from '../vm/AuxVM';
import type { ChannelActionResult } from '../vm';
import type { AuxDevice } from '@casual-simulation/aux-runtime';
import type { SimulationOrigin } from './Simulation';

/**
 * Defines an class that contains a simple set of functions
 * that help manipulate bots.
 */
export class BotHelper extends BaseHelper<PrecalculatedBot> {
    private static readonly _debug = false;
    // private _localEvents: Subject<LocalActions>;
    private _state: PrecalculatedBotsState;
    private _vm: AuxVM;
    private _batchUpdates: boolean;
    private _botUpdates: UpdateBotAction[] = [];
    private _batchPending: boolean = false;
    private _batchPromise: Promise<void>;

    /**
     * The ID of the inst that the VM is running.
     * Null if the VM does not have an origin.
     */
    get origin(): SimulationOrigin {
        return this._vm.origin;
    }

    /**
     * Creates a new bot helper.
     * @param configBotId The ID of the config bot.
     * @param vm The VM that is in use.
     * @param batch Whether to batch bot updates together.
     */
    constructor(vm: AuxVM, batch: boolean = true) {
        super(vm.configBotId);
        this._vm = vm;
        this._batchUpdates = batch;
        this.userId = vm.configBotId;
    }

    /**
     * Gets the current local bot state.
     */
    get botsState() {
        return this._state;
    }

    /**
     * Sets the current local bot state.
     */
    set botsState(state: PrecalculatedBotsState) {
        this._state = state;
    }

    /**
     * Gets the observable list of local events that have been processed by this bot helper.
     */
    // get localEvents(): Observable<LocalActions> {
    //     return this._localEvents;
    // }

    async updateDevice(device: AuxDevice): Promise<void> {
        await this._vm.updateDevice(device);
    }

    /**
     * Creates a BotCalculationContext.
     */
    createContext(): BotCalculationContext {
        return createPrecalculatedContext(this.objects);
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: Bot, newData: PartialBot): Promise<void> {
        if (this._batchUpdates) {
            this._botUpdates.push(botUpdated(bot.id, newData));
            if (!this._batchPending) {
                this._batchPending = true;
                this._batchPromise = new Promise((resolve, reject) => {
                    queueMicrotask(() => {
                        const updates = this._botUpdates;
                        this._botUpdates = [];
                        this._batchPending = false;
                        this.transaction(...updates).then(resolve, reject);
                    });
                });
            }

            return this._batchPromise;
        }

        return this.transaction(botUpdated(bot.id, newData));
    }

    /**
     * Creates a new bot with the given ID and tags. Returns the ID of the new bot.
     * @param id (Optional) The ID that the bot should have.
     * @param tags (Optional) The tags that the bot should have.
     * @param sendShouts Whether to send the onCreate() and onAnyCreate() shouts.
     * @param space The space the bot should be stored in.
     */
    async createBot(
        id?: string,
        tags?: Bot['tags'],
        sendShouts: boolean = true,
        space?: BotSpace
    ): Promise<string> {
        if (BotHelper._debug) {
            console.log('[BotManager] Create Bot');
        }

        const bot = createBot(id, tags, space);

        let events: BotAction[] = [botAdded(bot)];

        if (sendShouts) {
            events.push(
                action(CREATE_ACTION_NAME, [bot.id], this.userId),
                action(CREATE_ANY_ACTION_NAME, null, this.userId, {
                    bot: bot,
                })
            );
        }
        await this._vm.sendEvents(events);

        return bot.id;
    }

    /**
     * Deletes the given bot.
     * @param bot The bot to delete.
     */
    async destroyBot(bot: Bot): Promise<boolean> {
        const calc = this.createContext();
        const events = calculateDestroyBotEvents(calc, bot);
        await this.transaction(...events);
        return events.some((e) => e.type === 'remove_bot' && e.id === bot.id);
    }

    /**
     * Runs the given formulas in a batch.
     * @param formulas The formulas to run.
     */
    async formulaBatch(formulas: string[]): Promise<void> {
        if (BotHelper._debug) {
            console.log('[BotManager] Run formula:', formulas);
        }

        await this._vm.formulaBatch(formulas);
    }

    /**
     * Runs the given actions in a batch.
     * @param actions The actions to run.
     */
    actions(
        actions: { eventName: string; bots: Bot[]; arg?: any }[]
    ): ShoutAction[] {
        return actions.map((b) => {
            const botIds = b.bots ? b.bots.map((f) => f.id) : null;
            const actionData = action(b.eventName, botIds, this.userId, b.arg);
            return actionData;
        });
    }

    /**
     * Runs the given event on the given bots.
     * @param eventName The name of the event to run.
     * @param bots The bots that should be searched for handlers for the event name.
     * @param arg The argument that should be passed to the event handlers.
     */
    async action(eventName: string, bots: Bot[], arg?: any): Promise<void> {
        const botIds = bots ? bots.map((f) => f.id) : null;
        const actionData = action(eventName, botIds, this.userId, arg);
        await this._vm.sendEvents([actionData]);
    }

    /**
     * Runs the given event on the given bots.
     * @param eventName The name of the event to run.
     * @param bots The bots that should be searched for handlers for the event name.
     * @param arg The argument that should be passed to the event handlers.
     */
    async shout(
        eventName: string,
        bots: (Bot | string)[] | null,
        arg?: any
    ): Promise<ChannelActionResult> {
        const botIds = bots
            ? bots
                  .filter((b) => hasValue(b))
                  .map((f) => (typeof f === 'object' ? f.id : f))
            : null;
        return await this._vm.shout(eventName, botIds, arg);
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: BotAction[]): Promise<void> {
        await this._vm.sendEvents(events);
    }

    /**
     * Adds the given state to the current bot state.
     * @param state The state to add.
     */
    async addState(state: BotsState): Promise<void> {
        await this._vm.sendEvents([addState(state)]);
    }

    /**
     * Calculates the nicely formatted value for the given bot and tag.
     * @param bot The bot to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedBotValue(bot: Bot, tag: string): string {
        if (isPrecalculated(bot)) {
            return formatValue(bot.values[tag]);
        }
        // Provide a null context because we cannot calculate formulas
        // and therefore do not need the context for anything.
        return calculateFormattedBotValue(null, bot, tag);
    }

    /**
     * Calculates the value of the tag on the given bot.
     * @param bot The bot.
     * @param tag The tag to calculate the value of.
     */
    calculateBotValue(bot: Bot, tag: string) {
        if (isPrecalculated(bot)) {
            return bot.values[tag];
        }
        // Provide a null context because we cannot calculate formulas
        // and therefore do not need the context for anything.
        return calculateBotValue(null, bot, tag);
    }

    /**
     * Sets the bot that the user is editing.
     * @param bot The bot.
     */
    setEditingBot(bot: Bot, tag: string, space?: string) {
        return this.updateBot(this.userBot, {
            tags: {
                [EDITING_BOT]: createBotLink([bot.id]),
                [EDITING_TAG]: tag,
                [EDITING_TAG_SPACE]: space ?? null,
                cursorStartIndex: null,
                cursorEndIndex: null,
            },
        });
    }
}
