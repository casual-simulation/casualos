import { DirectoryStore } from './DirectoryStore';
import { DirectoryClientConfig } from '../config';
import {
    DEFAULT_PING_INTERVAL,
    DirectoryClientSettings,
} from './DirectoryClientSettings';
import { randomBytes } from 'crypto';
import { hostname, networkInterfaces } from 'os';
import { sha256 } from 'hash.js';
import axios from 'axios';
import { sortBy } from 'lodash';
import {
    SubscriptionLike,
    timer,
    Observable,
    defer,
    throwError,
    EMPTY,
    NEVER,
} from 'rxjs';
import {
    retryWhen,
    delayWhen,
    finalize,
    tap,
    repeatWhen,
    mergeMap,
} from 'rxjs/operators';
import { TunnelClient } from '@casual-simulation/tunnel';

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
