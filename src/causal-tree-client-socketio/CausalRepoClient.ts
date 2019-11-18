import { ConnectionClient } from './ConnectionClient';
import { WATCH_BRANCH } from '@casual-simulation/causal-trees/core2';

/**
 * Defines a client for a causal repo.
 */
export class CausalRepoClient {
    private _client: ConnectionClient;

    constructor(connection: ConnectionClient) {
        this._client = connection;
    }

    watchBranch(name: string) {
        this._client.send(WATCH_BRANCH, name);
    }
}
