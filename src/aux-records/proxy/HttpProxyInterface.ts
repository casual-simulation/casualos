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
import type {
    ProxyInterface,
    ProxyInterfaceRequest,
    ProxyInterfaceResponse,
} from './ProxyInterface';
import { isPublicIpAddress, parseIpv4, parseIpv6 } from './IpAddressUtils';
import https from 'node:https';
import dns from 'node:dns';
import { parseProxyHost } from './ProxyHost';

/**
 * The default maximum number of miliseconds that a host has to respond to a proxied request.
 */
export const DEFAULT_PROXY_TIMEOUT_MS = 10000;

/**
 * The default maximum number of bytes that a proxied response can contain.
 */
export const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;

export interface HttpProxyInterfaceOptions {
    /**
     * The maximum number of bytes that a proxied response is allowed to contain.
     * Defaults to 5MB.
     */
    maxResponseSizeInBytes?: number;

    /**
     * Whether requests to private IP addresses should be allowed.
     * Should only ever be enabled for local development.
     * Defaults to false.
     */
    allowPrivateIpAddresses?: boolean;
}

/**
 * Defines a proxy interface that sends HTTPS requests to the host of a proxy.
 *
 * Before a request is sent, the host name is resolved to a list of IP addresses and
 * each address is checked to make sure that it is a publicly routable address.
 * The connection is then pinned to one of the verified addresses so that it is not possible
 * to use a proxy to reach services on the internal network. (See https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
 */
export class HttpProxyInterface implements ProxyInterface {
    private _maxResponseSizeInBytes: number;
    private _allowPrivateIpAddresses: boolean;

    constructor(options: HttpProxyInterfaceOptions = {}) {
        this._maxResponseSizeInBytes =
            options.maxResponseSizeInBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
        this._allowPrivateIpAddresses =
            options.allowPrivateIpAddresses ?? false;
    }

    async sendRequest(
        request: ProxyInterfaceRequest
    ): Promise<Result<ProxyInterfaceResponse, SimpleError>> {
        const host = parseProxyHost(request.host);
        if (host.success === false) {
            return host;
        }

        const addresses = await this._resolveHost(host.value.hostname);
        if (addresses.success === false) {
            return addresses;
        }

        return await this._sendRequest(
            request,
            host.value.hostname,
            host.value.port,
            addresses.value
        );
    }

    /**
     * Resolves the given host name to the list of IP addresses that are safe to send requests to.
     * @param hostname The host name that should be resolved.
     */
    private async _resolveHost(
        hostname: string
    ): Promise<Result<ResolvedAddress[], SimpleError>> {
        const literal = parseLiteralAddress(hostname);
        if (literal) {
            if (!this._isAllowedAddress(literal.address)) {
                return privateAddressFailure(hostname, literal.address);
            }
            return success([literal]);
        }

        let addresses: dns.LookupAddress[];
        try {
            addresses = await new Promise<dns.LookupAddress[]>(
                (resolve, reject) => {
                    dns.lookup(
                        hostname,
                        { all: true, verbatim: true },
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(result);
                            }
                        }
                    );
                }
            );
        } catch (err) {
            console.error(
                `[HttpProxyInterface] Unable to resolve the host name (${hostname}):`,
                err
            );
            return failure({
                errorCode: 'invalid_proxy_host',
                errorMessage: `Unable to resolve the host name (${hostname}) for the proxy.`,
            });
        }

        if (!addresses || addresses.length <= 0) {
            return failure({
                errorCode: 'invalid_proxy_host',
                errorMessage: `Unable to resolve the host name (${hostname}) for the proxy.`,
            });
        }

        // Every address that the host resolves to has to be public.
        // Otherwise it would be possible to bypass this check by returning
        // a mix of public and private addresses.
        for (let address of addresses) {
            if (!this._isAllowedAddress(address.address)) {
                return privateAddressFailure(hostname, address.address);
            }
        }

        return success(
            addresses.map((a) => ({
                address: a.address,
                family: a.family,
            }))
        );
    }

    private _isAllowedAddress(address: string): boolean {
        if (this._allowPrivateIpAddresses) {
            return true;
        }
        return isPublicIpAddress(address);
    }

    private _sendRequest(
        request: ProxyInterfaceRequest,
        hostname: string,
        port: number | null,
        addresses: ResolvedAddress[]
    ): Promise<Result<ProxyInterfaceResponse, SimpleError>> {
        const maxResponseSizeInBytes = this._maxResponseSizeInBytes;
        const timeoutMs = request.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;
        const target = describeRequest(request, hostname, port, addresses);

        return new Promise<Result<ProxyInterfaceResponse, SimpleError>>(
            (resolve) => {
                let settled = false;
                const settle = (
                    result: Result<ProxyInterfaceResponse, SimpleError>
                ) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    resolve(result);
                };

                let req: ReturnType<typeof https.request>;
                try {
                    req = https.request(
                        {
                            host: hostname,
                            port: port ?? 443,
                            path: request.path,
                            method: request.method,
                            headers: request.headers,
                            timeout: timeoutMs,

                            // Pin the connection to the addresses that were verified above so that
                            // the host name cannot be re-resolved to a private address.
                            lookup: createPinnedLookup(addresses),
                        },
                        (response) => {
                            const chunks: Buffer[] = [];
                            let size = 0;
                            let tooLarge = false;

                            response.on('data', (chunk: Buffer) => {
                                if (tooLarge) {
                                    return;
                                }
                                size += chunk.length;
                                if (size > maxResponseSizeInBytes) {
                                    tooLarge = true;
                                    chunks.length = 0;

                                    // Settle here because destroying the response emits 'close' instead of 'end'
                                    // and destroying the request without an error does not emit 'error'.
                                    console.error(
                                        `[HttpProxyInterface] The response from ${target} was larger than the maximum allowed size (${maxResponseSizeInBytes} bytes).`
                                    );
                                    settle(
                                        failure({
                                            errorCode: 'proxy_request_failed',
                                            errorMessage: `The response from the proxy host was too large. The maximum allowed size is ${maxResponseSizeInBytes} bytes.`,
                                        })
                                    );
                                    response.destroy();
                                    req.destroy();
                                    return;
                                }
                                chunks.push(chunk);
                            });

                            response.on('end', () => {
                                if (tooLarge) {
                                    return;
                                }

                                const headers: {
                                    [key: string]: string;
                                } = {};
                                for (let key of Object.keys(response.headers)) {
                                    const value = response.headers[key];
                                    if (typeof value === 'undefined') {
                                        continue;
                                    }
                                    headers[key.toLowerCase()] = Array.isArray(
                                        value
                                    )
                                        ? value.join(', ')
                                        : value;
                                }

                                settle(
                                    success({
                                        statusCode: response.statusCode ?? 200,
                                        headers,
                                        body: Buffer.concat(chunks).toString(
                                            'utf8'
                                        ),
                                    })
                                );
                            });

                            response.on('error', (err) => {
                                if (tooLarge) {
                                    return;
                                }
                                console.error(
                                    `[HttpProxyInterface] Unable to read the response from ${target}:`,
                                    err
                                );
                                settle(
                                    failure({
                                        errorCode: 'proxy_request_failed',
                                        errorMessage:
                                            'Unable to read the response from the proxy host.',
                                    })
                                );
                            });
                        }
                    );
                } catch (err) {
                    // Node throws synchronously when the request options are invalid.
                    // (e.g. when a header value contains a newline)
                    console.error(
                        `[HttpProxyInterface] Unable to create the request to ${target}:`,
                        err
                    );
                    settle(
                        failure({
                            errorCode: 'proxy_request_failed',
                            errorMessage:
                                'Unable to send the request to the proxy host.',
                        })
                    );
                    return;
                }

                req.on('timeout', () => {
                    console.error(
                        `[HttpProxyInterface] The request to ${target} timed out after ${timeoutMs}ms.`
                    );
                    req.destroy();
                    settle(
                        failure({
                            errorCode: 'took_too_long',
                            errorMessage:
                                'The proxy host took too long to respond.',
                        })
                    );
                });

                req.on('error', (err) => {
                    if (settled) {
                        // The request was already resolved (e.g. it timed out or the response was too large),
                        // so the error was caused by destroying the request.
                        return;
                    }
                    console.error(
                        `[HttpProxyInterface] Unable to send the request to ${target}:`,
                        err
                    );
                    settle(
                        failure({
                            errorCode: 'proxy_request_failed',
                            errorMessage:
                                'Unable to send the request to the proxy host.',
                        })
                    );
                });

                if (request.body !== null && request.body !== undefined) {
                    req.write(request.body);
                }

                req.end();
            }
        );
    }
}

export interface ResolvedAddress {
    address: string;
    family: number;
}

/**
 * Creates a description of the given request that is safe to include in logs.
 * Headers, bodies, and query strings are omitted because they may contain secrets.
 */
function describeRequest(
    request: ProxyInterfaceRequest,
    hostname: string,
    port: number | null,
    addresses: ResolvedAddress[]
): string {
    const queryIndex = request.path.indexOf('?');
    const path =
        queryIndex >= 0 ? request.path.slice(0, queryIndex) : request.path;
    return `${request.method} https://${hostname}:${
        port ?? 443
    }${path} (${addresses.map((a) => a.address).join(', ')})`;
}

/**
 * Creates a lookup function for net.connect() that only ever returns the given (already verified) addresses.
 *
 * Node calls the lookup with { all: true } when autoSelectFamily is enabled (the default since Node 20),
 * in which case the callback expects the full list of addresses so that it can fall back between IPv6 and IPv4.
 * Otherwise, the callback expects a single address.
 * @param addresses The addresses that connections should be pinned to.
 */
export function createPinnedLookup(
    addresses: ResolvedAddress[]
): (
    hostname: string,
    options: any,
    callback: (...args: any[]) => void
) => void {
    return (hostname, options, callback) => {
        const family = normalizeFamily(options?.family);
        const matching =
            family === 4 || family === 6
                ? addresses.filter((a) => a.family === family)
                : addresses;

        if (matching.length <= 0) {
            const err: NodeJS.ErrnoException = new Error(
                `getaddrinfo ENOTFOUND ${hostname}`
            );
            err.code = 'ENOTFOUND';
            err.syscall = 'getaddrinfo';
            callback(err);
            return;
        }

        if (options?.all) {
            callback(
                null,
                matching.map((a) => ({ address: a.address, family: a.family }))
            );
        } else {
            callback(null, matching[0].address, matching[0].family);
        }
    };
}

function normalizeFamily(family: unknown): number {
    if (family === 'IPv4') {
        return 4;
    } else if (family === 'IPv6') {
        return 6;
    } else if (typeof family === 'number') {
        return family;
    }
    return 0;
}

function parseLiteralAddress(hostname: string): ResolvedAddress | null {
    const value =
        hostname.startsWith('[') && hostname.endsWith(']')
            ? hostname.slice(1, -1)
            : hostname;

    if (parseIpv4(value)) {
        return {
            address: value,
            family: 4,
        };
    }

    if (parseIpv6(value)) {
        return {
            address: value,
            family: 6,
        };
    }

    return null;
}

function privateAddressFailure(
    hostname: string,
    address: string
): Result<never, SimpleError> {
    return failure({
        errorCode: 'invalid_proxy_host',
        errorMessage: `The host (${hostname}) resolves to an IP address (${address}) that is not publicly routable. Proxies are only able to send requests to public hosts.`,
    });
}
