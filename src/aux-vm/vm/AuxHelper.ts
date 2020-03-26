import {
    SandboxLibrary,
    LocalActions,
    BotsState,
    getActiveObjects,
    createCalculationContext,
    BotAction,
    BotActions,
    createBot,
    Bot,
    updateBot,
    PartialBot,
    merge,
    AUX_BOT_VERSION,
    calculateFormulaEvents,
    BotSandboxContext,
    PasteStateAction,
    getBotConfigDimensions,
    createWorkspace,
    createDimensionId,
    duplicateBot,
    cleanBot,
    Sandbox,
    SandboxFactory,
    searchBotState,
    createFormulaLibrary,
    FormulaLibraryOptions,
    addToDimensionDiff,
    botAdded,
    botUpdated,
    filterWellKnownAndDimensionTags,
    tagsOnBot,
    calculateActionResults,
    ON_ACTION_ACTION_NAME,
    action,
    GLOBALS_BOT_ID,
    resolveRejectedActions,
    reject,
    USERS_DIMENSION,
    BotSpace,
    getBotSpace,
    breakIntoIndividualEvents,
    ON_RUN_ACTION_NAME,
    TEMPORARY_BOT_PARTITION_ID,
    hasValue,
    addState,
    calculateBotValue,
    AddBotAction,
    AuxPartitions,
    AuxPartition,
    getPartitionState,
} from '@casual-simulation/aux-common';
import { RemoteAction, DeviceAction } from '@casual-simulation/causal-trees';
import { Subject } from 'rxjs';
import flatMap from 'lodash/flatMap';
import fromPairs from 'lodash/fromPairs';
import union from 'lodash/union';
import sortBy from 'lodash/sortBy';
import pick from 'lodash/pick';
import { BaseHelper } from '../managers/BaseHelper';
import { AuxUser } from '../AuxUser';
import { StoredAux } from '../StoredAux';
import transform from 'lodash/transform';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process bot events.
 */
export class AuxHelper extends BaseHelper<Bot> {
    private static readonly _debug = false;
    private _partitions: AuxPartitions;
    private _lib: SandboxLibrary;
    private _localEvents: Subject<LocalActions[]>;
    private _remoteEvents: Subject<RemoteAction[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _sandboxFactory: SandboxFactory;
    private _partitionStates: Map<string, BotsState>;
    private _stateCache: Map<string, BotsState>;

    /**
     * Creates a new bot helper.
     * @param partitions The partitions that the helper should use.
     */
    constructor(
        partitions: AuxPartitions,
        config?: FormulaLibraryOptions,
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
        this._lib = createFormulaLibrary(config);
    }

    /**
     * Gets the current local bot state.
     */
    get botsState(): BotsState {
        return this._getPartitionsState('all', () => true);
    }

    /**
     * Gets the public bot state.
     */
    get publicBotsState(): BotsState {
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

    addPartition(space: string, partition: AuxPartition) {
        this._partitions[space] = partition;
    }

    private _getPartitionsState(
        cacheName: string,
        filter: (partition: AuxPartition) => boolean
    ): BotsState {
        const cachedState = this._getCachedState(cacheName, filter);

        if (cachedState) {
            return cachedState;
        }

        // We need to rebuild the entire state
        // if a single partition changes.
        // We have to do this since bots could be deleted
        let state: BotsState = null;

        let keys = Object.keys(this._partitions);
        let sorted = sortBy(keys, k => k !== '*');
        for (let key of sorted) {
            const partition = this._partitions[key];
            if (!filter(partition)) {
                continue;
            }
            const bots = getPartitionState(partition);
            this._partitionStates.set(key, bots);

            const finalBots = transform<Bot, Bot>(bots, (result, value, id) => {
                result[id] = {
                    ...value,
                    space: <any>key,
                };
            });
            if (!state) {
                state = { ...finalBots };
            } else {
                for (let id in bots) {
                    if (!state[id]) {
                        state[id] = finalBots[id];
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
                const bots = getPartitionState(partition);
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
    async createBot(
        id?: string,
        tags?: Bot['tags'],
        type?: BotSpace
    ): Promise<string> {
        if (AuxHelper._debug) {
            console.log('[AuxHelper] Create Bot');
        }

        const bot = createBot(id, tags, type);
        await this._sendEvents([botAdded(bot)]);
        // await this._tree.addBot(bot);

        return bot.id;
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: Bot, newData: PartialBot): Promise<void> {
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
    async createOrUpdateUserBot(user: AuxUser, userBot: Bot) {
        if (!userBot) {
            console.log('[AuxHelper] Create user bot');
            await this.createBot(
                user.id,
                {
                    [USERS_DIMENSION]: true,
                },
                TEMPORARY_BOT_PARTITION_ID in this._partitions
                    ? TEMPORARY_BOT_PARTITION_ID
                    : undefined
            );
            console.log('[AuxHelper] User bot created');
        }
    }

    async createOrUpdateUserDimensionBot() {
        const calc = this.createContext();
        const dimensionBot = this.objects.find(
            b => getBotConfigDimensions(calc, b).indexOf(USERS_DIMENSION) >= 0
        );
        if (dimensionBot) {
            return;
        }
        await this.createBot(undefined, {
            auxDimensionConfig: USERS_DIMENSION,
            auxDimensionVisualize: true,
        });
    }

    async createOrUpdateBuilderBots(builder: string) {
        let state = JSON.parse(builder);
        const objects = getActiveObjects(state);
        const stateCalc = createCalculationContext(
            objects,
            this.userId,
            this._lib,
            this._sandboxFactory
        );
        const calc = this.createContext();
        let needsUpdate = false;
        let needsToBeEnabled = false;
        let builderId: string;
        for (let bot of objects) {
            const newVersion = calculateBotValue(
                stateCalc,
                bot,
                'builderVersion'
            );
            if (typeof newVersion === 'number') {
                const sameBot = this.botsState[bot.id];
                if (sameBot) {
                    const currentVersion = calculateBotValue(
                        calc,
                        sameBot,
                        'builderVersion'
                    );
                    needsUpdate =
                        !currentVersion || newVersion > currentVersion;

                    const currentState = calculateBotValue(
                        calc,
                        sameBot,
                        'builderState'
                    );
                    if (!hasValue(currentState)) {
                        needsToBeEnabled = true;
                        builderId = bot.id;
                    }
                } else {
                    needsUpdate = true;
                    needsToBeEnabled = true;
                    builderId = bot.id;
                }
                break;
            }
        }

        if (needsToBeEnabled) {
            state = merge(state, {
                [builderId]: {
                    tags: {
                        builderState: 'Enabled',
                    },
                },
            });
        }

        if (needsUpdate) {
            console.log('[AuxHelper] Updating Builder...');
            await this.transaction(addState(state));
        }
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
                const result = calculateActionResults(
                    this.botsState,
                    event,
                    this._sandboxFactory,
                    this._lib
                );
                resultEvents.push(...this._flattenEvents(result.actions));
                resultEvents.push(
                    ...result.errors.map(e => {
                        return botAdded(
                            createBot(
                                undefined,
                                {
                                    auxError: true,
                                    auxErrorName: e.error.name,
                                    auxErrorMessage: e.error.message,
                                    auxErrorStack: e.error.stack,
                                    auxErrorBot: e.bot ? e.bot.id : null,
                                    auxErrorTag: e.tag || null,
                                },
                                'error'
                            )
                        );
                    })
                );
            } else if (event.type === 'run_script') {
                const events = [
                    ...calculateFormulaEvents(
                        this.botsState,
                        event.script,
                        this.userId,
                        undefined,
                        this._sandboxFactory,
                        this._lib
                    ),
                ];
                resultEvents.push(...this._flattenEvents(events));
            } else if (event.type === 'update_bot') {
                const bot = this.botsState[event.id];
                updateBot(bot, this.userBot.id, event.update, () =>
                    this.createContext()
                );
                resultEvents.push(event);
            } else if (event.type === 'paste_state') {
                resultEvents.push(...this._pasteState(event));
            } else if (event.type === 'apply_state') {
                const events = breakIntoIndividualEvents(this.botsState, event);
                resultEvents.push(...events);
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
     * Resolves the list of events through the onUniverseAction() handler.
     * @param events The events to resolve.
     */
    public resolveEvents(events: BotAction[]): BotAction[] {
        return this._rejectEvents(events);
    }

    private _allowEvent(
        context: BotSandboxContext,
        event: BotAction
    ): BotAction[] {
        try {
            const results = calculateActionResults(
                this.botsState,
                action(ON_ACTION_ACTION_NAME, null, this.userId, {
                    action: event,
                }),
                undefined,
                undefined,
                context,
                false
            );

            return results.actions;
        } catch (err) {
            console.error(
                '[AuxHelper] The onUniverseAction() handler errored:',
                err
            );
            return [];
        }
    }

    private async _sendEvents(events: BotAction[]) {
        let map = new Map<AuxPartition, BotAction[]>();
        let newBotPartitions = new Map<string, AuxPartition>();
        for (let event of events) {
            let partition = this._partitionForEvent(event);
            if (!hasValue(partition)) {
                if (
                    event.type === 'update_bot' ||
                    event.type === 'remove_bot'
                ) {
                    partition = newBotPartitions.get(event.id);
                }
            } else {
                if (event.type === 'add_bot') {
                    newBotPartitions.set(event.bot.id, partition);
                }
            }
            if (typeof partition === 'undefined') {
                console.warn('[AuxHelper] No partition for event', event);
                continue;
            } else if (
                partition === null &&
                event.type === 'remote' &&
                event.allowBatching === false
            ) {
                this._sendOtherEvents([event]);
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
            return undefined;
        } else if (event.type === 'transaction') {
            return undefined;
        } else if (event.type === 'load_bots') {
            return this._partitionForBotType(event.space);
        } else {
            return null;
        }
    }

    private _partitionForBotEvent(event: BotActions): AuxPartition {
        const space = this._botSpace(event);
        if (!space) {
            return null;
        }
        return this._partitionForBotType(space);
    }

    private _partitionForBotType(type: string): AuxPartition {
        const partitionId = type;
        const idPartition = this._partitions[partitionId];
        if (idPartition) {
            return idPartition;
        } else {
            console.warn('[AuxHelper] No partition for space', type);
        }
        return null;
    }

    private _botSpace(event: BotActions): string {
        let bot: Bot;
        if (event.type === 'add_bot') {
            bot = event.bot;
        } else if (event.type === 'remove_bot') {
            bot = this.botsState[event.id];
        } else if (event.type === 'update_bot') {
            bot = this.botsState[event.id];
        }

        if (!bot) {
            return null;
        }
        return getBotSpace(bot);
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

        if (event.options.dimension) {
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

        // Preserve positions from old dimension
        for (let oldBot of oldBots) {
            const tags = tagsOnBot(oldBot);
            const tagsToRemove = filterWellKnownAndDimensionTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newBot = duplicateBot(oldCalc, oldBot, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToDimensionDiff(
                        newCalc,
                        event.options.dimension,
                        event.options.x,
                        event.options.y
                    ),
                    [`${event.options.dimension}Z`]: event.options.z,
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
        const oldDimensionBots = oldBots.filter(
            f => getBotConfigDimensions(oldCalc, f).length > 0
        );
        const oldDimensionBot =
            oldDimensionBots.length > 0 ? oldDimensionBots[0] : null;
        const oldDimensions = oldDimensionBot
            ? getBotConfigDimensions(oldCalc, oldDimensionBot)
            : [];
        let oldDimension = oldDimensions.length > 0 ? oldDimensions[0] : null;
        let events: BotAction[] = [];
        const dimension = createDimensionId();
        let workspace: Bot;
        if (oldDimensionBot) {
            workspace = duplicateBot(oldCalc, oldDimensionBot, {
                tags: {
                    auxDimensionConfig: dimension,
                },
            });
        } else {
            workspace = createWorkspace(undefined, dimension);
        }
        workspace.tags['auxDimensionX'] = event.options.x;
        workspace.tags['auxDimensionY'] = event.options.y;
        workspace.tags['auxDimensionZ'] = event.options.z;
        events.push(botAdded(workspace));
        if (!oldDimension) {
            oldDimension = dimension;
        }

        // Preserve positions from old dimension
        for (let oldBot of oldBots) {
            if (oldDimensionBot && oldBot.id === oldDimensionBot.id) {
                continue;
            }
            const tags = tagsOnBot(oldBot);
            const tagsToRemove = filterWellKnownAndDimensionTags(newCalc, tags);
            const removedValues = tagsToRemove.map(t => [t, null]);
            let newBot = duplicateBot(oldCalc, oldBot, {
                tags: {
                    ...fromPairs(removedValues),
                    ...addToDimensionDiff(
                        newCalc,
                        dimension,
                        oldBot.tags[`${oldDimension}X`],
                        oldBot.tags[`${oldDimension}Y`],
                        oldBot.tags[`${oldDimension}SortOrder`]
                    ),
                    [`${dimension}Z`]: oldBot.tags[`${oldDimension}Z`],
                },
            });
            events.push(botAdded(cleanBot(newBot)));
        }
        return events;
    }
}
