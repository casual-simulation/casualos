import { AuxPartitionConfig } from '../partitions/AuxPartitionConfig';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    config: { isBuilder: boolean; isPlayer: boolean };

    /**
     * Defines the partitioning structure for bots.
     */
    partitions: AuxPartitionConfig;
}
