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
    UploadHttpHeaders,
    WebsocketEvent,
    WebsocketMessage,
} from '@casual-simulation/aux-common/websockets/WebsocketEvents';
import type { PresignFileUploadResult } from '../FileRecordsStore';

/**
 * Defines an interface that is capable of sending messages to connections.
 */
export interface WebsocketMessenger {
    /**
     * Sends the given data to the given connection IDs.
     * @param connectionIds The IDs of the connections.
     * @param id The ID of the request that is being sent.
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
    presignMessageUpload(): Promise<PresignFileUploadResult>;

    /**
     * Tries to download the message that was uploaded to the given URL.
     * Returns null if the message could not be found.
     * Returns undefined if message downloads is not supported.
     * @param url The URl that the message was uploaded to.
     * @param method The HTTP method that should be used to download the message. Might be ignored if the messenger recognizes the URL.
     * @param headers The headers that should be used to download the message. Might be ignored if the messenger recognizes the URL.
     */
    downloadMessage(
        url: string,
        method: string,
        headers: UploadHttpHeaders
    ): Promise<string | null | undefined>;

    /**
     * Disconnects the given connection.
     * @param connectionId The ID of the connection.
     */
    disconnect(connectionId: string): Promise<void>;
}
