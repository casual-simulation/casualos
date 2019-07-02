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
    connectedDevices: DeviceConnection<any>[];
    activeChannels: RealtimeChannelInfo[];

    private _crypto: SigningCryptoImpl;
    private _treeStore: CausalTreeStore;
    private _causalTreeFactory: CausalTreeFactory;

    constructor(
        treeStore: CausalTreeStore,
        causalTreeFactory: CausalTreeFactory,
        crypto: SigningCryptoImpl
    ) {
        this._treeStore = treeStore;
        this._causalTreeFactory = causalTreeFactory;
        this._crypto = crypto;
    }

    getConnectedChannels(
        device: DeviceConnection<any>
    ): DeviceChannelConnection[] {
        throw new Error('Method not implemented.');
    }

    getConnectedDevices(info: RealtimeChannelInfo): DeviceConnection<any>[] {
        throw new Error('Method not implemented.');
    }

    connectDevice<TExtra>(
        deviceId: string,
        extra: TExtra
    ): DeviceConnection<TExtra> {
        throw new Error('Method not implemented.');
    }

    disconnectDevice<TExtra>(device: DeviceConnection<TExtra>): void {
        throw new Error('Method not implemented.');
    }

    joinChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): DeviceChannelConnection {
        throw new Error('Method not implemented.');
    }

    leaveChannel<TExtra>(
        device: DeviceConnection<TExtra>,
        info: RealtimeChannelInfo
    ): void {
        throw new Error('Method not implemented.');
    }
}
