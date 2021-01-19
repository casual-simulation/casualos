import {
    AuxVM,
    AuxChannelErrorType,
    StoredAux,
    ChannelActionResult,
} from '@casual-simulation/aux-vm';
import { Observable, Subject } from 'rxjs';
import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    RuntimeStateVersion,
} from '@casual-simulation/aux-common';
import {
    LoadingProgressCallback,
    StatusUpdate,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import { AuxUser, BaseAuxChannel } from '@casual-simulation/aux-vm';

export class AuxVMNode implements AuxVM {
    private _channel: BaseAuxChannel;
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;

    id: string;

    get localEvents(): Observable<LocalActions[]> {
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

    get channel() {
        return this._channel;
    }

    constructor(channel: BaseAuxChannel) {
        this._channel = channel;
        this._localEvents = new Subject<LocalActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
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
            (err) => this._onError.next(err)
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;

    registerCustomPortal(id: string, source: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
