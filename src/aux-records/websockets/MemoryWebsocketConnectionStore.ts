import { sortedIndexBy } from 'lodash';
import {
    BranchConnectionMode,
    DeviceBranchConnection,
    DeviceConnection,
    WebsocketConnectionStore,
} from './WebsocketConnectionStore';
import { branchNamespace } from './Utils';

/**
 * Defines a WebsocketConnectionStore that keeps all data in memory.
 */
export class MemoryWebsocketConnectionStore
    implements WebsocketConnectionStore
{
    /**
     * A map of namespaces to device connections.
     */
    private _namespaceMap = new Map<string, DeviceBranchConnection[]>();

    /**
     * A map of connection IDs to connections.
     */
    private _connectionMap = new Map<string, DeviceBranchConnection[]>();

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

    async saveBranchConnection(
        connection: DeviceBranchConnection
    ): Promise<void> {
        const namespace = branchNamespace(
            connection.mode,
            connection.recordName,
            connection.inst,
            connection.branch
        );
        let namespaceList = this._getNamespaceList(namespace);
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

        const connectionIndex = sortedIndexBy(connectionList, connection, (c) =>
            branchNamespace(c.mode, c.recordName, c.inst, c.branch)
        );
        const connectionItem = connectionList[connectionIndex];
        if (
            !connectionItem ||
            connectionItem.recordName !== connection.recordName ||
            connectionItem.inst !== connection.inst ||
            connectionItem.branch !== connection.branch
        ) {
            connectionList.splice(connectionIndex, 0, connection);
        }
    }

    async deleteBranchConnection(
        serverConnectionId: string,
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const namespace = branchNamespace(mode, recordName, inst, branch);
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
            { mode, recordName, inst, branch } as any,
            (c) => branchNamespace(c.mode, c.recordName, c.inst, c.branch)
        );
        const connectionItem = connectionList[connectionIndex];
        if (
            connectionItem.recordName === recordName &&
            connectionItem.inst === inst &&
            connectionItem.branch === branch
        ) {
            connectionList.splice(connectionIndex, 1);
        }
    }

    async clearConnection(serverConnectionId: string): Promise<void> {
        let connectionList = this._getConnectionList(serverConnectionId);

        for (let connection of connectionList) {
            let namespaceList = this._getNamespaceList(
                branchNamespace(
                    connection.mode,
                    connection.recordName,
                    connection.inst,
                    connection.branch
                )
            );
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

    async getConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection[]> {
        return this._getNamespaceList(
            branchNamespace(mode, recordName, inst, branch)
        );
    }

    async countConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        return this._getNamespaceList(
            branchNamespace(mode, recordName, inst, branch)
        ).length;
    }

    async getConnections(
        connectionId: string
    ): Promise<DeviceBranchConnection[]> {
        return this._getConnectionList(connectionId);
    }

    async getConnection(connectionId: string): Promise<DeviceConnection> {
        return this._connections.get(connectionId) ?? null;
    }

    async countConnections(): Promise<number> {
        return this._connections.size;
    }

    async getBranchConnection(
        connectionId: string,
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection> {
        return this._getConnectionList(connectionId).find(
            (c) =>
                c.mode === mode &&
                c.recordName === recordName &&
                c.inst === inst &&
                c.branch === branch
        );
    }

    private _getNamespaceList(namespace: string): DeviceBranchConnection[] {
        let list = this._namespaceMap.get(namespace);
        if (!list) {
            list = [];
            this._namespaceMap.set(namespace, list);
        }
        return list;
    }

    private _getConnectionList(connectionId: string): DeviceBranchConnection[] {
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
