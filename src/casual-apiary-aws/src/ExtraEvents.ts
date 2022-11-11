import { WatchBranchEvent } from '@casual-simulation/causal-trees';

/**
 * The name of the event which notifies that some updates were added to a branch.
 */
export const ADD_UPDATES = 'repo/add_updates';

/**
 * The name of the event which notifies that the add_updates event was received.
 */
export const UPDATES_RECEIVED = 'repo/updates_received';

/**
 * The name of the event which is used to attempt to synchronize time between devices.
 */
export const SYNC_TIME = 'sync/time';

export type WatchBranch = WatchBranchEvent & WatchBranchProtocol;

export interface WatchBranchProtocol {
    /**
     * The protocol that this connection is using.
     * "repo" indicates that atoms (add_atoms events) are being used and there is support for commits and history.
     * "updates" indicates that update strings (add_updates events) are being used.
     *
     * Both protocols support tracking device connection and disconnection events.
     *
     * The default is "repo".
     */
    protocol?: 'repo' | 'updates';
}

/**
 * Defines an event which indicates that some arbitrary updates should be added for the given branch.
 * Note that while all branches support both atoms and updates, they do not support mixed usage.
 * This means that clients which use updates should ignore atoms and vice versa.
 */
export interface AddUpdatesEvent {
    /**
     * The branch that the updates are for.
     */
    branch: string;

    /**
     * The updates that should be added.
     */
    updates: string[];

    /**
     * The ID for this "add update" event.
     * Used in the subsequent "update received" event to indicate
     * that this update was received and processed.
     *
     * This property is optional because update IDs are only needed for updates which are sent to the
     * server to be saved. (i.e. the client needs confirmation that it was saved) The server needs no such
     * confirmation, so it does not need to include an update ID.
     */
    updateId?: number;

    /**
     * Whether this message should be treated as the first message
     * after a watch_branch event.
     * This flag MUST be included on the first message as large apiary messages may appear out of order.
     */
    initial?: boolean;

    /**
     * The timestamps for the updates.
     */
    timestamps?: number[];
}

/**
 * Defines an event which indicates that some arbitrary updates where added for the given branch.
 */
export interface UpdatesReceivedEvent {
    /**
     * The branch that the updates were received for.
     */
    branch: string;

    /**
     * The ID that was included in the original "add update" event.
     */
    updateId: number;
}

/**
 * Defines an event which attempts to perform a time sync.
 */
export interface TimeSyncRequest {
    /**
     * The ID of the sync request.
     */
    id: number;

    /**
     * The client time in miliseconds since Jan 1 1970 UTC-0 that the request was made at.
     */
    clientRequestTime: number;
}

/**
 * Defines an event which is the response for a time sync.
 */
export interface TimeSyncResponse {
    /**
     * The ID of the sync request.
     */
    id: number;

    /**
     * The client time in miliseconds since Jan 1 1970 UTC-0 that the request was made at.
     */
    clientRequestTime: number;

    /**
     * The time that the server received the request at in miliseconds since Jan 1 1970 UTC-0.
     */
    serverReceiveTime: number;

    /**
     * The time that the server sent this response at in miliseconds since Jan 1 1970 UTC-0.
     */
    serverTransmitTime: number;
}
