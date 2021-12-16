import { Record, RecordsStore } from '@casual-simulation/aux-records';
import { Collection } from 'mongodb';

export class MongoDBRecordsStore implements RecordsStore {
    private _collection: Collection<Record>;

    constructor(collection: Collection<Record>) {
        this._collection = collection;
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
}
