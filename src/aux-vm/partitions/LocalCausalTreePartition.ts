import {
    CausalTreePartitionImpl,
    CausalTreePartitionOptions,
} from './CausalTreePartition';
import {
    User,
    CausalTree,
    LocalRealtimeCausalTree,
    DeviceInfo,
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import { CausalTreePartitionConfig } from './AuxPartitionConfig';
import { AuxCausalTree } from '@casual-simulation/aux-common';
import { CausalTreePartition } from './AuxPartition';

/**
 * Creates a factory function that attempts to create a local causal tree partition that operates on the given tree.
 * @param options The options to use.
 */
export function createLocalCausalTreePartitionFactory(
    options: CausalTreePartitionOptions,
    user: User,
    device: DeviceInfo
): (config: CausalTreePartitionConfig) => Promise<CausalTreePartition> {
    return (config: CausalTreePartitionConfig) =>
        createLocalCausalTreePartition(options, user, device, config);
}

/**
 * Attempts to create a CausalTreePartition that operates on the given config.
 * @param options The options to use.
 * @param config The config to use.
 */
async function createLocalCausalTreePartition(
    options: CausalTreePartitionOptions,
    user: User,
    device: DeviceInfo,
    config: CausalTreePartitionConfig
): Promise<CausalTreePartition> {
    if (config.type === 'causal_tree') {
        const partition = new LocalCausalTreePartition(
            options,
            user,
            device,
            config
        );
        await partition.init();
        return partition;
    }
    return undefined;
}

/**
 * Defines a causal tree partition which operates on the given tree.
 */
export class LocalCausalTreePartition extends CausalTreePartitionImpl {
    private _tree: AuxCausalTree;
    private _device: DeviceInfo;

    constructor(
        options: CausalTreePartitionOptions,
        user: User,
        device: DeviceInfo,
        config: CausalTreePartitionConfig
    ) {
        super(options, user, config);
        this._tree = config.tree;
        this._device = device;
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree<AuxCausalTree>(
            this._tree,
            this._user,
            this._device,
            this._treeOptions
        );
    }
}
