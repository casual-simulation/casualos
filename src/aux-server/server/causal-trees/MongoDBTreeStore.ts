import { MongoClient, Db, Collection } from 'mongodb';
import pify from 'pify';
import { CausalTreeStore, AtomOp, StoredCausalTree } from '@yeti-cgi/aux-common/causal-trees';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBTreeStore implements CausalTreeStore {

    private _client: MongoClient;
    private _db: Db;
    private _collection: Collection;
    private _dbName: string;
    private _collectionName: string = 'trees';

    constructor(client: MongoClient, dbName: string) {
        this._client = client;
        this._dbName = dbName;
    }

    async init() {
        this._db = this._client.db(this._dbName);
        this._collection = this._db.collection(this._collectionName);
    }

    async update<T extends AtomOp>(id: string, tree: StoredCausalTree<T>): Promise<void> {
        const wrapper: StorageWrapper<T> = {
            id: id,
            tree: tree
        };
        await this._collection.updateOne({ channel: id }, { 
            $set: wrapper
        }, {
            upsert: true
        });
    }

    async get<T extends AtomOp>(id: string): Promise<StoredCausalTree<T>> {
        const wrapper: StorageWrapper<T> = await this._collection.findOne({ id: id });
        if (wrapper) {
            return wrapper.tree;
        } else {
            return null;
        }
    }
}

interface StorageWrapper<T extends AtomOp> {
    id: string;
    tree: StoredCausalTree<T>;
}