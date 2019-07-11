import { DeviceChannelConnection } from './DeviceChannelConnection';
/**
 * Defines an interface that represents a connection to a device.
 * Calling unsubscribe should
 */
export interface DeviceConnection<TExtra> {
    id: string;
    extra: TExtra;
}
