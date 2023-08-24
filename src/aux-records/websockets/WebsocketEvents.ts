import { Action } from '../common/Action';
import { ConnectionInfo } from '../common/ConnectionInfo';
import {
    RemoteAction,
    DeviceAction,
    DeviceActionResult,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionError,
} from '../common/RemoteActions';

/**
 * Defines a websocket event.
 *
 * That is, an event that is used to manage and communicate over a websocket connection.
 *
 * There are currently three types of events:
 * - message: A message that was recieved.
 * - upload_request: A request to upload a large message to a large object store. (This event type only exists to get around message size limits)
 * - upload_response: A response to an upload_request event. (This event type only exists to get around message size limits)
 * - download_request: A request to tell the client to download a message from from a URL. (This event type only exists to get around message size limits)
 */
export type WebsocketEvent =
    | WebsocketMessageEvent
    | WebsocketUploadRequestEvent
    | WebsocketUploadResponseEvent
    | WebsocketDownloadRequestEvent;

export enum WebsocketEventTypes {
    Message = 1,
    UploadRequest = 2,
    UploadResponse = 3,
    DownloadRequest = 4,
}

/**
 * Defines a websocket event that contains a message.
 */
export type WebsocketMessageEvent = [
    type: WebsocketEventTypes.Message,
    data: any
];

/**
 * Defines a websocket event that contains a request to upload a large message.
 */
export type WebsocketUploadRequestEvent = [
    type: WebsocketEventTypes.UploadRequest,
    id: string
];

/**
 * Defines a websocket event that contains a response to an upload request.
 */
export type WebsocketUploadResponseEvent = [
    type: WebsocketEventTypes.UploadResponse,
    id: string,
    uploadUrl: string
];

/**
 * Defines a websocket event that contains a request to download a large message.
 */
export type WebsocketDownloadRequestEvent = [
    type: WebsocketEventTypes.DownloadRequest,
    url: string
];

export type WebsocketMessage =
    | LoginMessage
    | LoginResultMessage
    | WatchBranchMessage
    | UnwatchBranchMessage
    | AddUpdatesMessage
    | UpdatesReceivedMessage
    | ResetMessage
    | SendActionMessage
    | ReceiveDeviceActionMessage
    | ConnectedToBranchMessage
    | DisconnectedFromBranchMessage
    | BranchInfoMessage
    | ListBranchesMessage
    | BranchesStatusMessage
    | ListConnectionsMessage
    | ConnectionCountMessage
    | TimeSyncRequestMessage
    | TimeSyncResponseMessage
    | RateLimitExceededMessage;

/**
 * Defines a login message.
 */
export interface LoginMessage {
    type: 'login';

    /**
     * The token that should be used to authenticate the connection.
     */
    connectionToken: string;
}

/**
 * Defines a login result message.
 */
export interface LoginResultMessage {
    type: 'login_result';
}

/**
 * Defines an event which indicates that a branch should be watched.
 */
export interface WatchBranchMessage {
    type: 'repo/watch_branch';

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
 * Defines an event which indicates that a branch should be unwatched.
 */
export interface UnwatchBranchMessage {
    type: 'repo/unwatch_branch';

    /**
     * The name of the branch to unwatch.
     */
    branch: string;
}

/**
 * Defines an event which indicates that some arbitrary updates should be added for the given branch.
 * Note that while all branches support both atoms and updates, they do not support mixed usage.
 * This means that clients which use updates should ignore atoms and vice versa.
 */
export interface AddUpdatesMessage {
    type: 'repo/add_updates';

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
export interface UpdatesReceivedMessage {
    type: 'repo/updates_received';

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
 * Defines an event which indicates that the branch state should be reset.
 */
export interface ResetMessage {
    type: 'repo/reset';

    /**
     * The branch that the atoms are for.
     */
    branch: string;
}

/**
 * Sends the given remote action to devices connected to the given branch.
 */
export interface SendActionMessage {
    type: 'repo/send_action';

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
export interface ReceiveDeviceActionMessage {
    type: 'repo/receive_action';

    branch: string;
    action: DeviceAction | DeviceActionResult | DeviceActionError;
}

/**
 * Defines an event which indicates that a connection has been made to a branch.
 */
export interface ConnectedToBranchMessage {
    type: 'repo/connected_to_branch';

    /**
     * Whether this event is for WATCH_DEVICES listeners or WATCH_BRANCH_DEVICES listeners.
     * If true, then listeners for a specific branch should ignore the event.
     */
    broadcast: boolean;

    /**
     * The name of the branch that was connected.
     */
    branch: WatchBranchMessage;

    /**
     * The info of session that connected.
     */
    connection: ConnectionInfo;
}

/**
 * Defines an event which indicates that a connection has been removed from a branch.
 */
export interface DisconnectedFromBranchMessage {
    type: 'repo/disconnected_from_branch';

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

export type BranchInfoMessage =
    | BranchExistsInfoMessage
    | BranchDoesNotExistInfoMessage;

export interface BranchExistsInfoMessage {
    type: 'repo/branch_info';
    branch: string;
    exists: true;
}

export interface BranchDoesNotExistInfoMessage {
    type: 'repo/branch_info';
    branch: string;
    exists: false;
}

export interface ListBranchesMessage {
    type: 'repo/branches';
    branches: string[];
}

export interface BranchesStatusMessage {
    type: 'repo/branches_status';
    branches: {
        branch: string;
        lastUpdateTime: Date;
    }[];
}

export interface ListConnectionsMessage {
    type: 'repo/connections';
    connections: ConnectionInfo[];
}

export interface ConnectionCountMessage {
    type: 'repo/connection_count';
    branch: string;
    count: number;
}

/**
 * Defines an event which attempts to perform a time sync.
 */
export interface TimeSyncRequestMessage {
    type: 'sync/time';

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
export interface TimeSyncResponseMessage {
    type: 'sync/time/response';

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

export interface RateLimitExceededMessage {
    type: 'rate_limit_exceeded';
    retryAfter: number;
    totalHits: number;
}
