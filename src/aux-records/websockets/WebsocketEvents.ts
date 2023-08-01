import { ConnectionInfo } from './ConnectionInfo';
import {
    RemoteAction,
    DeviceAction,
    DeviceActionResult,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionError,
} from './Events';

/**
 * The name of the event which starts watching for when branches are loaded/unloaded.
 */
export const WATCH_BRANCHES = 'repo/watch_branches';

/**
 * The name of the event which stops watching for when branches are loaded/unloaded.
 */
export const UNWATCH_BRANCHES = 'repo/unwatch_branches';

/**
 * The name of the event which starts watching changes on a branch.
 * In particular, watches for new atoms.
 */
export const WATCH_BRANCH = 'repo/watch_branch';

/**
 * The type that indicates that a device is connected to a branch because it is watching.
 */
export type WatchReason = 'watch_branch';

/**
 * The type that indicates that a device is disconnected from a branch because it is
 * no longer watching it.
 */
export type UnwatchReason = 'unwatch_branch';

/**
 * The name of the event which gets all the current atoms on a branch.
 * The atoms are returned via a ADD_ATOMS event.
 */
export const GET_BRANCH = 'repo/get_branch';

/**
 * The name of the event which gets all the current updates on a branch.
 * The atoms are returned via a ADD_UPDATES event.
 */
export const GET_UPDATES = 'repo/get_updates';

/**
 * The name of the event which stops watching changes on a branch.
 */
export const UNWATCH_BRANCH = 'repo/unwatch_branch';

/**
 * The name of the event which notifies that some updates were added to a branch.
 */
export const ADD_UPDATES = 'repo/add_updates';

/**
 * The name of the event which notifies that a branch has been reset and that the client should reset its state.
 */
export const RESET = 'repo/reset';

/**
 * The name of the event which tries to send an event to a device.
 */
export const SEND_EVENT = 'repo/send_event';

/**
 * The name of the event which notifies that an event was sent to this device.
 */
export const RECEIVE_EVENT = 'repo/receive_event';

/**
 * The name of the event which notifies that the add_updates event was received.
 */
export const UPDATES_RECEIVED = 'repo/updates_received';

/**
 * The name of the event which notifies that a branch was loaded into server memory.
 */
export const LOAD_BRANCH = 'repo/load_branch';

/**
 * The name of the event which notifies that a branch was unloaded from server memory.
 */
export const UNLOAD_BRANCH = 'repo/unload_branch';

/**
 * The name of the event which starts watching for connection/disconnection events to the server.
 */
export const WATCH_CONNECTIONS = 'repo/watch_connections';

/**
 * The name of the event which stops watching for connection/disconnection events to the server.
 */
export const UNWATCH_CONNECTIONS = 'repo/unwatch_connections';

/**
 * The name of the event which starts watching for connection/disconnection events to the server on a particular branch.
 */
export const WATCH_BRANCH_CONNECTIONS = 'repo/watch_branch_connections';

/**
 * The name of the event which stops watching for connection/disconnection events to the server on a particular branch.
 */
export const UNWATCH_BRANCH_CONNECTIONS = 'repo/unwatch_branch_connections';

/**
 * The name of the event which notifies that a connection became connected to a branch.
 */
export const CONNECTED_TO_BRANCH = 'repo/connected_to_branch';

/**
 * The name of the event which notifies that a connection become disconnected from a branch.
 */
export const DISCONNECTED_FROM_BRANCH = 'repo/disconnected_from_branch';

/**
 * The name of the event which gets information about a branch.
 */
export const BRANCH_INFO = 'repo/branch_info';

/**
 * The name of the event which gets all the branches.
 */
export const BRANCHES = 'repo/branches';

/**
 * The name of the event which gets all the branches.
 */
export const BRANCHES_STATUS = 'repo/branches_status';

/**
 * The name of the event which gets all the connections for a branch.
 */
export const CONNECTIONS = 'repo/connections';

/**
 * The name of the event which gets the number of connections.
 */
export const CONNECTION_COUNT = 'repo/connection_count';

/**
 * The name of the event which sets the password used to edit the branch.
 */
export const SET_BRANCH_PASSWORD = 'repo/set_branch_password';

/**
 * The name of the event which is used to authenticate a device to write to a branch.
 */
export const AUTHENTICATE_BRANCH_WRITES = 'repo/authenticate_branch_writes';

/**
 * The name of the event which is used to notify that the device is authenticated to a branch.
 */
export const AUTHENTICATED_TO_BRANCH = 'repo/authenticated_to_branch';

/**
 * The name of the event which is used to attempt to synchronize time between devices.
 */
export const SYNC_TIME = 'sync/time';

/**
 * The name of the event which is used to notify a connection that the rate limit has been exceeded.
 */
export const RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded';

/**
 * Defines an event which indicates that a branch should be watched.
 */
export interface WatchBranchEvent {
    /**
     * The name of the branch to watch.
     */
    branch: string;

    /**
     * The ID of the site that is watching the branch.
     */
    siteId?: string;

    /**
     * Whether the branch should be temporary.
     * That is, if the branch data should not be loaded from the database
     * and everything should be deleted once all the watchers have left.
     * Defaults to false.
     */
    temporary?: boolean;

    /**
     * Whether this branch is the primary branch.
     * Useful for indicating to branch watchers whether they should enable specialized functionality
     * on this branch. Defaults to true.
     */
    primary?: boolean;

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
     * The list of timestamps that the updates occurred at.
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

    /**
     * The error code that occurred.
     * If omitted, then no error occurred.
     */
    errorCode?: 'max_size_reached';

    /**
     * The maximum allowed size for the inst.
     * Only included when the errorCode is set to "max_size_reached".
     */
    maxBranchSizeInBytes?: number;

    /**
     * The size that the inst would be at if the updates were added.
     * Only included when the errorCode is set to "max_size_reached".
     */
    neededBranchSizeInBytes?: number;
}

/**
 * Defines an event which indicates that writing to the specified branch should be authenticated using the given password.
 */
export interface AuthenticateBranchWritesEvent {
    /**
     * The branch that should be authenticated.
     */
    branch: string;

    /**
     * The password that should be used.
     */
    password: string;
}

/**
 * Defines an event which indicates that the device is authenticated to a branch.
 */
export interface AuthenticatedToBranchEvent {
    /**
     * The branch.
     */
    branch: string;

    /**
     * Whether the device is authenticated.
     */
    authenticated: boolean;
}

/**
 * Defines an event which indicates that the branch password should be set to the given new password.
 */
export interface SetBranchPasswordEvent {
    /**
     * The branch that should have its password changed.
     */
    branch: string;

    /**
     * The old password for the branch.
     */
    oldPassword: string;

    /**
     * The new password for the branch.
     */
    newPassword: string;
}

/**
 * Defines an event which indicates that the branch state should be reset.
 */
export interface ResetEvent {
    /**
     * The branch that the atoms are for.
     */
    branch: string;
}

/**
 * Sends the given remote action to devices connected to the given branch.
 */
export interface SendRemoteActionEvent {
    /**
     * The branch.
     */
    branch: string;

    /**
     * The action to send.
     */
    action: RemoteAction | RemoteActionResult | RemoteActionError;
}

/**
 * Sends the given device action to devices connected to the given branch.
 */
export interface ReceiveDeviceActionEvent {
    branch: string;
    action: DeviceAction | DeviceActionResult | DeviceActionError;
}

/**
 * Defines an event which indicates that atoms were received and processed.
 */
export interface AtomsReceivedEvent {
    /**
     * The branch that the atoms were for.
     */
    branch: string;

    /**
     * The hashes of the atoms that were processed.
     */
    hashes: string[];
}

/**
 * Defines an event which indicates that a connection has been made to a branch.
 */
export interface ConnectedToBranchEvent {
    /**
     * Whether this event is for WATCH_DEVICES listeners or WATCH_BRANCH_DEVICES listeners.
     * If true, then listeners for a specific branch should ignore the event.
     */
    broadcast: boolean;

    /**
     * The name of the branch that was connected.
     */
    branch: WatchBranchEvent;

    /**
     * The info of session that connected.
     */
    connection: ConnectionInfo;
}

/**
 * Defines an event which indicates that a connection has been removed from a branch.
 */
export interface DisconnectedFromBranchEvent {
    /**
     * Whether this event is for WATCH_DEVICES listeners or WATCH_BRANCH_DEVICES listeners.
     * If true, then listeners for a specific branch should ignore the event.
     */
    broadcast: boolean;

    /**
     * The name of the branch that was disconnected.
     */
    branch: string;

    /**
     * The info of session that disconnected.
     */
    connection: ConnectionInfo;
}

export type BranchInfoEvent = BranchExistsInfo | BranchDoesNotExistInfo;

export interface BranchExistsInfo {
    branch: string;
    exists: true;
}

export interface BranchDoesNotExistInfo {
    branch: string;
    exists: false;
}

export interface BranchesEvent {
    branches: string[];
}

export interface BranchesStatusEvent {
    branches: {
        branch: string;
        lastUpdateTime: Date;
    }[];
}

export interface ConnectionsEvent {
    connections: ConnectionInfo[];
}

export interface ConnectionCountEvent {
    branch: string;
    count: number;
}

export interface LoadBranchEvent {
    branch: string;
}

export interface UnloadBranchEvent {
    branch: string;
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

export interface RateLimitExceededEvent {
    retryAfter: number;
    totalHits: number;
}
