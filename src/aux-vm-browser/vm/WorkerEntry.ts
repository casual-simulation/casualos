import Worker from '../vm/AuxWorker';
import { listenForChannel, setupChannel } from '../html/IFrameHelpers';

const instance = new Worker();

// Polyfill for instantiating nested web workers for Safari.
// Works by specifying the Worker interface inside the web worker and
// routing new worker messages outside to the parent which then creates
// the web worker.
const nestedWorkers = new Map();
instance.addEventListener('message', (event) => {
    const { data } = event;
    if (data?.type === 'new_worker') {
        const { id, port, url, options } = data;
        const newWorker = new globalThis.Worker(url, options);
        newWorker.postMessage(port, [port]);
        instance.onerror = console.error.bind(console);
        nestedWorkers.set(id, newWorker);
    } else if (data?.type === 'terminate_worker') {
        const { id } = data;
        if (nestedWorkers.has(id)) {
            nestedWorkers.get(id).terminate();
            nestedWorkers.delete(id);
        }
    }
});

listenForChannel().then((port) => {
    console.log('[IframeEntry] Got port, sending to worker instance.');
    instance.postMessage(
        {
            type: 'init_port',
            port: port,
        },
        [port]
    );
});

console.log('[IframeEntry] Listening for port...');
