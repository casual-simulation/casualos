import '@casual-simulation/aux-vm/globalThis-polyfill';
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
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    StateUpdatedEvent,
    AuxHelper,
    AuxConfig,
    PrecalculationManager,
    AuxChannel,
    BaseAuxChannel,
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
    RealtimeCausalTree,
} from '@casual-simulation/causal-trees';
import { listenForChannel } from '../html/IFrameHelpers';

class AuxImpl extends BaseAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;

    getRealtimeTree(): Remote<RealtimeCausalTree<AuxCausalTree>> {
        return <any>proxy(this._aux);
    }

    constructor(defaultHost: string, config: AuxConfig) {
        super(config);
        let url = new URL(defaultHost);
        this._socketManager = new SocketManager(
            config.user,
            config.host ? `${url.protocol}//${config.host}` : defaultHost
        );
        this._treeManager = new CausalTreeManager(
            this._socketManager,
            auxCausalTreeFactory(),
            new NullCausalTreeStore()
        );
    }

    async forkAux(newId: string) {
        console.log('[AuxChannel.worker] Forking AUX');
        await this._treeManager.forkTree(
            <SyncedRealtimeCausalTree<AuxCausalTree>>this._aux,
            newId
        );
        console.log('[AuxChannel.worker] Finished');
    }

    protected async _createRealtimeCausalTree() {
        this._subs.push(
            this._socketManager.connectionStateChanged.subscribe(null, err => {
                this._resolveInitError(err);
            })
        );
        await this._socketManager.init();
        await this._treeManager.init();
        const tree = await this._treeManager.getTree<AuxCausalTree>(
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

        return tree;
    }

    protected _handleError(error: any) {
        if (error instanceof Error) {
            super._handleError({
                type: 'general',
                message: error.toString(),
            });
        } else {
            super._handleError(error);
        }
    }

    protected _handleLocalEvents(e: LocalEvents[]) {
        for (let event of e) {
            if (event.name === 'set_offline_state') {
                this._socketManager.forcedOffline = event.offline;
            }
        }
        super._handleLocalEvents(e);
    }
}

listenForChannel().then(port => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(AuxImpl, port);
});

console.log('[AuxChannel.worker] Listening for port...');
