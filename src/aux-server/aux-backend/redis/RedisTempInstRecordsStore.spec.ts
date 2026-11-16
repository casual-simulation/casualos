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

import { createClient } from 'redis';
import { randomUUID } from 'crypto';
import { RedisTempInstRecordsStore } from './RedisTempInstRecordsStore';
import { temporaryCompactionContract } from '../../../aux-records/websockets/TemporaryInstRecordsStoreTests';

// Opt in with an isolated Redis instance, e.g. REDIS_TEST_URL=redis://localhost:16389.
(process.env.REDIS_TEST_URL ? describe : describe.skip)(
    'RedisTempInstRecordsStore compaction',
    () => {
        const client = createClient({ url: process.env.REDIS_TEST_URL });
        let namespace: string;
        beforeAll(async () => {
            await client.connect();
        });
        afterEach(async () => {
            const keys = await client.keys(`${namespace}/*`);
            if (keys.length) await client.del(keys);
        });
        afterAll(async () => {
            await client.quit();
        });
        temporaryCompactionContract(async () => {
            namespace = `compaction-test-${randomUUID()}`;
            return new RedisTempInstRecordsStore(namespace, client as any, 60);
        });
        it('preserves expiration when replacing the whole list', async () => {
            const store = new RedisTempInstRecordsStore(
                namespace,
                client as any,
                60
            );
            await store.addUpdates(null, 'inst', 'branch', ['a', 'b'], 2);
            const snapshot = await store.getUpdates(null, 'inst', 'branch');
            await store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab');
            const keys = await client.keys(`${namespace}/updates/*`);
            expect(keys).toHaveLength(1);
            expect(await client.ttl(keys[0])).toBeGreaterThan(0);
        });
    }
);
