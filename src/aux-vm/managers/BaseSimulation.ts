import {
    fileRemoved,
    parseSimulationId,
    SimulationIdParseSuccess,
    GLOBALS_FILE_ID,
    AuxOp,
} from '@casual-simulation/aux-common';
import { keys } from 'lodash';
import { Observable, SubscriptionLike } from 'rxjs';
import { flatMap } from 'rxjs/operators';

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
import { CodeLanguageManager } from './CodeLanguageManager';

/**
 * Defines a class that interfaces with an AUX VM to reactively edit files.
 */
export class BaseSimulation implements Simulation {
    protected _vm: AuxVM;
    protected _helper: FileHelper;
    protected _watcher: FileWatcher;
    protected _connection: ConnectionManager;
    protected _code: CodeLanguageManager;

    protected _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;
    private _originalId: string;
    private _parsedId: SimulationIdParseSuccess;
    private _config: { isBuilder: boolean; isPlayer: boolean };

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

    get code() {
        return this._code;
    }

    get localEvents() {
        return this._vm.localEvents.pipe(flatMap(e => e));
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._vm.onError;
    }

    get deviceEvents() {
        return this._vm.deviceEvents.pipe(flatMap(e => e));
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
        this._code = new CodeLanguageManager(this._vm);
    }

    /**
     * Initializes the file manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(): Promise<void> {
        console.log('[FileManager] init');
        return this._init();
    }

    updateID(id: string) {
        this._originalId = id || 'default';
        this._parsedId = parseSimulationId(this._originalId);
        this._id = this._getTreeName(this._parsedId.channel);
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

    private async _init(): Promise<void> {
        if (this._errored) {
            throw new Error('Unable to initialize.');
        }
        this._setStatus('Starting...');
        this._subscriptions = [this._vm];

        // FileWatcher should be initialized before the VM
        // so that it is already listening for any events that get emitted
        // during initialization.
        this._initFileWatcher();
        this._subscriptions.push(
            this._vm.connectionStateChanged.subscribe(s => {
                if (s.type === 'message') {
                    console.log(`[${s.source}] ${s.message}`);
                }
            })
        );

        await this._vm.init();

        this._initManagers();

        this._setStatus('Initialized.');
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
