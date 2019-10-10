import { DeviceInfo } from './DeviceInfo';

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 * @deprecated
 */
export interface Action {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
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
}

/**
 * An event that is used to send events from this device to a remote device.
 */
export interface RemoteAction extends Action, DeviceSelector {
    type: 'remote';

    /**
     * The event that should be sent to the device.
     */
    event: Action;
}

/**
 * Creates a new remote event.
 * @param event The event.
 */
export function remote(event: Action, selector?: DeviceSelector): RemoteAction {
    return {
        type: 'remote',
        event: event,
        ...selector,
    };
}

/**
 * Creates a new device event.
 * @param info The info about the device that is sending the event.
 * @param event The event that is being sent.
 */
export function device(info: DeviceInfo, event: Action): DeviceAction {
    return {
        type: 'device',
        device: info,
        event: event,
    };
}
