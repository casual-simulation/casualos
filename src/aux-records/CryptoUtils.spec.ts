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
import { randomCode, RANDOM_CODE_LENGTH } from './CryptoUtils';

describe('randomCode()', () => {
    it('should generate a random number code with 6 characters', () => {
        const numbers = new Set<string>();
        let numDuplicates = 0;
        for (let i = 0; i < 100; i++) {
            const code = randomCode();
            expect(code).toHaveLength(RANDOM_CODE_LENGTH);
            expect(code).not.toBe('000000');
            if (numbers.has(code)) {
                numDuplicates++;
            }
            numbers.add(code);
        }
        // There might be a duplicate or two every so often, but it should be rare.
        expect(numDuplicates).toBeLessThan(3);
    });
});
