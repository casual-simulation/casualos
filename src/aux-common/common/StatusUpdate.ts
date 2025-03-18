import type {
    WebsocketErrorCode,
    WebsocketErrorInfo,
} from '../websockets/WebsocketEvents';
import type { ConnectionInfo } from './ConnectionInfo';

export type StatusUpdate =
    | StatusMessage
    | ConnectionMessage
    | SyncMessage
    | AuthenticationMessage
    | AuthorizationMessage
    | InitMessage
    | ProgressMessage
    | ConsoleMessages;

export interface ConnectionMessage {
    type: 'connection';

    connected: boolean;
}

export interface AuthenticationMessage {
    type: 'authentication';

    /**
     * Whether the session is authenticated.
     */
    authenticated: boolean;

    /**
     * The info about the connection.
     */
    info?: ConnectionInfo;

    /**
     * The reason why the user is not authenticated.
     */
    reason?: WebsocketErrorCode;
}

export interface AuthorizationMessage {
    type: 'authorization';

    /**
     * Whether the session is authorized.
     */
    authorized: boolean;

    /**
     * The error that triggered this message.
     */
    error?: WebsocketErrorInfo;
}

export interface SyncMessage {
    type: 'sync';

    synced: boolean;
}

/**
 * Defines a status update which indicates that the channel has been fully setup.
 */
export interface InitMessage {
    type: 'init';
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

/**
 * Defines a progress message which indicates the loading status of a component.
 */
export interface ProgressMessage {
    type: 'progress';

    /**
     * The message.
     */
    message: string;

    /**
     * The loading percentage. (0 - 1)
     */
    progress: number;

    /**
     * Whether the component is done loading.
     */
    done?: boolean;

    /**
     * Whether the message should be communicated as an error.
     */
    error?: boolean;

    /**
     * The title for the message.
     */
    title?: string;
}

/**
 * Defines the set of possible console message types.
 */
export type ConsoleMessages =
    | ConsoleLogMessage
    | ConsoleWarnMessage
    | ConsoleErrorMessage;

/**
 * Defines an interface for a console log message.
 */
export interface ConsoleLogMessage extends ConsoleMessage {
    type: 'log';
}

/**
 * Defines an interface for a console log message.
 */
export interface ConsoleWarnMessage extends ConsoleMessage {
    type: 'warn';
}

/**
 * Defines an interface for a console error message.
 */
export interface ConsoleErrorMessage extends ConsoleMessage {
    type: 'error';
}

/**
 * Defines an interface for a console message.
 */
export interface ConsoleMessage {
    messages: any[];
    stack: string;
    source: string;
}
