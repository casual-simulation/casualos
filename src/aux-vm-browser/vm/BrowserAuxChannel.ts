import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose, proxy, Remote } from 'comlink';
import {
    LocalEvents,
    auxCausalTreeFactory,
    AuxCausalTree,
    EvalSandbox,
    FileEvent,
} from '@casual-simulation/aux-common';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import { AuxConfig, BaseAuxChannel, AuxUser } from '@casual-simulation/aux-vm';
import {
    SyncedRealtimeCausalTree,
    NullCausalTreeStore,
    RemoteEvent,
    SERVER_ROLE,
    DeviceEvent,
} from '@casual-simulation/causal-trees';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { BrowserSigningCryptoImpl } from '@casual-simulation/crypto-browser';

export class BrowserAuxChannel extends RemoteAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;

    getRealtimeTree(): Remote<RealtimeCausalTree<AuxCausalTree>> {
        return <any>proxy(this.aux);
    }

    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(defaultHost, user, config, {
            store: new NullCausalTreeStore(),
            crypto: new BrowserSigningCryptoImpl('ECDSA-SHA256-NISTP256'),
            sandboxFactory: lib => new EvalSandbox(lib),
        });

        EvalSandbox.messages.subscribe(m => {
            this._handleStatusUpdated(m);
        });
    }

    // TODO: Move this logic to an AuxModule
    protected async _handleServerEvents(events: DeviceEvent[]) {
        let filtered = events.filter(
            e => e.device.roles.indexOf(SERVER_ROLE) >= 0
        );
        let mapped = <FileEvent[]>filtered.map(e => e.event);
        if (filtered.length > 0) {
            await this.sendEvents(mapped);
        }
    }
}
