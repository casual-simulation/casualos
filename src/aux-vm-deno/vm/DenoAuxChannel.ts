import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    BotAction,
    createAuxPartition,
    PartitionConfig,
    AuxPartition,
} from '@casual-simulation/aux-common';
import {
    AuxConfig,
    AuxSubChannel,
    AuxUser,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { proxy } from 'comlink';
import { AuxRuntime } from '@casual-simulation/aux-runtime';

export class DenoAuxChannel extends RemoteAuxChannel {
    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(user, config, {});
    }

    protected async _createPartition(
        config: PartitionConfig
    ): Promise<AuxPartition> {
        let partition = await super._createPartition(config);
        return partition;
    }

    protected _createSubChannel(
        user: AuxUser,
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new DenoAuxChannel(null, user, config);
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
