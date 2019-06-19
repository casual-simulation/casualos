import {
    LocalEvents,
    FileEvent,
    PrecalculatedFilesState,
    UpdatedFile,
} from '@casual-simulation/aux-common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { wrap, proxy, Remote } from 'comlink';
import Worker from 'worker-loader!./AuxChannel.worker';
import { AuxConfig } from './AuxConfig';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';
import { Aux, AuxStatic } from './AuxChannel';

/**
 * Defines an interface for an AUX that is run inside a virtual machine.
 * That is, the AUX is run inside a web worker.
 */
export class AuxVM {
    private _localEvents: Subject<LocalEvents[]>;
    private _stateUpdated: BehaviorSubject<StateUpdatedEvent>;
    private _proxy: Remote<Aux>;
    private _config: AuxConfig;

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
    }

    /**
     * Initaializes the VM.
     */
    async init(): Promise<void> {
        const wrapper = wrap<AuxStatic>(new Worker());
        this._proxy = await new wrapper(this._config);

        await this._proxy.init(
            events => this._localEvents.next(events),
            state => this._stateUpdated.next(state)
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
}
