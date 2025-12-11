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
import type { DirectoryStore } from './DirectoryStore';
import type { DirectoryClientConfig } from './DirectoryConfig';
import type { DirectoryClientSettings } from './DirectoryClientSettings';
import { DEFAULT_PING_INTERVAL } from './DirectoryClientSettings';
import { randomBytes } from 'crypto';
import { hostname, networkInterfaces } from 'os';
import { sha256 } from 'hash.js';
import axios from 'axios';
import { sortBy } from 'es-toolkit/compat';
import type { SubscriptionLike, Observable } from 'rxjs';
import { timer, defer, throwError, EMPTY, NEVER } from 'rxjs';
import { retryWhen, finalize, tap, repeatWhen, mergeMap } from 'rxjs/operators';
import type { TunnelClient } from '@casual-simulation/tunnel';

/**
 * Defines a client for the directory.
 */
export class DirectoryClient {
    private _config: DirectoryClientConfig;
    private _store: DirectoryStore;
    private _timeoutId: NodeJS.Timeout | number;
    private _settings: DirectoryClientSettings;
    private _tunnelClient: TunnelClient | null;
    private _tunnelSub: SubscriptionLike | null;
    private _pendingPing: Promise<any>;
    private _httpPort: number;

    get pendingOperations(): Promise<void> {
        return this._pendingPing || Promise.resolve();
    }

    constructor(
        store: DirectoryStore,
        tunnelClient: TunnelClient | null,
        config: DirectoryClientConfig,
        httpPort: number
    ) {
        this._store = store;
        this._tunnelClient = tunnelClient;
        this._config = config;
        this._httpPort = httpPort;
    }

    async init(): Promise<void> {
        this._settings = await this._store.getClientSettings();

        if (!this._settings) {
            this._settings = {
                pingInterval: DEFAULT_PING_INTERVAL,
                password: generatePassword(),
                key: getKey(),
                token: null,
            };
            await this._store.saveClientSettings(this._settings);
        }

        if (!this._settings.key) {
            this._settings.key = getKey();
            await this._store.saveClientSettings(this._settings);
        }
        await this._ping();
        this._updateTimeout();
    }

    private _updateTimeout() {
        if (this._timeoutId) {
            clearInterval(this._timeoutId as any);
        }
        this._timeoutId = setInterval(() => {
            this._pendingPing = this._ping();
        }, this._settings.pingInterval * 60 * 1000);
    }

    private async _ping() {
        try {
            const address = this._getIpAddress();
            console.log('[DirectoryClient] Pinging directory...');
            const url = new URL('/directory/api', this._config.upstream);
            const response = await axios.put(url.href, {
                key: this._settings.key,
                password: this._settings.password,
                publicName: hostname(),
                privateIpAddress: address,
            });

            if (response.data) {
                console.log('[DirectoryClient] Got token from directory.');
                const data: {
                    token: string;
                    privateKey: string;
                } = response.data;

                this._settings.token = data.token;

                await this._store.saveClientSettings(this._settings);
                this._openTunnel();
            }
        } catch (ex) {
            console.error('Unable to ping upstream directory.', ex);
        }
    }

    private _getIpAddress() {
        if (this._config.ipAddress) {
            return this._config.ipAddress;
        }
        const iface = getNetworkInterface(false);
        if (!iface) {
            throw new Error('Cannot find a valid non-local network interface.');
        }
        return iface.address;
    }

    private _openTunnel() {
        if (!this._tunnelClient) {
            return;
        }

        if (!this._settings.token) {
            return;
        }

        if (this._tunnelSub) {
            return;
        }

        const deferred = defer(() => {
            if (!this._tunnelClient) {
                return NEVER;
            }
            return this._tunnelClient.open({
                direction: 'reverse',
                token: this._settings.token as string,
                localHost: '127.0.0.1',
                localPort: this._httpPort, // TODO: Config
            });
        });

        this._tunnelSub = deferred
            .pipe(
                tap({
                    next: (x) => {},
                    error: (err) => console.error(err),
                }),
                (o) => retryUntilFailedTimes(o, 5),
                finalize(() => (this._tunnelSub = null))
            )
            .subscribe({
                error: (err) => {
                    console.log(err);
                },
            });
    }
}

function retryUntilFailedTimes<T>(
    observable: Observable<T>,
    times: number
): Observable<T> {
    let currentCount = 0;
    return observable.pipe(
        tap(() => {
            console.log('[DirectoryClient] Tunnel Connected!');
            currentCount = 0;
        }),
        retryWhen((errors) =>
            errors.pipe(
                tap(() =>
                    console.log(
                        '[DirectoryClient] Disconnected from tunnel. Retrying in 5 seconds...'
                    )
                ),
                mergeMap((error) => {
                    currentCount += 1;
                    if (currentCount >= times) {
                        return throwError(error);
                    }

                    return timer(5000);
                })
            )
        ),
        repeatWhen((completions) =>
            completions.pipe(
                tap((x) =>
                    console.log(
                        '[DirectoryClient] Disconnected from tunnel. Retrying in 5 seconds...'
                    )
                ),
                mergeMap(() => {
                    currentCount += 1;
                    if (currentCount >= times) {
                        return EMPTY;
                    }

                    return timer(5000);
                })
            )
        ),
        finalize(() => {
            console.log(
                `[DirectoryClient] Unable to connect after ${times}. Quitting until next ping.`
            );
        })
    );
}

function getKey() {
    const bytes = randomBytes(32);
    const hash = sha256();
    hash.update(bytes);
    return hash.digest('hex');
}

function generatePassword() {
    const bytes = randomBytes(16);
    const str = bytes.toString('base64');
    return str;
}

/**
 * Gets the first IPv4 Network interface. Prefers ethernet and wlan interfaces before others.
 * @param local Whether to include the loopback interface.
 */
function getNetworkInterface(local: boolean = false) {
    const net = networkInterfaces();
    const keys = sortBy(
        Object.keys(net),
        (ifname) => {
            if (ifname.startsWith('lo')) {
                return 0;
            } else if (ifname.startsWith('eth') || ifname.startsWith('en')) {
                return 1;
            } else if (ifname.startsWith('wlan') || ifname.startsWith('wl')) {
                return 2;
            } else {
                return 3;
            }
        },
        (ifname) => ifname
    );

    if (local) {
        for (let key of keys) {
            const ifname = net[key];
            if (!ifname) {
                continue;
            }

            for (let i = 0; i < ifname.length; i++) {
                const iface = ifname[i];
                if (iface.internal && iface.family === 'IPv4') {
                    return iface;
                }
            }
        }
    }

    for (let key of keys) {
        const ifname = net[key];
        if (!ifname) {
            continue;
        }

        for (let i = 0; i < ifname.length; i++) {
            const iface = ifname[i];
            if (iface.internal || iface.family !== 'IPv4') {
                continue;
            }
            return iface;
        }
    }

    return null;
}
