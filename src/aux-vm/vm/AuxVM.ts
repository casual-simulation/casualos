import { LocalEvents, FileEvent, AuxOp } from '@casual-simulation/aux-common';
import {
    StoredCausalTree,
    StatusUpdate,
    DeviceEvent,
} from '@casual-simulation/causal-trees';
import { Observable } from 'rxjs';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { Initable } from '../managers/Initable';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { AuxUser } from '../AuxUser';
import { FileDependentInfo } from '../managers/DependencyManager';

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
     * Gets the observable list of device events from the simulation.
     */
    deviceEvents: Observable<DeviceEvent[]>;

    /**
     * Gets the observable list of state updates from the simulation.
     */
    stateUpdated: Observable<StateUpdatedEvent>;

    /**
     * Gets an observable that resolves whenever the connection state changes.
     */
    connectionStateChanged: Observable<StatusUpdate>;

    /**
     * Gets an observable that resolves whenever an error occurs inside the VM.
     */
    onError: Observable<AuxChannelErrorType>;

    /**
     * Sets the user that the VM should be using.
     * @param user The user.
     */
    setUser(user: AuxUser): Promise<void>;

    /**
     * Sets the authentication grant that should be used for the user.
     * @param grant The grant to use.
     */
    setGrant(grant: string): Promise<void>;

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

    /**
     * Runs a search on the files state.
     * @param search The search.
     */
    search(search: string): Promise<any>;

    /**
     * Forks the current AUX into the channel with the given ID.
     * @param newId The ID of the new AUX>
     */
    forkAux(newId: string): Promise<void>;

    /**
     * Exports the atoms for the given files.
     * @param fileIds The files to export.
     */
    exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>>;

    /**
     * Exports the causal tree for the simulation.
     */
    exportTree(): Promise<StoredCausalTree<AuxOp>>;

    /**
     * Gets the list of references to the given tag.
     * @param tag The tag to look for references to.
     */
    getReferences(tag: string): Promise<FileDependentInfo>;

    /**
     * Gets the list of tags that are currently in use.
     */
    getTags(): Promise<string[]>;
}
