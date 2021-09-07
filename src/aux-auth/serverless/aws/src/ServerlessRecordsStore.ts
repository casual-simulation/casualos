import { DynamodbDataSourceConfig } from 'aws-sdk/clients/appsync';
import {
    DeletableRecord,
    RecordsQuery,
    RecordsStore,
    SaveRecordResult,
    ServerlessRecord,
} from './RecordsStore';
import dynamodb from 'aws-sdk/clients/dynamodb';
import { RedisClient } from 'redis';
import { promisify } from 'util';
import { AWSError } from 'aws-sdk';
import {
    GetRecordsActionResult,
    hasValue,
    Record,
} from '@casual-simulation/aux-common';

const BATCH_SIZE = 25;
const REDIS_BATCH_SIZE = (1000).toString();
const MAX_REDIS_ITERATIONS = 10000;

export class ServerlessRecordsStore implements RecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _permanentRecordsTable: string;
    private _redis: RedisClient;
    private _redisNamespace: string;

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
    ) => Promise<[string, ...[string, string][]]>;
    private _rHDel: (key: string, ...fields: string[]) => Promise<number>;

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
        } else {
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

            let records: Record[] = result.Items.map((i) => {
                const record: ServerlessRecord = i as ServerlessRecord;

                if (!this._authorizedToAccessRecord(record, query)) {
                    return null;
                }

                return {
                    authID: i.issuer,
                    address: i.address,
                    data: JSON.parse(i.record),
                    space:
                        'permanent' +
                        (i.visibility === 'global' ? 'Global' : 'Restricted'),
                } as Record;
            });

            return {
                hasMoreRecords: result.LastEvaluatedKey !== undefined,
                cursor: result.LastEvaluatedKey
                    ? JSON.stringify(result.LastEvaluatedKey)
                    : undefined,
                totalCount: totalCount,
                records: records.filter((r) => !!r),
            };
        }
    }

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
            const [nextIndex, ...keysAndValues] = await this._rHScan(
                key,
                cursor,
                'MATCH',
                filter,
                'COUNT',
                REDIS_BATCH_SIZE
            );
            records.push(
                ...keysAndValues.map(([key, value]) => {
                    if (!value) {
                        return null;
                    }

                    try {
                        const record: ServerlessRecord = JSON.parse(value);

                        if (!this._authorizedToAccessRecord(record, query)) {
                            return null;
                        }

                        return {
                            address: record.address,
                            authID: record.issuer,
                            data: record.record,
                            space:
                                'temp' +
                                (record.visibility === 'global'
                                    ? 'Global'
                                    : 'Restricted'),
                        } as Record;
                    } catch (err) {
                        console.error(
                            '[ServerlessRecordStore] Failed to parse value:',
                            value,
                            err
                        );
                        return null;
                    }
                })
            );
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
