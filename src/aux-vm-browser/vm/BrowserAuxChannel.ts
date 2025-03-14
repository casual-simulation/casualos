import '@casual-simulation/aux-vm/globalThis-polyfill';
import type {
    PartitionConfig,
    AuxPartition,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    BotAction,
    createAuxPartition,
    ConnectionIndicator,
} from '@casual-simulation/aux-common';
import type {
    AuxConfig,
    AuxSubChannel,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { createProxyClientPartition } from '../partitions/ProxyClientPartition';
import { proxy } from 'comlink';
import type { AuxRuntime } from '@casual-simulation/aux-runtime';

export class BrowserAuxChannel extends RemoteAuxChannel {
    static defaultHost: string;

    constructor(defaultHost: string, config: AuxConfig) {
        super(config, {});
        BrowserAuxChannel.defaultHost = defaultHost;
    }

    protected async _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition> {
        let partition = await super._createPartition(config, services);
        if (!partition) {
            partition = await createAuxPartition(
                config,
                services,
                createProxyClientPartition
            );
        }

        return partition;
    }

    protected _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new BrowserAuxChannel(
            BrowserAuxChannel.defaultHost,
            config
        );
        channel._runtime = runtime;
        return channel;
    }

    protected _handleSubChannelAdded(subChannel: AuxSubChannel): void {
        return super._handleSubChannelAdded(
            proxy({
                getInfo: subChannel.getInfo,
                getChannel: async () => proxy(await subChannel.getChannel()),
            })
        );
    }
}
