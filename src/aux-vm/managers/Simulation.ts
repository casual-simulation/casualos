import {
    FilesState,
    AuxCausalTree,
    RealtimeAuxTree,
    File,
    AuxState,
    AuxObject,
    FileEvent,
    UserMode,
    FileCalculationContext,
    PartialFile,
    SimulationIdParseSuccess,
    LocalEvents,
    AuxOp,
} from '@casual-simulation/aux-common';
import { FileWatcher } from './FileWatcher';
import { RecentFilesManager } from './RecentFilesManager';
import SelectionManager from './SelectionManager';
import { Observable } from 'rxjs';
import {
    LoadingProgressCallback,
    StoredCausalTree,
} from '@casual-simulation/causal-trees';
import { FilePanelManager } from './FilePanelManager';
import { Initable } from './Initable';
import { FileHelper } from './FileHelper';
import { ConnectionManager } from './ConnectionManager';

/**
 * Defines an interface for objects that represent file simulations.
 */
export interface Simulation extends Initable {
    /**
     * Gets the ID of the simulation that is currently being used.
     */
    id: string;

    /**
     * Gets the parsed ID of the simulation.
     */
    parsedId: SimulationIdParseSuccess;

    /**
     * Gets whether the app is connected to the server but may
     * or may not be synced to the serer.
     */
    isOnline: boolean;

    /**
     * Gets whether the app is synced to the server.
     */
    isSynced: boolean;

    /**
     * Gets the file helper.
     */
    helper: FileHelper;

    /**
     * Gets the selection manager.
     */
    selection: SelectionManager;

    /**
     * Gets the recent files manager.
     */
    recent: RecentFilesManager;

    /**
     * Gets the file watcher.
     */
    watcher: FileWatcher;

    /**
     * Gets the files panel manager.
     */
    filePanel: FilePanelManager;

    /**
     * Gets the manager in charge of the server connection status.
     */
    connection: ConnectionManager;

    /**
     * Gets the observable list of events that should have an effect on the UI.
     */
    localEvents: Observable<LocalEvents>;

    /**
     * Sets the file mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode): Promise<void>;

    // TODO: This seems like a pretty dangerous function to keep around,
    // but we'll add a config option to prevent this from happening on real sites.
    deleteEverything(): Promise<void>;

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    forkAux(forkName: string): Promise<void>;

    /**
     * Exports the atoms for the given files.
     * @param fileIds The files to export.
     */
    exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>>;
}
