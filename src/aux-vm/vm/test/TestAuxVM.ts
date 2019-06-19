import { AuxVM } from '../AuxVM';
import { Observable, Subject } from 'rxjs';
import { StateUpdatedEvent } from '../../managers/StateUpdatedEvent';
import { AuxHelper } from '../AuxHelper';
import { AuxConfig } from '../AuxConfig';
import {
    AuxCausalTree,
    LocalEvents,
    FileEvent,
} from '@casual-simulation/aux-common';
import { PrecalculationManager } from '../../managers/PrecalculationManager';

export class TestAuxVM implements AuxVM {
    private _stateUpdated: Subject<StateUpdatedEvent>;

    events: FileEvent[];
    formulas: string[];

    id: string;

    localEvents: Observable<LocalEvents[]>;
    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    constructor() {
        this.events = [];
        this.formulas = [];
        this._stateUpdated = new Subject<StateUpdatedEvent>();
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        this.events.push(...events);
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        this.formulas.push(...formulas);
    }

    async init(loadingCallback?: any): Promise<void> {}

    sendState(update: StateUpdatedEvent) {
        this._stateUpdated.next(update);
    }

    unsubscribe(): void {}
    closed: boolean;
}
