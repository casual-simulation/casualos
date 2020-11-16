import {
    decode,
    encode,
    isFinalMessage,
    isPartialMessage,
    MESSAGE_TYPE_MESSAGE,
    MESSAGE_TYPE_PARTIAL_MESSAGE,
    PARTIAL_MESSAGE_OVERHEAD,
} from './BinaryEncoder';

describe('BinaryEncoder', () => {
    describe('encode()', () => {
        it('should encode a string into UTF-8', () => {
            const data = 'abcdefg';

            const encoder = new TextEncoder();
            const utf8 = encoder.encode(data);

            const encoded = encode(data);

            const final = new Uint8Array(utf8.length + 1);
            final.set([MESSAGE_TYPE_MESSAGE], 0);
            final.set(utf8, 1);

            expect(encoded).toEqual(final);
        });

        it('should encode string that exceeds the given max length into several partial messages', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            const encoder = new TextEncoder();
            const utf8 = encoder.encode(data);

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);

            expect(Array.isArray(encoded)).toBe(true);

            // 26 ASCII characters = 26 bytes of UTF-8 -> 3 messages of 10 bytes each
            expect(encoded.length).toBe(3);

            const first = new Uint8Array(10 + PARTIAL_MESSAGE_OVERHEAD);
            const firstData = new DataView(
                first.buffer,
                first.byteOffset,
                first.byteLength
            );
            const second = new Uint8Array(10 + PARTIAL_MESSAGE_OVERHEAD);
            const secondData = new DataView(
                second.buffer,
                second.byteOffset,
                second.byteLength
            );
            const third = new Uint8Array(6 + PARTIAL_MESSAGE_OVERHEAD);
            const thirdData = new DataView(
                third.buffer,
                third.byteOffset,
                third.byteLength
            );

            firstData.setUint8(0, MESSAGE_TYPE_PARTIAL_MESSAGE);
            firstData.setUint32(1, 0); // start_sequence_number
            firstData.setUint32(1 + 4, 0); // current_sequence_number
            firstData.setUint32(1 + 4 + 4, 3); // total_message_count
            first.set(utf8.slice(0, 10), 1 + 4 + 4 + 4); // data

            secondData.setUint8(0, MESSAGE_TYPE_PARTIAL_MESSAGE);
            secondData.setUint32(1, 0);
            secondData.setUint32(1 + 4, 1);
            secondData.setUint32(1 + 4 + 4, 3);
            second.set(utf8.slice(10, 20), 1 + 4 + 4 + 4); // data

            thirdData.setUint8(0, MESSAGE_TYPE_PARTIAL_MESSAGE);
            thirdData.setUint32(1, 0);
            thirdData.setUint32(1 + 4, 2);
            thirdData.setUint32(1 + 4 + 4, 3);
            third.set(utf8.slice(20), 1 + 4 + 4 + 4); // data

            expect(encoded[0]).toEqual(first);
            expect(encoded[1]).toEqual(second);
            expect(encoded[2]).toEqual(third);

            expect((<Uint8Array>encoded[0]).byteLength).toBe(
                10 + PARTIAL_MESSAGE_OVERHEAD
            );
            expect((<Uint8Array>encoded[1]).byteLength).toBe(
                10 + PARTIAL_MESSAGE_OVERHEAD
            );
            expect((<Uint8Array>encoded[2]).byteLength).toBe(
                6 + PARTIAL_MESSAGE_OVERHEAD
            );
        });
    });

    describe('decode()', () => {
        it('should be able to decode a normal message into a string', () => {
            const data = 'abcdefg';

            const encoded = encode(data);
            const decoded = decode(encoded);

            expect(decoded).toEqual(data);
        });

        it('should be able to decode several partial messages into a string', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);
            const decoded = decode(encoded);

            expect(decoded).toEqual(data);
        });

        it('should throw an error when trying to decode a partial message as a full message', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);

            expect(() => {
                decode((<Uint8Array[]>encoded)[0]);
            }).toThrow();
        });

        it('should throw an error when trying to decode a normal message as a list of partial messages', () => {
            const data = 'abcdefg';

            const encoded = encode(data);
            expect(() => {
                decode([<Uint8Array>encoded]);
            }).toThrow();
        });

        it('should throw an error when trying to decode a partial messages and one is missing', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);
            const missing = (<Uint8Array[]>encoded).splice(1, 1);

            expect(() => {
                decode(missing);
            }).toThrow();
        });
    });

    describe('isPartialMessage()', () => {
        it('should return false if the message is a normal message', () => {
            const data = 'abcdefg';
            const encoded = encode(data);

            expect(isPartialMessage(<Uint8Array>encoded)).toBe(false);
        });

        it('should return true if the message is a partial message', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);

            expect(isPartialMessage((<Uint8Array[]>encoded)[0])).toBe(true);
        });
    });

    describe('isFinalMessage()', () => {
        it('should return true if the message is the last message in the sequence', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);

            const arr = (<Uint8Array[]>encoded)[2];
            const view = new DataView(
                arr.buffer,
                arr.byteOffset,
                arr.byteLength
            );

            expect(isFinalMessage(view)).toBe(true);
        });

        it('should return false if the message is not the last message in the sequence', () => {
            const data = 'abcdefghijklmnopqrstuvwxyz';

            // Encode the data into sections of 10 bytes (plus whatever the partial message overhead is)
            const encoded = encode(data, 10 + PARTIAL_MESSAGE_OVERHEAD);

            const arr1 = (<Uint8Array[]>encoded)[0];
            const view1 = new DataView(
                arr1.buffer,
                arr1.byteOffset,
                arr1.byteLength
            );

            const arr2 = (<Uint8Array[]>encoded)[1];
            const view2 = new DataView(
                arr2.buffer,
                arr2.byteOffset,
                arr2.byteLength
            );

            expect(isFinalMessage(view1)).toBe(false);
            expect(isFinalMessage(view2)).toBe(false);
        });
    });
});
