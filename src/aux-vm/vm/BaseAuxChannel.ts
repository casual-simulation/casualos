import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuxChannel } from './AuxChannel';
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
import { PrecalculationManager } from '../managers/PrecalculationManager';
import { AuxHelper } from './AuxHelper';
import { AuxConfig } from './AuxConfig';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { flatMap } from 'lodash';
import {
    LoadingProgressCallback,
    StoredCausalTree,
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { AuxChannelErrorType } from './AuxChannelErrorTypes';
import { toErrorType } from './AuxChannelError';

export class BaseAuxChannel implements AuxChannel, SubscriptionLike {
    protected _helper: AuxHelper;
    protected _precalculation: PrecalculationManager;
    protected _aux: RealtimeCausalTree<AuxCausalTree>;
    protected _config: AuxConfig;
    protected _subs: SubscriptionLike[];
    protected _initError: any;
    protected _initErrorPromise: Promise<any>;
    protected _resolveInitError: Function;

    private _onLocalEvents: (events: LocalEvents[]) => void;
    private _onStateUpdated: (state: StateUpdatedEvent) => void;
    private _onConnectionStateChanged: (state: boolean) => void;
    private _onError: (err: AuxChannelErrorType) => void;

    constructor(config: AuxConfig) {
        this._config = config;
        this._subs = [];
    }

    async init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged: (state: boolean) => void,
        onError: (err: AuxChannelErrorType) => void,
        onLoadingProgress?: LoadingProgressCallback
    ): Promise<void> {
        this._initErrorPromise = new Promise<any>(resolve => {
            this._resolveInitError = resolve;
        });
        this._initErrorPromise.then(err => {
            this._initError = err;
        });
        this._onLocalEvents = onLocalEvents;
        this._onStateUpdated = onStateUpdated;
        this._onConnectionStateChanged = onConnectionStateChanged;
        this._onError = onError;

        await this._init(onLoadingProgress);
    }

    private async _init(
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

        loadingProgress.set(20, 'Loading causal tree...', null);
        this._aux = await Promise.race([
            this._createRealtimeCausalTree(),
            this._initErrorPromise,
        ]);
        this._checkInitError();

        this._subs.push(this._aux);
        this._subs.push(
            this._aux.onError.subscribe(err => this._handleError(err))
        );
        this._subs.push(
            this._aux.onRejected.subscribe(rejected => {
                rejected.forEach(r => {
                    console.warn('[AuxChannel] Atom Rejected', r);
                });
            })
        );

        const onTreeInitProgress = loadingProgress.createNestedCallback(20, 70);
        await Promise.race([
            this._initRealtimeCausalTree(onTreeInitProgress),
            this._initErrorPromise,
        ]);
        this._checkInitError();

        console.log('[AuxChannel] Got Tree:', this._aux.tree.site.id);

        this._helper = this._createAuxHelper();
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

        this._registerSubscriptions();

        this._checkInitError();
        loadingProgress.set(100, 'VM initialized.', null);
    }

    private _checkInitError() {
        if (this._initError) {
            throw this._initError;
        }
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
        throw new Error('Not Implemented');
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

    protected _createAuxHelper() {
        return new AuxHelper(
            this._aux.tree,
            this._config.user.id,
            this._config.config
        );
    }

    protected _registerSubscriptions() {
        const {
            filesAdded,
            filesRemoved,
            filesUpdated,
        } = fileChangeObservables(this._aux);

        this._subs.push(
            this._helper.localEvents
                .pipe(
                    tap(e => {
                        this._handleLocalEvents(e);
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            filesAdded
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._handleStateUpdated(
                            this._precalculation.filesAdded(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e)),
            filesRemoved
                .pipe(
                    tap(e => {
                        if (e.length === 0) {
                            return;
                        }
                        this._handleStateUpdated(
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
                        this._handleStateUpdated(
                            this._precalculation.filesUpdated(e)
                        );
                    })
                )
                .subscribe(null, (e: any) => console.error(e))
        );
    }

    protected _handleConnectionStateChanged(state: boolean) {
        this._onConnectionStateChanged(state);
    }

    protected _handleStateUpdated(event: StateUpdatedEvent) {
        this._onStateUpdated(event);
    }

    protected _handleError(error: any) {
        this._onError(toErrorType(error));
    }

    protected async _initRealtimeCausalTree(
        loadingCallback?: LoadingProgressCallback
    ): Promise<void> {
        this._subs.push(
            this._aux.onError.subscribe(err => {
                this._initError = err;
            })
        );
        await this._aux.init(loadingCallback);
        // await this._aux.waitToGetTreeFromServer();
    }

    protected _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        throw new Error('Not implemented');
    }

    protected _handleLocalEvents(e: LocalEvents[]) {
        this._onLocalEvents(e);
    }

    private async _initUserFile() {
        const userFile = this._helper.userFile;
        await this._helper.createOrUpdateUserFile(this._config.user, userFile);
    }

    private async _deleteOldUserFiles() {
        let events: FileEvent[] = [];
        for (let file of this._helper.objects) {
            if (file.tags['aux._user'] && shouldDeleteUser(file)) {
                console.log('[BaseAuxChannel] Removing User', file.id);
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

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._subs.forEach(s => s.unsubscribe());
    }

    closed: boolean;
}
