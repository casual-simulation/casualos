import { Record, RecordsStore } from '@casual-simulation/aux-records';
import { PublicRecordKeyPolicy, RecordKey } from '@casual-simulation/aux-records/RecordsStore';
import dynamodb from 'aws-sdk/clients/dynamodb';

export class DynamoDBRecordsStore implements RecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _tableName: string;
    private _keyTableName: string;

    constructor(dynamo: dynamodb.DocumentClient, tableName: string, keyTableName: string) {
        this._dynamo = dynamo;
        this._tableName = tableName;
        this._keyTableName = keyTableName;
    }

    async getRecordByName(name: string): Promise<Record> {
        const record: StoredRecord = await this._getRecord(name);

        if (!record) {
            return null;
        }

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

    async addRecordKey(key: RecordKey): Promise<void> {
        const existingKey = await this._getRecordKey(key.recordName, key.secretHash);

        if (!!existingKey) {
            return;
        }

        let update: StoredKey = {
            recordName: key.recordName,
            secretHash: key.secretHash,
            policy: key.policy,
            creatorId: key.creatorId,
            creationTime: Date.now()
        };

        await this._dynamo.put({
            TableName: this._keyTableName,
            Item: update
        }).promise();
    }

    async getRecordKeyByRecordAndHash(recordName: string, hash: string): Promise<RecordKey> {
        return this._getRecordKey(recordName, hash);
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

    private async _getRecordKey(recordName: string, hash: string): Promise<StoredKey> {
        const key = await this._dynamo.get({
            TableName: this._keyTableName,
            Key: {
                recordName: recordName,
                secretHash: hash
            }
        }).promise();

        return key.Item as StoredKey;
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

interface StoredKey {
    recordName: string;
    secretHash: string;
    policy: PublicRecordKeyPolicy;

    creatorId: string;
    creationTime: number;
}
