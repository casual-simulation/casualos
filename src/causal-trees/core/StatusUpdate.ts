export type StatusUpdate =
    | StatusMessage
    | ConnectionMessage
    | SyncMessage
    | AuthenticationMessage
    | AuthorizationMessage;

export interface ConnectionMessage {
    type: 'connection';

    connected: boolean;
}

export interface AuthenticationMessage {
    type: 'authentication';

    authenticated: boolean;
}

export interface AuthorizationMessage {
    type: 'authorization';

    authorized: boolean;
}

export interface SyncMessage {
    type: 'sync';

    synced: boolean;
}

/**
 * Defines a generic status message.
 */
export interface StatusMessage {
    type: 'message';

    /**
     * Where the message came from.
     */
    source: string;

    /**
     * The message.
     */
    message: string;
}
