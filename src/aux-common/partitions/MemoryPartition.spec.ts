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
import { testPartitionImplementation } from './test/PartitionTests';
import { createMemoryPartition } from './MemoryPartition';
import type { Bot } from '../bots';
import { createBot } from '../bots';
import { first } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

describe('MemoryPartition', () => {
    testPartitionImplementation(async () => {
        return createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
    });

    describe('connect', () => {
        it('should send an onBotsAdded event for all the bots in the partition on init', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            let added: Bot[] = [];
            mem.onBotsAdded.subscribe((e) => added.push(...e));

            expect(added).toEqual([createBot('test'), createBot('test2')]);
        });

        it('should return immediate for the editStrategy', () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            expect(mem.realtimeStrategy).toEqual('immediate');
        });

        it('should have a current site ID', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });

            const version = await firstValueFrom(
                mem.onVersionUpdated.pipe(first())
            );

            expect(version?.currentSite).not.toBe(null);
            expect(version?.currentSite).toBeDefined();
        });

        it('should place all the initial bots in the space that the partition is for', async () => {
            const mem = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            });
            mem.space = 'tempLocal';

            mem.connect();

            let added: Bot[] = [];
            mem.onBotsAdded.subscribe((e) => added.push(...e));

            expect(added).toEqual([
                createBot('test', undefined, 'tempLocal'),
                createBot('test2', undefined, 'tempLocal'),
            ]);
        });
    });
});
