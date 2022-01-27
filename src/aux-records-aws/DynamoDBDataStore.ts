import {
    DataRecordsStore,
    Record,
    RecordsStore,
} from '@casual-simulation/aux-records';
import {
    SetDataResult,
    GetDataStoreResult,
    EraseDataStoreResult,
    ListDataStoreResult,
} from '@casual-simulation/aux-records/DataRecordsStore';
import dynamodb from 'aws-sdk/clients/dynamodb';

export const LIST_DATA_PAGE_SIZE = 25;

/**
 * Defines a DataRecordsStore that can store data items in DynamoDB.
 */
export class DynamoDBDataStore implements DataRecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _tableName: string;

    constructor(dynamo: dynamodb.DocumentClient, tableName: string) {
        this._dynamo = dynamo;
        this._tableName = tableName;
    }

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string
    ): Promise<SetDataResult> {
        const item: StoredData = {
            recordName: recordName,
            address: address,
            data: data,
            publisherId: publisherId,
            subjectId: subjectId,
            publishTime: Date.now(),
        };
        const result = await this._dynamo
            .put({
                TableName: this._tableName,
                Item: item,
            })
            .promise()
            .then(
                (result) =>
                    ({
                        success: true,
                        result,
                    } as const),
                (err) =>
                    ({
                        success: false,
                        error: err,
                    } as const)
            );

        if (result.success === true) {
            return {
                success: true,
            };
        }

        console.warn('[DynamoDBDataStore] Error setting data:', result.error);
        if (result.error.name === 'ValidationError') {
            return {
                success: false,
                errorCode: 'data_too_large',
                errorMessage: 'Data is too large to store in the database.',
            };
        }

        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: result.error.toString(),
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const result = await this._dynamo
            .get({
                TableName: this._tableName,
                Key: {
                    recordName: recordName,
                    address: address,
                },
            })
            .promise()
            .then(
                (result) =>
                    ({
                        success: true,
                        result,
                    } as const),
                (err) =>
                    ({
                        success: false,
                        error: err,
                    } as const)
            );

        if (result.success === true) {
            const item = result.result.Item as StoredData;

            if (!item) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The data was not found.',
                };
            }

            return {
                success: true,
                data: item.data,
                publisherId: item.publisherId,
                subjectId: item.subjectId,
            };
        }

        console.warn('[DynamoDBDataStore] Error getting data:', result.error);
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: result.error.toString(),
        };
    }

    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        const result = await this._dynamo
            .delete({
                TableName: this._tableName,
                Key: {
                    recordName: recordName,
                    address: address,
                },
            })
            .promise()
            .then(
                (result) =>
                    ({
                        success: true,
                        result,
                    } as const),
                (err) =>
                    ({
                        success: false,
                        error: err,
                    } as const)
            );

        if (result.success === true) {
            return {
                success: true,
            };
        }

        console.warn('[DynamoDBDataStore] Error deleting data:', result.error);
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: result.error.toString(),
        };
    }

    async listData(
        recordName: string,
        address: string
    ): Promise<ListDataStoreResult> {
        const condition = !!address
            ? 'recordName = :recordName AND address > :address'
            : 'recordName = :recordName';

        let params: dynamodb.DocumentClient.QueryInput = {
            TableName: this._tableName,
            KeyConditionExpression: condition,
            ExpressionAttributeValues: {
                ':recordName': recordName,
                ':address': address,
            },
            Limit: LIST_DATA_PAGE_SIZE,
        };

        if (!!address) {
            params.ExclusiveStartKey = {
                recordName: recordName,
                address: address,
            };
        }

        const result = await this._dynamo.query(params).promise();

        let items: ListDataStoreResult['items'] = result.Items.map((i) => ({
            address: i.address,
            data: i.data,
        }));

        return {
            success: true,
            items,
        };
    }
}

interface StoredData {
    /**
     * The name of the record that the data is in.
     */
    recordName: string;

    /**
     * The address that the data is stored at.
     */
    address: string;

    /**
     * The data that is stored.
     */
    data: any;

    /**
     * The ID of the user that owns the record this data is being published to.
     */
    publisherId: string;

    /**
     * The ID of the user that was logged in when the data was published.
     */
    subjectId: string;

    /**
     * The time that the data was published in miliseconds since January 1 1970 00:00:00 UTC.
     */
    publishTime: number;
}
