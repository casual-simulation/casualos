import { Atom } from '@casual-simulation/causal-trees';
import AWS from 'aws-sdk';
import { getDocumentClient } from './Utils';
import {
    PutItemInputAttributeMap,
    PutRequest,
    WriteRequest,
} from 'aws-sdk/clients/dynamodb';
import {
    ApiaryConnectionStore,
    DeviceConnection,
    DeviceNamespaceConnection,
} from './ApiaryConnectionStore';
import { processBatch } from './DynamoDbUtils';

const CONNECTION_ID_AND_NAMESPACE_INDEX = 'ConnectionIdAndNamespaceIndex';

/**
 * Defines a class that specifies a DynamoDB implementation of an ApiaryAtomStore.
 */
export class DynamoDbConnectionStore implements ApiaryConnectionStore {
    private _connectionsTableName: string;
    private _connectionsByNamespaceTableName: string;
    private _client: AWS.DynamoDB.DocumentClient;

    constructor(
        connectionsTableName: string,
        connectionsByNamespaceTableName: string,
        client?: AWS.DynamoDB.DocumentClient
    ) {
        this._connectionsTableName = connectionsTableName;
        this._connectionsByNamespaceTableName = connectionsByNamespaceTableName;
        this._client = client || getDocumentClient();
    }

    async saveConnection(connection: DeviceConnection): Promise<void> {
        await this._client
            .put({
                TableName: this._connectionsTableName,
                Item: {
                    connectionId: connection.connectionId,
                    sessionId: connection.sessionId,
                    username: connection.username,
                    token: connection.token,
                },
            })
            .promise();
    }

    async saveNamespaceConnection(
        connection: DeviceNamespaceConnection
    ): Promise<void> {
        await this._client
            .put({
                TableName: this._connectionsByNamespaceTableName,
                Item: {
                    connectionId: connection.connectionId,
                    namespace: connection.namespace,
                    sessionId: connection.sessionId,
                    username: connection.username,
                    token: connection.token,
                    temporary: connection.temporary,
                },
            })
            .promise();
    }

    async deleteNamespaceConnection(
        connectionId: string,
        namespace: string
    ): Promise<void> {
        await this._client
            .delete({
                TableName: this._connectionsByNamespaceTableName,
                Key: {
                    connectionId: connectionId,
                    namespace: namespace,
                },
            })
            .promise();
    }

    async clearConnection(connectionId: string): Promise<void> {
        await this._client
            .delete({
                TableName: this._connectionsTableName,
                Key: {
                    connectionId: connectionId,
                },
            })
            .promise();
        const result = await this._client
            .query({
                TableName: this._connectionsByNamespaceTableName,
                ProjectionExpression: 'namespace, connectionId',
                KeyConditionExpression: 'connectionId = :connectionId',
                ExpressionAttributeValues: {
                    ':connectionId': connectionId,
                },
                IndexName: CONNECTION_ID_AND_NAMESPACE_INDEX,
            })
            .promise();

        if (result.Items) {
            const requests: WriteRequest[] = result.Items.map((item) => ({
                DeleteRequest: {
                    Key: {
                        connectionId: item.connectionId,
                        namespace: item.namespace,
                    },
                },
            }));

            await processBatch(
                this._client,
                this._connectionsByNamespaceTableName,
                requests
            );
        }
    }

    async getConnectionsByNamespace(
        namespace: string
    ): Promise<DeviceNamespaceConnection[]> {
        const result = await this._client
            .query({
                TableName: this._connectionsByNamespaceTableName,
                KeyConditionExpression: 'namespace = :namespace',
                ExpressionAttributeValues: {
                    ':namespace': namespace,
                },
            })
            .promise();

        if (result.Items) {
            const connections: DeviceNamespaceConnection[] = result.Items.map(
                (item) => ({
                    connectionId: item.connectionId,
                    namespace: item.namespace,
                    sessionId: item.sessionId,
                    temporary: item.temporary,
                    token: item.token,
                    username: item.username,
                })
            );

            return connections;
        }

        return [];
    }

    async countConnectionsByNamespace(namespace: string): Promise<number> {
        const result = await this._client
            .query({
                TableName: this._connectionsByNamespaceTableName,
                Select: 'COUNT',
                KeyConditionExpression: 'namespace = :namespace',
                ExpressionAttributeValues: {
                    ':namespace': namespace,
                },
            })
            .promise();

        return result.Count;
    }

    async getConnection(connectionId: string): Promise<DeviceConnection> {
        const result = await this._client
            .get({
                TableName: this._connectionsTableName,
                Key: {
                    connectionId: connectionId,
                },
            })
            .promise();

        if (result.Item) {
            return {
                connectionId: result.Item.connectionId,
                sessionId: result.Item.sessionId,
                token: result.Item.token,
                username: result.Item.username,
            };
        }
        return null;
    }

    async getNamespaceConnection(
        connectionId: string,
        namespace: string
    ): Promise<DeviceNamespaceConnection> {
        const result = await this._client
            .get({
                TableName: this._connectionsByNamespaceTableName,
                Key: {
                    namespace: namespace,
                    connectionId: connectionId,
                },
            })
            .promise();

        if (result.Item) {
            return {
                namespace: result.Item.namespace,
                connectionId: result.Item.connectionId,
                sessionId: result.Item.sessionId,
                token: result.Item.token,
                username: result.Item.username,
                temporary: result.Item.temporary,
            };
        }
        return null;
    }

    async getConnections(
        connectionId: string
    ): Promise<DeviceNamespaceConnection[]> {
        const result = await this._client
            .query({
                TableName: this._connectionsByNamespaceTableName,
                KeyConditionExpression: 'connectionId = :connectionId',
                ExpressionAttributeValues: {
                    ':connectionId': connectionId,
                },
                IndexName: CONNECTION_ID_AND_NAMESPACE_INDEX,
            })
            .promise();

        if (result.Items) {
            const connections: DeviceNamespaceConnection[] = result.Items.map(
                (item) => ({
                    connectionId: item.connectionId,
                    namespace: item.namespace,
                    sessionId: item.sessionId,
                    temporary: item.temporary,
                    token: item.token,
                    username: item.username,
                })
            );

            return connections;
        }

        return [];
    }

    async countConnections(): Promise<number> {
        const result = await this._client
            .scan({
                TableName: this._connectionsTableName,
                Select: 'COUNT',
            })
            .promise();

        return result.Count;
    }
}
