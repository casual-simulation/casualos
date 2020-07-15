import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose, Endpoint } from 'comlink';
import { DenoAuxChannel } from './DenoAuxChannel';
import { MessageChannelImpl } from './MessageChannel';

const port = parseInt(Deno.args[0]);

console.log('[DenoEntry] Listening on port', port);

init();

async function init() {
    const channel = await tcpMessageChannel();

    console.log('[DenoEntry] Listening for messages...');
    expose(DenoAuxChannel, <any>channel.port2);

    channel.port2.postMessage({
        type: 'init',
    });
}

async function tcpMessageChannel() {
    // @ts-ignore
    const channel = new MessageChannelImpl();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const conn = await Deno.connect({ port: port });

    // @ts-ignore
    channel.port1.addEventListener('message', e => {
        console.log('[DenoEntry] Sending Message');
        const json = JSON.stringify(e.data);

        // Messages to stdout all follow the same format:
        // 4 bytes (32-bit number) for the length of the message
        // N bytes for the message JSON as UTF-8
        // - According to MDN UTF-8 never has more than string.length * 3 bytes (https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encodeInto)
        // - Using a 32-bit number means we can't have messages larger than ~4GiB
        const byteBuffer = new Uint8Array(4 + json.length * 3);
        const view = new DataView(byteBuffer.buffer, byteBuffer.byteOffset);

        // Encode the JSON as UTF-8
        // Skip the first 4 bytes
        const result = encoder.encodeInto(json, byteBuffer.subarray(4));
        view.setUint32(0, result.written, true);

        console.log(`[DenoEntry] Writing ${result.written} bytes`);
        conn.write(byteBuffer.subarray(0, result.written + 4));
    });

    readMessages();

    return channel;

    async function readMessages() {
        try {
            const iter = Deno.iter(conn, {
                bufSize: 512 * 512,
            });
            let messageBuffer = new Deno.Buffer();
            let messageSize = -1;
            console.log('[DenoEntry] Reading messages...');
            for await (const chunk of iter) {
                console.log(
                    '[DenoEntry] Got Data',
                    chunk.byteLength,
                    chunk.length
                );
                messageBuffer.writeSync(chunk);
                console.log('[DenoEntry] Read data', messageBuffer.length);
                if (messageSize < 0 && messageBuffer.length >= 4) {
                    const bytes = new Uint8Array(4);
                    messageBuffer.readSync(bytes);
                    const view = new DataView(
                        bytes.buffer,
                        bytes.byteOffset,
                        4
                    );
                    messageSize = view.getUint32(0, true);
                    console.log('[DenoEntry] Got Length', messageSize);
                    messageBuffer.grow(
                        Math.max(0, messageSize - messageBuffer.capacity)
                    );
                    console.log(
                        '[DenoEntry] Buffer length',
                        messageBuffer.length
                    );
                }
                if (messageSize >= 0 && messageBuffer.length >= messageSize) {
                    const messageBytes = new Uint8Array(messageSize);
                    messageBuffer.readSync(messageBytes);
                    messageSize = -1;
                    const json = decoder.decode(messageBytes);
                    const message = JSON.parse(json);
                    console.log('[DenoEntry] Got Message');
                    channel.port1.postMessage(message);
                }
            }
        } catch (err) {
            console.error('[DenoEntry]', err);
        }
    }
}
