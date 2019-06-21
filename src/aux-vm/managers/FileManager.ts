import {
    File,
    FileEvent,
    FilesState,
    Object,
    PartialFile,
    Workspace,
    action,
    fileChangeObservables,
    calculateActionEvents,
    addState,
    DEFAULT_USER_MODE,
    FileCalculationContext,
    AuxCausalTree,
    AuxFile,
    AuxObject,
    fileRemoved,
    UserMode,
    lerp,
    auxCausalTreeFactory,
    SimulationIdParseResult,
    parseSimulationId,
    SimulationIdParseSuccess,
    whitelistAllowsAccess,
    blacklistAllowsAccess,
    whitelistOrBlacklistAllowsAccess,
    isInUsernameList,
    getFileDesignerList,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { keys, union, values } from 'lodash';
import {
    BehaviorSubject,
    from,
    merge as mergeObservables,
    Observable,
    ReplaySubject,
    Subject,
    SubscriptionLike,
} from 'rxjs';
import {
    filter,
    map,
    startWith,
    first as rxFirst,
    flatMap,
    tap,
} from 'rxjs/operators';

import { User } from './User';
import { SocketManager } from './SocketManager';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import { RecentFilesManager } from './RecentFilesManager';
import { ProgressStatus } from '@casual-simulation/causal-trees';
import { FileWatcher } from './FileWatcher';
import { FilePanelManager } from './FilePanelManager';
import { Simulation } from './Simulation';
import { AuxVM, AuxVMImpl } from '../vm';
import { ConnectionManager } from './ConnectionManager';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager implements Simulation {
    private _user: User;
    // private _treeManager: CausalTreeManager;
    // private _socketManager: SocketManager;
    private _vm: AuxVM;
    private _helper: FileHelper;
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;
    private _watcher: FileWatcher;
    private _filePanel: FilePanelManager;
    private _connection: ConnectionManager;

    private _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;
    private _originalId: string;
    private _parsedId: SimulationIdParseSuccess;
    // private _aux: RealtimeCausalTree<AuxCausalTree>;
    private _config: { isBuilder: boolean; isPlayer: boolean };

    _errored: boolean;

    closed: boolean;

    /**
     * Gets the ID of the simulation that is currently being used.
     */
    get id() {
        return this._originalId;
    }

    /**
     * Gets the parsed ID of the simulation.
     */
    get parsedId(): SimulationIdParseSuccess {
        return this._parsedId;
    }

    set parsedId(id: SimulationIdParseSuccess) {
        this._parsedId = id;
    }

    /**
     * Gets all the selected files that represent an object.
     */
    get selectedObjects(): File[] {
        return this.selection.getSelectedFilesForUser(this.helper.userFile);
    }

    /**
     * Gets whether the app is connected to the server but may
     * or may not be synced to the serer.
     */
    get isOnline(): boolean {
        // return this._aux.channel.isConnected;
        return false;
    }

    /**
     * Gets whether the app is synced to the server.
     */
    get isSynced(): boolean {
        return this.isOnline;
    }

    /**
     * Gets the file helper.
     */
    get helper() {
        return this._helper;
    }

    /**
     * Gets the selection manager.
     */
    get selection() {
        return this._selection;
    }

    /**
     * Gets the recent files manager.
     */
    get recent() {
        return this._recent;
    }

    /**
     * Gets the file watcher.
     */
    get watcher() {
        return this._watcher;
    }

    /**
     * Gets the files panel manager.
     */
    get filePanel() {
        return this._filePanel;
    }

    get connection() {
        return this._connection;
    }

    get localEvents() {
        return this._vm.localEvents.pipe(flatMap(e => e));
    }

    constructor(
        user: User,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        this._user = user;
        this._originalId = id || 'default';
        this._parsedId = parseSimulationId(this._originalId);
        this._id = this._getTreeName(this._parsedId.channel);
        this._config = config;

        this._vm = new AuxVMImpl({
            config: config,
            host: this._parsedId.host,
            id: id,
            treeName: this._id,
            user: user,
        });

        this._helper = new FileHelper(this._vm, this._user.id);
        this._selection = new SelectionManager(this._helper);
        this._recent = new RecentFilesManager(this._helper);
        this._connection = new ConnectionManager(this._vm);
    }

    /**
     * Initializes the file manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        console.log('[FileManager] init');
        return this._init(loadingCallback);
    }

    /**
     * Sets the file mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode) {
        return this.helper.updateFile(this.helper.userFile, {
            tags: {
                'aux._mode': mode,
            },
        });
    }

    // TODO: This seems like a pretty dangerous function to keep around,
    // but we'll add a config option to prevent this from happening on real sites.
    async deleteEverything() {
        console.warn('[FileManager] Delete Everything!');
        const state = this.helper.filesState;
        const fileIds = keys(state);
        const files = fileIds.map(id => state[id]);
        const nonUserOrGlobalFiles = files.filter(
            f => !f.tags['aux._user'] && f.id !== GLOBALS_FILE_ID
        );
        const deleteOps = nonUserOrGlobalFiles.map(f => fileRemoved(f.id));
        await this.helper.transaction(...deleteOps);

        // setTimeout(() => {
        //   appManager.logout();
        //   location.reload();
        // }, 200);
    }

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    async forkAux(forkName: string) {
        const id = this._getTreeName(forkName);
        console.log('[FileManager] Making fork', forkName);
        // TODO: Fix
        // const forked = await this._treeManager.forkTree(this.aux, id);
    }

    private _getTreeName(id: string) {
        return id ? `aux-${id}` : 'aux-default';
    }

    private async _init(loadingCallback: LoadingProgressCallback) {
        const loadingProgress = new LoadingProgress();
        if (loadingCallback) {
            loadingProgress.onChanged.addListener(() => {
                loadingCallback(loadingProgress);
            });
        }

        if (this._errored) {
            loadingProgress.set(
                0,
                'File manager failed to initalize.',
                'File manager failed to initialize'
            );
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }
            return;
        }
        try {
            this._setStatus('Starting...');
            this._subscriptions = [];

            loadingProgress.set(10, 'Initializing VM...', null);
            const onVmInitProgress = loadingProgress.createNestedCallback(
                20,
                100
            );
            await this._vm.init(onVmInitProgress);
            this._watcher = new FileWatcher(
                this._helper,
                this._vm.stateUpdated
            );
            this._filePanel = new FilePanelManager(
                this._watcher,
                this._helper,
                this._selection,
                this._recent
            );

            this._setStatus('Initialized.');
            loadingProgress.set(100, 'File manager initialized.', null);
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }
        } catch (ex) {
            this._errored = true;
            console.error(ex);
            loadingProgress.set(
                0,
                'Error occured while initializing file manager.',
                ex.message
            );
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }
        }
    }

    /**
     * Adds the root atom to the tree if it has not been added by the server.
     */
    // private async _addRootAtom() {
    //     if (this._aux.tree.weave.atoms.length === 0) {
    //         this._setStatus('Adding root atom...');
    //         await this._aux.tree.root();
    //     }
    // }

    private _setStatus(status: string) {
        this._status = status;
        console.log('[FileManager] Status:', status);
    }

    public unsubscribe() {
        this._setStatus('Dispose');
        this.closed = true;
        this._subscriptions.forEach(s => s.unsubscribe());
        this._subscriptions = [];
    }
}
