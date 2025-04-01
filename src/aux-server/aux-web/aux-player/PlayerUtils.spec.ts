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
import { sortInsts } from './PlayerUtils';

describe('sortInsts()', () => {
    it('should work with a single inst', () => {
        const result = sortInsts('test', 'other');
        expect(result).toBe('test');
    });

    it('should work with an array of one item', () => {
        const result = sortInsts(['test'], 'other');
        expect(result).toEqual(['test']);
    });

    it('should sort the inst matching the current one first', () => {
        const result = sortInsts(['test', 'other', 'third'], 'other');
        expect(result).toEqual(['other', 'test', 'third']);
    });

    it('should preserve the order of a list that is already sorted', () => {
        const result = sortInsts(['test', 'other', 'third'], 'test');
        expect(result).toEqual(['test', 'other', 'third']);
    });
});
