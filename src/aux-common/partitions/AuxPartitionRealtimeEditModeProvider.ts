import {
    AuxRealtimeEditModeProvider,
    DEFAULT_SPACE_REALTIME_EDIT_MODE_MAP,
    DEFAULT_REALTIME_EDIT_MODE,
} from '../runtime/AuxRealtimeEditModeProvider';
import { AuxPartitions } from './AuxPartition';
import { realtimeStrategyToRealtimeEditMode } from '../runtime/Utils';
import { RealtimeEditMode } from '../runtime/RuntimeBot';

export class AuxPartitionRealtimeEditModeProvider
    implements AuxRealtimeEditModeProvider {
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
        }
        return DEFAULT_REALTIME_EDIT_MODE;
    }
}
