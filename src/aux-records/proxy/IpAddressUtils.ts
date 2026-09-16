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

/**
 * Determines whether the given IP address is a public IP address.
 *
 * Returns false for any address that is not routable on the public internet.
 * (e.g. loopback, link-local, private, multicast, and reserved addresses)
 *
 * This is used to make sure that proxies are not able to be used to reach
 * services on the internal network.
 *
 * @param ip The IP address that should be checked. Can be an IPv4 or IPv6 address.
 */
export function isPublicIpAddress(ip: string): boolean {
    if (!ip) {
        return false;
    }

    const address = ip.trim().toLowerCase();

    // Strip the zone index (e.g. fe80::1%eth0) if it exists.
    const zoneIndex = address.indexOf('%');
    const withoutZone = zoneIndex >= 0 ? address.slice(0, zoneIndex) : address;

    const ipv4 = parseIpv4(withoutZone);
    if (ipv4) {
        return isPublicIpv4(ipv4);
    }

    const ipv6 = parseIpv6(withoutZone);
    if (ipv6) {
        // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) addresses
        // need to be evaluated using the IPv4 rules.
        const mapped = getMappedIpv4(ipv6);
        if (mapped) {
            return isPublicIpv4(mapped);
        }

        return isPublicIpv6(ipv6);
    }

    return false;
}

/**
 * Parses the given IPv4 address into its four octets.
 * Returns null if the given value is not a valid IPv4 address.
 * @param ip The address to parse.
 */
export function parseIpv4(ip: string): number[] | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
        return null;
    }

    const octets: number[] = [];
    for (let part of parts) {
        if (!/^\d{1,3}$/.test(part)) {
            return null;
        }
        const value = parseInt(part, 10);
        if (value > 255) {
            return null;
        }
        octets.push(value);
    }

    return octets;
}

/**
 * Parses the given IPv6 address into its eight 16-bit groups.
 * Returns null if the given value is not a valid IPv6 address.
 * @param ip The address to parse.
 */
export function parseIpv6(ip: string): number[] | null {
    if (ip.indexOf(':') < 0) {
        return null;
    }

    let value = ip;
    let trailingIpv4: number[] | null = null;

    const lastColon = value.lastIndexOf(':');
    const lastSegment = value.slice(lastColon + 1);
    if (lastSegment.indexOf('.') >= 0) {
        trailingIpv4 = parseIpv4(lastSegment);
        if (!trailingIpv4) {
            return null;
        }
        value = value.slice(0, lastColon + 1);
        value =
            value +
            toHex((trailingIpv4[0] << 8) | trailingIpv4[1]) +
            ':' +
            toHex((trailingIpv4[2] << 8) | trailingIpv4[3]);
    }

    const doubleColon = value.indexOf('::');
    let head: string[];
    let tail: string[];
    if (doubleColon >= 0) {
        if (value.indexOf('::', doubleColon + 1) >= 0) {
            // Only one '::' is allowed.
            return null;
        }
        head = splitGroups(value.slice(0, doubleColon));
        tail = splitGroups(value.slice(doubleColon + 2));
        if (head.length + tail.length > 7) {
            return null;
        }
    } else {
        head = splitGroups(value);
        tail = [];
        if (head.length !== 8) {
            return null;
        }
    }

    const groups: number[] = [];
    for (let group of head) {
        const parsed = parseGroup(group);
        if (parsed === null) {
            return null;
        }
        groups.push(parsed);
    }

    const missing = 8 - (head.length + tail.length);
    for (let i = 0; i < missing; i++) {
        groups.push(0);
    }

    for (let group of tail) {
        const parsed = parseGroup(group);
        if (parsed === null) {
            return null;
        }
        groups.push(parsed);
    }

    if (groups.length !== 8) {
        return null;
    }

    return groups;
}

function splitGroups(value: string): string[] {
    if (value.length <= 0) {
        return [];
    }
    return value.split(':');
}

function parseGroup(group: string): number | null {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
        return null;
    }
    return parseInt(group, 16);
}

function toHex(value: number): string {
    return value.toString(16);
}

function isPublicIpv4(octets: number[]): boolean {
    const [a, b] = octets;

    // 0.0.0.0/8 - "This network"
    if (a === 0) {
        return false;
    }

    // 10.0.0.0/8 - Private
    if (a === 10) {
        return false;
    }

    // 100.64.0.0/10 - Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) {
        return false;
    }

    // 127.0.0.0/8 - Loopback
    if (a === 127) {
        return false;
    }

    // 169.254.0.0/16 - Link local (includes cloud metadata services)
    if (a === 169 && b === 254) {
        return false;
    }

    // 172.16.0.0/12 - Private
    if (a === 172 && b >= 16 && b <= 31) {
        return false;
    }

    // 192.0.0.0/24 - IETF protocol assignments
    if (a === 192 && b === 0 && octets[2] === 0) {
        return false;
    }

    // 192.0.2.0/24 - TEST-NET-1
    if (a === 192 && b === 0 && octets[2] === 2) {
        return false;
    }

    // 192.168.0.0/16 - Private
    if (a === 192 && b === 168) {
        return false;
    }

    // 198.18.0.0/15 - Benchmarking
    if (a === 198 && (b === 18 || b === 19)) {
        return false;
    }

    // 198.51.100.0/24 - TEST-NET-2
    if (a === 198 && b === 51 && octets[2] === 100) {
        return false;
    }

    // 203.0.113.0/24 - TEST-NET-3
    if (a === 203 && b === 0 && octets[2] === 113) {
        return false;
    }

    // 224.0.0.0/4 - Multicast, 240.0.0.0/4 - Reserved (includes 255.255.255.255)
    if (a >= 224) {
        return false;
    }

    return true;
}

function getMappedIpv4(groups: number[]): number[] | null {
    const isZeroPrefix = groups.slice(0, 5).every((g) => g === 0);

    if (!isZeroPrefix) {
        return null;
    }

    if (groups[5] !== 0 && groups[5] !== 0xffff) {
        return null;
    }

    if (groups[5] === 0 && groups[6] === 0 && groups[7] <= 1) {
        // :: (unspecified) and ::1 (loopback) are not IPv4 addresses.
        return null;
    }

    return [
        (groups[6] >> 8) & 0xff,
        groups[6] & 0xff,
        (groups[7] >> 8) & 0xff,
        groups[7] & 0xff,
    ];
}

function isPublicIpv6(groups: number[]): boolean {
    const first = groups[0];

    // :: (unspecified)
    if (groups.every((g) => g === 0)) {
        return false;
    }

    // ::1 (loopback)
    if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) {
        return false;
    }

    // fc00::/7 - Unique local addresses
    if ((first & 0xfe00) === 0xfc00) {
        return false;
    }

    // fe80::/10 - Link local addresses
    if ((first & 0xffc0) === 0xfe80) {
        return false;
    }

    // ff00::/8 - Multicast
    if ((first & 0xff00) === 0xff00) {
        return false;
    }

    // 2001:db8::/32 - Documentation
    if (first === 0x2001 && groups[1] === 0x0db8) {
        return false;
    }

    // 64:ff9b::/96 and 64:ff9b:1::/48 - NAT64. These translate to IPv4 addresses,
    // so they are not safe to allow.
    if (first === 0x0064 && groups[1] === 0xff9b) {
        return false;
    }

    return true;
}
