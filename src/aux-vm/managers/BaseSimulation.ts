import {
    botRemoved,
    parseSimulationId,
    SimulationIdParseSuccess,
    BotIndex,
    AuxPartitionConfig,
    LocalActions,
    StoredAux,
} from '@casual-simulation/aux-common';
import { Observable, Subject, SubscriptionLike } from 'rxjs';
import { flatMap } from 'rxjs/operators';

import { AuxUser } from '../AuxUser';
import { BotHelper } from './BotHelper';
import { BotWatcher } from './BotWatcher';
import { AuxVM } from '../vm/AuxVM';
import { AuxConfig } from '../vm/AuxConfig';
import { ConnectionManager } from './ConnectionManager';
import { AuxChannelErrorType } from '../vm/AuxChannelErrorTypes';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import {
    DeviceAction,
    DevicesEvent,
    LoadingProgressCallback,
} from '@casual-simulation/causal-trees';
import { ProgressStatus, DeviceInfo } from '@casual-simulation/causal-trees';
import { Simulation } from './Simulation';
import { CodeLanguageManager } from './CodeLanguageManager';
import { BotDimensionManager } from './BotDimensionManager';

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
    private _subSimulations: Map<string, Simulation>;

    protected _subscriptions: SubscriptionLike[];
    private _status: string;
    private _id: string;
    private _originalId: string;
    private _parsedId: SimulationIdParseSuccess;

    private _errored: boolean;

    closed: boolean;

    /**
     * Gets the ID of the simulation that is currently being used.
     */
    get id() {
        return this._originalId;
    }

    /**
     * Gets the parsed ID of the simulation.
     */
    get parsedId(): SimulationIdParseSuccess {
        return this._parsedId;
    }

    set parsedId(id: SimulationIdParseSuccess) {
        this._parsedId = id;
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

    get localEvents(): Observable<LocalActions> {
        return this._vm.localEvents.pipe(flatMap((e) => e));
    }

    get onError(): Observable<AuxChannelErrorType> {
        return this._vm.onError;
    }

    get deviceEvents(): Observable<DeviceAction> {
        return this._vm.deviceEvents.pipe(flatMap((e) => e));
    }

    /**
     * Creates a new simulation for the given user and channel ID.
     * @param id The ID of the channel.
     * @param vm The VM that should be used.
     */
    constructor(id: string, vm: AuxVM) {
        this._vm = vm;
        this._originalId = id || 'default';
        this._parsedId = parseSimulationId(this._originalId);
        this._id = this._getTreeName(this._parsedId.channel);
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

    updateID(id: string) {
        let temp = id || 'default';
        this._parsedId = parseSimulationId(temp);
        this._id = this._getTreeName(this._parsedId.channel);
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

        this._setStatus('Initialized.');
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
                const sim = this._createSubSimulation(vm.user, vm.id, vm.vm);
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
     * @param user The user that should be used by the sim.
     * @param id The ID of the sim.
     * @param vm The VM that the simulation should use.
     */
    protected _createSubSimulation(user: AuxUser, id: string, vm: AuxVM) {
        return new BaseSimulation(id, vm);
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
