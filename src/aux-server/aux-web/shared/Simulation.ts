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
} from '@casual-simulation/aux-common';
import FileWatcher from './FileWatcher';
import { RecentFilesManager } from './RecentFilesManager';
import SelectionManager from './SelectionManager';
import { FileHelper } from './FileHelper';
import { Observable } from 'rxjs';
import { LoadingProgressCallback } from '@casual-simulation/aux-common/LoadingProgress';
import FilePanelManager from './FilePanelManager';

/**
 * Defines an interface for objects that represent file simulations.
 */
export interface Simulation {
    /**
     * Gets the ID of the simulation that is currently being used.
     */
    id: string;

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
     * Gets the realtime causal tree that the file manager is using.
     */
    aux: RealtimeAuxTree;

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
     * Initializes the file manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(
        id: string,
        force: boolean,
        loadingCallback: LoadingProgressCallback,
        config: { isBuilder: boolean; isPlayer: boolean }
    ): Promise<string>;

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
}
