import { ConnectionClient } from './ConnectionClient';
import {
    WATCH_BRANCH,
    ADD_ATOMS,
    AddAtomsEvent,
    Atom,
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

    /**
     * Starts watching the given branch.
     * @param name The name of the branch to watch.
     */
    watchBranch(name: string) {
        this._client.send(WATCH_BRANCH, name);
        return this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
            filter(e => e.branch === name),
            map(e => e.atoms)
        );
    }

    /**
     * Adds the given atoms to the given branch.
     * @param branch The name of the branch.
     * @param atoms The atoms to add.
     */
    addAtoms(branch: string, atoms: Atom<any>[]) {
        this._client.send(ADD_ATOMS, {
            branch: branch,
            atoms: atoms,
        });
    }
}
