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
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';

/**
 * Defines a host that a proxy is able to send requests to.
 */
export interface ProxyHost {
    /**
     * The name of the host. (e.g. `example.com`)
     * IPv6 addresses are returned without the surrounding brackets.
     */
    hostname: string;

    /**
     * The port that requests should be sent to.
     * Null if the default port should be used.
     */
    port: number | null;
}

/**
 * Parses the given proxy host into its host name and port.
 *
 * Returns a failure if the host is not a valid host.
 * Hosts are not allowed to contain a scheme, user info, path, query string, or fragment.
 *
 * @param host The host that should be parsed. (e.g. `example.com:8443`)
 */
export function parseProxyHost(host: string): Result<ProxyHost, SimpleError> {
    if (typeof host !== 'string' || host.trim().length <= 0) {
        return invalidHost(host);
    }

    const value = host.trim();

    if (
        value.includes('/') ||
        value.includes('@') ||
        value.includes('?') ||
        value.includes('#') ||
        value.includes(' ')
    ) {
        return invalidHost(host);
    }

    let hostname: string;
    let portString: string | null = null;

    if (value.startsWith('[')) {
        // IPv6 literal. (e.g. [::1]:8443)
        const end = value.indexOf(']');
        if (end < 0) {
            return invalidHost(host);
        }
        hostname = value.slice(1, end);
        const rest = value.slice(end + 1);
        if (rest.length > 0) {
            if (!rest.startsWith(':')) {
                return invalidHost(host);
            }
            portString = rest.slice(1);
        }
    } else {
        const colon = value.indexOf(':');
        if (colon >= 0) {
            if (value.indexOf(':', colon + 1) >= 0) {
                // Bare IPv6 addresses have to be surrounded by brackets.
                return invalidHost(host);
            }
            hostname = value.slice(0, colon);
            portString = value.slice(colon + 1);
        } else {
            hostname = value;
        }
    }

    if (hostname.length <= 0) {
        return invalidHost(host);
    }

    let port: number | null = null;
    if (portString !== null) {
        if (!/^\d{1,5}$/.test(portString)) {
            return invalidHost(host);
        }
        port = parseInt(portString, 10);
        if (port <= 0 || port > 65535) {
            return invalidHost(host);
        }
    }

    return success({
        hostname,
        port,
    });
}

function invalidHost(host: string): Result<never, SimpleError> {
    return failure({
        errorCode: 'invalid_proxy_host',
        errorMessage: `The proxy host (${host}) is not valid. Hosts must be in the form "example.com" or "example.com:8443".`,
    });
}
