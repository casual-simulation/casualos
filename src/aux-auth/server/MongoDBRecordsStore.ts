import { Record, RecordsStore, RecordKey } from '@casual-simulation/aux-records';
import { Collection } from 'mongodb';

export class MongoDBRecordsStore implements RecordsStore {
    private _collection: Collection<Record>;
    private _keyCollection: Collection<RecordKey>;

    constructor(collection: Collection<Record>, keys: Collection<RecordKey>) {
        this._collection = collection;
        this._keyCollection = keys;
    }

    async updateRecord(record: Record): Promise<void> {
        await this._collection.updateOne(
            {
                name: record.name,
            },
            {
                $set: record,
            },
            { upsert: true }
        );
    }

    async addRecord(record: Record): Promise<void> {
        await this._collection.insertOne(record);
    }

    async getRecordByName(name: string): Promise<Record> {
        const record = await this._collection.findOne({
            name: name,
        });

        return record;
    }

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
     async addRecordKey(key: RecordKey): Promise<void> {
        await this._keyCollection.insertOne(key);
     }

     /**
      * Gets the record key for the given record name that has the given hash.
      * @param recordName The name of the record.
      * @param hash The scrypt hash of the key that should be retrieved.
      */
     async getRecordKeyByRecordAndHash(recordName: string, hash: string): Promise<RecordKey> {
         const key = await this._keyCollection.findOne({
             recordName: recordName,
             secretHash: hash
         });

         return key;
     }
}
