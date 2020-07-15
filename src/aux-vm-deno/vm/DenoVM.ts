import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    BotDependentInfo,
    ProxyBridgePartitionImpl,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote, expose, transfer } from 'comlink';
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
    StoredAux,
} from '@casual-simulation/aux-vm';
import {
    StatusUpdate,
    remapProgressPercent,
    DeviceAction,
} from '@casual-simulation/causal-trees';
import childProcess, { ChildProcess } from 'child_process';
import { Server, AddressInfo } from 'net';
import { MessageChannel } from 'worker_threads';
import { MessageChannelImpl } from './MessageChannel';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class DenoVM implements AuxVM {
    private _localEvents: Subject<LocalActions[]>;
    private _deviceEvents: Subject<DeviceAction[]>;
    private _connectionStateChanged: Subject<StatusUpdate>;
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _onError: Subject<AuxChannelErrorType>;
    private _config: AuxConfig;
    private _server: Server;
    private _proc: ChildProcess;
    // private _iframe: HTMLIFrameElement;
    private _channel: MessageChannelImpl;
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
        this._connectionStateChanged = new Subject<StatusUpdate>();
        this._onError = new Subject<AuxChannelErrorType>();
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
        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Initializing web worker...',
            progress: 0.1,
        });

        this._channel = new MessageChannelImpl();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let resolveConnection: any;
        let rejectConnection: any;
        const connectionPromise = new Promise((res, rej) => {
            resolveConnection = res;
            rejectConnection = rej;
        });

        this._server = new Server(conn => {
            this._channel.port2.addEventListener('message', e => {
                try {
                    const json = JSON.stringify(e.data);
                    // Messages to stdout all follow the same format:
                    // 4 bytes (32-bit number) for the length of the message
                    // N bytes for the message JSON as UTF-8
                    // - According to MDN UTF-8 never has more than string.length * 3 bytes (https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/encodeInto)
                    // - Using a 32-bit number means we can't have messages larger than ~4GiB
                    const byteBuffer = new Uint8Array(4 + json.length * 3);
                    const view = new DataView(byteBuffer.buffer);

                    // Encode the JSON as UTF-8
                    // Skip the first 4 bytes
                    const result = encoder.encodeInto(
                        json,
                        byteBuffer.subarray(4)
                    );
                    view.setUint32(0, result.written);
                    conn.write(byteBuffer.subarray(0, result.written));
                } catch (err) {
                    console.error('[DenoVM]', err);
                }
            });

            conn.on('data', (data: Buffer) => {
                try {
                    console.log('[DenoVM] Got data');
                    // TODO: Fix to properly handle different buffer sizes
                    const uint32 = new Uint32Array(data);
                    const numBytes = uint32[0];
                    const messageBytes = data.subarray(4, numBytes + 4);
                    const json = decoder.decode(messageBytes);
                    const message = JSON.parse(json);
                    this._channel.port2.postMessage(message);
                } catch (err) {
                    console.error('[DenoVM]', err);
                }
            });

            resolveConnection();
        });

        this._server.listen(() => {
            const addr = this._server.address() as AddressInfo;

            // TODO: Allow specifying the actual URL
            this._proc = childProcess.spawn(`deno`, [
                'run',
                '--reload',
                '--allow-net',
                'http://localhost:3000/deno.js',
                addr.port.toString(),
            ]);

            this._proc.stdout.setEncoding('utf8');
            this._proc.stderr.setEncoding('utf8');
            this._proc.stdout.on('data', data => {
                console.log('[DenoVM]', data);
            });

            this._proc.stderr.on('data', data => {
                console.error('[DenoVM]', data);
            });
        });

        this._connectionStateChanged.next({
            type: 'progress',
            message: 'Creating VM...',
            progress: 0.2,
        });

        await connectionPromise;

        const wrapper = wrap<AuxStatic>(<any>this._channel.port1);
        this._proxy = await new wrapper(null, this._initialUser, this._config);

        let statusMapper = remapProgressPercent(0.2, 1);
        return await this._proxy.init(
            proxy(events => this._localEvents.next(events)),
            proxy(events => this._deviceEvents.next(events)),
            proxy(state => this._stateUpdated.next(state)),
            proxy(state =>
                this._connectionStateChanged.next(statusMapper(state))
            ),
            proxy(err => this._onError.next(err))
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

    async getReferences(tag: string): Promise<BotDependentInfo> {
        if (!this._proxy) return null;
        return await this._proxy.getReferences(tag);
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
        this._channel = null;
        this._proxy = null;
        this._proc.kill();
        this._proc = null;
        this._server.close();
        this._server = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }
}

// function processPartitions(config: AuxConfig): AuxConfig {
//     let transferrables = [] as any[];
//     for (let key in config.partitions) {
//         const partition = config.partitions[key];
//         if (partition.type === 'proxy') {
//             const bridge = new ProxyBridgePartitionImpl(partition.partition);
//             const channel = new MessageChannel();
//             expose(bridge, channel.port1);
//             transferrables.push(channel.port2);
//             config.partitions[key] = {
//                 type: 'proxy_client',
//                 editStrategy: partition.partition.realtimeStrategy,
//                 private: partition.partition.private,
//                 port: channel.port2,
//             };
//         }
//     }
//     return transfer(config, transferrables);
// }
