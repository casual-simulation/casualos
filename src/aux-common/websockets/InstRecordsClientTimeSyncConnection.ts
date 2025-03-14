import type {
    TimeSample,
    TimeSyncConnection,
} from '@casual-simulation/timesync';
import type { InstRecordsClient } from './InstRecordsClient';

/**
 * Defines a class that implements TimeSyncConnection when given a InstRecordsClient.
 */
export class InstRecordsClientTimeSyncConnection implements TimeSyncConnection {
    private _client: InstRecordsClient;

    constructor(client: InstRecordsClient) {
        this._client = client;
    }

    get closed(): boolean {
        return false;
    }

    unsubscribe(): void {}

    sampleServerTime(): Promise<TimeSample> {
        return this._client.sampleServerTime();
    }
}
