import {
    PartialBot,
    Bot,
    BotAction,
    BotsState,
    BotCalculationContext,
    createBot,
    action,
    addState,
    calculateFormattedBotValue,
    calculateBotValue,
    calculateDestroyBotEvents,
    merge,
    PrecalculatedBot,
    PrecalculatedBotsState,
    botAdded,
    ShoutAction,
    botUpdated,
    isPrecalculated,
    formatValue,
    createPrecalculatedContext,
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
    BotSpace,
    hasValue,
    EDITING_TAG_SPACE,
    EDITING_TAG,
    EDITING_BOT,
    createBotLink,
    UpdateBotAction,
} from '@casual-simulation/aux-common';
import { BaseHelper } from './BaseHelper';
import { AuxVM } from '../vm/AuxVM';
import { ChannelActionResult } from '../vm';

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
     * Creates a new bot helper.
     * @param vm The VM that is in use.
     * @param batch Whether to batch bot updates together.
     */
    constructor(vm: AuxVM, batch: boolean = true) {
        super();
        this._vm = vm;
        this._batchUpdates = batch;
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
        bots: (Bot | string)[],
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
