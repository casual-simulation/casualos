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
    PresignFileUploadResult,
    WebsocketMessenger,
} from '@casual-simulation/aux-records';
import type {
    UploadHttpHeaders,
    WebsocketEvent,
    WebsocketMessage,
} from '@casual-simulation/aux-common';
import { WebsocketEventTypes } from '@casual-simulation/aux-common';
import type { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

export class WSWebsocketMessenger implements WebsocketMessenger {
    private _connections: Map<string, WebSocket> = new Map();

    get connections() {
        return this._connections;
    }

    registerConnection(socket: WebSocket): string {
        const id = uuid();
        this._connections.set(id, socket);
        return id;
    }

    removeConnection(connectionId: string): void {
        this._connections.delete(connectionId);
    }

    async disconnect(connectionId: string): Promise<void> {
        const con = this._connections.get(connectionId);
        if (con) {
            con.close();
        }
    }

    async sendMessage(
        connectionIds: string[],
        data: WebsocketMessage,
        excludeConnection?: string
    ): Promise<void> {
        const event: WebsocketEvent = [WebsocketEventTypes.Message, -1, data];
        const json = JSON.stringify(event);
        for (let connectionId of connectionIds) {
            if (connectionId !== excludeConnection) {
                const socket = this._connections.get(connectionId);
                if (socket) {
                    socket.send(json);
                }
            }
        }
    }

    async sendEvent(
        connectionId: string,
        event: WebsocketEvent
    ): Promise<void> {
        const json = JSON.stringify(event);
        const socket = this._connections.get(connectionId);
        if (socket) {
            socket.send(json);
        }
    }

    async sendRaw(connectionId: string, data: string): Promise<void> {
        const socket = this._connections.get(connectionId);
        if (socket) {
            socket.send(data);
        }
    }

    async presignMessageUpload(): Promise<PresignFileUploadResult> {
        return {
            success: false,
            errorCode: 'not_supported',
            errorMessage: 'This method is not supported on the server.',
        };
    }

    async downloadMessage(
        url: string,
        method: string,
        headers: UploadHttpHeaders
    ): Promise<string> {
        return null;
    }
}
