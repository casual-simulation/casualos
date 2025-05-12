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
import { iteratePartitions } from './AuxPartition';

describe('iteratePartitions()', () => {
    const shared = { shared: true };
    const tempLocal = { tempLocal: true };
    const local = { local: true };
    const tempShared = { tempShared: true };
    const remoteTempShared = { remoteTempShared: true };
    const bootstrap = { bootstrap: true };
    const unknown1 = { unknown1: true };
    const unknown2 = { unknown2: true };
    const unknown3 = { unknown3: true };

    it('should iterate the partitions', () => {
        const partitions = {
            shared: shared,
            tempLocal: tempLocal,
            local: local,
            tempShared: tempShared,
            remoteTempShared: remoteTempShared,
            bootstrap: bootstrap,
        };

        const result = iteratePartitions(partitions);

        expect(result.next().value).toEqual(['shared', shared]);
        expect(result.next().value).toEqual(['tempLocal', tempLocal]);
        expect(result.next().value).toEqual(['local', local]);
        expect(result.next().value).toEqual(['tempShared', tempShared]);
        expect(result.next().value).toEqual([
            'remoteTempShared',
            remoteTempShared,
        ]);
        expect(result.next().value).toEqual(['bootstrap', bootstrap]);
        expect(result.next().done).toBe(true);
    });

    it('should iterate the partitions in the correct order', () => {
        const partitions = {
            tempLocal: tempLocal,
            shared: shared,
            tempShared: tempShared,
            local: local,
            bootstrap: bootstrap,
            remoteTempShared: remoteTempShared,
        };

        const result = iteratePartitions(partitions);

        expect(result.next().value).toEqual(['shared', shared]);
        expect(result.next().value).toEqual(['tempLocal', tempLocal]);
        expect(result.next().value).toEqual(['local', local]);
        expect(result.next().value).toEqual(['tempShared', tempShared]);
        expect(result.next().value).toEqual([
            'remoteTempShared',
            remoteTempShared,
        ]);
        expect(result.next().value).toEqual(['bootstrap', bootstrap]);
        expect(result.next().done).toBe(true);
    });

    it('should iterate unknown partitions last in the order they are specified', () => {
        const partitions = {
            unknown2: unknown2,
            tempLocal: tempLocal,
            shared: shared,
            unknown1: unknown1,
            tempShared: tempShared,
            local: local,
            unknown3: unknown3,
            bootstrap: bootstrap,
            remoteTempShared: remoteTempShared,
        };

        const result = iteratePartitions(partitions);

        expect(result.next().value).toEqual(['shared', shared]);
        expect(result.next().value).toEqual(['tempLocal', tempLocal]);
        expect(result.next().value).toEqual(['local', local]);
        expect(result.next().value).toEqual(['tempShared', tempShared]);
        expect(result.next().value).toEqual([
            'remoteTempShared',
            remoteTempShared,
        ]);
        expect(result.next().value).toEqual(['bootstrap', bootstrap]);
        expect(result.next().value).toEqual(['unknown2', unknown2]);
        expect(result.next().value).toEqual(['unknown1', unknown1]);
        expect(result.next().value).toEqual(['unknown3', unknown3]);
        expect(result.next().done).toBe(true);
    });
});
