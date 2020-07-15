import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose } from 'comlink';
import { listenForChannel } from './MessageHelpers';
import { DenoAuxChannel } from './DenoAuxChannel';

listenForChannel().then(port => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(DenoAuxChannel, port);
});

console.log('[AuxChannel.worker] Listening for port...');
