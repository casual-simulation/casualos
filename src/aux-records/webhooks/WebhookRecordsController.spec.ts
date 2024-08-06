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
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
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

    beforeEach(async () => {
        const context = await setupTestContext<
            WebhookRecord,
            WebhookRecordsStore,
            WebhookRecordsController
        >(
            (services) => new MemoryWebhookRecordsStore(services.store),
            (config, services) =>
                new WebhookRecordsController({
                    ...config,
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
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
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
});
