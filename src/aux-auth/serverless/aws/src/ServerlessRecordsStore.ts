import { DynamodbDataSourceConfig } from 'aws-sdk/clients/appsync';
import {
    DeletableRecord,
    RecordsQuery,
    RecordsStore,
    SaveRecordResult,
    ServerlessRecord,
} from './RecordsStore';
import dynamodb from 'aws-sdk/clients/dynamodb';
import S3 from 'aws-sdk/clients/s3';
import { RedisClient } from 'redis';
import { promisify } from 'util';
import { AWSError } from 'aws-sdk';
import {
    GetRecordsActionResult,
    hasValue,
    Record,
} from '@casual-simulation/aux-common';
import stringify from 'fast-json-stable-stringify';
import { sha256 } from 'hash.js';

const BATCH_SIZE = 25;
const REDIS_BATCH_SIZE = (1000).toString();
const MAX_REDIS_ITERATIONS = 10000;
const MAX_DYNAMO_DB_RECORD_SIZE = 200000; // 200KB

const CURRENT_REGION = process.env.AWS_REGION;

declare let DEVELOPMENT: boolean;

export class ServerlessRecordsStore implements RecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _permanentRecordsTable: string;
    private _redis: RedisClient;
    private _redisNamespace: string;
    private _s3: S3;
    private _s3Bucket: string;

    private _rHExists: (key: string, field: string) => Promise<boolean>;
    private _rHSet: (
        key: string,
        field: string,
        value: string
    ) => Promise<void>;
    private _rHMGet: (key: string, ...fields: string[]) => Promise<string[]>;
    private _rHScan: (
        key: string,
        ...args: string[]
    ) => Promise<[string, string[]]>;
    private _rHDel: (key: string, ...fields: string[]) => Promise<number>;

    constructor(
        dynamoClient: dynamodb.DocumentClient,
        permanentRecordsTable: string,
        redis: RedisClient,
        redisNamespace: string,
        s3Client: S3,
        s3Bucket: string
    ) {
        this._dynamo = dynamoClient;
        this._s3 = s3Client;
        this._s3Bucket = s3Bucket;
        this._permanentRecordsTable = permanentRecordsTable;
        this._redis = redis;
        this._redisNamespace = redisNamespace;

        this._rHExists = promisify(this._redis.hexists).bind(this._redis);
        this._rHSet = promisify(this._redis.hset).bind(this._redis);
        this._rHMGet = promisify(this._redis.hmget).bind(this._redis);
        this._rHScan = promisify(this._redis.hscan).bind(this._redis);
        this._rHDel = promisify(this._redis.hdel).bind(this._redis);
    }

    async getPermanentRecords(
        query: RecordsQuery
    ): Promise<GetRecordsActionResult> {
        if (hasValue(query.address)) {
            const result = await this._dynamo
                .get({
                    TableName: this._permanentRecordsTable,
                    Key: {
                        issuer: query.issuer,
                        address: query.address,
                    },
                })
                .promise();

            if (!result.Item) {
                return {
                    hasMoreRecords: false,
                    totalCount: 0,
                    records: [],
                };
            }

            const record: ServerlessRecord = result.Item as ServerlessRecord;

            if (!this._authorizedToAccessRecord(record, query)) {
                return {
                    hasMoreRecords: false,
                    totalCount: 0,
                    records: [],
                };
            }

            return {
                hasMoreRecords: false,
                totalCount: 1,
                records: [
                    {
                        address: record.address,
                        authID: record.issuer,
                        data: JSON.parse(record.record),
                        space: ('permanent' +
                            (record.visibility === 'global'
                                ? 'Global'
                                : 'Restricted')) as any,
                    },
                ],
            };
        } else if (hasValue(query.prefix)) {
            let startKey = query.prefix;
            let endKey =
                query.prefix.slice(0, -1) +
                String.fromCharCode(
                    query.prefix.charCodeAt(query.prefix.length - 1) + 1
                );

            const lastEvaluatedKey = hasValue(query.cursor)
                ? JSON.parse(query.cursor)
                : undefined;

            let params: dynamodb.DocumentClient.QueryInput = {
                TableName: this._permanentRecordsTable,
                ExclusiveStartKey: lastEvaluatedKey,
                KeyConditionExpression:
                    'issuer = :issuer AND address BETWEEN :startKey AND :endKey',
                ExpressionAttributeValues: {
                    ':issuer': query.issuer,
                    ':startKey': startKey,
                    ':endKey': endKey,
                    ':visibility': query.visibility,
                },
                FilterExpression: 'visibility = :visibility',
            };

            const result = await this._dynamo
                .query({
                    ...params,
                    Limit: BATCH_SIZE,
                })
                .promise();

            let totalCount = result.Items.length;
            if (lastEvaluatedKey || result.LastEvaluatedKey) {
                const countResult = await this._dynamo
                    .query({
                        ...params,
                        Select: 'COUNT',
                    })
                    .promise();

                totalCount = countResult.Count;
            }

            let records: Record[] = await Promise.all(
                result.Items.map(async (i) => {
                    const record: ServerlessRecord = i as ServerlessRecord;

                    if (!this._authorizedToAccessRecord(record, query)) {
                        return null;
                    }

                    const data = i.record ? JSON.parse(i.record) : null;
                    const dataURL = i.record
                        ? null
                        : DEVELOPMENT
                        ? `${this._s3.endpoint.protocol}//localhost:${this._s3.endpoint.port}/${i.recordBucket}/${i.recordKey}`
                        : `https://${i.recordBucket}.s3.amazonaws.com/${i.recordKey}`;

                    return {
                        authID: i.issuer,
                        address: i.address,
                        data: data,
                        dataURL: dataURL,
                        space:
                            'permanent' +
                            (i.visibility === 'global'
                                ? 'Global'
                                : 'Restricted'),
                    } as Record;
                })
            );

            return {
                hasMoreRecords: result.LastEvaluatedKey !== undefined,
                cursor: result.LastEvaluatedKey
                    ? JSON.stringify(result.LastEvaluatedKey)
                    : undefined,
                totalCount: totalCount,
                records: records.filter((r) => !!r),
            };
        } else {
            return null;
        }
    }

    // private async _getRecordFromS3(bucket: string, key: string): Promise<any> {
    //     console.log('[ServerlessRecordsStore] Getting record from S3.', bucket, key);
    //     const result = await this._s3.getObject({
    //         Bucket: bucket,
    //         Key: key,
    //     }).promise();

    //     console.log(result.ContentType);
    //     if (result.ContentType === 'application/json') {
    //         return JSON.parse(result.Body.toString('utf-8'));
    //     } else {
    //         console.error('[ServerlessRecordsStore] Non-JSON records are not currently supported.');
    //         return null;
    //     }
    // }

    async getTemporaryRecords(
        query: RecordsQuery
    ): Promise<GetRecordsActionResult> {
        const key = `${this._redisNamespace}/${query.issuer}`;
        let filter: string;
        let cursor: string = '0';

        if (hasValue(query.address)) {
            filter = `${escapeRedisPattern(query.address)}`;
        } else if (hasValue(query.prefix)) {
            filter = `${escapeRedisPattern(query.prefix)}*`;
        }

        let records: Record[] = [];
        let i = 0;
        while (i < MAX_REDIS_ITERATIONS) {
            const [nextIndex, keysAndValues] = await this._rHScan(
                key,
                cursor,
                'MATCH',
                filter,
                'COUNT',
                REDIS_BATCH_SIZE
            );

            for (let i = 0; i + 1 < keysAndValues.length; i += 2) {
                let key = keysAndValues[i];
                let value = keysAndValues[i + 1];

                if (!value) {
                    continue;
                }

                try {
                    const record: ServerlessRecord = JSON.parse(value);

                    if (!this._authorizedToAccessRecord(record, query)) {
                        continue;
                    }

                    records.push({
                        address: record.address,
                        authID: record.issuer,
                        data: record.record,
                        space:
                            'temp' +
                            (record.visibility === 'global'
                                ? 'Global'
                                : 'Restricted'),
                    } as Record);
                } catch (err) {
                    console.error(
                        '[ServerlessRecordStore] Failed to parse value:',
                        value,
                        err
                    );
                }
            }
            if (nextIndex === '0') {
                break;
            }
            cursor = nextIndex;
            i++;
        }

        const availableRecords = records.filter((r) => !!r);

        return {
            hasMoreRecords: false,
            totalCount: availableRecords.length,
            records: availableRecords,
        };
    }

    async saveTemporaryRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        const key = `${this._redisNamespace}/${appRecord.issuer}`;
        const field = appRecord.address;

        if (await this._rHExists(key, field)) {
            return 'already_exists';
        }

        await this._rHSet(key, field, JSON.stringify(appRecord));
        return null;
    }

    async savePermanentRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        try {
            const json = JSON.stringify(appRecord.record);
            const buffer = Buffer.from(json, 'utf-8');
            if (buffer.byteLength < MAX_DYNAMO_DB_RECORD_SIZE) {
                console.log('[ServerlessRecordsStore] Saving in DynamoDB.');
                await this._dynamo
                    .put({
                        TableName: this._permanentRecordsTable,
                        Item: {
                            issuer: appRecord.issuer,
                            address: appRecord.address,
                            visibility: appRecord.visibility,
                            authorizedUsers: appRecord.authorizedUsers,
                            record: json,
                            creationDate: appRecord.creationDate,
                        },
                        ConditionExpression:
                            'attribute_not_exists(issuer) AND attribute_not_exists(address)',
                    })
                    .promise();
            } else {
                console.log('[ServerlessRecordsStore] Saving in S3.');
                const json = stringify(appRecord.record);
                const hash = sha256().update(json).digest('hex');
                const filename = `${hash}.json`;

                await this._dynamo
                    .put({
                        TableName: this._permanentRecordsTable,
                        Item: {
                            issuer: appRecord.issuer,
                            address: appRecord.address,
                            visibility: appRecord.visibility,
                            authorizedUsers: appRecord.authorizedUsers,
                            recordKey: filename,
                            recordBucket: this._s3Bucket,
                            creationDate: appRecord.creationDate,
                        },
                        ConditionExpression:
                            'attribute_not_exists(issuer) AND attribute_not_exists(address)',
                    })
                    .promise();

                const listResult = await this._s3
                    .listObjects({
                        Bucket: this._s3Bucket,
                        Prefix: filename,
                    })
                    .promise();

                if (listResult.Contents.length <= 0) {
                    console.log(
                        '[ServerlessRecordsStore] Saving record data in S3.'
                    );
                    // Save to S3
                    const result = await this._s3
                        .putObject({
                            Bucket: this._s3Bucket,
                            Key: filename,
                            Body: json,
                            ContentType: 'application/json',
                        })
                        .promise();
                } else {
                    console.log(
                        '[ServerlessRecordsStore] No need to save in S3. Object already exists.'
                    );
                }
            }

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

    async deleteTemporaryRecord(record: DeletableRecord): Promise<void> {
        const key = `${this._redisNamespace}/${record.issuer}`;
        const field = record.address;

        await this._rHDel(key, field);
    }

    async deletePermanentRecord(record: DeletableRecord): Promise<void> {
        await this._dynamo
            .delete({
                TableName: this._permanentRecordsTable,
                Key: {
                    issuer: record.issuer,
                    address: record.address,
                },
            })
            .promise();
    }

    private _authorizedToAccessRecord(
        record: ServerlessRecord,
        query: RecordsQuery
    ) {
        if (record.visibility !== query.visibility) {
            return false;
        }

        if (record.visibility === 'restricted') {
            if (!query.token || !record.authorizedUsers.includes(query.token)) {
                return false;
            }
        }

        return true;
    }
}

export function escapeRedisPattern(pattern: string): string {
    return pattern.replace(/([\[\]\^\?\*\-\\])/g, '\\$1');
}
