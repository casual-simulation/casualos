import { Subject, Subscription } from 'rxjs';
import {
    AuthCoordinator,
    MissingPermissionEvent,
    NotAuthorizedEvent,
    ShowAccountInfoEvent,
} from './AuthCoordinator';
import { BotManager } from './BotManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import {
    AuthHelperInterface,
    SimulationManager,
} from '@casual-simulation/aux-vm/managers';
import {
    AuthData,
    ConnectionInfo,
    PartitionAuthMessage,
    PartitionAuthResponse,
    botAdded,
    createBot,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { AuxConfigParameters } from '@casual-simulation/aux-vm/vm';
import { AuthHelper } from './AuthHelper';
import { randomBytes } from 'crypto';
import { fromByteArray } from 'base64-js';
import { SESSION_SECRET_BYTE_LENGTH } from '@casual-simulation/aux-records';
import {
    formatV1ConnectionKey,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-records/AuthUtils';
import { LoginStatus } from '@casual-simulation/aux-vm/auth';

console.log = jest.fn();

describe('AuthCoordinator', () => {
    let manager: AuthCoordinator<BotManager>;
    let connectionId = 'connectionId';
    let sim: BotManager;
    let sub: Subscription;
    let vms: Map<string, TestAuxVM>;
    let authHelper: AuthHelper;
    let auth: AuthHelperInterface;
    let authMock = {
        isAuthenticated: jest.fn(),
        authenticate: jest.fn(),
        getAuthToken: jest.fn(),
        createPublicRecordKey: jest.fn(),
        provideSmsNumber: jest.fn(),
        getRecordKeyPolicy: jest.fn(),
        getConnectionKey: jest.fn(),
        logout: jest.fn(),
    };

    let simManager: SimulationManager<BotManager>;

    let loginStatus: LoginStatus;
    let responses: PartitionAuthResponse[];
    const origin = 'http://localhost:3002';

    async function addSimulation(id: string) {
        const sim = await simManager.addSimulation(id, {
            recordName: null,
            inst: id,
        });

        simManager.primary.helper.transaction(
            botAdded(createBot(connectionId, {}))
        );

        await waitAsync();

        return sim;
    }

    beforeEach(async () => {
        sub = new Subscription();
        vms = new Map();
        responses = [];
        loginStatus = null;
        authMock = auth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: new Subject(),
            logout: jest.fn(),
            getConnectionKey: jest.fn(),
            provideEmailAddress: jest.fn(),
            setUseCustomUI: jest.fn(),
            provideSmsNumber: jest.fn(),
            provideCode: jest.fn(),
            authenticateInBackground: jest.fn(),
            getRecordKeyPolicy: jest.fn(),
            getRecordsOrigin: jest.fn().mockResolvedValue(origin),
            isValidDisplayName: jest.fn(),
            isValidEmailAddress: jest.fn(),
            provideHasAccount: jest.fn(),
            providePrivoSignUpInfo: jest.fn(),
            getPolicyUrls: jest.fn(),
            getWebsocketOrigin: jest.fn(),
            getWebsocketProtocol: jest.fn(),
            get supportsAuthentication() {
                return true;
            },
            get closed() {
                return false;
            },
            get origin() {
                return origin;
            },
            get currentLoginStatus() {
                return loginStatus;
            },
        };
        authHelper = new AuthHelper(origin, origin, (authOrigin) => {
            if (authOrigin === 'http://localhost:3002') {
                return auth;
            } else {
                return null;
            }
        });

        const config: AuxConfigParameters = {
            version: 'v1.0.0',
            versionHash: 'hash',
        };

        simManager = new SimulationManager((id, options) => {
            const vm = new TestAuxVM(id, connectionId);
            vm.processEvents = true;
            vm.localEvents = new Subject();
            vms.set(id, vm);
            return new BotManager(options, config, vm, authHelper);
        });

        await simManager.setPrimary('sim-1', {
            recordName: null,
            inst: 'sim-1',
        });
        sim = await addSimulation('sim-1');

        manager = new AuthCoordinator(simManager);

        sim.onAuthMessage.subscribe((msg) => {
            if (msg.type === 'response') {
                responses.push(msg);
            }
        });
    });

    afterEach(() => {
        sub.unsubscribe();
    });

    describe('showAccountInfo()', () => {
        it('should emit an event with the current login status', async () => {
            loginStatus = {
                isLoading: false,
                isLoggingIn: true,
                authData: {
                    userId: 'userId',
                    name: 'name',
                    avatarUrl: null,
                    avatarPortraitUrl: null,
                    hasActiveSubscription: false,
                    subscriptionTier: null,
                    displayName: null,
                    privacyFeatures: {
                        allowPublicData: true,
                        publishData: true,
                        allowAI: true,
                        allowPublicInsts: true,
                    },
                },
            };

            let events: ShowAccountInfoEvent[] = [];
            manager.onShowAccountInfo.subscribe((e) => events.push(e));

            await manager.showAccountInfo('sim-1');

            await waitAsync();

            expect(events).toEqual([
                {
                    simulationId: 'sim-1',
                    loginStatus: {
                        isLoading: false,
                        isLoggingIn: true,
                        authData: {
                            userId: 'userId',
                            name: 'name',
                            avatarUrl: null,
                            avatarPortraitUrl: null,
                            hasActiveSubscription: false,
                            subscriptionTier: null,
                            displayName: null,
                            privacyFeatures: {
                                allowPublicData: true,
                                publishData: true,
                                allowAI: true,
                                allowPublicInsts: true,
                            },
                        },
                    },
                },
            ]);
        });
    });

    describe('logout()', () => {
        it('should log the user out', async () => {
            await manager.logout('sim-1');

            expect(authMock.logout).toHaveBeenCalled();
        });
    });

    describe('changeLogin()', () => {
        it('should logout and login', async () => {
            authMock.logout.mockResolvedValueOnce(null);
            authMock.authenticate.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                connectionSecret,
                Date.now() + 10000000
            );
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                null,
                'sim-1'
            );
            authMock.getConnectionKey.mockResolvedValueOnce(key);

            await manager.changeLogin('sim-1', 'other origin');

            expect(responses).toEqual([
                {
                    type: 'response',
                    success: true,
                    indicator: {
                        connectionToken: token,
                    },
                    origin: 'other origin',
                },
            ]);
            expect(authMock.logout).toHaveBeenCalled();
            expect(authMock.authenticate).toHaveBeenCalled();
        });

        it('should do nothing if the simulation doesnt exist', async () => {
            authMock.logout.mockResolvedValueOnce(null);
            authMock.authenticate.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                connectionSecret,
                Date.now() + 10000000
            );
            authMock.getConnectionKey.mockResolvedValueOnce(key);

            await manager.changeLogin('wrong sim', origin);

            expect(responses).toEqual([]);
            expect(authMock.logout).not.toHaveBeenCalled();
            expect(authMock.authenticate).not.toHaveBeenCalled();
        });

        it('should do nothing if there is no connection key', async () => {
            authMock.logout.mockResolvedValueOnce(null);
            authMock.authenticate.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);
            authMock.getConnectionKey.mockResolvedValueOnce(null);

            await manager.changeLogin('sim-1', origin);

            expect(responses).toEqual([]);
            expect(authMock.logout).toHaveBeenCalled();
            expect(authMock.authenticate).toHaveBeenCalled();
            expect(authMock.getConnectionKey).toHaveBeenCalled();
        });
    });

    describe('need_indicator', () => {
        it('should respond to auth requests with a connection ID if a key does not exist', async () => {
            authMock.getConnectionKey.mockResolvedValueOnce(null);

            await sim.sendAuthMessage({
                type: 'request',
                origin: origin,
                kind: 'need_indicator',
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    type: 'response',
                    success: true,
                    indicator: {
                        connectionId: connectionId,
                    },
                    origin: origin,
                },
            ]);
        });

        it('should respond to auth requests with a connection token if a key exists', async () => {
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                connectionSecret,
                Date.now() + 10000000
            );
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                null,
                'sim-1'
            );
            authMock.getConnectionKey.mockResolvedValueOnce(key);

            await sim.sendAuthMessage({
                type: 'request',
                origin: origin,
                kind: 'need_indicator',
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    type: 'response',
                    success: true,
                    indicator: {
                        connectionToken: token,
                    },
                    origin: origin,
                },
            ]);
        });
    });

    describe('invalid_indicator', () => {
        it('should attempt to login and then send the connection token', async () => {
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                connectionSecret,
                Date.now() + 10000000
            );
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                null,
                'sim-1'
            );

            authMock.getConnectionKey
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(key);
            authMock.authenticate.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);

            await sim.sendAuthMessage({
                type: 'request',
                origin: origin,
                kind: 'invalid_indicator',
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    type: 'response',
                    success: true,
                    indicator: {
                        connectionToken: token,
                    },
                    origin: origin,
                },
            ]);
            expect(authMock.authenticate).toHaveBeenCalled();
        });

        it('should logout and login if the error code indicates that the connection token is invalid', async () => {
            const connectionSecret = fromByteArray(
                randomBytes(SESSION_SECRET_BYTE_LENGTH)
            );
            const key = formatV1ConnectionKey(
                'userId',
                'sessionId',
                connectionSecret,
                Date.now() + 10000000
            );
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                null,
                'sim-1'
            );

            authMock.isAuthenticated.mockResolvedValueOnce(true);
            authMock.getConnectionKey.mockResolvedValueOnce(key);
            authMock.authenticate.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);

            authMock.logout.mockResolvedValueOnce(null);

            await sim.sendAuthMessage({
                type: 'request',
                origin: origin,
                kind: 'invalid_indicator',
                errorCode: 'invalid_token',
            });

            await waitAsync();

            expect(responses).toEqual([
                {
                    type: 'response',
                    success: true,
                    indicator: {
                        connectionToken: token,
                    },
                    origin: origin,
                },
            ]);
            expect(authMock.isAuthenticated).toHaveBeenCalled();
            expect(authMock.logout).toHaveBeenCalled();
            expect(authMock.authenticate).toHaveBeenCalled();
        });
    });

    describe('not_authorized', () => {
        describe('not_logged_in', () => {
            it('should generate a connection token if the user has a connection key', async () => {
                const connectionSecret = fromByteArray(
                    randomBytes(SESSION_SECRET_BYTE_LENGTH)
                );
                const key = formatV1ConnectionKey(
                    'userId',
                    'sessionId',
                    connectionSecret,
                    Date.now() + 10000000
                );
                const token = generateV1ConnectionToken(
                    key,
                    connectionId,
                    null,
                    'sim-1'
                );
                authMock.getConnectionKey.mockResolvedValueOnce(key);

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_logged_in',
                    errorMessage: 'Not logged in.',
                });

                await waitAsync();

                expect(responses).toEqual([
                    {
                        type: 'response',
                        success: true,
                        indicator: {
                            connectionToken: token,
                        },
                        origin: origin,
                    },
                ]);
                expect(authMock.authenticate).not.toHaveBeenCalled();
            });

            it('should attempt to login and get the connection key', async () => {
                const connectionSecret = fromByteArray(
                    randomBytes(SESSION_SECRET_BYTE_LENGTH)
                );
                const key = formatV1ConnectionKey(
                    'userId',
                    'sessionId',
                    connectionSecret,
                    Date.now() + 10000000
                );
                const token = generateV1ConnectionToken(
                    key,
                    connectionId,
                    null,
                    'sim-1'
                );
                authMock.getConnectionKey
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce(key);
                authMock.authenticate.mockResolvedValueOnce({
                    userId: 'userId',
                    hasActiveSubscription: false,
                } as AuthData);

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_logged_in',
                    errorMessage: 'Not logged in.',
                });

                await waitAsync();

                expect(responses).toEqual([
                    {
                        type: 'response',
                        success: true,
                        indicator: {
                            connectionToken: token,
                        },
                        origin: origin,
                    },
                ]);
                expect(authMock.authenticate).toHaveBeenCalled();
            });
        });

        describe('missing_permission', () => {
            it('should send a onMissingPermission event', async () => {
                let events: MissingPermissionEvent[] = [];
                manager.onMissingPermission.subscribe((e) => events.push(e));

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_authorized',
                    errorMessage: 'Not authorized.',
                    reason: {
                        type: 'missing_permission',
                        kind: 'user',
                        id: 'userId',
                        marker: 'marker',
                        permission: 'inst.read',
                    },
                });

                await waitAsync();

                expect(responses).toEqual([]);
                expect(events).toEqual([
                    {
                        simulationId: 'sim-1',
                        errorCode: 'not_authorized',
                        errorMessage: 'Not authorized.',
                        origin: origin,
                        reason: {
                            type: 'missing_permission',
                            kind: 'user',
                            id: 'userId',
                            marker: 'marker',
                            permission: 'inst.read',
                        },
                    },
                ]);
            });
        });

        describe('not_authorized', () => {
            it('should send a onNotAuthorized event', async () => {
                let events: NotAuthorizedEvent[] = [];
                manager.onNotAuthorized.subscribe((e) => events.push(e));

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_authorized',
                    errorMessage: 'Not authorized.',
                });

                await waitAsync();

                expect(responses).toEqual([]);
                expect(events).toEqual([
                    {
                        simulationId: 'sim-1',
                        errorCode: 'not_authorized',
                        errorMessage: 'Not authorized.',
                        origin: origin,
                    },
                ]);
            });
        });
    });
});
