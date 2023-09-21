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

console.log = jest.fn();

describe('AuthenticatedConnectionClient', () => {
    let subject: AuthenticatedConnectionClient;
    let inner: MemoryConnectionClient;

    const indicatorCases: [string, ConnectionIndicator][] = [
        ['connectionId', { connectionId: 'test_connection_id' }],
        ['connectionToken', { connectionToken: 'test_connection_token' }],
    ];

    describe.each(indicatorCases)('%s', (name, indicator) => {
        beforeEach(() => {
            inner = new MemoryConnectionClient();
            subject = new AuthenticatedConnectionClient(inner, indicator);
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
});
