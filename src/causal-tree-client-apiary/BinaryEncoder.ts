// Binary Format
// this is the format that is used for binary communication between a apiary and a client.
// Other formats can be used, but the binary format is used with the AWS apiary because AWS API Gateway
// only supports WebSocket messages up to 128KB in size. The binary format described below supports
// splitting messages into multiple partial messages to get around this limitation.

import { array } from '@hapi/joi';

// message types:
// 1 = message
// 2 = partial_message

// message_type = message | data
// message_type = partial_message | start_sequence_number | current_sequence_number | total_message_count | data

// sizes:
// message_type = 1 byte
// start_sequence_number = 4 bytes
// current_sequence_number = 4 bytes
// total_message_count = 4 bytes
// data = remaining bytes

// Description:
// message_type is a 1 byte unsigned number that describes what type of message this frame contains. It can have two possible values:
// 1 for a normal message, and 2 for a partial message.
//
// start_sequence_number is a 4 byte unsigned number that specifies the sequence number that a chain of partial messages started with.
// current_sequence_number is a 4 byte unsigned number that specifies the sequence number that a partial message is for.
// total_message_count is a 4 byte unsigned number that specifies the total number of partial messages in a chain.
// data is the data contained by the message

export const MESSAGE_OVERHEAD = 1;
export const PARTIAL_MESSAGE_OVERHEAD = MESSAGE_OVERHEAD + 4 + 4 + 4;

export const MESSAGE_TYPE_MESSAGE = 1;
export const MESSAGE_TYPE_PARTIAL_MESSAGE = 2;

/**
 * Encodes the given string data into a binary message or set of binary messages.
 * See the binary format above for more information.
 *
 * @param data The data that should be encoded.
 * @param maxMessageLength The maximum length of the encoded messages.
 */
export function encode(
    data: string,
    maxMessageLength?: number,
    startSequenceNumber: number = 0
): Uint8Array | Uint8Array[] {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    if (
        typeof maxMessageLength === 'number' &&
        encoded.length + 1 > maxMessageLength
    ) {
        if (maxMessageLength <= PARTIAL_MESSAGE_OVERHEAD) {
            throw new Error(
                'Unable to encode messages because the requested max message length is less than the overhead of partial messages.'
            );
        }

        let dataBytesPerMessage = maxMessageLength - PARTIAL_MESSAGE_OVERHEAD;
        let totalMessageCount = Math.ceil(
            encoded.byteLength / dataBytesPerMessage
        );
        let messages = [] as Uint8Array[];

        for (
            let b = 0, i = 0;
            b < encoded.byteLength;
            b += dataBytesPerMessage, i++
        ) {
            const remainingBytes = encoded.byteLength - b;
            const messageLength = Math.min(dataBytesPerMessage, remainingBytes);
            const message = new Uint8Array(
                messageLength + PARTIAL_MESSAGE_OVERHEAD
            );
            const header = new DataView(
                message.buffer,
                message.byteOffset,
                message.byteLength
            );

            header.setUint8(0, MESSAGE_TYPE_PARTIAL_MESSAGE); // message_type
            header.setUint32(1, startSequenceNumber); // start_sequence_number
            header.setUint32(1 + 4, i); // current_sequence_number
            header.setUint32(1 + 4 + 4, totalMessageCount); // total_message_count
            message.set(
                encoded.slice(b, b + messageLength),
                PARTIAL_MESSAGE_OVERHEAD
            );

            messages.push(message);
        }

        return messages;
    }

    const final = new Uint8Array(encoded.length + 1);
    final.set([MESSAGE_TYPE_MESSAGE], 0);
    final.set(encoded, 1);

    return final;
}

export function decode(data: Uint8Array | Uint8Array[]): string {
    if (Array.isArray(data)) {
        let totalLength = 0;
        let currentSequence = 0;
        let dataArrays = [] as Uint8Array[];
        for (let array of data) {
            if (array[0] !== MESSAGE_TYPE_PARTIAL_MESSAGE) {
                throw new Error(
                    'Invalid usage. Normal messages must be passed individually.'
                );
            }

            const view = new DataView(
                array.buffer,
                array.byteOffset,
                array.byteLength
            );
            const startSequenceNumber = view.getUint32(1);
            const currentSequenceNumber = view.getUint32(1 + 4);

            if (
                currentSequence !==
                currentSequenceNumber - startSequenceNumber
            ) {
                throw new Error(
                    'Invalid data. Missing a partial message with sequence number: ' +
                        (currentSequence + startSequenceNumber)
                );
            }

            let data = array.slice(PARTIAL_MESSAGE_OVERHEAD);
            totalLength += data.byteLength;
            dataArrays.push(data);

            currentSequence += 1;
        }

        let final = new Uint8Array(totalLength);
        for (let offset = 0, i = 0; i < dataArrays.length; i++) {
            const arr = dataArrays[i];
            final.set(arr, offset);
            offset += arr.byteLength;
        }

        const decoder = new TextDecoder();
        return decoder.decode(final);
    } else {
        const decoder = new TextDecoder();
        if (data[0] !== MESSAGE_TYPE_MESSAGE) {
            throw new Error(
                'Invalid usage. Partial messages must be batched and passed together as an array.'
            );
        }

        return decoder.decode(data.slice(1));
    }
}
