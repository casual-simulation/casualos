import { NotSupportedError, ServerError } from '../Errors';
import { ConnectionInfo, connectionInfoSchema } from '../common/ConnectionInfo';
import {
    RemoteAction,
    DeviceAction,
    DeviceActionResult,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionError,
    remoteActionsSchema,
    deviceActionsSchema,
} from '../common/RemoteActions';
import { ZodIssue, z } from 'zod';

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
    | WebsocketDownloadRequestEvent
    | WebsocketErrorEvent;

export enum WebsocketEventTypes {
    Message = 1,
    UploadRequest = 2,
    UploadResponse = 3,
    DownloadRequest = 4,
    Error = 5,
}

export const websocketEventSchema = z
    .tuple([z.nativeEnum(WebsocketEventTypes), z.number()])
    .rest(z.any());

/**
 * Defines a websocket event that contains a message.
 */
export type WebsocketMessageEvent = [
    type: WebsocketEventTypes.Message,
    id: number,
    data: WebsocketMessage
];

/**
 * Defines a websocket event that contains a request to upload a large message.
 */
export type WebsocketUploadRequestEvent = [
    type: WebsocketEventTypes.UploadRequest,
    id: number
];
export const websocketUploadRequestEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.UploadRequest),
    z.number(),
]);

export interface UploadHttpHeaders {
    [key: string]: string;
}

/**
 * Defines a websocket event that contains a response to an upload request.
 */
export type WebsocketUploadResponseEvent = [
    type: WebsocketEventTypes.UploadResponse,
    id: number,
    uploadUrl: string,
    uploadMethod: string,
    uploadHeaders: UploadHttpHeaders
];
export const websocketUploadResponseEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.UploadResponse),
    z.number(),
    z.string(),
    z.string(),
    z.record(z.string()),
]);

export type WebsocketErrorCode =
    | ServerError
    | NotSupportedError
    | 'unacceptable_connection_token'
    | 'invalid_token'
    | 'session_expired'
    | 'user_is_banned'
    | 'unacceptable_connection_id'
    | 'message_not_found'
    | 'unnaceptable_request';

/**
 * Defines a websocket event that contains a response to an upload request.
 */
export type WebsocketErrorEvent = [
    type: WebsocketEventTypes.Error,
    id: number,
    errorCode: WebsocketErrorCode,
    errorMessage: string,
    issues: ZodIssue[]
];
export const websocketErrorEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.Error),
    z.number(),
    z.string(),
    z.string(),
    z.array(z.any()),
]);

/**
 * Defines a websocket event that contains a request to download a large message.
 */
export type WebsocketDownloadRequestEvent = [
    type: WebsocketEventTypes.DownloadRequest,
    id: number,
    downloadUrl: string,
    downloadMethod: string,
    downloadHeaders: UploadHttpHeaders
];
export const websocketDownloadRequestEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.DownloadRequest),
    z.number(),
    z.string(),
    z.string(),
    z.record(z.string()),
]);

export type WebsocketResponseMessage =
    | LoginResultMessage
    | TimeSyncResponseMessage
    | UpdatesReceivedMessage
    | ReceiveDeviceActionMessage
    | ConnectedToBranchMessage
    | DisconnectedFromBranchMessage
    | RateLimitExceededMessage;

export type WebsocketRequestMessage =
    | LoginMessage
    | WatchBranchMessage
    | UnwatchBranchMessage
    | AddUpdatesMessage
    | SendActionMessage
    | WatchBranchDevicesMessage
    | UnwatchBranchDevicesMessage
    | ConnectionCountMessage
    | TimeSyncRequestMessage
    | GetUpdatesMessage;

export type WebsocketMessage =
    | WebsocketRequestMessage
    | WebsocketResponseMessage;

/**
 * Defines a login message.
 */
export interface LoginMessage {
    type: 'login';

    /**
     * The token that should be used to authenticate the connection.
     */
    connectionToken?: string;

    /**
     * The ID that the client wants to use for the connection.
     * Must be unique.
     */
    clientConnectionId?: string;
}
export const loginMessageSchema = z.object({
    type: z.literal('login'),
    connectionToken: z.string().optional(),
    clientConnectionId: z.string().optional(),
});
type ZodLoginMessage = z.infer<typeof loginMessageSchema>;
type ZodLoginMessageAssertion = HasType<ZodLoginMessage, LoginMessage>;

/**
 * Defines a login result message.
 */
export interface LoginResultMessage {
    type: 'login_result';

    /**
     * The info for the connection.
     */
    info: ConnectionInfo;
}
export const loginResultMessageSchema = z.object({
    type: z.literal('login_result'),
});
type ZodLoginResultMessage = z.infer<typeof loginResultMessageSchema>;
type ZodLoginResultMessageAssertion = HasType<
    ZodLoginResultMessage,
    LoginResultMessage
>;

/**
 * Defines an event which indicates that a branch should be watched.
 */
export interface WatchBranchMessage {
    type: 'repo/watch_branch';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch to watch.
     */
    branch: string;

    /**
     * Whether the branch should be temporary.
     * That is, if the branch data should not be loaded from the database
     * and everything should be deleted once all the watchers have left.
     * Defaults to false.
     */
    temporary?: boolean;

    /**
     * The protocol that should be used.
     * Currently, "updates" is the only supported protocol.
     */
    protocol?: 'updates';
}
export const watchBranchMessageSchema = z.object({
    type: z.literal('repo/watch_branch'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    temporary: z.boolean().optional(),
});
type ZodWatchBranchMessage = z.infer<typeof watchBranchMessageSchema>;
type ZodWatchBranchMessageAssertion = HasType<
    ZodWatchBranchMessage,
    WatchBranchMessage
>;

/**
 * Defines an event which indicates that a branch should be unwatched.
 */
export interface UnwatchBranchMessage {
    type: 'repo/unwatch_branch';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch to unwatch.
     */
    branch: string;
}
export const unwatchBranchMessageSchema = z.object({
    type: z.literal('repo/unwatch_branch'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
});
type ZodUnwatchBranchMessage = z.infer<typeof unwatchBranchMessageSchema>;
type ZodUnwatchBranchMessageAssertion = HasType<
    ZodUnwatchBranchMessage,
    UnwatchBranchMessage
>;

/**
 * Defines an event which indicates that devices connected to a branch should be watched.
 */
export interface WatchBranchDevicesMessage {
    type: 'repo/watch_branch_devices';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch to unwatch.
     */
    branch: string;
}
export const watchBranchDevicesMessageSchema = z.object({
    type: z.literal('repo/watch_branch_devices'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
});
type ZodWatchBranchDevicesMessage = z.infer<
    typeof watchBranchDevicesMessageSchema
>;
type ZodWatchBranchDevicesMessageAssertion = HasType<
    ZodWatchBranchDevicesMessage,
    WatchBranchDevicesMessage
>;

/**
 * Defines an event which indicates that devices connected to a branch should be no longer be watched.
 */
export interface UnwatchBranchDevicesMessage {
    type: 'repo/unwatch_branch_devices';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch to unwatch.
     */
    branch: string;
}
export const unwatchBranchDevicesMessageSchema = z.object({
    type: z.literal('repo/unwatch_branch_devices'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
});
type ZodUnwatchBranchDevicesMessage = z.infer<
    typeof unwatchBranchDevicesMessageSchema
>;
type ZodUnwatchBranchDevicesMessageAssertion = HasType<
    ZodUnwatchBranchDevicesMessage,
    UnwatchBranchDevicesMessage
>;

/**
 * Defines an event which indicates that some arbitrary updates should be added for the given branch.
 * Note that while all branches support both atoms and updates, they do not support mixed usage.
 * This means that clients which use updates should ignore atoms and vice versa.
 */
export interface AddUpdatesMessage {
    type: 'repo/add_updates';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

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
export const addUpdatesMessageSchema = z.object({
    type: z.literal('repo/add_updates'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    updates: z.array(z.string()),
    updateId: z.number().optional(),
    initial: z.boolean().optional(),
    timestamps: z.array(z.number()).optional(),
});
type ZodAddUpdatesMessage = z.infer<typeof addUpdatesMessageSchema>;
type ZodAddUpdatesMessageAssertion = HasType<
    ZodAddUpdatesMessage,
    AddUpdatesMessage
>;

/**
 * Defines an event which indicates that the updates for the given branch should be retrieved.
 */
export interface GetUpdatesMessage {
    type: 'repo/get_updates';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The branch that the updates are for.
     */
    branch: string;
}
export const getUpdatesMessageSchema = z.object({
    type: z.literal('repo/get_updates'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
});
type ZodGetUpdatesMessage = z.infer<typeof getUpdatesMessageSchema>;
type ZodGetUpdatesMessageAssertion = HasType<
    ZodGetUpdatesMessage,
    GetUpdatesMessage
>;

/**
 * Defines an event which indicates that some arbitrary updates where added for the given branch.
 */
export interface UpdatesReceivedMessage {
    type: 'repo/updates_received';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

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
    errorCode?: 'max_size_reached' | 'record_not_found' | 'inst_not_found';

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
export const updatesReceivedMessageSchema = z.object({
    type: z.literal('repo/updates_received'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    updateId: z.number(),
    errorCode: z
        .enum(['max_size_reached', 'record_not_found', 'inst_not_found'])
        .optional(),
    maxBranchSizeInBytes: z.number().optional(),
    neededBranchSizeInBytes: z.number().optional(),
});
type ZodUpdatesReceivedMessage = z.infer<typeof updatesReceivedMessageSchema>;
type ZodUpdatesReceivedMessageAssertion = HasType<
    ZodUpdatesReceivedMessage,
    UpdatesReceivedMessage
>;

// /**
//  * Defines an event which indicates that the branch state should be reset.
//  */
// export interface ResetMessage {
//     type: 'repo/reset';

//     /**
//      * The branch that the atoms are for.
//      */
//     branch: string;
// }

// export const resetMessageSchema = z.object({
//     type: z.literal('repo/reset'),
//     branch: z.string(),
// });
// type ZodResetMessage = z.infer<typeof resetMessageSchema>;
// type ZodResetMessageAssertion = HasType<ZodResetMessage, ResetMessage>;

/**
 * Sends the given remote action to devices connected to the given branch.
 */
export interface SendActionMessage {
    type: 'repo/send_action';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The branch.
     */
    branch: string;

    /**
     * The action to send.
     */
    action: RemoteAction | RemoteActionResult | RemoteActionError;
}
export const sendActionMessageSchema = z.object({
    type: z.literal('repo/send_action'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    action: remoteActionsSchema,
});
type ZodSendActionMessage = z.infer<typeof sendActionMessageSchema>;
type ZodSendActionMessageAssertion = HasType<
    ZodSendActionMessage,
    SendActionMessage
>;

/**
 * Sends the given device action to devices connected to the given branch.
 */
export interface ReceiveDeviceActionMessage {
    type: 'repo/receive_action';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The branch that the action is for.
     */
    branch: string;

    /**
     * The action that should be sent.
     */
    action: DeviceAction | DeviceActionResult | DeviceActionError;
}
export const receiveDeviceActionMessageSchema = z.object({
    type: z.literal('repo/receive_action'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    action: deviceActionsSchema,
});
type ZodReceiveDeviceActionMessage = z.infer<
    typeof receiveDeviceActionMessageSchema
>;
type ZodReceiveDeviceActionMessageAssertion = HasType<
    ZodReceiveDeviceActionMessage,
    ReceiveDeviceActionMessage
>;

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
export const connectedToBranchMessageSchema = z.object({
    type: z.literal('repo/connected_to_branch'),
    broadcast: z.boolean(),
    branch: watchBranchMessageSchema,
    connection: connectionInfoSchema,
});
type ZodConnectedToBranchMessage = z.infer<
    typeof connectedToBranchMessageSchema
>;
type ZodConnectedToBranchMessageAssertion = HasType<
    ZodConnectedToBranchMessage,
    ConnectedToBranchMessage
>;

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
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch that was disconnected.
     */
    branch: string;

    /**
     * The info of session that disconnected.
     */
    connection: ConnectionInfo;
}
export const disconnectedFromBranchMessageSchema = z.object({
    type: z.literal('repo/disconnected_from_branch'),
    broadcast: z.boolean(),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    connection: connectionInfoSchema,
});
type ZodDisconnectedFromBranchMessage = z.infer<
    typeof disconnectedFromBranchMessageSchema
>;
type ZodDisconnectedFromBranchMessageAssertion = HasType<
    ZodDisconnectedFromBranchMessage,
    DisconnectedFromBranchMessage
>;

// export type BranchInfoMessage =
//     | BranchExistsInfoMessage
//     | BranchDoesNotExistInfoMessage;

// export interface BranchExistsInfoMessage {
//     type: 'repo/branch_info/exists';
//     /**
//      * The name of the record that the branch is for.
//      * Null if the branch should be public and non-permanent.
//      */
//     recordName: string | null;

//     /**
//      * The name of the inst.
//      */
//     inst: string;

//     /**
//      * The name of the branch.
//      */
//     branch: string;

//     /**
//      * Whether the branch exists.
//      */
//     exists: true;
// }
// export const branchExistsInfoMessageSchema = z.object({
//     type: z.literal('repo/branch_info/exists'),
//     exists: z.literal(true),
//     recordName: z.string().nonempty().nullable(),
//     inst: z.string(),
//     branch: z.string(),
// });
// type ZodBranchExistsInfoMessage = z.infer<typeof branchExistsInfoMessageSchema>;
// type ZodBranchExistsInfoMessageAssertion = HasType<
//     ZodBranchExistsInfoMessage,
//     BranchExistsInfoMessage
// >;

// export interface BranchDoesNotExistInfoMessage {
//     type: 'repo/branch_info/not_exists';
//     /**
//      * The name of the record that the branch is for.
//      * Null if the branch should be public and non-permanent.
//      */
//     recordName: string | null;

//     /**
//      * The name of the inst.
//      */
//     inst: string;

//     /**
//      * The name of the branch.
//      */
//     branch: string;

//     /**
//      * Whether the branch exists.
//      */
//     exists: false;
// }
// export const branchDoesNotExistInfoMessageSchema = z.object({
//     type: z.literal('repo/branch_info/not_exists'),
//     exists: z.literal(false),
//     recordName: z.string().nonempty().nullable(),
//     inst: z.string(),
//     branch: z.string(),
// });
// type ZodBranchDoesNotExistInfoMessage = z.infer<
//     typeof branchDoesNotExistInfoMessageSchema
// >;
// type ZodBranchDoesNotExistInfoMessageAssertion = HasType<
//     ZodBranchDoesNotExistInfoMessage,
//     BranchDoesNotExistInfoMessage
// >;

// export interface ListBranchesMessage {
//     type: 'repo/branches';
//     branches: string[];
// }
// export const listBranchesMessageSchema = z.object({
//     type: z.literal('repo/branches'),
//     branch: z.array(z.string()),
// });
// type ZodListBranchesMessage = z.infer<typeof listBranchesMessageSchema>;
// type ZodListBranchesMessageAssertion = HasType<
//     ZodListBranchesMessage,
//     ListBranchesMessage
// >;

// export interface BranchesStatusMessage {
//     type: 'repo/branches_status';
//     branches: {
//         branch: string;
//         lastUpdateTime: Date;
//     }[];
// }
// export const branchesStatusMessageSchema = z.object({
//     type: z.literal('repo/branches_status'),
//     branches: z.array(
//         z.object({
//             branch: z.string(),
//             lastUpdateTime: z.date(),
//         })
//     ),
// });
// type ZodBranchesStatusMessage = z.infer<typeof branchesStatusMessageSchema>;
// type ZodBranchesStatusMessageAssertion = HasType<
//     ZodBranchesStatusMessage,
//     BranchesStatusMessage
// >;

// export interface ListConnectionsMessage {
//     type: 'repo/connections';
//     connections: ConnectionInfo[];
// }
// export const listConnectionsMessageSchema = z.object({
//     type: z.literal('repo/connections'),
//     connections: z.array(connectionInfoSchema),
// });
// type ZodListConnectionsMessage = z.infer<typeof listConnectionsMessageSchema>;
// type ZodListConnectionsMessageAssertion = HasType<
//     ZodListConnectionsMessage,
//     ListConnectionsMessage
// >;

export interface ConnectionCountMessage {
    type: 'repo/connection_count';

    /**
     * The name of the record that the branch is for.
     * Null if the branch should be public and non-permanent.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The name of the branch.
     */
    branch: string;

    /**
     * The number of connections.
     */
    count?: number;
}
export const connectionCountMessageSchema = z.object({
    type: z.literal('repo/connection_count'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string(),
    branch: z.string(),
    count: z.number().optional(),
});
type ZodConnectionCountMessage = z.infer<typeof connectionCountMessageSchema>;
type ZodConnectionCountMessageAssertion = HasType<
    ZodConnectionCountMessage,
    ConnectionCountMessage
>;

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
export const timeSyncRequestMessageSchema = z.object({
    type: z.literal('sync/time'),
    id: z.number(),
    clientRequestTime: z.number(),
});
type ZodTimeSyncRequestMessage = z.infer<typeof timeSyncRequestMessageSchema>;
type ZodTimeSyncRequestMessageAssertion = HasType<
    ZodTimeSyncRequestMessage,
    TimeSyncRequestMessage
>;

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

export const timeSyncResponseMessageSchema = z.object({
    type: z.literal('sync/time/response'),
    id: z.number(),
    clientRequestTime: z.number(),
    serverReceiveTime: z.number(),
    serverTransmitTime: z.number(),
});
type ZodTimeSyncResponseMessage = z.infer<typeof timeSyncResponseMessageSchema>;
type ZodTimeSyncResponseMessageAssertion = HasType<
    ZodTimeSyncResponseMessage,
    TimeSyncResponseMessage
>;

export interface RateLimitExceededMessage {
    type: 'rate_limit_exceeded';
    retryAfter: number;
    totalHits: number;
}
export const rateLimitExceededMessageSchema = z.object({
    type: z.literal('rate_limit_exceeded'),
    retryAfter: z.number(),
    totalHits: z.number(),
});
type ZodRateLimitExceededMessage = z.infer<
    typeof rateLimitExceededMessageSchema
>;
type ZodRateLimitExceededMessageAssertion = HasType<
    ZodRateLimitExceededMessage,
    RateLimitExceededMessage
>;

export const websocketRequestMessageSchema = z.discriminatedUnion('type', [
    loginMessageSchema,
    watchBranchMessageSchema,
    unwatchBranchMessageSchema,
    addUpdatesMessageSchema,
    sendActionMessageSchema,
    watchBranchDevicesMessageSchema,
    unwatchBranchDevicesMessageSchema,
    connectionCountMessageSchema,
    timeSyncRequestMessageSchema,
    getUpdatesMessageSchema,
]);
type ZodWebsocketRequestMessage = z.infer<typeof websocketRequestMessageSchema>;
type ZodWebsocketRequestMessageAssertion = HasType<
    ZodWebsocketRequestMessage,
    WebsocketRequestMessage
>;

export const websocketMessageSchema = z.discriminatedUnion('type', [
    loginMessageSchema,
    loginResultMessageSchema,
    watchBranchMessageSchema,
    unwatchBranchMessageSchema,
    addUpdatesMessageSchema,
    updatesReceivedMessageSchema,
    sendActionMessageSchema,
    receiveDeviceActionMessageSchema,
    watchBranchDevicesMessageSchema,
    unwatchBranchDevicesMessageSchema,
    connectedToBranchMessageSchema,
    disconnectedFromBranchMessageSchema,
    connectionCountMessageSchema,
    timeSyncRequestMessageSchema,
    timeSyncResponseMessageSchema,
    rateLimitExceededMessageSchema,
    getUpdatesMessageSchema,
]);
type ZodWebsocketMessage = z.infer<typeof websocketMessageSchema>;
type ZodWebsocketMessageAssertion = HasType<
    ZodWebsocketMessage,
    WebsocketRequestMessage
>;

export const websocketMessageEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.Message),
    z.number(),
    websocketMessageSchema,
]);
type ZodWebsocketMessageEvent = z.infer<typeof websocketMessageEventSchema>;
type ZodWebsocketMessageEventAssertion = HasType<
    ZodWebsocketMessageEvent,
    WebsocketMessageEvent
>;

type HasType<T, Q extends T> = Q;
