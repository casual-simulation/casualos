import { Aux } from './AuxChannel';
import { expose } from 'comlink';
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
} from '@casual-simulation/aux-common';
import { AuxConfig } from './AuxConfig';
import { Simulation, FileManager, SocketManager } from '../managers';
import { SubscriptionLike } from 'rxjs';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import { PrecalculationManager } from 'managers/PrecalculationManager';
import { AuxHelper } from './AuxHelper';
import { flatMap } from 'lodash';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';

class AuxImpl implements Aux {
    private _treeManager: CausalTreeManager;
    private _socketManager: SocketManager;
    private _helper: AuxHelper;
    private _precalculation: PrecalculationManager;
    private _aux: RealtimeCausalTree<AuxCausalTree>;
    private _config: AuxConfig;
    private _subs: SubscriptionLike[];

    private _onLocalEvents: (events: LocalEvents[]) => void;
    private _onStateUpated: (state: StateUpdatedEvent) => void;
    private _onConnectionStateChanged: (state: boolean) => void;

    constructor(config: AuxConfig) {
        this._config = config;
        this._subs = [];

        this._socketManager = new SocketManager(config.host);
        this._treeManager = new CausalTreeManager(
            this._socketManager.socket,
            auxCausalTreeFactory()
        );
    }

    async init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: StateUpdatedEvent) => void,
        onConnectionStateChanged: (state: boolean) => void
    ): Promise<void> {
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

        // TODO: Enable progress
        // await this._aux.init(onTreeInitProgress);
        await this._aux.init();
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

        await this._initUserFile();
        await this._initGlobalsFile();

        this._checkAccessAllowed();

        const {
            filesAdded,
            filesRemoved,
            filesUpdated,
        } = fileChangeObservables(this._aux);

        this._subs.push(
            this._helper.localEvents.subscribe(e => {
                this._onLocalEvents(e);
            }),
            filesAdded.subscribe(e => {
                this._onStateUpated(this._precalculation.filesAdded(e));
            }),
            filesRemoved.subscribe(e => {
                this._onStateUpated(this._precalculation.filesRemoved(e));
            }),
            filesUpdated.subscribe(e => {
                this._onStateUpated(this._precalculation.filesUpdated(e));
            }),
            this._aux.channel.connectionStateChanged.subscribe(state => {
                this._onConnectionStateChanged(state);
            })
        );
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        await this._helper.transaction(...events);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        return this._helper.formulaBatch(formulas);
    }

    private async _initUserFile() {
        // TODO:
        // this._setStatus('Updating user file...');
        let userFile = this._helper.userFile;
        const userContext = `_user_${this._config.user.username}_${
            this._aux.tree.site.id
        }`;
        const userInventoryContext = `_user_${this._config.user.username}_${
            this._aux.tree.site.id
        }_inventory`;
        const userMenuContext = `_user_${this._config.user.username}_${
            this._aux.tree.site.id
        }_menu`;
        const userSimulationsContext = `_user_${this._config.user.username}_${
            this._aux.tree.site.id
        }_simulations`;
        if (!userFile) {
            await this._helper.createFile(this._config.user.id, {
                [userContext]: true,
                ['aux.context']: userContext,
                ['aux.context.visualize']: true,
                ['aux._user']: this._config.user.username,
                ['aux._userInventoryContext']: userInventoryContext,
                ['aux._userMenuContext']: userMenuContext,
                ['aux._userSimulationsContext']: userSimulationsContext,
                'aux._mode': DEFAULT_USER_MODE,
            });
        } else {
            if (!userFile.tags['aux._userMenuContext']) {
                await this._helper.updateFile(userFile, {
                    tags: {
                        ['aux._userMenuContext']: userMenuContext,
                    },
                });
            }
            if (!userFile.tags['aux._userInventoryContext']) {
                await this._helper.updateFile(userFile, {
                    tags: {
                        ['aux._userInventoryContext']: userInventoryContext,
                    },
                });
            }
            if (!userFile.tags['aux._userSimulationsContext']) {
                await this._helper.updateFile(userFile, {
                    tags: {
                        ['aux._userSimulationsContext']: userSimulationsContext,
                    },
                });
            }
        }
    }

    private async _initGlobalsFile() {
        // TODO:
        // this._setStatus('Updating globals file...');
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

expose(AuxImpl);
