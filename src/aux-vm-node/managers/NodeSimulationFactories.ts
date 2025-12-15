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
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client/vm/RemoteAuxChannel';
import { AuxVMNode } from '../vm/AuxVMNode';
import type { AuxConfig } from '@casual-simulation/aux-vm/vm';
import type {
    AuxPartitionConfig,
    InstRecordsClient,
    ConnectionIndicator,
    YjsClientPartitionConfig,
} from '@casual-simulation/aux-common';
import {
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
    TEMPORARY_BOT_PARTITION_ID,
    getConnectionId,
    DEFAULT_BRANCH_NAME,
} from '@casual-simulation/aux-common';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';
import { RemoteSimulationImpl } from '@casual-simulation/aux-vm-client';

export function nodeSimulationForBranch(
    id: string,
    origin: SimulationOrigin,
    indicator: ConnectionIndicator,
    client: InstRecordsClient,
    branch: string,
    extraOptions?: Partial<YjsClientPartitionConfig>
) {
    const connectionId = getConnectionId(indicator);
    const partitions: AuxPartitionConfig = {
        shared: {
            type: 'yjs_client',
            ...(extraOptions || {}),
            recordName: null,
            inst: branch,
            branch: DEFAULT_BRANCH_NAME,
            client: client,
        },
        [TEMPORARY_BOT_PARTITION_ID]: {
            type: 'memory',
            private: true,
            initialState: {},
        },
        [TEMPORARY_SHARED_PARTITION_ID]: {
            type: 'yjs_client',
            recordName: null,
            inst: branch,
            branch: `${DEFAULT_BRANCH_NAME}-player-${connectionId}`,
            client: client,
            temporary: true,
            remoteEvents: false,
        },
        [REMOTE_TEMPORARY_SHARED_PARTITION_ID]: {
            type: 'other_players_client',
            recordName: null,
            inst: branch,
            branch: DEFAULT_BRANCH_NAME,
            client: client,
        },
    };
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        branch,
        {
            recordName: null,
            inst: null,
        },
        new AuxVMNode(
            id,
            origin,
            configBotId,
            new RemoteAuxChannel(
                {
                    configBotId: configBotId,
                    config: null,
                    partitions,
                },
                {}
            )
        )
    );
}

export function nodeSimulationForLocalRepo(
    indicator: ConnectionIndicator,
    id: string,
    origin: SimulationOrigin = null
) {
    const partitions: AuxPartitionConfig = {
        shared: {
            type: 'yjs',
        },
    };
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        id,
        {
            recordName: null,
            inst: null,
        },
        new AuxVMNode(
            id,
            origin,
            configBotId,
            new RemoteAuxChannel(
                {
                    configBotId,
                    config: null,
                    partitions,
                },
                {}
            )
        )
    );
}

export function nodeSimulationWithConfig(
    indicator: ConnectionIndicator,
    id: string,
    origin: SimulationOrigin,
    config: AuxConfig
) {
    const configBotId = getConnectionId(indicator);
    return new RemoteSimulationImpl(
        id,
        {
            recordName: null,
            inst: null,
        },
        new AuxVMNode(id, origin, configBotId, new RemoteAuxChannel(config, {}))
    );
}
