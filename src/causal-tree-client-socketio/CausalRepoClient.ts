import { ConnectionClient } from './ConnectionClient';
import {
    WATCH_BRANCH,
    ADD_ATOMS,
    ATOMS_RECEIVED,
    AddAtomsEvent,
    AtomsReceivedEvent,
    Atom,
} from '@casual-simulation/causal-trees/core2';
import {
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    tap,
} from 'rxjs/operators';
import { merge } from 'rxjs';

/**
 * Defines a client for a causal repo.
 */
export class CausalRepoClient {
    private _client: ConnectionClient;
    private _sentAtoms: Map<string, Map<string, Atom<any>>>;
    private _forcedOffline: boolean;

    constructor(connection: ConnectionClient) {
        this._client = connection;
        this._forcedOffline = false;
        this._sentAtoms = new Map();
    }

    /**
     * Gets the connection that this client is using.
     */
    get connection() {
        return this._client;
    }

    /**
     * Gets whether the client is forcing the connection to be offline or not.
     */
    public get forcedOffline() {
        return this._forcedOffline;
    }

    /**
     * Sets whether the client is forcing the connection to be offline or not.
     */
    public set forcedOffline(value: boolean) {
        if (value === this._forcedOffline) {
            return;
        }
        this._forcedOffline = value;
        if (this._forcedOffline) {
            this._client.disconnect();
        } else {
            this._client.connect();
        }
    }

    /**
     * Starts watching the given branch.
     * @param name The name of the branch to watch.
     */
    watchBranch(name: string) {
        return this._client.connectionState.pipe(
            distinctUntilChanged(),
            filter(connected => connected),
            tap(connected => {
                this._client.send(WATCH_BRANCH, name);
                let list = this._getSentAtoms(name);
                let unsentAtoms = [...list.values()];
                if (unsentAtoms.length > 0) {
                    this._sendAddAtoms(name, unsentAtoms);
                }
            }),
            switchMap(connected =>
                merge(
                    this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
                        filter(event => event.branch === name),
                        map(e => e.atoms)
                    ),
                    this._client.event<AtomsReceivedEvent>(ATOMS_RECEIVED).pipe(
                        filter(event => event.branch === name),
                        tap(event => {
                            let list = this._getSentAtoms(event.branch);
                            for (let hash of event.hashes) {
                                list.delete(hash);
                            }
                        }),
                        map(event => {})
                    )
                ).pipe(filter(value => !!value))
            )
        );
    }

    /**
     * Adds the given atoms to the given branch.
     * @param branch The name of the branch.
     * @param atoms The atoms to add.
     */
    addAtoms(branch: string, atoms: Atom<any>[]) {
        let list = this._getSentAtoms(branch);
        for (let atom of atoms) {
            list.set(atom.hash, atom);
        }

        this._sendAddAtoms(branch, atoms);
    }

    private _sendAddAtoms(branch: string, atoms: Atom<any>[]) {
        this._client.send(ADD_ATOMS, {
            branch: branch,
            atoms: atoms,
        });
    }

    private _getSentAtoms(branch: string) {
        let map = this._sentAtoms.get(branch);
        if (!map) {
            map = new Map();
            this._sentAtoms.set(branch, map);
        }
        return map;
    }
}
