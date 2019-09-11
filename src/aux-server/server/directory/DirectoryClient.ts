import { DirectoryStore } from './DirectoryStore';
import { DirectoryClientConfig } from '../config';
import {
    DEFAULT_PING_INTERVAL,
    DirectoryClientSettings,
} from './DirectoryClientSettings';
import { randomBytes } from 'crypto';
import { hostname, networkInterfaces } from 'os';
import { sha256 } from 'sha.js';
import axios from 'axios';
import { sortBy } from 'lodash';

/**
 * Defines a client for the directory.
 */
export class DirectoryClient {
    private _config: DirectoryClientConfig;
    private _store: DirectoryStore;
    private _timeoutId: NodeJS.Timeout;
    private _settings: DirectoryClientSettings;

    constructor(store: DirectoryStore, config: DirectoryClientConfig) {
        this._store = store;
        this._config = config;
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
            clearInterval(this._timeoutId);
        }
        this._timeoutId = setInterval(async () => {
            await this._ping();
        }, this._settings.pingInterval * 60 * 1000);
    }

    private async _ping() {
        try {
            const iface = getNetworkInterface(false);
            if (!iface) {
                throw new Error(
                    'Cannot find a valid non-local network interface.'
                );
            }
            const url = new URL('/api/directory', this._config.upstream);
            await axios.put(url.href, {
                key: this._settings.key,
                password: this._settings.password,
                publicName: hostname(),
                privateIpAddress: iface.address,
            });
        } catch (ex) {
            console.error('Unable to ping upstream directory.', ex);
        }
    }
}

function getKey() {
    const bytes = randomBytes(32);
    const hash = new sha256();
    hash.update(bytes);
    return hash.digest().toString('hex');
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
        ifname => {
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
        ifname => ifname
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
