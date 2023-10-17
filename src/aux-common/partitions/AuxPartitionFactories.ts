import { PartitionConfig } from './AuxPartitionConfig';
import { AuxPartition, MemoryPartition } from './AuxPartition';
import { BotsState, BotAction, Bot, UpdatedBot } from '../bots';
import { Observable, Subject } from 'rxjs';
import { PartitionAuthSource } from './PartitionAuthSource';

export interface AuxPartitionServices {
    /**
     * The auth source that should be used for the partition, if needed.
     */
    authSource?: PartitionAuthSource;
}

export type AuxPartitionFactory = (
    config: PartitionConfig,
    services: AuxPartitionServices
) => Promise<AuxPartition> | AuxPartition;

/**
 * Creates an AUX Partition from the given list of factory functions.
 * The first factory function that returns a partition is the partition
 * that gets returned.
 * @param config The config which indicates the type of partition to create.
 * @param services The services which should be used by the partitions.
 * @param factories The factory functions.
 */
export async function createAuxPartition(
    config: PartitionConfig,
    services: AuxPartitionServices,
    ...factories: AuxPartitionFactory[]
): Promise<AuxPartition> {
    for (let factory of factories) {
        let result = await factory(config, services);
        if (result) {
            return result;
        }
    }

    return undefined;
}
