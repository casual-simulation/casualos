import { MongoClient, Db, Collection } from 'mongodb';
import pify from 'pify';
import { ChannelConnectionRequest, MemoryConnector, ConnectionHelper } from '@yeti-cgi/aux-common/channels-core';

const connect = pify(MongoClient.connect);

interface ChannelStorage {
    channel: string;
    state: any;
}

/**
 * Defines a channel connector which is able to pipe events to MongoDB for storage and load initial events from MongoDB.
 */
export class MongoDBConnector extends MemoryConnector {

    private _client: MongoClient;
    private _db: Db;
    private _collection: Collection;
    private _dbName: string;
    private _collectionName: string = 'channels';

    constructor(client: MongoClient, dbName: string) {
        super();
        this._client = client;
        this._dbName = dbName;
    }

    init() {
        this._db = this._client.db(this._dbName);
        this._collection = this._db.collection(this._collectionName);
    }

    protected async _initConnection<T>(request: ChannelConnectionRequest<T>, helper: ConnectionHelper<T>): Promise<void> {
        await super._initConnection(request, helper);

        console.log(`[MongoDBConnector] Initializing new channel ${request.info.id}. Grabbing initial state...`);
        const storage: ChannelStorage = await this._collection.findOne({ channel: request.info.id });
        
        if (storage) {
            console.log('[MongoDBConnector] Using initial state:', storage.state);
            request.store.init(storage.state);
        } else {
            console.log('[MongoDBConnector] No initial state.');
        }

        helper.setEmitToStoreFunction(event => {
            request.store.process(event);

            const state = request.store.state();
            this._collection.updateOne({ channel: request.info.id }, { 
                $set: {
                    channel: request.info.id,
                    state: state
                } 
            }, {
                upsert: true
            });
        });
    }

}