/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { RedisClientType } from 'redis';
import type {
    BranchConnectionMode,
    DeviceBranchConnection,
    DeviceConnection,
    WebsocketConnectionStore,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';
import {
    SEMATTRS_DB_NAME,
    SEMRESATTRS_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';

const TRACE_NAME = 'RedisWebsocketConnectionStore';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.PRODUCER,
    attributes: {
        [SEMATTRS_DB_NAME]: 'redis',
        [SEMRESATTRS_SERVICE_NAME]: 'redis',
    },
};

/**
 * Defines a class that specifies a Redis implementation of an WebsocketConnectionStore.
 */
export class RedisWebsocketConnectionStore implements WebsocketConnectionStore {
    private _globalNamespace: string;
    private _redis: RedisClientType;
    private _expireAuthorizationSeconds: number;
    private _connectionExpireSeconds: number | null;
    private _connectionExpireMode: 'NX' | 'XX' | 'LT' | 'GT' | null;

    /**
     * Creates a new RedisWebsocketConnectionStore.
     * @param globalNamespace The global namespace that the store should use.
     * @param client The Redis Client.
     * @param expireAuthorizationSeconds The number of seconds that "updateData" authorizations should expire after. This essentially functions as a cache for "inst.read" and "inst.updateData" permissions for repo/add_updates websocket messages.
     * @param connectionExpireSeconds The number of seconds that branch connections should expire after. If null, connections will not expire.
     * @param connectionExpireMode The mode that should be used to expire connections. If null, connections will not expire.
     */
    constructor(
        globalNamespace: string,
        client: RedisClientType,
        expireAuthorizationSeconds: number,
        connectionExpireSeconds: number | null = null,
        connectionExpireMode: 'NX' | 'XX' | 'LT' | 'GT' | null = null
    ) {
        this._globalNamespace = globalNamespace;
        this._redis = client;
        this._expireAuthorizationSeconds = expireAuthorizationSeconds;
        this._connectionExpireSeconds = connectionExpireSeconds;
        this._connectionExpireMode = connectionExpireMode;
    }

    // /{global}/connections
    //    - connnection1
    //    - connnection2
    // /{global}/namespace_connections/{recordName}/{inst}/{branch}
    //    - connection1
    // /{global}/connections/{connection}
    //    - {recordName}/{inst}/{branch}
    // /{global}/authorized/{connection}
    //    - {recordName}/{inst}

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async saveAuthorizedInst(
        connectionId: string,
        recordName: string,
        inst: string,
        scope: 'token' | 'updateData'
    ): Promise<void> {
        const key = authorizedInstsKey(
            this._globalNamespace,
            connectionId,
            scope
        );
        await this._redis.sAdd(key, `${recordName ?? ''}/${inst ?? ''}`);

        if (scope === 'updateData') {
            await this._redis.expire(key, this._expireAuthorizationSeconds);
        } else if (scope === 'token') {
            this._expire(key);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async isAuthorizedInst(
        connectionId: string,
        recordName: string,
        inst: string,
        scope: 'token' | 'updateData'
    ): Promise<boolean> {
        return await this._redis.sIsMember(
            authorizedInstsKey(this._globalNamespace, connectionId, scope),
            `${recordName ?? ''}/${inst ?? ''}`
        );
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async saveConnection(connection: DeviceConnection): Promise<void> {
        const connections = connectionsKey(this._globalNamespace);
        await this._redis.hSet(
            connections,
            connection.serverConnectionId,
            JSON.stringify(connection)
        );

        // Update the expirations
        await this._expire(connections);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async saveBranchConnection(
        connection: DeviceBranchConnection
    ): Promise<void> {
        const connectionJson = JSON.stringify(connection);
        const branchKey = branchConnectionsKey(
            this._globalNamespace,
            connection.mode,
            connection.recordName,
            connection.inst,
            connection.branch
        );
        await this._redis.hSet(
            branchKey,
            connection.serverConnectionId,
            connectionJson
        );
        const connectionKey = connectionIdKey(
            this._globalNamespace,
            connection.serverConnectionId
        );
        await this._redis.hSet(
            connectionKey,
            connectionField(
                connection.mode,
                connection.recordName,
                connection.inst,
                connection.branch
            ),
            connectionJson
        );

        await Promise.all([
            this._expire(branchKey),
            this._expire(connectionKey),
        ]);
    }

    private async _expire(key: string): Promise<void> {
        if (typeof this._connectionExpireSeconds === 'number') {
            if (this._connectionExpireMode) {
                await this._redis.expire(
                    key,
                    this._connectionExpireSeconds,
                    this._connectionExpireMode
                );
            } else {
                await this._redis.expire(key, this._connectionExpireSeconds);
            }
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async deleteBranchConnection(
        connectionId: string,
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const branchKey = branchConnectionsKey(
            this._globalNamespace,
            mode,
            recordName,
            inst,
            branch
        );
        await this._redis.hDel(branchKey, connectionId);
        const connectionKey = connectionIdKey(
            this._globalNamespace,
            connectionId
        );
        await this._redis.hDel(
            connectionKey,
            connectionField(mode, recordName, inst, branch)
        );

        // Update the expirations
        await Promise.all([
            this._expire(branchKey),
            this._expire(connectionKey),
        ]);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async clearConnection(connectionId: string): Promise<void> {
        const connectionKey = connectionIdKey(
            this._globalNamespace,
            connectionId
        );
        const namespaces = await this._redis.hKeys(connectionKey);
        await Promise.all(
            namespaces.map((n) => {
                const key = `/${this._globalNamespace}//namespace_connections/${n}`;
                console.log(
                    '[RedisWebsocketConnectionStore] Deleting',
                    key,
                    connectionId
                );
                return this._redis.hDel(key, connectionId);
            })
        );
        const connections = connectionsKey(this._globalNamespace);
        await this._redis.hDel(connections, connectionId);

        const authorizedInstsToken = authorizedInstsKey(
            this._globalNamespace,
            connectionId,
            'token'
        );
        const authorizedInstsUpdateData = authorizedInstsKey(
            this._globalNamespace,
            connectionId,
            'updateData'
        );

        console.log('[RedisWebsocketConnectionStore] Deleting', connectionKey);
        console.log(
            '[RedisWebsocketConnectionStore] Deleting',
            authorizedInstsToken
        );
        console.log(
            '[RedisWebsocketConnectionStore] Deleting',
            authorizedInstsUpdateData
        );
        await this._redis.del([
            connectionKey,
            authorizedInstsToken,
            authorizedInstsUpdateData,
        ]);

        // Update the expirations for the connections key (because it has been altered)
        await this._expire(connections);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async expireConnection(connectionId: string): Promise<void> {
        // Delete the connection from the namespaces and from the global list of connections,
        // but set a 10 second expiration on all the namespaces that the connection is connected to.
        // This preserves
        const namespaces = await this._redis.hKeys(
            connectionIdKey(this._globalNamespace, connectionId)
        );
        await Promise.all(
            namespaces.map((n) =>
                this._redis.hDel(
                    `/${this._globalNamespace}/namespace_connections/${n}`,
                    connectionId
                )
            )
        );
        await Promise.all([
            this._redis.hDel(
                connectionsKey(this._globalNamespace),
                connectionId
            ),
            this._redis.expire(
                connectionIdKey(this._globalNamespace, connectionId),
                10
            ),
            this._redis.expire(
                authorizedInstsKey(
                    this._globalNamespace,
                    connectionId,
                    'token'
                ),
                10
            ),
            this._redis.expire(
                authorizedInstsKey(
                    this._globalNamespace,
                    connectionId,
                    'updateData'
                ),
                10
            ),
        ]);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection[]> {
        const values = await this._redis.hVals(
            branchConnectionsKey(
                this._globalNamespace,
                mode,
                recordName,
                inst,
                branch
            )
        );

        return values.map((v) => JSON.parse(v));
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async countConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const count = await this._redis.hLen(
            branchConnectionsKey(
                this._globalNamespace,
                mode,
                recordName,
                inst,
                branch
            )
        );
        return count;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getConnection(connectionId: string): Promise<DeviceConnection> {
        const connectionJson = await this._redis.hGet(
            connectionsKey(this._globalNamespace),
            connectionId
        );
        if (connectionJson) {
            return JSON.parse(connectionJson);
        }
        return null;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getBranchConnection(
        connectionId: string,
        mode: BranchConnectionMode,
        recordName: string,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection> {
        const connectionJson = await this._redis.hGet(
            branchConnectionsKey(
                this._globalNamespace,
                mode,
                recordName,
                inst,
                branch
            ),
            connectionId
        );

        if (connectionJson) {
            return JSON.parse(connectionJson);
        }
        return null;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getConnections(
        connectionId: string
    ): Promise<DeviceBranchConnection[]> {
        const values = await this._redis.hVals(
            connectionIdKey(this._globalNamespace, connectionId)
        );

        return values.map((v) => JSON.parse(v));
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async countConnections(): Promise<number> {
        const count = await this._redis.hLen(
            connectionsKey(this._globalNamespace)
        );
        return count;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getConnectionRateLimitExceededTime(
        connectionId: string
    ): Promise<number> {
        const key = connectionRateLimitKey(this._globalNamespace, connectionId);
        const value = await this._redis.get(key);
        if (!value) {
            return null;
        }
        const parsed = parseInt(value);
        if (isNaN(parsed)) {
            return null;
        }
        return parsed;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async setConnectionRateLimitExceededTime(
        connectionId: string,
        timeMs: number
    ): Promise<void> {
        const key = connectionRateLimitKey(this._globalNamespace, connectionId);
        if (timeMs === null || timeMs === undefined) {
            await this._redis.del(key);
        } else {
            await this._redis.set(key, timeMs.toString());
            await this._redis.expire(key, 100);
        }
    }
}

function connectionsKey(globalNamespace: string) {
    return `/${globalNamespace}/connections`;
}

function branchConnectionsKey(
    globalNamespace: string,
    mode: BranchConnectionMode,
    recordName: string,
    inst: string,
    branch: string
) {
    return `/${globalNamespace}//namespace_connections/${mode}/${
        recordName ?? ''
    }/${inst}/${branch}`;
}

function connectionIdKey(globalNamespace: string, connectionId: string) {
    return `/${globalNamespace}/connections/${connectionId}`;
}

function connectionField(
    mode: string,
    recordName: string,
    inst: string,
    branch: string
) {
    return `${mode}/${recordName ?? ''}/${inst}/${branch}`;
}

function connectionRateLimitKey(globalNamespace: string, connectionId: string) {
    return `/${globalNamespace}/rate_limited/${connectionId}`;
}

function authorizedInstsKey(
    globalNamespace: string,
    connectionId: string,
    scope: 'token' | 'updateData'
) {
    return `/${globalNamespace}/authorized/${connectionId}/${scope}`;
}
