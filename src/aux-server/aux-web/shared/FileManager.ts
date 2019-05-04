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
} from 'rxjs/operators';

import { AppManager, appManager } from './AppManager';
import { SocketManager } from './SocketManager';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { getOptionalValue } from './SharedUtils';
import {
    LoadingProgress,
    LoadingProgressCallback,
} from '@casual-simulation/aux-common/LoadingProgress';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import { RecentFilesManager } from './RecentFilesManager';
import { ProgressStatus } from '@casual-simulation/causal-trees';
import FileWatcher from './FileWatcher';
import FilePanelManager from './FilePanelManager';
import { Simulation } from './Simulation';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager implements Simulation {
    private _appManager: AppManager;
    private _treeManager: CausalTreeManager;
    private _socketManager: SocketManager;
    private _helper: FileHelper;
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;
    private _watcher: FileWatcher;
    private _filePanel: FilePanelManager;

    private _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;
    private _originalId: string;
    private _parsedId: SimulationIdParseSuccess;
    private _aux: RealtimeCausalTree<AuxCausalTree>;
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
        return this._aux.channel.isConnected;
    }

    /**
     * Gets whether the app is synced to the server.
     */
    get isSynced(): boolean {
        return this.isOnline;
    }

    /**
     * Gets the realtime causal tree that the file manager is using.
     */
    get aux() {
        return this._aux;
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

    /**
     * Gets the socket manager.
     */
    get socketManager() {
        return this._socketManager;
    }

    constructor(
        app: AppManager,
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        this._appManager = app;
        this._originalId = id;
        this._parsedId = parseSimulationId(id);
        this._id = this._getTreeName(this._parsedId.channel);
        this._config = config;

        this._socketManager = new SocketManager(this._parsedId.host);
        this._treeManager = new CausalTreeManager(
            this._socketManager.socket,
            auxCausalTreeFactory()
        );
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
            f => !f.tags['aux._user'] && f.id !== 'globals'
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
        const forked = await this._treeManager.forkTree(this.aux, id);
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

            loadingProgress.set(10, 'Initializing causal tree manager..', null);
            await this._treeManager.init();

            this._aux = await this._treeManager.getTree<AuxCausalTree>(
                {
                    id: this._id,
                    type: 'aux',
                },
                {
                    garbageCollect: true,

                    // TODO: Allow reusing site IDs without causing multiple tabs to try and
                    //       be the same site.
                    alwaysRequestNewSiteId: true,
                }
            );

            this._subscriptions.push(this._aux);
            this._subscriptions.push(
                this._aux.onError.subscribe(err => console.error(err))
            );
            this._subscriptions.push(
                this._aux.onRejected.subscribe(rejected => {
                    rejected.forEach(r => {
                        console.warn('[FileManager] Atom Rejected', r);
                    });
                })
            );

            loadingProgress.set(20, 'Loading tree from server...', null);
            const onTreeInitProgress: LoadingProgressCallback = (
                status: ProgressStatus
            ) => {
                let percent = status.progressPercent
                    ? lerp(20, 70, status.progressPercent)
                    : loadingProgress.progress;
                let message = status.message
                    ? status.message
                    : loadingProgress.status;
                let error = status.error ? status.error : loadingProgress.error;

                loadingProgress.set(percent, message, error);
            };
            await this._aux.init(onTreeInitProgress);
            await this._aux.waitToGetTreeFromServer();

            console.log('[FileManager] Got Tree:', this._aux.tree.site.id);

            this._helper = new FileHelper(
                this._aux.tree,
                appManager.user.id,
                this._config
            );
            this._selection = new SelectionManager(this._helper);
            this._recent = new RecentFilesManager(this._helper);

            loadingProgress.set(70, 'Initalize user file...', null);
            await this._initUserFile();
            loadingProgress.set(80, 'Initalize globals file...', null);
            await this._initGlobalsFile();

            const {
                filesAdded,
                filesRemoved,
                filesUpdated,
            } = fileChangeObservables(this._aux);
            this._watcher = new FileWatcher(
                filesAdded,
                filesRemoved,
                filesUpdated
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
    private async _addRootAtom() {
        if (this._aux.tree.weave.atoms.length === 0) {
            this._setStatus('Adding root atom...');
            await this._aux.tree.root();
        }
    }

    private async _initUserFile() {
        this._setStatus('Updating user file...');
        let userFile = this.helper.userFile;
        const userContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }`;
        const userInventoryContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }_inventory`;
        const userMenuContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }_menu`;
        const userSimulationsContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }_simulations`;
        if (!userFile) {
            await this.helper.createFile(this._appManager.user.id, {
                [userContext]: true,
                [`${userContext}.config`]: true,
                ['aux._user']: this._appManager.user.username,
                ['aux._userInventoryContext']: userInventoryContext,
                ['aux._userMenuContext']: userMenuContext,
                ['aux._userSimulationsContext']: userSimulationsContext,
                'aux._mode': DEFAULT_USER_MODE,
            });
        } else {
            if (!userFile.tags['aux._userMenuContext']) {
                await this.helper.updateFile(userFile, {
                    tags: {
                        ['aux._userMenuContext']: userMenuContext,
                    },
                });
            }
            if (!userFile.tags['aux._userInventoryContext']) {
                await this.helper.updateFile(userFile, {
                    tags: {
                        ['aux._userInventoryContext']: userInventoryContext,
                    },
                });
            }
            if (!userFile.tags['aux._userSimulationsContext']) {
                await this.helper.updateFile(userFile, {
                    tags: {
                        ['aux._userSimulationsContext']: userSimulationsContext,
                    },
                });
            }
        }
    }

    private async _initGlobalsFile() {
        this._setStatus('Updating globals file...');
        let globalsFile = this.helper.globalsFile;
        if (!globalsFile) {
            await this._helper.createWorkspace(
                'globals',
                undefined,
                undefined,
                'Global'
            );
        }
    }

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
