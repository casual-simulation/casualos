import { ConnectionClient } from './ConnectionClient';
import {
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    tap,
    finalize,
    first,
} from 'rxjs/operators';
import { merge, Observable } from 'rxjs';
import {
    WATCH_BRANCH,
    AddAtomsEvent,
    ADD_ATOMS,
    AtomsReceivedEvent,
    ATOMS_RECEIVED,
    WATCH_BRANCHES,
    LoadBranchEvent,
    LOAD_BRANCH,
    UnloadBranchEvent,
    UNLOAD_BRANCH,
    UNWATCH_BRANCHES,
    UNWATCH_BRANCH,
    WATCH_DEVICES,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    DEVICE_CONNECTED_TO_BRANCH,
    DEVICE_DISCONNECTED_FROM_BRANCH,
    UNWATCH_DEVICES,
    ReceiveDeviceActionEvent,
    RECEIVE_EVENT,
    SEND_EVENT,
    BRANCH_INFO,
    BranchInfoEvent,
    BRANCHES,
    BranchesEvent,
    REMOVE_ATOMS,
    RemoveAtomsEvent,
} from './CausalRepoEvents';
import { Atom } from './Atom2';
import { DeviceAction, RemoteAction } from '../core/Event';

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
        return this._whenConnected().pipe(
            tap(connected => {
                this._client.send(WATCH_BRANCH, name);
                let list = this._getSentAtoms(name);
                let unsentAtoms = [] as Atom<any>[];
                let removedAtoms = [] as string[];
                for (let [key, value] of list) {
                    if (!!value) {
                        unsentAtoms.push(value);
                    } else {
                        removedAtoms.push(key);
                    }
                }
                if (unsentAtoms.length > 0) {
                    this._sendAddAtoms(name, unsentAtoms);
                }
                if (removedAtoms.length > 0) {
                    this._sendRemoveAtoms(name, removedAtoms);
                }
            }),
            switchMap(connected =>
                merge(
                    this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
                        filter(event => event.branch === name),
                        map(
                            e =>
                                ({
                                    type: 'atoms',
                                    atoms: e.atoms,
                                } as ClientAtoms)
                        )
                    ),
                    this._client.event<RemoveAtomsEvent>(REMOVE_ATOMS).pipe(
                        filter(event => event.branch === name),
                        map(
                            e =>
                                ({
                                    type: 'atoms_removed',
                                    hashes: e.hashes,
                                } as ClientAtomsRemoved)
                        )
                    ),
                    this._client.event<AtomsReceivedEvent>(ATOMS_RECEIVED).pipe(
                        filter(event => event.branch === name),
                        tap(event => {
                            let list = this._getSentAtoms(event.branch);
                            for (let hash of event.hashes) {
                                list.delete(hash);
                            }
                        }),
                        map(
                            event =>
                                ({
                                    type: 'atoms_received',
                                } as ClientAtomsReceived)
                        )
                    ),
                    this._client
                        .event<ReceiveDeviceActionEvent>(RECEIVE_EVENT)
                        .pipe(
                            filter(event => event.branch === name),
                            map(
                                event =>
                                    ({
                                        type: 'event',
                                        action: event.action,
                                    } as ClientEvent)
                            )
                        )
                ).pipe(filter(isClientAtomsOrEvents))
            ),
            finalize(() => {
                this._client.send(UNWATCH_BRANCH, name);
            })
        );
    }

    watchBranches() {
        return this._whenConnected().pipe(
            tap(connected => {
                this._client.send(WATCH_BRANCHES, undefined);
            }),
            switchMap(connected =>
                merge(
                    this._client
                        .event<LoadBranchEvent>(LOAD_BRANCH)
                        .pipe(map(e => ({ type: LOAD_BRANCH, ...e } as const))),
                    this._client
                        .event<UnloadBranchEvent>(UNLOAD_BRANCH)
                        .pipe(
                            map(e => ({ type: UNLOAD_BRANCH, ...e } as const))
                        )
                )
            ),
            finalize(() => {
                this._client.send(UNWATCH_BRANCHES, undefined);
            })
        );
    }

    watchDevices() {
        return this._whenConnected().pipe(
            tap(connected => {
                this._client.send(WATCH_DEVICES, undefined);
            }),
            switchMap(connected =>
                merge(
                    this._client
                        .event<ConnectedToBranchEvent>(
                            DEVICE_CONNECTED_TO_BRANCH
                        )
                        .pipe(
                            map(
                                e =>
                                    ({
                                        type: DEVICE_CONNECTED_TO_BRANCH,
                                        ...e,
                                    } as const)
                            )
                        ),
                    this._client
                        .event<DisconnectedFromBranchEvent>(
                            DEVICE_DISCONNECTED_FROM_BRANCH
                        )
                        .pipe(
                            map(
                                e =>
                                    ({
                                        type: DEVICE_DISCONNECTED_FROM_BRANCH,
                                        ...e,
                                    } as const)
                            )
                        )
                )
            ),
            finalize(() => {
                this._client.send(UNWATCH_DEVICES, undefined);
            })
        );
    }

    /**
     * Gets the info for the given branch.
     * @param branch The branch.
     */
    branchInfo(branch: string) {
        return this._whenConnected().pipe(
            tap(connected => {
                this._client.send(BRANCH_INFO, branch);
            }),
            switchMap(connected =>
                merge(
                    this._client
                        .event<BranchInfoEvent>(BRANCH_INFO)
                        .pipe(first(e => e.branch === branch))
                )
            )
        );
    }

    /**
     * Requests a list of branches.
     */
    branches() {
        return this._whenConnected().pipe(
            tap(connected => {
                this._client.send(BRANCHES, undefined);
            }),
            switchMap(connected =>
                merge(this._client.event<BranchesEvent>(BRANCHES).pipe(first()))
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

    /**
     * Removes the given atom hashes from the given branch.
     * @param branch The name of the branch.
     * @param hashes The hashes of the atoms to remove.
     */
    removeAtoms(branch: string, hashes: string[]) {
        let list = this._getSentAtoms(branch);
        for (let hash of hashes) {
            list.set(hash, null);
        }

        this._sendRemoveAtoms(branch, hashes);
    }

    /**
     * Sends the given action to devices on the given branch.
     * @param branch The branch.
     * @param action The action.
     */
    sendEvent(branch: string, action: RemoteAction) {
        this._client.send(SEND_EVENT, {
            branch: branch,
            action: action,
        });
    }

    private _whenConnected() {
        return whenConnected(this._client.connectionState);
    }

    private _sendAddAtoms(branch: string, atoms: Atom<any>[]) {
        this._client.send(ADD_ATOMS, {
            branch: branch,
            atoms: atoms,
        });
    }

    private _sendRemoveAtoms(branch: string, hashes: string[]) {
        this._client.send(REMOVE_ATOMS, {
            branch: branch,
            hashes: hashes,
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

export interface ClientAtoms {
    type: 'atoms';
    atoms: Atom<any>[];
}

export interface ClientAtomsRemoved {
    type: 'atoms_removed';
    hashes: string[];
}

export interface ClientAtomsReceived {
    type: 'atoms_received';
}

export interface ClientEvent {
    type: 'event';
    action: DeviceAction;
}

export type ClientWatchBranchEvents =
    | ClientAtoms
    | ClientAtomsReceived
    | ClientEvent
    | ClientAtomsRemoved;
export type ClientAtomsOrEvent = ClientAtoms | ClientEvent | ClientAtomsRemoved;

export function isClientAtomsRemoved(
    event: ClientWatchBranchEvents
): event is ClientAtomsRemoved {
    return event.type === 'atoms_removed';
}

export function isClientAtoms(
    event: ClientWatchBranchEvents
): event is ClientAtoms {
    return event.type === 'atoms';
}

export function isClientEvent(
    event: ClientWatchBranchEvents
): event is ClientEvent {
    return event.type === 'event';
}

export function isClientAtomsOrEvents(
    event: ClientWatchBranchEvents
): event is ClientAtomsOrEvent {
    return (
        event.type === 'atoms' ||
        event.type === 'atoms_removed' ||
        event.type === 'event'
    );
}

function whenConnected(observable: Observable<boolean>): Observable<boolean> {
    return observable.pipe(
        distinctUntilChanged(),
        filter(connected => connected)
    );
}
