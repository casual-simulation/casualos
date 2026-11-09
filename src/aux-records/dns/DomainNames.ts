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

const MAX_DOMAIN_NAME_LENGTH = 253;
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const INVALID_CHARACTERS_REGEX = /[\s/\\:?#@[\]*%]/;

/**
 * Normalizes the given domain name so that it can be stored and compared.
 *
 * The name is lower-cased, a trailing dot is removed and internationalized names are converted to their ASCII (punycode) form.
 * Returns null if the given value is not a valid host name (e.g. it contains a scheme, path, port or wildcard, or is an IP address).
 * @param domainName The domain name that should be normalized.
 */
export function normalizeDomainName(domainName: string): string | null {
    if (typeof domainName !== 'string') {
        return null;
    }

    let name = domainName.trim().toLowerCase();
    if (name.endsWith('.')) {
        name = name.slice(0, -1);
    }

    if (!name || INVALID_CHARACTERS_REGEX.test(name)) {
        return null;
    }

    let hostname: string;
    try {
        // URL parsing converts internationalized names to punycode.
        hostname = new URL(`http://${name}`).hostname;
    } catch (err) {
        return null;
    }

    if (!hostname || hostname.length > MAX_DOMAIN_NAME_LENGTH) {
        return null;
    }

    const labels = hostname.split('.');
    if (labels.length < 2 || !labels.every((l) => LABEL_REGEX.test(l))) {
        return null;
    }

    // Top-level domains are never all numeric, so this rejects IPv4 addresses.
    if (/^[0-9]+$/.test(labels[labels.length - 1])) {
        return null;
    }

    return hostname;
}
