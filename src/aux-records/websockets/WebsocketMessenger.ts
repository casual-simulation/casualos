import {
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    GET_UPDATES,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    SendRemoteActionEvent,
    SEND_EVENT,
    UNWATCH_BRANCH,
    WatchBranchEvent,
    WATCH_BRANCH,
    RATE_LIMIT_EXCEEDED,
    RateLimitExceededEvent,
    CONNECTED_TO_BRANCH,
    DISCONNECTED_FROM_BRANCH,
    WATCH_BRANCH_CONNECTIONS,
    UNWATCH_BRANCH_CONNECTIONS,
} from './WebsocketEvents';
import { Packet } from './Events';
import {
    AddUpdatesEvent,
    ADD_UPDATES,
    SYNC_TIME,
    TimeSyncResponse,
    UpdatesReceivedEvent,
    UPDATES_RECEIVED,
} from './ExtraEvents';

/**
 * The name of the event which gets the number of devices.
 */
export const CONNECTION_COUNT = 'repo/connection_count';

/**
 * Defines an interface that is capable of sending messages to connections.
 */
export interface WebsocketMessenger {
    /**
     * Sends the given data to the given connection IDs.
     * @param connectionIds The IDs of the connections.
     * @param data The data that should be sent.
     * @param excludeConnection The connection ID that should be skipped.
     */
    sendMessage(
        connectionIds: string[],
        data: Message,
        excludeConnection?: string
    ): Promise<void>;

    sendPacket?(connectionId: string, packet: Packet): Promise<void>;
    sendRaw?(connectionId: string, data: string): Promise<void>;
}

export type Message =
    | WatchBranchMessage
    | AddUpdatesMessage
    | UpdatesReceivedMessage
    | ReceiveMessageMessage
    | ConnectedToBranchMessage
    | DisconnectedFromBranchMessage
    | UnwatchBranchMessage
    | SendEventMessage
    | WatchBranchConnectionsMessage
    | UnatchBranchConnectionsMessage
    | ConnectionCountMessage
    | SyncTimeMessage
    | GetUpdatesMessage
    | RateLimitExceededMessage;

export interface WatchBranchMessage {
    name: typeof WATCH_BRANCH;
    data: WatchBranchEvent;
}

export interface AddUpdatesMessage {
    name: typeof ADD_UPDATES;
    data: AddUpdatesEvent;
}

export interface UpdatesReceivedMessage {
    name: typeof UPDATES_RECEIVED;
    data: UpdatesReceivedEvent;
}

export interface ReceiveMessageMessage {
    name: typeof RECEIVE_EVENT;
    data: ReceiveDeviceActionEvent;
}

export interface ConnectedToBranchMessage {
    name: typeof CONNECTED_TO_BRANCH;
    data: ConnectedToBranchEvent;
}

export interface DisconnectedFromBranchMessage {
    name: typeof DISCONNECTED_FROM_BRANCH;
    data: DisconnectedFromBranchEvent;
}

export interface UnwatchBranchMessage {
    name: typeof UNWATCH_BRANCH;
    data: string;
}

export interface SendEventMessage {
    name: typeof SEND_EVENT;
    data: SendRemoteActionEvent;
}

export interface WatchBranchConnectionsMessage {
    name: typeof WATCH_BRANCH_CONNECTIONS;
    data: string;
}

export interface UnatchBranchConnectionsMessage {
    name: typeof UNWATCH_BRANCH_CONNECTIONS;
    data: string;
}

export interface ConnectionCountMessage {
    name: typeof CONNECTION_COUNT;
    data: {
        branch: string;
        count: number;
    };
}

export interface SyncTimeMessage {
    name: typeof SYNC_TIME;
    data: TimeSyncResponse;
}

export interface GetUpdatesMessage {
    name: typeof GET_UPDATES;
    data: string;
}

export interface RateLimitExceededMessage {
    name: typeof RATE_LIMIT_EXCEEDED;
    data: RateLimitExceededEvent;
}
