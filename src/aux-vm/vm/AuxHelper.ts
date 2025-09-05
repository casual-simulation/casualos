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
    BotsState,
    BotAction,
    BotActions,
    Bot,
    PartialBot,
    BotSpace,
    AuxPartitions,
    AuxPartition,
    PrecalculatedBot,
    BotCalculationContext,
    BotTagMasks,
    StoredAux,
    StoredAuxVersion1,
} from '@casual-simulation/aux-common';
import {
    getActiveObjects,
    createBot,
    merge,
    botAdded,
    botUpdated,
    tagsOnBot,
    getBotSpace,
    TEMPORARY_BOT_PARTITION_ID,
    hasValue,
    addState,
    calculateBotValue,
    getPartitionState,
    createPrecalculatedContext,
    runScript,
    asyncError,
    botRemoved,
    isBot,
    getBotsStateFromStoredAux,
} from '@casual-simulation/aux-common';
import type {
    RemoteAction,
    DeviceAction,
    RemoteActions,
} from '@casual-simulation/aux-common';
import { Subject } from 'rxjs';
import { union, sortBy, pick, transform } from 'es-toolkit/compat';
import { BaseHelper } from '../managers/BaseHelper';
import type {
    AuxRuntime,
    CompiledBot,
    RuntimeActions,
} from '@casual-simulation/aux-runtime';
import { RanOutOfEnergyError } from '@casual-simulation/aux-runtime';
import { concatMap, tap } from 'rxjs/operators';

/**
 * Definesa a class that contains a set of functions to help an AuxChannel
 * run formulas and process bot events.
 */
export class AuxHelper extends BaseHelper<Bot> {
    private static readonly _debug = false;
    private _partitions: AuxPartitions;
    private _runtime: AuxRuntime;
    private _localEvents: Subject<RuntimeActions[]>;
    private _remoteEvents: Subject<RemoteActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _partitionStates: Map<string, BotsState>;
    private _stateCache: Map<string, BotsState>;
    private _supressLogs: boolean;

    get supressLogs() {
        return this._supressLogs;
    }

    set supressLogs(value: boolean) {
        this._supressLogs = value;
    }

    /**
     * Creates a new bot helper.
     * @param configBotId The ID of the config bot.
     * @param partitions The partitions that the helper should use.
     * @param runtime The runtime that the helper should use.
     */
    constructor(
        configBotId: string,
        partitions: AuxPartitions,
        runtime: AuxRuntime
    ) {
        super(configBotId);
        this._localEvents = new Subject<RuntimeActions[]>();
        this._remoteEvents = new Subject<RemoteAction[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._supressLogs = false;

        this._partitions = partitions;
        this._runtime = runtime;
        this._partitionStates = new Map();
        this._stateCache = new Map();

        this._runtime.onActions
            .pipe(
                concatMap(async (e) => {
                    await this._sendEvents(e);
                })
            )
            .subscribe({ error: (e: any) => console.error(e) });

        this._runtime.onErrors
            .pipe(
                tap((errors) => {
                    for (let error of errors) {
                        if (error instanceof RanOutOfEnergyError) {
                            console.error(error);
                        } else {
                            if (error.bot) {
                                console.error(
                                    `An error occurred in ${error.bot.id}.${error.tag}:`,
                                    error.error
                                );
                            } else {
                                console.error(
                                    `An error occurred:`,
                                    error.error
                                );
                            }
                        }
                    }
                })
            )
            .subscribe({ error: (e: any) => console.error(e) });
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

            const finalBots = transform<Bot, BotsState>(
                bots,
                (result, value, id) => {
                    // ignore partial bots
                    // (like bots that live in another partition but have a tag mask set in this partition)
                    if (isBot(value)) {
                        result[id] = {
                            ...value,
                            space: <any>key,
                        };
                    }
                }
            );
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
    async transaction(...events: RuntimeActions[]): Promise<void> {
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
            this._log('[AuxHelper] Create Bot');
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
     * @param botId The ID of the bot.
     * @param userBot The bot to update. If null or undefined then a bot will be created.
     */
    async createOrUpdateUserBot(botId: string, userBot: Bot) {
        if (!userBot) {
            this._log('[AuxHelper] Create user bot');
            await this.createBot(
                botId,
                {},
                TEMPORARY_BOT_PARTITION_ID in this._partitions
                    ? TEMPORARY_BOT_PARTITION_ID
                    : undefined
            );
            this._log('[AuxHelper] User bot created');
        }
    }

    async createOrUpdateBuilderBots(builder: string) {
        let parsed: StoredAuxVersion1 = JSON.parse(builder);
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
            this._log('[AuxHelper] Updating Builder...');
            await this.transaction(addState(state));
        }
    }

    async destroyBuilderBots(builder: string) {
        let parsed: StoredAuxVersion1 = JSON.parse(builder);
        let state = getBotsStateFromStoredAux(parsed);
        const objects = getActiveObjects(state);
        let events = [] as RuntimeActions[];
        for (let bot of objects) {
            const sameBot = this.botsState[bot.id];
            if (sameBot) {
                events.push(botRemoved(bot.id));
            }
        }

        if (events.length > 0) {
            this._log('[AuxHelper] Destroying Builder...');
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

    /**
     * Sends the given list of events to the frontend without running them through the runtime.
     * This is useful for processing events that should not be able to be rejected by the runtime.
     * @param events The events to send.
     */
    sendEvents(events: RuntimeActions[]) {
        this._sendEvents(events);
    }

    private async _sendEvents(events: RuntimeActions[]) {
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
                this._warn('[AuxHelper] No partition for event', event);
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
                batch = [event as BotAction];
                map.set(partition, batch);
            } else {
                batch.push(event as BotAction);
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
    private _partitionForEvent(event: RuntimeActions): AuxPartition {
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
        } else if (event.type === 'transaction') {
            return undefined;
        } else if (event.type === 'clear_space') {
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
            this._warn('[AuxHelper] No partition for space', type);
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

    private _sendOtherEvents(events: RuntimeActions[]) {
        let remoteEvents: RemoteActions[] = [];
        let localEvents: RuntimeActions[] = [];
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
                localEvents.push(event);
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

    private _log(...messages: any[]) {
        if (!this._supressLogs) {
            console.log(...messages);
        }
    }

    private _warn(...messages: any[]) {
        if (!this._supressLogs) {
            console.warn(...messages);
        }
    }
}
