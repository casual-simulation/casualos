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
    sendEvent(connectionId: string, event: WebsocketEvent): Promise<void>;

    /**
     * Sends the given raw data to the given connection ID.
     * @param connectionId The ID of the connection.
     * @param data The data that should be sent.
     */
    sendRaw?(connectionId: string, data: string): Promise<void>;

    /**
     * Gets a URL that messages can be uploaded to.
     * Returns null/undefined if message uploads are not supported.
     */
    getMessageUploadUrl(): Promise<string>;

    /**
     * Tries to download the message that was uploaded to the given URL.
     * Returns null if the message could not be found.
     * Returns undefined if message downloads is not supported.
     * @param url The URl that the message was uploaded to.
     */
    downloadMessage(url: string): Promise<string | null | undefined>;
}
