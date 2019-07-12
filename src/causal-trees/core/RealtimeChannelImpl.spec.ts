import { RealtimeChannelImpl } from './RealtimeChannelImpl';
import { RealtimeChannelConnection } from './RealtimeChannelConnection';
import { TestChannelConnection } from '../test/TestChannelConnection';
import { RealtimeChannelInfo } from './RealtimeChannelInfo';
import { DeviceInfo, USERNAME_CLAIM } from './DeviceInfo';
import { StatusMessage, StatusUpdate } from './StatusUpdate';
import { User } from '.';

console.log = jest.fn();

describe('RealtimeChannelImpl', () => {
    let info: RealtimeChannelInfo;
    let connection: TestChannelConnection;
    let channel: RealtimeChannelImpl;
    let user: User;

    beforeEach(() => {
        user = {
            id: 'test',
            name: 'Test',
            token: 'token',
            username: 'username',
        };
        info = {
            id: 'test',
            type: 'abc',
        };
        connection = new TestChannelConnection(info);
        channel = new RealtimeChannelImpl(connection);
    });

    it('should initialize the connection', () => {
        channel.connect();

        expect(connection.initialized).toBe(true);
    });

    it('should unsubscribe the connection when unsubscribed', () => {
        channel.connect();
        channel.unsubscribe();

        expect(connection.closed).toBe(true);
    });

    it('should try to login when connected and has a user', () => {
        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);

        expect(connection.requests.length).toBe(1);
        expect(connection.requests[0].name).toBe('login');
    });

    it('should try to join the channel after login', async () => {
        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);

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
        channel.setUser(user);

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
                user: user,
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

        channel.connect();
        connection.setConnected(false);
        channel.setUser(user);

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

    it('should emit status events upon setting the user to null', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(null);

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
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

    it('should return the login error reason from the connection', async () => {
        let events: StatusUpdate[] = [];
        channel.statusUpdated.subscribe(e => events.push(e));

        channel.connect();
        connection.setConnected(true);
        channel.setUser(user);
        connection.requests[0].resolve({
            success: false,
            value: null,
            error: {
                type: 'not_authenticated',
                reason: 'reason',
            },
        });

        await connection.flushPromises();

        expect(events).toEqual([
            {
                type: 'connection',
                connected: true,
            },
            {
                type: 'authentication',
                authenticated: false,
                reason: 'reason',
            },
        ]);
    });
});
