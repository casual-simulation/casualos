import { Aux } from './Aux';
import { expose } from 'comlink';
import {
    LocalEvents,
    PrecalculatedFilesState,
    FileEvent,
} from '@casual-simulation/aux-common';
import { AuxConfig } from './AuxConfig';

class AuxImpl implements Aux {
    private _onLocalEvents: (events: LocalEvents[]) => void;
    private _onStateUpated: (state: PrecalculatedFilesState) => void;

    constructor(config: AuxConfig) {}

    async init(
        onLocalEvents: (events: LocalEvents[]) => void,
        onStateUpdated: (state: PrecalculatedFilesState) => void
    ): Promise<void> {
        this._onLocalEvents = onLocalEvents;
        this._onStateUpated = onStateUpdated;
    }

    sendEvents(events: FileEvent[]): Promise<void> {
        throw new Error('Method not implemented.');
    }
}

expose(AuxImpl);
