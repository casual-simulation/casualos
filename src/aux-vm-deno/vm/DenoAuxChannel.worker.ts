import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose } from 'comlink';
import { DenoAuxChannel } from './DenoAuxChannel';

console.log('[DenoAuxChannel.worker] Exposing API...');
expose(DenoAuxChannel, <any>self);
