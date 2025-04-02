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
import type { CacheControlHeaderValues } from './CacheHelpers';
import {
    parseCacheControlHeader,
    formatCacheControlHeader,
} from './CacheHelpers';

describe('CacheHelpers', () => {
    describe('parseCacheControlHeader()', () => {
        const cases: [string, CacheControlHeaderValues][] = [
            ['public', { public: true }],
            ['private', { private: true }],
            ['max-age=10', { 'max-age': 10 }],
            ['public, max-age=10', { public: true, 'max-age': 10 }],
            ['s-maxage=10', { 's-maxage': 10 }],
            ['no-cache', { 'no-cache': true }],
            ['no-store', { 'no-store': true }],
        ];

        it.each(cases)('should parse %s', (header, expected) => {
            const result = parseCacheControlHeader(header);

            expect(result).toEqual(expected);
        });
    });

    describe('formatCacheControlHeader()', () => {
        const cases: [string, CacheControlHeaderValues][] = [
            ['public', { public: true }],
            ['private', { private: true }],
            ['max-age=10', { 'max-age': 10 }],
            ['public, max-age=10', { public: true, 'max-age': 10 }],
            ['s-maxage=10', { 's-maxage': 10 }],
            ['no-cache', { 'no-cache': true }],
            ['no-store', { 'no-store': true }],
            ['', {}],
        ];

        it.each(cases)('should format %s', (expected, data) => {
            const result = formatCacheControlHeader(data);

            expect(result).toBe(expected);
        });
    });
});
