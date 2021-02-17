import * as os from 'os';
import * as process from 'process';
import { Handler } from 'express';
import { AxiosError } from 'axios';
import { flatMap } from 'lodash';

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
    return flatMap(Object.keys(ifaces), (ifname) => {
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
