import { BotsState } from '../bots';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    AuxPartition,
    ProxyBridgePartition,
    MemoryPartition,
    AuxPartitionRealtimeStrategy,
    YjsPartition,
} from './AuxPartition';
import { BotClient } from './BotClient';

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
    | CausalRepoPartitionConfig
    | RemoteCausalRepoPartitionConfig
    | CausalRepoHistoryClientPartitionConfig
    | CausalRepoClientPartitionConfig
    | MemoryPartitionStateConfig
    | MemoryPartitionInstanceConfig
    | ProxyPartitionConfig
    | ProxyClientPartitionConfig
    | LocalStoragePartitionConfig
    | BotPartitionConfig
    | SearchPartitionClientConfig
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
 * Defines a causal tree partition that uses the new Causal Repo API.
 */
export interface CausalRepoPartitionConfig extends PartitionConfigBase {
    type: 'causal_repo';
}

/**
 * Defines a causal tree partition that uses the new Causal Repo API.
 */
export interface CausalRepoClientPartitionConfig extends PartitionConfigBase {
    type: 'causal_repo_client';

    /**
     * The branch to load.
     */
    branch: string;

    /**
     * The client that should be used to connect.
     */
    client: CausalRepoClient;

    /**
     * Whether the partition should be loaded in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Whether the partition should be loaded without realtime updates.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: boolean;
}

/**
 * The possible version numbers for the shared partitions.
 * "Shared partitions" means the set of partitions which are designed to work together to provide the "shared", "tempShared", and "remoteTempShared" spaces.
 *
 * - "v1" indicates that the shared partitions will be provided by the causal repo system. That is, the partitions use Causal Trees and atoms to communicate changes.
 * - "v2" indicates that the shared partitions will be provided by the causal repo system combined with yjs.
 *        That is, partitions use yjs to track changes and communicate via Causal Repo Servers (websocket or otherwise) using the "updates" protocol.
 */
export type SharedPartitionsVersion = 'v1' | 'v2';

/**
 * The possible protocol types.
 *
 * - "apiary-aws" indicates that the protocol will use WebSockets and a customized protocol wrapper to connect to a Causal Repo Server which
 *    is hosted on AWS Lambda. This customized protocol is required since AWS API Gateway has limitations (like message sizes) that need working around. See the causal-tree-client-apiary project for more info.
 * - "websocket" indicates that the protocol will use native WebSockets to connect to the causal repo server.
 *   See the causal-tree-client-websocket project for more info.
 */
export type RemoteCausalRepoProtocol = 'apiary-aws' | 'websocket';

/**
 * Defines a causal tree partition that uses the new Causal Repo API.
 */
export interface RemoteCausalRepoPartitionConfig extends PartitionConfigBase {
    type: 'remote_causal_repo';

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
     * Whether the partition should be loaded without realtime updates.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: boolean;

    /**
     * Whether to use websocket or the apiary protocol to connect. (Default is websocket)
     */
    connectionProtocol?: RemoteCausalRepoProtocol;
}

/**
 * Defines a partition that uses the Causal Repo API to watch for other players on the given branch.
 */
export interface OtherPlayersRepoPartitionConfig extends PartitionConfigBase {
    type: 'other_players_repo';

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
    childPartitionType?:
        | CausalRepoClientPartitionConfig['type']
        | YjsClientPartitionConfig['type'];
}

/**
 * Defines a partition that uses the Causal Repo API to watch for other players on the given branch.
 */
export interface OtherPlayersClientPartitionConfig extends PartitionConfigBase {
    type: 'other_players_client';

    /**
     * The branch to watch for players.
     */
    branch: string;

    /**
     * The client that should be used.
     */
    client: CausalRepoClient;

    /**
     * The type of partitions that should be used for the child partitions.
     * Defaults to causal_repo_client.
     */
    childPartitionType?:
        | CausalRepoClientPartitionConfig['type']
        | YjsClientPartitionConfig['type'];
}

/**
 * Defines a causal repo partition that loads history for a branch.
 */
export interface CausalRepoHistoryClientPartitionConfig
    extends PartitionConfigBase {
    type: 'causal_repo_history_client';

    /**
     * The branch to load history from.
     */
    branch: string;

    /**
     * The client that should be used to load the history.
     */
    client: CausalRepoClient;
}

/**
 * Defines a partition that allows storing immutable bots and querying them later.
 */
export interface BotPartitionConfig extends PartitionConfigBase {
    type: 'bot';

    /**
     * The host that should be queried.
     */
    host: string;

    /**
     * The instance that should be used from the host.
     */
    inst: string;
}

/**
 * Defines a partition that allows storing immutable bots and querying them later.
 */
export interface SearchPartitionClientConfig extends PartitionConfigBase {
    type: 'bot_client';

    /**
     * The instance that should be used.
     */
    inst: string;

    /**
     * The client that the partition should connect with.
     */
    client: BotClient;
}

/**
 * Defines a partition that uses yjs to store bot data.
 */
export interface YjsPartitionConfig extends PartitionConfigBase {
    type: 'yjs';
}

/**
 * Defines a yjs partition that uses the causal repo updates protocol to sync changes.
 */
export interface RemoteYjsPartitionConfig extends PartitionConfigBase {
    type: 'remote_yjs';

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
     * Whether the partition should be loaded without realtime updates.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: boolean;

    /**
     * Whether to use websocket or the apiary protocol to connect. (Default is websocket)
     */
    connectionProtocol?: RemoteCausalRepoProtocol;
}

/**
 * Defines a yjs partitiont that uses the given CausalRepoClient to sync changes.
 */
export interface YjsClientPartitionConfig extends PartitionConfigBase {
    type: 'yjs_client';

    /**
     * The branch to load.
     */
    branch: string;

    /**
     * The client that should be used to connect.
     */
    client: CausalRepoClient;

    /**
     * Whether the partition should be loaded in read-only mode.
     */
    readOnly?: boolean;

    /**
     * Whether the partition should be loaded without realtime updates.
     * Basically this means that all you get is the initial state.
     */
    static?: boolean;

    /**
     * Whether the partition should be temporary.
     */
    temporary?: boolean;

    /**
     * Whether to support remote events. (Default is true)
     */
    remoteEvents?: boolean;
}
