import { DeviceManagerImpl } from './DeviceManagerImpl';
import { DeviceConnection } from './DeviceConnection';
import { DeviceChannelConnection } from './DeviceChannelConnection';
import { fake } from 'sinon';
import { Subscription } from 'rxjs';

describe('CausalTreeServerImpl', () => {
    let server: DeviceManagerImpl;

    beforeEach(() => {
        server = new DeviceManagerImpl();
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
        let device: DeviceConnection<any>;
        beforeEach(async () => {
            device = await server.connectDevice('deviceId', {
                extra: true,
            });
        });

        it('should remove the given device from the list of connected devices', async () => {
            await server.disconnectDevice(device);

            expect(server.connectedDevices).toEqual([]);
        });

        it('should remove the given device from the channels it is connected to', async () => {
            const channel1 = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            const channel2 = await server.joinChannel(device, {
                id: 'test2',
                type: 'number2',
            });

            await server.disconnectDevice(device);

            const channels = server.getConnectedChannels(device);
            const devices1 = server.getConnectedDevices(channel1.info);
            const devices2 = server.getConnectedDevices(channel2.info);

            expect(channels).toEqual([]);
            expect(devices1).toEqual([]);
            expect(devices2).toEqual([]);
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

        it('should allow joining channels with the same ID but different types', async () => {
            const channel1 = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });
            const channel2 = await server.joinChannel(device, {
                id: 'test',
                type: 'different',
            });

            const devices1 = server.getConnectedDevices(channel1.info);
            expect(devices1).toEqual([device]);

            const devices2 = server.getConnectedDevices(channel2.info);
            expect(devices2).toEqual([device]);

            const channels = server.getConnectedChannels(device);
            expect(channels).toEqual([channel1, channel2]);
        });
    });

    describe('leaveChannel()', () => {
        let device: DeviceConnection<any>;
        let channel: DeviceChannelConnection;

        beforeEach(async () => {
            device = await server.connectDevice('deviceId', {
                extra: true,
            });

            channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });
        });

        it('should remove the device from the channel list', async () => {
            await server.leaveChannel(device, channel.info);

            const channels = server.getConnectedChannels(device);
            const devices = server.getConnectedDevices(channel.info);

            expect(server.connectedDevices).toEqual([device]);
            expect(channels).toEqual([]);
            expect(devices).toEqual([]);
        });
    });

    describe('whenConnectedToChannel()', () => {
        it('should call the given function when a device connects', async () => {
            const listener = fake.returns([]);
            server.whenConnectedToChannel(listener);

            const device = await server.connectDevice('deviceId', {
                test: true,
            });

            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            expect(listener.called).toBe(true);
            expect(listener.args).toEqual([[device, channel]]);
        });

        it('should dispose the returned subscriptions when the device leaves the channel', async () => {
            const subs = [new Subscription(), new Subscription()];
            const listener = fake.returns(subs);
            server.whenConnectedToChannel(listener);

            const device = await server.connectDevice('deviceId', {
                test: true,
            });

            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            await server.leaveChannel(device, channel.info);

            expect(subs.map(s => s.closed)).toEqual([true, true]);
        });

        it('should return a subscription that unregisters the listener', async () => {
            const listener = fake.returns([]);
            const sub = server.whenConnectedToChannel(listener);

            const device = await server.connectDevice('deviceId', {
                test: true,
            });

            sub.unsubscribe();

            const channel = await server.joinChannel(device, {
                id: 'test',
                type: 'number',
            });

            expect(listener.called).toBe(false);
        });
    });
});
