import {
    ReconnectableSocket,
    ReconnectableSocketInterface,
} from './ReconnectableSocket';
import { AwsSocketHandler } from './AwsSocketHandler';
import { Observable, Subject } from 'rxjs';

export const MAX_MESSAGE_SIZE = 128_000;

/**
 * Defines a reconnectable WebSocket that implements specializations for AWS API Gateway.
 * In particular, this means converting binary data to base64 and splitting messages into chunks of 128KB.
 */
export class AwsSocket implements ReconnectableSocketInterface {
    private _sequenceNum = 0;
    private _decoder: AwsSocketHandler = new AwsSocketHandler(MAX_MESSAGE_SIZE);
    private _socket: ReconnectableSocketInterface;
    private _onMessage = new Subject<MessageEvent>();

    constructor(socket: ReconnectableSocketInterface) {
        this._socket = socket;

        this._socket.onMessage.subscribe((message) =>
            this._handleMessage(message)
        );
    }

    get onOpen(): Observable<void> {
        return this._socket.onOpen;
    }
    get onClose(): Observable<void> {
        return this._socket.onClose;
    }
    get onMessage(): Observable<MessageEvent> {
        return this._onMessage;
    }
    get onError(): Observable<Event> {
        return this._socket.onError;
    }
    open(): void {
        return this._socket.open();
    }
    close(): void {
        return this._socket.close();
    }

    send(data: string) {
        const messages = this._decoder.encode(data, this._sequenceNum);
        this._sequenceNum += messages.length;
        for (let message of messages) {
            this._socket.send(message);
        }
    }

    protected _handleMessage(event: MessageEvent) {
        const result = this._decoder.handleMessage(event);
        if (result) {
            this._onMessage.next(
                new MessageEvent(event.type, {
                    bubbles: event.bubbles,
                    cancelable: event.cancelable,
                    composed: event.composed,
                    lastEventId: event.lastEventId,
                    origin: event.origin,
                    source: event.source,
                    data: result.data,
                })
            );
        }
    }
}
