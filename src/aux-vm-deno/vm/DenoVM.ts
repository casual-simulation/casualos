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
    PartitionAuthMessage,
    StateUpdatedEvent,
    StoredAux,
} from '@casual-simulation/aux-common';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { Remote, Endpoint } from 'comlink';
import { wrap, proxy } from 'comlink';
import type { SimulationOrigin } from '@casual-simulation/aux-vm';
import type {
    AuxConfig,
    AuxVM,
    ChannelActionResult,
    AuxSubChannel,
    AuxSubVM,
    AuxChannel,
    AuxStatic,
    AuxChannelErrorType,
} from '@casual-simulation/aux-vm/vm';
import type { StatusUpdate, DeviceAction } from '@casual-simulation/aux-common';
import { remapProgressPercent } from '@casual-simulation/aux-common';
import type { DenoWorkerOptions } from 'deno-vm';
import { DenoWorker, polyfillMessageChannel } from 'deno-vm';
import { URL } from 'url';
import { RemoteAuxVM } from '@casual-simulation/aux-vm-client/vm';
import type {
    AuxDevice,
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
    private _onAuthMessage: Subject<PartitionAuthMessage>;
    private _onLogs: Subject<string[]> = new Subject();

    private _config: AuxConfig;
    private _worker: DenoWorker;
    private _proxy: Remote<AuxChannel>;
    private _id: string;
    private _origin: SimulationOrigin;
    private _script: string | URL;
    private _workerOptions: Partial<DenoWorkerOptions>;

    /**
     * The path to the deno executable that should be used.
     * If null or undefined, then the default deno executable will be used.
     */
    denoExecutable: string;

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

    get origin() {
        return this._origin;
    }

    /**
     * Creates a new Simulation VM.
     * @param script The script that should be loaded for the Deno Worker.
     */
    constructor(
        script: string | URL,
        id: string,
        origin: SimulationOrigin,
        config: AuxConfig,
        workerOptions?: Partial<DenoWorkerOptions>
    ) {
        this._script = script;
        this._id = id;
        this._origin = origin;
        this._config = config;
        this._workerOptions = workerOptions;
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

    get onLogs(): Observable<string[]> {
        return this._onLogs;
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
        const permissions: DenoWorkerOptions['permissions'] = {
            allowNet: true,
        };
        const extraFlags: string[] = [];

        if (this._script instanceof URL) {
            console.log('[DenoVM] Script:', this._script.href);
            if (this._script.protocol === 'file:') {
                let path = this._script.pathname;
                if (/^\/\w:/.test(path)) {
                    // Windows absolute path
                    // For some reason, the URL class will always add a leading slash to the pathname,
                    // even for Windows paths. So we need to remove it.
                    path = path.slice(1);
                }

                console.log('[DenoVM] Allowing read for script file:', path);

                // Allow read access to the script file.
                permissions.allowRead = [path];
            } else {
                console.log(
                    '[DenoVM] Allowing read for script host:',
                    this._script.host
                );
                extraFlags.push(`--allow-import=${this._script.host}`);
            }
        }

        const workerOptions: Partial<DenoWorkerOptions> = {
            ...(this._workerOptions || {}),
            logStderr: debug,
            logStdout: debug,
            permissions,
            denoExtraFlags: extraFlags,
        };
        if (this.denoExecutable) {
            workerOptions.denoExecutable = this.denoExecutable;
        }
        this._worker = new DenoWorker(this._script, workerOptions);

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });

        console.log('[DenoVM] Waiting for init...');

        await waitForInit(this._worker);

        this._worker.stderr.on('data', (data: string) => {
            this._onLogs.next([data]);
        });
        this._worker.stdout.on('data', (data: string) => {
            this._onLogs.next([data]);
        });

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
        this._proxy = await new wrapper(null, this._config);

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

    async updateDevice(device: AuxDevice): Promise<void> {
        if (!this._proxy) return null;
        return await this._proxy.updateDevice(device);
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._proxy.sendAuthMessage(message);
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
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        if (this._connectionStateChanged) {
            this._connectionStateChanged.unsubscribe();
            this._connectionStateChanged = null;
        }
        if (this._localEvents) {
            this._localEvents.unsubscribe();
            this._localEvents = null;
        }
    }

    protected _createSubVM(
        id: string,
        origin: SimulationOrigin,
        configBotId: string,
        channel: Remote<AuxChannel>
    ): AuxVM {
        return new RemoteAuxVM(id, origin, configBotId, channel);
    }

    private async _handleAddedSubChannel(subChannel: AuxSubChannel) {
        const { id, configBotId } = await subChannel.getInfo();
        const channel =
            (await subChannel.getChannel()) as unknown as Remote<AuxChannel>;

        const subVM = {
            id,
            vm: this._createSubVM(id, this.origin, configBotId, channel),
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
