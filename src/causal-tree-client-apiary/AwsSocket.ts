import {
    ReconnectableSocket,
    ReconnectableSocketInterface,
} from './ReconnectableSocket';
import { Observable, of, Subject } from 'rxjs';
import {
    AwsDownloadRequest,
    AwsMessage,
    AwsMessageData,
    AwsMessageTypes,
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
                    if (message[0] === AwsMessageTypes.UploadResponse) {
                        return this._handleUploadResponse(message);
                    } else if (message[0] === AwsMessageTypes.DownloadRequest) {
                        return this._handleDownloadRequest(message);
                    } else if (message[0] === AwsMessageTypes.Message) {
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
            const uploadRequest: AwsUploadRequest = [
                AwsMessageTypes.UploadRequest,
                uuid(),
            ];

            this._pendingUploads.set(uploadRequest[1], data);

            this._send(uploadRequest);
        } else {
            const message: AwsMessageData = [AwsMessageTypes.Message, data];
            this._send(message);
        }
    }

    private async _handleUploadResponse(message: AwsUploadResponse) {
        try {
            const id = message[1];
            const pendingData = this._pendingUploads.get(id);
            if (pendingData) {
                this._pendingUploads.delete(id);
                const uploadUrl = message[2];
                await axios.put(uploadUrl, pendingData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-amz-acl': 'bucket-owner-full-control',
                    },
                });

                const downloadRequest: AwsDownloadRequest = [
                    AwsMessageTypes.DownloadRequest,
                    getDownloadUrl(uploadUrl),
                ];

                this._send(downloadRequest);
            }
        } catch (err) {
            console.error('[AwsSocket] Failed to upload message.', err);
        }
    }

    private async _handleDownloadRequest(message: AwsDownloadRequest) {
        try {
            const url = message[1];
            const response = await axios.get(url);
            this._emitMessage(response.data);
        } catch (err) {
            console.error('[AwsSocket] Failed to download message.', err);
        }
    }

    private _handleMessageData(message: AwsMessageData): any {
        this._emitMessage(message[1]);
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
