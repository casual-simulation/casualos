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

// Copied from https://github.com/microsoft/vscode/blob/42cdda5ab0f45bf472204d3d1175dcd581492dd5/src/vs/workbench/services/extensions/worker/polyfillNestedWorker.ts

import type {
    NewWorkerMessage,
    TerminateWorkerMessage,
} from './NestedWorkerEvents';

declare function postMessage(data: any, transferables?: Transferable[]): void;
declare function importScripts(url: string): Promise<void>;

declare type MessageEventHandler = ((ev: MessageEvent<any>) => any) | null;

const _bootstrapFnSource = function _bootstrapFn(workerUrl: string) {
    const listener: EventListener = (event: Event): void => {
        // uninstall handler
        self.removeEventListener('message', listener);

        // get data
        const port = <MessagePort>(<MessageEvent>event).data;

        // postMessage
        // onmessage
        Object.defineProperties(self, {
            postMessage: {
                value(data: any, transferOrOptions?: any) {
                    port.postMessage(data, transferOrOptions);
                },
            },
            onmessage: {
                get() {
                    return port.onmessage;
                },
                set(value: MessageEventHandler) {
                    port.onmessage = value;
                },
            },
            // todo onerror
        });

        port.addEventListener('message', (msg) => {
            self.dispatchEvent(new MessageEvent('message', { data: msg.data }));
        });

        port.start();

        // fake recursively nested worker
        self.Worker = <any>class {
            constructor() {
                throw new TypeError(
                    'Nested workers from within nested worker are not supported.'
                );
            }
        };

        // load module
        importScripts(workerUrl);
    };

    self.addEventListener('message', listener);
}.toString();

export class NestedWorker extends EventTarget implements Worker {
    onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null = null;
    onmessageerror: ((this: Worker, ev: MessageEvent<any>) => any) | null =
        null;
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;

    readonly terminate: () => void;
    readonly postMessage: (message: any, options?: any) => void;

    constructor(
        nativePostMessage: typeof postMessage,
        stringOrUrl: string | URL,
        options?: WorkerOptions
    ) {
        super();

        // create bootstrap script
        const bootstrap = `((${_bootstrapFnSource})('${stringOrUrl}'))`;
        const blob = new Blob([bootstrap], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        const channel = new MessageChannel();
        const id = blobUrl; // works because blob url is unique, needs ID pool otherwise

        const msg: NewWorkerMessage = {
            type: 'new_worker',
            id,
            port: channel.port2,
            url: blobUrl,
            options,
        };
        nativePostMessage(msg, [channel.port2]);

        // worker-impl: functions
        this.postMessage = channel.port1.postMessage.bind(channel.port1);
        this.terminate = () => {
            const msg: TerminateWorkerMessage = {
                type: 'terminate_worker',
                id,
            };
            channel.port1.postMessage(msg);
            URL.revokeObjectURL(blobUrl);

            channel.port1.close();
            channel.port2.close();
        };

        // worker-impl: events
        Object.defineProperties(this, {
            onmessage: {
                get() {
                    return channel.port1.onmessage;
                },
                set(value: MessageEventHandler) {
                    channel.port1.onmessage = value;
                },
            },
            onmessageerror: {
                get() {
                    return channel.port1.onmessageerror;
                },
                set(value: MessageEventHandler) {
                    channel.port1.onmessageerror = value;
                },
            },
            // todo onerror
        });

        channel.port1.addEventListener('messageerror', (evt) => {
            const msgEvent = new MessageEvent('messageerror', {
                data: evt.data,
            });
            this.dispatchEvent(msgEvent);
        });

        channel.port1.addEventListener('message', (evt) => {
            const msgEvent = new MessageEvent('message', { data: evt.data });
            this.dispatchEvent(msgEvent);
        });

        channel.port1.start();
    }
}
