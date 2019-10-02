import { AuxCausalTree, BotsState } from '@casual-simulation/aux-common';

/**
 * Defines a set of options for configuring partitioning of bots.
 */
export interface AuxPartitionConfig {
    '*': PartitionConfig;
    [key: string]: PartitionConfig;
}

/**
 * Defines a partition config.
 * That is, a config which specifies how to build a partition.
 */
export type PartitionConfig = CausalTreePartitionConfig | MemoryPartitionConfig;

/**
 * Defines a memory partition.
 * That is, a configuration that specifies that bots should be stored in memory.
 */
export interface MemoryPartitionConfig {
    type: 'memory';

    /**
     * The initial state for the memory partition.
     */
    initialState: BotsState;
}

/**
 * Defines a causal tree partition.
 * That is, a configuration that specifies that bots should be stored in a causal tree.
 */
export interface CausalTreePartitionConfig {
    type: 'causal_tree';

    /**
     * The ID of the tree.
     */
    id: string;

    /**
     * The host that should be connected to.
     */
    host: string;

    /**
     * The name of the tree to load.
     */
    treeName: string;
}

export interface CausalTreePartition {
    type: 'causal_tree';

    tree: AuxCausalTree;
}
