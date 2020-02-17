import { PartitionConfig } from './AuxPartitionConfig';
import { AuxPartition, MemoryPartition } from './AuxPartition';
import {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';

export type AuxPartitionFactory = (
    config: PartitionConfig
) => Promise<AuxPartition> | AuxPartition;

/**
 * Creates an AUX Partition from the given list of factory functions.
 * The first factory function that returns a partition is the partition
 * that gets returned.
 * @param config The config which indicates the type of partition to create.
 * @param factories The factory functions.
 */
export async function createAuxPartition(
    config: PartitionConfig,
    ...factories: AuxPartitionFactory[]
): Promise<AuxPartition> {
    for (let factory of factories) {
        let result = await factory(config);
        if (result) {
            return result;
        }
    }

    return undefined;
}
