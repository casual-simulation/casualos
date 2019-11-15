import { Observable } from 'rxjs';
import {
    AddAtomsEvent,
    ConnectedToBranchEvent,
    DisconnectedFromBranchEvent,
} from './CausalRepoEvents';

/**
 * Defines a connection to a session that is able to send a receive generic events.
 */
export interface GenericSession {
    /**
     * The ID of the connection.
     */
    id: string;

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
    event(name: 'watch_branches'): Observable<void>;
    /**
     * Gets an observable for events that stop watching branches for load/unload events.
     */
    event(name: 'unwatch_branches'): Observable<void>;
    /**
     * Gets an observable for events that start watching
     * the notified branches for new atoms.
     */
    event(name: 'watch_branch'): Observable<string>;
    /**
     * Gets an observable for events that stop watching
     * the notified branches for new atoms.
     */
    event(name: 'unwatch_branch'): Observable<string>;
    /**
     * Gets an observable for events that add the given atoms to a branch.
     */
    event(name: 'add_atoms'): Observable<AddAtomsEvent>;
    /**
     * Gets an observable for events that start watching
     * for connection/disconnection events.
     */
    event(name: 'watch_devices'): Observable<void>;
    /**
     * Gets an observable for events that stop watching
     * for connection/disconnection events.
     */
    event(name: 'unwatch_devices'): Observable<void>;

    /**
     * Sends the given event to the session.
     * @param name The name of the event.
     * @param data The event data.
     */
    send(name: string, data: any): void;
    send(name: 'add_atoms', data: AddAtomsEvent): void;
    send(
        name: 'device_connected_to_branch',
        data: ConnectedToBranchEvent
    ): void;
    send(
        name: 'device_disconnected_from_branch',
        data: DisconnectedFromBranchEvent
    ): void;
}
