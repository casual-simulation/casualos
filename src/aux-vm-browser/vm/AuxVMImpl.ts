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
import type {
    BotAction,
    StateUpdatedEvent,
    StoredAux,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';
import { ProxyBridgePartitionImpl } from '@casual-simulation/aux-common';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { Remote } from 'comlink';
import { wrap, proxy, expose, transfer, createEndpoint } from 'comlink';
import type {
    AuxConfig,
    AuxVM,
    ChannelActionResult,
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
} from '@casual-simulation/aux-vm/vm';
import type { SimulationOrigin } from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import type { StatusUpdate, DeviceAction } from '@casual-simulation/aux-common';
import { remapProgressPercent } from '@casual-simulation/aux-common';
import type { AuxSubChannel, AuxSubVM } from '@casual-simulation/aux-vm/vm';
import { RemoteAuxVM } from '@casual-simulation/aux-vm-client/vm/RemoteAuxVM';
import type {
    AuxDevice,
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import { getBaseOrigin, getVMOrigin } from './AuxVMUtils';

export const DEFAULT_IFRAME_ALLOW_ATTRIBUTE =
    'accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking';
export const DEFAULT_IFRAME_SANDBOX_ATTRIBUTE =
    'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export default class AuxVMImpl implements AuxVM {
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
            channel: Remote<AuxChannel>;
        }
    >;
    protected _onAuthMessage: Subject<PartitionAuthMessage>;
    private _batchPending: boolean = false;
    private _autoBatch: boolean = true;
    private _batchedEvents: BotAction[] = [];

    protected _config: AuxConfig;
    protected _iframe: HTMLIFrameElement;
    protected _channel: MessageChannel;
    protected _proxy: Remote<AuxChannel>;
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
        this._batchedEvents = [];
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
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        return await this._init();
    }

    protected async _init(): Promise<void> {
        let origin = getVMOrigin(
            this._config.config.vmOrigin,
            location.origin,
            this._id
        );

        let enableDom = this._config.config.enableDom;
        if (
            enableDom &&
            getBaseOrigin(location.origin) === getBaseOrigin(origin) &&
            !this._config.config.debug
        ) {
            console.error(
                `[AuxVMImpl] Cannot use DOM when base origin is the same as the VM origin. ${origin} should not share the same base domain as ${location.origin}.`
            );
            console.error('[AuxVMImpl] Using WebWorker isolated VM.');
            console.error(
                '[AuxVMImpl] To use DOM, enable debug mode or use a separate VM origin.'
            );
            enableDom = false;
        }

        if (this._relaxOrigin) {
            const baseOrigin = getBaseOrigin(origin);
            console.log('[AuxVMImpl] Relaxing origin to:', baseOrigin);
            origin = baseOrigin;
        }
        console.log('origin', origin);
        const iframeUrl = new URL(
            enableDom ? '/aux-vm-iframe-dom.html' : '/aux-vm-iframe.html',
            origin
        ).href;

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Getting web manifest...',
            progress: 0.05,
        });

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });
        this._iframe = document.createElement('iframe');
        this._iframe.src = iframeUrl;
        if (!enableDom) {
            this._iframe.style.display = 'none';
        }
        this._iframe.style.position = 'absolute';
        this._iframe.style.height = '100%';
        this._iframe.style.width = '100%';
        this._iframe.setAttribute('allow', DEFAULT_IFRAME_ALLOW_ATTRIBUTE);
        this._iframe.setAttribute('sandbox', DEFAULT_IFRAME_SANDBOX_ATTRIBUTE);

        let promise = waitForLoad(this._iframe);
        const iframeContainer = document.querySelector('.vm-iframe-container');
        if (iframeContainer) {
            iframeContainer.appendChild(this._iframe);
        } else {
            document.body.insertBefore(this._iframe, document.body.firstChild);
        }

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

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
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._proxy) return null;
        this._batchOrSendEvents(events);
    }

    private _batchOrSendEvents(events: BotAction[]) {
        if (this._autoBatch) {
            for (let event of events) {
                this._batchedEvents.push(event);
            }
            this._scheduleBatch();
        } else {
            this._sendEventsToProxy(events);
        }
    }

    private _scheduleBatch() {
        if (!this._batchPending && this._batchedEvents.length > 0) {
            this._batchPending = true;
            queueMicrotask(() => {
                this._processBatch();
            });
        }
    }

    private _processBatch() {
        this._batchPending = false;
        let events = this._batchedEvents;
        this._batchedEvents = [];
        this._sendEventsToProxy(events);
    }

    private _sendEventsToProxy(events: BotAction[]) {
        if (events && events.length) {
            const transferables: Transferable[] = [];
            for (let event of events) {
                if (event.type === 'async_result') {
                    if (event.result instanceof OffscreenCanvas) {
                        console.log(
                            `[AuxVMImpl] marked OffscreenCanvas as transferable in AsyncResultAction`,
                            event
                        );
                        transferables.push(event.result);
                    }
                }
            }

            if (transferables.length > 0) {
                console.log(
                    `[AuxVMImpl] sendEvents marking transferables from events`,
                    events,
                    transferables
                );
                events = transfer(events, transferables);
            }
        }
        this._proxy.sendEvents(events);
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
        if (!this._proxy) return null;
        return await this._proxy.shout(eventName, botIds, arg);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.formulaBatch(formulas);
    }

    async forkAux(newId: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.forkAux(newId);
    }

    async exportBots(botIds: string[]): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    async export(): Promise<StoredAux> {
        if (!this._proxy) return null;
        return await this._proxy.export();
    }

    async getTags(): Promise<string[]> {
        if (!this._proxy) return null;
        return await this._proxy.getTags();
    }

    async updateDevice(device: AuxDevice): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.updateDevice(device);
    }

    /**
     * Gets a new endpoint for the aux channel.
     * Can then be used with a ConnectableAuxVM.
     */
    createEndpoint(): Promise<MessagePort> {
        return this._proxy[createEndpoint]();
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._proxy.sendAuthMessage(message);
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._channel = null;
        this._proxy = null;
        if (this._iframe) {
            if (this._iframe.parentNode) {
                this._iframe.parentNode.removeChild(this._iframe);
            }
            this._iframe = null;
        }
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: Remote<AuxChannel>
    ): AuxVM {
        return new RemoteAuxVM(id, origin, configBotId, channel);
    }

    protected async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as Remote<AuxChannel>;

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

export function processPartitions(config: AuxConfig): AuxConfig {
    let transferrables = [] as any[];
    for (let key in config.partitions) {
        const partition = config.partitions[key];
        if (!partition) {
            delete config.partitions[key];
        } else if (partition.type === 'proxy') {
            const bridge = new ProxyBridgePartitionImpl(partition.partition);
            const channel = new MessageChannel();
            expose(bridge, channel.port1);
            transferrables.push(channel.port2);
            config.partitions[key] = {
                type: 'proxy_client',
                editStrategy: partition.partition.realtimeStrategy,
                private: partition.partition.private,
                port: channel.port2,
            };
        }
    }
    return transfer(config, transferrables);
}
