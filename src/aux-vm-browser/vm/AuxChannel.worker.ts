import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose } from 'comlink';
import { listenForChannel } from '../html/IFrameHelpers';
import { BrowserAuxChannel } from './BrowserAuxChannel';
import { NestedWorker } from './NestedWorker';

// Use the nested worker polyfill if the worker interface is not specified.
if (!globalThis.Worker) {
    const nativePostMessage = postMessage.bind(self);
    (<any>globalThis).Worker = class extends NestedWorker {
        constructor(stringOrUrl: string | URL, options?: WorkerOptions) {
            super(nativePostMessage, stringOrUrl, options);
        }
    };
}

listenForChannel().then((port) => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(BrowserAuxChannel, port);
});

console.log('[AuxChannel.worker] Listening for port...');
