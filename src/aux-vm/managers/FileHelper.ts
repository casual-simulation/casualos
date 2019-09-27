import {
    PartialFile,
    Bot,
    BotAction,
    BotsState,
    AuxObject,
    BotCalculationContext,
    createBot,
    createWorkspace,
    action,
    addState,
    Workspace,
    calculateFormattedFileValue,
    calculateBotValue,
    botsInContext,
    getBotChannel,
    calculateDestroyFileEvents,
    merge,
    PrecalculatedBot,
    PrecalculatedBotsState,
    botAdded,
    ShoutAction,
    botUpdated,
    isPrecalculated,
    formatValue,
} from '@casual-simulation/aux-common';
import { flatMap } from 'lodash';
import { BaseHelper } from './BaseHelper';
import { AuxVM } from '../vm/AuxVM';

/**
 * Defines an class that contains a simple set of functions
 * that help manipulate bots.
 */
export class BotHelper extends BaseHelper<PrecalculatedBot> {
    private static readonly _debug = false;
    // private _localEvents: Subject<LocalActions>;
    private _state: PrecalculatedBotsState;
    private _vm: AuxVM;

    /**
     * Creates a new bot helper.
     * @param tree The tree that the bot helper should use.
     * @param userFileId The ID of the user's bot.
     */
    constructor(vm: AuxVM) {
        super();
        this._vm = vm;
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
        return {
            objects: this.objects,
            cache: new Map(),
        };
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: Bot, newData: PartialFile): Promise<void> {
        await this.transaction(botUpdated(bot.id, newData));
    }

    /**
     * Creates a new bot with the given ID and tags. Returns the ID of the new bot.
     * @param id (Optional) The ID that the bot should have.
     * @param tags (Optional) The tags that the bot should have.
     */
    async createBot(id?: string, tags?: Bot['tags']): Promise<string> {
        if (BotHelper._debug) {
            console.log('[BotManager] Create Bot');
        }

        const bot = createBot(id, tags);

        await this._vm.sendEvents([botAdded(bot)]);

        return bot.id;
    }

    /**
     * Creates a new workspace bot.
     * @param botId The ID of the bot to create. If not specified a new ID will be generated.
     * @param builderContextId The ID of the context to create for the bot. If not specified a new context ID will be generated.
     * @param locked Whether the context should be accessible in AUX Player.
     */
    async createWorkspace(
        botId?: string,
        builderContextId?: string,
        locked?: boolean,
        visible?: boolean,
        x?: number,
        y?: number
    ): Promise<PrecalculatedBot> {
        if (BotHelper._debug) {
            console.log('[BotManager] Create Workspace');
        }

        const workspace: Workspace = createWorkspace(
            botId,
            builderContextId,
            locked
        );

        let visType;

        if (visible) {
            visType = 'surface';
        } else {
            visType = false;
        }

        const updated = merge(workspace, {
            tags: {
                'aux.context.x': x || 0,
                'aux.context.y': y || 0,
                'aux.context.visualize': visType || false,
            },
        });

        await this._vm.sendEvents([botAdded(updated)]);
        // await this._tree.addFile(updated);

        return this.botsState[workspace.id];
    }

    /**
     * Creates a new bot for the current user that loads the simulation with the given ID.
     * @param id The ID of the simulation to load.
     * @param botId The ID of the bot to create.
     */
    async createSimulation(id: string, botId?: string) {
        const simFiles = this.getSimulationFiles(id);

        if (simFiles.length === 0) {
            await this.createBot(botId, {
                [this.userFile.tags['aux._userSimulationsContext']]: true,
                ['aux.channel']: id,
            });
        }
    }

    /**
     * Gets the list of bots that are loading the simulation with the given ID.
     * @param id The ID of the simulation.
     */
    getSimulationFiles(id: string) {
        const calc = this.createContext();
        const simFiles = this._getSimulationFiles(calc, id);
        return simFiles;
    }

    /**
     * Deletes all the bots in the current user's simulation context that load the given simulation ID.
     * @param id The ID of the simulation to load.
     */
    async destroySimulations(id: string) {
        const calc = this.createContext();
        const simFiles = this._getSimulationFiles(calc, id);

        const events = flatMap(simFiles, f =>
            calculateDestroyFileEvents(calc, f)
        );

        await this.transaction(...events);
    }

    /**
     * Deletes the given bot.
     * @param bot The bot to delete.
     */
    async destroyFile(bot: Bot): Promise<boolean> {
        const calc = this.createContext();
        const events = calculateDestroyFileEvents(calc, bot);
        await this.transaction(...events);
        return events.some(e => e.type === 'remove_bot' && e.id === bot.id);
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
        return actions.map(b => {
            const botIds = b.bots ? b.bots.map(f => f.id) : null;
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
        const botIds = bots ? bots.map(f => f.id) : null;
        const actionData = action(eventName, botIds, this.userId, arg);
        await this._vm.sendEvents([actionData]);
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: BotAction[]): Promise<void> {
        await this._vm.sendEvents(events);
        // await this._tree.addEvents(events);
        // this._sendLocalEvents(events);
    }

    /**
     * Adds the given state to the current bot state.
     * @param state The state to add.
     */
    async addState(state: BotsState): Promise<void> {
        await this._vm.sendEvents([addState(state)]);
        // await this._tree.addEvents([]);
    }

    /**
     * Calculates the nicely formatted value for the given bot and tag.
     * @param bot The bot to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(bot: Bot, tag: string): string {
        if (isPrecalculated(bot)) {
            return formatValue(bot.values[tag]);
        }
        // Provide a null context because we cannot calculate formulas
        // and therefore do not need the context for anything.
        return calculateFormattedFileValue(null, bot, tag);
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
    setEditingFile(bot: Bot) {
        return this.updateBot(this.userFile, {
            tags: {
                'aux._editingBot': bot.id,
            },
        });
    }

    search(search: string): Promise<any> {
        return this._vm.search(search);
    }

    /**
     * Gets the list of simulation bots that are in the current user's simulation context.
     * @param id The ID of the simulation to search for.
     */
    private _getSimulationFiles(
        calc: BotCalculationContext,
        id: string
    ): AuxObject[] {
        // TODO: Make these functions support precalculated bot contexts
        const simFiles = botsInContext(
            calc,
            this.userFile.tags['aux._userSimulationsContext']
        ).filter(f => getBotChannel(calc, f) === id);

        return <AuxObject[]>simFiles;
    }
}
