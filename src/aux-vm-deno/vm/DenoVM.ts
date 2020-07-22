import {
    LocalActions,
    BotAction,
    StateUpdatedEvent,
    BotDependentInfo,
    ProxyBridgePartitionImpl,
} from '@casual-simulation/aux-common';
import { Observable, Subject } from 'rxjs';
import { wrap, proxy, Remote, expose, transfer, Endpoint } from 'comlink';
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
import { DenoWorker } from 'deno-vm';
import { URL } from 'url';

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
    private _worker: DenoWorker;
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

        this._worker = new DenoWorker(
            new URL('http://localhost:3000/deno.js'),
            {
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

        const wrapper = wrap<AuxStatic>(<Endpoint>(<any>this._worker));
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
        this._worker.terminate();
        this._worker = null;
        this._connectionStateChanged.unsubscribe();
        this._connectionStateChanged = null;
        this._localEvents.unsubscribe();
        this._localEvents = null;
    }
}
