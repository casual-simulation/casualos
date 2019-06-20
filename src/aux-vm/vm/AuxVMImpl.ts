import { LocalEvents, FileEvent } from '@casual-simulation/aux-common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { wrap, proxy, Remote } from 'comlink';
import { AuxConfig } from './AuxConfig';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { Aux, AuxStatic } from './AuxChannel';
import { AuxVM } from './AuxVM';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';

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
    async init(): Promise<void> {
        this._iframe = document.createElement('iframe');
        this._iframe.src = '/aux-vm-iframe.html';
        this._iframe.style.display = 'none';

        // Allow the iframe to run scripts, but do nothing else.
        // Because we're not allowing the same origin, this prevents the VM from talking to
        // storage like IndexedDB and therefore prevents different VMs from affecting each other.
        this._iframe.sandbox.add('allow-scripts');

        let promise = waitForLoad(this._iframe);
        document.body.appendChild(this._iframe);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        const wrapper = wrap<AuxStatic>(this._channel.port1);
        this._proxy = await new wrapper(location.origin, this._config);
        await this._proxy.init(
            proxy(events => this._localEvents.next(events)),
            proxy(state => this._stateUpdated.next(state)),
            proxy(state => this._connectionStateChanged.next(state))
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

    // TODO:
    unsubscribe(): void {}
}
