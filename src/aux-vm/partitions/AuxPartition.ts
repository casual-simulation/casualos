import {
    AuxCausalTree,
    BotsState,
    BotAction,
    merge,
    Bot,
    UpdatedBot,
} from '@casual-simulation/aux-common';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';

/**
 * Defines an interface that maps Bot IDs to their corresponding partitions.
 */
export interface AuxPartitions {
    '*': AuxPartition;
    [key: string]: AuxPartition;
}

/**
 * Defines a set of valid partition types.
 */
export type AuxPartition = CausalTreePartition | MemoryPartition;

/**
 * Base interface for partitions.
 *
 * Partitions are basically a backing store for Aux State.
 * They allow working on and manipulating bots that are stored in multiple different places.
 */
export interface AuxPartitionBase {
    /**
     * Applies the given events to the partition.
     * @param events The events to apply.
     */
    applyEvents(events: BotAction[]): Promise<void>;

    /**
     * Gets an observable list that resolves whenever
     * a bot is added to this partition.
     */
    onBotsAdded: Observable<Bot[]>;

    /**
     * Gets an observable list that resolves whenever
     * a bot is removed from this partition.
     */
    onBotsRemoved: Observable<string[]>;

    /**
     * Gets an observable list that resolves whenever
     * a bot is updated in this partition.
     */
    onBotsUpdated: Observable<UpdatedBot[]>;

    /**
     * Gets an observable list of errors from the partition.
     */
    onError: Observable<any>;
}

/**
 * Defines a causal tree partition.
 */
export interface CausalTreePartition extends AuxPartitionBase {
    type: 'causal_tree';

    /**
     * The causal tree for the partition.
     */
    tree: AuxCausalTree;
}

/**
 * Defines a remote causal tree partition.
 * That is, a causal tree partition that was loaded from a remote server.
 */
export interface RemoteCausalTreePartition extends CausalTreePartition {
    /**
     * The realtime causal tree that represents the partition connnection.
     */
    sync: RealtimeCausalTree<AuxCausalTree>;
}

/**
 * Defines a memory partition.
 */
export interface MemoryPartition extends AuxPartitionBase {
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
export function getPartitionState(partition: AuxPartition): BotsState {
    if (partition.type === 'causal_tree') {
        return partition.tree.value;
    } else {
        return partition.state;
    }
}

export async function applyEvents(
    partition: AuxPartition,
    events: BotAction[]
): Promise<void> {
    if (partition.type === 'causal_tree') {
        await partition.tree.addEvents(events);
    } else {
    }
}
