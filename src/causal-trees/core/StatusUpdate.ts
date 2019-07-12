import { LoginErrorReason } from './LoginError';
import { User } from './User';
import { DeviceInfo } from './DeviceInfo';

export type StatusUpdate =
    | StatusMessage
    | ConnectionMessage
    | SyncMessage
    | AuthenticationMessage
    | AuthorizationMessage
    | InitMessage;

export interface ConnectionMessage {
    type: 'connection';

    connected: boolean;
}

export interface AuthenticationMessage {
    type: 'authentication';

    authenticated: boolean;

    /**
     * The user that was authenticated.
     */
    user?: User;

    /**
     * The info about the device.
     */
    info?: DeviceInfo;

    /**
     * The reason why the user is not authenticated.
     */
    reason?: LoginErrorReason;
}

export interface AuthorizationMessage {
    type: 'authorization';

    authorized: boolean;
    reason?: LoginErrorReason;
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
