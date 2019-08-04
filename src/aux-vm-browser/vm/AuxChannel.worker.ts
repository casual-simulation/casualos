import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose } from 'comlink';
import { listenForChannel } from '../html/IFrameHelpers';
import { BrowserAuxChannel } from './BrowserAuxChannel';

listenForChannel().then(port => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(BrowserAuxChannel, port);
});

console.log('[AuxChannel.worker] Listening for port...');
