import {
    EventRecordsStore,
    AddEventCountStoreResult,
    GetEventCountStoreResult,
} from '@casual-simulation/aux-records';
import dynamodb from 'aws-sdk/clients/dynamodb';

/**
 * Defines a EventRecordsStore that can store data items in DynamoDB.
 */
export class DynamoDBEventStore implements EventRecordsStore {
    private _dynamo: dynamodb.DocumentClient;
    private _tableName: string;

    constructor(dynamo: dynamodb.DocumentClient, tableName: string) {
        this._dynamo = dynamo;
        this._tableName = tableName;
    }

    async addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult> {
        await this._dynamo
            .update({
                TableName: this._tableName,
                Key: {
                    recordName: recordName,
                    eventName: eventName,
                },
                UpdateExpression:
                    'SET updateTime = :updateTime, ADD count :count',
                ExpressionAttributeValues: {
                    ':updateTime': Date.now(),
                    ':count': count,
                },
            })
            .promise();

        return {
            success: true,
        };
    }

    async getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult> {
        const result = await this._dynamo
            .get({
                TableName: this._tableName,
                Key: {
                    recordName: recordName,
                    eventName: eventName,
                },
            })
            .promise();

        if (result.Item) {
            const item = result.Item as StoredData;
            return {
                success: true,
                count: item.count,
            };
        } else {
            return {
                success: true,
                count: 0,
            };
        }
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
    eventName: string;

    /**
     * The count stored in the event.
     */
    count: number;

    /**
     * The time that the data was updated in miliseconds since January 1 1970 00:00:00 UTC.
     */
    updateTime: number;
}
