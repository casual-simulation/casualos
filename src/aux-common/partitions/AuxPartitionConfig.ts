import { BotsState } from '../bots';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';
import {
    AuxPartition,
    ProxyBridgePartition,
    MemoryPartition,
    AuxPartitionRealtimeStrategy,
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
    | OtherPlayersRepoPartitionConfig;

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

export type RemoteCausalRepoProtocol = 'socket.io' | 'apiary-aws';

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
     * Whether to use socket.io or the apiary protocol to connect. (Default is socket.io)
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
     * Whether to use socket.io or the apiary protocol to connect. (Default is socket.io)
     */
    connectionProtocol?: RemoteCausalRepoProtocol;
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
     * The server that should be used from the host.
     */
    server: string;
}

/**
 * Defines a partition that allows storing immutable bots and querying them later.
 */
export interface SearchPartitionClientConfig extends PartitionConfigBase {
    type: 'bot_client';

    /**
     * The server that should be used.
     */
    server: string;

    /**
     * The client that the partition should connect with.
     */
    client: BotClient;
}
