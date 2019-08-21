import { LocalEvents, FileEvent, AuxOp } from '@casual-simulation/aux-common';
import {
    StoredCausalTree,
    StatusUpdate,
    DeviceEvent,
} from '@casual-simulation/causal-trees';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { AuxConfig } from './AuxConfig';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { AuxUser } from '../AuxUser';
import { Observable } from 'rxjs';
import { FileDependentInfo } from '../managers/DependencyManager';

/**
 * Defines an interface for the static members of an AUX.
 */
export interface AuxStatic {
    /**
     * Creates a new AUX using the given config.
     */
    new (defaultHost: string, user: AuxUser, config: AuxConfig): AuxChannel;
}

/**
 * Defines an interface for an AUX.
 * That is, a channel that interfaces with the AUX file format in realtime.
 */
export interface AuxChannel {
    /**
     * The observable that should be triggered whenever a device event is sent to the AUX.
     */
    onDeviceEvents: Observable<DeviceEvent[]>;

    /**
     * The observable that should be triggered whenever a local event is emitted from the AUX.
     */
    onLocalEvents: Observable<LocalEvents[]>;

    /**
     * The observable that should be triggered whenever the files state is updated.
     */
    onStateUpdated: Observable<StateUpdatedEvent>;

    /**
     * The observable that should be triggered whenever the connection state changes.
     */
    onConnectionStateChanged: Observable<StatusUpdate>;

    /**
     * The observable that is resolved whenever an error occurs.
     */
    onError: Observable<AuxChannelErrorType>;

    /**
     * Initializes the AUX.
     * @param onLocalEvents The callback that should be triggered whenever a local event is emitted from the AUX.
     * @param onDeviceEvents The callback that should be triggered whenever a device event it emitted from the AUX.
     * @param onStateUpdated The callback that should be triggered whenever the files state is updated.
     * @param onConnectionStateChanged The callback that should be triggered whenever the connection state changes.
     * @param onError The callback that should be triggered whenever an error occurs.
     */
    init(
        onLocalEvents?: (events: LocalEvents[]) => void,
        onDeviceEvents?: (events: DeviceEvent[]) => void,
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged?: (state: StatusUpdate) => void,
        onError?: (err: AuxChannelErrorType) => void
    ): Promise<void>;

    /**
     * Sets the user that the channel should use.
     * @param user The user.
     */
    setUser(user: AuxUser): Promise<void>;

    /**
     * Sets the grant that the channel should use to authenticate the user.
     * @param grant The grant to use.
     */
    setGrant(grant: string): Promise<void>;

    /**
     * Sends the given list of files events to the AUX for processing.
     * @param events The events.
     */
    sendEvents(events: FileEvent[]): Promise<void>;

    /**
     * Runs the given list of formulas.
     * @param formulas The formulas.
     */
    formulaBatch(formulas: string[]): Promise<void>;

    /**
     * Runs a search on the files state.
     * @param search The search.
     */
    search(search: string): Promise<any>;

    /**
     * Forks the AUX into the channel with the given ID.
     * @param newId The ID that the new AUX should have.
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
     * @param tag The tag.
     */
    getReferences(tag: string): Promise<FileDependentInfo>;
}
