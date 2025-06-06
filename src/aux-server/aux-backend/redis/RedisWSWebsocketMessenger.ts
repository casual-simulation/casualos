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
import type { RedisClientType } from 'redis';
import type { WSWebsocketMessenger } from '../ws/WSWebsocketMessenger';

/**
 * Implements a WebsocketMessenger that uses Redis pub/sub to support multiple servers.
 */
export class RedisWSWebsocketMessenger implements WebsocketMessenger {
    private _messenger: WSWebsocketMessenger;
    private _subscriber: RedisClientType;
    private _publisher: RedisClientType;
    private _namespace: string;

    get connections() {
        return this._messenger.connections;
    }

    constructor(
        messenger: WSWebsocketMessenger,
        subscriber: RedisClientType,
        publisher: RedisClientType,
        namespace: string
    ) {
        this._messenger = messenger;
        this._subscriber = subscriber;
        this._publisher = publisher;
        this._namespace = namespace;
    }

    private _pubSubKey(connectionId: string): string {
        return `${this._namespace}/${connectionId}`;
    }

    registerConnection(socket: WebSocket): string {
        const id = this._messenger.registerConnection(socket);

        const key = this._pubSubKey(id);
        this._subscriber?.subscribe(key, (message: string) => {
            const socket = this.connections.get(id);
            if (!socket) {
                console.warn(
                    `[WSWebsocketMessenger] Connection ${id} not found.`
                );
                this._subscriber.unsubscribe(key);
                return;
            }
            if (message === 'close') {
                console.log(`Connection ${id} closed.`);
                socket.close();
                this._subscriber.unsubscribe(key);
            } else if (message.startsWith('msg:')) {
                const data = message.substring(4);
                socket.send(data);
            }
        });

        return id;
    }

    removeConnection(connectionId: string): void {
        this._messenger.removeConnection(connectionId);
        this._subscriber?.unsubscribe(this._pubSubKey(connectionId));
    }

    async disconnect(connectionId: string): Promise<void> {
        const con = this.connections.get(connectionId);
        if (con) {
            con.close();
        } else if (this._subscriber) {
            await this._subscriber.publish(
                this._pubSubKey(connectionId),
                'close'
            );
        } else {
            console.warn(
                `[WSWebsocketMessenger] Connection ${connectionId} not found.`
            );
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
                this._sendToConnection(connectionId, json);
            }
        }
    }

    async sendEvent(
        connectionId: string,
        event: WebsocketEvent
    ): Promise<void> {
        const json = JSON.stringify(event);
        this._sendToConnection(connectionId, json);
    }

    async sendRaw(connectionId: string, data: string): Promise<void> {
        this._sendToConnection(connectionId, data);
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

    private _sendToConnection(connectionId: string, data: string) {
        const socket = this.connections.get(connectionId);
        if (socket) {
            socket.send(data);
        } else if (this._publisher) {
            this._publisher.publish(
                this._pubSubKey(connectionId),
                `msg:${data}`
            );
        } else {
            console.warn(
                `[WSWebsocketMessenger] Connection ${connectionId} not found.`
            );
        }
    }
}
