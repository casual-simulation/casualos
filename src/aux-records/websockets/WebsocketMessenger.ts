import { WebsocketEvent, WebsocketMessage } from './WebsocketEvents';
import { ServerError, NotSupportedError } from '../Errors';

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
        data: WebsocketMessage,
        excludeConnection?: string
    ): Promise<void>;

    /**
     * Sends the given event to the given connection ID.
     * @param connectionId The ID of the connection.
     * @param event The event that should be sent.
     */
    sendEvent?(connectionId: string, event: WebsocketEvent): Promise<void>;

    /**
     * Sends the given raw data to the given connection ID.
     * @param connectionId The ID of the connection.
     * @param data The data that should be sent.
     */
    sendRaw?(connectionId: string, data: string): Promise<void>;

    /**
     * Attempts to resolve the given event into a message.
     * @param event The event.
     */
    resolveMessage(event: WebsocketEvent): Promise<ResolvedWebsocketMessage>;
}

export type ResolvedWebsocketMessage =
    | WebsocketMessageSuccess
    | WebsocketMessageFailure;

export interface WebsocketMessageSuccess {
    success: true;
    message: WebsocketMessage;
}

export interface WebsocketMessageFailure {
    success: false;
    errorCode: ServerError | NotSupportedError;
    errorMessage: string;
}
