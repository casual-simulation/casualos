/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { PartitionConfig } from './AuxPartitionConfig';
import type { AuxPartition } from './AuxPartition';
import type { PartitionAuthSource } from './PartitionAuthSource';

export interface AuxPartitionServices {
    /**
     * The auth source that should be used for the partition, if needed.
     */
    authSource: PartitionAuthSource;
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
