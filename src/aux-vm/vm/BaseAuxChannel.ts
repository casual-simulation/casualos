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
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject, firstValueFrom } from 'rxjs';
import { tap, first, startWith } from 'rxjs/operators';
import type {
    AuxChannel,
    AuxSubChannel,
    ChannelActionResult,
} from './AuxChannel';
import type {
    LocalActions,
    BotAction,
    BotsState,
    StateUpdatedEvent,
    AuxPartitions,
    AuxPartition,
    PartitionConfig,
    BotSpace,
    LoadSpaceAction,
    BotTagMasks,
    PrecalculatedBot,
    StoredAux,
    ConnectionInfo,
    DeviceAction,
    StatusUpdate,
    Action,
    RemoteActions,
    EnableCollaborationAction,
    PartitionAuthMessage,
    AuxPartitionServices,
    LoadSharedDocumentAction,
} from '@casual-simulation/aux-common';
import {
    BOT_SPACE_TAG,
    iteratePartitions,
    hasValue,
    asyncResult,
    addDebugApi,
    stateUpdatedEvent,
    registerBuiltinPortal,
    defineGlobalBot,
    merge,
    asyncError,
    botAdded,
    botUpdated,
    createBot,
    getBotSpace,
    remapProgressPercent,
    PartitionAuthSource,
    action,
    ON_COLLABORATION_ENABLED,
    ON_ALLOW_COLLABORATION_UPGRADE,
    ON_DISALLOW_COLLABORATION_UPGRADE,
} from '@casual-simulation/aux-common';
import type {
    AttachRuntimeAction,
    DetachRuntimeAction,
    TagMapper,
    RuntimeStateVersion,
    RuntimeActions,
    AuxDevice,
} from '@casual-simulation/aux-runtime';
import {
    AuxPartitionRealtimeEditModeProvider,
    AuxRuntime,
    isPromise,
} from '@casual-simulation/aux-runtime';
import { AuxHelper } from './AuxHelper';
import type { AuxConfig } from './AuxConfig';
import { buildVersionNumber } from './AuxConfig';
import type { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { StatusHelper } from './StatusHelper';
import { mapKeys, mapValues, pick, transform } from 'es-toolkit/compat';
import { CustomAppHelper } from '../portals/CustomAppHelper';
import { v4 as uuid } from 'uuid';
import type { TimeSyncController } from '@casual-simulation/timesync';
import type { RemoteSharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import type { SharedDocumentServices } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';

export interface AuxChannelOptions {}

export abstract class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _runtime: AuxRuntime;
    protected _config: AuxConfig;
    protected _options: AuxChannelOptions;
    protected _subs: SubscriptionLike[];
    protected _deviceInfo: ConnectionInfo;
    protected _partitionEditModeProvider: AuxPartitionRealtimeEditModeProvider;
    protected _partitions: AuxPartitions;
    protected _documents: Map<string, SharedDocument> = new Map();
    protected _portalHelper: CustomAppHelper;
    private _services: AuxPartitionServices;
    private _statusHelper: StatusHelper;
    private _hasRegisteredSubs: boolean;
    private _eventBuffer: RuntimeActions[];
    private _hasInitialState: boolean;
    private _version: RuntimeStateVersion;
    private _timeSync: TimeSyncController;
    private _initStartTime: number;

    private _subChannels: { channel: BaseAuxChannel; id: string }[];
    private _onLocalEvents: Subject<RuntimeActions[]>;
    private _onDeviceEvents: Subject<DeviceAction[]>;
    private _onStateUpdated: Subject<StateUpdatedEvent>;
    private _onVersionUpdated: Subject<RuntimeStateVersion>;
    private _onConnectionStateChanged: Subject<StatusUpdate>;
    private _onAuthMessage: Subject<PartitionAuthMessage>;
    private _onSubChannelAdded: Subject<AuxSubChannel>;
    private _onSubChannelRemoved: Subject<string>;
    private _onError: Subject<AuxChannelErrorType>;
    private _tagNameMapper: TagMapper;
    protected _authSource: PartitionAuthSource;

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

    get onAuthMessage(): Observable<PartitionAuthMessage> {
        return this._onAuthMessage;
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

    constructor(config: AuxConfig, options: AuxChannelOptions) {
        this._config = config;
        this._options = options;
        this._subs = [];
        this._hasRegisteredSubs = false;
        this._onLocalEvents = new Subject<LocalActions[]>();
        this._onDeviceEvents = new Subject<DeviceAction[]>();
        this._onStateUpdated = new Subject<StateUpdatedEvent>();
        this._onVersionUpdated = new Subject<RuntimeStateVersion>();
        this._onConnectionStateChanged = new Subject<StatusUpdate>();
        this._onAuthMessage = new Subject();
        this._onSubChannelAdded = new Subject();
        this._onSubChannelRemoved = new Subject();
        this._onError = new Subject<AuxChannelErrorType>();
        this._eventBuffer = [];
        this._subChannels = [];
        this._hasInitialState = false;
        this._version = {
            localSites: {},
            vector: {},
        };

        this._onConnectionStateChanged.subscribe({
            error: (err) => {
                this._onError.next({
                    type: 'general',
                    message: err.toString(),
                });
            },
        });
        this._onStateUpdated.subscribe({
            error: (err) => {
                this._onError.next({
                    type: 'general',
                    message: err.toString(),
                });
            },
        });
        this._onLocalEvents.subscribe({
            error: (err) => {
                this._onError.next({
                    type: 'general',
                    message: err.toString(),
                });
            },
        });
        this._onDeviceEvents.subscribe({
            error: (err) => {
                this._onError.next({
                    type: 'general',
                    message: err.toString(),
                });
            },
        });

        addDebugApi('getChannel', () => this);
    }

    async init(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ): Promise<void> {
        if (onLocalEvents) {
            this.onLocalEvents.subscribe(
                handleTransferError((e) => onLocalEvents(e), 'onLocalEvents')
            );
        }
        if (onStateUpdated) {
            this.onStateUpdated.subscribe(
                handleTransferError((s) => onStateUpdated(s), 'onStateUpdated')
            );
        }
        if (onVersionUpdated) {
            this.onVersionUpdated.subscribe(
                handleTransferError(
                    (v) => onVersionUpdated(v),
                    'onVersionUpdated'
                )
            );
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged.subscribe(
                handleTransferError(
                    (s) => onConnectionStateChanged(s),
                    'onConnectionStateChanged'
                )
            );
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe(
                handleTransferError((e) => onDeviceEvents(e), 'onDeviceEvents')
            );
        }
        if (onSubChannelAdded) {
            this.onSubChannelAdded.subscribe(
                handleTransferError(
                    (s) => onSubChannelAdded(s),
                    'onSubChannelAdded'
                )
            );
        }
        if (onSubChannelRemoved) {
            this.onSubChannelRemoved.subscribe(
                handleTransferError(
                    (s) => onSubChannelRemoved(s),
                    'onSubChannelRemoved'
                )
            );
        }
        if (onAuthMessage) {
            this.onAuthMessage.subscribe(
                handleTransferError((m) => onAuthMessage(m), 'onAuthMessage')
            );
        }
        // if (onError) {
        //     this.onError.subscribe(onError);
        // }

        return await this._init();
    }

    async initAndWait(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ) {
        const promise = firstValueFrom(
            this.onConnectionStateChanged.pipe(first((s) => s.type === 'init'))
        );
        await this.init(
            onLocalEvents,
            onDeviceEvents,
            onStateUpdated,
            onVersionUpdated,
            onConnectionStateChanged,
            onError,
            onSubChannelAdded,
            onSubChannelRemoved,
            onAuthMessage
        );
        await promise;
    }

    async registerListeners(
        onLocalEvents?: (events: RuntimeActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void,
        onSubChannelAdded?: (channel: AuxSubChannel) => void,
        onSubChannelRemoved?: (channelId: string) => void,
        onAuthMessage?: (message: PartitionAuthMessage) => void
    ): Promise<void> {
        if (onLocalEvents) {
            this.onLocalEvents.subscribe(
                handleTransferError((e) => onLocalEvents(e), 'onLocalEvents')
            );
        }
        if (onStateUpdated) {
            this.onStateUpdated
                .pipe(startWith(stateUpdatedEvent(this._helper.botsState)))
                .subscribe(
                    handleTransferError(
                        (s) => onStateUpdated(s),
                        'onStateUpdated'
                    )
                );
        }
        if (onVersionUpdated) {
            this.onVersionUpdated
                .pipe(startWith(this._version))
                .subscribe(
                    handleTransferError(
                        (v) => onVersionUpdated(v),
                        'onVersionUpdated'
                    )
                );
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
                .subscribe(
                    handleTransferError(
                        (s) => onConnectionStateChanged(s),
                        'onConnectionStateChanged'
                    )
                );
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe(
                handleTransferError((e) => onDeviceEvents(e), 'onDeviceEvents')
            );
        }
        if (onSubChannelAdded) {
            this.onSubChannelAdded.subscribe(
                handleTransferError(
                    (s) => onSubChannelAdded(s),
                    'onSubChannelAdded'
                )
            );
        }
        if (onSubChannelRemoved) {
            this.onSubChannelRemoved.subscribe(
                handleTransferError(
                    (s) => onSubChannelRemoved(s),
                    'onSubChannelRemoved'
                )
            );
        }
        if (onAuthMessage) {
            this.onAuthMessage.subscribe(
                handleTransferError((m) => onAuthMessage(m), 'onAuthMessage')
            );
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

        this._authSource = new PartitionAuthSource();
        this._subs.push(
            this._authSource.onAuthMessage.subscribe(this._onAuthMessage)
        );
        this._services = {
            authSource: this._authSource,
        };

        let partitions: AuxPartition[] = [];
        for (let [key, partitionConfig] of iteratePartitions(
            this._config.partitions
        )) {
            const partition = await this._createPartition(
                partitionConfig,
                this._services
            );
            if (partition) {
                partition.space = key as string;
                this._partitions[key] = partition;
                partitions.push(partition);
            } else {
                console.error(
                    '[BaseAuxChannel] Unable to create partition:',
                    key,
                    partitionConfig
                );
                throw new Error(
                    `[BaseAuxChannel] Unable to build partition: ${key}`
                );
            }
        }

        this._statusHelper = new StatusHelper(
            partitions.map((p) => p.onStatusUpdated)
        );

        let statusMapper = remapProgressPercent(0.3, 0.6);
        this._subs.push(
            this._statusHelper,
            this._statusHelper.updates
                .pipe(
                    tap((state) =>
                        this._handleStatusUpdated(statusMapper(state))
                    )
                )
                .subscribe({ error: (e: any) => console.error(e) }),
            ...partitions.flatMap((p) =>
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
                .subscribe({ error: (e: any) => console.error(e) }),
        ];
    }

    protected _getCleanupSubscriptionsForSharedDocument(
        doc: SharedDocument
    ): SubscriptionLike[] {
        return [doc, doc.onError.subscribe((err) => this._handleError(err))];
    }

    /**
     * Creates a partition for the given config.
     * @param config The config.
     * @param services The services that should be used by the partition.
     */
    protected abstract _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition>;

    /**
     * Creates a shared document for the given config.
     * @param config The config.
     * @param services The services that should be used by the document.
     */
    protected abstract _createSharedDocument(
        config: RemoteSharedDocumentConfig,
        services: SharedDocumentServices
    ): Promise<SharedDocument>;

    async sendEvents(events: RuntimeActions[]): Promise<void> {
        if (this._hasInitialState) {
            if (this._tagNameMapper) {
                let mappedEvents = [];
                for (let event of events) {
                    if (event.type === 'update_bot') {
                        mappedEvents.push(
                            botUpdated(
                                event.id,
                                mapBotTagsAndSpace(
                                    event.update,
                                    this._tagNameMapper.reverse,
                                    (s) => s,
                                    null
                                )
                            )
                        );
                    } else if (event.type === 'add_bot') {
                        mappedEvents.push(
                            botAdded(
                                mapBotTagsAndSpace(
                                    event.bot,
                                    this._tagNameMapper.reverse,
                                    (s) => s,
                                    'shared'
                                )
                            )
                        );
                    } else {
                        mappedEvents.push(event);
                    }
                }

                events = mappedEvents;
            }

            await this._helper.transaction(...events);
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

    async updateDevice(device: AuxDevice): Promise<void> {
        let previousDevice = this._config.config.device;

        this._config.config.device = device;
        if (this._runtime) {
            this._runtime.context.device = device;
        }

        if (this._helper) {
            if (!previousDevice.isCollaborative) {
                if (!device.isCollaborative) {
                    if (
                        device.allowCollaborationUpgrade &&
                        !previousDevice.allowCollaborationUpgrade
                    ) {
                        await this.sendEvents([
                            action(ON_ALLOW_COLLABORATION_UPGRADE),
                        ]);
                    } else if (
                        !device.allowCollaborationUpgrade &&
                        previousDevice.allowCollaborationUpgrade
                    ) {
                        await this.sendEvents([
                            action(ON_DISALLOW_COLLABORATION_UPGRADE),
                        ]);
                    }
                } else {
                    await this.sendEvents([action(ON_COLLABORATION_ENABLED)]);
                }
            }
        }
    }

    async sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        this._authSource.sendAuthMessage(message);
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
        let helper = new AuxHelper(
            this._config.configBotId,
            partitions,
            this._runtime
        );
        return helper;
    }

    protected _createTimeSyncController(): TimeSyncController {
        return null;
    }

    protected _registerSubscriptions() {
        this._subs.push(
            this._helper.localEvents.subscribe({
                next: (e) => this._handleLocalEvents(e),
                error: (e: any) => console.error(e),
            }),
            this._helper.deviceEvents.subscribe({
                next: (e) => this._handleDeviceEvents(e),
                error: (e: any) => console.error(e),
            }),
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
                        let finalState = runtime.stateUpdated(e);

                        if (this._tagNameMapper) {
                            finalState = this._mapTagAndSpaceNames(
                                finalState,
                                this._tagNameMapper
                            );
                        }

                        this._handleStateUpdated(finalState);
                    })
                )
                .subscribe({ error: (e: any) => console.error(e) }),
            partition.onVersionUpdated
                .pipe(
                    tap((v) => {
                        this._version = runtime.versionUpdated(v);
                        this._onVersionUpdated.next(this._version);
                    })
                )
                .subscribe({ error: (e: any) => console.error(e) })
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
        if (state.type === 'progress') {
            console.log(
                `[BaseAuxChannel] Loading Progress (${
                    state.progress * 100
                }%): ${state.message}`
            );
        }
        if (state.type === 'authentication') {
            console.log(
                `[BaseAuxChannel] Authentication (${state.authenticated}):`,
                state.info
            );
            this._deviceInfo = state.info;
        } else if (state.type === 'sync' && state.synced) {
            console.log(`[BaseAuxChannel] Sync (${state.synced})`);
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
            this._partitionEditModeProvider
        );
        runtime.userId = this._config.configBotId;
        return runtime;
    }

    protected _handleLocalEvents(e: RuntimeActions[]) {
        for (let event of e) {
            if (event.type === 'load_space') {
                this._loadPartition(event.space, event.config, event);
            } else if (event.type === 'attach_runtime') {
                this._attachRuntime(event.runtime, event);
            } else if (event.type === 'detach_runtime') {
                this._detachRuntime(event.runtime, event);
            } else if (event.type === 'enable_collaboration') {
                this._enableCollaboration(event);
            } else if (event.type === 'load_shared_document') {
                this._loadSharedDocument(event);
            }
        }
        this._portalHelper.handleEvents(e);

        const copiableEvents = e.filter((e) => !(<any>e).uncopiable);
        this._onLocalEvents.next(copiableEvents);
    }

    private async _enableCollaboration(event: EnableCollaborationAction) {
        try {
            if (!this._runtime.context.device) {
                if (hasValue(event.taskId)) {
                    this.sendEvents([asyncResult(event.taskId, null)]);
                }
                return;
            }
            if (this._runtime.context.device.isCollaborative) {
                if (hasValue(event.taskId)) {
                    this.sendEvents([asyncResult(event.taskId, null)]);
                }
                return;
            }
            if (!this._runtime.context.device.allowCollaborationUpgrade) {
                if (hasValue(event.taskId)) {
                    this.sendEvents([
                        asyncError(
                            event.taskId,
                            new Error('Collaboration upgrades are not allowed.')
                        ),
                    ]);
                }
                return;
            }

            let promises = [] as Promise<void>[];
            for (let [_, partition] of iteratePartitions(this._partitions)) {
                if (partition.enableCollaboration) {
                    promises.push(partition.enableCollaboration());
                }
            }

            await Promise.all(promises);
            this._runtime.context.device.isCollaborative = true;
            this._runtime.context.device.allowCollaborationUpgrade = false;

            if (hasValue(event.taskId)) {
                this.sendEvents([asyncResult(event.taskId, null)]);
            }
            this.sendEvents([action(ON_COLLABORATION_ENABLED)]);
        } catch (err) {
            console.error('[BaseAuxChannel] Error enabling collaboration', err);
            if (hasValue(event.taskId)) {
                this.sendEvents([asyncError(event.taskId, err)]);
            }
        }
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

        let partition = await this._createPartition(config, this._services);
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
     * Gets the ID of the shared document that should be loaded.
     * Returns a string that represents the ID of the document that should be reused if possible.
     * If the document should not be reused, returns null.
     * @param event The event that was received.
     */
    protected _getSharedDocId(event: LoadSharedDocumentAction): string | null {
        if (event.branch) {
            return `${event.recordName ?? ''}/${event.inst ?? ''}/${
                event.branch
            }`;
        }
        return null;
    }

    protected async _loadSharedDocument(event: LoadSharedDocumentAction) {
        const id = this._getSharedDocId(event);
        if (id) {
            const doc = this._documents.get(id);
            if (doc && !doc.closed) {
                if (hasValue(event.taskId)) {
                    this.sendEvents([
                        asyncResult(event.taskId, doc, false, true),
                    ]);
                }
                return;
            }
        }

        const config: RemoteSharedDocumentConfig = {
            recordName: event.recordName,
            inst: event.inst,
            branch: event.branch,
            host: this._config.config.causalRepoConnectionUrl,
            connectionProtocol:
                this._config.config.causalRepoConnectionProtocol,
        };

        if (!hasValue(event.inst) && hasValue(event.branch)) {
            config.localPersistence = {
                saveToIndexedDb: true,
            };
        }

        let doc = await this._createSharedDocument(config, this._services);
        if (!doc) {
            return;
        }

        if (id) {
            this._documents.set(id, doc);
        }

        this._subs.push(...this._getCleanupSubscriptionsForSharedDocument(doc));

        if (hasValue(event.taskId)) {
            // Wait for initial connection
            doc.onStatusUpdated
                .pipe(
                    first(
                        (status) =>
                            status.type === 'sync' && status.synced === true
                    )
                )
                .subscribe(() => {
                    this.sendEvents([
                        asyncResult(event.taskId, doc, false, true),
                    ]);
                });
        }

        doc.connect();
    }

    /**
     * Creates an aux channel using the given runtime.
     * @param runtime The runtime that should be used for the new channel.
     * @param config The configuration that should be used.
     */
    protected abstract _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel;

    private async _attachRuntime(
        runtime: AuxRuntime,
        event: AttachRuntimeAction
    ) {
        try {
            const newConfigBotId = uuid();
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

            const channel = this._createSubChannel(runtime, {
                configBotId: newConfigBotId,
                config: {
                    ...this._config.config,
                },

                // Map all partitions to memory partitions for now
                partitions,
            });
            channel._runtime.userId = newConfigBotId;
            channel._tagNameMapper = this._createTagNameMapper(
                event.tagNameMapper
            );

            const subChannel: AuxSubChannel = {
                getInfo: async () => ({
                    id: channelId,
                    configBotId: newConfigBotId,
                    indicator: {
                        connectionId: newConfigBotId,
                    },
                }),
                getChannel: async () => channel,
            };
            this._subChannels.push({
                channel,
                id: channelId,
            });
            this._subs.push(channel);
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

    private async _detachRuntime(
        runtime: AuxRuntime,
        event: DetachRuntimeAction
    ) {
        try {
            const index = this._subChannels.findIndex(
                (c) => c.channel._runtime === runtime
            );

            if (index < 0) {
                if (hasValue(event.taskId)) {
                    this.sendEvents([asyncResult(event.taskId, null)]);
                }
                return;
            }

            const { channel, id } = this._subChannels[index];
            channel.unsubscribe();
            this._subChannels.splice(index, 1);

            const subIndex = this._subs.indexOf(channel);
            if (subIndex >= 0) {
                this._subs.splice(subIndex, 1);
            }

            this._handleSubChannelRemoved(id);

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

    protected _handleSubChannelRemoved(channelId: string) {
        this._onSubChannelRemoved.next(channelId);
    }

    private _createTagNameMapper(tagNameMapper: TagMapper): TagMapper {
        const tagNameMap = new Map<string, string>();
        const reverseTagNameMap = new Map<string, string>();
        const forwardTagNameMapper = (name: string) => {
            if (tagNameMap.has(name)) {
                return tagNameMap.get(name);
            }
            if (tagNameMapper?.forward) {
                const mapped = tagNameMapper.forward(name);
                if (mapped !== name) {
                    if (
                        tagNameMap.has(name) &&
                        tagNameMap.get(name) !== mapped
                    ) {
                        console.warn(
                            '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
                        );
                        return name;
                    } else if (
                        reverseTagNameMap.has(mapped) &&
                        reverseTagNameMap.get(mapped) !== name
                    ) {
                        console.warn(
                            '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
                        );
                        return name;
                    }
                    tagNameMap.set(name, mapped);
                    reverseTagNameMap.set(mapped, name);
                }

                return mapped;
            }

            return name;
        };

        const reverseTagNameMapper = (name: string) => {
            if (reverseTagNameMap.has(name)) {
                return reverseTagNameMap.get(name);
            }
            if (tagNameMapper?.reverse) {
                const mapped = tagNameMapper.reverse(name);
                if (mapped !== name) {
                    if (
                        reverseTagNameMap.has(name) &&
                        reverseTagNameMap.get(name) !== mapped
                    ) {
                        console.warn(
                            '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
                        );
                        return name;
                    } else if (
                        tagNameMap.has(mapped) &&
                        tagNameMap.get(mapped) !== name
                    ) {
                        console.warn(
                            '[BaseAuxChannel] It is not possible to map multiple different tag names to the same name.'
                        );
                        return name;
                    }
                    reverseTagNameMap.set(name, mapped);
                    tagNameMap.set(mapped, name);
                }

                return mapped;
            }

            return name;
        };

        return {
            forward: forwardTagNameMapper,
            reverse: reverseTagNameMapper,
        };
    }

    private _mapTagAndSpaceNames(
        update: StateUpdatedEvent,
        tagNameMapper: AttachRuntimeAction['tagNameMapper']
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
                (s) => s,
                'shared'
            );
        }

        for (let updated of update.updatedBots) {
            u.state[updated] = mapBotTagsAndSpace(
                update.state[updated],
                tagNameMapper.forward,
                (s) => s,
                null
            );
        }

        return u;
    }

    private async _initUserBot() {
        try {
            const userBot = this._helper.userBot;
            await this._helper.createOrUpdateUserBot(
                this._config.configBotId,
                userBot
            );
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

function handleTransferError<T>(
    func: (val: T) => void | Promise<void>,
    name: string
): (val: T) => void | Promise<void> {
    return (val) => {
        try {
            const res = func(val);
            if (isPromise(res)) {
                res.catch((err) => {
                    console.error(
                        `[BaseAuxChannel] Error transferring in ${name}:`,
                        val
                    );
                    throw err;
                });
            }
        } catch (err) {
            console.error(
                `[BaseAuxChannel] Error transferring in ${name}:`,
                val
            );
            throw err;
        }
    };
}
