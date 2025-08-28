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
import type { DirectoryEntry } from './DirectoryEntry';
import type { DirectoryStore } from './DirectoryStore';
import { sortBy } from 'es-toolkit/compat';
import type { DirectoryUpdate } from './DirectoryUpdate';
import { DirectoryUpdateSchema } from './DirectoryUpdate';
import type { DirectoryResult } from './DirectoryResult';
import { compareSync, hashSync, genSaltSync } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import type { DirectoryServerConfig } from '../config';
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
        const validation = DirectoryUpdateSchema.safeParse(update);
        if (validation.success === false) {
            return {
                type: 'bad_request',
                errors: validation.error.issues,
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
        previous: DirectoryEntry | null
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
    previous: DirectoryEntry | null,
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
