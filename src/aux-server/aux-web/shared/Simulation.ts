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
} from '@casual-simulation/aux-common';
import FileWatcher from './FileWatcher';
import { RecentFilesManager } from './RecentFilesManager';
import SelectionManager from './SelectionManager';
import { FileHelper } from './FileHelper';
import { Observable } from 'rxjs';
import { LoadingProgressCallback } from '@casual-simulation/aux-common/LoadingProgress';

/**
 * Defines an interface for objects that represent file simulations.
 */
export interface Simulation {
    addState(state: FilesState): Promise<void>;
    action(eventName: string, files: File[], arg?: any): Promise<void>;

    /**
     * Gets the ID of the simulation that is currently being used.
     */
    id: string;

    /**
     * Gets all the files that represent an object.
     */
    objects: AuxObject[];

    /**
     * Gets all of the available tags.
     */
    tags: string[];

    /**
     * Gets all the selected files that represent an object.
     */
    selectedObjects: File[];

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    filesDiscovered: Observable<AuxObject[]>;

    /**
     * Gets an observable that resolves whenever a file is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the file or by deleting it.
     */
    filesRemoved: Observable<string[]>;

    /**
     * Gets an observable that resolves whenever a file is updated.
     */
    filesUpdated: Observable<AuxObject[]>;

    status: string;

    /**
     * Gets the file for the current user.
     */
    userFile: AuxObject;

    /**
     * Gets the globals file.
     */
    globalsFile: AuxObject;

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
     * Gets the observable that resolves whenever the connection state changes.
     */
    connectionStateChanged: Observable<boolean>;

    /**
     * Gets the current local file state.
     */
    filesState: AuxState;

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
    filePanel: any;

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

    /**
     * Sets the file that is currently being edited by the current user.
     * @param file The file.
     */
    setEditedFile(file: AuxObject): void;

    /**
     * Calculates the nicely formatted value for the given file and tag.
     * @param file The file to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(file: Object, tag: string): string;

    calculateFileValue(file: Object, tag: string): any;

    /**
     * Removes the given file.
     * @param file The file to remove.
     */
    removeFile(file: AuxObject): Promise<void>;

    /**
     * Updates the given file with the given data.
     */
    updateFile(file: AuxObject, newData: PartialFile): Promise<void>;

    createFile(id?: string, tags?: File['tags']): Promise<void>;

    createWorkspace(
        builderContextId?: string,
        contextFormula?: string,
        label?: string
    ): Promise<void>;

    transaction(...events: FileEvent[]): Promise<void>;

    // TODO: This seems like a pretty dangerous function to keep around,
    // but we'll add a config option to prevent this from happening on real sites.
    deleteEverything(): Promise<void>;

    /**
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: File): Observable<File>;

    /**
     * Creates a new FileCalculationContext from the current state.
     */
    createContext(): FileCalculationContext;

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    forkAux(forkName: string): Promise<void>;
}
