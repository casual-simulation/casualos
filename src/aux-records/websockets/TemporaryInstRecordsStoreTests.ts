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

import type { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';

export function temporaryCompactionContract(
    create: () => Promise<TemporaryInstRecordsStore>
) {
    let store: TemporaryInstRecordsStore;
    beforeEach(async () => {
        store = await create();
        await store.addUpdates(null, 'inst', 'branch', ['aaa', 'bbb'], 6);
    });
    it('preserves appended updates, snapshot isolation, counts and sizes', async () => {
        const snapshot = await store.getUpdates(null, 'inst', 'branch');
        await store.addUpdates(null, 'inst', 'branch', ['cc'], 2);
        expect(snapshot.updates).toEqual(['aaa', 'bbb']);
        expect(
            await store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab')
        ).toBe(true);
        expect(
            (await store.getUpdates(null, 'inst', 'branch')).updates
        ).toEqual(['ab', 'cc']);
        expect(await store.countBranchUpdates(null, 'inst', 'branch')).toBe(2);
        expect(await store.getBranchSize(null, 'inst', 'branch')).toBe(4);
        expect(await store.getInstSize(null, 'inst')).toBe(4);
    });
    it('allows only one concurrent compactor to replace a snapshot', async () => {
        const snapshot = await store.getUpdates(null, 'inst', 'branch');
        const results = await Promise.all([
            store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab'),
            store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab'),
        ]);
        expect(results.sort()).toEqual([false, true]);
        expect(
            (await store.getUpdates(null, 'inst', 'branch')).updates
        ).toEqual(['ab']);
        expect(await store.getInstSize(null, 'inst')).toBe(2);
    });
    it('refuses a deleted snapshot without resurrecting the branch', async () => {
        const snapshot = await store.getUpdates(null, 'inst', 'branch');
        await store.deleteBranch(null, 'inst', 'branch');
        expect(
            await store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab')
        ).toBe(false);
        expect(
            (await store.getUpdates(null, 'inst', 'branch'))?.updates ?? []
        ).toEqual([]);
    });
    it('never exposes an empty or partially compacted list to readers', async () => {
        const snapshot = await store.getUpdates(null, 'inst', 'branch');
        const reads = await Promise.all([
            store.getUpdates(null, 'inst', 'branch'),
            store.compactUpdates(null, 'inst', 'branch', snapshot, 'ab'),
            store.getUpdates(null, 'inst', 'branch'),
        ]);
        for (const result of [reads[0], reads[2]]) {
            expect([['aaa', 'bbb'], ['ab']]).toContainEqual(
                (result as any).updates
            );
        }
    });
}
