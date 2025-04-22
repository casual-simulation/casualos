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
import type { PackageRecordVersionKeySpecifier } from './PackageVersionRecordsStore';
import {
    formatVersionSpecifier,
    getPackageVersionKey,
} from './PackageVersionRecordsStore';

describe('getPackageVersionKey()', () => {
    it('should be able to parse the given key', () => {
        expect(getPackageVersionKey('v1.0.0', null, 0, 0, '')).toEqual({
            success: true,
            key: {
                major: 1,
                minor: 0,
                patch: 0,
                tag: '',
            },
        });
    });

    it('should be able use the given major, minor, patch and tag', () => {
        expect(getPackageVersionKey(null, 1, 0, 0, '')).toEqual({
            success: true,
            key: {
                major: 1,
                minor: 0,
                patch: 0,
                tag: '',
            },
        });
    });
});

describe('formatVersionSpecifier()', () => {
    const cases: [PackageRecordVersionKeySpecifier, string][] = [
        [{}, 'latest'],
        [
            {
                major: 1,
            },
            '1.x.x',
        ],
        [
            {
                major: 1,
                minor: 0,
            },
            '1.0.x',
        ],
        [
            {
                major: 1,
                minor: 0,
                patch: 0,
            },
            '1.0.0',
        ],
        [
            {
                major: 1,
                minor: 0,
                patch: 0,
                tag: 'abc',
            },
            '1.0.0-abc',
        ],
        [
            {
                sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            },
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ],
        [
            {
                major: 1,
                minor: 0,
                patch: 0,
                tag: 'abc',
                sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            },
            '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ],
    ];

    it.each(cases)('should format %j to %s', (input, expected) => {
        const result = formatVersionSpecifier(input);
        expect(result).toEqual(expected);
    });
});
