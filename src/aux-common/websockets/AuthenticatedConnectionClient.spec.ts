import {
    ConnectionIndicator,
    ConnectionIndicatorId,
    ConnectionIndicatorToken,
    ConnectionInfo,
} from '../common';
import { AuthenticatedConnectionClient } from './AuthenticatedConnectionClient';
import { MemoryConnectionClient } from './MemoryConnectionClient';
import { waitAsync } from '../test/TestHelpers';
import { ClientConnectionState } from './ConnectionClient';
import { Subject } from 'rxjs';
import { LoginResultMessage } from './WebsocketEvents';
import { PartitionAuthRequest, PartitionAuthSource } from '../partitions';

console.log = jest.fn();

describe('AuthenticatedConnectionClient', () => {
    let subject: AuthenticatedConnectionClient;
    let authSource: PartitionAuthSource;
    let inner: MemoryConnectionClient;

    const indicatorCases: [string, ConnectionIndicator][] = [
        ['connectionId', { connectionId: 'test_connection_id' }],
        ['connectionToken', { connectionToken: 'test_connection_token' }],
    ];

    describe.each(indicatorCases)('%s', (name, indicator) => {
        beforeEach(() => {
            inner = new MemoryConnectionClient();
            inner.origin = 'http://localhost';
            authSource = new PartitionAuthSource(
                new Map([['http://localhost', indicator]])
            );
            subject = new AuthenticatedConnectionClient(inner, authSource);
        });

        it('should attempt to login when the inner client connects', async () => {
            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    ...indicator,
                },
            ]);
        });

        it('wait to send a connection event until the login result is recieved', async () => {
            let loginResult = new Subject<LoginResultMessage>();
            inner.events.set('login_result', loginResult);

            let connectionStates = [] as ClientConnectionState[];
            subject.connectionState.subscribe((state) =>
                connectionStates.push(state)
            );

            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    ...indicator,
                },
            ]);
            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);

            loginResult.next({
                type: 'login_result',
                success: true,
                info: {
                    userId: null,
                    sessionId: null,
                    connectionId: 'test_connection_id',
                },
            });

            await waitAsync();

            expect(connectionStates.slice(1)).toEqual([
                {
                    connected: true,
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: 'test_connection_id',
                    },
                },
            ]);
        });

        it('deduplicate consecutive disconnected events', async () => {
            let connectionStates = [] as ClientConnectionState[];
            subject.connectionState.subscribe((state) =>
                connectionStates.push(state)
            );

            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    ...indicator,
                },
            ]);

            inner.disconnect();

            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);
        });

        it('pass disconnected events through', async () => {
            let loginResult = new Subject<LoginResultMessage>();
            inner.events.set('login_result', loginResult);

            let connectionStates = [] as ClientConnectionState[];
            subject.connectionState.subscribe((state) =>
                connectionStates.push(state)
            );

            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    ...indicator,
                },
            ]);
            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);

            loginResult.next({
                type: 'login_result',
                success: true,
                info: {
                    userId: null,
                    sessionId: null,
                    connectionId: 'test_connection_id',
                },
            });

            await waitAsync();

            expect(connectionStates.slice(1)).toEqual([
                {
                    connected: true,
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: 'test_connection_id',
                    },
                },
            ]);

            inner.disconnect();

            await waitAsync();

            expect(connectionStates.slice(2)).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);
        });
    });

    describe('other scenarios', () => {
        let indicator: ConnectionIndicator;
        let loginResult: Subject<LoginResultMessage>;
        let connectionStates: ClientConnectionState[];
        beforeEach(() => {
            indicator = { connectionToken: 'test_connection_token' };
            inner = new MemoryConnectionClient();
            inner.origin = 'http://localhost';
            authSource = new PartitionAuthSource(
                new Map([['http://localhost', indicator]])
            );
            subject = new AuthenticatedConnectionClient(inner, authSource);

            loginResult = new Subject<LoginResultMessage>();
            inner.events.set('login_result', loginResult);

            connectionStates = [];
            subject.connectionState.subscribe((state) =>
                connectionStates.push(state)
            );
        });

        it('should attempt to login again when a new indicator is provided for an origin', async () => {
            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    ...indicator,
                },
            ]);
            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);

            loginResult.next({
                type: 'login_result',
                success: true,
                info: {
                    userId: null,
                    sessionId: null,
                    connectionId: 'test_connection_id',
                },
            });

            await waitAsync();

            expect(connectionStates.slice(1)).toEqual([
                {
                    connected: true,
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: 'test_connection_id',
                    },
                },
            ]);

            authSource.sendAuthResponse({
                type: 'response',
                success: true,
                origin: subject.origin,
                indicator: {
                    connectionToken: 'test_connection_token_2',
                },
            });

            await waitAsync();

            expect(inner.sentMessages.slice(1)).toEqual([
                {
                    type: 'login',
                    connectionToken: 'test_connection_token_2',
                },
            ]);

            expect(connectionStates.slice(2)).toEqual([]);

            loginResult.next({
                type: 'login_result',
                success: true,
                info: {
                    userId: null,
                    sessionId: null,
                    connectionId: 'test_connection_id_2',
                },
            });

            expect(connectionStates.slice(2)).toEqual([
                {
                    connected: true,
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: 'test_connection_id_2',
                    },
                },
            ]);
        });

        it('should work when an indicator is not immediately available', async () => {
            let requests = [] as PartitionAuthRequest[];
            authSource.onAuthRequest.subscribe((r) => requests.push(r));

            inner.origin = 'http://different';

            inner.connect();

            await waitAsync();

            expect(inner.sentMessages).toEqual([]);
            expect(requests).toEqual([
                {
                    type: 'request',
                    origin: 'http://different',
                },
            ]);
            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);

            authSource.sendAuthResponse({
                type: 'response',
                success: true,
                origin: subject.origin,
                indicator: {
                    connectionToken: 'test_connection_token',
                },
            });

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'login',
                    connectionToken: 'test_connection_token',
                },
            ]);
            expect(connectionStates).toEqual([
                {
                    connected: false,
                    info: null,
                },
            ]);

            loginResult.next({
                type: 'login_result',
                success: true,
                info: {
                    userId: null,
                    sessionId: null,
                    connectionId: 'test_connection_id',
                },
            });

            await waitAsync();

            expect(connectionStates.slice(1)).toEqual([
                {
                    connected: true,
                    info: {
                        userId: null,
                        sessionId: null,
                        connectionId: 'test_connection_id',
                    },
                },
            ]);
        });
    });
});
