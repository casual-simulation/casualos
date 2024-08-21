import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import { MemoryStore } from '../MemoryStore';
import { PolicyController } from '../PolicyController';
import { RecordsController } from '../RecordsController';
import { WebhookRecordsController } from './WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './MemoryWebhookRecordsStore';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import {
    setupTestContext,
    testCrudRecordsController,
} from '../crud/CrudRecordsControllerTests';
import { WebhookRecord, WebhookRecordsStore } from './WebhookRecordsStore';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import { DataRecordsController } from '../DataRecordsController';
import { FileRecordsController } from '../FileRecordsController';
import {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    STORED_AUX_SCHEMA,
} from './WebhookEnvironment';

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

    let userId: string;
    let sessionKey: string;
    let otherUserId: string;
    let recordName: string;
    let environment: {
        handleHttpRequest: jest.Mock<
            Promise<HandleHttpRequestResult>,
            [HandleHttpRequestRequest]
        >;
    };

    beforeEach(async () => {
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
                    environment: environment,
                })
        );

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
        recordName = context.recordName;

        const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
            (features) => features.withAllDefaultFeatures().withWebhooks()
        );

        store.subscriptionConfiguration = builder.config;
    });

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
                    recordName,
                    state: {
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
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
                    recordName,
                    state: {
                        type: 'aux',
                        state: {
                            version: 1,
                            state: {},
                        },
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
                    recordName,
                    state: {
                        type: 'url',
                        requestUrl:
                            'http://localhost:9191/recordName/file1.txt',
                        requestMethod: 'GET',
                        requestHeaders: {
                            'record-name': 'recordName',
                        },
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
