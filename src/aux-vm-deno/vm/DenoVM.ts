import {
    BotAction,
    ConnectionIndicator,
    StateUpdatedEvent,
    StoredAux,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote, expose, transfer, Endpoint } from 'comlink';
import {
    AuxConfig,
    AuxVM,
    ChannelActionResult,
    AuxSubChannel,
    AuxSubVM,
} from '@casual-simulation/aux-vm';
import {
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
} from '@casual-simulation/aux-vm';
import {
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
} from '@casual-simulation/aux-common';
import { DenoWorker, polyfillMessageChannel } from 'deno-vm';
import { URL } from 'url';
import { RemoteAuxVM } from '@casual-simulation/aux-vm-client';
import {
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';

polyfillMessageChannel();

let workerCount = 0;

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class DenoVM implements AuxVM {
    private _localEvents: Subject<RuntimeActions[]>;
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
    private _worker: DenoWorker;
    private _proxy: Remote<AuxChannel>;
    private _initialIndicator: ConnectionIndicator;
    closed: boolean;

    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Creates a new Simulation VM.
     */
    constructor(indicator: ConnectionIndicator, config: AuxConfig) {
        this._initialIndicator = indicator;
        this._config = config;
        this._localEvents = new Subject<RuntimeActions[]>();
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
        const startTime = process.hrtime();
        console.log('[DenoVM] Creating Worker...');
        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });

        const debug = !!this._config.config.debug;
        this._worker = new DenoWorker(
            new URL('http://localhost:3000/deno.js'),
            {
                logStderr: debug,
                logStdout: debug,
                permissions: {
                    allowNet: true,
                },
            }
        );

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });

        await waitForInit(this._worker);

        const [seconds, nanoseconds] = process.hrtime(startTime);
        console.log(
            '[DenoVM] Process startup took %d seconds and %d miliseconds',
            seconds,
            nanoseconds / 1000000
        );

        console.log('[DenoVM] Creating VM...');
        let workerID = workerCount + 1;
        workerCount += 1;
        if (!debug) {
            this._worker.stdout.setEncoding('utf-8');
            this._worker.stdout.on('data', (data: string) => {
                let lines = data.split('\n');
                let prefixed = lines
                    .filter((line) => line.length > 0)
                    .map((line) => `[deno${workerID}] ` + line);
                let combined = prefixed.join('\n');
                console.log(combined);
            });
            this._worker.stderr.setEncoding('utf-8');
            this._worker.stderr.on('data', (data: string) => {
                let lines = data.split('\n');
                let prefixed = lines
                    .filter((line) => line.length > 0)
                    .map((line) => `[deno${workerID}] ` + line);
                let combined = prefixed.join('\n');
                console.log(combined);
            });
        }

        const wrapper = wrap<AuxStatic>(<Endpoint>(<any>this._worker));
        this._proxy = await new wrapper(
            null,
            this._initialIndicator,
            this._config
        );

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.initAndWait(
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

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this._proxy) {
            this._proxy.unsubscribe();
            this._proxy = null;
        }
        this._worker.terminate();
        this._worker = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }

    protected _createSubVM(channel: Remote<AuxChannel>): AuxVM {
        return new RemoteAuxVM(channel);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, indicator } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as Remote<AuxChannel>;

        const subVM = {
            id,
            indicator,
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

function waitForInit(worker: DenoWorker): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const listener = (e: MessageEvent) => {
            if (e.data.type === 'worker_init') {
                worker.removeEventListener('message', listener);
                resolve();
            }
        };
        worker.addEventListener('message', listener);
    });
}
