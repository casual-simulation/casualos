import { AuxVM, AuxHelper } from '@casual-simulation/aux-vm/vm';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import {
    LocalEvents,
    FileEvent,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import { StateUpdatedEvent, AuxConfig } from '@casual-simulation/aux-vm';
import {
    RealtimeChannel,
    StoredCausalTree,
    LoadingProgressCallback,
} from '@casual-simulation/causal-trees';

export class AuxVMNode implements AuxVM {
    private _localEvents: Subject<LocalEvents[]>;
    private _connectionStateChanged: BehaviorSubject<boolean>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _helper: AuxHelper;
    private _config: AuxConfig;
    private _tree: AuxCausalTree;

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
        this._config = config;
        this._tree = tree;
        this._localEvents = new Subject<LocalEvents[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new BehaviorSubject<boolean>(true);
    }

    sendEvents(events: FileEvent[]): Promise<void> {
        throw new Error('Method not implemented.');
    }

    formulaBatch(formulas: string[]): Promise<void> {
        throw new Error('Method not implemented.');
    }

    search(search: string): Promise<any> {
        throw new Error('Method not implemented.');
    }

    forkAux(newId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }

    exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        throw new Error('Method not implemented.');
    }

    exportTree(): Promise<StoredCausalTree<AuxOp>> {
        throw new Error('Method not implemented.');
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        this._helper = new AuxHelper(
            this._tree,
            this._config.user.id,
            this._config.config,
            lib => {}
        );
    }

    unsubscribe(): void {
        throw new Error('Method not implemented.');
    }

    closed: boolean;
}
