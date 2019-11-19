import { ConnectionClient } from './ConnectionClient';
import {
    WATCH_BRANCH,
    ADD_ATOMS,
    AddAtomsEvent,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import {
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    tap,
} from 'rxjs/operators';

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
        return this._client.connectionState.pipe(
            distinctUntilChanged(),
            filter(connected => connected),
            tap(connected => this._client.send(WATCH_BRANCH, name)),
            switchMap(connected =>
                this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
                    filter(event => event.branch === name),
                    map(e => e.atoms)
                )
            )
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
