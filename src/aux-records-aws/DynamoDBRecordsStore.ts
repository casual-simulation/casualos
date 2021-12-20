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
        const result = await this._dynamo
            .get({
                TableName: this._tableName,
                Key: {
                    recordName: name,
                },
            })
            .promise();

        if (!result.Item) {
            return null;
        }

        const record: StoredRecord = result.Item as StoredRecord;

        return {
            name: record.recordName,
            ownerId: record.ownerId,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        };
    }

    async updateRecord(record: Record): Promise<void> {
        await this._dynamo
            .put({
                TableName: this._tableName,
                Item: {
                    recordName: record.name,
                    ownerId: record.ownerId,
                    secretHashes: record.secretHashes,
                    secretSalt: record.secretSalt,
                },
            })
            .promise();
    }

    async addRecord(record: Record): Promise<void> {
        return await this.updateRecord(record);
    }
}

interface StoredRecord {
    recordName: string;
    ownerId: string;
    secretHashes: string[];
    secretSalt: string;
}
