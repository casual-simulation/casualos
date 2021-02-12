import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryStore } from './DirectoryStore';
import { sortBy } from 'lodash';
import { DirectoryUpdate, DirectoryUpdateSchema } from './DirectoryUpdate';
import { DirectoryResult } from './DirectoryResult';
import { compareSync, hashSync, genSaltSync } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { DirectoryConfig, DirectoryServerConfig } from '../config';
import axios from 'axios';

/**
 * The amount of time in seconds that it takes a token to expire.
 */
export const DEFAULT_TOKEN_EXPIRATION_TIME = 60 * 60 * 24;

/**
 * Defines a service that is able to update and query the device directory.
 */
export class DirectoryService {
    private _store: DirectoryStore;
    private _config: DirectoryServerConfig;

    constructor(store: DirectoryStore, config: DirectoryServerConfig) {
        this._store = store;
        this._config = config;
    }

    /**
     * Updates the given directory entry.
     * @param update The update for the entry.
     */
    async update(update: DirectoryUpdate): Promise<DirectoryResult> {
        const validation = DirectoryUpdateSchema.validate(update);
        if (validation.error) {
            return {
                type: 'bad_request',
                errors: validation.error.details.map((d) => ({
                    path: d.path,
                    message: d.message,
                })),
            };
        }

        let existing = await this._store.findByHash(update.key);

        if (!existing) {
            let salt = genSaltSync(10);
            let hash = hashSync(update.password, salt);
            let entry: DirectoryEntry = {
                key: update.key,
                passwordHash: hash,
                privateIpAddress: update.privateIpAddress,
                publicIpAddress: update.publicIpAddress,
                publicName: update.publicName,
                lastUpdateTime: unixTime(),
            };

            return await this._updateEntry(entry, null);
        }

        if (!compareSync(update.password, existing.passwordHash)) {
            return {
                type: 'not_authorized',
            };
        }

        let updated = {
            ...existing,
            privateIpAddress: update.privateIpAddress,
            publicIpAddress: update.publicIpAddress,
            publicName: update.publicName,
            lastUpdateTime: unixTime(),
        };

        return await this._updateEntry(updated, existing);
    }

    async findEntries(ip: string): Promise<DirectoryResult> {
        const stored = await this._store.findByPublicIpAddress(ip);
        const entries = sortBy(stored, (e) => e.publicName);

        return {
            type: 'query_results',
            entries: entries.map((e) => ({
                publicName: e.publicName,
                subhost: getSubHost(e, ip),
            })),
        };
    }

    private async _updateEntry(
        entry: DirectoryEntry,
        previous: DirectoryEntry
    ): Promise<DirectoryResult> {
        if (this._config.webhook) {
            entry.webhookSucceeded = await _sendWebhook(
                previous,
                entry,
                this._config.webhook
            );
        }

        await this._store.update(entry);

        const token = sign(
            {
                key: entry.key,
                publicIpAddress: entry.publicIpAddress,
                privateIpAddress: entry.privateIpAddress,
            },
            this._config.secret,
            {
                expiresIn: DEFAULT_TOKEN_EXPIRATION_TIME,
            }
        );

        return {
            type: 'entry_updated',
            token: token,
        };
    }
}

export function isInternal(entry: DirectoryEntry, ip: string): boolean {
    return entry.publicIpAddress === ip;
}

export function getSubHost(entry: DirectoryEntry, ip: string): string {
    if (isInternal(entry, ip)) {
        return `internal-${entry.key}`;
    } else {
        return `external-${entry.key}`;
    }
}

export function unixTime(): number {
    return Math.floor(Date.now() / 1000);
}

async function _sendWebhook(
    previous: DirectoryEntry,
    entry: DirectoryEntry,
    webhook: string
): Promise<boolean> {
    try {
        if (
            previous &&
            previous.webhookSucceeded &&
            previous.privateIpAddress === entry.privateIpAddress &&
            previous.publicIpAddress === entry.publicIpAddress
        ) {
            return true;
        }

        // Send a webhook to the configured URL
        await axios.post(webhook, {
            key: entry.key,
            externalIpAddress: entry.publicIpAddress,
            internalIpAddress: entry.privateIpAddress,
        });
        return true;
    } catch (ex) {
        console.error('[DirectoryService] Webhook Failed:', ex);
        return false;
    }
}
