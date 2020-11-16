import { ReconnectableSocket } from './ReconnectableSocket';
import { AwsSocketHandler } from './AwsSocketHandler';

export const MAX_MESSAGE_SIZE = 128_000;

/**
 * Defines a reconnectable WebSocket that implements specializations for AWS API Gateway.
 * In particular, this means converting binary data to base64 and splitting messages into chunks of 128KB.
 */
export class AwsSocket extends ReconnectableSocket {
    private _sequenceNum = 0;
    private _decoder: AwsSocketHandler = new AwsSocketHandler(MAX_MESSAGE_SIZE);

    send(data: string) {
        const messages = this._decoder.encode(data, this._sequenceNum);
        this._sequenceNum += messages.length;
        for (let message of messages) {
            super.send(message);
        }
    }

    protected _handleMessage(event: MessageEvent) {
        const result = this._decoder.handleMessage(event);
        if (result) {
            super._handleMessage(
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
