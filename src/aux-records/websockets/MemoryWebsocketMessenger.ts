import { WebsocketEvent, WebsocketEventTypes } from './WebsocketEvents';
import {
    ResolvedWebsocketMessage,
    WebsocketMessenger,
} from './WebsocketMessenger';

export class MemoryWebsocketMessenger implements WebsocketMessenger {
    private _messages = new Map<string, any[]>();

    getMessages(connectionId: string) {
        return this._getMessages(connectionId);
    }

    reset() {
        this._messages = new Map();
    }

    async sendMessage(
        connectionIds: string[],
        data: any,
        excludeConnection?: string
    ): Promise<void> {
        for (let id of connectionIds) {
            if (id === excludeConnection) {
                continue;
            }
            const list = this._getMessages(id);
            list.push(data);
        }
    }

    async resolveMessage(
        event: WebsocketEvent
    ): Promise<ResolvedWebsocketMessage> {
        switch (event[0]) {
            case WebsocketEventTypes.Message:
                return {
                    success: true,
                    message: event[1],
                };
            case WebsocketEventTypes.UploadRequest:
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'Upload requests are not supported.',
                };
            case WebsocketEventTypes.UploadResponse:
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'Upload responses are not supported.',
                };
            case WebsocketEventTypes.DownloadRequest:
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'Download requests are not supported.',
                };
        }

        return {
            success: false,
            errorCode: 'not_supported',
            errorMessage: 'Unknown event type.',
        };
    }

    private _getMessages(connectionId: string): any[] {
        let list = this._messages.get(connectionId);
        if (!list) {
            list = [];
            this._messages.set(connectionId, list);
        }
        return list;
    }
}
