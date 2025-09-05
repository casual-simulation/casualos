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
import * as os from 'os';
import * as process from 'process';
import type { Handler } from 'express';
import type { AxiosError } from 'axios';

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((er) => {
            const err: AxiosError = er;
            if (err.response && err.response.data) {
                console.error(
                    'An Axios request failed.',
                    err,
                    err.response.data
                );
            }

            next(er);
        });
    };
};

/**
 * Gets the list of IP Addresses that are assigned to this machine.
 * Excludes internal IP Addresses. (e.g. 127.0.0.1)
 */
export function getLocalIpAddresses() {
    const ifaces = os.networkInterfaces();
    return Object.keys(ifaces).flatMap((ifname) => {
        return ifaces[ifname]
            .filter((iface) => !iface.internal)
            .map((iface) => iface.address);
    });
}

/**
 * Gets the domains that should be added to the given site for development purposes.
 * @param site
 */
export function getExtraDomainsForSite(site: 'projector' | 'player'): string[] {
    const env = process.env.NODE_ENV;
    if (env === 'production') {
        if (site === 'projector') {
            return ['localhost'];
        }
    } else {
        const mode = process.argv[2];
        if (
            mode === site ||
            (typeof mode === 'undefined' && site === 'projector')
        ) {
            return ['localhost', ...getLocalIpAddresses()];
        }
    }

    return [];
}
