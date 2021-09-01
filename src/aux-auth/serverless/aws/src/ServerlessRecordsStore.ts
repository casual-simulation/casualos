import { DynamodbDataSourceConfig } from 'aws-sdk/clients/appsync';
import {
    RecordsStore,
    SaveRecordResult,
    ServerlessRecord,
} from './RecordsStore';
import dynamodb from 'aws-sdk/clients/dynamodb';
import { RedisClient } from 'redis';
import { promisify } from 'util';
import { AWSError } from 'aws-sdk';

export class ServerlessRecordsStore implements RecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _permanentRecordsTable: string;
    private _redis: RedisClient;
    private _redisNamespace: string;

    private _rExists: (key: string) => Promise<boolean>;
    private _rSet: (key: string, value: string) => Promise<void>;

    constructor(
        dynamoClient: dynamodb.DocumentClient,
        permanentRecordsTable: string,
        redis: RedisClient,
        redisNamespace: string
    ) {
        this._dynamo = dynamoClient;
        this._permanentRecordsTable = permanentRecordsTable;
        this._redis = redis;
        this._redisNamespace = redisNamespace;

        this._rExists = promisify(this._redis.exists).bind(this._redis);
        this._rSet = promisify(this._redis.set).bind(this._redis);
    }

    async saveTemporaryRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        const recordName = `${this._redisNamespace}/${appRecord.issuer}/${appRecord.address}`;

        if (await this._rExists(recordName)) {
            return 'already_exists';
        }

        await this._rSet(recordName, JSON.stringify(appRecord));
        return null;
    }

    async savePermanentRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        try {
            await this._dynamo
                .put({
                    TableName: this._permanentRecordsTable,
                    Item: {
                        issuer: appRecord.issuer,
                        address: appRecord.address,
                        visibility: appRecord.visibility,
                        authorizedUsers: appRecord.authorizedUsers,
                        record: JSON.stringify(appRecord.record),
                        creationDate: appRecord.creationDate,
                    },
                    ConditionExpression:
                        'attribute_not_exists(issuer) AND attribute_not_exists(address)',
                })
                .promise();

            return null;
        } catch (err) {
            let awsErr = err as AWSError;

            if (awsErr.code === 'ConditionalCheckFailedException') {
                return 'already_exists';
            } else {
                throw err;
            }
        }
    }
}
