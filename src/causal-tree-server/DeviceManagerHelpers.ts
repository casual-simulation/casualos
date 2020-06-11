import { DeviceConnection } from './DeviceConnection';
import {
    RealtimeChannelInfo,
    RemoteAction,
    DeviceInfo,
    USERNAME_CLAIM,
    SESSION_ID_CLAIM,
    DEVICE_ID_CLAIM,
    DeviceSelector,
} from '@casual-simulation/causal-trees';
import { DeviceChannelConnection } from './DeviceChannelConnection';
import { DeviceManager } from './DeviceManager';
import { Observable, Observer } from 'rxjs';

/**
 * Creates a new cold observable which joins the given device to the given channel
 * and leaves the channel when unsubscribed from.
 * @param manager The manager.
 * @param device The device to connect to the channel.
 * @param info The info about the channel.
 */
export function connectDeviceChannel<TExtra>(
    manager: DeviceManager,
    device: DeviceConnection<TExtra>,
    info: RealtimeChannelInfo
): Observable<DeviceChannelConnection> {
    return Observable.create((observer: Observer<DeviceChannelConnection>) => {
        setup();

        return () => {
            manager.leaveChannel(device, info);
        };

        async function setup() {
            const connection = await manager.joinChannel(device, info);
            observer.next(connection);
        }
    });
}

export function devicesForEvent(
    event: DeviceSelector,
    devices: (readonly [DeviceConnection<any>, DeviceInfo])[]
): DeviceConnection<any>[] {
    return devices.filter(d => isEventForDevice(event, d[1])).map(d => d[0]);
}

export function isEventForDevice(
    event: DeviceSelector,
    device: DeviceInfo
): boolean {
    if (event.username === device.claims[USERNAME_CLAIM]) {
        return true;
    } else if (event.sessionId === device.claims[SESSION_ID_CLAIM]) {
        return true;
    } else if (event.deviceId === device.claims[DEVICE_ID_CLAIM]) {
        return true;
    }
    return false;
}
