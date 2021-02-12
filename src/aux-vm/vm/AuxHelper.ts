import {
    LocalActions,
    BotsState,
    getActiveObjects,
    BotAction,
    BotActions,
    createBot,
    Bot,
    PartialBot,
    merge,
    AUX_BOT_VERSION,
    getBotConfigDimensions,
    botAdded,
    botUpdated,
    tagsOnBot,
    USERS_DIMENSION,
    BotSpace,
    getBotSpace,
    TEMPORARY_BOT_PARTITION_ID,
    hasValue,
    addState,
    calculateBotValue,
    AuxPartitions,
    AuxPartition,
    getPartitionState,
    AuxRuntime,
    createPrecalculatedContext,
    PrecalculatedBot,
    BotCalculationContext,
    runScript,
    AsyncActions,
    asyncError,
    botRemoved,
    BotTagMasks,
    isBot,
} from '@casual-simulation/aux-common';
import {
    RemoteAction,
    DeviceAction,
    RemoteActionResult,
    RemoteActions,
} from '@casual-simulation/causal-trees';
import { Subject } from 'rxjs';
import { union, sortBy, pick, transform } from 'lodash';
import { BaseHelper } from '../managers/BaseHelper';
import { AuxUser } from '../AuxUser';
import { StoredAux, getBotsStateFromStoredAux } from '../StoredAux';
import { CompiledBot } from '@casual-simulation/aux-common/runtime/CompiledBot';
import { tap } from 'rxjs/operators';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process bot events.
 */
export class AuxHelper extends BaseHelper<Bot> {
    private static readonly _debug = false;
    private _partitions: AuxPartitions;
    private _runtime: AuxRuntime;
    private _localEvents: Subject<LocalActions[]>;
    private _remoteEvents: Subject<RemoteActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _partitionStates: Map<string, BotsState>;
    private _stateCache: Map<string, BotsState>;

    /**
     * Creates a new bot helper.
     * @param partitions The partitions that the helper should use.
     */
    constructor(partitions: AuxPartitions, runtime: AuxRuntime) {
        super();
        this._localEvents = new Subject<LocalActions[]>();
        this._remoteEvents = new Subject<RemoteAction[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();

        this._partitions = partitions;
        this._runtime = runtime;
        this._partitionStates = new Map();
        this._stateCache = new Map();

        this._runtime.onActions
            .pipe(
                tap((e) => {
                    this._sendEvents(e);
                })
            )
            .subscribe(null, (e: any) => console.error(e));

        this._runtime.onErrors
            .pipe(
                tap((errors) => {
                    for (let error of errors) {
                        console.error(error.error);
                    }
                })
            )
            .subscribe(null, (e: any) => console.error(e));
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
        return this._getPartitionsState('public', (p) => !p.private);
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
        let sorted = sortBy(keys, (k) => k !== '*');
        for (let key of sorted) {
            const partition = this._partitions[key];
            if (!filter(partition)) {
                continue;
            }
            const bots = getPartitionState(partition);
            this._partitionStates.set(key, bots);

            const finalBots = transform<Bot, Bot>(bots, (result, value, id) => {
                // ignore partial bots
                // (like bots that live in another partition but have a tag mask set in this partition)
                if (isBot(value)) {
                    result[id] = {
                        ...value,
                        space: <any>key,
                    };
                }
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
    createContext(): BotCalculationContext {
        const state = this._runtime.currentState;
        const bots = <CompiledBot[]>getActiveObjects(state);
        return createPrecalculatedContext(bots);
    }

    /**
     * Adds the given events in a transaction.
     * That is, they should be performed in a batch.
     * @param events The events to run.
     */
    async transaction(...events: BotAction[]): Promise<void> {
        this._runtime.process(events);
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

        return bot.id;
    }

    /**
     * Updates the given bot with the given data.
     * @param bot The bot.
     * @param newData The new data that the bot should have.
     */
    async updateBot(bot: Bot, newData: PartialBot): Promise<void> {
        await this._sendEvents([botUpdated(bot.id, newData)]);
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
            (b) => getBotConfigDimensions(calc, b).indexOf(USERS_DIMENSION) >= 0
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
        let parsed: StoredAux = JSON.parse(builder);
        let state = getBotsStateFromStoredAux(parsed);
        const objects = getActiveObjects(state);
        const stateCalc = createPrecalculatedContext(
            <PrecalculatedBot[]>objects
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

    async destroyBuilderBots(builder: string) {
        let parsed: StoredAux = JSON.parse(builder);
        let state = getBotsStateFromStoredAux(parsed);
        const objects = getActiveObjects(state);
        let events = [] as BotActions[];
        for (let bot of objects) {
            const sameBot = this.botsState[bot.id];
            if (sameBot) {
                events.push(botRemoved(bot.id));
            }
        }

        if (events.length > 0) {
            console.log('[AuxHelper] Destroying Builder...');
            await this.transaction(...events);
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        this._runtime.process(formulas.map((f) => runScript(f)));
    }

    getTags(): string[] {
        let objects = getActiveObjects(this.botsState);
        let allTags = union(...objects.map((o) => tagsOnBot(o)));
        let sorted = sortBy(allTags, (t) => t);
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
            let masks = null as BotTagMasks;
            let id = null as string;
            if (event.type === 'update_bot') {
                if (event.update.masks) {
                    masks = event.update.masks;
                    id = event.id;
                    delete event.update.masks;
                }
            } else if (event.type === 'add_bot') {
                if (event.bot.masks) {
                    masks = event.bot.masks;
                    id = event.id;
                    delete event.bot.masks;
                }
            }
            if (typeof partition === 'undefined') {
                console.warn('[AuxHelper] No partition for event', event);
                if (
                    'taskId' in event &&
                    event.type !== 'remote' &&
                    event.type !== 'device'
                ) {
                    events.push(
                        asyncError(
                            event.taskId,
                            new Error(
                                `The action was sent to a space that was not found.`
                            )
                        )
                    );
                }
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

            if (masks) {
                for (let space in masks) {
                    const maskPartition = this._partitionForBotType(space);
                    if (maskPartition) {
                        const newEvent = botUpdated(id, {
                            masks: {
                                [space]: masks[space],
                            },
                        });
                        let batch = map.get(maskPartition);
                        if (!batch) {
                            batch = [newEvent];
                            map.set(maskPartition, batch);
                        } else {
                            batch.push(newEvent);
                        }
                    }
                }
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

    /**
     * Gets the partition that the given event should be sent to.
     * Returns the partition or null if the event should be sent as a local/remote/device event.
     * If undefined is returned, then the event should not be sent anywhere.
     * @param event
     */
    private _partitionForEvent(event: BotAction): AuxPartition {
        if (event.type === 'remote') {
            return null;
        } else if (event.type === 'remote_result') {
            return null;
        } else if (event.type === 'remote_error') {
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
        } else if (event.type === 'create_certificate') {
            return this._partitionForBotType('shared');
        } else if (event.type === 'sign_tag') {
            return this._partitionForBotType('shared');
        } else if (event.type === 'revoke_certificate') {
            return this._partitionForBotType('shared');
        } else if (event.type === 'transaction') {
            return undefined;
        } else if (event.type === 'load_bots') {
            return this._partitionForBotType(event.space);
        } else if (event.type === 'clear_space') {
            return this._partitionForBotType(event.space);
        } else if (event.type === 'unlock_space') {
            return this._partitionForBotType(event.space) || undefined;
        } else if (event.type === 'set_space_password') {
            return this._partitionForBotType(event.space) || undefined;
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
        let remoteEvents: RemoteActions[] = [];
        let localEvents: LocalActions[] = [];
        let deviceEvents: DeviceAction[] = [];

        for (let event of events) {
            if (
                event.type === 'remote' ||
                event.type === 'remote_result' ||
                event.type === 'remote_error'
            ) {
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
}
