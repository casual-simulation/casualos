import { sortedIndexBy } from 'lodash';
import {
    ApiaryConnectionStore,
    DeviceConnection,
    DeviceNamespaceConnection,
} from './ApiaryConnectionStore';

/**
 * Defines a ApiaryConnectionStore that keeps all data in memory.
 */
export class MemoryApiaryConnectionStore implements ApiaryConnectionStore {
    /**
     * A map of namespaces to device connections.
     */
    private _namespaceMap = new Map<string, DeviceNamespaceConnection[]>();

    /**
     * A map of connection IDs to connections.
     */
    private _connectionMap = new Map<string, DeviceNamespaceConnection[]>();

    private _connections = new Map<string, DeviceConnection>();

    reset() {
        this._namespaceMap = new Map();
        this._connectionMap = new Map();
        this._connections = new Map();
    }

    async saveConnection(connection: DeviceConnection): Promise<void> {
        this._connections.set(connection.connectionId, connection);
    }

    async saveNamespaceConnection(
        connection: DeviceNamespaceConnection
    ): Promise<void> {
        let namespaceList = this._getNamespaceList(connection.namespace);
        let connectionList = this._getConnectionList(connection.connectionId);

        const namespaceIndex = sortedIndexBy(
            namespaceList,
            connection,
            (c) => c.connectionId
        );
        const namespaceItem = namespaceList[namespaceIndex];
        if (
            !namespaceItem ||
            namespaceItem.connectionId !== connection.connectionId
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
        connectionId: string,
        namespace: string
    ): Promise<void> {
        let namespaceList = this._getNamespaceList(namespace);
        let connectionList = this._getConnectionList(connectionId);

        const namespaceIndex = sortedIndexBy(
            namespaceList,
            { connectionId } as any,
            (c) => c.connectionId
        );
        const namespaceItem = namespaceList[namespaceIndex];
        if (namespaceItem.connectionId === connectionId) {
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

    async clearConnection(connectionId: string): Promise<void> {
        let connectionList = this._getConnectionList(connectionId);

        for (let connection of connectionList) {
            let namespaceList = this._getNamespaceList(connection.namespace);
            const namespaceIndex = sortedIndexBy(
                namespaceList,
                connection,
                (c) => c.connectionId
            );
            const namespaceItem = namespaceList[namespaceIndex];
            if (namespaceItem.connectionId === connectionId) {
                namespaceList.splice(namespaceIndex, 1);
            }
        }

        this._connectionMap.set(connectionId, []);
        this._connections.delete(connectionId);
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
}
