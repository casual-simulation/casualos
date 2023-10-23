import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    BotAction,
    createAuxPartition,
    PartitionConfig,
    AuxPartition,
    ConnectionIndicator,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    AuxConfig,
    AuxSubChannel,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { proxy } from 'comlink';
import { AuxRuntime } from '@casual-simulation/aux-runtime';

export class DenoAuxChannel extends RemoteAuxChannel {
    constructor(defaultHost: string, config: AuxConfig) {
        super(config, {});
    }

    protected async _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition> {
        let partition = await super._createPartition(config, services);
        return partition;
    }

    protected _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new DenoAuxChannel(null, config);
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
