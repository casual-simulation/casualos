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
    StoredAux,
    PartitionAuthMessage,
} from '@casual-simulation/aux-common';
import { BotIndex } from '@casual-simulation/aux-common';
import type { Observable, SubscriptionLike } from 'rxjs';
import { Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { BotHelper } from './BotHelper';
import { BotWatcher } from './BotWatcher';
import type { AuxVM } from '../vm/AuxVM';
import { ConnectionManager } from './ConnectionManager';
import type { AuxChannelErrorType } from '../vm/AuxChannelErrorTypes';
import type { DeviceAction } from '@casual-simulation/aux-common';
import type { Simulation } from './Simulation';
import { CodeLanguageManager } from './CodeLanguageManager';
import { BotDimensionManager } from './BotDimensionManager';
import type { RuntimeActions } from '@casual-simulation/aux-runtime';

/**
 * Defines a class that interfaces with an AUX VM to reactively edit bots.
 */
export class BaseSimulation implements Simulation {
    protected _vm: AuxVM;
    protected _helper: BotHelper;
    protected _index: BotIndex;
    protected _watcher: BotWatcher;
    protected _contexts: BotDimensionManager;
    protected _connection: ConnectionManager;
    protected _code: CodeLanguageManager;

    protected _onSubSimulationAdded: Subject<Simulation>;
    protected _onSubSimulationRemoved: Subject<Simulation>;
    protected _isSubSimulation: boolean = false;
    private _subSimulations: Map<string, Simulation>;

    protected _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;

    private _errored: boolean;

    closed: boolean;

    /**
     * Gets the ID of the simulation that is currently being used.
     */
    get id() {
        return this._id;
    }

    get configBotId() {
        return this._vm.configBotId;
    }

    get isSubSimulation() {
        return this._isSubSimulation;
    }

    /**
     * Gets whether the app is connected to the inst but may
     * or may not be synced to the inst.
     */
    get isOnline(): boolean {
        // return this._aux.channel.isConnected;
        return false;
    }

    /**
     * Gets whether the app is synced to the inst.
     */
    get isSynced(): boolean {
        return this.isOnline;
    }

    /**
     * Gets the bot helper.
     */
    get helper() {
        return this._helper;
    }

    get index() {
        return this._index;
    }

    get dimensions() {
        return this._contexts;
    }

    /**
     * Gets the bot watcher.
     */
    get watcher() {
        return this._watcher;
    }

    get connection() {
        return this._connection;
    }

    get code() {
        return this._code;
    }

    get onAuthMessage() {
        return this._vm.onAuthMessage;
    }

    get localEvents(): Observable<RuntimeActions> {
        return this._vm.localEvents.pipe(
            mergeMap((e) => e)
        ) as Observable<RuntimeActions>;
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._vm.onError;
    }

    get deviceEvents(): Observable<DeviceAction> {
        return this._vm.deviceEvents.pipe(mergeMap((e) => e));
    }

    /**
     * Creates a new simulation for the given user and channel ID.
     * @param vm The VM that should be used.
     */
    constructor(vm: AuxVM) {
        this._vm = vm;
        this._id = vm.id;
        this._onSubSimulationAdded = new Subject();
        this._onSubSimulationRemoved = new Subject();
        this._subSimulations = new Map();
        this._subscriptions = [];

        this._helper = new BotHelper(this._vm);
        this._index = new BotIndex();
        this._contexts = new BotDimensionManager(this._helper, this._index);
        this._connection = new ConnectionManager(this._vm);
        this._code = new CodeLanguageManager(this._vm);
    }

    get onSubSimulationAdded(): Observable<Simulation> {
        return this._onSubSimulationAdded;
    }

    get onSubSimulationRemoved(): Observable<Simulation> {
        return this._onSubSimulationRemoved;
    }

    /**
     * Initializes the bot manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(): Promise<void> {
        console.log('[BaseSimulation] init');
        return this._init();
    }

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    async forkAux(forkName: string) {
        const id = this._getTreeName(forkName);
        console.log('[BaseSimulation] Making fork', forkName);
        await this._vm.forkAux(id);
        console.log('[BaseSimulation] Fork finished.');
    }

    exportBots(botIds: string[]) {
        return this._vm.exportBots(botIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    export(): Promise<StoredAux> {
        return this._vm.export();
    }

    sendAuthMessage(message: PartitionAuthMessage): Promise<void> {
        return this._vm.sendAuthMessage(message);
    }

    private _getTreeName(id: string) {
        return getTreeName(id);
    }

    private async _init(): Promise<void> {
        if (this._errored) {
            throw new Error('Unable to initialize.');
        }
        this._setStatus('Starting...');
        this._subscriptions.push(this._vm);

        this._beforeVmInit();
        this._subscriptions.push(
            this._vm.connectionStateChanged.subscribe((s) => {
                if (s.type === 'message') {
                    console.log(`[${s.source}] ${s.message}`);
                }
            })
        );

        await this._vm.init();
        this._afterVmInit();

        this._setStatus('VM Initialized.');
    }

    /**
     * Initializes the BotWatcher service.
     */
    protected _initBotWatcher() {
        this._watcher = new BotWatcher(
            this._helper,
            this._index,
            this._vm.stateUpdated,
            this._vm.versionUpdated
        );
    }

    /**
     * Triggered before the VM is initialized.
     * Useful if services need to be configured to listen to VM events.
     */
    protected _beforeVmInit(): void {
        // BotWatcher should be initialized before the VM
        // so that it is already listening for any events that get emitted
        // during initialization.
        this._initBotWatcher();

        this._subscriptions.push(
            this._vm.subVMAdded.subscribe(async (vm) => {
                const sim = this._createSubSimulation(vm.vm);
                if (sim) {
                    this._subSimulations.set(vm.id, sim);
                    this._onSubSimulationAdded.next(sim);
                }
            }),
            this._vm.subVMRemoved.subscribe(async (vm) => {
                const sim = this._subSimulations.get(vm.id);
                if (sim) {
                    this._subSimulations.delete(vm.id);
                    sim.unsubscribe();
                    this._onSubSimulationRemoved.next(sim);
                }
            })
        );
    }

    /**
     * Creates a sub simulation from the given VM.
     * @param vm The VM that the simulation should use.
     */
    protected _createSubSimulation(vm: AuxVM) {
        const sim = new BaseSimulation(vm);
        sim._isSubSimulation = true;
        return sim;
    }

    /**
     * Triggered after the VM is initialized.
     * Useful if services need to be configured after the VM has been initialized.
     */
    protected _afterVmInit(): void {}

    protected _setStatus(status: string) {
        this._status = status;
        console.log('[BaseSimulation] Status:', status);
    }

    public unsubscribe() {
        this._setStatus('Dispose');
        this.closed = true;
        this._subscriptions.forEach((s) => s.unsubscribe());
        this._subscriptions = [];
    }
}

export function getTreeName(id: string) {
    return id ? `aux-${id}` : 'aux-default';
}
