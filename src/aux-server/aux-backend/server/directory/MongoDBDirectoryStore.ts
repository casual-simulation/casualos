import { DirectoryStore } from './DirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';
import { MongoClient, Db, Collection } from 'mongodb';
import { DirectoryClientSettings } from './DirectoryClientSettings';

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
