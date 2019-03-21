import {Request, Response, Handler} from 'express';
import { AxiosError } from 'axios';
import * as os from 'os';
import { flatMap } from 'lodash';

export const asyncMiddleware: (fn: Handler) => Handler = (fn: Handler) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next))
            .catch(er => {
                const err : AxiosError = er;
                if(err.response && err.response.data) {
                    console.error('An Axios request failed.', err, err.response.data);
                }

                next(er);
            });
    };
}

/**
 * Gets the list of IP Addresses that are assigned to this machine.
 * Excludes internal IP Addresses. (e.g. 127.0.0.1)
 */
export function getLocalIpAddresses() {
    const ifaces = os.networkInterfaces();
    return flatMap(Object.keys(ifaces), ifname => {
        return ifaces[ifname]
            .filter(iface => !iface.internal)
            .map(iface => iface.address);
    });
}