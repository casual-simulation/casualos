import { AuxCausalTree } from '@casual-simulation/aux-common';
import {
    LocalRealtimeCausalTree,
    RealtimeCausalTree,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    // AuxChannel
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';
import { AuxHelper } from '@casual-simulation/aux-vm/vm';
import { VM2Sandbox } from './VM2Sandbox';

export class NodeAuxChannel extends BaseAuxChannel {
    private _tree: AuxCausalTree;

    constructor(tree: AuxCausalTree, config: AuxConfig) {
        super(config);
        this._tree = tree;
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(this._tree);
    }

    protected _createAuxHelper() {
        return new AuxHelper(
            this._aux.tree,
            this._config.config,
            lib => new VM2Sandbox(lib)
        );
    }

    protected async _createGlobalsFile() {
        await super._createGlobalsFile();

        if (this._config.id === 'aux-admin') {
            const globals = this.helper.globalsFile;

            await this.helper.updateFile(globals, {
                tags: {
                    'aux.whitelist.roles': [ADMIN_ROLE],
                },
            });
        }
    }
}
