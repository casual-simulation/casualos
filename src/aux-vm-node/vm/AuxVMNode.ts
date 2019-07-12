import {
    AuxVM,
    StateUpdatedEvent,
    AuxConfig,
    AuxChannelErrorType,
    InitError,
} from '@casual-simulation/aux-vm';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import {
    LocalEvents,
    FileEvent,
    AuxOp,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import {
    StoredCausalTree,
    LoadingProgressCallback,
    StatusUpdate,
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from './NodeAuxChannel';
import { AuxUser } from '@casual-simulation/aux-vm/AuxUser';

export class AuxVMNode implements AuxVM {
    private _channel: NodeAuxChannel;
    private _localEvents: Subject<LocalEvents[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _onError: Subject<AuxChannelErrorType>;

    id: string;

    get localEvents(): Observable<LocalEvents[]> {
        return this._localEvents;
    }

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    constructor(tree: AuxCausalTree, user: AuxUser, config: AuxConfig) {
        this._channel = new NodeAuxChannel(tree, user, config);
        this._localEvents = new Subject<LocalEvents[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
    }

    setUser(user: AuxUser): Promise<void> {
        return this._channel.setUser(user);
    }

    sendEvents(events: FileEvent[]): Promise<void> {
        return this._channel.sendEvents(events);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._channel.formulaBatch(formulas);
    }

    search(search: string): Promise<any> {
        return this._channel.search(search);
    }

    forkAux(newId: string): Promise<void> {
        return this._channel.forkAux(newId);
    }

    exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._channel.exportFiles(fileIds);
    }

    exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._channel.exportTree();
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<InitError> {
        return await this._channel.init(
            e => this._localEvents.next(e),
            state => this._stateUpdated.next(state),
            connection => this._connectionStateChanged.next(connection),
            err => this._onError.next(err)
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;
}
