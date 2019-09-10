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
                token: null,
            };
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
        const iface = getNetworkInterface(false);
        const url = new URL('/api/directory', this._config.upstream);
        await axios.put(url.href, {
            key: getKey(),
            password: this._settings.password,
            publicName: hostname(),
            privateIpAddress: iface.address,
        });
    }
}

function getKey() {
    const iface = getNetworkInterface(true);
    if (!iface) {
        throw new Error(
            'Cannot calculate key because no valid network interfaces are available.'
        );
    }
    const str = `${hostname()}.${iface.mac}`;
    const hash = new sha256();
    hash.update(str);
    return hash.digest().toString('hex');
}

function generatePassword() {
    const bytes = randomBytes(16);
    const str = bytes.toString('base64');
    return str;
}

/**
 * Gets the first IPv4 Network interface.
 * @param local Whether to include the loopback interface.
 */
function getNetworkInterface(local: boolean = false) {
    const net = networkInterfaces();
    const keys = Object.keys(net).sort();
    for (let key of keys) {
        const ifname = net[key];

        if (!ifname) {
            continue;
        }

        for (let i = 0; i < ifname.length; i++) {
            const iface = ifname[i];
            if ((iface.internal && !local) || iface.family !== 'IPv4') {
                continue;
            }
            return iface;
        }
    }
}
