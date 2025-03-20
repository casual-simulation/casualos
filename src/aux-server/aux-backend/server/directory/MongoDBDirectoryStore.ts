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
import type { DirectoryEntry } from './DirectoryEntry';
import type { MongoClient, Db, Collection } from 'mongodb';
import type { DirectoryClientSettings } from './DirectoryClientSettings';

export class MongoDBDirectoryStore implements DirectoryStore {
    private _dbName: string;
    private _client: MongoClient;
    private _db: Db;
    private _entries: Collection;
    private _keyval: Collection;

    constructor(client: MongoClient, db: string) {
        this._client = client;
        this._dbName = db;
    }

    async init() {
        this._db = this._client.db(this._dbName);
        this._entries = this._db.collection('entries');
        this._keyval = this._db.collection('keyval');

        await this._entries.createIndex({ publicIpAddress: 1 });
    }

    async update(entry: DirectoryEntry): Promise<void> {
        await this._entries.updateOne(
            {
                _id: entry.key,
            },
            {
                $set: {
                    ...entry,
                    _id: entry.key,
                },
            },
            {
                upsert: true,
            }
        );
    }

    async findByPublicIpAddress(ipAddress: string): Promise<DirectoryEntry[]> {
        const results = await this._entries
            .find({
                publicIpAddress: ipAddress,
            })
            .toArray();

        return results;
    }

    async findByHash(hash: string): Promise<DirectoryEntry> {
        return await this._entries.findOne({
            _id: hash,
        });
    }

    async getClientSettings(): Promise<DirectoryClientSettings> {
        return await this._keyval.findOne({
            _id: 'client_settings',
        });
    }

    async saveClientSettings(settings: DirectoryClientSettings): Promise<void> {
        await this._keyval.updateOne(
            {
                _id: 'client_settings',
            },
            {
                $set: settings,
            },
            {
                upsert: true,
            }
        );
    }
}
