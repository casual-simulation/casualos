import {
    AddressType,
    AuthLoginRequest,
    AuthSession,
    AuthStore,
    AuthUser,
    SaveNewUserResult,
} from '@casual-simulation/aux-records/AuthStore';
import dynamodb from 'aws-sdk/clients/dynamodb';

export class DynamoDBAuthStore implements AuthStore {
    private _dynamo: dynamodb.DocumentClient;
    private _usersTableName: string;
    private _loginRequestsTableName: string;
    private _sessionsTableName: string;

    constructor(
        dynamo: dynamodb.DocumentClient,
        usersTableName: string,
        loginRequestsTableName: string,
        sessionsTableName: string
    ) {
        this._dynamo = dynamo;
        this._usersTableName = usersTableName;
        this._loginRequestsTableName = loginRequestsTableName;
        this._sessionsTableName = sessionsTableName;
    }

    async saveUser(user: AuthUser): Promise<void> {
        await this._dynamo
            .put({
                TableName: this._usersTableName,
                Item: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    avatarUrl: user.avatarUrl,
                    avatarPortraitUrl: user.avatarPortraitUrl,
                },
            })
            .promise();
    }

    saveNewUser(user: AuthUser): Promise<SaveNewUserResult> {
        return this._dynamo
            .put({
                TableName: this._usersTableName,
                Item: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    avatarUrl: user.avatarUrl,
                    avatarPortraitUrl: user.avatarPortraitUrl,
                },
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
                IndexName: 'PhoneIndex',
                KeyConditionExpression: 'phoneNumber = :phoneNumber',
                ExpressionAttributeValues: {
                    ':phoneNumber': address,
                },
            };
        } else {
            return {
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': address,
                },
            };
        }
    }

    findLoginRequest(
        userId: string,
        requestId: string
    ): Promise<AuthLoginRequest> {
        throw new Error('Method not implemented.');
    }

    findSession(userId: string, sessionId: string): Promise<AuthSession> {
        throw new Error('Method not implemented.');
    }

    saveLoginRequest(request: AuthLoginRequest): Promise<AuthLoginRequest> {
        throw new Error('Method not implemented.');
    }

    markLoginRequestComplete(
        userId: string,
        requestId: string,
        completedTimeMs: number
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    incrementLoginRequestAttemptCount(
        userId: string,
        requestId: string
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    saveSession(session: AuthSession): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
