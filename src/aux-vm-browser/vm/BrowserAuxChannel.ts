import '@casual-simulation/aux-vm/globalThis-polyfill';
import {
    BotAction,
    createAuxPartition,
    PartitionConfig,
    AuxPartition,
} from '@casual-simulation/aux-common';
import { SERVER_ROLE, DeviceAction } from '@casual-simulation/causal-trees';
import { AuxConfig, AuxUser, PortalBundler } from '@casual-simulation/aux-vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client';
import { createProxyClientPartition } from '../partitions/ProxyClientPartition';
import ESBuildWasmURL from 'esbuild-wasm/esbuild.wasm';

export class BrowserAuxChannel extends RemoteAuxChannel {
    constructor(defaultHost: string, user: AuxUser, config: AuxConfig) {
        super(user, config, {});
        this._portalBundler = new PortalBundler({
            type: 'esbuild',
            esbuildWasmUrl: ESBuildWasmURL,
        });
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
}
