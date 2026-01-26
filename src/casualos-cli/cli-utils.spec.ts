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
import { parseEntitlements } from './cli-utils';

describe('parseEntitlements()', () => {
    const cases = [
        [
            'data:personal',
            {
                feature: 'data',
                scope: 'personal',
            },
        ] as const,
        [
            'file:personal',
            {
                feature: 'file',
                scope: 'personal',
            },
        ] as const,
        [
            'inst:personal',
            {
                feature: 'inst',
                scope: 'personal',
            },
        ] as const,
        [
            'data:owned',
            {
                feature: 'data',
                scope: 'owned',
            },
        ] as const,
        [
            'file:shared:record1:record2',
            {
                feature: 'file',
                scope: 'shared',
                designatedRecords: ['record1', 'record2'],
            },
        ] as const,
    ];

    it.each(cases)('should parse "%s"', (input, expected) => {
        const result = parseEntitlements([input]);
        expect(result).toEqual([expected]);
    });
});
