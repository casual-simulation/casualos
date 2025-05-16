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

// Copyright (c) 2014,2023
//   - Kevin Jahns <kevin.jahns@rwth-aachen.de>.
//   - Chair of Computer Science 5 (Databases & Information Systems), RWTH Aachen University, Germany
//   - Casual Simulation, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Transaction, YEvent } from 'yjs';
import { Doc } from 'yjs';
import {
    YjsIndexedDBPersistence,
    PREFERRED_TRIM_SIZE,
    fetchUpdates,
} from './YjsIndexedDBPersistence';
import { waitAsync } from '../test/TestHelpers';

describe('YjsIndexedDBPersistence', () => {
    async function runTask<T>(exec: () => Promise<T>): Promise<T> {
        return exec();
    }

    function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Broken when running tests in CI
    it.skip('should be able to store updates and merge them', async () => {
        const doc1 = new Doc();
        const arr1 = doc1.getArray('t');
        const doc2 = new Doc();
        const arr2 = doc2.getArray('t');
        arr1.insert(0, [0]);
        const persistence1 = new YjsIndexedDBPersistence('test1', doc1);
        persistence1.storeTimeout = 0;
        console.log('[test1] before sync');
        await runTask(() => persistence1.whenSynced);
        console.log('[test1] synced persistence1');

        arr1.insert(0, [1]);
        const persistence2 = new YjsIndexedDBPersistence('test1', doc2);
        persistence2.storeTimeout = 0;
        let calledObserver = false;
        const handler2 = (event: YEvent<any>, tr: Transaction) => {
            expect(tr.local).toBe(false);
            expect(tr.origin === persistence2).toBe(true);
            calledObserver = true;
        };
        arr2.observe(handler2);

        await runTask(() => persistence2.whenSynced);
        console.log('[test1] synced persistence2');

        expect(calledObserver).toBe(true);
        expect(arr2.length === 2).toBe(true);
        for (let i = 2; i < PREFERRED_TRIM_SIZE + 1; i++) {
            arr1.insert(i, [i]);
        }

        console.log('[test1] advance timers');
        await sleep(10);
        // await jest.advanceTimersByTimeAsync(1);

        console.log('[test1] fetch updates');
        await runTask(() => fetchUpdates(persistence2));

        console.log('[test1] done');
        expect(arr2.length === PREFERRED_TRIM_SIZE + 1).toBe(true);
        expect(persistence1.dbsize).toBe(1); // wait for dbsize === 0. db should be concatenated

        arr2.unobserve(handler2);
        // await jest.runAllTimersAsync();
        console.log('[test1] completed');
    });

    // Broken when running tests in CI
    it.skip('should be able to perform merges concurrently', async () => {
        const doc1 = new Doc();
        const arr1 = doc1.getArray('t');
        const doc2 = new Doc();
        const arr2 = doc2.getArray('t');
        arr1.insert(0, [0]);
        const persistence1 = new YjsIndexedDBPersistence('test2', doc1);
        persistence1.storeTimeout = 0;
        console.log('[test2] before sync');
        await runTask(() => persistence1.whenSynced);
        console.log('[test2] sync2');
        arr1.insert(0, [1]);
        const persistence2 = new YjsIndexedDBPersistence('test2', doc2);
        persistence2.storeTimeout = 0;
        await runTask(() => persistence2.whenSynced);
        console.log('[test2] sync2');

        expect(arr2.length).toBe(2);
        arr1.insert(0, ['left']);
        for (let i = 0; i < PREFERRED_TRIM_SIZE + 1; i++) {
            arr1.insert(i, [i]);
        }
        arr2.insert(0, ['right']);
        for (let i = 0; i < PREFERRED_TRIM_SIZE + 1; i++) {
            arr2.insert(i, [i]);
        }

        console.log('[test2] advance timers');
        await sleep(10);
        // await jest.advanceTimersByTimeAsync(100);

        console.log('[test2] fetch1');
        await runTask(() => fetchUpdates(persistence1));
        console.log('[test2] fetch2');
        await runTask(() => fetchUpdates(persistence2));
        console.log('[test2] done');
        expect(persistence1.dbsize).toBeLessThan(10);
        expect(persistence2.dbsize).toBeLessThan(10);
        expect(arr1.toArray()).toEqual(arr2.toArray());

        // await jest.runAllTimersAsync();
        console.log('[test2] completed');
    });

    it('should support metadata storage', async () => {
        const ydoc = new Doc();
        const persistence = new YjsIndexedDBPersistence('test3', ydoc);
        persistence.set('a', 4);
        persistence.set(4, 'meta!');
        persistence.set('obj', { a: 4 });
        const resA = await runTask(() => persistence.get('a'));

        expect(resA).toEqual(4);
        const resB = await runTask(() => persistence.get(4));
        expect(resB).toEqual('meta!');
        const resC = await runTask(() => persistence.get('obj'));

        expect(resC).toEqual({ a: 4 });
    });

    it('should support destroy', async () => {
        let hasbeenSyced = false;
        const ydoc = new Doc();
        const indexDBProvider = new YjsIndexedDBPersistence('test4', ydoc);
        let sub = indexDBProvider.onSyncChanged.subscribe((synced) => {
            if (synced) {
                hasbeenSyced = true;
            }
        });

        indexDBProvider.destroy();
        // jest.advanceTimersByTime(500);
        await sleep(10);
        await waitAsync();

        expect(hasbeenSyced).toBe(false);

        sub.unsubscribe();
    });

    it('should support broadcasting changes to other instances', async () => {
        const doc1 = new Doc();
        const doc2 = new Doc();
        const persistence1 = new YjsIndexedDBPersistence('test5', doc1, {
            broadcastChanges: true,
        });
        const persistence2 = new YjsIndexedDBPersistence('test5', doc2, {
            broadcastChanges: true,
        });
        await runTask(() => persistence1.whenSynced);
        await runTask(() => persistence2.whenSynced);

        const arr1 = doc1.getArray('t');
        const arr2 = doc2.getArray('t');

        arr1.insert(0, [0]);

        // await jest.runAllTimersAsync();
        for (let i = 0; i < 10; i++) {
            await waitAsync();
        }

        expect(arr2.toArray()).toEqual(arr1.toArray());

        persistence1.destroy();
        persistence2.destroy();
    });
});
