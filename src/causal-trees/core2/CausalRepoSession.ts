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
    disconnect: Observable<any>;
}

export interface CausalRepoMessageHandlerTypes {
    'repo/watch_branches': void;
    'repo/unwatch_branches': void;
    'repo/watch_branch': string;
    'repo/unwatch_branch': string;
    'repo/add_atoms': AddAtomsEvent;
    'repo/send_event': SendRemoteActionEvent;
    'repo/watch_devices': void;
    'repo/unwatch_devices': void;
    'repo/branch_info': string;
    'repo/branches': void;
    'repo/commit': CommitEvent;
    'repo/watch_commits': string;
    'repo/unwatch_commits': string;
    'repo/checkout': CheckoutEvent;
    'repo/restore': RestoreEvent;
}

export type CausalRepoMessageHandlerMethods = {
    [K in keyof CausalRepoMessageHandlerTypes]: (
        value: CausalRepoMessageHandlerTypes[K]
    ) => Promise<any>
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
    event(name: 'repo/watch_branch'): Observable<string>;
    /**
     * Gets an observable for events that stop watching
     * the notified branches for new atoms.
     */
    event(name: 'repo/unwatch_branch'): Observable<string>;
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
     * Gets an observable for events that request branch info.
     */
    event(name: 'repo/branch_info'): Observable<string>;
    /**
     * Gets an observable for events that request a list of available branches.
     */
    event(name: 'repo/branches'): Observable<void>;
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
}
