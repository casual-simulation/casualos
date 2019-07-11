import { RealtimeChannelImpl } from './RealtimeChannelImpl';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';
import { TestChannelConnection } from '../test/TestChannelConnection';
import { RealtimeChannelInfo } from './RealtimeChannelInfo';
import { DeviceInfo, USERNAME_CLAIM } from './DeviceInfo';
import { StatusMessage, StatusUpdate } from './StatusUpdate';

describe('RealtimeChannelImpl', () => {
    let info: RealtimeChannelInfo;
    let connection: TestChannelConnection;
    let channel: RealtimeChannelImpl;

    beforeEach(() => {
        info = {
            id: 'test',
            type: 'abc',
        };
        connection = new TestChannelConnection(info);
        channel = new RealtimeChannelImpl(connection);
    });

    it('should try to login when connected', () => {
        channel.connect();
        connection.setConnected(true);

        expect(connection.requests.length).toBe(1);
        expect(connection.requests[0].name).toBe('login');
    });

    it('should try to join the channel after login', async () => {
        channel.connect();
        connection.setConnected(true);

        let device: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'xyz',
            },
            roles: [],
        };
        connection.requests[0].resolve({
            success: true,
            value: device,
        });

        await connection.flushPromises();

        expect(connection.requests.length).toBe(2);
        expect(connection.requests[1].name).toBe('join_channel');
    });

    it('should emit status events upon connection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);

        let device: DeviceInfo = {
            claims: {
                [USERNAME_CLAIM]: 'xyz',
            },
            roles: [],
        };
        connection.requests[0].resolve({
            success: true,
            value: device,
        });

        await connection.flushPromises();

        connection.requests[1].resolve({
            success: true,
            value: null,
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: true,
            },
            {
                type: 'authorization',
                authorized: true,
            },
        ]);
    });

    it('should emit status events upon disconnection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        connection.setConnected(true);
        channel.connect();
        connection.setConnected(false);

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: false,
            },
            {
                type: 'authorization',
                authorized: false,
            },
            {
                type: 'authentication',
                authenticated: false,
            },
        ]);
    });
});
