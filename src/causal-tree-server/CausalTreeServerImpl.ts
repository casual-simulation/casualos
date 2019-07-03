import { CausalTreeServer } from './CausalTreeServer';
import { DeviceConnection } from './DeviceConnection';
import { DeviceChannelConnection } from './DeviceChannelConnection';
import {
    RealtimeChannelInfo,
    CausalTreeStore,
    CausalTreeFactory,
} from '@casual-simulation/causal-trees';
import { SigningCryptoImpl } from '@casual-simulation/crypto';

export class CausalTreeServerImpl implements CausalTreeServer {
    activeChannels: RealtimeChannelInfo[];

    private _connectedDevices: Map<
        DeviceConnection<any>,
        DeviceChannelConnection[]
    >;
    private _activeChannels: Map<
        DeviceChannelConnection,
        DeviceConnection<any>[]
    >;

    constructor() {
        this._connectedDevices = new Map();
    }

    get connectedDevices(): DeviceConnection<any>[] {
        return [...this._connectedDevices.keys()];
    }

    getConnectedChannels(
        device: DeviceConnection<any>
    ): DeviceChannelConnection[] {
        return this._connectedDevices.get(device);
    }

    getConnectedDevices(info: RealtimeChannelInfo): DeviceConnection<any>[] {
        throw new Error('Method not implemented.');
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
        this._connectedDevices.delete(device);
    }

    async joinChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): Promise<DeviceChannelConnection> {
        const channel = {
            info: info,
        };

        if (this._connectedDevices.has(device)) {
            const list = this._connectedDevices.get(device);
            list.push(channel);
        }

        return channel;
    }

    leaveChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
