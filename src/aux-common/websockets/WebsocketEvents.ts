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
    AuthorizeActionMissingPermission,
    DenialReason,
} from '../common/DenialReason';
import type { NotSupportedError, ServerError } from '../Errors';
import type { ConnectionInfo } from '../common/ConnectionInfo';
import { connectionInfoSchema } from '../common/ConnectionInfo';
import type {
    RemoteAction,
    DeviceAction,
    DeviceActionResult,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionError,
} from '../common/RemoteActions';
import {
    remoteActionsSchema,
    deviceActionsSchema,
} from '../common/RemoteActions';
import type { ZodIssue } from 'zod';
import { z } from 'zod';
import type {
    GenericHttpRequest,
    GenericHttpResponse,
} from '../http/GenericHttpInterface';
import { genericHttpRequestSchema } from '../http/GenericHttpInterface';
import type { PublicUserInfo, ResourceKinds, SubjectType } from '../common';
import {
    ACTION_KINDS_VALIDATION,
    RESOURCE_KIND_VALIDATION,
    SUBJECT_TYPE_VALIDATION,
} from '../common';
import type { KnownErrorCodes } from '../rpc/ErrorCodes';

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
    | KnownErrorCodes
    | 'invalid_record_key'
    | 'unacceptable_connection_token'
    | 'invalid_token'
    | 'session_expired'
    | 'user_is_banned'
    | 'unacceptable_connection_id'
    | 'message_not_found'
    | 'unacceptable_request'
    | 'record_not_found'
    | 'not_authorized'
    | 'action_not_supported'
    | 'not_logged_in'
    | 'subscription_limit_reached'
    | 'inst_not_found'
    | 'invalid_connection_state';

/**
 * Defines an interface that contains information about an error that occurred.
 */
export interface WebsocketErrorInfo {
    success: false;

    /**
     * The name of the record that the error is associated with.
     */
    recordName?: string | null;

    /**
     * The name of the inst that the error is associated with.
     */
    inst?: string;

    /**
     * The name of the branch that the error is associated with.
     */
    branch?: string;

    /**
     * The error code that occurred.
     */
    errorCode: WebsocketErrorCode;

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The list of parsing issues that occurred.
     */
    issues?: ZodIssue[];

    /**
     * The authorization denial reason.
     */
    reason?: DenialReason;
}
export const websocketErrorInfoSchema = z.object({
    errorCode: z.string(),
    errorMessage: z.string(),
    issues: z.array(z.any()).optional(),
    reason: z.any().optional(),
});

/**
 * Defines a websocket event that contains a response to an upload request.
 */
export type WebsocketErrorEvent = [
    type: WebsocketEventTypes.Error,
    id: number,
    info: WebsocketErrorInfo
];
export const websocketErrorEventSchema = z.tuple([
    z.literal(WebsocketEventTypes.Error),
    z.number(),
    websocketErrorInfoSchema,
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
    | WatchBranchResultMessage
    | TimeSyncResponseMessage
    | UpdatesReceivedMessage
    | ReceiveDeviceActionMessage
    | ConnectedToBranchMessage
    | DisconnectedFromBranchMessage
    | RateLimitExceededMessage
    | WebsocketHttpResponseMessage
    | WebsocketHttpPartialResponseMessage
    | RequestMissingPermissionResponseMessage;

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
    | GetUpdatesMessage
    | WebsocketHttpRequestMessage
    | RequestMissingPermissionMessage
    | RequestMissingPermissionResponseMessage;

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
    connectionId?: string;
}
export const loginMessageSchema = z.object({
    type: z.literal('login'),
    connectionToken: z.string().optional(),
    connectionId: z.string().optional(),
});
type ZodLoginMessage = z.infer<typeof loginMessageSchema>;
type ZodLoginMessageAssertion = HasType<ZodLoginMessage, LoginMessage>;

/**
 * Defines a login result message.
 */
export type LoginResultMessage =
    | LoginResultSuccessMessage
    | LoginResultFailureMessage;

export interface LoginResultBaseMessage {
    type: 'login_result';
}

export interface LoginResultSuccessMessage extends LoginResultBaseMessage {
    success: true;

    /**
     * The info for the connection.
     */
    info: ConnectionInfo;
}

export interface LoginResultFailureMessage extends LoginResultBaseMessage {
    success: false;

    /**
     * The error code that occurred.
     */
    errorCode: WebsocketErrorCode;

    /**
     * The error message that occurred.
     */
    errorMessage: string;

    /**
     * The authorization denial reason.
     */
    reason?: DenialReason;
}

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

export type WatchBranchResultMessage =
    | WatchBranchResultSuccessMessage
    | WatchBranchResultFailureMessage;

export interface WatchBranchResultSuccessMessage {
    type: 'repo/watch_branch_result';
    success: true;

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
}

export interface WatchBranchResultFailureMessage {
    type: 'repo/watch_branch_result';
    success: false;

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
     * The error code that occurred.
     */
    errorCode: WebsocketErrorCode;

    /**
     * The error message that occurred.
     */
    errorMessage: string;

    /**
     * The authorization denial reason.
     */
    reason?: DenialReason;
}

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
 * Defines an event which indicates that an HTTP request should be made.
 */
export interface WebsocketHttpRequestMessage {
    type: 'http_request';

    /**
     * The ID of the request.
     */
    id: number;

    /**
     * The HTTP request.
     */
    request: Omit<GenericHttpRequest, 'ipAddress'>;
}
export const websocketHttpRequestMessageSchema = z.object({
    type: z.literal('http_request'),
    request: genericHttpRequestSchema,
    id: z.number(),
});

export interface WebsocketHttpResponseMessage {
    type: 'http_response';

    /**
     * The ID of the request that this response is for.
     */
    id: number;

    /**
     * The response.
     */
    response: GenericHttpResponse;
}

export interface WebsocketHttpPartialResponseMessage {
    type: 'http_partial_response';

    /**
     * The ID of the request that this response is for.
     */
    id: number;

    /**
     * The index of the partial response.
     */
    index: number;

    /**
     * Whether this message is the final message.
     * If true, then the response will be omitted.
     */
    final?: boolean;

    /**
     * The response.
     */
    response?: Partial<GenericHttpResponse>;
}

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
     * Null if all connections should be counted.
     */
    inst: string | null;

    /**
     * The name of the branch.
     * Null if all connections should be counted.
     */
    branch: string | null;

    /**
     * The number of connections.
     */
    count?: number;
}
export const connectionCountMessageSchema = z.object({
    type: z.literal('repo/connection_count'),
    recordName: z.string().nonempty().nullable(),
    inst: z.string().nullable(),
    branch: z.string().nullable(),
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

export interface RequestMissingPermissionMessage {
    type: 'permission/request/missing';

    /**
     * The permission that should be requested.
     */
    reason: AuthorizeActionMissingPermission;

    /**
     * The info of session that requested the permission.
     */
    connection?: ConnectionInfo;

    /**
     * The info about the user that is requesting the permission.
     */
    user?: PublicUserInfo;
}
export const requestMissingPermissionMessageSchema = z.object({
    type: z.literal('permission/request/missing'),
    reason: z.object({
        type: z.literal('missing_permission'),
        recordName: z.string(),
        resourceKind: RESOURCE_KIND_VALIDATION,
        resourceId: z.string(),
        action: ACTION_KINDS_VALIDATION,
        subjectType: SUBJECT_TYPE_VALIDATION,
        subjectId: z.string(),
    }),
});
type ZodRequestMissingPermissionMessage = z.infer<
    typeof requestMissingPermissionMessageSchema
>;
type ZodRequestMissingPermissionMessageAssertion = HasType<
    ZodRequestMissingPermissionMessage,
    RequestMissingPermissionMessage
>;

export type RequestMissingPermissionResponseMessage =
    | RequestMissingPermissionResponseSuccessMessage
    | RequestMissingPermissionResponseFailureMessage;

export interface RequestMissingPermissionResponseSuccessMessage {
    type: 'permission/request/missing/response';
    success: true;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    /**
     * The connection that responded to the request.
     */
    connection?: ConnectionInfo;
}

export interface RequestMissingPermissionResponseFailureMessage {
    type: 'permission/request/missing/response';
    success: false;

    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    subjectType: SubjectType;
    subjectId: string;

    errorCode: WebsocketErrorCode;
    errorMessage: string;

    /**
     * The connection that responded to the request.
     */
    connection?: ConnectionInfo;
}
export const requestMissingPermissionResponseMessageSchema = z.object({
    type: z.literal('permission/request/missing/response'),
    success: z.boolean(),
    recordName: z.string(),
    resourceKind: RESOURCE_KIND_VALIDATION,
    resourceId: z.string(),
    subjectType: SUBJECT_TYPE_VALIDATION,
    subjectId: z.string(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
});

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
    websocketHttpRequestMessageSchema,
    requestMissingPermissionMessageSchema,
    requestMissingPermissionResponseMessageSchema,
]);
type ZodWebsocketRequestMessage = z.infer<typeof websocketRequestMessageSchema>;
type ZodWebsocketRequestMessageAssertion = HasType<
    ZodWebsocketRequestMessage,
    WebsocketRequestMessage
>;

type HasType<T, Q extends T> = Q;
