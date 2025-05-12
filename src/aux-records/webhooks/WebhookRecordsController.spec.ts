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
import type { MemoryStore } from '../MemoryStore';
import type { PolicyController } from '../PolicyController';
import type { RecordsController } from '../RecordsController';
import { WebhookRecordsController } from './WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './MemoryWebhookRecordsStore';
import {
    ADMIN_ROLE_NAME,
    constructInitializationUpdate,
    createBot,
    createInitializationUpdate,
    DEFAULT_BRANCH_NAME,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    generateV1ConnectionToken,
} from '@casual-simulation/aux-common';
import type { TestControllers } from '../crud/CrudRecordsControllerTests';
import {
    setupTestContext,
    testCrudRecordsController,
} from '../crud/CrudRecordsControllerTests';
import type {
    WebhookRecord,
    WebhookRecordsStore,
    WebhookRunInfo,
} from './WebhookRecordsStore';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import { DataRecordsController } from '../DataRecordsController';
import { FileRecordsController } from '../FileRecordsController';
import type {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
} from './WebhookEnvironment';
import { STORED_AUX_SCHEMA } from './WebhookEnvironment';
import { getHash } from '@casual-simulation/crypto';
import { sortBy } from 'lodash';
import {
    MemoryTempInstRecordsStore,
    MemoryWebsocketConnectionStore,
    MemoryWebsocketMessenger,
    SplitInstRecordsStore,
    WebsocketController,
} from '../websockets';

console.log = jest.fn();

describe('WebhookRecordsController', () => {
    testCrudRecordsController<
        WebhookRecord,
        WebhookRecordsStore,
        WebhookRecordsController
    >(
        false,
        'webhook',
        (services) => new MemoryWebhookRecordsStore(services.store),
        (config, services) =>
            new WebhookRecordsController({
                ...config,
                data: new DataRecordsController({
                    config: services.store,
                    metrics: services.store,
                    policies: services.policies,
                    store: services.store,
                }),
                files: new FileRecordsController({
                    config: services.store,
                    metrics: services.store,
                    policies: services.policies,
                    store: services.store,
                }),
                websockets: new WebsocketController(
                    new MemoryWebsocketConnectionStore(),
                    new MemoryWebsocketMessenger(),
                    new SplitInstRecordsStore(
                        new MemoryTempInstRecordsStore(),
                        services.store
                    ),
                    new MemoryTempInstRecordsStore(),
                    services.auth,
                    services.policies,
                    services.configStore,
                    services.store,
                    services.authStore
                ),
                auth: services.auth,
                environment: {
                    handleHttpRequest: jest.fn(),
                },
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            targetResourceKind: 'data',
            targetRecordName: 'recordName',
            targetAddress: 'data1',
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) => features.withAllDefaultFeatures().withWebhooks()
            );

            context.store.subscriptionConfiguration = builder.config;
        }
    );

    let store: MemoryStore;
    let itemsStore: MemoryWebhookRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: WebhookRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;

    let userId: string;
    let sessionKey: string;
    let connectionKey: string;
    let otherUserId: string;
    let recordName: string;
    let environment: {
        handleHttpRequest: jest.Mock<
            Promise<HandleHttpRequestResult>,
            [HandleHttpRequestRequest]
        >;
    };

    beforeEach(async () => {
        require('axios').__reset();
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();

        dateNowMock.mockReturnValue(123);

        environment = {
            handleHttpRequest: jest.fn(),
        };

        const context = await setupTestContext<
            WebhookRecord,
            WebhookRecordsStore,
            WebhookRecordsController
        >(
            (services) => new MemoryWebhookRecordsStore(services.store),
            (config, services) =>
                new WebhookRecordsController({
                    ...config,
                    data: new DataRecordsController({
                        config: services.store,
                        metrics: services.store,
                        policies: services.policies,
                        store: services.store,
                    }),
                    files: new FileRecordsController({
                        config: services.store,
                        metrics: services.store,
                        policies: services.policies,
                        store: services.store,
                    }),
                    websockets: new WebsocketController(
                        new MemoryWebsocketConnectionStore(),
                        new MemoryWebsocketMessenger(),
                        new SplitInstRecordsStore(
                            new MemoryTempInstRecordsStore(),
                            services.store
                        ),
                        new MemoryTempInstRecordsStore(),
                        services.auth,
                        services.policies,
                        services.configStore,
                        services.store,
                        services.authStore
                    ),
                    auth: services.auth,
                    environment: environment,
                })
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryWebhookRecordsStore;
        records = context.services.records;
        policies = context.services.policies;
        manager = context.manager;
        key = context.key;
        subjectlessKey = context.subjectlessKey;
        userId = context.userId;
        otherUserId = context.otherUserId;
        sessionKey = context.sessionKey;
        connectionKey = context.connectionKey;
        recordName = context.recordName;

        const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
            (features) => features.withAllDefaultFeatures().withWebhooks()
        );

        store.subscriptionConfiguration = builder.config;
    });

    afterEach(() => {
        Date.now = realDateNow;
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getLastDelete() {
        return require('axios').__getLastDelete();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('recordItem()', () => {
        describe('create', () => {
            it('should return subscription_limit_reached when the user has reached their subscription limit', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withWebhooks()
                                .withWebhooksMaxItems(1)
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
                        targetResourceKind: 'data',
                        targetRecordName: 'recordName',
                        targetAddress: 'data1',
                        userId: null,
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of webhook items has been reached for your subscription.',
                });
            });

            it('should create a user for the webhook', async () => {
                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item1',
                        markers: [PUBLIC_READ_MARKER],
                        targetResourceKind: 'data',
                        targetRecordName: 'recordName',
                        targetAddress: 'data1',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'item1',
                });

                const item = await itemsStore.getItemByAddress(
                    recordName,
                    'item1'
                );

                expect(item?.userId).toBeTruthy();

                const user = await store.findUser(item!.userId!);

                expect(user).toEqual({
                    id: item?.userId,
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
            });
        });
    });

    describe('handleWebhook()', () => {
        beforeEach(async () => {
            await store.addRecord({
                name: 'recordName',
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });
        });

        it('should return not_authorized if the user doesnt have the ability to run the webhook', async () => {
            await itemsStore.createItem(recordName, {
                address: 'item1',
                markers: [PRIVATE_MARKER],
                targetResourceKind: 'data',
                targetRecordName: 'recordName',
                targetAddress: 'data1',
                userId: null,
            });

            await store.setData(
                'recordName',
                'data1',
                {
                    version: 1,
                    state: {},
                },
                'user1',
                'user2',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            environment.handleHttpRequest.mockResolvedValueOnce({
                success: true,
                response: {
                    statusCode: 200,
                },
                logs: ['abc'],
            });

            const result = await manager.handleWebhook({
                recordName,
                address: 'item1',
                userId: otherUserId,
                request: {
                    method: 'GET',
                    path: '/',
                    headers: {},
                    body: JSON.stringify({
                        abc: 'def',
                    }),
                    ipAddress: null,
                    pathParams: {},
                    query: {},
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'webhook',
                    resourceId: 'item1',
                    action: 'run',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });
        });

        it('should allow anonymous users to call public webhooks', async () => {
            await itemsStore.createItem(recordName, {
                address: 'item1',
                markers: [PUBLIC_READ_MARKER],
                targetResourceKind: 'data',
                targetRecordName: 'recordName',
                targetAddress: 'data1',
                userId: null,
            });

            await store.setData(
                'recordName',
                'data1',
                {
                    version: 1,
                    state: {},
                },
                'user1',
                'user2',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            environment.handleHttpRequest.mockResolvedValueOnce({
                success: true,
                response: {
                    statusCode: 200,
                },
                logs: ['abc'],
            });

            const result = await manager.handleWebhook({
                recordName,
                address: 'item1',
                userId: null,
                request: {
                    method: 'GET',
                    path: '/',
                    headers: {},
                    body: JSON.stringify({
                        abc: 'def',
                    }),
                    ipAddress: null,
                    pathParams: {},
                    query: {},
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                },
            });

            const runs = await itemsStore.listWebhookRunsForWebhook(
                recordName,
                'item1'
            );
            expect(runs).toEqual({
                success: true,
                items: [
                    {
                        runId: expect.any(String),
                        recordName: recordName,
                        webhookAddress: 'item1',
                        requestTimeMs: expect.any(Number),
                        responseTimeMs: expect.any(Number),
                        statusCode: 200,
                        errorResult: null,

                        // Cannot record run data because the webhook
                        // has an anonymous user.
                        infoRecordName: null,
                        infoFileName: null,
                        stateSha256: expect.any(String),
                        options: {
                            initTimeoutMs: 5000,
                            requestTimeoutMs: 5000,
                            fetchTimeoutMs: 5000,
                            addStateTimeoutMs: 1000,
                        },
                    },
                ],
                totalCount: 1,
                marker: null,
            });
        });

        it('should record webhook runs', async () => {
            // request to record the data file
            setResponse({
                status: 200,
                data: {
                    success: true,
                },
            });

            const webhookUserId = 'webhookUser';
            await store.saveUser({
                id: webhookUserId,
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await itemsStore.createItem(recordName, {
                address: 'item1',
                markers: [PUBLIC_READ_MARKER],
                targetResourceKind: 'data',
                targetRecordName: 'recordName',
                targetAddress: 'data1',
                userId: webhookUserId,
            });

            await store.setData(
                'recordName',
                'data1',
                {
                    version: 1,
                    state: {},
                },
                'user1',
                'user2',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            environment.handleHttpRequest.mockResolvedValueOnce({
                success: true,
                response: {
                    statusCode: 200,
                },
                logs: ['abc'],
            });

            const result = await manager.handleWebhook({
                recordName,
                address: 'item1',
                userId: null,
                request: {
                    method: 'GET',
                    path: '/',
                    headers: {},
                    body: JSON.stringify({
                        abc: 'def',
                    }),
                    ipAddress: null,
                    pathParams: {},
                    query: {},
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                },
            });

            const runs = await itemsStore.listWebhookRunsForWebhook(
                recordName,
                'item1'
            );
            expect(runs).toEqual({
                success: true,
                items: [
                    {
                        runId: expect.any(String),
                        recordName: recordName,
                        webhookAddress: 'item1',
                        requestTimeMs: expect.any(Number),
                        responseTimeMs: expect.any(Number),
                        statusCode: 200,
                        errorResult: null,
                        infoRecordName: webhookUserId,
                        infoFileName: expect.any(String),
                        stateSha256: expect.any(String),
                        options: {
                            initTimeoutMs: 5000,
                            requestTimeoutMs: 5000,
                            fetchTimeoutMs: 5000,
                            addStateTimeoutMs: 1000,
                        },
                    },
                ],
                totalCount: 1,
                marker: null,
            });

            const file = await store.getFileRecord(
                webhookUserId,
                runs.items[0].infoFileName!
            );
            expect(file).toEqual({
                success: true,
                recordName: webhookUserId,
                fileName: runs.items[0].infoFileName,
                description: expect.stringContaining('Webhook data for run'),
                url: `http://localhost:9191/${webhookUserId}/${runs.items[0].infoFileName}`,
                sizeInBytes: expect.any(Number),
                uploaded: false,
                markers: ['private:logs'],
                publisherId: webhookUserId,
                subjectId: webhookUserId,
            });

            const [url, data] = getLastPost();

            const json = new TextDecoder().decode(data);

            expect([url, JSON.parse(json)]).toEqual([
                `http://localhost:9191/${webhookUserId}/${runs.items[0].infoFileName}`,
                {
                    runId: expect.any(String),
                    version: 1,
                    logs: ['abc'],
                    state: {
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
                    },
                    stateSha256: getHash({
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
                    }),
                    request: {
                        method: 'GET',
                        path: '/',
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                        headers: {},
                    },
                    requestUserId: null,
                    response: {
                        statusCode: 200,
                    },
                    authorization: {
                        success: true,
                        recordName,
                        results: [
                            {
                                success: true,
                                recordName,
                                user: {
                                    success: true,
                                    recordName,
                                    subjectType: 'user',
                                    subjectId: null,
                                    explanation:
                                        'Resource has the publicRead marker.',
                                    permission: {
                                        id: null,
                                        recordName,
                                        resourceKind: 'webhook',
                                        action: 'run',
                                        marker: 'publicRead',
                                        subjectType: 'user',
                                        subjectId: null,
                                        userId: null,
                                        expireTimeMs: null,
                                        options: {},
                                    },
                                },
                                results: [
                                    {
                                        success: true,
                                        recordName,
                                        subjectType: 'user',
                                        subjectId: null,
                                        explanation:
                                            'Resource has the publicRead marker.',
                                        permission: {
                                            id: null,
                                            recordName,
                                            resourceKind: 'webhook',
                                            action: 'run',
                                            marker: 'publicRead',
                                            subjectType: 'user',
                                            subjectId: null,
                                            userId: null,
                                            expireTimeMs: null,
                                            options: {},
                                        },
                                    },
                                ],
                                resourceKind: 'webhook',
                                resourceId: 'item1',
                                action: 'run',
                                markers: ['publicRead'],
                            },
                        ],
                    },
                },
            ]);
        });

        it('should return subscription_limit_reached if the request exceeds the max number of webhook runs per period', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withWebhooks()
                            .withWebhooksMaxRunsPerPeriod(1)
                    )
            );

            await itemsStore.createItem(recordName, {
                address: 'item1',
                markers: [PUBLIC_READ_MARKER],
                targetResourceKind: 'data',
                targetRecordName: 'recordName',
                targetAddress: 'data1',
                userId: null,
            });

            await store.setData(
                'recordName',
                'data1',
                {
                    version: 1,
                    state: {},
                },
                'user1',
                'user2',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            await itemsStore.recordWebhookRun({
                runId: 'run1',
                recordName,
                webhookAddress: 'item1',
                requestTimeMs: 10,
                responseTimeMs: 20,
                errorResult: null,
                statusCode: 200,
                stateSha256: 'sha256',
                infoFileName: 'file1',
                infoRecordName: 'webhookUserId',
            });

            environment.handleHttpRequest.mockResolvedValueOnce({
                success: true,
                response: {
                    statusCode: 200,
                },
                logs: ['abc'],
            });

            const result = await manager.handleWebhook({
                recordName,
                address: 'item1',
                userId: null,
                request: {
                    method: 'GET',
                    path: '/',
                    headers: {},
                    body: JSON.stringify({
                        abc: 'def',
                    }),
                    ipAddress: null,
                    pathParams: {},
                    query: {},
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of webhook runs has been reached for your subscription.',
            });

            expect(environment.handleHttpRequest).not.toHaveBeenCalled();
        });

        it('should return subscription_limit_reached if the request exceeds the max number of webhook runs per hour', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.withUserDefaultFeatures((features) =>
                        features
                            .withAllDefaultFeatures()
                            .withWebhooks()
                            .withWebhookMaxRunsPerHour(1)
                    )
            );

            await itemsStore.createItem(recordName, {
                address: 'item1',
                markers: [PUBLIC_READ_MARKER],
                targetResourceKind: 'data',
                targetRecordName: 'recordName',
                targetAddress: 'data1',
                userId: null,
            });

            await store.setData(
                'recordName',
                'data1',
                {
                    version: 1,
                    state: {},
                },
                'user1',
                'user2',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            await itemsStore.recordWebhookRun({
                runId: 'run1',
                recordName,
                webhookAddress: 'item1',
                requestTimeMs: 10,
                responseTimeMs: 20,
                errorResult: null,
                statusCode: 200,
                stateSha256: 'sha256',
                infoFileName: 'file1',
                infoRecordName: 'webhookUserId',
            });

            environment.handleHttpRequest.mockResolvedValueOnce({
                success: true,
                response: {
                    statusCode: 200,
                },
                logs: ['abc'],
            });

            const result = await manager.handleWebhook({
                recordName,
                address: 'item1',
                userId: null,
                request: {
                    method: 'GET',
                    path: '/',
                    headers: {},
                    body: JSON.stringify({
                        abc: 'def',
                    }),
                    ipAddress: null,
                    pathParams: {},
                    query: {},
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of webhook runs has been reached for your subscription.',
            });

            expect(environment.handleHttpRequest).not.toHaveBeenCalled();
        });

        describe('data', () => {
            it('should call into the factory ', async () => {
                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                await store.setData(
                    'recordName',
                    'data1',
                    {
                        version: 1,
                        state: {},
                    },
                    'user1',
                    'user2',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                });

                expect(environment.handleHttpRequest).toHaveBeenCalledWith({
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    requestUserId: userId,
                    recordName: 'recordName',
                    state: {
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
                    },
                    options: {
                        initTimeoutMs: 5000,
                        requestTimeoutMs: 5000,
                        fetchTimeoutMs: 5000,
                        addStateTimeoutMs: 1000,
                    },
                });
            });

            it('should be able to parse JSON from the data', async () => {
                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                await store.setData(
                    'recordName',
                    'data1',
                    JSON.stringify({
                        version: 1,
                        state: {},
                    }),
                    'user1',
                    'user2',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                });

                expect(environment.handleHttpRequest).toHaveBeenCalledWith({
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    requestUserId: userId,
                    recordName: 'recordName',
                    state: {
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
                    },
                    options: {
                        initTimeoutMs: 5000,
                        requestTimeoutMs: 5000,
                        fetchTimeoutMs: 5000,
                        addStateTimeoutMs: 1000,
                    },
                });
            });

            it('should return invalid_webhook_target if the target doesnt contain valid data', async () => {
                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                await store.setData(
                    'recordName',
                    'data1',
                    {
                        // Wrong version for a stored aux
                        version: 99,
                        state: {},
                    },
                    'user1',
                    'user2',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. The targeted record does not contain valid data.',
                    internalError: {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'The data record does not contain valid AUX data.',
                        issues: [
                            {
                                code: 'invalid_union_discriminator',
                                options: [1, 2],
                                message:
                                    'Invalid discriminator value. Expected 1 | 2',
                                path: ['version'],
                            },
                        ],
                    },
                });

                expect(environment.handleHttpRequest).not.toHaveBeenCalled();
            });

            it('should return not_authorized if the webhook doesnt have the ability to read the data', async () => {
                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                await store.setData(
                    'recordName',
                    'data1',
                    {
                        version: 1,
                        state: {},
                    },
                    'user1',
                    'user2',
                    true,
                    true,
                    [PRIVATE_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. The targeted record was not able to be retrieved.',
                    internalError: {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'The user must be logged in. Please provide a sessionKey or a recordKey.',
                    },
                });
            });
        });

        describe('file', () => {
            it('should call into the factory ', async () => {
                // Record webhook run info result
                setResponse({
                    status: 200,
                    data: {
                        success: true,
                    },
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'file',
                    targetRecordName: 'recordName',
                    targetAddress: 'file1.txt',
                    userId: 'testUser',
                });

                await store.addFileRecord(
                    'recordName',
                    'file1.txt',
                    'user1',
                    'user2',
                    123,
                    'description',
                    [PUBLIC_READ_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                });

                expect(environment.handleHttpRequest).toHaveBeenCalledWith({
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    requestUserId: userId,
                    recordName: 'recordName',
                    state: {
                        type: 'url',
                        requestUrl:
                            'http://localhost:9191/recordName/file1.txt',
                        requestMethod: 'GET',
                        requestHeaders: {
                            'record-name': 'recordName',
                        },
                    },
                    sessionUserId: 'testUser',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    options: {
                        initTimeoutMs: 5000,
                        requestTimeoutMs: 5000,
                        fetchTimeoutMs: 5000,
                        addStateTimeoutMs: 1000,
                    },
                });
            });

            it('should return not_authorized if the webhook doesnt have the ability to read the data', async () => {
                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'data',
                    targetRecordName: 'recordName',
                    targetAddress: 'data1',
                    userId: null,
                });

                await store.setData(
                    'recordName',
                    'data1',
                    {
                        abc: 'def',
                    },
                    'user1',
                    'user2',
                    true,
                    true,
                    [PRIVATE_MARKER]
                );

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. The targeted record was not able to be retrieved.',
                    internalError: {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'The user must be logged in. Please provide a sessionKey or a recordKey.',
                    },
                });
            });
        });

        describe('inst', () => {
            beforeEach(() => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config
                            .withPublicInsts()
                            .withUserDefaultFeatures((features) =>
                                features
                                    .withAllDefaultFeatures()
                                    .withWebhooks()
                                    .withInsts()
                            )
                );
            });

            const inst = 'myInst';

            it('should be able to use a public inst', async () => {
                // Record webhook run info result
                setResponse({
                    status: 200,
                    data: {
                        success: true,
                    },
                });

                const serverConnectionId = 'serverConnectionId';
                await manager.websockets.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionId: serverConnectionId,
                });

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('test', {
                            onWebhook: '@return "Second!"',
                        }),
                        createBot('abc', {
                            onWebhook: '@return "First!"',
                        }),
                        createBot('other', {
                            onWebhook: '@return "Third!"',
                        }),
                    ])
                );

                await manager.websockets.addUpdates(serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName: null,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    updates: [update.update],
                    updateId: 0,
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'inst',
                    targetRecordName: null,
                    targetAddress: inst,
                    userId: 'testUser',
                });

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                });

                expect(environment.handleHttpRequest).toHaveBeenCalledWith({
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    requestUserId: userId,
                    recordName: null,
                    inst: inst,
                    state: {
                        type: 'aux',
                        state: {
                            version: 2,
                            updates: [
                                {
                                    id: 0,
                                    update: update.update,
                                    timestamp: expect.any(Number),
                                },
                            ],
                        },
                    },
                    sessionUserId: 'testUser',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    options: {
                        initTimeoutMs: 5000,
                        requestTimeoutMs: 5000,
                        fetchTimeoutMs: 5000,
                        addStateTimeoutMs: 1000,
                    },
                });
            });

            it('should be able to use a private inst', async () => {
                // Record webhook run info result
                setResponse({
                    status: 200,
                    data: {
                        success: true,
                    },
                });

                const serverConnectionId = 'serverConnectionId';
                await manager.websockets.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionId: serverConnectionId,
                    connectionToken: generateV1ConnectionToken(
                        connectionKey,
                        serverConnectionId,
                        recordName,
                        inst
                    ),
                });

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('test', {
                            onWebhook: '@return "Second!"',
                        }),
                        createBot('abc', {
                            onWebhook: '@return "First!"',
                        }),
                        createBot('other', {
                            onWebhook: '@return "Third!"',
                        }),
                    ])
                );

                await manager.websockets.addUpdates(serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    updates: [update.update],
                    updateId: 0,
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'inst',
                    targetRecordName: recordName,
                    targetAddress: inst,
                    userId: 'testUser',
                });

                store.roles[recordName] = {
                    ['testUser']: new Set([ADMIN_ROLE_NAME]),
                };

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                });

                expect(environment.handleHttpRequest).toHaveBeenCalledWith({
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    requestUserId: userId,
                    recordName,
                    inst: inst,
                    state: {
                        type: 'aux',
                        state: {
                            version: 2,
                            updates: [
                                {
                                    id: 0,
                                    update: update.update,
                                    timestamp: expect.any(Number),
                                },
                            ],
                        },
                    },
                    sessionUserId: 'testUser',
                    sessionKey: expect.any(String),
                    connectionKey: expect.any(String),
                    options: {
                        initTimeoutMs: 5000,
                        requestTimeoutMs: 5000,
                        fetchTimeoutMs: 5000,
                        addStateTimeoutMs: 1000,
                    },
                });
            });

            it('should return invalid_webhook_target if there is no websocket controller', async () => {
                itemsStore = new MemoryWebhookRecordsStore(services.store);
                manager = new WebhookRecordsController({
                    config: services.configStore,
                    policies: services.policies,
                    store: itemsStore,
                    data: new DataRecordsController({
                        config: services.store,
                        metrics: services.store,
                        policies: services.policies,
                        store: services.store,
                    }),
                    files: new FileRecordsController({
                        config: services.store,
                        metrics: services.store,
                        policies: services.policies,
                        store: services.store,
                    }),
                    websockets: null,
                    auth: services.auth,
                    environment: environment,
                });

                // Record webhook run info result
                setResponse({
                    status: 200,
                    data: {
                        success: true,
                    },
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'inst',
                    targetRecordName: recordName,
                    targetAddress: inst,
                    userId: 'testUser',
                });

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. Inst records are not supported in this environment.',
                    internalError: {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage:
                            'Inst records are not supported in this environment.',
                    },
                });

                expect(environment.handleHttpRequest).not.toHaveBeenCalled();
            });

            it('should return not_authorized if the webhook doesnt have the ability to read the inst', async () => {
                // Record webhook run info result
                setResponse({
                    status: 200,
                    data: {
                        success: true,
                    },
                });

                const serverConnectionId = 'serverConnectionId';
                await manager.websockets.login(serverConnectionId, 1, {
                    type: 'login',
                    connectionId: serverConnectionId,
                    connectionToken: generateV1ConnectionToken(
                        connectionKey,
                        serverConnectionId,
                        recordName,
                        inst
                    ),
                });

                const update = constructInitializationUpdate(
                    createInitializationUpdate([
                        createBot('test', {
                            onWebhook: '@return "Second!"',
                        }),
                        createBot('abc', {
                            onWebhook: '@return "First!"',
                        }),
                        createBot('other', {
                            onWebhook: '@return "Third!"',
                        }),
                    ])
                );

                await manager.websockets.addUpdates(serverConnectionId, {
                    type: 'repo/add_updates',
                    recordName,
                    inst,
                    branch: DEFAULT_BRANCH_NAME,
                    updates: [update.update],
                    updateId: 0,
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    targetResourceKind: 'inst',
                    targetRecordName: recordName,
                    targetAddress: inst,
                    userId: 'testUser',
                });

                environment.handleHttpRequest.mockResolvedValueOnce({
                    success: true,
                    response: {
                        statusCode: 200,
                    },
                    logs: ['abc'],
                });

                const result = await manager.handleWebhook({
                    recordName,
                    address: 'item1',
                    userId,
                    request: {
                        method: 'GET',
                        path: '/',
                        headers: {},
                        body: JSON.stringify({
                            abc: 'def',
                        }),
                        ipAddress: null,
                        pathParams: {},
                        query: {},
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_webhook_target',
                    errorMessage:
                        'Invalid webhook target. The targeted record was not able to be retrieved.',
                    internalError: {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            resourceKind: 'inst',
                            resourceId: inst,
                            subjectType: 'user',
                            subjectId: 'testUser',
                            action: 'read',
                        },
                    },
                });

                expect(environment.handleHttpRequest).not.toHaveBeenCalled();
            });
        });
    });

    describe('listWebhookRuns()', () => {
        let webhookRuns: WebhookRunInfo[];

        beforeEach(async () => {
            await store.addRecord({
                name: recordName,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            await store.saveUser({
                id: 'webhookUserId',
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await itemsStore.createItem(recordName, {
                address: 'item1',
                targetAddress: 'data1',
                targetRecordName: recordName,
                targetResourceKind: 'data',
                userId: 'webhookUserId',
                markers: [PUBLIC_READ_MARKER],
            });

            webhookRuns = [];

            for (let i = 0; i < 10; i++) {
                let run: WebhookRunInfo = {
                    runId: `run${i}`,
                    recordName,
                    webhookAddress: `item1`,
                    requestTimeMs: 123 * (i + 1),
                    responseTimeMs: 456 * (i + 1),
                    statusCode: 200,
                    stateSha256: 'sha256',
                    errorResult: null,
                    infoRecordName: 'webhookUserId',
                    infoFileName: `file${i}`,
                };
                webhookRuns.push(run);
                await itemsStore.recordWebhookRun({
                    ...run,
                });

                await store.addFileRecord(
                    'webhookUserId',
                    `file${i}`,
                    'webhookUserId',
                    'webhookUserId',
                    123,
                    'description',
                    ['private:logs']
                );
            }
        });

        it('should return the list of webhook runs', async () => {
            const result = await manager.listWebhookRuns({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName,
                items: sortBy(webhookRuns, (r) => -r.requestTimeMs),
                totalCount: 10,
                marker: null,
            });
        });

        it('should return not_authorized if the user doesnt have read access to the webhook', async () => {
            const result = await manager.listWebhookRuns({
                recordName,
                address: 'item1',
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'webhook',
                    resourceId: 'item1',
                    subjectType: 'user',
                    subjectId: otherUserId,
                    action: 'read',
                },
            });
        });
    });

    describe('getWebhookRun()', () => {
        beforeEach(async () => {
            await store.addRecord({
                name: recordName,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            await store.saveUser({
                id: 'webhookUserId',
                email: null,
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await itemsStore.createItem(recordName, {
                address: 'item1',
                targetAddress: 'data1',
                targetRecordName: recordName,
                targetResourceKind: 'data',
                userId: 'webhookUserId',
                markers: [PUBLIC_READ_MARKER],
            });

            await itemsStore.recordWebhookRun({
                runId: `run1`,
                recordName,
                webhookAddress: `item1`,
                requestTimeMs: 123,
                responseTimeMs: 456,
                statusCode: 200,
                stateSha256: 'sha256',
                errorResult: null,
                infoRecordName: 'webhookUserId',
                infoFileName: `file1`,
            });

            await store.addFileRecord(
                recordName,
                'file1',
                'webhookUserId',
                'webhookUserId',
                123,
                'description',
                ['private:logs']
            );
        });

        it('should return the webhook run', async () => {
            const result = await manager.getWebhookRun({
                runId: 'run1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                run: {
                    runId: 'run1',
                    recordName,
                    webhookAddress: 'item1',
                    requestTimeMs: 123,
                    responseTimeMs: 456,
                    statusCode: 200,
                    stateSha256: 'sha256',
                    errorResult: null,
                    infoRecordName: 'webhookUserId',
                    infoFileName: `file1`,
                },
                infoFileResult: {
                    success: true,
                    requestMethod: 'GET',
                    requestUrl: 'http://localhost:9191/webhookUserId/file1',
                    requestHeaders: {
                        'record-name': 'webhookUserId',
                    },
                },
            });
        });

        it('should omit the info file if the run doesnt have any info', async () => {
            await itemsStore.recordWebhookRun({
                runId: `run1`,
                recordName,
                webhookAddress: `item1`,
                requestTimeMs: 123,
                responseTimeMs: 456,
                statusCode: 200,
                stateSha256: 'sha256',
                errorResult: null,
                infoRecordName: null,
                infoFileName: null,
            });

            const result = await manager.getWebhookRun({
                runId: 'run1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                run: {
                    runId: 'run1',
                    recordName,
                    webhookAddress: 'item1',
                    requestTimeMs: 123,
                    responseTimeMs: 456,
                    statusCode: 200,
                    stateSha256: 'sha256',
                    errorResult: null,
                    infoRecordName: null,
                    infoFileName: null,
                },
                infoFileResult: null,
            });
        });

        it('should return not_authorized if the user doesnt have read access to the webhook', async () => {
            const result = await manager.getWebhookRun({
                runId: 'run1',
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'webhook',
                    resourceId: 'item1',
                    subjectType: 'user',
                    subjectId: otherUserId,
                    action: 'read',
                },
            });
        });
    });
});

describe('STORED_AUX_SCHEMA', () => {
    describe('version 1', () => {
        it('should be able to parse a valid aux', async () => {
            const result = STORED_AUX_SCHEMA.parse({
                version: 1,
                state: {},
            });

            expect(result).toEqual({
                version: 1,
                state: {},
            });
        });

        it('should allow bots to have masks', async () => {
            const result = STORED_AUX_SCHEMA.parse({
                version: 1,
                state: {
                    abc: {
                        id: 'abc',
                        tags: {},
                        masks: {
                            tempLocal: {
                                abc: 'def',
                            },
                        },
                    },
                },
            });

            expect(result).toEqual({
                version: 1,
                state: {
                    abc: {
                        id: 'abc',
                        tags: {},
                        masks: {
                            tempLocal: {
                                abc: 'def',
                            },
                        },
                    },
                },
            });
        });

        it('should catch bots that are missing properties', async () => {
            expect(() => {
                STORED_AUX_SCHEMA.parse({
                    version: 1,
                    state: {
                        abc: {},
                    },
                });
            }).toThrow();
        });

        it('should catch bots that are missing tags', async () => {
            expect(() => {
                STORED_AUX_SCHEMA.parse({
                    version: 1,
                    state: {
                        abc: {
                            id: 'abc',
                        },
                    },
                });
            }).toThrow();
        });
    });
});
