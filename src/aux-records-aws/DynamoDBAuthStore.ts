import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    ListSessionsDataResult,
    SaveNewUserResult,
} from '@casual-simulation/aux-records/AuthStore';
import dynamodb from 'aws-sdk/clients/dynamodb';
import { omitBy } from 'lodash';

export class DynamoDBAuthStore implements AuthStore {
    private _dynamo: dynamodb.DocumentClient;
    private _usersTableName: string;
    private _userAddressesTableName: string;
    private _loginRequestsTableName: string;
    private _sessionsTableName: string;
    private _sessionsTableExpireTimeIndexName: string;

    constructor(
        dynamo: dynamodb.DocumentClient,
        usersTableName: string,
        userAddressesTableName: string,
        loginRequestsTableName: string,
        sessionsTableName: string,
        sessionsTableExpireTimeIndexName: string
    ) {
        this._dynamo = dynamo;
        this._usersTableName = usersTableName;
        this._userAddressesTableName = userAddressesTableName;
        this._loginRequestsTableName = loginRequestsTableName;
        this._sessionsTableName = sessionsTableName;
        this._sessionsTableExpireTimeIndexName =
            sessionsTableExpireTimeIndexName;
    }

    async setRevokeAllSessionsTimeForUser(
        userId: string,
        allSessionRevokeTimeMs: number
    ): Promise<void> {
        await this._dynamo
            .update({
                TableName: this._usersTableName,
                Key: {
                    id: userId,
                },
                UpdateExpression:
                    'SET allSessionRevokeTimeMs = :allSessionRevokeTimeMs',
                ExpressionAttributeValues: {
                    ':allSessionRevokeTimeMs': allSessionRevokeTimeMs,
                },
            })
            .promise();
    }

    async saveUser(user: AuthUser): Promise<void> {
        let items: dynamodb.DocumentClient.TransactWriteItemList = [
            {
                Put: {
                    TableName: this._usersTableName,
                    Item: cleanupObject({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        avatarUrl: user.avatarUrl,
                        avatarPortraitUrl: user.avatarPortraitUrl,
                        allSessionRevokeTimeMs: user.allSessionRevokeTimeMs,
                        currentLoginRequestId: user.currentLoginRequestId,
                    }),
                },
            },
        ];

        if (user.email) {
            // Save the email to the addresses table
            // This will overwrite the user ID that is associated with the email.
            // This is OK because findUserByAddress() checks to ensure that the email stored in the user record matches the one that was used to look up
            // the user.
            items.push({
                Put: {
                    TableName: this._userAddressesTableName,
                    Item: {
                        address: user.email,
                        addressType: 'email' as AddressType,
                        userId: user.id,
                    },
                },
            });
        }

        if (user.phoneNumber) {
            // Save the phone number to the addresses table.
            // This will overwrite the user ID that is associated with the phone number.
            // This is OK because findUserByAddress() checks to ensure that the phone number stored in the user record matches the one that was used to look up
            // the user.
            items.push({
                Put: {
                    TableName: this._userAddressesTableName,
                    Item: {
                        address: user.phoneNumber,
                        addressType: 'phone',
                        userId: user.id,
                    },
                },
            });
        }

        await this._dynamo
            .transactWrite({
                TransactItems: items,
            })
            .promise();
    }

    saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        let items: dynamodb.DocumentClient.TransactWriteItemList = [
            {
                Put: {
                    TableName: this._usersTableName,
                    Item: cleanupObject({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phoneNumber: user.phoneNumber,
                        avatarUrl: user.avatarUrl,
                        avatarPortraitUrl: user.avatarPortraitUrl,
                        allSessionRevokeTimeMs: user.allSessionRevokeTimeMs,
                        currentLoginRequestId: user.currentLoginRequestId,
                    }),
                    ConditionExpression: 'attribute_not_exists(id)',
                },
            },
        ];

        if (user.email) {
            // Save the email to the addresses table
            items.push({
                Put: {
                    TableName: this._userAddressesTableName,
                    Item: {
                        address: user.email,
                        addressType: 'email' as AddressType,
                        userId: user.id,
                    },
                    ConditionExpression: 'attribute_not_exists(address)',
                },
            });
        }

        if (user.phoneNumber) {
            // Save the phone number to the addresses table
            items.push({
                Put: {
                    TableName: this._userAddressesTableName,
                    Item: {
                        address: user.phoneNumber,
                        addressType: 'phone',
                        userId: user.id,
                    },
                    ConditionExpression: 'attribute_not_exists(address)',
                },
            });
        }

        return this._dynamo
            .transactWrite({
                TransactItems: items,
            })
            .promise()
            .then(
                (result) => {
                    return {
                        success: true,
                    };
                },
                (err) => {
                    if (err.name === 'ConditionalCheckFailedException') {
                        return {
                            success: false,
                            errorCode: 'user_already_exists',
                            errorMessage: 'The user already exists.',
                        } as SaveNewUserResult;
                    } else {
                        console.error(
                            '[DynamoDBAuthStore] Unable to save new user.',
                            err
                        );
                        return {
                            success: false,
                            errorCode: 'server_error',
                            errorMessage: 'A server error occurred.',
                        };
                    }
                }
            );
    }

    async setCurrentLoginRequest(
        userId: string,
        requestId: string
    ): Promise<void> {
        await this._dynamo
            .update({
                TableName: this._usersTableName,
                Key: {
                    id: userId,
                },
                UpdateExpression:
                    'SET currentLoginRequestId = :currentLoginRequestId',
                ExpressionAttributeValues: {
                    ':currentLoginRequestId': requestId,
                },
            })
            .promise();
    }

    async findUser(userId: string): Promise<AuthUser> {
        const userResult = await this._dynamo
            .get({
                TableName: this._usersTableName,
                Key: {
                    id: userId,
                },
            })
            .promise();

        const user = userResult.Item;
        if (user) {
            return {
                id: user.id,
                email: user.email,
                phoneNumber: user.phoneNumber,
                avatarPortraitUrl: user.avatarPortraitUrl,
                avatarUrl: user.avatarUrl,
                name: user.name,
                allSessionRevokeTimeMs: user.allSessionRevokeTimeMs,
                currentLoginRequestId: user.currentLoginRequestId,
            };
        } else {
            return null;
        }
    }

    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser> {
        const addressQuery = await this._dynamo
            .get({
                TableName: this._userAddressesTableName,
                Key: {
                    address: address,
                    addressType: addressType,
                },
            })
            .promise();

        if (addressQuery.Item) {
            const userId = addressQuery.Item.userId;
            const user = await this.findUser(userId);

            if (user) {
                if (addressType === 'email' && user.email === address) {
                    return user;
                } else if (
                    addressType === 'phone' &&
                    user.phoneNumber === address
                ) {
                    return user;
                }
            }

            return null;
        } else {
            return null;
        }
    }

    async findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest> {
        const result = await this._dynamo
            .get({
                TableName: this._loginRequestsTableName,
                Key: {
                    userId: userId,
                    requestId: requestId,
                },
            })
            .promise();

        if (result.Item) {
            return {
                userId: result.Item.userId,
                requestId: result.Item.requestId,
                secretHash: result.Item.secretHash,
                expireTimeMs: result.Item.expireTimeMs,
                completedTimeMs: result.Item.completedTimeMs,
                requestTimeMs: result.Item.requestTimeMs,
                address: result.Item.address,
                addressType: result.Item.addressType,
                ipAddress: result.Item.ipAddress,
                attemptCount: result.Item.attemptCount,
            };
        }
        return null;
    }

    async saveLoginRequest(
        request: AuthLoginRequest
    ): Promise<AuthLoginRequest> {
        const data: AuthLoginRequest = {
            userId: request.userId,
            requestId: request.requestId,
            secretHash: request.secretHash,
            expireTimeMs: request.expireTimeMs,
            completedTimeMs: request.completedTimeMs,
            requestTimeMs: request.requestTimeMs,
            address: request.address,
            addressType: request.addressType,
            ipAddress: request.ipAddress,
            attemptCount: request.attemptCount,
        };
        await this._dynamo
            .put({
                TableName: this._loginRequestsTableName,
                Item: cleanupObject(data),
            })
            .promise();

        return data;
    }

    async markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        await this._dynamo
            .update({
                TableName: this._loginRequestsTableName,
                Key: {
                    userId: userId,
                    requestId: requestId,
                },
                UpdateExpression: 'SET completedTimeMs = :completedTimeMs',
                ExpressionAttributeValues: {
                    ':completedTimeMs': completedTimeMs,
                },
            })
            .promise();
    }

    async incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void> {
        await this._dynamo
            .update({
                TableName: this._loginRequestsTableName,
                Key: {
                    userId: userId,
                    requestId: requestId,
                },
                UpdateExpression: 'SET attemptCount = attemptCount + 1',
            })
            .promise();
    }

    async findSession(userId: string, sessionId: string): Promise<AuthSession> {
        const result = await this._dynamo
            .get({
                TableName: this._sessionsTableName,
                Key: {
                    userId: userId,
                    sessionId: sessionId,
                },
            })
            .promise();

        if (result.Item) {
            return {
                userId: result.Item.userId,
                sessionId: result.Item.sessionId,
                secretHash: result.Item.secretHash,
                expireTimeMs: result.Item.expireTimeMs,
                grantedTimeMs: result.Item.grantedTimeMs,
                revokeTimeMs: result.Item.revokeTimeMs,
                ipAddress: result.Item.ipAddress,
                requestId: result.Item.requestId,
                previousSessionId: result.Item.previousSessionId,
                nextSessionId: result.Item.nextSessionId,
            };
        }
        return null;
    }

    async saveSession(session: AuthSession): Promise<void> {
        const data: AuthSession = {
            userId: session.userId,
            sessionId: session.sessionId,
            secretHash: session.secretHash,
            expireTimeMs: session.expireTimeMs,
            grantedTimeMs: session.grantedTimeMs,
            revokeTimeMs: session.revokeTimeMs,
            ipAddress: session.ipAddress,
            requestId: session.requestId,
            previousSessionId: session.previousSessionId,
            nextSessionId: session.nextSessionId,
        };
        await this._dynamo
            .put({
                TableName: this._sessionsTableName,
                Item: cleanupObject(data),
            })
            .promise();
    }

    async listSessions(
        userId: string,
        expireTimeMs: number | null
    ): Promise<ListSessionsDataResult> {
        const query =
            typeof expireTimeMs === 'number'
                ? 'userId = :userId AND expireTimeMs < :expireTimeMs'
                : 'userId = :userId';
        const values =
            typeof expireTimeMs === 'number'
                ? {
                      ':userId': userId,
                      ':expireTimeMs': expireTimeMs,
                  }
                : {
                      ':userId': userId,
                  };

        const result = await this._dynamo
            .query({
                TableName: this._sessionsTableName,
                IndexName: this._sessionsTableExpireTimeIndexName,
                KeyConditionExpression: query,
                ExpressionAttributeValues: values,
                Limit: 10,
            })
            .promise();

        return {
            success: true,
            sessions: result.Items.map((i) => {
                let session: AuthSession = {
                    userId: i.userId,
                    sessionId: i.sessionId,
                    secretHash: i.secretHash,
                    expireTimeMs: i.expireTimeMs,
                    grantedTimeMs: i.grantedTimeMs,
                    revokeTimeMs: i.revokeTimeMs,
                    ipAddress: i.ipAddress,
                    requestId: i.requestId,
                    previousSessionId: i.previousSessionId,
                    nextSessionId: i.nextSessionId,
                };
                return session;
            }),
        };
    }
}

export function cleanupObject<T extends Object>(obj: T): Partial<T> {
    return omitBy(
        obj,
        (o) => typeof o === 'undefined' || o === null
    ) as Partial<T>;
}
