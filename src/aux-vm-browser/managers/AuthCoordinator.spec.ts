/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { Subject, Subscription } from 'rxjs';
import type {
    GrantEntitlementsEvent,
    MissingPermissionEvent,
    NotAuthorizedEvent,
    ShowAccountInfoEvent,
} from './AuthCoordinator';
import { AuthCoordinator } from './AuthCoordinator';
import { BotManager } from './BotManager';
import { TestAuxVM } from '@casual-simulation/aux-vm/vm/test/TestAuxVM';
import type { AuthHelperInterface } from '@casual-simulation/aux-vm/managers';
import { SimulationManager } from '@casual-simulation/aux-vm/managers';
import type {
    AuthData,
    PartitionAuthResponse,
} from '@casual-simulation/aux-common';
import {
    asyncResult,
    botAdded,
    createBot,
    showAccountInfo,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import type { AuxConfigParameters } from '@casual-simulation/aux-vm/vm';
import { AuthHelper } from './AuthHelper';
import { randomBytes } from 'crypto';
import { fromByteArray } from 'base64-js';
import type { GrantResourcePermissionResult } from '@casual-simulation/aux-records';
import { SESSION_SECRET_BYTE_LENGTH } from '@casual-simulation/aux-records';
import {
    formatV1ConnectionKey,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-common';
import type { LoginStatus } from '@casual-simulation/aux-vm/auth';
import { grantEntitlements } from '@casual-simulation/aux-runtime';

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
        grantPermission: jest.fn(),
        relogin: jest.fn(),
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
        auth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            openAccountPage: jest.fn(),
            cancelLogin: jest.fn(),
            loginStatus: null,
            loginUIStatus: new Subject(),
            relogin: jest.fn(),
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
            getComIdWebConfig: jest.fn(),
            grantPermission: jest.fn(),
            provideLoginResult: jest.fn(),
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
        authMock = auth as any;
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
                    endpoint: 'http://localhost:3002',
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

    describe('show_account_info', () => {
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

            const vm = vms.get('sim-1');
            vm.localEvents.next([showAccountInfo(1)]);

            await waitAsync();

            expect(events).toEqual([
                {
                    simulationId: 'sim-1',
                    endpoint: 'http://localhost:3002',
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
            expect(vm.events.slice(1)).toEqual([asyncResult(1, null)]);
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

        it('should relogin if the error code indicates that the connection token is invalid', async () => {
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
            authMock.relogin.mockResolvedValueOnce({
                userId: 'userId',
                hasActiveSubscription: false,
            } as AuthData);
            // authMock.authenticate.mockResolvedValueOnce({
            //     userId: 'userId',
            //     hasActiveSubscription: false,
            // } as AuthData);

            // authMock.logout.mockResolvedValueOnce(null);

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
            expect(authMock.relogin).toHaveBeenCalled();
            // expect(authMock.authenticate).toHaveBeenCalled();
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

            it('should generate the connection token for the requested resource', async () => {
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
                    'myRecord',
                    'myInst'
                );
                authMock.getConnectionKey.mockResolvedValueOnce(key);

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_logged_in',
                    errorMessage: 'Not logged in.',
                    resource: {
                        type: 'inst',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'doc/myDocument',
                    },
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

            it('should not generate a connection token for an invalid branch', async () => {
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

                await sim.sendAuthMessage({
                    type: 'request',
                    origin: origin,
                    kind: 'not_authorized',
                    errorCode: 'not_logged_in',
                    errorMessage: 'Not logged in.',
                    resource: {
                        type: 'inst',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'invalidBranch',
                    },
                });

                await waitAsync();

                expect(responses).toEqual([]);
                expect(authMock.authenticate).not.toHaveBeenCalled();
            });

            it('should generate a connection token for the current sim', async () => {
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
                    resource: {
                        type: 'inst',
                        recordName: null,
                        inst: 'sim-1',
                        branch: 'goodBranch',
                    },
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
                        recordName: 'recordName',
                        subjectType: 'user',
                        subjectId: 'userId',
                        resourceKind: 'inst',
                        resourceId: 'instId',
                        action: 'read',
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
                            recordName: 'recordName',
                            subjectType: 'user',
                            subjectId: 'userId',
                            resourceKind: 'inst',
                            resourceId: 'instId',
                            action: 'read',
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

    describe('grantAccessToMissingPermission()', () => {
        it('should grant access to the resource and then send a response', async () => {
            authMock.grantPermission.mockResolvedValueOnce({
                success: true,
            } as GrantResourcePermissionResult);

            const result = await manager.grantAccessToMissingPermission(
                'sim-1',
                origin,
                {
                    type: 'missing_permission',
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'userId',
                }
            );

            expect(result).toEqual({
                success: true,
            });

            await waitAsync();

            expect(authMock.grantPermission).toHaveBeenCalledWith(
                'recordName',
                {
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: null,
                    subjectType: 'user',
                    subjectId: 'userId',
                    expireTimeMs: null,
                    options: {},
                }
            );

            const vm = vms.get('sim-1');

            expect(vm?.sentAuthMessages).toEqual([
                {
                    type: 'permission_result',
                    success: true,
                    origin,
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    subjectType: 'user',
                    subjectId: 'userId',
                },
            ]);
        });

        it('should use the given expire time', async () => {
            authMock.grantPermission.mockResolvedValueOnce({
                success: true,
            } as GrantResourcePermissionResult);

            const result = await manager.grantAccessToMissingPermission(
                'sim-1',
                origin,
                {
                    type: 'missing_permission',
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'userId',
                },
                1000
            );

            expect(result).toEqual({
                success: true,
            });

            await waitAsync();

            expect(authMock.grantPermission).toHaveBeenCalledWith(
                'recordName',
                {
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: null,
                    subjectType: 'user',
                    subjectId: 'userId',
                    expireTimeMs: 1000,
                    options: {},
                }
            );

            const vm = vms.get('sim-1');

            expect(vm?.sentAuthMessages).toEqual([
                {
                    type: 'permission_result',
                    success: true,
                    origin,
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    subjectType: 'user',
                    subjectId: 'userId',
                },
            ]);
        });

        it('should use the given actions', async () => {
            authMock.grantPermission.mockResolvedValue({
                success: true,
            } as GrantResourcePermissionResult);

            const result = await manager.grantAccessToMissingPermission(
                'sim-1',
                origin,
                {
                    type: 'missing_permission',
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'userId',
                },
                null,
                ['read', 'update']
            );

            expect(result).toEqual({
                success: true,
            });

            await waitAsync();

            expect(authMock.grantPermission).toHaveBeenCalledWith(
                'recordName',
                {
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'userId',
                    expireTimeMs: null,
                    options: {},
                }
            );
            expect(authMock.grantPermission).toHaveBeenCalledWith(
                'recordName',
                {
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'update',
                    subjectType: 'user',
                    subjectId: 'userId',
                    expireTimeMs: null,
                    options: {},
                }
            );

            const vm = vms.get('sim-1');

            expect(vm?.sentAuthMessages).toEqual([
                {
                    type: 'permission_result',
                    success: true,
                    origin,
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    subjectType: 'user',
                    subjectId: 'userId',
                },
            ]);
        });

        it('should not send a response if the permission was not granted', async () => {
            authMock.grantPermission.mockResolvedValueOnce({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Not authorized.',
            } as GrantResourcePermissionResult);

            const result = await manager.grantAccessToMissingPermission(
                'sim-1',
                origin,
                {
                    type: 'missing_permission',
                    recordName: 'recordName',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: 'userId',
                }
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Not authorized.',
            });

            await waitAsync();

            expect(authMock.grantPermission).toHaveBeenCalledWith(
                'recordName',
                {
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: null,
                    subjectType: 'user',
                    subjectId: 'userId',
                    expireTimeMs: null,
                    options: {},
                }
            );

            const vm = vms.get('sim-1');
            expect(vm?.sentAuthMessages).toEqual([]);
        });
    });

    describe('grant_entitlements', () => {
        it('should send a grant_entitlements message', async () => {
            let events: GrantEntitlementsEvent[] = [];
            manager.onGrantEntitlements.subscribe((e) => events.push(e));

            const vm = vms.get('sim-1');
            vm.localEvents.next([
                grantEntitlements(
                    {
                        packageId: 'packageId',
                        features: ['data'],
                        scope: 'designated',
                        expireTimeMs: 1000,
                        recordName: 'recordName',
                    },
                    {},
                    1
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                {
                    simulationId: 'sim-1',
                    action: grantEntitlements(
                        {
                            packageId: 'packageId',
                            features: ['data'],
                            scope: 'designated',
                            expireTimeMs: 1000,
                            recordName: 'recordName',
                        },
                        {},
                        1
                    ),
                },
            ]);
        });
    });
});
