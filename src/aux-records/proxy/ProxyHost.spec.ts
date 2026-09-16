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
import { unwrap } from '@casual-simulation/aux-common';
import { parseProxyHost } from './ProxyHost';

describe('parseProxyHost()', () => {
    it('should parse a host without a port', () => {
        const result = parseProxyHost('example.com');
        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            hostname: 'example.com',
            port: null,
        });
    });

    it('should parse a host with a port', () => {
        const result = parseProxyHost('example.com:8443');
        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            hostname: 'example.com',
            port: 8443,
        });
    });

    it('should parse an IPv6 literal', () => {
        const result = parseProxyHost('[2606:4700::1111]:8443');
        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            hostname: '2606:4700::1111',
            port: 8443,
        });
    });

    const invalidCases = [
        ['an empty host', ''],
        ['a whitespace host', '   '],
        ['a host with a scheme', 'https://example.com'],
        ['a host with a path', 'example.com/path'],
        ['a host with user info', 'user@example.com'],
        ['a host with a query string', 'example.com?query=1'],
        ['a host with a fragment', 'example.com#fragment'],
        ['a host with a space', 'example .com'],
        ['a host with an invalid port', 'example.com:abc'],
        ['a host with a port that is too large', 'example.com:99999'],
        ['a host with a zero port', 'example.com:0'],
        ['a bare IPv6 address', '2606:4700::1111'],
        ['a missing host name', ':8443'],
    ];

    it.each(invalidCases)('should reject %s', (desc, host) => {
        const result = parseProxyHost(host);
        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('invalid_proxy_host');
    });
});
