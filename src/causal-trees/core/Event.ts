import { DeviceInfo } from './DeviceInfo';

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 */
export interface Action {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;

    /**
     * Whether the action can be structure cloned.
     * If true, then the action should not be passed across message ports.
     */
    uncopiable?: boolean;
}

/**
 * An event that is used to indicate an event that was sent from a remote device.
 */
export interface DeviceAction extends Action {
    type: 'device';

    /**
     * The device which sent the event.
     */
    device: DeviceInfo;

    /**
     * The event.
     */
    event: Action;

    /**
     * The ID of the task that this action was sent with.
     */
    taskId?: number | string;
}

/**
 * An interface that is used to determine which device to send a remote event to.
 */
export interface DeviceSelector {
    /**
     * The ID of the session that the event should be sent to.
     */
    sessionId?: string;

    /**
     * The ID of the device that the event should be sent to.
     */
    deviceId?: string;

    /**
     * The username of the user that the event should be sent to.
     */
    username?: string;

    /**
     * Whether the event should be broadcast to all users.
     */
    broadcast?: boolean;
}

export type RemoteActions =
    | RemoteAction
    | RemoteActionResult
    | RemoteActionError;

/**
 * An event that is used to send events from this device to a remote device.
 */
export interface RemoteAction extends Action, DeviceSelector {
    type: 'remote';

    /**
     * The event that should be sent to the device.
     */
    event: Action;

    /**
     * Whether this action is allowed to be batched with other remote actions.
     * Batching will preserve ordering between remote actions but may
     * break ordering with respect to bot actions. Defaults to true.
     */
    allowBatching?: boolean;

    /**
     * The ID of the task.
     */
    taskId?: number | string;
}

/**
 * An event that is used to respond to remote actions with some arbitrary data.
 */
export interface RemoteActionResult extends Action, DeviceSelector {
    type: 'remote_result';

    /**
     * The data that is included in the result.
     */
    result?: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;
}

/**
 * An event that is used to response to remote actions with an error.
 */
export interface RemoteActionError extends Action, DeviceSelector {
    type: 'remote_error';

    /**
     * The error that occurred.
     */
    error: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;
}

/**
 * An event that is used to respond to remote actions with some arbitrary data.
 */
export interface DeviceActionResult extends Action {
    type: 'device_result';

    /**
     * The data that is included in the result.
     */
    result: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;

    /**
     * The device which sent the event.
     */
    device: DeviceInfo;
}

/**
 * An event that is used to respond to remote actions with an error.
 */
export interface DeviceActionError extends Action {
    type: 'device_error';

    /**
     * The error that is included in the result.
     */
    error: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;

    /**
     * The device which sent the event.
     */
    device: DeviceInfo;
}

/**
 * Creates a new remote event.
 * @param event The event.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param allowBatching Whether this action is allowed to be batched with other remote actions.
 *                      Batching will preserve ordering between remote actions but may
 *                      break ordering with respect to bot actions. Defaults to true.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remote(
    event: Action,
    selector?: DeviceSelector,
    allowBatching?: boolean,
    taskId?: number | string
): RemoteAction {
    return {
        type: 'remote',
        event: event,
        allowBatching,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new remote event that represents a result to an async task.
 * @param result The result data.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remoteResult(
    result: any,
    selector?: DeviceSelector,
    taskId?: number | string
): RemoteActionResult {
    return {
        type: 'remote_result',
        result,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new remote event that represents an error result to an async task.
 * @param result The result data.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remoteError(
    error: any,
    selector?: DeviceSelector,
    taskId?: number | string
): RemoteActionError {
    return {
        type: 'remote_error',
        error,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new device event.
 * @param info The info about the device that is sending the event.
 * @param data The data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function device(
    info: DeviceInfo,
    event: Action,
    taskId?: number | string
): DeviceAction {
    return {
        type: 'device',
        device: info,
        event: event,
        taskId,
    };
}

/**
 * Creates a new device event that represents the result of an async task.
 * @param info The info about the device that is sending the event.
 * @param result The result data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function deviceResult(
    info: DeviceInfo,
    result: any,
    taskId?: number | string
): DeviceActionResult {
    return {
        type: 'device_result',
        device: info,
        result,
        taskId,
    };
}

/**
 * Creates a new device event that represents an error of an async task.
 * @param info The info about the device that is sending the event.
 * @param error The error data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function deviceError(
    info: DeviceInfo,
    error: any,
    taskId?: number | string
): DeviceActionError {
    return {
        type: 'device_error',
        device: info,
        error,
        taskId,
    };
}
