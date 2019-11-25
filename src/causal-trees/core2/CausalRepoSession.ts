import { Observable } from 'rxjs';
import {
    AddAtomsEvent,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
    BranchInfoEvent,
    SendRemoteActionEvent,
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
