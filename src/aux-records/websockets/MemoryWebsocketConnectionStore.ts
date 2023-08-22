import { sortedIndexBy } from 'lodash';
import {
    DeviceConnection,
    DeviceNamespaceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';

/**
 * Defines a WebsocketConnectionStore that keeps all data in memory.
 */
export class MemoryWebsocketConnectionStore
    implements WebsocketConnectionStore
{
    /**
     * A map of namespaces to device connections.
     */
    private _namespaceMap = new Map<string, DeviceNamespaceConnection[]>();

    /**
     * A map of connection IDs to connections.
     */
    private _connectionMap = new Map<string, DeviceNamespaceConnection[]>();

    private _connections = new Map<string, DeviceConnection>();

    private _rateLimits = new Map<string, number>();

    reset() {
        this._namespaceMap = new Map();
        this._connectionMap = new Map();
        this._connections = new Map();
        this._rateLimits = new Map();
    }

    async saveConnection(connection: DeviceConnection): Promise<void> {
        this._connections.set(connection.serverConnectionId, connection);
    }

    async saveNamespaceConnection(
        connection: DeviceNamespaceConnection
    ): Promise<void> {
        let namespaceList = this._getNamespaceList(connection.namespace);
        let connectionList = this._getConnectionList(
            connection.serverConnectionId
        );

        const namespaceIndex = sortedIndexBy(
            namespaceList,
            connection,
            (c) => c.serverConnectionId
        );
        const namespaceItem = namespaceList[namespaceIndex];
        if (
            !namespaceItem ||
            namespaceItem.serverConnectionId !== connection.serverConnectionId
        ) {
            namespaceList.splice(namespaceIndex, 0, connection);
        }

        const connectionIndex = sortedIndexBy(
            connectionList,
            connection,
            (c) => c.namespace
        );
        const connectionItem = connectionList[connectionIndex];
        if (
            !connectionItem ||
            connectionItem.namespace !== connection.namespace
        ) {
            connectionList.splice(connectionIndex, 0, connection);
        }
    }

    async deleteNamespaceConnection(
        serverConnectionId: string,
        namespace: string
    ): Promise<void> {
        let namespaceList = this._getNamespaceList(namespace);
        let connectionList = this._getConnectionList(serverConnectionId);

        const namespaceIndex = sortedIndexBy(
            namespaceList,
            { serverConnectionId: serverConnectionId } as any,
            (c) => c.serverConnectionId
        );
        const namespaceItem = namespaceList[namespaceIndex];
        if (namespaceItem.serverConnectionId === serverConnectionId) {
            namespaceList.splice(namespaceIndex, 1);
        }

        const connectionIndex = sortedIndexBy(
            connectionList,
            { namespace } as any,
            (c) => c.namespace
        );
        const connectionItem = connectionList[connectionIndex];
        if (connectionItem.namespace === namespace) {
            connectionList.splice(connectionIndex, 1);
        }
    }

    async clearConnection(serverConnectionId: string): Promise<void> {
        let connectionList = this._getConnectionList(serverConnectionId);

        for (let connection of connectionList) {
            let namespaceList = this._getNamespaceList(connection.namespace);
            const namespaceIndex = sortedIndexBy(
                namespaceList,
                connection,
                (c) => c.serverConnectionId
            );
            const namespaceItem = namespaceList[namespaceIndex];
            if (namespaceItem.serverConnectionId === serverConnectionId) {
                namespaceList.splice(namespaceIndex, 1);
            }
        }

        this._connectionMap.set(serverConnectionId, []);
        this._connections.delete(serverConnectionId);
    }

    expireConnection(serverConnectionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    await this.clearConnection(serverConnectionId);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }, 10);
        });
    }

    async getConnectionsByNamespace(
        namespace: string
    ): Promise<DeviceNamespaceConnection[]> {
        return this._getNamespaceList(namespace);
    }

    async countConnectionsByNamespace(namespace: string): Promise<number> {
        return this._getNamespaceList(namespace).length;
    }

    async getConnections(
        connectionId: string
    ): Promise<DeviceNamespaceConnection[]> {
        return this._getConnectionList(connectionId);
    }

    async getConnection(connectionId: string): Promise<DeviceConnection> {
        return this._connections.get(connectionId);
    }

    async countConnections(): Promise<number> {
        return this._connections.size;
    }

    async getNamespaceConnection(
        connectionId: string,
        namespace: string
    ): Promise<DeviceNamespaceConnection> {
        return this._getConnectionList(connectionId).find(
            (c) => c.namespace === namespace
        );
    }

    private _getNamespaceList(namespace: string): DeviceNamespaceConnection[] {
        let list = this._namespaceMap.get(namespace);
        if (!list) {
            list = [];
            this._namespaceMap.set(namespace, list);
        }
        return list;
    }

    private _getConnectionList(
        connectionId: string
    ): DeviceNamespaceConnection[] {
        let list = this._connectionMap.get(connectionId);
        if (!list) {
            list = [];
            this._connectionMap.set(connectionId, list);
        }
        return list;
    }

    async getConnectionRateLimitExceededTime(
        connectionId: string
    ): Promise<number | null> {
        return this._rateLimits.get(connectionId) ?? null;
    }

    async setConnectionRateLimitExceededTime(
        connectionId: string,
        timeMs: number
    ): Promise<void> {
        this._rateLimits.set(connectionId, timeMs);
    }
}
