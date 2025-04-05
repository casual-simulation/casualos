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
import { AuxVMNode } from './AuxVMNode';
import type { AuxConfig } from '@casual-simulation/aux-vm';
import type { ConnectionInfo } from '@casual-simulation/aux-common';
import { NodeAuxChannel } from './NodeAuxChannel';
import type { MemoryPartition } from '@casual-simulation/aux-common';
import { createMemoryPartition } from '@casual-simulation/aux-common';

console.log = jest.fn();

describe('AuxVMNode', () => {
    let memory: MemoryPartition;
    let config: AuxConfig;
    let connection: ConnectionInfo;
    let vm: AuxVMNode;
    let channel: NodeAuxChannel;
    beforeEach(async () => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });

        config = {
            configBotId: 'connectionId',
            config: {
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'memory',
                    partition: memory,
                },
            },
        };
        connection = {
            connectionId: 'connectionId',
            sessionId: null,
            userId: null,
        };

        channel = new NodeAuxChannel(config);
        vm = new AuxVMNode('id', null, 'connectionId', channel);
    });

    it('should initialize the channel', async () => {
        await vm.init();

        const bot = memory.state['connectionId'];
        expect(bot).toBeTruthy();
    });
});
