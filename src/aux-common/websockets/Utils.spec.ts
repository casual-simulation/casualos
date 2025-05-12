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
    branchNamespace,
    branchFromNamespace,
    parseInstId,
    normalizeInstId,
} from './Utils';

describe('branchNamespace()', () => {
    it('should use the default namespace for branches', () => {
        expect(
            branchNamespace('branch', 'recordName', 'inst', 'testBranch')
        ).toBe(`/branch/recordName/inst/testBranch`);

        expect(branchNamespace('branch', null, 'inst', 'testBranch')).toBe(
            `/branch//inst/testBranch`
        );
    });
});

describe('branchFromNamespace()', () => {
    it('should parse correctly', () => {
        expect(
            branchFromNamespace('branch', '/branch/recordName/inst/testBranch')
        ).toEqual({
            recordName: 'recordName',
            inst: 'inst',
            branch: 'testBranch',
        });

        expect(
            branchFromNamespace('branch', '/branch//inst/testBranch')
        ).toEqual({
            recordName: null,
            inst: 'inst',
            branch: 'testBranch',
        });
    });
});

describe('parseInstId()', () => {
    const cases = [
        [null as any, null as any] as const,
        ['abc', null as any] as const,
        ['/abc', { recordName: null as any, inst: 'abc' }] as const,
        ['record/abc', { recordName: 'record', inst: 'abc' }] as const,
    ];

    it.each(cases)('should parse %s', (input: string, expected: any) => {
        const result = parseInstId(input);
        expect(result).toEqual(expected);
    });
});

describe('normalizeInstId()', () => {
    const cases = [
        [null as any, null as any],
        ['abc', '/abc'],
        ['/abc', '/abc'],
        ['record/abc', 'record/abc'],
    ];

    it.each(cases)(
        'should normalize %s to %s',
        (input: string, expected: string) => {
            const result = normalizeInstId(input);
            expect(result).toEqual(expected);
        }
    );
});
