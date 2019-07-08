import { AuxVM, StateUpdatedEvent, AuxConfig } from '@casual-simulation/aux-vm';
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
} from '@casual-simulation/causal-trees';
import { NodeAuxChannel } from './NodeAuxChannel';

export class AuxVMNode implements AuxVM {
    private _channel: NodeAuxChannel;
    private _localEvents: Subject<LocalEvents[]>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _connectionStateChanged: BehaviorSubject<boolean>;

    id: string;

    get localEvents(): Observable<LocalEvents[]> {
        return this._localEvents;
    }

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    constructor(tree: AuxCausalTree, config: AuxConfig) {
        this._channel = new NodeAuxChannel(tree, config);
        this._localEvents = new Subject<LocalEvents[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new BehaviorSubject<boolean>(true);
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

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        await this._channel.init(
            e => this._localEvents.next(e),
            state => this._stateUpdated.next(state),
            connection => this._connectionStateChanged.next(connection),
            loadingCallback
        );
    }

    unsubscribe(): void {
        this.closed = true;
        this._channel.unsubscribe();
    }
    closed: boolean;
}
