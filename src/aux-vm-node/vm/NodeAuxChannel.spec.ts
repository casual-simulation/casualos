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
import { NodeAuxChannel } from './NodeAuxChannel';
import type { MemoryPartition } from '@casual-simulation/aux-common';
import { createMemoryPartition } from '@casual-simulation/aux-common';

let logMock = (console.log = jest.fn());
console.warn = jest.fn();

describe('NodeAuxChannel', () => {
    let partition: MemoryPartition;
    let channel: NodeAuxChannel;

    beforeEach(async () => {
        partition = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    function createChannel(id: string) {
        return (channel = new NodeAuxChannel({
            configBotId: 'connectionId',
            config: {
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: partition,
            },
        }));
    }

    it.skip('is a placeholder test', () => {});
});
