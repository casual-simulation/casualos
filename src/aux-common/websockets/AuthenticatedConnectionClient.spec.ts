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
import {
    LoginResultMessage,
    RequestMissingPermissionMessage,
    RequestMissingPermissionResponseMessage,
    WebsocketMessage,
} from './WebsocketEvents';
import {
    PartitionAuthExternalPermissionResult,
    PartitionAuthExternalRequestPermission,
    PartitionAuthRequest,
    PartitionAuthSource,
} from '../partitions';

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
                    kind: 'need_indicator',
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

    describe('permission requests', () => {
        let indicator: ConnectionIndicator;
        let loginResult: Subject<LoginResultMessage>;
        let connectionStates: ClientConnectionState[];
        let externalRequests: Subject<RequestMissingPermissionMessage>;
        let externalResponses: Subject<RequestMissingPermissionResponseMessage>;

        beforeEach(() => {
            indicator = { connectionToken: 'test_connection_token' };
            inner = new MemoryConnectionClient();
            inner.origin = 'http://localhost';

            loginResult = new Subject<LoginResultMessage>();
            externalRequests = new Subject<RequestMissingPermissionMessage>();
            externalResponses =
                new Subject<RequestMissingPermissionResponseMessage>();
            inner.events.set('login_result', loginResult);
            inner.events.set('permission/request/missing', externalRequests);
            inner.events.set(
                'permission/request/missing/response',
                externalResponses
            );

            authSource = new PartitionAuthSource(
                new Map([['http://localhost', indicator]])
            );
            subject = new AuthenticatedConnectionClient(inner, authSource);

            connectionStates = [];
            subject.connectionState.subscribe((state) =>
                connectionStates.push(state)
            );
        });

        it('should send permission requests', async () => {
            authSource.sendAuthPermissionRequest({
                type: 'permission_request',
                origin: 'http://localhost',
                reason: {
                    type: 'missing_permission',
                    recordName: 'test_record',
                    action: 'read',
                    resourceKind: 'inst',
                    subjectType: 'user',
                    subjectId: 'test',
                    resourceId: 'inst',
                },
            });

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'permission/request/missing',
                    reason: {
                        type: 'missing_permission',
                        recordName: 'test_record',
                        action: 'read',
                        resourceKind: 'inst',
                        subjectType: 'user',
                        subjectId: 'test',
                        resourceId: 'inst',
                    },
                },
            ]);
        });

        it('should send permissions results', async () => {
            authSource.sendAuthPermissionResult({
                type: 'permission_result',
                success: true,
                origin: 'http://localhost',
                recordName: 'test_record',
                resourceKind: 'inst',
                subjectType: 'user',
                subjectId: 'test',
                resourceId: 'inst',
            });

            await waitAsync();

            expect(inner.sentMessages).toEqual([
                {
                    type: 'permission/request/missing/response',
                    success: true,
                    origin: 'http://localhost',
                    recordName: 'test_record',
                    resourceKind: 'inst',
                    subjectType: 'user',
                    subjectId: 'test',
                    resourceId: 'inst',
                },
            ]);
        });

        it('should relay permissions requests', async () => {
            const requests = [] as PartitionAuthExternalRequestPermission[];
            authSource.onAuthExternalPermissionRequest.subscribe((request) => {
                requests.push(request);
            });

            externalRequests.next({
                type: 'permission/request/missing',
                reason: {
                    type: 'missing_permission',
                    recordName: 'test_record',
                    action: 'read',
                    resourceKind: 'inst',
                    subjectType: 'user',
                    subjectId: 'test',
                    resourceId: 'inst',
                },
                user: {
                    userId: 'test',
                    displayName: null,
                    name: 'user',
                },
            });

            await waitAsync();

            expect(requests).toEqual([
                {
                    type: 'external_permission_request',
                    origin: 'http://localhost',
                    reason: {
                        type: 'missing_permission',
                        recordName: 'test_record',
                        action: 'read',
                        resourceKind: 'inst',
                        subjectType: 'user',
                        subjectId: 'test',
                        resourceId: 'inst',
                    },
                    user: {
                        userId: 'test',
                        displayName: null,
                        name: 'user',
                    },
                },
            ]);
        });

        it('should relay permission responses', async () => {
            const responses = [] as PartitionAuthExternalPermissionResult[];
            authSource.onAuthExternalPermissionResult.subscribe((response) => {
                responses.push(response);
            });

            externalResponses.next({
                type: 'permission/request/missing/response',
                success: true,
                recordName: 'test_record',
                resourceKind: 'inst',
                resourceId: 'inst',
                subjectId: 'test',
                subjectType: 'user',
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    type: 'external_permission_result',
                    origin: 'http://localhost',
                    success: true,
                    recordName: 'test_record',
                    resourceKind: 'inst',
                    resourceId: 'inst',
                    subjectId: 'test',
                    subjectType: 'user',
                },
            ]);
        });
    });
});
