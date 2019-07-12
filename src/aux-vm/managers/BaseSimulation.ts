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
    AuxOp,
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
    Subscription,
    never,
} from 'rxjs';
import {
    filter,
    map,
    startWith,
    first as rxFirst,
    flatMap,
    tap,
} from 'rxjs/operators';

import { AuxUser } from '../AuxUser';
import { FileHelper } from './FileHelper';
import { FileWatcher } from './FileWatcher';
import { AuxVM } from '../vm/AuxVM';
import { AuxConfig } from '../vm/AuxConfig';
import { ConnectionManager } from './ConnectionManager';
import { AuxChannelErrorType } from '../vm/AuxChannelErrorTypes';
import {
    RealtimeCausalTree,
    StoredCausalTree,
} from '@casual-simulation/causal-trees';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { LoadingProgressCallback } from '@casual-simulation/causal-trees';
import { ProgressStatus, DeviceInfo } from '@casual-simulation/causal-trees';
import { Simulation } from './Simulation';
import { InitError } from './Initable';

/**
 * Defines a class that interfaces with an AUX VM to reactively edit files.
 */
export class BaseSimulation implements Simulation {
    protected _vm: AuxVM;
    protected _helper: FileHelper;
    protected _watcher: FileWatcher;
    protected _connection: ConnectionManager;

    protected _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;
    private _originalId: string;
    private _parsedId: SimulationIdParseSuccess;
    private _config: { isBuilder: boolean; isPlayer: boolean };

    private _error: InitError;
    private _errored: boolean;

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
     * Gets the file watcher.
     */
    get watcher() {
        return this._watcher;
    }

    get connection() {
        return this._connection;
    }

    get localEvents() {
        return this._vm.localEvents.pipe(flatMap(e => e));
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._vm.onError;
    }

    /**
     * Creates a new simulation for the given user and channel ID.
     * @param user The user.
     * @param id The ID of the channel.
     * @param config The channel config.
     * @param createVm The factory function to use for creating an AUX VM.
     */
    constructor(
        id: string,
        config: { isBuilder: boolean; isPlayer: boolean },
        createVm: (config: AuxConfig) => AuxVM
    ) {
        this._originalId = id || 'default';
        this._parsedId = parseSimulationId(this._originalId);
        this._id = this._getTreeName(this._parsedId.channel);
        this._config = config;

        this._vm = createVm({
            config: config,
            host: this._parsedId.host,
            id: id,
            treeName: this._id,
        });

        this._helper = new FileHelper(this._vm);
        this._connection = new ConnectionManager(this._vm);
    }

    /**
     * Initializes the file manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(loadingCallback?: LoadingProgressCallback): Promise<InitError> {
        console.log('[FileManager] init');
        return this._init(loadingCallback);
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
    }

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    async forkAux(forkName: string) {
        const id = this._getTreeName(forkName);
        console.log('[FileManager] Making fork', forkName);
        await this._vm.forkAux(id);
        console.log('[FileManager] Fork finished.');
    }

    exportFiles(fileIds: string[]) {
        return this._vm.exportFiles(fileIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._vm.exportTree();
    }

    private _getTreeName(id: string) {
        return id ? `aux-${id}` : 'aux-default';
    }

    private async _init(
        loadingCallback: LoadingProgressCallback
    ): Promise<InitError> {
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
            return this._error;
        }
        try {
            this._setStatus('Starting...');
            this._subscriptions = [this._vm];

            loadingProgress.set(10, 'Initializing VM...', null);
            const onVmInitProgress = loadingProgress.createNestedCallback(
                20,
                100
            );

            // FileWatcher should be initialized before the VM
            // so that it is already listening for any events that get emitted
            // during initialization.
            this._initFileWatcher();

            const error = await this._vm.init(onVmInitProgress);

            if (error) {
                return error;
            }

            this._initManagers();

            this._setStatus('Initialized.');
            loadingProgress.set(100, 'File manager initialized.', null);
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }

            return null;
        } catch (ex) {
            this._errored = true;
            this._error = {
                type: 'exception',
                exception: ex,
            };
            return this._error;
        }
    }

    protected _initFileWatcher() {
        this._watcher = new FileWatcher(this._helper, this._vm.stateUpdated);
    }

    protected _initManagers() {}

    protected _setStatus(status: string) {
        this._status = status;
        console.log('[BaseSimulation] Status:', status);
    }

    public unsubscribe() {
        this._setStatus('Dispose');
        this.closed = true;
        this._subscriptions.forEach(s => s.unsubscribe());
        this._subscriptions = [];
    }
}
