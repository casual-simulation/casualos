import { BotsState, BotAction, Bot, UpdatedBot } from '../bots';
import {
    StatusUpdate,
    RemoteAction,
    User,
    Action,
} from '@casual-simulation/causal-trees';
import { Observable, SubscriptionLike } from 'rxjs';

/**
 * Defines an interface that maps Bot IDs to their corresponding partitions.
 */
export interface AuxPartitions {
    shared: AuxPartition;
    [key: string]: AuxPartition;
}

/**
 * Defines a set of valid partition types.
 */
export type AuxPartition =
    | MemoryPartition
    | CausalRepoPartition
    | RemoteCausalRepoPartition
    | LocalStoragePartition
    | ProxyClientPartition
    | BotPartition;

/**
 * Base interface for partitions.
 *
 * Partitions are basically a backing store for Aux State.
 * They allow working on and manipulating bots that are stored in multiple different places.
 */
export interface AuxPartitionBase extends SubscriptionLike {
    /**
     * Whether the partition is private or not.
     * If true, then the partition will be skipped when exporting state.
     * If false, then the partition will be included when exporting state.
     */
    private: boolean;

    /**
     * Applies the given events to the partition.
     * Returns events that should be sent as local events.
     * @param events The events to apply.
     */
    applyEvents(events: BotAction[]): Promise<BotAction[]>;

    /**
     * Sends the given events to the targeted device.
     * @param events The events to send.
     */
    sendRemoteEvents?(events: RemoteAction[]): Promise<void>;

    /**
     * Sets the user that the partition should use.
     * @param user
     */
    setUser?(user: User): Promise<void>;

    /**
     * Sets the grant that the partition should use.
     * @param grant
     */
    setGrant?(grant: string): Promise<void>;

    /**
     * Tells the partition to connect to it's backing store.
     */
    connect(): void;

    /**
     * Gets an observable list that resolves whenever
     * a bot is added to this partition.
     */
    onBotsAdded: Observable<Bot[]>;

    /**
     * Gets an observable list that resolves whenever
     * a bot is removed from this partition.
     */
    onBotsRemoved: Observable<string[]>;

    /**
     * Gets an observable list that resolves whenever
     * a bot is updated in this partition.
     */
    onBotsUpdated: Observable<UpdatedBot[]>;

    /**
     * Gets an observable list of errors from the partition.
     */
    onError: Observable<any>;

    /**
     * Gets the observable list of remote events from the partition.
     */
    onEvents: Observable<Action[]>;

    /**
     * Gets the observable list of status updates from the partition.
     */
    onStatusUpdated: Observable<StatusUpdate>;
}

/**
 * Defines a special aux partition that can act as a basic bridge for the observables.
 */
export interface ProxyBridgePartition extends AuxPartitionBase {
    addListeners(
        onBotsAdded?: (bot: Bot[]) => void,
        onBotsRemoved?: (bot: string[]) => void,
        onBotsUpdated?: (bots: UpdatedBot[]) => void,
        onError?: (error: any) => void,
        onEvents?: (actions: Action[]) => void,
        onStatusUpdated?: (status: StatusUpdate) => void
    ): Promise<void>;
}

/**
 * Defines a partition that is able to proxy requests from the engine to the given partition bridge.
 */
export interface ProxyClientPartition extends AuxPartitionBase {
    type: 'proxy_client';

    state: BotsState;
}

/**
 * Defines a causal repo partition.
 */
export interface CausalRepoPartition extends AuxPartitionBase {
    type: 'causal_repo';

    state: BotsState;
}

/**
 * Defines a remote causal repo partition.
 * That is, a partition that was loaded from a remote server.
 */
export interface RemoteCausalRepoPartition extends CausalRepoPartition {
    /**
     * Gets or sets whether the partition has been forced offline.
     */
    forcedOffline: boolean;
}

/**
 * Defines a memory partition.
 */
export interface MemoryPartition extends AuxPartitionBase {
    type: 'memory';

    /**
     * The current state for the partition.
     */
    state: BotsState;
}

/**
 * Defines a local storage partition.
 * Needs to run on the main thread.
 */
export interface LocalStoragePartition extends AuxPartitionBase {
    type: 'local_storage';

    /**
     * The namespace that bots should be stored under.
     */
    namespace: string;

    /**
     * The current state of the partition.
     */
    state: BotsState;
}

/**
 * Defines a bot partition.
 * That is, a partition which can store bots for later retrieval via a query.
 */
export interface BotPartition extends AuxPartitionBase {
    type: 'bot';

    /**
     * The current state of the partition.
     */
    state: BotsState;
}

/**
 * Gets the bots state from the given partition.
 * @param partition The partition.
 */
export function getPartitionState(partition: AuxPartition): BotsState {
    return partition.state;
}

/**
 * Iterates the given partitions.
 * @param partitions The partitions to iterate.
 */
export function* iteratePartitions(partitions: AuxPartitions) {
    for (let key in partitions) {
        if (!partitions.hasOwnProperty(key)) {
            continue;
        }

        yield [key, partitions[key]] as const;
    }
}
