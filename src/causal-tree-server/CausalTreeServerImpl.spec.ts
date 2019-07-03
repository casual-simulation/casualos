import { CausalTreeServerImpl } from './CausalTreeServerImpl';
import {
    AtomOp,
    CausalTree,
    AtomReducer,
    Weave,
} from '@casual-simulation/causal-trees';
import { DeviceConnection } from './DeviceConnection';

describe('CausalTreeServerImpl', () => {
    let server: CausalTreeServerImpl;

    beforeEach(() => {
        server = new CausalTreeServerImpl();
    });

    describe('connectDevice()', () => {
        it('should return a connected device', async () => {
            const device = await server.connectDevice('deviceId');

            expect(device).toMatchSnapshot();
        });

        it('should include the given extras', async () => {
            const device = await server.connectDevice('deviceId', {
                extra: true,
            });

            expect(device).toMatchSnapshot();
        });

        it('should add the device to the connected devices list', async () => {
            const device = await server.connectDevice('deviceId', {
                extra: true,
            });

            expect(server.connectedDevices).toEqual([device]);
        });
    });

    describe('disconnectDevice()', () => {
        it('should remove the given device from the list of connected devices', async () => {
            const device = await server.connectDevice('deviceId', {
                extra: true,
            });

            await server.disconnectDevice(device);

            expect(server.connectedDevices).toEqual([]);
        });
    });

    describe('joinChannel()', () => {
        let device: DeviceConnection<any>;
        beforeEach(async () => {
            device = await server.connectDevice('deviceId', {
                extra: true,
            });
        });

        it('should return a channel connection', async () => {
            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            expect(channel).toMatchSnapshot();
        });

        it('should add the channel to the list for the device', async () => {
            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            const channels = server.getConnectedChannels(device);
            expect(channels).toEqual([channel]);
        });

        it('should add the device to the list for the channel', async () => {
            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            const devices = server.getConnectedDevices(channel.info);
            expect(devices).toEqual([device]);
        });
    });
});

class Op implements AtomOp {
    type: number;
}

class Tree extends CausalTree<Op, number, any> {}

class NumberReducer implements AtomReducer<Op, number, any> {
    eval(weave: Weave<Op>): [number, any] {
        return [0, null];
    }
}
