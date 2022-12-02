import {
    LocalActions,
    StateUpdatedEvent,
    RuntimeStateVersion,
    BotAction,
} from '@casual-simulation/aux-common';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';
import {
    AuxChannel,
    AuxChannelErrorType,
    AuxConfig,
    AuxSubChannel,
    AuxSubVM,
    AuxVM,
    ChannelActionResult,
} from '@casual-simulation/aux-vm/vm';
import {
    DeviceAction,
    remapProgressPercent,
    StatusUpdate,
} from '@casual-simulation/causal-trees';
import { Observable, Subject } from 'rxjs';
import { proxy, Remote, createEndpoint } from 'comlink';
import { StoredAux } from '@casual-simulation/aux-vm/StoredAux';

/**
 * Defines a VM that is able to wrap a remote aux channel.
 */
export class RemoteAuxVM implements AuxVM {
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _onError: Subject<AuxChannelErrorType>;
    private _subVMAdded: Subject<AuxSubVM>;
    private _subVMRemoved: Subject<AuxSubVM>;
    private _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: Remote<AuxChannel>;
        }
    >;

    private _proxy: Remote<AuxChannel>;

    closed: boolean;

    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Creates a new Simulation VM.
     */
    constructor(channel: Remote<AuxChannel>) {
        this._localEvents = new Subject<LocalActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
    }

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    /**
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        return await this._init();
    }

    private async _init(): Promise<void> {
        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.init(
            proxy((events) => this._localEvents.next(events)),
            proxy((events) => this._deviceEvents.next(events)),
            proxy((state) => this._stateUpdated.next(state)),
            proxy((version) => this._versionUpdated.next(version)),
            proxy((state) =>
                this._connectionStateChanged.next(statusMapper(state))
            ),
            proxy((err) => this._onError.next(err)),
            proxy((channel) =>
                this._handleAddedSubChannel(
                    channel as unknown as Remote<AuxSubChannel>
                )
            ),
            proxy((id) => this._handleRemovedSubChannel(id))
        );
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<LocalActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    /**
     * The observable list of bot state updates from this simulation.
     */
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
    }

    async setUser(user: AuxUser): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setUser(user);
    }

    async setGrant(grant: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setGrant(grant);
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.sendEvents(events);
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * Returns the results from the event.
     * @param eventName The name of the event.
     * @param botIds The IDs of the bots that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        if (!this._proxy) return null;
        return await this._proxy.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.export();
    }

    async getTags(): Promise<string[]> {
        if (!this._proxy) return null;
        return await this._proxy.getTags();
    }

    /**
     * Gets a new endpoint for the aux channel.
     * Can then be used with a ConnectableAuxVM.
     */
    createEndpoint(): Promise<MessagePort> {
        return this._proxy[createEndpoint]();
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._proxy = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    protected _createSubVM(channel: Remote<AuxChannel>): AuxVM {
        return new RemoteAuxVM(channel);
    }

    private async _handleAddedSubChannel(subChannel: Remote<AuxSubChannel>) {
        const id = await subChannel.id;
        const channel =
            (await subChannel.channel) as unknown as Remote<AuxChannel>;

        const subVM = {
            id: id,
            vm: this._createSubVM(channel),
            channel,
        };

        this._subVMMap.set(id, subVM);
        this._subVMAdded.next(subVM);
    }

    private async _handleRemovedSubChannel(channelId: string) {
        const vm = this._subVMMap.get(channelId);
        if (vm) {
            this._subVMMap.delete(channelId);
            this._subVMRemoved.next(vm);
        }
    }
}
