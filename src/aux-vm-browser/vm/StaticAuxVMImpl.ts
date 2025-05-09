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
// import { wrap, proxy } from 'comlink';
import type {
    AuxChannel,
    AuxChannelErrorType,
    AuxConfig,
    AuxSubChannel,
    AuxSubVM,
    AuxVM,
    ChannelActionResult,
} from '@casual-simulation/aux-vm/vm';
// import { setupChannel } from '../html/IFrameHelpers';
import type {
    BotAction,
    DeviceAction,
    PartitionAuthMessage,
    StateUpdatedEvent,
    StatusUpdate,
    StoredAux,
} from '@casual-simulation/aux-common';
import { remapProgressPercent } from '@casual-simulation/aux-common';
// import Worker from './AuxWorker';
// import Worker from './AuxChannel.worker?worker&inline';
import { BrowserAuxChannel } from './BrowserAuxChannel';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type {
    AuxDevice,
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';

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
export default class StaticAuxVMImpl implements AuxVM {
    // private _worker: Worker;

    protected _localEvents: Subject<RuntimeActions[]>;
    protected _deviceEvents: Subject<DeviceAction[]>;
    protected _connectionStateChanged: Subject<StatusUpdate>;
    protected _stateUpdated: Subject<StateUpdatedEvent>;
    protected _versionUpdated: Subject<RuntimeStateVersion>;
    protected _onError: Subject<AuxChannelErrorType>;
    protected _subVMAdded: Subject<AuxSubVM>;
    protected _subVMRemoved: Subject<AuxSubVM>;
    protected _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: AuxChannel;
        }
    >;
    protected _onAuthMessage: Subject<PartitionAuthMessage>;
    protected _config: AuxConfig;
    protected _channel: AuxChannel;
    protected _id: string;
    protected _relaxOrigin: boolean;
    protected _origin: SimulationOrigin;

    closed: boolean;

    /**
     * The ID of the simulation.
     */
    get id(): string {
        return this._id;
    }

    get configBotId(): string {
        return this._config.configBotId;
    }

    /**
     * Creates a new Simulation VM.
     * @param id The ID of the simulation.
     * @param origin The origin of the simulation.
     * @param config The config that should be used.
     * @param relaxOrigin Whether to relax the origin of the VM.
     */
    constructor(
        id: string,
        origin: SimulationOrigin,
        config: AuxConfig,
        relaxOrigin: boolean = false
    ) {
        this._id = id;
        this._origin = origin;
        this._config = config;
        this._relaxOrigin = relaxOrigin;
        this._localEvents = new Subject<RuntimeActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
        this._onAuthMessage = new Subject();
    }

    get origin(): SimulationOrigin {
        return this._origin;
    }

    get subVMAdded(): Observable<AuxSubVM> {
        return this._subVMAdded;
    }

    get subVMRemoved(): Observable<AuxSubVM> {
        return this._subVMRemoved;
    }

    get connectionStateChanged(): Observable<StatusUpdate> {
        return this._connectionStateChanged;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._onError;
    }

    get onAuthMessage(): Observable<PartitionAuthMessage> {
        return this._onAuthMessage;
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<RuntimeActions[]> {
        return this._localEvents;
    }

    get deviceEvents(): Observable<DeviceAction[]> {
        return this._deviceEvents;
    }

    /**
     * The observable list of bot state updates from this simulation.
     */
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    get versionUpdated(): Observable<RuntimeStateVersion> {
        return this._versionUpdated;
    }

    /**
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        return await this._init();
    }

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
        // this._worker = new Worker();
        // this._channel = setupChannel(this._worker);

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });
        // const wrapper = wrap<AuxStatic>(this._channel.port1);
        if (!this._channel) {
            this._channel = new BrowserAuxChannel(
                location.origin,
                this._config
            );
        }
        // this._proxy = await new wrapper(
        //     location.origin,
        //     processPartitions(this._config)
        // );

        return await this._connect();
    }

    private async _connect() {
        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._channel.init(
            (events) => this._localEvents.next(events),
            (events) => this._deviceEvents.next(events),
            (state) => this._stateUpdated.next(state),
            (version) => this._versionUpdated.next(version),
            (state) => this._connectionStateChanged.next(statusMapper(state)),
            (err) => this._onError.next(err),
            (channel) => this._handleAddedSubChannel(channel),
            (id) => this._handleRemovedSubChannel(id),
            (message) => this._onAuthMessage.next(message)
        );
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._channel) return null;
        // if (events && events.length) {
        //     const transferables: Transferable[] = [];
        //     for (let event of events) {
        //         if (event.type === 'async_result') {
        //             if (event.result instanceof OffscreenCanvas) {
        //                 console.log(
        //                     `[AuxVMImpl] marked OffscreenCanvas as transferable in AsyncResultAction`,
        //                     event
        //                 );
        //                 transferables.push(event.result);
        //             }
        //         }
        //     }

        //     if (transferables.length > 0) {
        //         console.log(
        //             `[AuxVMImpl] sendEvents marking transferables from events`,
        //             events,
        //             transferables
        //         );
        //         events = transfer(events, transferables);
        //     }
        // }

        return await this._channel.sendEvents(events);
    }

    /**
     * Executes a shout with the given event name on the given bot IDs with the given argument.
     * Also dispatches any actions and errors that occur.
     * Returns the results from the event.
     * @param eventName The name of the event.
     * @param botIds The IDs of the bots that the shout is being sent to.
     * @param arg The argument to include in the shout.
     */
    async shout(
        eventName: string,
        botIds?: string[],
        arg?: any
    ): Promise<ChannelActionResult> {
        if (!this._channel) return null;
        return await this._channel.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        if (!this._channel) return null;
        return await this._channel.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        if (!this._channel) return null;
        return await this._channel.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        if (!this._channel) return null;
        return await this._channel.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        if (!this._channel) return null;
        return await this._channel.export();
    }

    async getTags(): Promise<string[]> {
        if (!this._channel) return null;
        return await this._channel.getTags();
    }

    async updateDevice(device: AuxDevice): Promise<void> {
        if (!this._channel) return null;
        return await this._channel.updateDevice(device);
    }

    /**
     * Gets a new endpoint for the aux channel.
     * Can then be used with a ConnectableAuxVM.
     */
    createEndpoint(): Promise<MessagePort> {
        return null;
        // return this._channel[createEndpoint]();
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._channel.sendAuthMessage(message);
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this._channel) {
            this._channel.unsubscribe();
            this._channel = null;
        }
        // this._proxy = null;
        // if (this._iframe) {
        //     if (this._iframe.parentNode) {
        //         this._iframe.parentNode.removeChild(this._iframe);
        //     }
        //     this._iframe = null;
        // }
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: AuxChannel
    ): AuxVM {
        const vm = new StaticAuxVMImpl(id, origin, {
            ...this._config,
            configBotId,
        });
        vm._channel = channel;
        return vm;
        // return null;
        // return new RemoteAuxVM(id, origin, configBotId, channel);
    }

    protected async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as AuxChannel;

        const subVM = {
            id: id,
            vm: this._createSubVM(id, this.origin, configBotId, channel),
            channel,
        };

        this._subVMMap.set(id, subVM);
        this._subVMAdded.next(subVM);
    }

    protected async _handleRemovedSubChannel(channelId: string) {
        const vm = this._subVMMap.get(channelId);
        if (vm) {
            this._subVMMap.delete(channelId);
            this._subVMRemoved.next(vm);
        }
    }
}
