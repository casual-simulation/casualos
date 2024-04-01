import {
    PresignFileUploadResult,
    WebsocketMessenger,
} from '@casual-simulation/aux-records';
import {
    UploadHttpHeaders,
    WebsocketEvent,
    WebsocketEventTypes,
    WebsocketMessage,
} from '@casual-simulation/aux-common';
import { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

export class WSWebsocketMessenger implements WebsocketMessenger {
    private _connections: Map<string, WebSocket> = new Map();

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
