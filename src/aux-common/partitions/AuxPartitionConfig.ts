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
import type { InstRecordsClient } from '../websockets';
import type { BotsState } from '../bots';
import type {
    AuxPartition,
    MemoryPartition,
    AuxPartitionRealtimeStrategy,
} from './AuxPartition';

/**
 * Defines a set of options for configuring partitioning of bots.
 * Bot IDs are mapped to
 */
export interface AuxPartitionConfig {
    shared: PartitionConfig;
    [key: string]: PartitionConfig;
}

/**
 * Defines a partition config.
 * That is, a config which specifies how to build a partition.
 */
export type PartitionConfig =
    | MemoryPartitionStateConfig
    | MemoryPartitionInstanceConfig
    | ProxyPartitionConfig
    | ProxyClientPartitionConfig
    | LocalStoragePartitionConfig
    | OtherPlayersClientPartitionConfig
    | OtherPlayersRepoPartitionConfig
    | YjsPartitionConfig
    | RemoteYjsPartitionConfig
    | YjsClientPartitionConfig;

/**
 * Defines a base interface for partitions.
 */
export interface PartitionConfigBase {
    /**
     * Whether the partition is private.
     * If true, then the contents of the partition should not be exported.
     * If false, then the bot state in the partition is exportable.
     * Defaults to false.
     */
    private?: boolean;
}

/**
 * Defines a memory partition.
 * That is, a configuration that specifies that bots should be stored in memory.
 */
export interface MemoryPartitionConfig extends PartitionConfigBase {
    type: 'memory';
}

export interface MemoryPartitionStateConfig extends MemoryPartitionConfig {
    /**
     * The initial state for the memory partition.
     */
    initialState: BotsState;

    /**
     * The ID that should be used for the local site.
     */
    localSiteId?: string;

    /**
     * The ID that should be used for the remote site.
     */
    remoteSiteId?: string;
}

export interface MemoryPartitionInstanceConfig extends MemoryPartitionConfig {
    partition?: MemoryPartition;
}

/**
 * Defines a partition that proxies requests from the engine to the given partition instance.
 * Basically gives a way to run a partition on the main thread instead of in a background thread.
 * Useful for storing data using APIs that are only available to the main thread.
 */
export interface ProxyPartitionConfig extends PartitionConfigBase {
    type: 'proxy';

    /**
     * The partition that should be used.
     */
    partition: AuxPartition;
}

/**
 * Defines a partition that is able to proxy requests from the engine to the given partition bridge.
 */
export interface ProxyClientPartitionConfig extends PartitionConfigBase {
    type: 'proxy_client';

    /**
     * The edit strategy that the partition uses.
     */
    editStrategy: AuxPartitionRealtimeStrategy;

    /**
     * The port that should be used for messages.
     */
    port: MessagePort;
}

/**
 * Defines a partition that stores data in local storage.
 */
export interface LocalStoragePartitionConfig extends PartitionConfigBase {
    type: 'local_storage';

    /**
     * The namespace that the partition should store bots under.
     */
    namespace: string;
}

/**
 * The possible version numbers for the shared partitions.
 * "Shared partitions" means the set of partitions which are designed to work together to provide the "shared", "tempShared", and "remoteTempShared" spaces.
 *
 * - "v1" indicates that the shared partitions will be provided by the causal repo system. That is, the partitions use Causal Trees and atoms to communicate changes.
 * - "v2" indicates that the shared partitions will be provided by the causal repo system combined with yjs.
 *        That is, partitions use yjs to track changes and communicate via Causal Repo Servers (websocket or otherwise) using the "updates" protocol.
 */
export type SharedPartitionsVersion = 'v2';

/**
 * The possible protocol types.
 *
 * - "apiary-aws" indicates that the protocol will use WebSockets and a customized protocol wrapper to connect to a Causal Repo Server which
 *    is hosted on AWS Lambda. This customized protocol is required since AWS API Gateway has limitations (like message sizes) that need working around.
 * - "websocket" indicates that the protocol will use native WebSockets to connect to the causal repo server.
 */
export type RemoteCausalRepoProtocol = 'apiary-aws' | 'websocket';

/**
 * Defines a partition that uses the Causal Repo API to watch for other players on the given branch.
 */
export interface OtherPlayersRepoPartitionConfig extends PartitionConfigBase {
    type: 'other_players_repo';

    /**
     * The name of the record that should be loaded.
     */
    recordName: string | null;

    /**
     * The inst that should be loaded.
     */
    inst: string;

    /**
     * The branch to watch for players.
     */
    branch: string;

    /**
     * The host that the branch should be loaded from.
     */
    host: string;

    /**
     * Whether to use websocket or the apiary protocol to connect. (Default is websocket)
     */
    connectionProtocol?: RemoteCausalRepoProtocol;

    /**
     * The type of partitions that should be used for the child partitions.
     * Defaults to causal_repo_client.
     */
    childPartitionType?: YjsClientPartitionConfig['type'];

    /**
     * Whether the partition should skip the initial load until the partition is upgraded to a realtime connection.
     */
    skipInitialLoad?: boolean;
}

/**
 * Defines a partition that uses the Causal Repo API to watch for other players on the given branch.
 */
export interface OtherPlayersClientPartitionConfig extends PartitionConfigBase {
    type: 'other_players_client';

    /**
     * The name of the record that should be loaded.
     */
    recordName: string | null;

    /**
     * The inst that should be loaded.
     */
    inst: string;

    /**
     * The branch to watch for players.
     */
    branch: string;

    /**
     * The client that should be used.
     */
    client: InstRecordsClient;

    /**
     * The type of partitions that should be used for the child partitions.
     * Defaults to causal_repo_client.
     */
    childPartitionType?: YjsClientPartitionConfig['type'];

    /**
     * Whether the partition should skip the initial load until the partition is upgraded to a realtime connection.
     */
    skipInitialLoad?: boolean;
}

export interface PartitionRemoteEvents {
    /**
     * The type of the remote action's event and whether it should be supported.
     */
    [key: string]: boolean;

    /**
     * Whether all other remote actions should be supported. (Default is false)
     */
    remoteActions?: boolean;
}

/**
 * Defines a partition that uses yjs to store bot data.
 */
export interface YjsPartitionConfig extends PartitionConfigBase {
    type: 'yjs';

    /**
     * The branch to load.
     * If omitted, then local persistence will not be supported.
     */
    branch?: string;

    /**
     * The options for local persistence for the partition.
     */
    localPersistence?: {
        /**
         * Whether to save partition updates to indexed db.
         */
        saveToIndexedDb: boolean;

        /**
         * The encryption key that should be used.
         */
        encryptionKey?: string;
    };

    /**
     * The options for handling remote events.
     */
    remoteEvents?: PartitionRemoteEvents | boolean;

    /**
     * The ID of the user's connection.
     */
    connectionId?: string;
}

/**
 * Defines a yjs partition that uses the causal repo updates protocol to sync changes.
 */
export interface RemoteYjsPartitionConfig extends PartitionConfigBase {
    type: 'remote_yjs';

    /**
     * The name of the record that should be loaded.
     */
    recordName: string | null;

    /**
     * The inst that should be loaded.
     */
    inst: string;

    /**
     * The branch to load.
     */
    branch: string;

    /**
     * The host that the branch should be loaded from.
     */
    host: string;

    /**
     * Whether the partition should be loaded in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Whether the partition should be loaded without realtime updates and in a read-only mode.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should skip the initial load until the partition is upgraded to a realtime connection.
     */
    skipInitialLoad?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: PartitionRemoteEvents | boolean;

    /**
     * Whether to use websocket or the apiary protocol to connect. (Default is websocket)
     */
    connectionProtocol?: RemoteCausalRepoProtocol;

    /**
     * The options for local persistence for the partition.
     */
    localPersistence?: {
        /**
         * Whether to save partition updates to indexed db.
         */
        saveToIndexedDb?: boolean;

        /**
         * The encryption key that should be used.
         */
        encryptionKey?: string;
    };
}

/**
 * Defines a yjs partitiont that uses the given CausalRepoClient to sync changes.
 */
export interface YjsClientPartitionConfig extends PartitionConfigBase {
    type: 'yjs_client';

    /**
     * The name of the record that should be loaded.
     */
    recordName: string | null;

    /**
     * The inst that should be loaded.
     */
    inst: string;

    /**
     * The branch to load.
     */
    branch: string;

    /**
     * The client that should be used to connect.
     */
    client: InstRecordsClient;

    /**
     * Whether the partition should be loaded in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Whether the partition should be loaded without realtime updates and in a read-only mode.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should skip the initial load until the partition is upgraded to a realtime connection.
     */
    skipInitialLoad?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: PartitionRemoteEvents | boolean;

    /**
     * The options for local persistence for the partition.
     */
    localPersistence?: {
        /**
         * Whether to save partition updates to indexed db.
         */
        saveToIndexedDb?: boolean;

        /**
         * The encryption key that should be used.
         */
        encryptionKey?: string;
    };
}
