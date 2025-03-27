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
import { wrap, proxy } from 'comlink';
import type { AuxStatic } from '@casual-simulation/aux-vm/vm';
import { setupChannel } from '../html/IFrameHelpers';
import { remapProgressPercent } from '@casual-simulation/aux-common';
// import Worker from './AuxWorker';
import Worker from './AuxChannel.worker?worker&inline';
import AuxVMImpl, { processPartitions } from './AuxVMImpl';

export const DEFAULT_IFRAME_ALLOW_ATTRIBUTE =
    'accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking';
export const DEFAULT_IFRAME_SANDBOX_ATTRIBUTE =
    'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 *
 * This implementation works similarly to the one in AuxVMImpl, but instead of using an iframe, it loads the web worker directly.
 */
export default class StaticAuxVMImpl extends AuxVMImpl {
    private _worker: Worker;

    protected async _init(): Promise<void> {
        // let origin = getVMOrigin(
        //     this._config.config.vmOrigin,
        //     location.origin,
        //     this._id
        // );
        // if (this._relaxOrigin) {
        //     const baseOrigin = getBaseOrigin(origin);
        //     console.log('[AuxVMImpl] Relaxing origin to:', baseOrigin);
        //     origin = baseOrigin;
        // }
        // const iframeUrl = new URL('/aux-vm-iframe.html', origin).href;

        // this._connectionStateChanged.next({
        //     type: 'progress',
        //     message: 'Getting web manifest...',
        //     progress: 0.05,
        // });

        // this._connectionStateChanged.next({
        //     type: 'progress',
        //     message: 'Initializing web worker...',
        //     progress: 0.1,
        // });
        // this._iframe = document.createElement('iframe');
        // this._iframe.src = iframeUrl;
        // this._iframe.style.display = 'none';
        // this._iframe.setAttribute('allow', DEFAULT_IFRAME_ALLOW_ATTRIBUTE);
        // this._iframe.setAttribute('sandbox', DEFAULT_IFRAME_SANDBOX_ATTRIBUTE);

        // let promise = waitForLoad(this._iframe);
        // document.body.insertBefore(this._iframe, document.body.firstChild);

        // await promise;

        // this._channel = setupChannel(this._iframe.contentWindow);

        // this._connectionStateChanged.next({
        //     type: 'progress',
        //     message: 'Creating VM...',
        //     progress: 0.2,
        // });
        // const wrapper = wrap<AuxStatic>(this._channel.port1);
        // this._proxy = await new wrapper(
        //     location.origin,
        //     processPartitions(this._config)
        // );

        // let statusMapper = remapProgressPercent(0.2, 1);
        // return await this._proxy.init(
        //     proxy((events) => this._localEvents.next(events)),
        //     proxy((events) => this._deviceEvents.next(events)),
        //     proxy((state) => this._stateUpdated.next(state)),
        //     proxy((version) => this._versionUpdated.next(version)),
        //     proxy((state) =>
        //         this._connectionStateChanged.next(statusMapper(state))
        //     ),
        //     proxy((err) => this._onError.next(err)),
        //     proxy((channel) => this._handleAddedSubChannel(channel)),
        //     proxy((id) => this._handleRemovedSubChannel(id)),
        //     proxy((message) => this._onAuthMessage.next(message))
        // );

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });
        this._worker = new Worker();
        this._channel = setupChannel(this._worker);

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });
        const wrapper = wrap<AuxStatic>(this._channel.port1);
        this._proxy = await new wrapper(
            location.origin,
            processPartitions(this._config)
        );

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.init(
            proxy((events) => this._localEvents.next(events)),
            proxy((events) => this._deviceEvents.next(events)),
            proxy((state) => this._stateUpdated.next(state)),
            proxy((version) => this._versionUpdated.next(version)),
            proxy((state) =>
                this._connectionStateChanged.next(statusMapper(state))
            ),
            proxy((err) => this._onError.next(err)),
            proxy((channel) => this._handleAddedSubChannel(channel)),
            proxy((id) => this._handleRemovedSubChannel(id)),
            proxy((message) => this._onAuthMessage.next(message))
        );
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        if (this._worker) {
            const worker = this._worker;
            this._worker = null;
            worker.terminate();
        }
        super.unsubscribe();
    }
}
