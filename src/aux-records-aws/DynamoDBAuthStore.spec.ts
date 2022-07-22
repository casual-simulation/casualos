import { DynamoDBAuthStore } from './DynamoDBAuthStore';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { awsResult, awsError } from './AwsTestUtils';

console.warn = jest.fn();
console.error = jest.fn();

describe('DynamoDBAuthStore', () => {
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
        update: jest.fn(),
    };
    let store: DynamoDBAuthStore;

    beforeEach(() => {
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            query: jest.fn(),
            update: jest.fn(),
        };
        store = new DynamoDBAuthStore(
            dynamodb as any,
            'users-table',
            'email-index',
            'phone-index',
            'login-requests-table',
            'sessions-table',
            'expire-time-index'
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
                allSessionRevokeTimeMs: 123,
                currentLoginRequestId: 'abc',
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
                    allSessionRevokeTimeMs: 123,
                    currentLoginRequestId: 'abc',
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
                allSessionRevokeTimeMs: 123,
                currentLoginRequestId: 'abc',
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
                    allSessionRevokeTimeMs: 123,
                    currentLoginRequestId: 'abc',
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
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
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
                allSessionRevokeTimeMs: undefined,
                currentLoginRequestId: undefined,
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

    describe('setCurrentLoginRequest()', () => {
        it('should update the specified user with the given login request', async () => {
            dynamodb.update.mockReturnValueOnce(awsResult({}));

            await store.setCurrentLoginRequest('myuserid', 'myrequestid');

            expect(dynamodb.update).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'myuserid',
                },
                UpdateExpression:
                    'SET currentLoginRequestId = :currentLoginRequestId',
                ExpressionAttributeValues: {
                    ':currentLoginRequestId': 'myrequestid',
                },
            });
        });
    });

    describe('findUser()', () => {
        it('should search the users table for the user', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        id: 'userId',
                        avatarPortraitUrl: 'portrait',
                        avatarUrl: 'url',
                        name: 'name',
                        email: 'myemail',
                        phoneNumber: 'myphone',
                        allSessionRevokeTimeMs: 123,
                        currentLoginRequestId: 'requestId',
                    },
                })
            );

            const result = await store.findUser('userId');

            expect(result).toEqual({
                id: 'userId',
                avatarPortraitUrl: 'portrait',
                avatarUrl: 'url',
                name: 'name',
                email: 'myemail',
                phoneNumber: 'myphone',
                allSessionRevokeTimeMs: 123,
                currentLoginRequestId: 'requestId',
            });
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'userId',
                },
            });
        });

        it('should return null if no user is found', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: null,
                })
            );

            const result = await store.findUser('userId');

            expect(result).toEqual(null);
            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'userId',
                },
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
                        allSessionRevokeTimeMs: 123,
                        currentLoginRequestId: 'requestId',
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
                allSessionRevokeTimeMs: 123,
                currentLoginRequestId: 'requestId',
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'email-index',
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
                        allSessionRevokeTimeMs: 123,
                        currentLoginRequestId: 'requestId',
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
                allSessionRevokeTimeMs: 123,
                currentLoginRequestId: 'requestId',
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'users-table',
                IndexName: 'phone-index',
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
                IndexName: 'phone-index',
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
                IndexName: 'phone-index',
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

    describe('findLoginRequest()', () => {
        it('should find the specified login request', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        userId: 'myuserid',
                        requestId: 'myrequestid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        completedTimeMs: 456,
                        requestTimeMs: 789,
                        attemptCount: 2,
                        address: 'myaddress',
                        addressType: 'email',
                        ipAddress: 'myip',
                    },
                })
            );

            const request = await store.findLoginRequest(
                'myuserid',
                'myrequestid'
            );

            expect(request).toEqual({
                userId: 'myuserid',
                requestId: 'myrequestid',
                secretHash: 'secretHash',
                expireTimeMs: 123,
                completedTimeMs: 456,
                requestTimeMs: 789,
                attemptCount: 2,
                address: 'myaddress',
                addressType: 'email',
                ipAddress: 'myip',
            });

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'login-requests-table',
                Key: {
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                },
            });
        });
    });

    describe('saveLoginRequest()', () => {
        it('should put the given login request into the database', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            const result = await store.saveLoginRequest({
                userId: 'myuserid',
                requestId: 'myrequestid',
                secretHash: 'secretHash',
                expireTimeMs: 123,
                completedTimeMs: 456,
                requestTimeMs: 789,
                attemptCount: 2,
                address: 'myaddress',
                addressType: 'email',
                ipAddress: 'myip',
                extra: 'missing',
            } as any);

            expect(result).toEqual({
                userId: 'myuserid',
                requestId: 'myrequestid',
                secretHash: 'secretHash',
                expireTimeMs: 123,
                completedTimeMs: 456,
                requestTimeMs: 789,
                attemptCount: 2,
                address: 'myaddress',
                addressType: 'email',
                ipAddress: 'myip',
            });

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'login-requests-table',
                Item: {
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                    secretHash: 'secretHash',
                    expireTimeMs: 123,
                    completedTimeMs: 456,
                    requestTimeMs: 789,
                    attemptCount: 2,
                    address: 'myaddress',
                    addressType: 'email',
                    ipAddress: 'myip',
                },
            });
        });
    });

    describe('markLoginRequestComplete()', () => {
        it('should update the specified login request', async () => {
            dynamodb.update.mockReturnValueOnce(awsResult({}));

            await store.markLoginRequestComplete(
                'myuserid',
                'myrequestid',
                123
            );

            expect(dynamodb.update).toHaveBeenCalledWith({
                TableName: 'login-requests-table',
                Key: {
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                },
                UpdateExpression: 'SET completedTimeMs = :completedTimeMs',
                ExpressionAttributeValues: {
                    ':completedTimeMs': 123,
                },
            });
        });
    });

    describe('incrementLoginRequestAttemptCount()', () => {
        it('should update the specified login request', async () => {
            dynamodb.update.mockReturnValueOnce(awsResult({}));

            await store.incrementLoginRequestAttemptCount(
                'myuserid',
                'myrequestid'
            );

            expect(dynamodb.update).toHaveBeenCalledWith({
                TableName: 'login-requests-table',
                Key: {
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                },
                UpdateExpression: 'SET attemptCount = attemptCount + 1',
            });
        });
    });

    describe('findSession()', () => {
        it('should find the specified session', async () => {
            dynamodb.get.mockReturnValueOnce(
                awsResult({
                    Item: {
                        userId: 'myuserid',
                        sessionId: 'mysessionid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        grantedTimeMs: 456,
                        revokeTimeMs: 789,
                        requestId: 'myrequestid',
                        previousSessionId: null,
                        ipAddress: 'myip',
                    },
                })
            );

            const request = await store.findSession('myuserid', 'mysessionid');

            expect(request).toEqual({
                userId: 'myuserid',
                sessionId: 'mysessionid',
                secretHash: 'secretHash',
                expireTimeMs: 123,
                grantedTimeMs: 456,
                revokeTimeMs: 789,
                requestId: 'myrequestid',
                previousSessionId: null,
                ipAddress: 'myip',
            });

            expect(dynamodb.get).toHaveBeenCalledWith({
                TableName: 'sessions-table',
                Key: {
                    userId: 'myuserid',
                    sessionId: 'mysessionid',
                },
            });
        });
    });

    describe('saveSession()', () => {
        it('should put the given session into the database', async () => {
            dynamodb.put.mockReturnValueOnce(awsResult({}));

            await store.saveSession({
                userId: 'myuserid',
                sessionId: 'mysessionid',
                secretHash: 'secretHash',
                expireTimeMs: 123,
                grantedTimeMs: 456,
                revokeTimeMs: 789,
                ipAddress: 'myip',
                requestId: 'myrequestid',
                previousSessionId: 'previoussessionid',
                extra: 'missing',
            } as any);

            expect(dynamodb.put).toHaveBeenCalledWith({
                TableName: 'sessions-table',
                Item: {
                    userId: 'myuserid',
                    sessionId: 'mysessionid',
                    secretHash: 'secretHash',
                    expireTimeMs: 123,
                    grantedTimeMs: 456,
                    revokeTimeMs: 789,
                    ipAddress: 'myip',
                    requestId: 'myrequestid',
                    previousSessionId: 'previoussessionid',
                },
            });
        });
    });

    describe('listSessions()', () => {
        it('should query the sessions', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            userId: 'myuserid',
                            sessionId: 'mysessionid',
                            secretHash: 'secretHash',
                            expireTimeMs: 123,
                            grantedTimeMs: 456,
                            revokeTimeMs: 789,
                            requestId: 'myrequestid',
                            previousSessionId: null,
                            ipAddress: 'myip',
                        },
                        {
                            userId: 'myuserid',
                            sessionId: 'mysessionid',
                            secretHash: 'secretHash',
                            expireTimeMs: 123,
                            grantedTimeMs: 456,
                            revokeTimeMs: 789,
                            requestId: 'myrequestid',
                            previousSessionId: null,
                            ipAddress: 'myip',
                        },
                    ],
                })
            );

            const result = await store.listSessions('myuserid', null);

            expect(result).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'myuserid',
                        sessionId: 'mysessionid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        grantedTimeMs: 456,
                        revokeTimeMs: 789,
                        requestId: 'myrequestid',
                        previousSessionId: null,
                        ipAddress: 'myip',
                    },
                    {
                        userId: 'myuserid',
                        sessionId: 'mysessionid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        grantedTimeMs: 456,
                        revokeTimeMs: 789,
                        requestId: 'myrequestid',
                        previousSessionId: null,
                        ipAddress: 'myip',
                    },
                ],
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'sessions-table',
                IndexName: 'expire-time-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': 'myuserid',
                },
                Limit: 10,
            });
        });

        it('should query the sessions that are older than the given time', async () => {
            dynamodb.query.mockReturnValueOnce(
                awsResult({
                    Items: [
                        {
                            userId: 'myuserid',
                            sessionId: 'mysessionid',
                            secretHash: 'secretHash',
                            expireTimeMs: 123,
                            grantedTimeMs: 456,
                            revokeTimeMs: 789,
                            requestId: 'myrequestid',
                            previousSessionId: null,
                            ipAddress: 'myip',
                        },
                        {
                            userId: 'myuserid',
                            sessionId: 'mysessionid',
                            secretHash: 'secretHash',
                            expireTimeMs: 123,
                            grantedTimeMs: 456,
                            revokeTimeMs: 789,
                            requestId: 'myrequestid',
                            previousSessionId: null,
                            ipAddress: 'myip',
                        },
                    ],
                })
            );

            const result = await store.listSessions('myuserid', 50);

            expect(result).toEqual({
                success: true,
                sessions: [
                    {
                        userId: 'myuserid',
                        sessionId: 'mysessionid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        grantedTimeMs: 456,
                        revokeTimeMs: 789,
                        requestId: 'myrequestid',
                        previousSessionId: null,
                        ipAddress: 'myip',
                    },
                    {
                        userId: 'myuserid',
                        sessionId: 'mysessionid',
                        secretHash: 'secretHash',
                        expireTimeMs: 123,
                        grantedTimeMs: 456,
                        revokeTimeMs: 789,
                        requestId: 'myrequestid',
                        previousSessionId: null,
                        ipAddress: 'myip',
                    },
                ],
            });

            expect(dynamodb.query).toHaveBeenCalledWith({
                TableName: 'sessions-table',
                IndexName: 'expire-time-index',
                KeyConditionExpression:
                    'userId = :userId AND expireTimeMs < :expireTimeMs',
                ExpressionAttributeValues: {
                    ':userId': 'myuserid',
                    ':expireTimeMs': 50,
                },
                Limit: 10,
            });
        });
    });

    describe('setRevokeAllSessionsTimeForUser()', () => {
        it('should set the allSessionRevokeTimeMs column on the user', async () => {
            dynamodb.update.mockReturnValueOnce(awsResult({}));

            await store.setRevokeAllSessionsTimeForUser('myid', 999);

            expect(dynamodb.update).toHaveBeenCalledWith({
                TableName: 'users-table',
                Key: {
                    id: 'myid',
                },
                UpdateExpression:
                    'SET allSessionRevokeTimeMs = :allSessionRevokeTimeMs',
                ExpressionAttributeValues: {
                    ':allSessionRevokeTimeMs': 999,
                },
            });
        });
    });
});
