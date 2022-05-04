import { TimeSample, TimeSyncConnection } from '@casual-simulation/timesync';
import { CausalRepoClient } from './CausalRepoClient';

/**
 * Defines a class that implements TimeSyncConnection when given a CausalRepoClient.
 */
export class CausalRepoClientTimeSyncConnection implements TimeSyncConnection {
    private _client: CausalRepoClient;

    constructor(client: CausalRepoClient) {
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