import { Observable, Subject, BehaviorSubject } from 'rxjs';
import {
    LocalEvents,
    FileEvent,
    AuxCausalTree,
    AuxOp,
} from '@casual-simulation/aux-common';
import {
    StateUpdatedEvent,
    AuxConfig,
    AuxVM,
    AuxHelper,
} from '@casual-simulation/aux-vm';
import {
    RealtimeChannel,
    StoredCausalTree,
    LoadingProgressCallback,
} from '@casual-simulation/causal-trees';
import { VM2Sandbox } from './VM2Sandbox';

export class AuxVMNode implements AuxVM {
    private _connectionStateChanged: BehaviorSubject<boolean>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _helper: AuxHelper;
    private _config: AuxConfig;
    private _tree: AuxCausalTree;

    id: string;

    get localEvents(): Observable<LocalEvents[]> {
        return this._helper.localEvents;
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
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._connectionStateChanged = new BehaviorSubject<boolean>(true);
    }

    sendEvents(events: FileEvent[]): Promise<void> {
        return this._helper.transaction(...events);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._helper.formulaBatch(formulas);
    }

    async search(search: string): Promise<any> {
        return this._helper.search(search);
    }

    forkAux(newId: string): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._helper.exportFiles(fileIds);
    }

    async exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._tree.export();
    }

    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        this._helper = new AuxHelper(
            this._tree,
            this._config.user.id,
            this._config.config,
            lib => new VM2Sandbox(lib)
        );
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._stateUpdated.unsubscribe();
        this._stateUpdated = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
    }

    closed: boolean;
}
