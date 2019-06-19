import {
    LocalEvents,
    FileEvent,
    PrecalculatedFilesState,
    UpdatedFile,
    Action,
    PrecalculatedFilesState,
} from '@casual-simulation/aux-common';
import { Observable } from 'rxjs';
import { proxy } from 'comlink';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { Initable } from '../managers';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 */
export interface AuxVM extends Initable {
    /**
     * The ID of the simulation that the VM is running.
     */
    id: string;

    /**
     * Gets the observable list of local events from the simulation.
     */
    localEvents: Observable<LocalEvents[]>;

    /**
     * Gets the observable list of state updates from the simulation.
     */
    stateUpdated: Observable<StateUpdatedEvent>;

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    sendEvents(events: FileEvent[]): Promise<void>;

    /**
     * Runs the given list of formulas as actions in a batch.
     * @param formulas The formulas to run.
     */
    formulaBatch(formulas: string[]): Promise<void>;
}
