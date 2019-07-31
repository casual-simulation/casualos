import { DeviceInfo } from './DeviceInfo';

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a channel.
 * @deprecated
 */
export interface Event {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
}

/**
 * An event that is used to indicate an event that was sent from a remote device.
 */
export interface DeviceEvent extends Event {
    type: 'device';

    /**
     * The device which sent the event.
     */
    device: DeviceInfo;

    /**
     * The event.
     */
    event: Event;
}

/**
 * An event that is used to send events from this device to a remote device.
 */
export interface RemoteEvent extends Event {
    type: 'remote';

    /**
     * The event that should be sent to the device.
     */
    event: Event;

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
 * Creates a new remote event.
 * @param event The event.
 */
export function remote(
    event: Event,
    selector?: { deviceId?: string; sessionId?: string; username?: string }
): RemoteEvent {
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
export function device(info: DeviceInfo, event: Event): DeviceEvent {
    return {
        type: 'device',
        device: info,
        event: event,
    };
}
