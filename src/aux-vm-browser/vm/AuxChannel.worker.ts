import '@casual-simulation/aux-vm/globalThis-polyfill';
import { Aux } from './AuxChannel';
import { expose, proxy, Remote } from 'comlink';
import {
    LocalEvents,
    PrecalculatedFilesState,
    FileEvent,
    auxCausalTreeFactory,
    AuxCausalTree,
    fileChangeObservables,
    DEFAULT_USER_MODE,
    GLOBALS_FILE_ID,
    isInUsernameList,
    whitelistOrBlacklistAllowsAccess,
    getFileDesignerList,
    calculateFormulaEvents,
    searchFileState,
    shouldDeleteUser,
    fileRemoved,
    AuxOp,
} from '@casual-simulation/aux-common';
import { SocketManager } from '../managers/SocketManager';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import {
    StateUpdatedEvent,
    AuxHelper,
    AuxConfig,
    PrecalculationManager,
} from '@casual-simulation/aux-vm';
import { flatMap } from 'lodash';
import {
    SyncedRealtimeCausalTree,
    NullCausalTreeStore,
} from '@casual-simulation/causal-trees';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import {
    LoadingProgressCallback,
    StoredCausalTree,
    storedTree,
} from '@casual-simulation/causal-trees';
import { listenForChannel } from '../html/IFrameHelpers';

class AuxImpl implements Aux {
    private _treeManager: CausalTreeManager;
    private _socketManager: SocketManager;
    private _helper: AuxHelper;
    private _precalculation: PrecalculationManager;
    private _aux: SyncedRealtimeCausalTree<AuxCausalTree>;
    private _config: AuxConfig;
    private _subs: SubscriptionLike[];

    private _onLocalEvents: (events: LocalEvents[]) => void;
    private _onStateUpated: (state: StateUpdatedEvent) => void;
    private _onConnectionStateChanged: (state: boolean) => void;

    getRealtimeTree(): Remote<SyncedRealtimeCausalTree<AuxCausalTree>> {
        return <any>proxy(this._aux);
    }

    constructor(defaultHost: string, config: AuxConfig) {
        this._config = config;
        this._subs = [];

        let url = new URL(defaultHost);
        this._socketManager = new SocketManager(
            config.host ? `${url.protocol}//${config.host}` : defaultHost
        );
        this._treeManager = new CausalTreeManager(
            this._socketManager.socket,
            auxCausalTreeFactory(),
            new NullCausalTreeStore()
        );
    }

    async init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged: (state: boolean) => void,
        onLoadingProgress?: LoadingProgressCallback
    ): Promise<void> {
        const loadingProgress = new LoadingProgress();
        if (onLoadingProgress) {
            loadingProgress.onChanged.addListener(() => {
                onLoadingProgress({
                    message: loadingProgress.message,
                    progressPercent: loadingProgress.progressPercent,
                    error: loadingProgress.error,
                });
            });
        }

        this._onLocalEvents = onLocalEvents;
        this._onStateUpated = onStateUpdated;
        this._onConnectionStateChanged = onConnectionStateChanged;

        await this._treeManager.init();

        this._aux = await this._treeManager.getTree<AuxCausalTree>(
            {
                id: this._config.treeName,
                type: 'aux',
            },
            {
                garbageCollect: true,

                // TODO: Allow reusing site IDs without causing multiple tabs to try and
                //       be the same site.
                alwaysRequestNewSiteId: true,
            }
        );
        this._subs.push(this._aux);
        this._subs.push(this._aux.onError.subscribe(err => console.error(err)));
        this._subs.push(
            this._aux.onRejected.subscribe(rejected => {
                rejected.forEach(r => {
                    console.warn('[AuxChannel] Atom Rejected', r);
                });
            })
        );
        loadingProgress.set(20, 'Loading tree from server...', null);
        const onTreeInitProgress = loadingProgress.createNestedCallback(20, 70);
        await this._aux.init(onTreeInitProgress);
        await this._aux.waitToGetTreeFromServer();

        console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);

        this._helper = new AuxHelper(
            this._aux.tree,
            this._config.user.id,
            this._config.config
        );
        this._precalculation = new PrecalculationManager(
            () => this._aux.tree.value,
            () => this._helper.createContext()
        );

        loadingProgress.set(70, 'Removing old users...', null);
        await this._deleteOldUserFiles();

        loadingProgress.set(80, 'Initalize user file...', null);
        await this._initUserFile();

        loadingProgress.set(90, 'Initalize globals file...', null);
        await this._initGlobalsFile();

        this._checkAccessAllowed();

        const {
            filesAdded,
            filesRemoved,
            filesUpdated,
        } = fileChangeObservables(this._aux);

        this._subs.push(
            this._helper.localEvents
                .pipe(
                    tap(e => {
                        for (let event of e) {
                            if (event.name === 'set_offline_state') {
                                this._socketManager.forcedOffline =
                                    event.offline;
                            }
                        }

                        this._onLocalEvents(e);
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            filesAdded
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._onStateUpated(this._precalculation.filesAdded(e));
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            filesRemoved
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._onStateUpated(
                            this._precalculation.filesRemoved(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            filesUpdated
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._onStateUpated(
                            this._precalculation.filesUpdated(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            this._aux.channel.connectionStateChanged
                .pipe(
                    tap(state => {
                        this._onConnectionStateChanged(state);
                    })
                )
                .subscribe(null, (e: any) => console.error(e))
        );

        loadingProgress.set(100, 'VM initialized.', null);
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        await this._helper.transaction(...events);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        return this._helper.formulaBatch(formulas);
    }

    async search(search: string): Promise<any> {
        return this._helper.search(search);
    }

    async forkAux(newId: string): Promise<any> {
        console.log('[AuxChannel.worker] Forking AUX');
        await this._treeManager.forkTree(this._aux, newId);
        console.log('[AuxChannel.worker] Finished');
    }

    async exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._helper.exportFiles(fileIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._aux.tree.export();
    }

    private async _initUserFile() {
        const userFile = this._helper.userFile;
        await this._helper.createOrUpdateUserFile(this._config.user, userFile);
    }

    private async _deleteOldUserFiles() {
        let events: FileEvent[] = [];
        for (let file of this._helper.objects) {
            if (file.tags['aux._user'] && shouldDeleteUser(file)) {
                console.log('[AuxChannel.worker] Removing User', file.id);
                events.push(fileRemoved(file.id));
            }
        }

        await this._helper.transaction(...events);
    }

    private async _initGlobalsFile() {
        let globalsFile = this._helper.globalsFile;
        if (!globalsFile) {
            const oldGlobalsFile = this._helper.filesState['globals'];
            if (oldGlobalsFile) {
                await this._helper.createFile(
                    GLOBALS_FILE_ID,
                    oldGlobalsFile.tags
                );
            } else {
                await this._helper.createGlobalsFile(GLOBALS_FILE_ID);
            }
        }
    }

    /**
     * Checks if the current user is allowed access to the simulation.
     */
    _checkAccessAllowed() {
        const calc = this._helper.createContext();
        const username = this._helper.userFile.tags['aux._user'];
        const file = this._helper.globalsFile;

        if (this._config.config.isBuilder) {
            const designers = getFileDesignerList(calc, file);
            if (designers) {
                if (!isInUsernameList(calc, file, 'aux.designers', username)) {
                    throw new Error(`You are denied access to this channel.`);
                } else {
                    return;
                }
            }
        }

        if (!whitelistOrBlacklistAllowsAccess(calc, file, username)) {
            throw new Error(`You are denied access to this channel.`);
        }
    }
}

listenForChannel().then(port => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(AuxImpl, port);
});

console.log('[AuxChannel.worker] Listening for port...');
