import Worker from '../vm/AuxWorker';
import { listenForChannel, setupChannel } from './IFrameHelpers';

const instance = new Worker();

listenForChannel().then(port => {
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
