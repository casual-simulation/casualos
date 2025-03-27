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
import {
    createPrecalculatedBot,
    cacheFunction,
    createPrecalculatedContext,
} from '.';

describe('BotCalculationContext', () => {
    describe('cacheFunction()', () => {
        it('should not run into conflicts when arguments are symmetrical', () => {
            const bot1 = createPrecalculatedBot('bot1');
            const bot2 = createPrecalculatedBot('bot2');

            const calc = createPrecalculatedContext([bot1, bot2]);

            const result1 = cacheFunction(
                calc,
                'test',
                () => {
                    return 'first';
                },
                'a',
                'ab'
            );

            const result2 = cacheFunction(
                calc,
                'test',
                () => {
                    return 'second';
                },
                'aa',
                'b'
            );

            expect(result1).not.toEqual(result2);
        });
    });
});
