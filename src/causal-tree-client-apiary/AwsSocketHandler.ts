import { fromByteArray, toByteArray } from 'base64-js';
import {
    decode,
    encode,
    getCurrentSequenceNumber,
    getStartSequenceNumber,
    isFinalMessage,
    isPartialMessage,
} from './BinaryEncoder';
import { sortBy } from 'lodash';

export const BASE_64_OVERHEAD = 1 / 3;

/**
 * Defines a class that is able to decode websocket message events that use the binary encoder format as they arrive.
 */
export class AwsSocketHandler {
    private _maxMessageSize: number;
    private _packets: {
        startSequenceNumber: number;
        currentSequenceNumber: number;
        data: Uint8Array;
    }[] = [];

    constructor(maxMessageSize: number) {
        this._maxMessageSize = Math.floor(
            maxMessageSize - maxMessageSize * BASE_64_OVERHEAD
        );
    }

    /**
     * Encodes the given string data into a format that is suitable to send over the wire to AWS.
     * @param data The data to send.
     */
    encode(data: string, startSequenceNumber: number): string[] {
        const encoded = encode(data, this._maxMessageSize, startSequenceNumber);

        if (Array.isArray(encoded)) {
            let messages = [] as string[];
            for (let message of encoded) {
                const final = fromByteArray(message);
                messages.push(final);
            }

            return messages;
        } else {
            const final = fromByteArray(encoded);
            return [final];
        }
    }

    /**
     * Handles the given message event and returns the message event that should be propagated onwards.
     * Returns null if the event was a partial message and should not be propagated.
     * @param event The event to handle.
     */
    handleMessage(event: WebSocketMessage): WebSocketMessage {
        let data: Uint8Array;
        try {
            data = toByteArray(event.data);
        } catch (ex) {
            // Not base64 data so we can handle the message immediately
            return event;
        }

        if (isPartialMessage(data)) {
            const view = new DataView(
                data.buffer,
                data.byteOffset,
                data.byteLength
            );
            const packet = {
                startSequenceNumber: getStartSequenceNumber(view),
                currentSequenceNumber: getCurrentSequenceNumber(view),
                data: data,
            };
            if (isFinalMessage(view)) {
                const allMessages = [
                    ...this._packets.filter(
                        (p) =>
                            p.startSequenceNumber === packet.startSequenceNumber
                    ),
                    packet,
                ];

                const sorted = sortBy(
                    allMessages,
                    (p) => p.currentSequenceNumber
                );
                const decoded = decode(sorted.map((p) => p.data));

                event = {
                    data: decoded,
                };

                this._packets = this._packets.filter(
                    (p) => p.startSequenceNumber !== packet.startSequenceNumber
                );
                return event;
            } else {
                this._packets.push(packet);
            }
        } else {
            const decoded = decode(data);
            event = {
                data: decoded,
            };
            return event;
        }

        return null;
    }
}

export interface WebSocketMessage {
    data: any;
}
