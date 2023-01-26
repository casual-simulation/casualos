import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    ProxyBridgePartitionImpl,
    RuntimeStateVersion,
    StoredAux,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote, expose, transfer, createEndpoint } from 'comlink';
import {
    AuxConfig,
    AuxVM,
    AuxUser,
    ChannelActionResult,
} from '@casual-simulation/aux-vm';
import {
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
} from '@casual-simulation/aux-vm';
import { loadScript, setupChannel, waitForLoad } from '../html/IFrameHelpers';
import {
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
    CurrentVersion,
} from '@casual-simulation/causal-trees';
import Bowser from 'bowser';
import axios from 'axios';
import { AuxSubChannel, AuxSubVM } from '@casual-simulation/aux-vm/vm';
import { RemoteAuxVM } from '@casual-simulation/aux-vm-client';

export const DEFAULT_IFRAME_ALLOW_ATTRIBUTE =
    'accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking';
export const DEFAULT_IFRAME_SANDBOX_ATTRIBUTE =
    'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class AuxVMImpl implements AuxVM {
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _versionUpdated: Subject<RuntimeStateVersion>;
    private _onError: Subject<AuxChannelErrorType>;
    private _subVMAdded: Subject<AuxSubVM>;
    private _subVMRemoved: Subject<AuxSubVM>;
    private _subVMMap: Map<
        string,
        AuxSubVM & {
            channel: Remote<AuxChannel>;
        }
    >;

    private _config: AuxConfig;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxChannel>;
    private _initialUser: AuxUser;
    closed: boolean;

    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Creates a new Simulation VM.
     */
    constructor(user: AuxUser, config: AuxConfig) {
        this._initialUser = user;
        this._config = config;
        this._localEvents = new Subject<LocalActions[]>();
        this._deviceEvents = new Subject<DeviceAction[]>();
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this._versionUpdated = new Subject<RuntimeStateVersion>();
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
        this._subVMAdded = new Subject();
        this._subVMRemoved = new Subject();
        this._subVMMap = new Map();
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

    /**
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        return await this._init();
    }

    private async _init(): Promise<void> {
        const origin = this._config.config.vmOrigin || location.origin;
        const iframeUrl = new URL('/aux-vm-iframe.html', origin).href;

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
        this._iframe.style.display = 'none';
        this._iframe.setAttribute('allow', DEFAULT_IFRAME_ALLOW_ATTRIBUTE);
        this._iframe.setAttribute('sandbox', DEFAULT_IFRAME_SANDBOX_ATTRIBUTE);

        let promise = waitForLoad(this._iframe);
        document.body.insertBefore(this._iframe, document.body.firstChild);

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
            this._initialUser,
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
            proxy((id) => this._handleRemovedSubChannel(id))
        );
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<LocalActions[]> {
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

    async setUser(user: AuxUser): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setUser(user);
    }

    async setGrant(grant: string): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.setGrant(grant);
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    async sendEvents(events: BotAction[]): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.sendEvents(events);
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

    /**
     * Gets a new endpoint for the aux channel.
     * Can then be used with a ConnectableAuxVM.
     */
    createEndpoint(): Promise<MessagePort> {
        return this._proxy[createEndpoint]();
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this._channel = null;
        this._proxy = null;
        document.body.removeChild(this._iframe);
        this._iframe = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    protected _createSubVM(channel: Remote<AuxChannel>): AuxVM {
        return new RemoteAuxVM(channel);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, user } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as Remote<AuxChannel>;

        const subVM = {
            id: id,
            user: user,
            vm: this._createSubVM(channel),
            channel,
        };

        this._subVMMap.set(id, subVM);
        this._subVMAdded.next(subVM);
    }

    private async _handleRemovedSubChannel(channelId: string) {
        const vm = this._subVMMap.get(channelId);
        if (vm) {
            this._subVMMap.delete(channelId);
            this._subVMRemoved.next(vm);
        }
    }
}

function processPartitions(config: AuxConfig): AuxConfig {
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

/**
 * Loads the script at the given URL into the given iframe window.
 * @param iframeWindow The iframe.
 * @param id The ID of the script.
 * @param url The URL to load.
 */
async function loadScriptFromUrl(
    iframeWindow: Window,
    id: string,
    url: string
) {
    const source = await axios.get(url);
    if (source.status === 200 && typeof source.data === 'string') {
        return await loadScript(iframeWindow, id, source.data);
    } else {
        throw new Error('Unable to load script: ' + url);
    }
}
