import { AuxVM } from '../AuxVM';
import { Observable, Subject } from 'rxjs';
import { StateUpdatedEvent } from '../../managers/StateUpdatedEvent';
import { AuxHelper } from '../AuxHelper';
import { AuxConfig } from '../AuxConfig';
import {
    AuxCausalTree,
    LocalEvents,
    FileEvent,
    PrecalculatedFilesState,
    FilesState,
    createCalculationContext,
    merge,
    AuxObject,
    searchFileState,
} from '@casual-simulation/aux-common';
import { PrecalculationManager } from '../../managers/PrecalculationManager';
import { values } from 'lodash';

export class TestAuxVM implements AuxVM {
    private _stateUpdated: Subject<StateUpdatedEvent>;
    private _precalculator: PrecalculationManager;

    events: FileEvent[];
    formulas: string[];

    id: string;

    processEvents: boolean;
    state: FilesState;
    localEvents: Observable<LocalEvents[]>;
    connectionStateChanged: Subject<boolean>;

    get stateUpdated(): Observable<StateUpdatedEvent> {
        return this._stateUpdated;
    }

    constructor(userId: string = 'user') {
        this.events = [];
        this.formulas = [];

        this.processEvents = false;
        this.state = {};
        this._precalculator = new PrecalculationManager(
            () => this.state,
            () => createCalculationContext(values(this.state), userId)
        );
        this._stateUpdated = new Subject<StateUpdatedEvent>();
        this.connectionStateChanged = new Subject<boolean>();
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        this.events.push(...events);

        if (this.processEvents) {
            let added = [];
            let removed = [];
            let updated = [];

            for (let event of events) {
                if (event.type === 'file_added') {
                    this.state[event.file.id] = event.file;
                    added.push(<AuxObject>event.file);
                } else if (event.type === 'file_removed') {
                    delete this.state[event.id];
                    removed.push(event.id);
                } else if (event.type === 'file_updated') {
                    this.state[event.id] = merge(
                        this.state[event.id],
                        event.update
                    );
                    updated.push({
                        file: <AuxObject>this.state[event.id],
                        tags: Object.keys(event.update.tags),
                    });
                }
            }

            if (added.length > 0) {
                this._stateUpdated.next(this._precalculator.filesAdded(added));
            }
            if (removed.length > 0) {
                this._stateUpdated.next(
                    this._precalculator.filesRemoved(removed)
                );
            }
            if (updated.length > 0) {
                this._stateUpdated.next(
                    this._precalculator.filesUpdated(updated)
                );
            }
        }
    }

    async formulaBatch(formulas: string[]): Promise<void> {
        this.formulas.push(...formulas);
    }

    async init(loadingCallback?: any): Promise<void> {}

    async search(search: string): Promise<any> {
        return searchFileState(search, this._precalculator.filesState);
    }

    sendState(update: StateUpdatedEvent) {
        this._stateUpdated.next(update);
    }

    unsubscribe(): void {}
    closed: boolean;
}
