import { Observable } from 'rxjs';
import {
    AddAtomsEvent,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    BranchInfoEvent,
    SendRemoteActionEvent,
    CommitEvent,
    CheckoutEvent,
    RestoreEvent,
    WatchBranchEvent,
    SetBranchPasswordEvent,
    AuthenticateBranchWritesEvent,
    AddUpdatesEvent,
    TimeSyncResponse,
    TimeSyncRequest,
} from './CausalRepoEvents';
import { DeviceInfo } from '../core/DeviceInfo';

/**
 * Defines a connection to a session that is able to send a receive generic events.
 */
export interface GenericSession {
    /**
     * The ID of the connection.
     */
    device: DeviceInfo;

    /**
     * Gets an observable for events over the given channel name.
     * @param event The name of the channel that events are sent over.
     */
    event<T>(event: string): Observable<T>;

    /**
     * Sends an event over the given channel with the given data.
     * @param name The name of the channel.
     * @param data The data.
     */
    send(name: string, data: any): void;

    /**
     * Gets an observable for when the session disconnects.
     */
    disconnect: Observable<DisconnectionReason>;
}

export type DisconnectionReason =
    | 'transport_error'
    | 'transport_close'
    | 'server_disconnect'
    | 'client_disconnect'
    | 'timeout'
    | 'other';

export interface CausalRepoMessageHandlerTypes {
    'repo/watch_branches': void;
    'repo/unwatch_branches': void;
    'repo/watch_branch': WatchBranchEvent;
    'repo/get_branch': string;
    'repo/get_updates': string;
    'repo/unwatch_branch': string;
    'repo/add_atoms': AddAtomsEvent;
    'repo/add_updates': AddUpdatesEvent;
    'repo/send_event': SendRemoteActionEvent;
    'repo/watch_devices': void;
    'repo/unwatch_devices': void;
    'repo/watch_branch_devices': string;
    'repo/unwatch_branch_devices': string;
    'repo/branch_info': string;
    'repo/branches': void;
    'repo/branches_status': void;
    'repo/devices': string;
    'repo/device_count': string;
    'repo/commit': CommitEvent;
    'repo/watch_commits': string;
    'repo/unwatch_commits': string;
    'repo/checkout': CheckoutEvent;
    'repo/restore': RestoreEvent;
    'repo/set_branch_password': SetBranchPasswordEvent;
    'repo/authenticate_branch_writes': AuthenticateBranchWritesEvent;
    'sync/time': TimeSyncRequest;
}

export type CausalRepoMessageHandlerMethods = {
    [K in keyof CausalRepoMessageHandlerTypes]: (
        value: CausalRepoMessageHandlerTypes[K]
    ) => Promise<any>;
};

/**
 * Defines a connection to a session that is for a causal repo.
 */
export interface CausalRepoSession extends GenericSession {
    /**
     * Gets an observable for events that start watching
     * branches for load/unload events.
     */
    event(name: 'repo/watch_branches'): Observable<void>;
    /**
     * Gets an observable for events that stop watching branches for load/unload events.
     */
    event(name: 'repo/unwatch_branches'): Observable<void>;
    /**
     * Gets an observable for events that start watching
     * the notified branches for new atoms.
     */
    event(name: 'repo/watch_branch'): Observable<WatchBranchEvent>;
    /**
     * Gets an observable for events that stop watching
     * the notified branches for new atoms.
     */
    event(name: 'repo/unwatch_branch'): Observable<string>;
    /**
     * Gets an observable for events that retrieve the list of atoms in a branch.
     */
    event(name: 'repo/get_branch'): Observable<void>;
    /**
     * Gets an observable for events that add the given atoms to a branch.
     */
    event(name: 'repo/add_atoms'): Observable<AddAtomsEvent>;
    /**
     * Gets an observable for events that send a remote action to a branch.
     */
    event(name: 'repo/send_event'): Observable<SendRemoteActionEvent>;
    /**
     * Gets an observable for events that start watching
     * for connection/disconnection events.
     */
    event(name: 'repo/watch_devices'): Observable<void>;
    /**
     * Gets an observable for events that stop watching
     * for connection/disconnection events.
     */
    event(name: 'repo/unwatch_devices'): Observable<void>;
    /**
     * Gets an observable for events that start watching
     * for connection/disconnection events on a particular branch.
     */
    event(name: 'repo/watch_branch_devices'): Observable<string>;
    /**
     * Gets an observable for events that stop watching
     * for connection/disconnection events on a particular branch.
     */
    event(name: 'repo/unwatch_branch_devices'): Observable<string>;
    /**
     * Gets an observable for events that request branch info.
     */
    event(name: 'repo/branch_info'): Observable<string>;
    /**
     * Gets an observable for events that request a list of available branches.
     */
    event(name: 'repo/branches'): Observable<void>;
    /**
     * Gets an observable for events that request a list of connected devices.
     */
    event(name: 'repo/devices'): Observable<string>;
    /**
     * Gets an observable for events which make a commit for a branch.
     */
    event(name: 'repo/commit'): Observable<CommitEvent>;
    /**
     * Gets an observable for events that start watching commits on a branch.
     */
    event(name: 'repo/watch_commits'): Observable<string>;
    /**
     * Gets an observable for events that stop watching commits on a branch.
     */
    event(name: 'repo/unwatch_commits'): Observable<string>;
    /**
     * Gets an observable for events that request a branch checkout a commit.
     */
    event(name: 'repo/checkout'): Observable<CheckoutEvent>;
    /**
     * Gets an observable for events that request a branch be restored to a commit.
     */
    event(name: 'repo/restore'): Observable<RestoreEvent>;

    /**
     * Sends the given event to the session.
     * @param name The name of the event.
     * @param data The event data.
     */
    send(name: string, data: any): void;
    send(name: 'repo/add_atoms', data: AddAtomsEvent): void;
    send(
        name: 'repo/device_connected_to_branch',
        data: ConnectedToBranchEvent
    ): void;
    send(
        name: 'repo/device_disconnected_from_branch',
        data: DisconnectedFromBranchEvent
    ): void;
    send(name: 'sync/time', data: TimeSyncResponse): void;
}
