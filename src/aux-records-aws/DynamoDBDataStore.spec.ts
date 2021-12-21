import { DynamoDBDataStore } from './DynamoDBDataStore';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';

describe('DynamoDBDataStore', () => {
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
    };
    let store: DynamoDBDataStore;

    beforeEach(() => {
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
        };
        store = new DynamoDBDataStore(dynamodb as any, 'test-table');

        dynamodb.get.mockReturnValue(
            awsResult({
                Item: null,
            })
        );
    });

    describe('setData()', () => {
        it('should add the given record to the table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            const result = await store.setData(
                'test-record',
                'test-address',
                {
                    myData: 'abc',
                },
                'publisherId',
                'subjectId'
            );

            expect(result).toEqual({
                success: true,
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'test-table',
                Item: {
                    recordName: 'test-record',
                    address: 'test-address',
                    data: {
                        myData: 'abc',
                    },
                    publisherId: 'publisherId',
                    subjectId: 'subjectId',
                    publishTime: expect.any(Number),
                },
            });

            // Make sure the publish time is within the last 10 seconds
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.publishTime
            ).toBeLessThan(10000);
        });

        it('should return a data_too_large error if a ValidationError is thrown', async () => {
            dynamodb.put.mockReturnValueOnce(
                awsError({
                    name: 'ValidationError',
                })
            );

            const result = await store.setData(
                'test-record',
                'test-address',
                {
                    myData: 'abc',
                },
                'publisherId',
                'subjectId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'data_too_large',
                errorMessage: 'Data is too large to store in the database.',
            });
        });
    });

    describe('getData()', () => {
        it('should get the record by name from the table', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'test-record',
                        address: 'test-address',
                        data: {
                            myData: 'abc',
                        },
                        publisherId: 'publisherId',
                        subjectId: 'subjectId',
                        publishTime: 123456789,
                    },
                })
            );

            const result = await store.getData('test-record', 'test-address');

            expect(result).toEqual({
                success: true,
                data: {
                    myData: 'abc',
                },
                publisherId: 'publisherId',
                subjectId: 'subjectId',
            });
        });

        it('should return a data_not_found result if get returns a null item', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: null,
                })
            );

            const result = await store.getData('test-record', 'test-address');

            expect(result).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            });
        });
    });
});

function awsResult(value: any) {
    return {
        promise() {
            return Promise.resolve(value);
        },
    };
}

function awsError(error: any) {
    return {
        promise() {
            return Promise.reject(error);
        },
    };
}
