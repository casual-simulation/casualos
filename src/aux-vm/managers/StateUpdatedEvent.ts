import { PrecalculatedFilesState } from '@casual-simulation/aux-common';

/**
 * Defines an event for state updates from the VM.
 */
export interface StateUpdatedEvent {
    /**
     * The new state.
     */
    state: PrecalculatedFilesState;

    /**
     * The list of File IDs that were added.
     */
    addedFiles: string[];

    /**
     * The list of File IDs that were removed.
     */
    removedFiles: string[];

    /**
     * The list of File IDs that were updated.
     */
    updatedFiles: string[];
}
