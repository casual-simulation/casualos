import { MongoClient, Db, Collection } from 'mongodb';
import pify from 'pify';
import { WeaveStore } from '@yeti-cgi/aux-common/channels-core/WeaveStore';
import { AtomOp } from '@yeti-cgi/aux-common/channels-core/Atom';
import { Weave, WeaveReference } from '@yeti-cgi/aux-common/channels-core/Weave';

const connect = pify(MongoClient.connect);

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBTreeStore implements WeaveStore {
    

    private _client: MongoClient;
    private _db: Db;
    private _collection: Collection;
    private _uri: string;
    private _dbName: string;
    private _collectionName: string = 'weaves';

    constructor(uri: string, dbName: string) {
        this._uri = uri;
        this._dbName = dbName;
    }

    async init() {
        this._client = await connect(this._uri);
        this._db = this._client.db(this._dbName);
        this._collection = this._db.collection(this._collectionName);
    }

    async update<T extends AtomOp>(id: string, weave: WeaveReference<T>[]): Promise<void> {
        await this._collection.updateOne({ channel: id }, { 
            $set: {
                channel: id,
                state: weave
            }
        }, {
            upsert: true
        });
    }

    async get<T extends AtomOp>(id: string): Promise<WeaveReference<T>[]> {
        const atoms: WeaveReference<T>[] = await this._collection.findOne({ weave: id });
        return atoms;
    }
}