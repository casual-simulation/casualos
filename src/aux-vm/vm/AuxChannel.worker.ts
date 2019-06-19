import { Aux } from './AuxChannel';
import { expose } from 'comlink';
import {
    LocalEvents,
    PrecalculatedFilesState,
    FileEvent,
} from '@casual-simulation/aux-common';
import { AuxConfig } from './AuxConfig';
import { Simulation, FileManager } from '../managers';
import { SubscriptionLike } from 'rxjs';
import { StateUpdatedEvent } from '../managers/StateUpdatedEvent';

class AuxImpl implements Aux {
    private _simulation: Simulation;
    private _config: AuxConfig;
    private _subs: SubscriptionLike[];

    private _onLocalEvents: (events: LocalEvents[]) => void;
    private _onStateUpated: (state: StateUpdatedEvent) => void;

    constructor(config: AuxConfig) {
        this._config = config;
        this._subs = [];
    }

    async init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: StateUpdatedEvent) => void
    ): Promise<void> {
        this._onLocalEvents = onLocalEvents;
        this._onStateUpated = onStateUpdated;

        this._simulation = new FileManager(
            this._config.user,
            this._config.id,
            this._config.config
        );
        await this._simulation.init();

        this._subs.push(
            this._simulation.helper.localEvents.subscribe(e => {
                this._onLocalEvents(e);
            }),
            this._simulation.watcher.filesDiscovered.subscribe(e => {
                this._onStateUpated(
                    this._simulation.precalculation.filesAdded(e)
                );
            }),
            this._simulation.watcher.filesRemoved.subscribe(e => {
                this._onStateUpated(
                    this._simulation.precalculation.filesRemoved(e)
                );
            }),
            this._simulation.watcher.filesUpdated.subscribe(e => {
                this._onStateUpated(
                    this._simulation.precalculation.filesUpdated(e)
                );
            })
        );
    }

    async sendEvents(events: FileEvent[]): Promise<void> {
        await this._simulation.helper.transaction(...events);
    }
}

expose(AuxImpl);
