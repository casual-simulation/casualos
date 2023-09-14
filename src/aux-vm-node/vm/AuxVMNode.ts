import {
    AuxVM,
    AuxChannelErrorType,
    ChannelActionResult,
    AuxSubVM,
    AuxChannel,
    AuxSubChannel,
} from '@casual-simulation/aux-vm';
import { Observable, Subject } from 'rxjs';
import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    LoadingProgressCallback,
    StatusUpdate,
    DeviceAction,
} from '@casual-simulation/aux-common';
import { AuxUser, BaseAuxChannel } from '@casual-simulation/aux-vm';
import {
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';

export class AuxVMNode implements AuxVM {
    private _channel: AuxChannel;
    private _localEvents: Subject<RuntimeActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;
    private _subVMAdded: Subject<AuxSubVM>;
    private _subVMRemoved: Subject<AuxSubVM>;
    private _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: AuxChannel;
        }
    >;

    id: string;

    get localEvents(): Observable<RuntimeActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    get channel() {
        return this._channel;
    }

    constructor(channel: AuxChannel) {
        this._channel = channel;
        this._localEvents = new Subject<RuntimeActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
    }

    setUser(user: AuxUser): Promise<void> {
        return this._channel.setUser(user);
    }

    setGrant(grant: string): Promise<void> {
        return this._channel.setGrant(grant);
    }

    sendEvents(events: BotAction[]): Promise<void> {
        return this._channel.sendEvents(events);
    }

    shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        return this._channel.shout(eventName, botIds, arg);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._channel.formulaBatch(formulas);
    }

    forkAux(newId: string): Promise<void> {
        return this._channel.forkAux(newId);
    }

    exportBots(botIds: string[]): Promise<StoredAux> {
        return this._channel.exportBots(botIds);
    }

    export(): Promise<StoredAux> {
        return this._channel.export();
    }

    getTags(): Promise<string[]> {
        return this._channel.getTags();
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        return await this._channel.initAndWait(
            (e) => this._localEvents.next(e),
            (e) => this._deviceEvents.next(e),
            (state) => this._stateUpdated.next(state),
            (version) => this._versionUpdated.next(version),
            (connection) => this._connectionStateChanged.next(connection),
            (err) => this._onError.next(err),
            (channel) => this._handleAddedSubChannel(channel),
            (id) => this._handleRemovedSubChannel(id)
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;

    protected _createSubVM(channel: AuxChannel): AuxVM {
        return new AuxVMNode(channel);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, user } = await subChannel.getInfo();
        const channel = await subChannel.getChannel();

        const subVM = {
            id,
            user,
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
