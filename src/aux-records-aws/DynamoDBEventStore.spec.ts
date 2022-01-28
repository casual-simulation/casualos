import { DynamoDBEventStore } from './DynamoDBEventStore';
import { awsResult, awsError } from './AwsTestUtils';

console.warn = jest.fn();

describe('DynamoDBEventStore', () => {
    let dynamodb = {
        update: jest.fn(),
        get: jest.fn(),
    };
    let store: DynamoDBEventStore;

    beforeEach(() => {
        dynamodb = {
            update: jest.fn(),
            get: jest.fn(),
        };
        store = new DynamoDBEventStore(dynamodb as any, 'test-table');

        dynamodb.get.mockReturnValue(
            awsResult({
                Item: null,
            })
        );
    });

    describe('addEventCount()', () => {
        it('should add the given count to the given record and event', async () => {
            dynamodb.update.mockReturnValueOnce(awsResult({}));

            const result = await store.addEventCount(
                'test-record',
                'test-event',
                5
            );

            expect(result).toEqual({
                success: true,
            });

            expect(dynamodb.update).toHaveBeenCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record',
                    eventName: 'test-event',
                },
                UpdateExpression:
                    'SET updateTime = :updateTime, ADD count :count',
                ExpressionAttributeValues: {
                    ':updateTime': expect.any(Number),
                    ':count': 5,
                },
            });

            // Make sure the publish time is within the last 10 seconds
            expect(
                Date.now() -
                    dynamodb.update.mock.calls[0][0].ExpressionAttributeValues[
                        ':updateTime'
                    ]
            ).toBeLessThan(10000);
        });
    });

    describe('getEventCount()', () => {
        it('should return 0 if the item doesnt exist', async () => {
            dynamodb.get.mockReturnValueOnce(awsResult({}));

            const result = await store.getEventCount(
                'test-record',
                'test-event'
            );

            expect(result).toEqual({
                success: true,
                count: 0,
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record',
                    eventName: 'test-event',
                },
            });
        });

        it('should return the count of the item', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        count: 50,
                    },
                })
            );

            const result = await store.getEventCount(
                'test-record',
                'test-event'
            );

            expect(result).toEqual({
                success: true,
                count: 50,
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record',
                    eventName: 'test-event',
                },
            });
        });
    });
});
