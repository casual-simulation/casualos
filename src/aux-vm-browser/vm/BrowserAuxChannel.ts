import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    BotAction,
    createAuxPartition,
    PartitionConfig,
    AuxPartition,
    AuxRuntime,
} from '@casual-simulation/aux-common';
import { SERVER_ROLE, DeviceAction } from '@casual-simulation/causal-trees';
import {
    AuxConfig,
    AuxSubChannel,
    AuxUser,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { createProxyClientPartition } from '../partitions/ProxyClientPartition';
import { proxy } from 'comlink';

export class BrowserAuxChannel extends RemoteAuxChannel {
    static defaultHost: string;

    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(user, config, {});
        BrowserAuxChannel.defaultHost = defaultHost;
    }

    // TODO: Move this logic to an AuxModule
    // Overridden to automatically execute events from the server.
    protected async _handlePartitionEvents(events: BotAction[]) {
        await super._handlePartitionEvents(events);
        let filtered = events.filter(
            (e) =>
                e.type === 'device' && e.device.roles.indexOf(SERVER_ROLE) >= 0
        ) as DeviceAction[];
        let mapped = <BotAction[]>filtered.map((e) => e.event);
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

    protected _createSubChannel(
        user: AuxUser,
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new BrowserAuxChannel(
            BrowserAuxChannel.defaultHost,
            user,
            config
        );
        channel._runtime = runtime;
        return channel;
    }

    protected _handleSubChannelAdded(subChannel: AuxSubChannel): void {
        return super._handleSubChannelAdded(proxy(subChannel));
    }
}
