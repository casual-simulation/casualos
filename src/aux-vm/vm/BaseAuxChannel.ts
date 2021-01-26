import { Subject, SubscriptionLike } from 'rxjs';
import { tap, first } from 'rxjs/operators';
import { AuxChannel, ChannelActionResult } from './AuxChannel';
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
    RegisterCustomPortalAction,
    asyncError,
    AddEntryPointAction,
    RegisterCustomPortalOptions,
    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
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
import pick from 'lodash/pick';
import flatMap from 'lodash/flatMap';
import { RealtimeEditMode } from '@casual-simulation/aux-common/runtime/RuntimeBot';
import { mergeVersions } from '@casual-simulation/aux-common/aux-format-2';
import { AuxVM } from './AuxVM';
import { Portal, PortalBundler } from './PortalBundler';
import { PortalEvent } from './PortalEvents';

export interface AuxChannelOptions {}

export abstract class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _runtime: AuxRuntime;
    protected _config: AuxConfig;
    protected _options: AuxChannelOptions;
    protected _subs: SubscriptionLike[];
    protected _deviceInfo: DeviceInfo;
    protected _partitionEditModeProvider: AuxPartitionRealtimeEditModeProvider;
    protected _partitions: AuxPartitions;
    private _statusHelper: StatusHelper;
    private _hasRegisteredSubs: boolean;
    private _eventBuffer: BotAction[];
    private _hasInitialState: boolean;
    private _version: RuntimeStateVersion;

    private _user: AuxUser;
    private _onLocalEvents: Subject<LocalActions[]>;
    private _onDeviceEvents: Subject<DeviceAction[]>;
    private _onStateUpdated: Subject<StateUpdatedEvent>;
    private _onVersionUpdated: Subject<RuntimeStateVersion>;
    private _onConnectionStateChanged: Subject<StatusUpdate>;
    private _onPortalEvent: Subject<PortalEvent[]>;
    private _onError: Subject<AuxChannelErrorType>;
    private _portalBundler: PortalBundler;

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

    get onPortalEvents() {
        return this._onPortalEvent;
    }

    get onError() {
        return this._onError;
    }

    get helper() {
        return this._helper;
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
        this._onPortalEvent = new Subject();
        this._onError = new Subject<AuxChannelErrorType>();
        this._portalBundler = new PortalBundler();
        this._eventBuffer = [];
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

        this._portalBundler.onBundleUpdated.subscribe(
            (bundle) => {
                this._onPortalEvent.next([
                    {
                        type: 'update_portal_source',
                        portalId: bundle.portalId,
                        source: bundle.source,
                    },
                ]);
                // TODO: Update portal warnings/errors
            },
            (err) => {
                this._onError.next({
                    type: 'general',
                    message: err.toString(),
                });
            }
        );

        addDebugApi('getChannel', () => this);
    }

    async init(
        onLocalEvents?: (events: LocalActions[]) => void,
        onDeviceEvents?: (events: DeviceAction[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onVersionUpdated?: (version: RuntimeStateVersion) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onPortalEvents?: (events: PortalEvent[]) => void,
        onError?: (err: AuxChannelErrorType) => void
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
        if (onPortalEvents) {
            this.onPortalEvents.subscribe((e) => onPortalEvents(e));
        }
        if (onDeviceEvents) {
            this.onDeviceEvents.subscribe((e) => onDeviceEvents(e));
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
        onPortalEvents?: (events: PortalEvent[]) => void,
        onError?: (err: AuxChannelErrorType) => void
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
            onPortalEvents,
            onError
        );
        await promise;
    }

    private async _init(): Promise<void> {
        this._handleStatusUpdated({
            type: 'progress',
            message: 'Creating causal tree...',
            progress: 0.1,
        });

        this._partitions = <any>{};
        this._partitionEditModeProvider = new AuxPartitionRealtimeEditModeProvider(
            this._partitions
        );
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

        return {
            actions: result.actions,
            results: await Promise.all(result.results),
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
            this._registerStateSubscriptionsForPartition(partition);
        }
    }

    protected _registerStateSubscriptionsForPartition(partition: AuxPartition) {
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
                        this._handleStateUpdated(this._runtime.stateUpdated(e));
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            partition.onVersionUpdated
                .pipe(
                    tap((v) => {
                        this._version = this._runtime.versionUpdated(v);
                        this._onVersionUpdated.next(this._version);
                    })
                )
                .subscribe(null, (e: any) => console.error(e))
        );
    }

    protected async _ensureSetup() {
        // console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);
        if (!this._runtime) {
            this._partitions;
            this._runtime = this._createRuntime();
            this._subs.push(this._runtime);
        }
        if (!this._helper) {
            this._helper = this._createAuxHelper();
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
        await this._initUserDimensionBot();

        if (!this._hasRegisteredSubs) {
            this._hasRegisteredSubs = true;
            this._registerSubscriptions();
        }

        await this._initBuilderBots();

        if (!this._checkAccessAllowed()) {
            this._onConnectionStateChanged.next({
                type: 'authorization',
                authorized: false,
                reason: 'unauthorized',
            });
            return;
        }

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
        this._portalBundler.stateUpdated(event);
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
            } else if (event.type === 'register_custom_portal') {
                this._registerCustomPortal(event);
            } else if (event.type === 'add_entry_point') {
                this._addEntryPoint(event);
            }
        }
        this._onLocalEvents.next(e);
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
            this._registerStateSubscriptionsForPartition(partition);
        }
    }

    protected async _registerCustomPortal(
        event: RegisterCustomPortalAction
    ): Promise<void> {
        try {
            const options: RegisterCustomPortalOptions = {
                scriptPrefixes:
                    event.options.scriptPrefixes ||
                    DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES,
                style: event.options.style || {},
            };
            this._portalBundler.registerCustomPortal(event.portalId, options);
            this._onPortalEvent.next([
                {
                    type: 'register_portal',
                    portalId: event.portalId,
                    options: options,
                },
            ]);
            console.log(
                `[BaseAuxChannel] Portal ${event.portalId} registered!`
            );
            await this._helper.transaction(asyncResult(event.taskId, null));
        } catch (err) {
            await this._helper.transaction(asyncError(event.taskId, err));
        }
    }

    protected async _addEntryPoint(event: AddEntryPointAction) {
        try {
            this._portalBundler.addEntryPoint(event.portalId, event);
            await this._helper.transaction(asyncResult(event.taskId, null));
        } catch (err) {
            await this._helper.transaction(asyncError(event.taskId, err));
        }
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

    private async _initUserDimensionBot() {
        try {
            await this._helper.createOrUpdateUserDimensionBot();
        } catch (err) {
            console.error(
                '[BaseAuxChannel] Unable to init user dimension bot:',
                err
            );
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
