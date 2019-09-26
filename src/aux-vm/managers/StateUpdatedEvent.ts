import { PrecalculatedFilesState } from '@casual-simulation/aux-common';

/**
 * Defines an event for state updates from the VM.
 */
export interface StateUpdatedEvent {
    /**
     * The state that was updated. This is a partial precalculated files state instance,
     * so it must be merged with the previous version to get the full updated file state.
     *
     * You can use the merge() function from aux-common or lodash to do this.
     */
    state: Partial<PrecalculatedFilesState>;

    /**
     * The list of Bot IDs that were added.
     */
    addedFiles: string[];

    /**
     * The list of Bot IDs that were removed.
     */
    removedFiles: string[];

    /**
     * The list of Bot IDs that were updated.
     */
    updatedFiles: string[];
}
