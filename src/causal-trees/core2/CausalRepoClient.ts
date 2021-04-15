import { ConnectionClient, ClientConnectionState } from './ConnectionClient';
import {
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    tap,
    finalize,
    first,
    scan,
} from 'rxjs/operators';
import { merge, Observable, never, of } from 'rxjs';
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
    COMMIT,
    CommitEvent,
    AddCommitsEvent,
    WATCH_COMMITS,
    UNWATCH_COMMITS,
    ADD_COMMITS,
    CheckoutEvent,
    CHECKOUT,
    RestoreEvent,
    RESTORE,
    GET_BRANCH,
    DEVICES,
    DevicesEvent,
    WatchBranchEvent,
    WATCH_BRANCH_DEVICES,
    UNWATCH_BRANCH_DEVICES,
    BRANCHES_STATUS,
    BranchesStatusEvent,
    CommitCreatedEvent,
    COMMIT_CREATED,
    RestoredEvent,
    RESTORED,
    ResetEvent,
    RESET,
    SET_BRANCH_PASSWORD,
    SetBranchPasswordEvent,
    AUTHENTICATE_BRANCH_WRITES,
    AuthenticateBranchWritesEvent,
    AuthenticatedToBranchEvent,
    AUTHENTICATED_TO_BRANCH,
    DEVICE_COUNT,
    DeviceCountEvent,
    AddUpdatesEvent,
    ADD_UPDATES,
    UpdatesReceivedEvent,
    UPDATES_RECEIVED,
} from './CausalRepoEvents';
import { Atom } from './Atom2';
import {
    DeviceAction,
    RemoteAction,
    DeviceActionResult,
    DeviceActionError,
    RemoteActions,
} from '../core/Event';
import { DeviceInfo, SESSION_ID_CLAIM } from '../core/DeviceInfo';
import { flatMap, flatMap as lodashFlatMap, sortBy } from 'lodash';

/**
 * Defines a client for a causal repo.
 */
export class CausalRepoClient {
    private _client: ConnectionClient;
    private _sentAtoms: Map<string, Map<string, Atom<any>>>;
    private _sentUpdates: Map<string, Map<number, string[]>>;
    private _updateCounter: number = 0;
    private _watchedBranches: Set<string>;
    private _connectedDevices: Map<string, Map<string, DeviceInfo>>;
    private _forcedOffline: boolean;

    constructor(connection: ConnectionClient) {
        this._client = connection;
        this._forcedOffline = false;
        this._sentAtoms = new Map();
        this._sentUpdates = new Map();
        this._connectedDevices = new Map();
        this._watchedBranches = new Set();
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
    watchBranchAtoms(nameOrEvent: string | WatchBranchEvent) {
        let branchEvent: WatchBranchEvent;
        if (typeof nameOrEvent === 'string') {
            branchEvent = {
                branch: nameOrEvent,
            };
        } else {
            branchEvent = nameOrEvent;
        }
        const name = branchEvent.branch;
        this._watchedBranches.add(name);
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(WATCH_BRANCH, branchEvent);
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
                if (unsentAtoms.length > 0 || removedAtoms.length > 0) {
                    this._sendAddAtoms(name, unsentAtoms, removedAtoms);
                }
            }),
            switchMap((connected) =>
                merge(
                    this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
                        filter((event) => event.branch === name),
                        scan(
                            (acc, event) => {
                                // This is the first event
                                if (acc[0] === null) {
                                    // first event is initial event,
                                    // skip to processing events
                                    if (event.initial) {
                                        return ['event', event] as [
                                            'event',
                                            AddAtomsEvent
                                        ];
                                    } else {
                                        // first event is not initial.
                                        // store it for later.
                                        return ['waiting', [event]] as [
                                            'waiting',
                                            AddAtomsEvent[]
                                        ];
                                    }
                                } else if (acc[0] === 'waiting') {
                                    // This event is happening while we are waiting for the initial event.
                                    const events = acc[1] as AddAtomsEvent[];
                                    if (event.initial) {
                                        // current event is initial event,
                                        // merge events.
                                        const allEvents = events;
                                        const allNewAtoms = lodashFlatMap(
                                            allEvents,
                                            (e) => e.atoms ?? []
                                        );
                                        const sortedNewAtoms = sortBy(
                                            allNewAtoms,
                                            (a) => a.id.timestamp
                                        );
                                        const allRemovedAtoms = lodashFlatMap(
                                            allEvents,
                                            (e) => e.removedAtoms ?? []
                                        );

                                        return [
                                            'event',
                                            {
                                                branch: event.branch,
                                                atoms: [
                                                    ...(event.atoms ?? []),
                                                    ...sortedNewAtoms,
                                                ],
                                                removedAtoms: [
                                                    ...(event.removedAtoms ??
                                                        []),
                                                    ...allRemovedAtoms,
                                                ],
                                            } as AddAtomsEvent,
                                        ] as ['event', AddAtomsEvent];
                                    } else {
                                        // current event is not initial,
                                        // store event
                                        return [
                                            'waiting',
                                            [...events, event],
                                        ] as ['waiting', AddAtomsEvent[]];
                                    }
                                } else {
                                    // This event is happening after we have got the initial event
                                    return ['event', event] as [
                                        'event',
                                        AddAtomsEvent
                                    ];
                                }
                            },
                            [null] as
                                | [null]
                                | ['waiting', AddAtomsEvent[]]
                                | ['event', AddAtomsEvent]
                        ),
                        filter(([type, event]) => type === 'event'),
                        map(([type, event]) => event as AddAtomsEvent),
                        map(
                            (e) =>
                                ({
                                    type: 'atoms',
                                    atoms: e.atoms,
                                    removedAtoms: e.removedAtoms,
                                } as ClientAtoms)
                        )
                    ),
                    this._client.event<AtomsReceivedEvent>(ATOMS_RECEIVED).pipe(
                        filter((event) => event.branch === name),
                        tap((event) => {
                            if (branchEvent.temporary) {
                                return;
                            }
                            let list = this._getSentAtoms(event.branch);

                            for (let hash of event.hashes) {
                                list.delete(hash);
                            }
                        }),
                        map(
                            (event) =>
                                ({
                                    type: 'atoms_received',
                                } as ClientAtomsReceived)
                        )
                    ),
                    this._client
                        .event<ReceiveDeviceActionEvent>(RECEIVE_EVENT)
                        .pipe(
                            filter((event) => event.branch === name),
                            map(
                                (event) =>
                                    ({
                                        type: 'event',
                                        action: event.action,
                                    } as ClientEvent)
                            )
                        ),
                    this._client.event<ResetEvent>(RESET).pipe(
                        filter((event) => event.branch === name),
                        map(
                            (event) =>
                                ({
                                    type: 'reset',
                                    atoms: event.atoms,
                                } as ClientResetAtoms)
                        )
                    )
                ).pipe(filter(isClientAtomsOrEvents))
            ),
            finalize(() => {
                this._watchedBranches.delete(name);
                this._client.send(UNWATCH_BRANCH, name);
            })
        );
    }

    /**
     * Starts watching the given branch.
     * @param name The name of the branch to watch.
     */
    watchBranchUpdates(nameOrEvent: string | WatchBranchEvent) {
        let branchEvent: WatchBranchEvent;
        if (typeof nameOrEvent === 'string') {
            branchEvent = {
                branch: nameOrEvent,
                protocol: 'updates',
            };
        } else {
            branchEvent = {
                ...nameOrEvent,
                protocol: 'updates',
            };
        }
        const name = branchEvent.branch;
        this._watchedBranches.add(name);
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(WATCH_BRANCH, branchEvent);

                let list = this._getSentUpdates(name);

                for (let [key, value] of list) {
                    this._sendAddUpdates(name, value, key);
                }
            }),
            switchMap((connected) =>
                merge(
                    this._client.event<AddUpdatesEvent>(ADD_UPDATES).pipe(
                        filter((event) => event.branch === name),
                        scan(
                            (acc, event) => {
                                // This is the first event
                                if (acc[0] === null) {
                                    // first event is initial event,
                                    // skip to processing events
                                    if (event.initial) {
                                        return ['event', event] as [
                                            'event',
                                            AddUpdatesEvent
                                        ];
                                    } else {
                                        // first event is not initial.
                                        // store it for later.
                                        return ['waiting', [event]] as [
                                            'waiting',
                                            AddUpdatesEvent[]
                                        ];
                                    }
                                } else if (acc[0] === 'waiting') {
                                    // This event is happening while we are waiting for the initial event.
                                    const events = acc[1] as AddUpdatesEvent[];
                                    if (event.initial) {
                                        // current event is initial event,
                                        // merge events.
                                        const allEvents = events;
                                        const allUpdates = lodashFlatMap(
                                            allEvents,
                                            (e) => e.updates ?? []
                                        );

                                        return [
                                            'event',
                                            {
                                                branch: event.branch,
                                                updates: [
                                                    ...allUpdates,
                                                    ...event.updates,
                                                ],
                                            } as AddUpdatesEvent,
                                        ] as ['event', AddUpdatesEvent];
                                    } else {
                                        // current event is not initial,
                                        // store event
                                        return [
                                            'waiting',
                                            [...events, event],
                                        ] as ['waiting', AddUpdatesEvent[]];
                                    }
                                } else {
                                    // This event is happening after we have got the initial event
                                    return ['event', event] as [
                                        'event',
                                        AddUpdatesEvent
                                    ];
                                }
                            },
                            [null] as
                                | [null]
                                | ['waiting', AddUpdatesEvent[]]
                                | ['event', AddUpdatesEvent]
                        ),
                        filter(([type, event]) => type === 'event'),
                        map(([type, event]) => event as AddUpdatesEvent),
                        map(
                            (e) =>
                                ({
                                    type: 'updates',
                                    updates: e.updates,
                                } as ClientUpdates)
                        )
                    ),
                    this._client
                        .event<UpdatesReceivedEvent>(UPDATES_RECEIVED)
                        .pipe(
                            filter((event) => event.branch === name),
                            tap((event) => {
                                if (branchEvent.temporary) {
                                    return;
                                }
                                let list = this._getSentUpdates(event.branch);
                                list.delete(event.updateId);
                            }),
                            map(
                                (event) =>
                                    ({
                                        type: 'updates_received',
                                    } as ClientUpdatesReceived)
                            )
                        ),
                    this._client
                        .event<ReceiveDeviceActionEvent>(RECEIVE_EVENT)
                        .pipe(
                            filter((event) => event.branch === name),
                            map(
                                (event) =>
                                    ({
                                        type: 'event',
                                        action: event.action,
                                    } as ClientEvent)
                            )
                        )
                ).pipe(filter(isClientUpdatesOrEvents))
            ),
            finalize(() => {
                this._watchedBranches.delete(name);
                this._client.send(UNWATCH_BRANCH, name);
            })
        );
    }

    /**
     * Gets the atoms stored on the given branch.
     * @param name The name of the branch to get.
     */
    getBranch(name: string) {
        return this._whenConnected().pipe(
            first((connected) => connected),
            tap((connected) => {
                this._client.send(GET_BRANCH, name);
            }),
            switchMap((connected) =>
                this._client.event<AddAtomsEvent>(ADD_ATOMS).pipe(
                    first((event) => event.branch === name),
                    map((event) => event.atoms)
                )
            )
        );
    }

    watchBranches() {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(WATCH_BRANCHES, undefined);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<LoadBranchEvent>(LOAD_BRANCH)
                        .pipe(
                            map((e) => ({ type: LOAD_BRANCH, ...e } as const))
                        ),
                    this._client
                        .event<UnloadBranchEvent>(UNLOAD_BRANCH)
                        .pipe(
                            map((e) => ({ type: UNLOAD_BRANCH, ...e } as const))
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
            tap((connected) => {
                this._client.send(WATCH_DEVICES, undefined);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<ConnectedToBranchEvent>(
                            DEVICE_CONNECTED_TO_BRANCH
                        )
                        .pipe(
                            filter((e) => e.broadcast === true),
                            map(
                                (e) =>
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
                            filter((e) => e.broadcast === true),
                            map(
                                (e) =>
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
     * Watches for device connection/disconnection events on the given branch.
     * @param branch The branch to watch.
     */
    watchBranchDevices(branch: string) {
        return this._whenConnected(false).pipe(
            switchMap((connected) =>
                // Grab all of the currently connected devices
                // and send disconnected events for them
                !connected
                    ? this._disconnectDevices(branch)
                    : this._watchConnectedDevices(branch)
            )
        );
    }

    private _disconnectDevices(branch: string) {
        return of(
            ...[...this._getConnectedDevices(branch).values()].map(
                (device) =>
                    ({
                        type: DEVICE_DISCONNECTED_FROM_BRANCH,
                        broadcast: false,
                        branch: branch,
                        device: device,
                    } as const)
            )
        );
    }

    private _watchConnectedDevices(branch: string) {
        return of(true).pipe(
            tap((connected) => {
                this._client.send(WATCH_BRANCH_DEVICES, branch);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<ConnectedToBranchEvent>(
                            DEVICE_CONNECTED_TO_BRANCH
                        )
                        .pipe(
                            filter(
                                (e) =>
                                    e.broadcast === false &&
                                    e.branch.branch === branch
                            ),
                            tap((e) => {
                                const devices = this._getConnectedDevices(
                                    branch
                                );
                                devices.set(
                                    e.device.claims[SESSION_ID_CLAIM],
                                    e.device
                                );
                            }),
                            map(
                                (e) =>
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
                            filter(
                                (e) =>
                                    e.broadcast === false && e.branch === branch
                            ),
                            tap((e) => {
                                const devices = this._getConnectedDevices(
                                    branch
                                );
                                devices.delete(
                                    e.device.claims[SESSION_ID_CLAIM]
                                );
                            }),
                            map(
                                (e) =>
                                    ({
                                        type: DEVICE_DISCONNECTED_FROM_BRANCH,
                                        ...e,
                                    } as const)
                            )
                        )
                )
            ),
            finalize(() => {
                this._client.send(UNWATCH_BRANCH_DEVICES, branch);
            })
        );
    }

    /**
     * Gets the info for the given branch.
     * @param branch The branch.
     */
    branchInfo(branch: string) {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(BRANCH_INFO, branch);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<BranchInfoEvent>(BRANCH_INFO)
                        .pipe(first((e) => e.branch === branch))
                )
            )
        );
    }

    /**
     * Requests a list of branches.
     */
    branches() {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(BRANCHES, undefined);
            }),
            switchMap((connected) =>
                merge(this._client.event<BranchesEvent>(BRANCHES).pipe(first()))
            )
        );
    }

    /**
     * Requests that the given branch have its password changed.
     * @param branch The branch.
     * @param oldPassword The old password.
     * @param newPassword The new password.
     */
    setBranchPassword(
        branch: string,
        oldPassword: string,
        newPassword: string
    ) {
        return this._whenConnected().pipe(
            first((connected) => connected),
            tap((connected) => {
                this._client.send(SET_BRANCH_PASSWORD, {
                    branch,
                    oldPassword,
                    newPassword,
                } as SetBranchPasswordEvent);
            })
        );
    }

    /**
     * Requests that the current session be able to write to the given branch.
     * @param branch The branch.
     * @param password The password.
     */
    authenticateBranchWrites(
        branch: string,
        password: string
    ): Observable<boolean> {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(AUTHENTICATE_BRANCH_WRITES, {
                    branch,
                    password,
                } as AuthenticateBranchWritesEvent);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<AuthenticatedToBranchEvent>(
                            AUTHENTICATED_TO_BRANCH
                        )
                        .pipe(
                            filter((e) => e.branch === branch),
                            map((e) => e.authenticated)
                        )
                )
            )
        );
    }

    /**
     * Requests status information for the list of branches.
     */
    branchesStatus() {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(BRANCHES_STATUS, undefined);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<BranchesStatusEvent>(BRANCHES_STATUS)
                        .pipe(first())
                )
            )
        );
    }

    /**
     * Requests a list of devices that are currently connected.
     * @param branch The branch that the devices should be retrieved from.
     */
    devices(branch?: string) {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(DEVICES, branch);
            }),
            switchMap((connected) =>
                merge(this._client.event<DevicesEvent>(DEVICES).pipe(first()))
            )
        );
    }

    /**
     * Requests the number of devices that are currently connected.
     * @param branch The branch that the devices should be counted on.
     */
    deviceCount(branch: string = null) {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(DEVICE_COUNT, branch);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<DeviceCountEvent>(DEVICE_COUNT)
                        .pipe(first((e) => e.branch === branch))
                )
            ),
            map((e) => e.count)
        );
    }

    /**
     * Adds the given atoms to the given branch.
     * @param branch The name of the branch.
     * @param atoms The atoms to add.
     */
    addAtoms(branch: string, atoms: Atom<any>[], removedAtoms?: string[]) {
        let list = this._getSentAtoms(branch);
        if (atoms) {
            for (let atom of atoms) {
                list.set(atom.hash, atom);
            }
        }
        if (removedAtoms) {
            for (let atom of removedAtoms) {
                list.set(atom, null);
            }
        }

        this._sendAddAtoms(branch, atoms, removedAtoms);
    }

    addUpdates(branch: string, updates: string[]) {
        if (updates.length <= 0) {
            return;
        }

        let list = this._getSentUpdates(branch);

        this._updateCounter += 1;
        list.set(this._updateCounter, updates);

        this._sendAddUpdates(branch, updates, this._updateCounter);
    }

    /**
     * Sends the given action to devices on the given branch.
     * @param branch The branch.
     * @param action The action.
     */
    sendEvent(branch: string, action: RemoteActions) {
        this._client.send(SEND_EVENT, {
            branch: branch,
            action: action,
        });
    }

    /**
     * Sends a commit event to the given branch.
     * @param branch The branch.
     * @param message The commit message.
     */
    commit(branch: string, message: string): Observable<CommitCreatedEvent> {
        return this._whenConnected().pipe(
            tap((connected) => {
                const event: CommitEvent = {
                    branch: branch,
                    message: message,
                };
                this._client.send(COMMIT, event);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<CommitCreatedEvent>(COMMIT_CREATED)
                        .pipe(first((e) => e.branch === branch))
                )
            )
        );
    }

    /**
     * Checks out the given hash for the given branch.
     * @param branch The branch to move.
     * @param hash The hash that the branch should checkout.
     */
    checkout(branch: string, hash: string) {
        const event: CheckoutEvent = {
            branch: branch,
            commit: hash,
        };
        this._client.send(CHECKOUT, event);
    }

    restore(branch: string, hash: string): Observable<RestoredEvent> {
        return this._whenConnected().pipe(
            tap((connected) => {
                const event: RestoreEvent = {
                    branch: branch,
                    commit: hash,
                };
                this._client.send(RESTORE, event);
            }),
            switchMap((connected) =>
                merge(
                    this._client
                        .event<RestoredEvent>(RESTORED)
                        .pipe(first((e) => e.branch === branch))
                )
            )
        );
    }

    watchCommits(branch: string): Observable<AddCommitsEvent> {
        return this._whenConnected().pipe(
            tap((connected) => {
                this._client.send(WATCH_COMMITS, branch);
            }),
            switchMap((connected) =>
                this._client
                    .event<AddCommitsEvent>(ADD_COMMITS)
                    .pipe(filter((event) => event.branch === branch))
            ),
            finalize(() => {
                this._client.send(UNWATCH_COMMITS, branch);
            })
        );
    }

    private _whenConnected(filter: boolean = true) {
        return whenConnected(this._client.connectionState, filter);
    }

    private _sendAddAtoms(
        branch: string,
        atoms: Atom<any>[],
        removedAtoms: string[]
    ) {
        if (this._watchedBranches.has(branch) && !this.connection.isConnected) {
            // Skip sending the atoms because we're watching the branch and we're not connected.
            // This means that the new atoms are saved in the sent atoms list so they will be resent
            // when we reconnect.
            return;
        }
        let event: AddAtomsEvent = {
            branch: branch,
        };
        if (atoms && atoms.length > 0) {
            event.atoms = atoms;
        }
        if (removedAtoms && removedAtoms.length > 0) {
            event.removedAtoms = removedAtoms;
        }
        this._client.send(ADD_ATOMS, event);
    }

    private _sendAddUpdates(
        branch: string,
        updates: string[],
        updateId: number
    ) {
        if (this._watchedBranches.has(branch) && !this.connection.isConnected) {
            // Skip sending the atoms because we're watching the branch and we're not connected.
            // This means that the new atoms are saved in the sent atoms list so they will be resent
            // when we reconnect.
            return;
        }
        let event: AddUpdatesEvent = {
            branch: branch,
            updates,
            updateId,
        };
        this._client.send(ADD_UPDATES, event);
    }

    private _getSentAtoms(branch: string) {
        let map = this._sentAtoms.get(branch);
        if (!map) {
            map = new Map();
            this._sentAtoms.set(branch, map);
        }
        return map;
    }

    private _getSentUpdates(branch: string) {
        let map = this._sentUpdates.get(branch);
        if (!map) {
            map = new Map();
            this._sentUpdates.set(branch, map);
        }
        return map;
    }

    private _getConnectedDevices(branch: string) {
        let map = this._connectedDevices.get(branch);
        if (!map) {
            map = new Map();
            this._connectedDevices.set(branch, map);
        }
        return map;
    }
}

export interface ClientAtoms {
    type: 'atoms';
    atoms?: Atom<any>[];
    removedAtoms?: string[];
}

export interface ClientResetAtoms {
    type: 'reset';
    atoms: Atom<any>[];
}

export interface ClientUpdates {
    type: 'updates';
    updates: string[];
}

export interface ClientUpdatesReceived {
    type: 'updates_received';
}

export interface ClientAtomsReceived {
    type: 'atoms_received';
}

export interface ClientEvent {
    type: 'event';
    action: DeviceAction | DeviceActionResult | DeviceActionError;
}

export type ClientWatchBranchEvents =
    | ClientAtoms
    | ClientAtomsReceived
    | ClientEvent
    | ClientResetAtoms;

export type ClientWatchBranchUpdatesEvents =
    | ClientUpdates
    | ClientUpdatesReceived
    | ClientEvent;

export type ClientAtomsOrEvent = ClientAtoms | ClientEvent | ClientResetAtoms;
export type ClientUpdatesOrEvent = ClientUpdates | ClientEvent;

export function isClientAtoms(
    event: ClientWatchBranchEvents
): event is ClientAtoms {
    return event.type === 'atoms';
}

export function isClientEvent(
    event: ClientWatchBranchEvents | ClientWatchBranchUpdatesEvents
): event is ClientEvent {
    return event.type === 'event';
}

export function isClientAtomsOrEvents(
    event: ClientWatchBranchEvents
): event is ClientAtomsOrEvent {
    return (
        event.type === 'atoms' ||
        event.type === 'event' ||
        event.type === 'reset'
    );
}

export function isClientResetAtoms(
    event: ClientWatchBranchEvents
): event is ClientResetAtoms {
    return event.type === 'reset';
}

export function isClientUpdates(
    event: ClientWatchBranchUpdatesEvents
): event is ClientUpdates {
    return event.type === 'updates';
}

export function isClientUpdatesOrEvents(
    event: ClientWatchBranchUpdatesEvents
): event is ClientUpdatesOrEvent {
    return event.type === 'updates' || event.type === 'event';
}

function whenConnected(
    observable: Observable<ClientConnectionState>,
    filterConnected: boolean = true
): Observable<boolean> {
    return observable.pipe(
        map((s) => s.connected),
        distinctUntilChanged(),
        filterConnected ? filter((connected) => connected) : (a) => a
    );
}
