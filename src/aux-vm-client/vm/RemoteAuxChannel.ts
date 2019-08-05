import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    LocalEvents,
    auxCausalTreeFactory,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    AuxConfig,
    BaseAuxChannel,
    AuxUser,
    AuxChannelOptions,
} from '@casual-simulation/aux-vm';
import {
    SyncedRealtimeCausalTree,
    RemoteEvent,
} from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';
import { CausalTreeStore } from '@casual-simulation/causal-trees';

export interface RemoteAuxChannelOptions extends AuxChannelOptions {
    store?: CausalTreeStore;
    crypto?: SigningCryptoImpl;
}

export class RemoteAuxChannel extends BaseAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;

    protected get aux(): SyncedRealtimeCausalTree<AuxCausalTree> {
        return <SyncedRealtimeCausalTree<AuxCausalTree>>this._aux;
    }

    constructor(
        defaultHost: string,
        user: AuxUser,
        config: AuxConfig,
        options: RemoteAuxChannelOptions
    ) {
        super(user, config, options);
        let url = new URL(defaultHost);
        this._socketManager = new SocketManager(
            config.host ? `${url.protocol}//${config.host}` : defaultHost
        );
        this._treeManager = new CausalTreeManager(
            this._socketManager,
            auxCausalTreeFactory(),
            options.store,
            options.crypto
        );
    }

    protected async _sendRemoteEvents(events: RemoteEvent[]): Promise<void> {
        const aux = this.aux;
        await aux.channel.connection.sendEvents(events);
    }

    async setUser(user: AuxUser): Promise<void> {
        const aux = this.aux;
        aux.channel.setUser(user);
        await super.setUser(user);
    }

    async setGrant(grant: string): Promise<void> {
        const aux = this.aux;
        aux.channel.setGrant(grant);
    }

    async forkAux(newId: string) {
        console.log('[AuxChannel.worker] Forking AUX');
        await this._treeManager.forkTree(this.aux, newId);
        console.log('[AuxChannel.worker] Finished');
    }

    protected async _createRealtimeCausalTree() {
        await this._socketManager.init();
        await this._treeManager.init();
        const tree = await this._treeManager.getTree<AuxCausalTree>(
            {
                id: this._config.treeName,
                type: 'aux',
            },
            this.user,
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
