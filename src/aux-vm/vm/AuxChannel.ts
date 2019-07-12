import { LocalEvents, FileEvent, AuxOp } from '@casual-simulation/aux-common';
import {
    LoadingProgressCallback,
    StoredCausalTree,
    StatusUpdate,
} from '@casual-simulation/causal-trees';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { AuxConfig } from './AuxConfig';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { InitError } from '../managers/Initable';
import { AuxUser } from '../AuxUser';

/**
 * Defines an interface for the static members of an AUX.
 */
export interface AuxStatic {
    /**
     * Creates a new AUX using the given config.
     */
    new (defaultHost: string, config: AuxConfig): AuxChannel;
}

/**
 * Defines an interface for an AUX.
 * That is, a channel that interfaces with the AUX file format in realtime.
 */
export interface AuxChannel {
    /**
     * Initializes the AUX.
     * @param onLocalEvents The callback that should be triggered whenever a local event is emitted from the AUX.
     * @param onStateUpdated The callback that should be triggered whenever the files state is updated.
     * @param onConnectionStateChanged The callback that should be triggered whenever the connection state changes.
     * @param onError The callback that should be triggered whenever an error occurs.
     * @param loadingCallback The callback that should be triggered for loading progress.
     */
    init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged: (state: StatusUpdate) => void,
        onError: (err: AuxChannelErrorType) => void
    ): Promise<InitError>;

    /**
     * Sets the user that the channel should use.
     * @param user The user.
     */
    setUser(user: AuxUser): Promise<void>;

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
}
