import { Atom } from './Atom2';

/**
 * The name of the event which starts watching for when branches are loaded/unloaded.
 */
export const WATCH_BRANCHES = 'watch_branches';

/**
 * The name of the event which stops watching for when branches are loaded/unloaded.
 */
export const UNWATCH_BRANCHES = 'unwatch_branches';

/**
 * The name of the event which starts watching changes on a branch.
 * In particular, watches for new atoms.
 */
export const WATCH_BRANCH = 'watch_branch';

/**
 * The name of the event which stops watching changes on a branch.
 */
export const UNWATCH_BRANCH = 'unwatch_branch';

/**
 * The name of the event which notifies that some atoms were added to a branch.
 */
export const ADD_ATOMS = 'add_atoms';

/**
 * The name of the event which notifies that a branch was loaded into server memory.
 */
export const LOAD_BRANCH = 'load_branch';

/**
 * The name of the event which notifies that a branch was unloaded from server memory.
 */
export const UNLOAD_BRANCH = 'unload_branch';

/**
 * The name of the event which starts watching for connection/disconnection events to the server.
 */
export const WATCH_DEVICES = 'watch_devices';

/**
 * The name of the event which stops watching for connection/disconnection events to the server.
 */
export const UNWATCH_DEVICES = 'unwatch_devices';

/**
 * The name of the event which notifies that a device became connected to a branch.
 */
export const DEVICE_CONNECTED_TO_BRANCH = 'device_connected_to_branch';

/**
 * The name of the event which notifies that a device become disconnected from a branch.
 */
export const DEVICE_DISCONNECTED_FROM_BRANCH =
    'device_disconnected_from_branch';

/**
 * Defines an event which indicates that atoms should be added for the given branch.
 */
export interface AddAtomsEvent {
    /**
     * The branch that the atoms are for.
     */
    branch: string;

    /**
     * The atoms that were added.
     */
    atoms: Atom<any>[];
}

/**
 * Defines an event which indicates that a connection has been made to a branch.
 */
export interface ConnectedToBranchEvent {
    /**
     * The name of the branch that was connected.
     */
    branch: string;

    /**
     * The ID of the session that connected.
     */
    connectionId: string;
}

/**
 * Defines an event which indicates that a connection has been removed from a branch.
 */
export interface DisconnectedFromBranchEvent {
    /**
     * The name of the branch that was disconnected.
     */
    branch: string;

    /**
     * The ID of the session that disconnected.
     */
    connectionId: string;
}
