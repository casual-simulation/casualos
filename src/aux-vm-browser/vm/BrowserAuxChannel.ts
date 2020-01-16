import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose, proxy, Remote } from 'comlink';
import {
    LocalActions,
    auxCausalTreeFactory,
    AuxCausalTree,
    EvalSandbox,
    BotAction,
} from '@casual-simulation/aux-common';
import {
    CausalTreeManager,
    SocketManager,
} from '@casual-simulation/causal-tree-client-socketio';
import {
    SyncedRealtimeCausalTree,
    NullCausalTreeStore,
    RemoteAction,
    SERVER_ROLE,
    DeviceAction,
    Action,
} from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    BaseAuxChannel,
    AuxUser,
    AuxChannelOptions,
    CausalTreePartitionConfig,
    createMemoryPartition,
    createAuxPartition,
    createCausalRepoPartition,
    PartitionConfig,
    AuxPartition,
    iteratePartitions,
    filterAtomFactory,
    createCausalRepoClientPartition,
} from '@casual-simulation/aux-vm';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { BrowserSigningCryptoImpl } from '@casual-simulation/crypto-browser';
import { createProxyClientPartition } from '../partitions/ProxyClientPartition';

export class BrowserAuxChannel extends RemoteAuxChannel {
    protected _treeManager: CausalTreeManager;
    protected _socketManager: SocketManager;

    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(user, config, {
            sandboxFactory: lib => new EvalSandbox(lib),
            partitionOptions: {
                defaultHost: defaultHost,
                store: new NullCausalTreeStore(),
                crypto: new BrowserSigningCryptoImpl('ECDSA-SHA256-NISTP256'),
            },
        });

        EvalSandbox.messages.subscribe(m => {
            this._handleStatusUpdated(m);
        });
    }

    // TODO: Move this logic to an AuxModule
    // Overridden to automatically execute events from the server.
    protected async _handlePartitionEvents(events: BotAction[]) {
        await super._handlePartitionEvents(events);
        let filtered = events.filter(
            e => e.type === 'device' && e.device.roles.indexOf(SERVER_ROLE) >= 0
        ) as DeviceAction[];
        let mapped = <BotAction[]>filtered.map(e => e.event);
        if (filtered.length > 0) {
            await this.sendEvents(mapped);
        }
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        let partition = await super._createPartition(config);
        if (!partition) {
            partition = await createAuxPartition(
                config,
                createProxyClientPartition
            );
        }

        return partition;
    }
}
