import { Atom } from './Atom2';

/**
 * The name of the event which starts watching for when branches are loaded/unloaded.
 */
export const WATCH_BRANCHES = 'repo/watch_branches';

/**
 * The name of the event which stops watching for when branches are loaded/unloaded.
 */
export const UNWATCH_BRANCHES = 'repo/unwatch_branches';

/**
 * The name of the event which starts watching changes on a branch.
 * In particular, watches for new atoms.
 */
export const WATCH_BRANCH = 'repo/watch_branch';

/**
 * The name of the event which stops watching changes on a branch.
 */
export const UNWATCH_BRANCH = 'repo/unwatch_branch';

/**
 * The name of the event which notifies that some atoms were added to a branch.
 */
export const ADD_ATOMS = 'repo/add_atoms';

/**
 * The name of the event which notifies that a branch was loaded into server memory.
 */
export const LOAD_BRANCH = 'repo/load_branch';

/**
 * The name of the event which notifies that a branch was unloaded from server memory.
 */
export const UNLOAD_BRANCH = 'repo/unload_branch';

/**
 * The name of the event which starts watching for connection/disconnection events to the server.
 */
export const WATCH_DEVICES = 'repo/watch_devices';

/**
 * The name of the event which stops watching for connection/disconnection events to the server.
 */
export const UNWATCH_DEVICES = 'repo/unwatch_devices';

/**
 * The name of the event which notifies that a device became connected to a branch.
 */
export const DEVICE_CONNECTED_TO_BRANCH = 'repo/device_connected_to_branch';

/**
 * The name of the event which notifies that a device become disconnected from a branch.
 */
export const DEVICE_DISCONNECTED_FROM_BRANCH =
    'repo/device_disconnected_from_branch';

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
