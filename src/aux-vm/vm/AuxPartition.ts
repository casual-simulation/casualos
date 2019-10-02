import {
    AuxCausalTree,
    BotsState,
    BotAction,
    merge,
} from '@casual-simulation/aux-common';

/**
 * Defines a set of options for configuring partitioning of bots.
 * Bot IDs are mapped to
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

/**
 * Defines an interface that maps Bot IDs to their corresponding partitions.
 */
export interface AuxPartitions {
    '*': Partition;
    [key: string]: Partition;
}

export type Partition = CausalTreePartition | MemoryPartition;

/**
 * Defines a causal tree partition.
 */
export interface CausalTreePartition {
    type: 'causal_tree';

    /**
     * The causal tree for the partition.
     */
    tree: AuxCausalTree;
}

/**
 * Defines a memory partition.
 */
export interface MemoryPartition {
    type: 'memory';

    /**
     * The current state for the partition.
     */
    state: BotsState;
}

/**
 * Gets the bots state from the given partition.
 * @param partition The partition.
 */
export function getPartitionState(partition: Partition): BotsState {
    if (partition.type === 'causal_tree') {
        return partition.tree.value;
    } else {
        return partition.state;
    }
}

export async function applyEvents(
    partition: Partition,
    events: BotAction[]
): Promise<void> {
    if (partition.type === 'causal_tree') {
        await partition.tree.addEvents(events);
    } else {
        for (let event of events) {
            applyEventToMemoryPartition(partition, event);
        }
    }
}

export function applyEventToMemoryPartition(
    partition: MemoryPartition,
    event: BotAction
) {
    if (event.type === 'add_bot') {
        partition.state = Object.assign({}, partition.state, {
            [event.bot.id]: event.bot,
        });
    } else if (event.type === 'remove_bot') {
        let { [event.id]: removedBot, ...state } = partition.state;
        partition.state = state;
    } else if (event.type === 'update_bot') {
        partition.state = merge(partition.state, {
            [event.id]: event.update,
        });
    }
}
