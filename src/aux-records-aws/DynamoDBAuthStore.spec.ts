import { DynamoDBAuthStore } from './DynamoDBAuthStore';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { awsResult, awsError } from './AwsTestUtils';

console.warn = jest.fn();

describe('DynamoDBAuthStore', () => {
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
    };
    let store: DynamoDBAuthStore;

    beforeEach(() => {
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            query: jest.fn(),
        };
        store = new DynamoDBAuthStore(
            dynamodb as any,
            'users-table',
            'login-requests-table',
            'sessions-table'
        );

        dynamodb.get.mockReturnValue(
            awsResult({
                Item: null,
            })
        );
    });

    describe('saveUser()', () => {
        it('should add the given record to the users table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            await store.saveUser({
                id: 'userId',
                email: 'email',
                phoneNumber: 'phone',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'users-table',
                Item: {
                    id: 'userId',
                    avatarPortraitUrl: 'portrait',
                    avatarUrl: 'url',
                    name: 'name',
                    email: 'email',
                    phoneNumber: 'phone',
                },
            });
        });
    });

    describe('saveNewUser()', () => {
        it('should add the given record to the users table', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            const result = await store.saveNewUser({
                id: 'userId',
                email: 'email',
                phoneNumber: 'phone',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
            });

            expect(result).toEqual({
                success: true,
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'users-table',
                Item: {
                    id: 'userId',
                    avatarPortraitUrl: 'portrait',
                    avatarUrl: 'url',
                    name: 'name',
                    email: 'email',
                    phoneNumber: 'phone',
                },
                ConditionExpression: 'attribute_not_exists(id)',
            });
        });

        it('should gracefully handle condition check errors', async () => {
            dynamodb.put.mockReturnValueOnce(
                awsError({
                    name: 'ConditionalCheckFailedException',
                })
            );

            const result = await store.saveNewUser({
                id: 'userId',
                email: 'email',
                phoneNumber: 'phone',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'user_already_exists',
                errorMessage: 'The user already exists.',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'users-table',
                Item: {
                    id: 'userId',
                    avatarPortraitUrl: 'portrait',
                    avatarUrl: 'url',
                    name: 'name',
                    email: 'email',
                    phoneNumber: 'phone',
                },
                ConditionExpression: 'attribute_not_exists(id)',
            });
        });

        it('should gracefully handle other errors', async () => {
            dynamodb.put.mockReturnValueOnce(
                awsError({
                    name: 'Error',
                })
            );

            const result = await store.saveNewUser({
                id: 'userId',
                email: 'email',
                phoneNumber: 'phone',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'users-table',
                Item: {
                    id: 'userId',
                    avatarPortraitUrl: 'portrait',
                    avatarUrl: 'url',
                    name: 'name',
                    email: 'email',
                    phoneNumber: 'phone',
                },
                ConditionExpression: 'attribute_not_exists(id)',
            });
        });
    });

    describe('findUserByAddress()', () => {
        it('should search the addresses table and email index for the given email address', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            email: 'myemail',
                            id: 'userId',
                        },
                    ],
                })
            );
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        id: 'userId',
                        avatarPortraitUrl: 'portrait',
                        avatarUrl: 'url',
                        name: 'name',
                        email: 'myemail',
                        phoneNumber: 'myphone',
                    },
                })
            );

            const result = await store.findUserByAddress('myemail', 'email');

            expect(result).toEqual({
                id: 'userId',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
                email: 'myemail',
                phoneNumber: 'myphone',
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': 'myemail',
                },
                Limit: 1,
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'userId',
                },
            });
        });

        it('should search the addresses table and phone index for the given phone address', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            phoneNumber: 'myphone',
                            id: 'userId',
                        },
                    ],
                })
            );
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        id: 'userId',
                        avatarPortraitUrl: 'portrait',
                        avatarUrl: 'url',
                        name: 'name',
                        email: 'myemail',
                        phoneNumber: 'myphone',
                    },
                })
            );

            const result = await store.findUserByAddress('myphone', 'phone');

            expect(result).toEqual({
                id: 'userId',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
                email: 'myemail',
                phoneNumber: 'myphone',
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'PhoneIndex',
                KeyConditionExpression: 'phoneNumber = :phoneNumber',
                ExpressionAttributeValues: {
                    ':phoneNumber': 'myphone',
                },
                Limit: 1,
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'userId',
                },
            });
        });

        it('should return null if no address is found in the index', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [],
                })
            );

            const result = await store.findUserByAddress('myphone', 'phone');

            expect(result).toEqual(null);

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'PhoneIndex',
                KeyConditionExpression: 'phoneNumber = :phoneNumber',
                ExpressionAttributeValues: {
                    ':phoneNumber': 'myphone',
                },
                Limit: 1,
            });
            expect(dynamodb.get).not.toHaveBeenCalled();
        });

        it('should return null if the user ID is not found', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            phoneNumber: 'myphone',
                            id: 'userId',
                        },
                    ],
                })
            );
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: null,
                })
            );

            const result = await store.findUserByAddress('myphone', 'phone');

            expect(result).toEqual(null);

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'PhoneIndex',
                KeyConditionExpression: 'phoneNumber = :phoneNumber',
                ExpressionAttributeValues: {
                    ':phoneNumber': 'myphone',
                },
                Limit: 1,
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'userId',
                },
            });
        });
    });

    // describe('setData()', () => {
    //     it('should add the given record to the table', async () => {
    //         dynamodb.put.mockReturnValueOnce(awsResult({}));

    //         const result = await store.setData(
    //             'test-record',
    //             'test-address',
    //             {
    //                 myData: 'abc',
    //             },
    //             'publisherId',
    //             'subjectId',
    //             true,
    //             true
    //         );

    //         expect(result).toEqual({
    //             success: true,
    //         });

    //         expect(dynamodb.put).toHaveBeenCalledWith({
    //             TableName: 'test-table',
    //             Item: {
    //                 recordName: 'test-record',
    //                 address: 'test-address',
    //                 data: {
    //                     myData: 'abc',
    //                 },
    //                 publisherId: 'publisherId',
    //                 subjectId: 'subjectId',
    //                 publishTime: expect.any(Number),
    //                 updatePolicy: true,
    //                 deletePolicy: true,
    //             },
    //         });

    //         // Make sure the publish time is within the last 10 seconds
    //         expect(
    //             Date.now() - dynamodb.put.mock.calls[0][0].Item.publishTime
    //         ).toBeLessThan(10000);
    //     });

    //     it('should return a data_too_large error if a ValidationError is thrown', async () => {
    //         dynamodb.put.mockReturnValueOnce(
    //             awsError({
    //                 name: 'ValidationError',
    //             })
    //         );

    //         const result = await store.setData(
    //             'test-record',
    //             'test-address',
    //             {
    //                 myData: 'abc',
    //             },
    //             'publisherId',
    //             'subjectId',
    //             true,
    //             true
    //         );

    //         expect(result).toEqual({
    //             success: false,
    //             errorCode: 'data_too_large',
    //             errorMessage: 'Data is too large to store in the database.',
    //         });
    //     });
    // });

    // describe('getData()', () => {
    //     it('should get the record by name from the table', async () => {
    //         dynamodb.get.mockReturnValueOnce(
    //             awsResult({
    //                 Item: {
    //                     recordName: 'test-record',
    //                     address: 'test-address',
    //                     data: {
    //                         myData: 'abc',
    //                     },
    //                     publisherId: 'publisherId',
    //                     subjectId: 'subjectId',
    //                     publishTime: 123456789,
    //                     updatePolicy: ['abc'],
    //                     deletePolicy: ['def'],
    //                 },
    //             })
    //         );

    //         const result = await store.getData('test-record', 'test-address');

    //         expect(result).toEqual({
    //             success: true,
    //             data: {
    //                 myData: 'abc',
    //             },
    //             publisherId: 'publisherId',
    //             subjectId: 'subjectId',
    //             updatePolicy: ['abc'],
    //             deletePolicy: ['def'],
    //         });
    //     });

    //     it('should return a data_not_found result if get returns a null item', async () => {
    //         dynamodb.get.mockReturnValueOnce(
    //             awsResult({
    //                 Item: null,
    //             })
    //         );

    //         const result = await store.getData('test-record', 'test-address');

    //         expect(result).toEqual({
    //             success: false,
    //             errorCode: 'data_not_found',
    //             errorMessage: 'The data was not found.',
    //         });
    //     });
    // });

    // describe('listData()', () => {
    //     it('should get the record by name from the table', async () => {
    //         dynamodb.query.mockReturnValueOnce(
    //             awsResult({
    //                 Items: [
    //                     {
    //                         recordName: 'test-record',
    //                         address: 'test-address',
    //                         data: {
    //                             myData: 'abc',
    //                         },
    //                         publisherId: 'publisherId',
    //                         subjectId: 'subjectId',
    //                         publishTime: 123456789,
    //                     },
    //                 ],
    //             })
    //         );

    //         const result = await store.listData('test-record', 'test-address');

    //         expect(result).toEqual({
    //             success: true,
    //             items: [
    //                 {
    //                     address: 'test-address',
    //                     data: {
    //                         myData: 'abc',
    //                     },
    //                 },
    //             ],
    //         });
    //         expect(dynamodb.query).toHaveBeenCalledWith({
    //             TableName: 'test-table',
    //             KeyConditionExpression:
    //                 'recordName = :recordName AND address > :address',
    //             ExpressionAttributeValues: {
    //                 ':recordName': 'test-record',
    //                 ':address': 'test-address',
    //             },
    //             Limit: 25,
    //         });
    //     });

    //     it('should execute a simpler query if no address is specified', async () => {
    //         dynamodb.query.mockReturnValueOnce(
    //             awsResult({
    //                 Items: [
    //                     {
    //                         recordName: 'test-record',
    //                         address: 'test-address',
    //                         data: {
    //                             myData: 'abc',
    //                         },
    //                         publisherId: 'publisherId',
    //                         subjectId: 'subjectId',
    //                         publishTime: 123456789,
    //                     },
    //                 ],
    //             })
    //         );

    //         const result = await store.listData('test-record', null);

    //         expect(result).toEqual({
    //             success: true,
    //             items: [
    //                 {
    //                     address: 'test-address',
    //                     data: {
    //                         myData: 'abc',
    //                     },
    //                 },
    //             ],
    //         });
    //         expect(dynamodb.query).toHaveBeenCalledWith({
    //             TableName: 'test-table',
    //             KeyConditionExpression: 'recordName = :recordName',
    //             ExpressionAttributeValues: {
    //                 ':recordName': 'test-record',
    //             },
    //             Limit: 25,
    //         });
    //     });
    // });

    // describe('eraseData()', () => {
    //     it('should delete the given record from the table', async () => {
    //         dynamodb.delete.mockReturnValueOnce(awsResult({}));

    //         const result = await store.eraseData('test-record', 'test-address');

    //         expect(result).toEqual({
    //             success: true,
    //         });

    //         expect(dynamodb.delete).toHaveBeenCalledWith({
    //             TableName: 'test-table',
    //             Key: {
    //                 recordName: 'test-record',
    //                 address: 'test-address',
    //             },
    //         });
    //     });
    // });
});
