import { Observable, Subject, BehaviorSubject } from 'rxjs';
import {
    LocalEvents,
    FileEvent,
    AuxCausalTree,
    AuxOp,
    fileChangeObservables,
} from '@casual-simulation/aux-common';
import {
    RealtimeChannel,
    StoredCausalTree,
    LoadingProgressCallback,
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import {
    StateUpdatedEvent,
    AuxConfig,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;

    id: string;

    constructor(tree: AuxCausalTree, config: AuxConfig) {
        super(config);
        this._tree = tree;
    }

    protected async _initRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(this._tree);
    }
}
