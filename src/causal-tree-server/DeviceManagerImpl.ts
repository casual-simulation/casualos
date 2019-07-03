import { DeviceManager, ConnectedToChannelListener } from './DeviceManager';
import { DeviceConnection } from './DeviceConnection';
import { DeviceChannelConnection } from './DeviceChannelConnection';
import { RealtimeChannelInfo } from '@casual-simulation/causal-trees';
import { findIndex } from 'lodash';
import { SubscriptionLike, Subscription } from 'rxjs';
import { Device } from 'useragent';

export class DeviceManagerImpl implements DeviceManager {
    activeChannels: RealtimeChannelInfo[];

    private _connectedDevices: Map<
        DeviceConnection<any>,
        ActiveDeviceChannelConnection[]
    >;
    private _activeChannels: Map<string, DeviceConnection<any>[]>;
    private _listeners: ConnectedToChannelListener[];

    constructor() {
        this._connectedDevices = new Map();
        this._activeChannels = new Map();
        this._listeners = [];
    }

    get connectedDevices(): DeviceConnection<any>[] {
        return [...this._connectedDevices.keys()];
    }

    getConnectedChannels(
        device: DeviceConnection<any>
    ): DeviceChannelConnection[] {
        let channels = this._connectedDevices.get(device) || [];
        return channels.slice();
    }

    getConnectedDevices(info: RealtimeChannelInfo): DeviceConnection<any>[] {
        let devices = this._activeChannels.get(info.id) || [];
        return devices.slice();
    }

    whenConnectedToChannel(
        listener: ConnectedToChannelListener
    ): SubscriptionLike {
        this._listeners.push(listener);
        return new Subscription(() => {
            const index = this._listeners.indexOf(listener);
            if (index >= 0) {
                this._listeners.splice(index, 1);
            }
        });
    }

    async connectDevice<TExtra>(
        deviceId: string,
        extra?: TExtra
    ): Promise<DeviceConnection<TExtra>> {
        const device = {
            id: deviceId,
            extra: extra,
        };

        this._connectedDevices.set(device, []);

        return device;
    }

    async disconnectDevice<TExtra>(
        device: DeviceConnection<TExtra>
    ): Promise<void> {
        const channels = this.getConnectedChannels(device);

        for (let channel of channels) {
            await this.leaveChannel(device, channel.info);
        }

        this._connectedDevices.delete(device);
    }

    async joinChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): Promise<DeviceChannelConnection> {
        let subs: SubscriptionLike[] = [];
        const channel: ActiveDeviceChannelConnection = {
            info: info,
            subs: subs,
        };

        if (this._connectedDevices.has(device)) {
            const list = this._connectedDevices.get(device);
            list.push(channel);
        }
        let list = this._activeChannels.get(info.id);
        if (!list) {
            list = [];
            this._activeChannels.set(info.id, list);
        }
        list.push(device);

        for (let listener of this._listeners) {
            subs.push(...listener(device, channel));
        }

        return channel;
    }

    async leaveChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): Promise<void> {
        if (this._connectedDevices.has(device)) {
            const list = this._connectedDevices.get(device);
            const index = findIndex(list, c => c.info.id === info.id);
            if (index >= 0) {
                const channel = list[index];
                channel.subs.forEach(s => s.unsubscribe());
                list.splice(index, 1);
            }
        }
        let list = this._activeChannels.get(info.id);
        if (list) {
            const index = findIndex(list, d => d === device);
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
    }
}

interface ActiveDeviceChannelConnection extends DeviceChannelConnection {
    subs: SubscriptionLike[];
}
