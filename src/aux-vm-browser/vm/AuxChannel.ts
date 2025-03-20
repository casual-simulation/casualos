/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import '@casual-simulation/aux-vm/globalThis-polyfill';
import { expose } from 'comlink';
import { listenForChannel } from '../html/IFrameHelpers';
import { BrowserAuxChannel } from './BrowserAuxChannel';
// import { NestedWorker } from './NestedWorker';

// // Note: This file needs to be valid JavaScript.
// // worker-loader for some reason does not run ts-loader during its child compilation.
// // (it has a .ts extension because .js files are gitignored and deleted when the clean task runs)

// // Use the nested worker polyfill if the worker interface is not specified.
// if (!globalThis.Worker) {
//     const nativePostMessage = postMessage.bind(self);
//     (<any>globalThis).Worker = class extends NestedWorker {
//         constructor(stringOrUrl: string | URL, options?: WorkerOptions) {
//             super(nativePostMessage, stringOrUrl, options);
//         }
//     };
// }

console.log('[AuxChannel] Starting with DOM...');

listenForChannel().then((port) => {
    console.log('[AuxChannel.worker] Got port, exposing API');
    expose(BrowserAuxChannel, port);
});

console.log('[AuxChannel.worker] Listening for port...');
