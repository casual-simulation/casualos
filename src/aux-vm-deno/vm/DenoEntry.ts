import Worker from './DenoWorker';

const instance = new Worker();

const channel = stdinOutMessageChannel();
instance.postMessage(
    {
        type: 'init_port',
        port: channel.port2,
    },
    [channel.port2]
);

console.log('[DenoEntry] Listening for messages...');

function stdinOutMessageChannel(): MessageChannel {
    const channel = new MessageChannel();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    channel.port1.addEventListener('message', e => {
        const json = JSON.stringify(e.data);

        // Messages to stdout all follow the same format:
        // 4 bytes (32-bit number) for the length of the message
        // N bytes for the message JSON as UTF-8
        // - According to MDN UTF-8 never has more than string.length * 3 bytes (https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encodeInto)
        // - Using a 32-bit number means we can't have messages larger than ~4GiB
        const byteBuffer = new Uint8Array(4 + json.length * 3);
        const intBuffer = new Uint32Array(byteBuffer.buffer);

        // Encode the JSON as UTF-8
        // Skip the first 4 bytes
        const result = encoder.encodeInto(json, byteBuffer.subarray(4));
        intBuffer[0] = result.written;

        Deno.stdout.write(byteBuffer.subarray(0, result.written));
    });

    readMessages();

    return channel;

    async function readMessages() {
        const iter = Deno.iter(Deno.stdin, {
            bufSize: 512 * 512,
        });
        let messageBuffer = new Deno.Buffer();
        let messageSize = -1;
        for await (const chunk of iter) {
            messageBuffer.readSync(chunk);
            if (messageSize < 0 && messageBuffer.length >= 4) {
                const ints = new Uint32Array(
                    messageBuffer.bytes({ copy: false })
                );
                messageSize = ints[0];
                messageBuffer.truncate(4);
                messageBuffer.grow(
                    Math.max(0, messageSize - messageBuffer.capacity)
                );
            }
            if (messageSize >= 0 && messageBuffer.length >= messageSize) {
                const messageBytes = messageBuffer
                    .bytes({ copy: false })
                    .subarray(0, messageSize);
                messageBuffer.truncate(messageSize);
                messageSize = -1;
                const json = decoder.decode(messageBytes);
                const message = JSON.parse(json);
                channel.port1.postMessage(message);
            }
        }
    }
}
