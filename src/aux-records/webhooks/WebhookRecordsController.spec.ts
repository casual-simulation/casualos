import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import { MemoryStore } from '../MemoryStore';
import { PolicyController } from '../PolicyController';
import { RecordsController } from '../RecordsController';
import { WebhookRecordsController } from './WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './MemoryWebhookRecordsStore';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
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
            userId: null,
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
                        abc: 'def',
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
            });
        });
    });
});
