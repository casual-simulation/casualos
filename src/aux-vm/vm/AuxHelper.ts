import {
    SandboxLibrary,
    LocalActions,
    BotsState,
    getActiveObjects,
    createCalculationContext,
    AuxBot,
    AuxState,
    BotAction,
    BotActions,
    createBot,
    Bot,
    updateBot,
    PartialBot,
    merge,
    AUX_BOT_VERSION,
    calculateFormulaEvents,
    calculateActionEvents,
    BotSandboxContext,
    DEFAULT_USER_MODE,
    PasteStateAction,
    getBotConfigContexts,
    createWorkspace,
    createContextId,
    duplicateBot,
    cleanBot,
    Sandbox,
    SandboxFactory,
    searchBotState,
    AuxOp,
    createFormulaLibrary,
    FormulaLibraryOptions,
    addToContextDiff,
    botAdded,
    botUpdated,
    filterWellKnownAndContextTags,
    tagsOnBot,
    calculateActionResults,
    ON_ACTION_ACTION_NAME,
    action,
    GLOBALS_BOT_ID,
    resolveRejectedActions,
    reject,
    USERS_CONTEXT,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    StoredCausalTree,
    RemoteAction,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import { Subject } from 'rxjs';
import flatMap from 'lodash/flatMap';
import fromPairs from 'lodash/fromPairs';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import pick from 'lodash/pick';
import { BaseHelper } from '../managers/BaseHelper';
import { AuxUser } from '../AuxUser';
import {
    AuxPartitions,
    getPartitionState,
    AuxPartition,
    iteratePartitions,
    CausalTreePartition,
} from '../partitions/AuxPartition';
import { StoredAux } from '../StoredAux';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process bot events.
 */
export class AuxHelper extends BaseHelper<AuxBot> {
    private static readonly _debug = false;
    private _partitions: AuxPartitions;
    private _lib: SandboxLibrary;
    private _localEvents: Subject<LocalActions[]>;
    private _remoteEvents: Subject<RemoteAction[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _sandboxFactory: SandboxFactory;
    private _partitionStates: Map<string, AuxState>;
    private _stateCache: Map<string, AuxState>;

    /**
     * Creates a new bot helper.
     * @param partitions The partitions that the helper should use.
     */
    constructor(
        partitions: AuxPartitions,
        config?: FormulaLibraryOptions['config'],
        sandboxFactory?: (lib: SandboxLibrary) => Sandbox
    ) {
        super();
        this._localEvents = new Subject<LocalActions[]>();
        this._remoteEvents = new Subject<RemoteAction[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._sandboxFactory = sandboxFactory;

        this._partitions = partitions;
        this._partitionStates = new Map();
        this._stateCache = new Map();
        this._lib = createFormulaLibrary({ config });
    }

    /**
     * Gets the current local bot state.
     */
    get botsState(): AuxState {
        return this._getPartitionsState('all', () => true);
    }

    /**
     * Gets the public bot state.
     */
    get publicBotsState(): AuxState {
        return this._getPartitionsState('public', p => !p.private);
    }

    get localEvents() {
        return this._localEvents;
    }

    get remoteEvents() {
        return this._remoteEvents;
    }

    get deviceEvents() {
        return this._deviceEvents;
    }

    private _getPartitionsState(
        cacheName: string,
        filter: (partition: AuxPartition) => boolean
    ): AuxState {
        const cachedState = this._getCachedState(cacheName, filter);

        if (cachedState) {
            return cachedState;
        }

        // We need to rebuild the entire state
        // if a single partition changes.
        // We have to do this since bots could be deleted
        let state: AuxState = null;

        let keys = Object.keys(this._partitions);
        let sorted = sortBy(keys, k => k !== '*');
        for (let key of sorted) {
            const partition = this._partitions[key];
            if (!filter(partition)) {
                continue;
            }
            const bots = <AuxState>getPartitionState(partition);
            this._partitionStates.set(key, bots);

            if (!state) {
                state = { ...bots };
            } else {
                for (let id in bots) {
                    if (!state[id]) {
                        state[id] = bots[id];
                    }
                }
            }
        }

        this._stateCache.set(cacheName, state);
        return state;
    }

    private _getCachedState(
        cacheName: string,
        filter: (partition: AuxPartition) => boolean
    ) {
        if (this._stateCache.has(cacheName)) {
            let changed = false;

            for (let key in this._partitions) {
                const partition = this._partitions[key];
                if (!filter(partition)) {
                    continue;
                }
                const bots = <AuxState>getPartitionState(partition);
                const cached = this._partitionStates.get(key);

                if (bots !== cached) {
                    changed = true;
                    break;
                }
            }

            if (!changed) {
                return this._stateCache.get(cacheName);
            }
        }

        return null;
    }

    /**
     * Creates a new BotCalculationContext from the current state.
     */
    createContext(): BotSandboxContext {
        return createCalculationContext(
            this.objects,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: BotAction[]): Promise<void> {
        const finalEvents = this._flattenEvents(events);
        await this._sendEvents(finalEvents);
        // await this._tree.addEvents(allNonRejected);
        // this._sendOtherEvents(allNonRejected);
    }

    /**
     * Creates a new bot with the given ID and tags. Returns the ID of the new bot.
     * @param id (Optional) The ID that the bot should have.
     * @param tags (Optional) The tags that the bot should have.
     */
    async createBot(id?: string, tags?: Bot['tags']): Promise<string> {
        if (AuxHelper._debug) {
            console.log('[AuxHelper] Create Bot');
        }

        const bot = createBot(id, tags);
        await this._sendEvents([botAdded(bot)]);
        // await this._tree.addBot(bot);

        return bot.id;
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: AuxBot, newData: PartialBot): Promise<void> {
        updateBot(bot, this.userBot ? this.userBot.id : null, newData, () =>
            this.createContext()
        );

        await this._sendEvents([botUpdated(bot.id, newData)]);
        // await this._tree.updateBot(bot, newData);
    }

    /**
     * Creates a new globals bot.
     * @param botId The ID of the bot to create. If not specified a new ID will be generated.
     */
    async createGlobalsBot(botId?: string) {
        const workspace = createBot(botId, {});

        const final = merge(workspace, {
            tags: {
                auxVersion: AUX_BOT_VERSION,
                auxDestroyable: false,
            },
        });

        await this._sendEvents([botAdded(final)]);
        // await this._tree.addBot(final);
    }

    /**
     * Creates or updates the user bot for the given user.
     * @param user The user that the bot is for.
     * @param userBot The bot to update. If null or undefined then a bot will be created.
     */
    async createOrUpdateUserBot(user: AuxUser, userBot: AuxBot) {
        const userInventoryContext = `_user_${user.username}_inventory`;
        const userMenuContext = `_user_${user.username}_menu`;
        const userSimulationsContext = `_user_${user.username}_simulations`;
        if (!userBot) {
            await this.createBot(user.id, {
                [USERS_CONTEXT]: true,
                ['_auxUser']: user.username,
                ['_auxUserInventoryContext']: userInventoryContext,
                ['_auxUserMenuContext']: userMenuContext,
                ['_auxUserChannelsContext']: userSimulationsContext,
                'aux._mode': DEFAULT_USER_MODE,
            });
        } else {
            if (!userBot.tags['_auxUserMenuContext']) {
                await this.updateBot(userBot, {
                    tags: {
                        ['_auxUserMenuContext']: userMenuContext,
                    },
                });
            }
            if (!userBot.tags['_auxUserInventoryContext']) {
                await this.updateBot(userBot, {
                    tags: {
                        ['_auxUserInventoryContext']: userInventoryContext,
                    },
                });
            }
            if (!userBot.tags['_auxUserChannelsContext']) {
                await this.updateBot(userBot, {
                    tags: {
                        ['_auxUserChannelsContext']: userSimulationsContext,
                    },
                });
            }
        }
    }

    async createOrUpdateUserContextBot() {
        const calc = this.createContext();
        const contextBot = this.objects.find(
            b => getBotConfigContexts(calc, b).indexOf(USERS_CONTEXT) >= 0
        );
        if (contextBot) {
            return;
        }
        await this.createBot(undefined, {
            'aux.context': USERS_CONTEXT,
            'aux.context.visualize': true,
        });
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        const state = this.botsState;
        let events = flatMap(formulas, f =>
            calculateFormulaEvents(
                state,
                f,
                this.userId,
                undefined,
                this._sandboxFactory,
                this._lib
            )
        );
        await this.transaction(...events);
    }

    search(search: string) {
        return searchBotState(
            search,
            this.botsState,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
    }

    getTags(): string[] {
        let objects = getActiveObjects(this.botsState);
        let allTags = union(...objects.map(o => tagsOnBot(o)));
        let sorted = sortBy(allTags, t => t);
        return sorted;
    }

    exportBots(botIds: string[]): StoredAux {
        const state = this.botsState;
        const withBots = pick(state, botIds);
        return {
            version: 1,
            state: withBots,
        };
    }

    private _flattenEvents(events: BotAction[]): BotAction[] {
        let resultEvents: BotAction[] = [];

        const filteredEvents = this._rejectEvents(events);

        for (let event of filteredEvents) {
            if (event.type === 'action') {
                const result = calculateActionEvents(
                    this.botsState,
                    event,
                    this._sandboxFactory,
                    this._lib
                );
                resultEvents.push(...this._flattenEvents(result.events));
            } else if (event.type === 'update_bot') {
                const bot = this.botsState[event.id];
                updateBot(bot, this.userBot.id, event.update, () =>
                    this.createContext()
                );
                resultEvents.push(event);
            } else if (event.type === 'paste_state') {
                resultEvents.push(...this._pasteState(event));
            } else {
                resultEvents.push(event);
            }
        }

        return resultEvents;
    }

    private _rejectEvents(events: BotAction[]): BotAction[] {
        const context = this.createContext();
        let resultEvents: BotAction[] = events.slice();
        for (let event of events) {
            const actions = this._allowEvent(context, event);
            resultEvents.push(...actions);
        }
        return resolveRejectedActions(resultEvents);
    }

    /**
     * Resolves the list of events through the onChannelAction() handler.
     * @param events The events to resolve.
     */
    public resolveEvents(events: BotAction[]): BotAction[] {
        return this._rejectEvents(events);
    }

    private _allowEvent(
        context: BotSandboxContext,
        event: BotAction
    ): BotAction[] {
        if (!this.globalsBot) {
            return [];
        }

        try {
            const [actions, results] = calculateActionResults(
                this.botsState,
                action(ON_ACTION_ACTION_NAME, [GLOBALS_BOT_ID], this.userId, {
                    action: event,
                }),
                undefined,
                context,
                false
            );

            if (results.length > 0) {
                return actions;
            }

            let defaultActions: BotAction[] = [];

            // default handler
            if (event.type === 'remove_bot') {
                if (event.id === GLOBALS_BOT_ID) {
                    defaultActions.push(reject(event));
                }
            }

            return defaultActions;
        } catch (err) {
            console.error(
                '[AuxHelper] The onChannelAction() handler errored:',
                err
            );
            return [];
        }
    }

    private async _sendEvents(events: BotAction[]) {
        let map = new Map<AuxPartition, BotAction[]>();
        for (let event of events) {
            const partition = this._partitionForEvent(event);
            if (typeof partition === 'undefined') {
                continue;
            }
            let batch = map.get(partition);
            if (!batch) {
                batch = [event];
                map.set(partition, batch);
            } else {
                batch.push(event);
            }
        }

        for (let [partition, batch] of map) {
            if (!partition) {
                continue;
            }

            const extra = await partition.applyEvents(batch);
            let nullBatch = map.get(null);
            if (!nullBatch) {
                nullBatch = [...extra];
                map.set(null, nullBatch);
            } else {
                nullBatch.push(...extra);
            }
        }

        let nullBatch = map.get(null);
        if (nullBatch) {
            this._sendOtherEvents(nullBatch);
        }
    }

    private _partitionForEvent(event: BotAction): AuxPartition {
        if (event.type === 'remote') {
            return null;
        } else if (event.type === 'device') {
            return null;
        } else if (event.type === 'add_bot') {
            return this._partitionForBotEvent(event);
        } else if (event.type === 'remove_bot') {
            return this._partitionForBotEvent(event);
        } else if (event.type === 'update_bot') {
            return this._partitionForBotEvent(event);
        } else if (event.type === 'apply_state') {
            return this._partitionForBotEvent(event);
        } else if (event.type === 'transaction') {
            return undefined;
        } else {
            return null;
        }
    }

    private _partitionForBotEvent(event: BotActions): AuxPartition {
        return this._partitionForBotId(this._botId(event));
    }

    private _partitionForBotId(id: string): AuxPartition {
        const idPartition = this._partitions[id];
        if (idPartition) {
            return idPartition;
        }
        for (let [key, partition] of iteratePartitions(this._partitions)) {
            const index = key.indexOf('*');
            // Only include partitions which
            // have at least one character before a *
            if (index > 0) {
                let prefix = key.substring(0, index);
                if (id.startsWith(prefix)) {
                    return partition;
                }
            }
        }
        return this._partitions['*'];
    }

    private _botId(event: BotActions): string {
        if (event.type === 'add_bot') {
            return event.bot.id;
        } else if (event.type === 'remove_bot') {
            return event.id;
        } else if (event.type === 'update_bot') {
            return event.id;
        } else {
            return '*';
        }
    }

    private _sendOtherEvents(events: BotAction[]) {
        let remoteEvents: RemoteAction[] = [];
        let localEvents: LocalActions[] = [];
        let deviceEvents: DeviceAction[] = [];

        for (let event of events) {
            if (event.type === 'remote') {
                remoteEvents.push(event);
            } else if (event.type === 'device') {
                deviceEvents.push(event);
            } else {
                localEvents.push(<LocalActions>event);
            }
        }

        if (localEvents.length > 0) {
            this._localEvents.next(localEvents);
        }
        if (remoteEvents.length > 0) {
            this._remoteEvents.next(remoteEvents);
        }
        if (deviceEvents.length > 0) {
            this._deviceEvents.next(deviceEvents);
        }
    }

    private _pasteState(event: PasteStateAction) {
        // TODO: Cleanup this function to make it easier to understand
        const value = event.state;
        const botIds = Object.keys(value);
        let state: BotsState = {};
        const oldBots = botIds.map(id => value[id]);
        const oldCalc = createCalculationContext(
            oldBots,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
        const newCalc = this.createContext();

        if (event.options.context) {
            return this._pasteExistingWorksurface(
                oldBots,
                oldCalc,
                event,
                newCalc
            );
        } else {
            return this._pasteNewWorksurface(oldBots, oldCalc, event, newCalc);
        }
    }

    private _pasteExistingWorksurface(
        oldBots: Bot[],
        oldCalc: BotSandboxContext,
        event: PasteStateAction,
        newCalc: BotSandboxContext
    ) {
        let events: BotAction[] = [];

        // Preserve positions from old context
        for (let oldBot of oldBots) {
            const tags = tagsOnBot(oldBot);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newBot = duplicateBot(oldCalc, oldBot, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        event.options.context,
                        event.options.x,
                        event.options.y
                    ),
                    [`${event.options.context}.z`]: event.options.z,
                },
            });
            events.push(botAdded(cleanBot(newBot)));
        }

        return events;
    }

    private _pasteNewWorksurface(
        oldBots: Bot[],
        oldCalc: BotSandboxContext,
        event: PasteStateAction,
        newCalc: BotSandboxContext
    ) {
        const oldContextBots = oldBots.filter(
            f => getBotConfigContexts(oldCalc, f).length > 0
        );
        const oldContextBot =
            oldContextBots.length > 0 ? oldContextBots[0] : null;
        const oldContexts = oldContextBot
            ? getBotConfigContexts(oldCalc, oldContextBot)
            : [];
        let oldContext = oldContexts.length > 0 ? oldContexts[0] : null;
        let events: BotAction[] = [];
        const context = createContextId();
        let workspace: Bot;
        if (oldContextBot) {
            workspace = duplicateBot(oldCalc, oldContextBot, {
                tags: {
                    'aux.context': context,
                },
            });
        } else {
            workspace = createWorkspace(undefined, context);
        }
        workspace.tags['aux.context.x'] = event.options.x;
        workspace.tags['aux.context.y'] = event.options.y;
        workspace.tags['aux.context.z'] = event.options.z;
        events.push(botAdded(workspace));
        if (!oldContext) {
            oldContext = context;
        }

        // Preserve positions from old context
        for (let oldBot of oldBots) {
            if (oldContextBot && oldBot.id === oldContextBot.id) {
                continue;
            }
            const tags = tagsOnBot(oldBot);
            const tagsToRemove = filterWellKnownAndContextTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newBot = duplicateBot(oldCalc, oldBot, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToContextDiff(
                        newCalc,
                        context,
                        oldBot.tags[`${oldContext}.x`],
                        oldBot.tags[`${oldContext}.y`],
                        oldBot.tags[`${oldContext}.sortOrder`]
                    ),
                    [`${context}.z`]: oldBot.tags[`${oldContext}.z`],
                },
            });
            events.push(botAdded(cleanBot(newBot)));
        }
        return events;
    }
}
