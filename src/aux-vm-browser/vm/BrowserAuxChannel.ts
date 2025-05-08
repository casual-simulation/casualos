/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import '@casual-simulation/aux-vm/globalThis-polyfill';
import type {
    PartitionConfig,
    AuxPartition,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import { createAuxPartition } from '@casual-simulation/aux-common';
import type {
    AuxConfig,
    AuxSubChannel,
    BaseAuxChannel,
} from '@casual-simulation/aux-vm/vm';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client/vm/RemoteAuxChannel';
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
