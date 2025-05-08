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
import type {
    Action,
    RemoteActions,
    StatusUpdate,
    CurrentVersion,
} from '../common';
import type {
    BotsState,
    BotAction,
    Bot,
    UpdatedBot,
    StateUpdatedEvent,
} from '../bots';
import {
    TEMPORARY_BOT_PARTITION_ID,
    COOKIE_BOT_PARTITION_ID,
    BOOTSTRAP_PARTITION_ID,
    TEMPORARY_SHARED_PARTITION_ID,
    REMOTE_TEMPORARY_SHARED_PARTITION_ID,
} from '../bots';
import type { Observable, SubscriptionLike } from 'rxjs';
import { sortBy } from 'lodash';

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
    | BotPartition
    | OtherPlayersPartition
    | YjsPartition;

/**
 * The list of edit stategies that a partition can use.
 *
 * "immediate" means that valid edits will be immediately by the partition and therefore can have an immediate affect on the bot(s).
 * "delayed" means that valid edits will have a delayed affect on the bot(s). This means that the bots should act like they have not been edited until the partition indicates a
 *           change occurred.
 */
export type AuxPartitionRealtimeStrategy = 'immediate' | 'delayed';

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
     * The space of the partition.
     * Should be used to set the space of bots output by this partition.
     * Will be automatically set by the channel.
     */
    space: string;

    /**
     * The realtime edit strategy that the partition supports.
     * This is used to hint to the AUX Runtime how it should handle in-memory changes
     * for bots in this partition.
     */
    realtimeStrategy: AuxPartitionRealtimeStrategy;

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
    sendRemoteEvents?(events: RemoteActions[]): Promise<void>;

    /**
     * Tells the partition to connect to it's backing store.
     */
    connect(): void;

    /**
     * Tells the partition to enable collaboration features that were disabled.
     */
    enableCollaboration?(): Promise<void>;

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
     * Gets an observable list that resolves whenever the partition state is updated.
     */
    onStateUpdated: Observable<StateUpdatedEvent>;

    /**
     * Gets an observable list that resolves whenever the partition state version is updated.
     */
    onVersionUpdated: Observable<CurrentVersion>;

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
        onStateUpdated?: (state: StateUpdatedEvent) => void,
        onError?: (error: any) => void,
        onEvents?: (actions: Action[]) => void,
        onStatusUpdated?: (status: StatusUpdate) => void,
        onVersionUpdated?: (version: CurrentVersion) => void
    ): Promise<void>;

    setSpace(space: string): Promise<void>;
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
 * That is, a partition that was loaded from a remote instance.
 */
export interface RemoteCausalRepoPartition extends CausalRepoPartition {
    /**
     * Gets or sets whether the partition has been forced offline.
     */
    forcedOffline: boolean;
}

/**
 * Defines a yjs partition.
 * This is a partition that uses yjs (https://github.com/yjs/yjs) to internally represent changes.
 */
export interface YjsPartition extends AuxPartitionBase {
    type: 'yjs';

    state: BotsState;
}

/**
 * Defines a partition that listens for other players and loads their player partitions.
 */
export interface OtherPlayersPartition extends AuxPartitionBase {
    type: 'other_players';

    /**
     * The current state of the partition.
     */
    state: BotsState;
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

export type DictionaryLike = {
    [key: string]: any;
};

/**
 * Iterates the given partitions.
 * @param partitions The partitions to iterate.
 */
export function* iteratePartitions<T extends DictionaryLike>(
    partitions: T
): Generator<readonly [keyof T, T[keyof T]]> {
    const keys = Object.keys(partitions);
    const sortedKeys = sortBy(keys, (k) =>
        k === 'shared'
            ? 0
            : k === TEMPORARY_BOT_PARTITION_ID
            ? 1
            : k === COOKIE_BOT_PARTITION_ID
            ? 2
            : k === TEMPORARY_SHARED_PARTITION_ID
            ? 3
            : k === REMOTE_TEMPORARY_SHARED_PARTITION_ID
            ? 4
            : k === BOOTSTRAP_PARTITION_ID
            ? 5
            : 6
    );

    for (let key of sortedKeys) {
        if (!Object.prototype.hasOwnProperty.call(partitions, key)) {
            continue;
        }

        yield [key, partitions[key]] as const;
    }
}
