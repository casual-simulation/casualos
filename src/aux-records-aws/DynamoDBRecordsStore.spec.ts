import { DynamoDBRecordsStore } from './DynamoDBRecordsStore';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';

describe('DynamoDBRecordsStore', () => {
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
    };
    let store: DynamoDBRecordsStore;

    beforeEach(() => {
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
        };
        store = new DynamoDBRecordsStore(dynamodb as any, 'test-table', 'key-table');

        dynamodb.get.mockReturnValue(
            awsResult({
                Item: null,
            })
        );
    });

    describe('addRecord()', () => {
        it('should add the given record to the table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            await store.addRecord({
                name: 'test-record',
                ownerId: 'ownerId',
                secretHashes: ['hash1', 'hash2'],
                secretSalt: 'salt',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'test-table',
                Item: {
                    recordName: 'test-record',
                    ownerId: 'ownerId',
                    secretHashes: ['hash1', 'hash2'],
                    secretSalt: 'salt',
                    creationTime: expect.any(Number),
                    updateTime: expect.any(Number),
                },
            });

            // Make sure the creation time is within the last 10 seconds
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.creationTime
            ).toBeLessThan(10000);
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.updateTime
            ).toBeLessThan(10000);
        });
    });

    describe('updateRecord()', () => {
        it('should add the given record to the table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            await store.updateRecord({
                name: 'test-record',
                ownerId: 'ownerId',
                secretHashes: ['hash1', 'hash2'],
                secretSalt: 'salt',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'test-table',
                Item: {
                    recordName: 'test-record',
                    ownerId: 'ownerId',
                    secretHashes: ['hash1', 'hash2'],
                    secretSalt: 'salt',
                    creationTime: expect.any(Number),
                    updateTime: expect.any(Number),
                },
            });

            // Make sure the creation time is within the last 10 seconds
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.creationTime
            ).toBeLessThan(10000);
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.updateTime
            ).toBeLessThan(10000);
        });

        it('should update records in the table', async () => {
            const oldNow = Date.now() - 50000;
            dynamodb.put.mockReturnValueOnce(awsResult({}));
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'test-record',
                        ownerId: 'ownerId',
                        secretHashes: ['hash1', 'hash2'],
                        secretSalt: 'salt',
                        creationTime: oldNow,
                        updateTime: oldNow,
                    },
                })
            );

            await store.updateRecord({
                name: 'test-record',
                ownerId: 'ownerId',
                secretHashes: ['hash1', 'hash2'],
                secretSalt: 'salt',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'test-table',
                Item: {
                    recordName: 'test-record',
                    ownerId: 'ownerId',
                    secretHashes: ['hash1', 'hash2'],
                    secretSalt: 'salt',
                    creationTime: oldNow,
                    updateTime: expect.any(Number),
                },
            });

            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.updateTime
            ).toBeLessThan(10000);
        });
    });

    describe('getRecordByName()', () => {
        it('should get the record by name from the table', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        recordName: 'test-record',
                        ownerId: 'ownerId',
                        secretHashes: ['hash1', 'hash2'],
                        secretSalt: 'salt',
                    },
                })
            );

            const record = await store.getRecordByName('test-record');

            expect(record).toEqual({
                name: 'test-record',
                ownerId: 'ownerId',
                secretHashes: ['hash1', 'hash2'],
                secretSalt: 'salt',
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record'
                }
            });
        });
    });

    describe('addRecordKey()', () => {
        it('should add the given record to the table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            await store.addRecordKey({
                recordName: 'test-record',
                creatorId: 'creatorId',
                policy: 'subjectfull',
                secretHash: 'secretHash'
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'key-table',
                Item: {
                    recordName: 'test-record',
                    creatorId: 'creatorId',
                    policy: 'subjectfull',
                    secretHash: 'secretHash',
                    creationTime: expect.any(Number)
                }
            });
            // Make sure the creation time is within the last 10 seconds
            expect(
                Date.now() - dynamodb.put.mock.calls[0][0].Item.creationTime
            ).toBeLessThan(10000);
        });
    });

    describe('getRecordKeyByRecordAndHash()', () => {
        it('should get the record by name and hash from the table', async () => {
            dynamodb.get.mockReturnValueOnce(awsResult({
                Item: {
                    recordName: 'test-record',
                    secretHash: 'hash',
                    creatorId: 'creatorId',
                    policy: 'subjectless'
                }
            }));

            const key = await store.getRecordKeyByRecordAndHash('test-record', 'hash');

            expect(key).toEqual({
                recordName: 'test-record',
                secretHash: 'hash',
                creatorId: 'creatorId',
                policy: 'subjectless'
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'key-table',
                Key: {
                    recordName: 'test-record',
                    secretHash: 'hash'
                }
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
