import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { tap, first, startWith } from 'rxjs/operators';
import { AuxChannel, AuxSubChannel, ChannelActionResult } from './AuxChannel';
import { AuxUser } from '../AuxUser';
import {
    LocalActions,
    BotAction,
    BotsState,
    BOT_SPACE_TAG,
    StateUpdatedEvent,
    AuxPartitions,
    AuxPartition,
    PartitionConfig,
    iteratePartitions,
    AuxRuntime,
    BotSpace,
    realtimeStrategyToRealtimeEditMode,
    AuxPartitionRealtimeEditModeProvider,
    LoadSpaceAction,
    hasValue,
    asyncResult,
    addDebugApi,
    RuntimeStateVersion,
    stateUpdatedEvent,
    registerBuiltinPortal,
    defineGlobalBot,
    isPromise,
    AttachRuntimeAction,
    createPrecalculatedBot,
    merge,
    BotTagMasks,
    PrecalculatedBot,
    asyncError,
    botAdded,
    botUpdated,
    TagMapper,
    createBot,
    getBotSpace,
} from '@casual-simulation/aux-common';
import { AuxHelper } from './AuxHelper';
import { AuxConfig, buildVersionNumber } from './AuxConfig';
import {
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
    RemoteAction,
    DeviceInfo,
    Action,
    RemoteActions,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { StatusHelper } from './StatusHelper';
import { StoredAux } from '../StoredAux';
import { flatMap, mapKeys, mapValues, pick, transform } from 'lodash';
import { CustomAppHelper } from '../portals/CustomAppHelper';
import { v4 as uuid } from 'uuid';
import { TimeSyncController } from '@casual-simulation/timesync';

export interface AuxChannelOptions {}

interface SubChannelData {
    channel: BaseAuxChannel;
    tagNameMap: Map<string, string>;
    reverseTagNameMap: Map<string, string>;
    spacesMap: Map<string, string>;
    reverseSpacesMap: Map<string, string>;
    mappedTaskIds: Map<number | string, number | string>;
    tagNameMapper: TagMapper;
}

export abstract class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _runtime: AuxRuntime;
    protected _config: AuxConfig;
    protected _options: AuxChannelOptions;
    protected _subs: SubscriptionLike[];
    protected _deviceInfo: DeviceInfo;
    protected _partitionEditModeProvider: AuxPartitionRealtimeEditModeProvider;
    protected _partitions: AuxPartitions;
    protected _portalHelper: CustomAppHelper;
    private _statusHelper: StatusHelper;
    private _hasRegisteredSubs: boolean;
    private _eventBuffer: BotAction[];
    private _hasInitialState: boolean;
    private _version: RuntimeStateVersion;
    private _timeSync: TimeSyncController;
    private _initStartTime: number;

    private _subchannels: SubChannelData[];
    private _subChannels: AuxSubChannel[];
    private _user: AuxUser;
    private _onLocalEvents: Subject<LocalActions[]>;
    private _onDeviceEvents: Subject<DeviceAction[]>;
    private _onStateUpdated: Subject<StateUpdatedEvent>;
    private _onVersionUpdated: Subject<RuntimeStateVersion>;
    private _onConnectionStateChanged: Subject<StatusUpdate>;
    private _onSubChannelAdded: Subject<AuxSubChannel>;
    private _onSubChannelRemoved: Subject<string>;
    private _onError: Subject<AuxChannelErrorType>;

    get onLocalEvents() {
        return this._onLocalEvents;
    }

    get onDeviceEvents() {
        return this._onDeviceEvents;
    }

    get onStateUpdated() {
        return this._onStateUpdated;
    }

    get onVersionUpdated() {
        return this._onVersionUpdated;
    }

    get onConnectionStateChanged() {
        return this._onConnectionStateChanged;
    }

    get onSubChannelAdded(): Observable<AuxSubChannel> {
        return this._onSubChannelAdded;
    }

    get onSubChannelRemoved(): Observable<string> {
        return this._onSubChannelRemoved;
    }

    get onError() {
        return this._onError;
    }

    get helper() {
        return this._helper;
    }

    get timesync() {
        return this._timeSync;
    }

    protected get user() {
        return this._user;
    }

    constructor(user: AuxUser, config: AuxConfig, options: AuxChannelOptions) {
        this._user = user;
        this._config = config;
        this._options = options;
        this._subs = [];
        this._hasRegisteredSubs = false;
        this._onLocalEvents = new Subject<LocalActions[]>();
        this._onDeviceEvents = new Subject<DeviceAction[]>();
        this._onStateUpdated = new Subject<StateUpdatedEvent>();
        this._onVersionUpdated = new Subject<RuntimeStateVersion>();
        this._onConnectionStateChanged = new Subject<StatusUpdate>();
        this._onSubChannelAdded = new Subject();
        this._onSubChannelRemoved = new Subject();
        this._onError = new Subject<AuxChannelErrorType>();
        this._eventBuffer = [];
        this._subchannels = [];
        this._subChannels = [];
        this._hasInitialState = false;
        this._version = {
            localSites: {},
            vector: {},
        };

        this._onConnectionStateChanged.subscribe(null, (err) => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onStateUpdated.subscribe(null, (err) => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onLocalEvents.subscribe(null, (err) => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });
        this._onDeviceEvents.subscribe(null, (err) => {
            this._onError.next({
                type: 'general',
                message: err.toString(),
            });
        });

        addDebugApi('getChannel', () => this);
    }

    async init(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
    ): Promise<void> {
        if (onLocalEvents) {
            this.onLocalEvents.subscribe((e) => onLocalEvents(e));
        }
        if (onStateUpdated) {
            this.onStateUpdated.subscribe((s) => onStateUpdated(s));
        }
        if (onVersionUpdated) {
            this.onVersionUpdated.subscribe((v) => onVersionUpdated(v));
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged.subscribe((s) =>
                onConnectionStateChanged(s)
            );
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe((e) => onDeviceEvents(e));
        }
        if (onSubChannelAdded) {
            this.onSubChannelAdded.subscribe((s) => onSubChannelAdded(s));
        }
        if (onSubChannelRemoved) {
            this.onSubChannelRemoved.subscribe((s) => onSubChannelRemoved(s));
        }
        // if (onError) {
        //     this.onError.subscribe(onError);
        // }

        return await this._init();
    }

    async initAndWait(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
    ) {
        const promise = this.onConnectionStateChanged
            .pipe(first((s) => s.type === 'init'))
            .toPromise();
        await this.init(
            onLocalEvents,
            onDeviceEvents,
            onStateUpdated,
            onVersionUpdated,
            onConnectionStateChanged,
            onError,
            onSubChannelAdded,
            onSubChannelRemoved
        );
        await promise;
    }

    async registerListeners(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void
    ): Promise<void> {
        if (onLocalEvents) {
            this.onLocalEvents.subscribe((e) => onLocalEvents(e));
        }
        if (onStateUpdated) {
            this.onStateUpdated
                .pipe(startWith(stateUpdatedEvent(this._helper.botsState)))
                .subscribe((s) => onStateUpdated(s));
        }
        if (onVersionUpdated) {
            this.onVersionUpdated
                .pipe(startWith(this._version))
                .subscribe((v) => onVersionUpdated(v));
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged
                .pipe(
                    startWith(
                        {
                            type: 'init',
                        } as StatusUpdate,
                        { type: 'sync', synced: true } as StatusUpdate
                    )
                )
                .subscribe((s) => onConnectionStateChanged(s));
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe((e) => onDeviceEvents(e));
        }
        if (onSubChannelAdded) {
            this.onSubChannelAdded.subscribe((s) => onSubChannelAdded(s));
        }
        if (onSubChannelRemoved) {
            this.onSubChannelRemoved.subscribe((s) => onSubChannelRemoved(s));
        }
    }

    private async _init(): Promise<void> {
        this._initStartTime = performance.now();
        this._handleStatusUpdated({
            type: 'progress',
            message: 'Creating causal tree...',
            progress: 0.1,
        });

        this._partitions = <any>{};
        this._partitionEditModeProvider =
            new AuxPartitionRealtimeEditModeProvider(this._partitions);
        let partitions: AuxPartition[] = [];
        for (let key in this._config.partitions) {
            if (!this._config.partitions.hasOwnProperty(key)) {
                continue;
            }
            const partition = await this._createPartition(
                this._config.partitions[key]
            );
            if (partition) {
                partition.space = key;
                this._partitions[key] = partition;
                partitions.push(partition);
            } else {
                throw new Error(
                    `[BaseAuxChannel] Unable to build partition: ${key}`
                );
            }
        }

        this._statusHelper = new StatusHelper(
            partitions.map((p) => p.onStatusUpdated)
        );
        this._statusHelper.defaultUser = this.user;

        let statusMapper = remapProgressPercent(0.3, 0.6);
        this._subs.push(
            this._statusHelper,
            this._statusHelper.updates
                .pipe(
                    tap((state) =>
                        this._handleStatusUpdated(statusMapper(state))
                    )
                )
                .subscribe(null, (e: any) => console.error(e)),
            ...flatMap(partitions, (p) =>
                this._getCleanupSubscriptionsForPartition(p)
            )
        );

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing causal tree...',
            progress: 0.2,
        });
        for (let partition of partitions) {
            partition.connect();
        }
        return null;
    }

    protected _getCleanupSubscriptionsForPartition(
        partition: AuxPartition
    ): SubscriptionLike[] {
        return [
            partition,
            partition.onError.subscribe((err) => this._handleError(err)),
            partition.onEvents
                .pipe(tap((events) => this._handlePartitionEvents(events)))
                .subscribe(null, (e: any) => console.error(e)),
        ];
    }

    /**
     * Creates a partition for the given config.
     * @param config The config.
     */
    protected abstract _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition>;

    async setUser(user: AuxUser): Promise<void> {
        for (let [, partition] of iteratePartitions(this._partitions)) {
            if (partition.setUser) {
                await partition.setUser(user);
            }
        }

        this._user = user;

        if (this.user && this._helper) {
            this._helper.userId = this.user.id;
            await this._initUserBot();
        }
    }

    async sendEvents(events: BotAction[]): Promise<void> {
        if (this._hasInitialState) {
            await this._helper.transaction(...events);

            // if (this._subchannels.length > 0) {
            //     const subchannelEvents = events.filter((e) => {
            //         if (
            //             e.type === 'add_bot' ||
            //             e.type === 'update_bot' ||
            //             e.type === 'remove_bot' ||
            //             e.type === 'async_result' ||
            //             e.type === 'async_error' ||
            //             e.type === 'device_result' ||
            //             e.type === 'device_error' ||
            //             e.type === 'action'
            //         ) {
            //             return true;
            //         }
            //         return false;
            //     });

            //     for (let subchannel of this._subchannels) {
            //         let mappedEvents = [];

            //         for (let e of subchannelEvents) {
            //             if (
            //                 e.type === 'async_result' ||
            //                 e.type === 'async_error' ||
            //                 e.type === 'device_result' ||
            //                 e.type === 'device_error'
            //             ) {
            //                 if (subchannel.mappedTaskIds.has(e.taskId)) {
            //                     const newEvent = {
            //                         ...e,
            //                         taskId: subchannel.mappedTaskIds.get(
            //                             e.taskId
            //                         ),
            //                     };
            //                     mappedEvents.push(newEvent);
            //                 }
            //             } else {
            //                 const spaceNameMapper = (space: string) => {
            //                     return space;
            //                 };

            //                 if (e.type === 'add_bot') {
            //                     // Don't add the bot because we currently don't need this functionality
            //                 } else if (e.type === 'update_bot') {
            //                     mappedEvents.push(
            //                         botUpdated(
            //                             e.id,
            //                             mapBotTagsAndSpace(
            //                                 e.update,
            //                                 subchannel.tagNameMapper.reverse,
            //                                 spaceNameMapper,
            //                                 null
            //                             )
            //                         )
            //                     );
            //                 } else if (e.type === 'remove_bot') {
            //                     mappedEvents.push(e);
            //                 } else {
            //                     mappedEvents.push(e);
            //                 }
            //             }
            //         }

            //         await subchannel.channel.sendEvents(mappedEvents);
            //     }
            // }
        } else {
            this._eventBuffer.push(...events);
        }
    }

    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        if (!this._runtime) {
            throw new Error(
                'Unable to execute a shout without being initialized.'
            );
        }
        const result = this._runtime.shout(eventName, botIds, arg);

        const final = isPromise(result) ? await result : result;

        return {
            actions: final.actions,
            results: await Promise.all(final.results),
        };
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        return this._helper.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<any> {}

    async setGrant(grant: string): Promise<void> {
        for (let [, partition] of iteratePartitions(this._partitions)) {
            if (partition.setGrant) {
                await partition.setGrant(grant);
            }
        }
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        return this._helper.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        let final: BotsState = {};
        const state = this._helper.publicBotsState;

        for (let key in state) {
            const bot = state[key];
            final[key] = pick(bot, 'id', 'tags', BOT_SPACE_TAG);
        }

        return {
            version: 1,
            state: final,
        };
    }

    async getTags(): Promise<string[]> {
        return this._helper.getTags();
    }

    /**
     * Sends the given list of remote events to their destinations.
     * @param events The events.
     */
    protected async _sendRemoteEvents(events: RemoteActions[]): Promise<void> {
        for (let [, partition] of iteratePartitions(this._partitions)) {
            if (partition.sendRemoteEvents) {
                await partition.sendRemoteEvents(events);
            }
        }
    }

    protected _createAuxHelper() {
        const partitions: any = this._partitions;
        let helper = new AuxHelper(partitions, this._runtime);
        helper.userId = this.user ? this.user.id : null;
        return helper;
    }

    protected _createTimeSyncController(): TimeSyncController {
        return null;
    }

    protected _registerSubscriptions() {
        this._subs.push(
            this._helper.localEvents.subscribe(
                (e) => this._handleLocalEvents(e),
                (e: any) => console.error(e)
            ),
            this._helper.deviceEvents.subscribe(
                (e) => this._handleDeviceEvents(e),
                (e: any) => console.error(e)
            ),
            this._helper.remoteEvents.subscribe((e) => {
                this._sendRemoteEvents(e);
            })
        );
        for (let [, partition] of iteratePartitions(this._partitions)) {
            this._registerStateSubscriptionsForPartition(
                partition,
                this._runtime
            );
        }

        if (this._timeSync) {
            this._subs.push(
                this._timeSync,
                this._timeSync.syncUpdated.subscribe(() => {
                    this._runtime.context.instLatency =
                        this._timeSync.sync.calculatedTimeLatencyMS;
                    this._runtime.context.instTimeOffset =
                        this._timeSync.sync.offsetMS;
                    this._runtime.context.instTimeOffsetSpread =
                        this._timeSync.sync.offsetSpreadMS;
                })
            );

            this._timeSync.init();
        }
    }

    protected _registerStateSubscriptionsForPartition(
        partition: AuxPartition,
        runtime: AuxRuntime
    ) {
        this._subs.push(
            partition.onStateUpdated
                .pipe(
                    tap((e) => {
                        if (
                            e.addedBots.length <= 0 &&
                            e.removedBots.length <= 0 &&
                            e.updatedBots.length <= 0
                        ) {
                            return;
                        }
                        this._handleStateUpdated(runtime.stateUpdated(e));
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            partition.onVersionUpdated
                .pipe(
                    tap((v) => {
                        this._version = runtime.versionUpdated(v);
                        this._onVersionUpdated.next(this._version);
                    })
                )
                .subscribe(null, (e: any) => console.error(e))
        );
    }

    protected async _ensureSetup() {
        // console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);
        if (!this._runtime) {
            this._runtime = this._createRuntime();
            this._subs.push(this._runtime);
        }
        if (!this._helper) {
            this._helper = this._createAuxHelper();
        }
        if (!this._portalHelper) {
            this._portalHelper = new CustomAppHelper(this._helper);
        }
        if (!this._timeSync) {
            this._timeSync = this._createTimeSyncController();
        }

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Initializing user bot...',
            progress: 0.8,
        });
        await this._initUserBot();

        this._handleStatusUpdated({
            type: 'progress',
            message: 'Launching interface...',
            progress: 0.9,
        });

        if (!this._hasRegisteredSubs) {
            this._hasRegisteredSubs = true;
            this._registerSubscriptions();
        }

        await this._initPortalBots();

        await this._initBuilderBots();

        if (!this._checkAccessAllowed()) {
            this._onConnectionStateChanged.next({
                type: 'authorization',
                authorized: false,
                reason: 'unauthorized',
            });
            return;
        }

        this._runtime.context.setLoadTime(
            'load',
            performance.now() - this._initStartTime
        );
        console.log('[BaseAuxChannel] Sending init event');
        this._onConnectionStateChanged.next({
            type: 'init',
        });
    }

    protected async _handleStatusUpdated(state: StatusUpdate) {
        if (state.type === 'authentication') {
            this._deviceInfo = state.info;
        } else if (state.type === 'sync' && state.synced) {
            await this._ensureSetup();
        }

        this._onConnectionStateChanged.next(state);
    }

    /**
     * Decides what to do with device events from partitions.
     * By default the events are processed as-is.
     * This means that the events are sent directly to the AuxHelper via this.sendEvents().
     * @param events The events.
     */
    protected async _handlePartitionEvents(events: Action[]) {
        const actions = <BotAction[]>events;
        await this.sendEvents(actions);
    }

    protected _handleStateUpdated(event: StateUpdatedEvent) {
        this._onStateUpdated.next(event);
        if (!this._hasInitialState) {
            this._hasInitialState = true;
            if (this._eventBuffer.length > 0) {
                if (Object.keys(this._runtime.currentState).length <= 0) {
                    console.log(
                        '[BaseAuxChannel] Sending event before bots are added!'
                    );
                }
                const buffer = this._eventBuffer;
                this._eventBuffer = [];
                this._helper.transaction(...buffer);
            }
        }
    }

    protected _handleError(error: any) {
        this._onError.next(error);
    }

    protected _createRuntime(): AuxRuntime {
        const runtime = new AuxRuntime(
            buildVersionNumber(this._config.config),
            this._config.config ? this._config.config.device : null,
            undefined,
            this._partitionEditModeProvider,
            this._config.config
                ? this._config.config.forceSignedScripts || false
                : false
        );
        runtime.userId = this.user ? this.user.id : null;
        return runtime;
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        for (let event of e) {
            if (event.type === 'load_space') {
                this._loadPartition(event.space, event.config, event);
            } else if (event.type === 'attach_runtime') {
                this._attachRuntime(event.runtime, event);
            }
        }
        this._portalHelper.handleEvents(e);

        const copiableEvents = e.filter((e) => !(<any>e).uncopiable);
        this._onLocalEvents.next(copiableEvents);
    }

    protected _handleDeviceEvents(e: DeviceAction[]) {
        this._onDeviceEvents.next(e);
    }

    protected async _loadPartition(
        space: string,
        config: PartitionConfig,
        event: LoadSpaceAction
    ) {
        if (space in this._partitions) {
            console.log(
                `[BaseAuxChannel] Cannot load partition for "${space}" since the space is already occupied`
            );
            if (hasValue(event.taskId)) {
                this.sendEvents([asyncResult(event.taskId, null)]);
            }
            return;
        }

        let partition = await this._createPartition(config);
        if (!partition) {
            return;
        }

        this._partitions[space] = partition;
        this.helper.addPartition(space, partition);
        this._subs.push(
            ...this._getCleanupSubscriptionsForPartition(partition)
        );

        if (hasValue(event.taskId)) {
            // Wait for initial connection
            partition.onStatusUpdated
                .pipe(
                    first(
                        (status) =>
                            status.type === 'sync' && status.synced === true
                    )
                )
                .subscribe(() => {
                    this.sendEvents([asyncResult(event.taskId, null)]);
                });
        }

        partition.connect();

        if (this._hasRegisteredSubs) {
            this._registerStateSubscriptionsForPartition(
                partition,
                this._runtime
            );
        }
    }

    /**
     * Creates an aux channel using the given runtime.
     * @param runtime The runtime that should be used for the new channel.
     * @param config The configuration that should be used.
     */
    protected abstract _createSubChannel(
        user: AuxUser,
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel;

    private async _attachRuntime(
        runtime: AuxRuntime,
        event: AttachRuntimeAction
    ) {
        try {
            const newUserId = uuid();
            const channelId = uuid();

            let initialStates: {
                [space: string]: BotsState;
            } = {};
            for (let id in runtime.currentState) {
                const bot = runtime.currentState[id];
                const space = getBotSpace(bot);
                if (!initialStates[space]) {
                    initialStates[space] = {};
                }
                initialStates[space][id] = createBot(id, bot.tags, space);
            }

            const partitions = mapValues(
                this._config.partitions,
                (p, space) => {
                    return {
                        type: 'memory',
                        initialState: initialStates[space] ?? {},
                    } as const;
                }
            );

            const channel = this._createSubChannel(
                {
                    id: newUserId,
                    name: newUserId,
                    token: newUserId,
                    username: newUserId,
                },
                runtime,
                {
                    config: {
                        ...this._config.config,
                    },

                    // Map all partitions to memory partitions for now
                    partitions,
                }
            );

            const sub = new Subscription();
            sub.add(channel);

            const subChannel: AuxSubChannel = {
                id: channelId,
                channel,
            };
            this._subChannels.push(subChannel);
            this._handleSubChannelAdded(subChannel);

            if (hasValue(event.taskId)) {
                this.sendEvents([asyncResult(event.taskId, null)]);
            }
        } catch (err) {
            if (hasValue(event.taskId)) {
                this.sendEvents([asyncError(event.taskId, err)]);
            }
        }
    }

    protected _handleSubChannelAdded(subChannel: AuxSubChannel) {
        this._onSubChannelAdded.next(subChannel);
    }

    // private async _attachRuntime(
    //     runtime: AuxRuntime,
    //     event: AttachRuntimeAction
    // ) {
    //     try {
    //         const newUserId = uuid();
    //         const channel = this._createSubChannel(
    //             {
    //                 id: newUserId,
    //                 name: newUserId,
    //                 token: newUserId,
    //                 username: newUserId,
    //             },
    //             runtime,
    //             {
    //                 config: {
    //                     ...this._config.config,
    //                 },

    //                 // Map all partitions to memory partitions for now
    //                 partitions: mapValues(
    //                     this._config.partitions,
    //                     (p) =>
    //                         ({
    //                             type: 'memory',
    //                             initialState: {},
    //                         } as const)
    //                 ),
    //             }
    //         );
    //         const channelId = uuid();
    //         const spacesMap = new Map<string, string>();
    //         const reverseSpacesMap = new Map<string, string>();
    //         const tagNameMap = new Map<string, string>();
    //         const reverseTagNameMap = new Map<string, string>();
    //         const forwardTagNameMapper = (name: string) => {
    //             if (tagNameMap.has(name)) {
    //                 return tagNameMap.get(name);
    //             }
    //             if (event.tagNameMapper?.forward) {
    //                 const mapped = event.tagNameMapper.forward(name);
    //                 if (mapped !== name) {
    //                     if (
    //                         tagNameMap.has(name) &&
    //                         tagNameMap.get(name) !== mapped
    //                     ) {
    //                         console.warn(
    //                             '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
    //                         );
    //                         return name;
    //                     } else if (
    //                         reverseTagNameMap.has(mapped) &&
    //                         reverseTagNameMap.get(mapped) !== name
    //                     ) {
    //                         console.warn(
    //                             '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
    //                         );
    //                         return name;
    //                     }
    //                     tagNameMap.set(name, mapped);
    //                     reverseTagNameMap.set(mapped, name);
    //                 }

    //                 return mapped;
    //             }

    //             return name;
    //         };

    //         const reverseTagNameMapper = (name: string) => {
    //             if (reverseTagNameMap.has(name)) {
    //                 return reverseTagNameMap.get(name);
    //             }
    //             if (event.tagNameMapper?.reverse) {
    //                 const mapped = event.tagNameMapper.reverse(name);
    //                 if (mapped !== name) {
    //                     if (
    //                         reverseTagNameMap.has(name) &&
    //                         reverseTagNameMap.get(name) !== mapped
    //                     ) {
    //                         console.warn(
    //                             '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
    //                         );
    //                         return name;
    //                     } else if (
    //                         tagNameMap.has(mapped) &&
    //                         tagNameMap.get(mapped) !== name
    //                     ) {
    //                         console.warn(
    //                             '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
    //                         );
    //                         return name;
    //                     }
    //                     reverseTagNameMap.set(name, mapped);
    //                     tagNameMap.set(mapped, name);
    //                 }

    //                 return mapped;
    //             }

    //             return name;
    //         };

    //         const newChannelSpaces = Object.keys(channel._config.partitions);

    //         for (let space of newChannelSpaces) {
    //             spacesMap.set(space, `${space}-${channelId}`);
    //             reverseSpacesMap.set(`${space}-${channelId}`, space);
    //         }

    //         const sub = new Subscription();

    //         const mappedTaskIds = new Map<string | number, string | number>();

    //         // TODO: Map tag names
    //         sub.add(
    //             channel.onLocalEvents.subscribe((e) => {
    //                 let nextEvents = [] as LocalActions[];
    //                 for (let event of e) {
    //                     if (
    //                         event.type === 'async_result' ||
    //                         event.type === 'async_error' ||
    //                         event.type === 'device_result' ||
    //                         event.type === 'device_error'
    //                     ) {
    //                         mappedTaskIds.delete(event.taskId);
    //                         nextEvents.push(event);
    //                     } else if (
    //                         'taskId' in event &&
    //                         hasValue(event.taskId)
    //                     ) {
    //                         const newTaskId = uuid();
    //                         const newEvent = {
    //                             ...event,
    //                             taskId: newTaskId,
    //                         };
    //                         mappedTaskIds.set(newTaskId, event.taskId);
    //                         nextEvents.push(newEvent);
    //                     } else {
    //                         nextEvents.push(event);
    //                     }
    //                 }
    //                 this._onLocalEvents.next(nextEvents);
    //             })
    //         );

    //         const tagNameMapper = {
    //             forward: forwardTagNameMapper,
    //             reverse: reverseTagNameMapper,
    //         };

    //         // TODO: Map map tag names
    //         // TODO: Map space names
    //         sub.add(
    //             channel.onStateUpdated.subscribe((e) =>
    //                 this._onStateUpdated.next(
    //                     this._mapTagAndSpaceNames(
    //                         e,
    //                         tagNameMapper,
    //                         (space) => spacesMap.get(space),
    //                         spacesMap.get('shared')
    //                     )
    //                 )
    //             )
    //         );

    //         sub.add(
    //             channel.onVersionUpdated.subscribe((e) =>
    //                 this._onVersionUpdated.next(e)
    //             )
    //         );
    //         this._subchannels.push({
    //             channel,
    //             tagNameMap,
    //             reverseTagNameMap,
    //             mappedTaskIds,
    //             spacesMap,
    //             reverseSpacesMap,
    //             tagNameMapper,
    //         });
    //         this._subs.push(sub);

    //         const initialEvents = [] as BotAction[];
    //         for (let id in runtime.currentState) {
    //             initialEvents.push(botAdded(runtime.currentState[id]));
    //         }
    //         channel.sendEvents(initialEvents);

    //         await channel.initAndWait();
    //         channel.helper.supressLogs = true;

    //         if (hasValue(event.taskId)) {
    //             this.sendEvents([asyncResult(event.taskId, null)]);
    //         }
    //     } catch (err) {
    //         if (hasValue(event.taskId)) {
    //             this.sendEvents([asyncError(event.taskId, err)]);
    //         }
    //     }
    // }

    private _mapTagAndSpaceNames(
        update: StateUpdatedEvent,
        tagNameMapper: AttachRuntimeAction['tagNameMapper'],
        spaceNameMapper: (spaceName: string) => string,
        defaultSpace: string
    ): StateUpdatedEvent {
        const u: StateUpdatedEvent = {
            state: {
                ...update.state,
            },
            addedBots: update.addedBots,
            removedBots: update.removedBots,
            updatedBots: update.updatedBots,
            version: update.version,
        };
        for (let added of update.addedBots) {
            u.state[added] = mapBotTagsAndSpace(
                update.state[added],
                tagNameMapper.forward,
                spaceNameMapper,
                defaultSpace
            );
        }

        for (let updated of update.updatedBots) {
            u.state[updated] = mapBotTagsAndSpace(
                update.state[updated],
                tagNameMapper.forward,
                spaceNameMapper,
                null
            );
        }

        return u;
    }

    private async _initUserBot() {
        if (!this.user) {
            console.warn(
                '[BaseAuxChannel] Not initializing user bot because user is null. (User needs to be specified)'
            );
            return;
        }
        try {
            const userBot = this._helper.userBot;
            await this._helper.createOrUpdateUserBot(this.user, userBot);
        } catch (err) {
            console.error('[BaseAuxChannel] Unable to init user bot:', err);
        }
    }

    private async _initPortalBots() {
        try {
            if (
                this._config.config?.builtinPortals &&
                this._config.config?.builtinPortals.length > 0
            ) {
                let actions = this._config.config.builtinPortals.map((portal) =>
                    registerBuiltinPortal(portal)
                );
                this._runtime.process([
                    ...actions,

                    // Define the authBot with a random UUID so that it will be
                    // referencable but return undefined until it is actually loaded.
                    defineGlobalBot('auth', uuid()),
                ]);
            }
        } catch (err) {
            console.error('[BaseAuxChannel] Unable to init portal bots:', err);
        }
    }

    private async _initBuilderBots() {
        if (
            !this._config ||
            !this._config.config ||
            !this._config.config.builder
        ) {
            return;
        }
        if (!!this._config.config.bootstrapState) {
            try {
                await this._helper.destroyBuilderBots(
                    this._config.config.builder
                );
            } catch (err) {
                console.error(
                    '[BaseAuxChannel] Unable to destroy builder bot:',
                    err
                );
            }
        } else {
            try {
                await this._helper.createOrUpdateBuilderBots(
                    this._config.config.builder
                );
            } catch (err) {
                console.error(
                    '[BaseAuxChannel] Unable to init builder bot:',
                    err
                );
            }
        }
    }

    /**
     * Checks if the current user is allowed access to the simulation.
     */
    _checkAccessAllowed(): boolean {
        if (!this._helper.userBot) {
            return false;
        }

        return true;
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._subs.forEach((s) => s.unsubscribe());
    }

    closed: boolean;
}

addDebugApi('getChannel', () => null as any);

function mapBotTagsAndSpace<T extends Partial<PrecalculatedBot>>(
    bot: T,
    tagNameMapper: (tag: string) => string,
    spaceNameMapper: (space: string) => string,
    defaultSpace: string
) {
    // if (hasValue(bot.space)) {
    //     const space = spaceNameMapper(bot.space) as BotSpace;
    //     if (space !== bot.space) {
    //         bot = merge(bot, {
    //             space
    //         });
    //     }
    // } else if (defaultSpace !== bot.space) {
    //     bot = merge(bot, {
    //         space: defaultSpace
    //     });
    // }

    // bot = Object.assign({}, bot, {
    //     tags: mapKeys(bot.tags, (v, k) => tagNameMapper(k)),
    //     values: mapKeys(bot.values, (v, k) => tagNameMapper(k)),
    //     masks: transform(bot.masks, (result, value, key) => {
    //         result[spaceNameMapper(key)] = mapKeys(value, (v, k) => tagNameMapper(k));
    //     }, {} as BotTagMasks)
    // });

    if (hasValue(bot.space)) {
        const space = spaceNameMapper(bot.space) as BotSpace;
        if (space !== bot.space) {
            bot = merge(bot, {
                space,
            });
        }
    } else if (defaultSpace && defaultSpace !== bot.space) {
        bot = merge(bot, {
            space: defaultSpace,
        });
    }

    let merger: Partial<PrecalculatedBot> = {};
    let hasMerger = false;

    if (hasValue(bot.tags)) {
        merger.tags = mapKeys(bot.tags, (v, k) => tagNameMapper(k));
        hasMerger = true;
    }
    if (hasValue(bot.values)) {
        merger.values = mapKeys(bot.values, (v, k) => tagNameMapper(k));
        hasMerger = true;
    }
    if (hasValue(bot.masks)) {
        merger.masks = transform(
            bot.masks,
            (result, value, key) => {
                result[spaceNameMapper(key)] = mapKeys(value, (v, k) =>
                    tagNameMapper(k)
                );
            },
            {} as BotTagMasks
        );
        hasMerger = true;
    }

    if (hasMerger) {
        bot = Object.assign({}, bot, merger);
    }

    return bot;
}
