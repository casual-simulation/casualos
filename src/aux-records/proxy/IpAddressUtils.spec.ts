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
import { isPublicIpAddress, parseIpv4, parseIpv6 } from './IpAddressUtils';

describe('isPublicIpAddress()', () => {
    const publicCases = [
        ['8.8.8.8'],
        ['1.1.1.1'],
        ['172.15.255.255'],
        ['172.32.0.0'],
        ['192.167.255.255'],
        ['192.169.0.0'],
        ['100.63.255.255'],
        ['100.128.0.0'],
        ['223.255.255.255'],
        ['2606:4700:4700::1111'],
        ['2001:db9::1'],
        ['::ffff:8.8.8.8'],
    ];

    it.each(publicCases)('should return true for %s', (ip) => {
        expect(isPublicIpAddress(ip)).toBe(true);
    });

    const privateCases = [
        ['0.0.0.0'],
        ['10.0.0.1'],
        ['10.255.255.255'],
        ['127.0.0.1'],
        ['169.254.169.254'],
        ['172.16.0.1'],
        ['172.16.5.4'],
        ['172.31.255.255'],
        ['192.168.0.1'],
        ['192.0.0.1'],
        ['192.0.2.1'],
        ['198.18.0.1'],
        ['198.51.100.1'],
        ['203.0.113.1'],
        ['100.64.0.1'],
        ['224.0.0.1'],
        ['255.255.255.255'],
        ['::'],
        ['::1'],
        ['fc00::1'],
        ['fd12:3456::1'],
        ['fe80::1'],
        ['fe80::1%eth0'],
        ['ff02::1'],
        ['2001:db8::1'],
        ['64:ff9b::7f00:1'],
        ['::ffff:127.0.0.1'],
        ['::ffff:169.254.169.254'],
        ['::ffff:10.0.0.1'],
    ];

    it.each(privateCases)('should return false for %s', (ip) => {
        expect(isPublicIpAddress(ip)).toBe(false);
    });

    const invalidCases = [
        [''],
        [null as any],
        ['not an ip'],
        ['999.999.999.999'],
        ['1.2.3'],
        ['1.2.3.4.5'],
        ['12345::1'],
        ['::1::2'],
    ];

    it.each(invalidCases)('should return false for %s', (ip) => {
        expect(isPublicIpAddress(ip)).toBe(false);
    });
});

describe('parseIpv4()', () => {
    it('should parse valid addresses', () => {
        expect(parseIpv4('192.168.0.1')).toEqual([192, 168, 0, 1]);
        expect(parseIpv4('0.0.0.0')).toEqual([0, 0, 0, 0]);
        expect(parseIpv4('255.255.255.255')).toEqual([255, 255, 255, 255]);
    });

    it('should return null for invalid addresses', () => {
        expect(parseIpv4('256.0.0.1')).toBe(null);
        expect(parseIpv4('1.2.3')).toBe(null);
        expect(parseIpv4('abc')).toBe(null);
        expect(parseIpv4('1.2.3.4.5')).toBe(null);
    });
});

describe('parseIpv6()', () => {
    it('should parse valid addresses', () => {
        expect(parseIpv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
        expect(parseIpv6('2001:db8::1')).toEqual([
            0x2001, 0x0db8, 0, 0, 0, 0, 0, 1,
        ]);
        expect(parseIpv6('::ffff:127.0.0.1')).toEqual([
            0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001,
        ]);
    });

    it('should return null for invalid addresses', () => {
        expect(parseIpv6('192.168.0.1')).toBe(null);
        expect(parseIpv6('::1::2')).toBe(null);
        expect(parseIpv6('12345::1')).toBe(null);
        expect(parseIpv6('1:2:3:4:5:6:7')).toBe(null);
    });
});
