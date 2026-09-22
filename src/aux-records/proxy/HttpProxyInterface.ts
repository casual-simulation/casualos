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

        const address = await this._resolveHost(host.value.hostname);
        if (address.success === false) {
            return address;
        }

        return await this._sendRequest(
            request,
            host.value.hostname,
            host.value.port,
            address.value
        );
    }

    /**
     * Resolves the given host name to an IP address that is safe to send requests to.
     * @param hostname The host name that should be resolved.
     */
    private async _resolveHost(
        hostname: string
    ): Promise<Result<ResolvedAddress, SimpleError>> {
        const literal = parseLiteralAddress(hostname);
        if (literal) {
            if (!this._isAllowedAddress(literal.address)) {
                return privateAddressFailure(hostname, literal.address);
            }
            return success(literal);
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

        return success({
            address: addresses[0].address,
            family: addresses[0].family,
        });
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
        address: ResolvedAddress
    ): Promise<Result<ProxyInterfaceResponse, SimpleError>> {
        const maxResponseSizeInBytes = this._maxResponseSizeInBytes;
        const timeoutMs = request.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

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

                            // Pin the connection to the address that was verified above so that
                            // the host name cannot be re-resolved to a private address.
                            lookup: (_hostname, _options, callback) => {
                                (callback as any)(
                                    null,
                                    address.address,
                                    address.family
                                );
                            },
                        },
                        (response) => {
                            const chunks: Buffer[] = [];
                            let size = 0;
                            let tooLarge = false;

                            response.on('data', (chunk: Buffer) => {
                                size += chunk.length;
                                if (size > maxResponseSizeInBytes) {
                                    tooLarge = true;
                                    response.destroy();
                                    req.destroy();
                                    return;
                                }
                                chunks.push(chunk);
                            });

                            response.on('end', () => {
                                if (tooLarge) {
                                    settle(
                                        failure({
                                            errorCode: 'proxy_request_failed',
                                            errorMessage: `The response from the proxy host was too large. The maximum allowed size is ${maxResponseSizeInBytes} bytes.`,
                                        })
                                    );
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

                            response.on('error', () => {
                                if (tooLarge) {
                                    return;
                                }
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
                    req.destroy();
                    settle(
                        failure({
                            errorCode: 'took_too_long',
                            errorMessage:
                                'The proxy host took too long to respond.',
                        })
                    );
                });

                req.on('error', () => {
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

interface ResolvedAddress {
    address: string;
    family: number;
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
