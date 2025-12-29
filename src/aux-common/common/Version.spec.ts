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
    parseVersionNumber,
    formatVersionNumber,
    compareVersions,
} from './Version';

describe('parseVersionNumber()', () => {
    const cases = [
        [
            'v1.0.0',
            {
                version: 'v1.0.0',
                major: 1,
                minor: 0,
                patch: 0,
                alpha: false,
                tag: null as string,
            },
        ] as const,
        [
            'v0.1.54',
            {
                version: 'v0.1.54',
                major: 0,
                minor: 1,
                patch: 54,
                alpha: false,
                tag: null as string,
            },
        ] as const,
        [
            'v0.22.4',
            {
                version: 'v0.22.4',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: false,
                tag: null as string,
            },
        ] as const,
        [
            'v0.22.4-alpha.0',
            {
                version: 'v0.22.4-alpha.0',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: 0,
                tag: 'alpha.0',
            },
        ] as const,
        [
            'v0.22.4-alpha.997',
            {
                version: 'v0.22.4-alpha.997',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: 997,
                tag: 'alpha.997',
            },
        ] as const,
        [
            'v0.22.4-alpha',
            {
                version: 'v0.22.4-alpha',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: true,
                tag: 'alpha',
            },
        ] as const,
        [
            'v0.22.4-dev:alpha',
            {
                version: 'v0.22.4-dev:alpha',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: true,
                tag: 'alpha',
            },
        ] as const,
        [
            'v0.22.4-alpha.0',
            {
                version: 'v0.22.4-alpha.0',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: 0,
                tag: 'alpha.0',
            },
        ] as const,
        [
            'v0.22.4-alpha.997',
            {
                version: 'v0.22.4-alpha.997',
                major: 0,
                minor: 22,
                patch: 4,
                alpha: 997,
                tag: 'alpha.997',
            },
        ] as const,
    ];

    it.each(cases)('should parse %s', (version, expected) => {
        expect(parseVersionNumber(version)).toEqual(expected);
    });

    const nullCases = [
        ['null', null],
        ['a empty string', ''],
    ];

    it.each(nullCases)('should handle %s', (desc, val) => {
        expect(parseVersionNumber(val)).toEqual({
            version: null,
            major: null,
            minor: null,
            patch: null,
            alpha: null,
            tag: null,
        });
    });
});

describe('formatVersionNumber()', () => {
    const cases: [number, number, number, string, string][] = [
        [1, 0, 0, '', 'v1.0.0'],
        [0, 0, 1, '', 'v0.0.1'],
        [0, 0, 1, 'alpha', 'v0.0.1-alpha'],
        [1, 2, 3, '', 'v1.2.3'],
        [1, 2, 3, 'alpha', 'v1.2.3-alpha'],
        [1, 2, 3, 'alpha.0', 'v1.2.3-alpha.0'],
        [1, 2, 3, 'alpha.997', 'v1.2.3-alpha.997'],
    ];

    it.each(cases)(
        'should format %s.%s.%s-%s',
        (major, minor, patch, tag, expected) => {
            const formatted = formatVersionNumber(major, minor, patch, tag);
            expect(formatted).toEqual(expected);

            expect(parseVersionNumber(formatted)).toEqual({
                major: major,
                minor: minor,
                patch: patch,
                tag: tag || null,
                alpha: expect.anything(),
                version: formatted,
            });
        }
    );
});

describe('compareVersions()', () => {
    const cases = [
        ['equal', 'v1.2.3', 'v1.2.3', 0] as const,
        ['equal with tag', 'v1.2.3-alpha', 'v1.2.3-alpha', 0] as const,
        [
            'equal with tag and number',
            'v1.2.3-alpha.1',
            'v1.2.3-alpha.1',
            0,
        ] as const,

        ['major less than', 'v0.2.3', 'v1.2.3', -1] as const,
        ['major greater than', 'v2.2.3', 'v1.2.3', 1] as const,

        ['minor less than', 'v1.1.3', 'v1.2.3', -1] as const,
        ['minor greater than', 'v1.3.3', 'v1.2.3', 1] as const,

        ['patch less than', 'v1.2.1', 'v1.2.3', -1] as const,
        ['patch greater than', 'v1.2.3', 'v1.2.1', 1] as const,

        ['no tag vs tag', 'v1.2.3', 'v1.2.3-alpha', 1] as const,
        ['tag vs no tag', 'v1.2.3-alpha', 'v1.2.3', -1] as const,

        ['tag vs tag', 'v1.2.3-beta', 'v1.2.3-alpha', 1] as const,
        ['tag vs tag reversed', 'v1.2.3-alpha', 'v1.2.3-beta', -1] as const,
    ];

    it.each(cases)(
        'should compare %s',
        (_desc, firstStr, secondStr, expected) => {
            const first = parseVersionNumber(firstStr);
            const second = parseVersionNumber(secondStr);
            expect(compareVersions(first, second)).toEqual(expected);
        }
    );
});
