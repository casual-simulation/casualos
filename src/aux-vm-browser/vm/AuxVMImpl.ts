import {
    LocalEvents,
    File,
    FileEvent,
    AuxCausalTree,
    AuxOp,
} from '@casual-simulation/aux-common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { wrap, proxy, Remote } from 'comlink';
import { AuxConfig, AuxVM, StateUpdatedEvent } from '@casual-simulation/aux-vm';
import { Aux, AuxStatic } from './AuxChannel';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import {
    LoadingProgressCallback,
    RealtimeCausalTree,
    StoredCausalTree,
} from '@casual-simulation/causal-trees';
import Bowser from 'bowser';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class AuxVMImpl implements AuxVM {
    private _localEvents: Subject<LocalEvents[]>;
    private _connectionStateChanged: BehaviorSubject<boolean>;
    private _stateUpdated: BehaviorSubject<StateUpdatedEvent>;
    private _proxy: Remote<Aux>;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _config: AuxConfig;
    closed: boolean;

    /**
     * The ID of the simulation.
     */
    id: string;

    /**
     * Creates a new Simulation VM.
     */
    constructor(config: AuxConfig) {
        this._config = config;
        this._localEvents = new Subject<LocalEvents[]>();
        this._stateUpdated = new BehaviorSubject<StateUpdatedEvent>(null);
        this._connectionStateChanged = new BehaviorSubject<boolean>(false);
    }

    get connectionStateChanged(): Observable<boolean> {
        return this._connectionStateChanged;
    }

    /**
     * Initaializes the VM.
     */
    async init(loadingCallback?: LoadingProgressCallback): Promise<void> {
        const loadingProgress = new LoadingProgress();
        if (loadingCallback) {
            loadingProgress.onChanged.addListener(() => {
                loadingCallback(loadingProgress);
            });
        }

        loadingProgress.set(10, 'Initializing web worker...', null);
        this._iframe = document.createElement('iframe');
        this._iframe.src = '/aux-vm-iframe.html';
        this._iframe.style.display = 'none';

        // Allow the iframe to run scripts, but do nothing else.
        // Because we're not allowing the same origin, this prevents the VM from talking to
        // storage like IndexedDB and therefore prevents different VMs from affecting each other.
        this._iframe.sandbox.add('allow-scripts');

        const bowserResult = Bowser.parse(navigator.userAgent);

        // Safari requires the allow-same-origin option in order to load
        // web workers using a blob.
        if (
            bowserResult.browser.name === 'Safari' ||
            bowserResult.os.name === 'iOS'
        ) {
            console.warn('[AuxVMImpl] Adding allow-same-origin for Safari');
            this._iframe.sandbox.add('allow-same-origin');
        }

        let promise = waitForLoad(this._iframe);
        document.body.appendChild(this._iframe);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        loadingProgress.set(20, 'Creating VM...', null);
        const wrapper = wrap<AuxStatic>(this._channel.port1);
        this._proxy = await new wrapper(location.origin, this._config);

        const onChannelProgress = loadingProgress.createNestedCallback(20, 100);
        await this._proxy.init(
            proxy(events => this._localEvents.next(events)),
            proxy(state => this._stateUpdated.next(state)),
            proxy(state => this._connectionStateChanged.next(state)),
            proxy(onChannelProgress)
        );
    }

    /**
     * The observable list of events that should be produced locally.
     */
    get localEvents(): Observable<LocalEvents[]> {
        return this._localEvents;
    }

    /**
     * The observable list of file state updates from this simulation.
     */
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    /**
     * Sends the given list of events to the simulation.
     * @param events The events to send to the simulation.
     */
    sendEvents(events: FileEvent[]): Promise<void> {
        return this._proxy.sendEvents(events);
    }

    formulaBatch(formulas: string[]): Promise<void> {
        return this._proxy.formulaBatch(formulas);
    }

    search(search: string): Promise<any> {
        return this._proxy.search(search);
    }

    forkAux(newId: string): Promise<void> {
        return this._proxy.forkAux(newId);
    }

    getRealtimeTree(): Promise<Remote<RealtimeCausalTree<AuxCausalTree>>> {
        return this._proxy.getRealtimeTree();
    }

    exportFiles(fileIds: string[]): Promise<StoredCausalTree<AuxOp>> {
        return this._proxy.exportFiles(fileIds);
    }

    /**
     * Exports the causal tree for the simulation.
     */
    exportTree(): Promise<StoredCausalTree<AuxOp>> {
        return this._proxy.exportTree();
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
}
