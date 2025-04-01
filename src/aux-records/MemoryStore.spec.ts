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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { MemoryStore } from './MemoryStore';

describe('MemoryStore', () => {
    let subject: MemoryStore;

    beforeEach(() => {
        subject = new MemoryStore({
            subscriptions: null as any,
        });
    });

    describe('getAllUpdates()', () => {
        it('should return an null by default', async () => {
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual(null);
        });

        it('should return the added updates', async () => {
            await subject.addRecord({
                name: 'recordName',
                ownerId: 'ownerId',
                secretHashes: [],
                secretSalt: '',
                studioId: null,
            });

            await subject.saveInst({
                recordName: 'recordName',
                inst: 'inst',
                markers: [PUBLIC_READ_MARKER],
            });
            await subject.addUpdates('recordName', 'inst', 'test', ['def'], 3);
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual({
                updates: ['def'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 3,
            });
        });
    });

    describe('clearUpdates()', () => {
        it('should clear the updates for a branch', async () => {
            await subject.saveInst({
                recordName: 'recordName',
                inst: 'inst',
                markers: [PUBLIC_READ_MARKER],
            });
            await subject.addUpdates('recordName', 'inst', 'test', ['abc'], 3);
            await subject.deleteBranch('recordName', 'inst', 'test');
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual(null);
        });
    });
});
