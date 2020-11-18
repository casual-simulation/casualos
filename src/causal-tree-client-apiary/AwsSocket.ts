import {
    ReconnectableSocket,
    ReconnectableSocketInterface,
} from './ReconnectableSocket';
import { AwsSocketHandler } from './AwsSocketHandler';
import { Observable, of, Subject } from 'rxjs';
import {
    AwsDownloadRequest,
    AwsMessage,
    AwsMessageData,
    AwsUploadRequest,
    AwsUploadResponse,
} from './AwsMessages';
import uuid from 'uuid/v4';
import { concatMap, filter, map } from 'rxjs/operators';
import axios from 'axios';

export const MAX_MESSAGE_SIZE = 128_000;

/**
 * Defines a reconnectable WebSocket that implements specializations for AWS API Gateway.
 * In particular, this means converting binary data to base64 and splitting messages into chunks of 128KB.
 */
export class AwsSocket implements ReconnectableSocketInterface {
    private _socket: ReconnectableSocketInterface;
    private _messages = new Subject<AwsMessage>();
    private _onMessage = new Subject<MessageEvent>();

    /**
     * A map of upload IDs to the data that should be uploaded.
     */
    private _pendingUploads = new Map<string, string>();

    constructor(socket: ReconnectableSocketInterface) {
        this._socket = socket;

        this._socket.onMessage.subscribe((message) =>
            this._handleSocketMessage(message)
        );

        this._messages
            .pipe(
                concatMap(async (message) => {
                    if (message.type === 'upload_response') {
                        return this._handleUploadResponse(message);
                    } else if (message.type === 'download_request') {
                        return this._handleDownloadRequest(message);
                    } else if (message.type === 'message') {
                        return this._handleMessageData(message);
                    }
                })
            )
            .subscribe();
    }

    get onOpen() {
        return this._socket.onOpen;
    }
    get onClose() {
        return this._socket.onClose;
    }
    get onMessage() {
        return this._onMessage;
    }
    get onError() {
        return this._socket.onError;
    }
    open() {
        return this._socket.open();
    }
    close() {
        return this._socket.close();
    }

    send(data: string) {
        // TODO: Calculate the real message size instead of just assuming that
        // each character is 1 byte
        if (data.length > MAX_MESSAGE_SIZE) {
            // Request upload
            const uploadRequest: AwsUploadRequest = {
                type: 'upload_request',
                id: uuid(),
            };

            this._pendingUploads.set(uploadRequest.id, data);

            this._send(uploadRequest);
        } else {
            const message: AwsMessageData = {
                type: 'message',
                data: data,
            };
            this._send(message);
        }
    }

    private async _handleUploadResponse(message: AwsUploadResponse) {
        const pendingData = this._pendingUploads.get(message.id);
        if (pendingData) {
            this._pendingUploads.delete(message.id);
            await axios.put(message.uploadUrl, pendingData, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const downloadRequest: AwsDownloadRequest = {
                type: 'download_request',
                url: getDownloadUrl(message.uploadUrl),
            };

            this._send(downloadRequest);
        }
    }

    private async _handleDownloadRequest(message: AwsDownloadRequest) {
        const response = await axios.get(message.url);
        this._emitMessage(response.data);
    }

    private _handleMessageData(message: AwsMessageData): any {
        this._emitMessage(message.data);
    }

    protected _handleSocketMessage(event: MessageEvent) {
        const message: AwsMessage = JSON.parse(event.data);
        this._messages.next(message);
    }

    private _emitMessage(data: any) {
        this._onMessage.next(
            new MessageEvent('message', {
                data: data,
            })
        );
    }

    protected _send(message: AwsMessage) {
        this._socket.send(JSON.stringify(message));
    }
}

function getDownloadUrl(uploadUrl: string) {
    const url = new URL(uploadUrl);
    return `${url.origin}${url.pathname}`;
}
