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
import { listenForChannel } from '../html/IFrameHelpers';

export function setupWorker(instance: Worker) {
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
}
