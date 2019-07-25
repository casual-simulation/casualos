import { DeviceConnection } from './DeviceConnection';
import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';
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
        console.log('Setup Channel');
        setup();

        return () => {
            console.log('Leave Channel', device, info.id);
            manager.leaveChannel(device, info);
        };

        async function setup() {
            const connection = await manager.joinChannel(device, info);
            observer.next(connection);
        }
    });
}
