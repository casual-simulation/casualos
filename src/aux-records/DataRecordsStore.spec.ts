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
import type { UserPolicy } from './DataRecordsStore';
import { doesSubjectMatchPolicy, isValidUserPolicy } from './DataRecordsStore';

describe('isValidUserPolicy()', () => {
    const cases: [boolean, any][] = [
        [true, true],
        [true, ['abc']],
        [true, ['abc', 'def']],
        [false, false],
        [false, null],
        [false, 123],
        [false, {}],
        [false, ['abc', 123]],
        [false, ['abc', false]],
        [false, [123, 'abc']],
    ];

    it.each(cases)('should return %s when given %s', (expected, given) => {
        expect(isValidUserPolicy(given)).toBe(expected);
    });
});

describe('doesSubjectMatchPolicy()', () => {
    const cases: [boolean, UserPolicy, string][] = [
        [true, true, 'subject'],
        [true, true, null],
        [true, ['subject'], 'subject'],
        [true, ['not_subject', 'subject'], 'subject'],
        [false, [], 'subject'],
        [false, ['not_subject'], 'subject'],
        [false, ['not_subject'], null],
    ];

    it.each(cases)(
        'should return %s when given (%s, %s)',
        (expected, policy, subject) => {
            expect(doesSubjectMatchPolicy(policy, subject)).toBe(expected);
        }
    );
});
