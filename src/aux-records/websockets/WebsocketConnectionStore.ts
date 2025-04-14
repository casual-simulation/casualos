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

export interface WebsocketConnectionStore {
    /**
     * Saves the given connection to the store.
     * @param connection The connection to save.
     */
    saveConnection(connection: DeviceConnection): Promise<void>;

    /**
     * Saves the given namespace connection to the store.
     * @param connection The connection to save.
     */
    saveBranchConnection(connection: DeviceBranchConnection): Promise<void>;

    /**
     * Deletes the given connection from the store.
     * @param connectionId The ID of the connection.
     * @param mode The mode of the connection.
     * @param recordName The name of the record that the branch exists in.
     * @param inst The name of the inst that the branch exists in.
     * @param branch The name of the branch.
     */
    deleteBranchConnection(
        connectionId: string,
        mode: BranchConnectionMode,
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<void>;

    /**
     * Deletes all the connections with the given connection ID.
     * @param connectionId The ID of the connection.
     */
    clearConnection(connectionId: string): Promise<void>;

    /**
     * Marks all the connections associated with the given connection ID as expired so that they can be deleted in the future.
     * Works similarly to clearConnection(), but instead of deleting the connection, it marks them as expired.
     *
     * After calling this, the given connection ID will not be present in getConnectionsByNamespace() or countConnections(),
     * but the connection will still be present in getConnection() (until the connection expires).
     *
     * @param connectionId The ID of the connection.
     */
    expireConnection(connectionId: string): Promise<void>;

    /**
     * Gets all the connections for the given branch.
     * @param mode The mode of the connections.
     * @param recordName The name of the record that the branch exists in.
     * @param inst The name of the inst that the branch exists in.
     * @param branch The name of the branch.
     */
    getConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection[]>;

    /**
     * Counts the number of active connections for the given branch.
     */
    countConnectionsByBranch(
        mode: BranchConnectionMode,
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<number>;

    /**
     * Gets the given connection with the connection server ID.
     * @param connectionId The server ID of the connection to get.
     */
    getConnection(connectionId: string): Promise<DeviceConnection>;

    /**
     * Gets the connection for the given connection ID and branch.
     * @param connectionId The ID of the connection to get.
     * @param recordName The name of the record that the branch exists in.
     * @param inst The name of the inst that the branch exists in.
     * @param branch The name of the branch.
     */
    getBranchConnection(
        connectionId: string,
        mode: BranchConnectionMode,
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<DeviceBranchConnection>;

    /**
     * Gets the list of connections that are present for the given connection ID.
     * @param connectionId The ID of the connection.
     */
    getConnections(connectionId: string): Promise<DeviceBranchConnection[]>;

    /**
     * Counts the number of active connections.
     */
    countConnections(): Promise<number>;

    /**
     * Gets the last time that the connection rate limit was exceeded for the given connection ID.
     * @param connectionId The ID of the connection.
     */
    getConnectionRateLimitExceededTime(
        connectionId: string
    ): Promise<number | null>;

    /**
     * Sets the last time that the connection rate limit was exceeded for the given connection ID.
     * @param connectionId The ID of the connection.
     * @param timeMs The unix time in miliseconds.
     */
    setConnectionRateLimitExceededTime(
        connectionId: string,
        timeMs: number | null
    ): Promise<void>;

    // TODO: Support clearing "updateData" authorized insts when policies/roles for an inst change.
    /**
     * Saves that the given record name and inst have been authorized by the given connection.
     * @param connectionId The ID of the connection.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param scope The scope of the authorization. "token" means that the connection has logged in with a valid token for the given record name and inst. "updateData" means that the connection has correct permissions to update the data in the inst.
     */
    saveAuthorizedInst(
        connectionId: string,
        recordName: string | null,
        inst: string,
        scope: 'token' | 'updateData'
    ): Promise<void>;

    /**
     * Gets whether the given record name and inst have been authorized by the given connection.
     * @param connectionId The ID of the connection.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param scope The scope of the authorization. "token" means that the connection has logged in with a valid token for the given record name and inst. "updateData" means that the connection has correct permissions to update the data in the inst.
     */
    isAuthorizedInst(
        connectionId: string,
        recordName: string | null,
        inst: string,
        scope: 'token' | 'updateData'
    ): Promise<boolean>;
}

/**
 * Defines an interface that represents the connection of a device to the apiary.
 */
export interface DeviceConnection {
    /**
     * The server-created ID of the connection.
     */
    serverConnectionId: string;

    /**
     * The client-created ID of the connection.
     */
    clientConnectionId: string;

    /**
     * The ID of the user that the connection is associated with.
     */
    userId: string;

    /**
     * The ID of the session that the user used to connect.
     */
    sessionId: string;

    /**
     * The token that the device is using.
     */
    token: string;
}

/**
 * Defines a list of modes that a connection can be in.
 * - "branch": The connection is connected to a branch.
 * - "watch": The connection is watching a branch for connection changes.
 * - "missing_permission": The connection is requesting a missing permission.
 */
export type BranchConnectionMode =
    | 'branch'
    | 'watch_branch'
    | 'missing_permission';

/**
 * Defines an interface that represents the connection of a device to a branch.
 */
export interface DeviceBranchConnection extends DeviceConnection {
    /**
     * The mode of the connection.
     */
    mode: BranchConnectionMode;

    /**
     * The name of the record that the device is connected to.
     */
    recordName: string | null;

    /**
     * The name of the inst that the device is connected to.
     */
    inst: string;

    /**
     * The name of the branch that the device is connected to.
     */
    branch: string;

    /**
     * Whether the data stored by the connection is supposed to be temporary.
     */
    temporary: boolean;
}
