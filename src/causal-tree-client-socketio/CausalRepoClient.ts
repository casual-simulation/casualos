import { ConnectionClient } from './ConnectionClient';
import {
    WATCH_BRANCH,
    ADD_ATOMS,
    AddAtomsEvent,
} from '@casual-simulation/causal-trees/core2';
import { filter, map } from 'rxjs/operators';

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
        return this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
            filter(e => e.branch === name),
            map(e => e.atoms)
        );
    }
}
