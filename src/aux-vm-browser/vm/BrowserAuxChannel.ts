import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    LocalActions,
    EvalSandbox,
    BotAction,
    createAuxPartition,
    PartitionConfig,
    AuxPartition,
} from '@casual-simulation/aux-common';
import {
    RemoteAction,
    SERVER_ROLE,
    DeviceAction,
    Action,
} from '@casual-simulation/causal-trees';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { createProxyClientPartition } from '../partitions/ProxyClientPartition';

export class BrowserAuxChannel extends RemoteAuxChannel {
    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(user, config, {
            sandboxFactory: lib => new EvalSandbox(lib),
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
