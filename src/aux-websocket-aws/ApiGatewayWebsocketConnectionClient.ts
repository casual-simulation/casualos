import {
    Observable,
    fromEventPattern,
    BehaviorSubject,
    Subject,
    merge,
    of,
    NEVER,
} from 'rxjs';
import {
    map,
    tap,
    concatMap,
    first,
    takeUntil,
    mapTo,
    share,
    filter,
} from 'rxjs/operators';
import {
    ReconnectableSocket,
    ReconnectableSocketInterface,
} from '@casual-simulation/websocket';
import {
    ClientConnectionState,
    ConnectionClient,
    ConnectionIndicator,
    ConnectionInfo,
    WebsocketDownloadRequestEvent,
    WebsocketErrorInfo,
    WebsocketEvent,
    WebsocketEventTypes,
    WebsocketMessage,
    WebsocketMessageEvent,
    WebsocketType,
    WebsocketUploadRequestEvent,
    WebsocketUploadResponseEvent,
} from '@casual-simulation/aux-common';
import axios, { Method } from 'axios';

export const MAX_MESSAGE_SIZE = 32_000;

export class ApiGatewayWebsocketConnectionClient implements ConnectionClient {
    private _socket: ReconnectableSocketInterface;
    private _connectionStateChanged: BehaviorSubject<ClientConnectionState>;
    private _onMessage: Subject<WebsocketMessage> = new Subject();
    private _onError: Subject<WebsocketErrorInfo> = new Subject();
    private _requestCounter: number = 0;

    /**
     * A map of upload IDs to the data that should be uploaded.
     */
    private _pendingUploads = new Map<number, WebsocketMessage>();

    get info(): ConnectionInfo {
        return this._connectionStateChanged.value.info;
    }

    get indicator(): ConnectionIndicator | null {
        return null;
    }

    get onError() {
        return this._onError;
    }

    get origin() {
        return this._socket.origin;
    }

    event<T>(name: string): Observable<T> {
        return this._onMessage.pipe(
            filter((message) => message.type === name)
        ) as Observable<T>;
    }

    disconnect() {
        this._socket.close();
    }

    connect() {
        this._socket.open();
    }

    send(message: WebsocketMessage) {
        this._requestCounter++;
        let event: WebsocketEvent = [
            WebsocketEventTypes.Message,
            this._requestCounter,
            message,
        ];

        const data = JSON.stringify(event);

        // TODO: Calculate the real message size instead of just assuming that
        // each character is 1 byte
        if (data.length > MAX_MESSAGE_SIZE) {
            // Request upload
            const uploadRequest: WebsocketUploadRequestEvent = [
                WebsocketEventTypes.UploadRequest,
                this._requestCounter,
            ];

            this._pendingUploads.set(uploadRequest[1], message);

            this._socket.send(JSON.stringify(uploadRequest));
        } else {
            this._socket.send(data);
        }
    }

    constructor(socket: ReconnectableSocketInterface) {
        this._socket = socket;
        this._connectionStateChanged =
            new BehaviorSubject<ClientConnectionState>({
                connected: false,
                info: null,
            });

        const connected = this._socket.onOpen.pipe(
            tap(() =>
                console.log('[ApiGatewayWebsocketConnectionClient] Connected.')
            ),
            map(() => ({
                connected: true,
                info: null,
            }))
        );
        const disconnected = this._socket.onClose.pipe(
            tap((reason) =>
                console.log(
                    '[ApiGatewayWebsocketConnectionClient] Disconnected. Reason:',
                    reason
                )
            ),
            map(() => ({
                connected: false,
                info: null,
            }))
        );

        merge(connected, disconnected).subscribe(this._connectionStateChanged);

        this._socket.onMessage
            .pipe(
                concatMap((e: MessageEvent<any>) => {
                    const event: WebsocketEvent =
                        typeof e.data === 'string'
                            ? JSON.parse(e.data)
                            : e.data;

                    if (!Array.isArray(event)) {
                        console.error(
                            '[ApiGatewayWebsocketConnectionClient] Not a valid message!',
                            event
                        );
                        return NEVER;
                    }

                    if (event[0] === WebsocketEventTypes.UploadResponse) {
                        return this._handleUploadResponse(event);
                    } else if (
                        event[0] === WebsocketEventTypes.DownloadRequest
                    ) {
                        return this._handleDownloadRequest(event);
                    } else if (event[0] === WebsocketEventTypes.Message) {
                        return this._handleMessageData(event);
                    } else if (event[0] === WebsocketEventTypes.Error) {
                        console.error(
                            `[ApiGatewayWebsocketConnectionClient] Error (${event[1]}):`,
                            event[2]
                        );
                        this._onError.next(event[2]);
                    }
                })
            )
            .subscribe();
    }

    get connectionState(): Observable<ClientConnectionState> {
        return this._connectionStateChanged;
    }

    get isConnected(): boolean {
        return this._connectionStateChanged.value.connected;
    }

    private async _handleUploadResponse(message: WebsocketUploadResponseEvent) {
        try {
            const [type, id, uploadUrl, uploadMethod, uploadHeaders] = message;
            const pendingData = this._pendingUploads.get(id);
            if (pendingData) {
                this._pendingUploads.delete(id);
                await axios.request({
                    url: uploadUrl,
                    method: uploadMethod as Method,
                    data: JSON.stringify(pendingData),
                    headers: {
                        'Content-Type': 'application/json',
                        'x-amz-acl': 'bucket-owner-full-control',
                        ...uploadHeaders,
                    },
                });

                this._requestCounter++;
                const downloadRequest: WebsocketDownloadRequestEvent = [
                    WebsocketEventTypes.DownloadRequest,
                    this._requestCounter,
                    getDownloadUrl(uploadUrl),
                    'GET',
                    {},
                ];

                this._socket.send(JSON.stringify(downloadRequest));
            }
        } catch (err) {
            console.error(
                '[ApiGatewayWebsocketConnectionClient] Failed to upload message.',
                err
            );
        }
    }

    private async _handleDownloadRequest(
        message: WebsocketDownloadRequestEvent
    ) {
        try {
            const [type, id, url, method, headers] = message;
            const response = await axios.request({
                url: url,
                method: method as Method,
                headers: headers,
            });

            this._emitMessage(response.data as WebsocketMessage);
        } catch (err) {
            console.error(
                '[ApiGatewayWebsocketConnectionClient] Failed to download message.',
                err
            );
        }
    }

    private async _handleMessageData(
        message: WebsocketMessageEvent
    ): Promise<void> {
        this._emitMessage(message[2]);
    }

    private _emitMessage(data: WebsocketMessage) {
        this._onMessage.next(data);
    }
}

function getDownloadUrl(uploadUrl: string) {
    const url = new URL(uploadUrl);
    return `${url.origin}${url.pathname}`;
}
