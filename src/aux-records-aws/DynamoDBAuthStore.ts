import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    SaveNewUserResult,
} from '@casual-simulation/aux-records/AuthStore';
import dynamodb from 'aws-sdk/clients/dynamodb';
import { omitBy } from 'lodash';

export class DynamoDBAuthStore implements AuthStore {
    private _dynamo: dynamodb.DocumentClient;
    private _usersTableName: string;
    private _usersTableEmailIndexName: string;
    private _usersTablePhoneIndexName: string;
    private _loginRequestsTableName: string;
    private _sessionsTableName: string;

    constructor(
        dynamo: dynamodb.DocumentClient,
        usersTableName: string,
        usersTableEmailIndexName: string,
        usersTablePhoneIndexName: string,
        loginRequestsTableName: string,
        sessionsTableName: string
    ) {
        this._dynamo = dynamo;
        this._usersTableName = usersTableName;
        this._usersTableEmailIndexName = usersTableEmailIndexName;
        this._usersTablePhoneIndexName = usersTablePhoneIndexName;
        this._loginRequestsTableName = loginRequestsTableName;
        this._sessionsTableName = sessionsTableName;
    }

    async saveUser(user: AuthUser): Promise<void> {
        await this._dynamo
            .put({
                TableName: this._usersTableName,
                Item: cleanupObject({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    avatarUrl: user.avatarUrl,
                    avatarPortraitUrl: user.avatarPortraitUrl,
                }),
            })
            .promise();
    }

    saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        return this._dynamo
            .put({
                TableName: this._usersTableName,
                Item: cleanupObject({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    avatarUrl: user.avatarUrl,
                    avatarPortraitUrl: user.avatarPortraitUrl,
                }),
                ConditionExpression: 'attribute_not_exists(id)',
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

    async findUserByAddress(
        address: string,
        addressType: AddressType
    ): Promise<AuthUser> {
        const addressQuery = await this._dynamo
            .query({
                TableName: this._usersTableName,
                ...this._findAddressQueryParams(address, addressType),
                Limit: 1,
            })
            .promise();

        if (addressQuery.Items.length > 0) {
            const userId = addressQuery.Items[0].id;
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
                };
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    private _findAddressQueryParams(
        address: string,
        addressType: AddressType
    ): Partial<dynamodb.DocumentClient.QueryInput> {
        if (addressType === 'phone') {
            return {
                IndexName: this._usersTablePhoneIndexName,
                KeyConditionExpression: 'phoneNumber = :phoneNumber',
                ExpressionAttributeValues: {
                    ':phoneNumber': address,
                },
            };
        } else {
            return {
                IndexName: this._usersTableEmailIndexName,
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': address,
                },
            };
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
        };
        await this._dynamo
            .put({
                TableName: this._sessionsTableName,
                Item: cleanupObject(data),
            })
            .promise();
    }
}

export function cleanupObject<T extends Object>(obj: T): Partial<T> {
    return omitBy(
        obj,
        (o) => typeof o === 'undefined' || o === null
    ) as Partial<T>;
}
