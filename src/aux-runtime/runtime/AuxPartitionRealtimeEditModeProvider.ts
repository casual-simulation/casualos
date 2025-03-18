import type { AuxRealtimeEditModeProvider } from './AuxRealtimeEditModeProvider';
import { DEFAULT_REALTIME_EDIT_MODE } from './AuxRealtimeEditModeProvider';
import type { AuxPartitions } from '@casual-simulation/aux-common';
import { realtimeStrategyToRealtimeEditMode } from './Utils';
import { RealtimeEditMode } from './RuntimeBot';

export class AuxPartitionRealtimeEditModeProvider
    implements AuxRealtimeEditModeProvider
{
    private _partitions: AuxPartitions;

    constructor(partitions: AuxPartitions) {
        this._partitions = partitions;
    }

    getEditMode(space: string): RealtimeEditMode {
        if (space in this._partitions) {
            return realtimeStrategyToRealtimeEditMode(
                this._partitions[space].realtimeStrategy
            );
        }
        if (space === 'certified') {
            return RealtimeEditMode.None;
        } else if (space === 'bootstrap') {
            return RealtimeEditMode.None;
        }
        return DEFAULT_REALTIME_EDIT_MODE;
    }
}
