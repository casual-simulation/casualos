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
import { remapProgressPercent } from './StatusUpdateUtils';
import type { StatusUpdate } from './StatusUpdate';

describe('SharedUtils', () => {
    describe('remapProgressPercent', () => {
        let cases = [
            [0, 0, 0, 1],
            [0, 0.1, 0.1, 1],
            [0, 0.25, 0.25, 1],
            [0.25, 0.4375, 0.25, 1],
            [1, 1, 0.25, 1],
            [1, 0.5, 0.25, 0.5],
        ];

        it.each(cases)(
            'should map %d to %d in range (%d - %d)',
            (value: number, expected: number, start: number, end: number) => {
                let func = remapProgressPercent(start, end);

                let result = func({
                    type: 'progress',
                    progress: value,
                    message: 'a',
                });

                expect(result).toEqual({
                    type: 'progress',
                    message: 'a',
                    progress: expected,
                });
            }
        );

        it('should not affect non progress messages', () => {
            let message: StatusUpdate = {
                type: 'init',
            };

            let result = remapProgressPercent(0, 1)(message);

            expect(result).toBe(message);
        });
    });
});
