import { Record, RecordsStore } from '@casual-simulation/aux-records';
import dynamodb from 'aws-sdk/clients/dynamodb';

export class DynamoDBRecordsStore implements RecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _tableName: string;

    constructor(dynamo: dynamodb.DocumentClient, tableName: string) {
        this._dynamo = dynamo;
        this._tableName = tableName;
    }

    async getRecordByName(name: string): Promise<Record> {
        const record: StoredRecord = await this._getRecord(name);

        return {
            name: record.recordName,
            ownerId: record.ownerId,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        };
    }

    async updateRecord(record: Record): Promise<void> {
        const r = await this._getRecord(record.name);

        let now = Date.now();
        let update: Partial<StoredRecord> = {
            recordName: record.name,
            ownerId: record.ownerId,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
            updateTime: now,
        };

        if (!r) {
            update.creationTime = now;
        } else {
            update.creationTime = r.creationTime;
        }

        await this._dynamo
            .put({
                TableName: this._tableName,
                Item: update,
            })
            .promise();
    }

    async addRecord(record: Record): Promise<void> {
        return await this.updateRecord(record);
    }

    private async _getRecord(name: string): Promise<StoredRecord> {
        const record = await this._dynamo
            .get({
                TableName: this._tableName,
                Key: {
                    recordName: name,
                },
            })
            .promise();

        return record.Item as StoredRecord;
    }
}

interface StoredRecord {
    recordName: string;
    ownerId: string;
    secretHashes: string[];
    secretSalt: string;

    /**
     * The number of miliseconds since January 1 1970 00:00:00 UTC that this record was updated at.
     */
    updateTime: number;

    /**
     * The number of miliseconds since January 1 1970 00:00:00 UTC that this record was created at.
     */
    creationTime: number;
}
