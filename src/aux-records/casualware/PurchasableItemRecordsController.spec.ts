
import { TestController } from '../CrudRecordsController.spec';
import { MemoryCrudRecordsStore } from '../MemoryCrudRecordsStore';
import { PurchasableItem } from './PurchasableItemRecordsStore';
import { MemoryPurchasableItemRecordsStore } from './MemoryPurchasableItemRecordsStore';
import { PurchasableItemRecordsController } from './PurchasableItemRecordsController';
import { createTestControllers, createTestRecordKey, createTestSubConfiguration, createTestUser } from '../TestUtils';
import { PUBLIC_READ_MARKER, merge } from '@casual-simulation/aux-common';
import { MemoryStore } from '../MemoryStore';
import { PolicyController } from '../PolicyController';
import { RecordsController } from '../RecordsController';
import { FeaturesConfiguration, SubscriptionConfiguration, allowAllFeatures } from '../SubscriptionConfiguration';

console.log = jest.fn();

describe('PurchasableItemRecordsController', () => {
    let store: MemoryStore;
    let itemsStore: MemoryPurchasableItemRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: PurchasableItemRecordsController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    let otherUserId: string;

    beforeEach(async () => {
        const services = createTestControllers();

        store = services.store;
        itemsStore = new MemoryPurchasableItemRecordsStore(store);
        policies = services.policies;
        records = services.records;
        manager = new PurchasableItemRecordsController({
            policies,
            store: itemsStore,
            config: store,
        });

        const user = await createTestUser(services, 'test@example.com');
        userId = user.userId;
        sessionKey = user.sessionKey;

        const testRecordKey = await createTestRecordKey(
            services,
            userId,
            'testRecord',
            'subjectfull'
        );
        key = testRecordKey.recordKey;

        const subjectlessRecordKey = await createTestRecordKey(
            services,
            userId,
            'testRecord',
            'subjectless'
        );
        subjectlessKey = subjectlessRecordKey.recordKey;

        otherUserId = 'otherUserId';
        await store.saveUser({
            id: otherUserId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'other@example.com',
            phoneNumber: null,
        });

        store.subscriptionConfiguration = merge(
            createTestSubConfiguration(),
            {
                subscriptions: [
                    {
                        id: 'sub1',
                        eligibleProducts: [],
                        product: '',
                        featureList: [],
                        tier: 'tier1',
                    },
                ],
                tiers: {
                    tier1: {
                        features: merge(allowAllFeatures(), {
                            purchasableItems: {
                                allowed: true
                            }
                        } as Partial<FeaturesConfiguration>),
                    },
                },
            } as Partial<SubscriptionConfiguration>
        );

        await store.saveUser({
            id: userId,
            email: 'test@example.com',
            phoneNumber: null,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            subscriptionId: 'sub1',
            subscriptionStatus: 'active',
        });
    });

    describe('recordItem()', () => {
        it('should be able to record a purchasable item', async () => {
            const result = await manager.recordItem({
                recordKeyOrRecordName: 'testRecord',
                userId: userId,
                item: {
                    address: 'address',
                    name: 'name',
                    markers: [PUBLIC_READ_MARKER],
                    redirectUrl: 'redirectUrl',
                    roleName: 'roleName',
                    roleGrantTimeMs: 1000,
                    description: 'description',
                    currency: 'USD',
                    cost: 100,
                    imageUrls: ['imageUrl'],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                address: 'address'
            });

            await expect(itemsStore.getItemByAddress('testRecord', 'address')).resolves.toEqual({
                address: 'address',
                name: 'name',
                markers: [PUBLIC_READ_MARKER],
                redirectUrl: 'redirectUrl',
                roleName: 'roleName',
                roleGrantTimeMs: 1000,
                description: 'description',
                currency: 'USD',
                cost: 100,
                imageUrls: ['imageUrl'],
            });
        });

        it('should return not_allowed if purchasable items are not allowed', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                purchasableItems: {
                                    allowed: false
                                }
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            const result = await manager.recordItem({
                recordKeyOrRecordName: 'testRecord',
                userId: userId,
                item: {
                    address: 'address',
                    name: 'name',
                    markers: [PUBLIC_READ_MARKER],
                    redirectUrl: 'redirectUrl',
                    roleName: 'roleName',
                    roleGrantTimeMs: 1000,
                    description: 'description',
                    currency: 'USD',
                    cost: 100,
                    imageUrls: ['imageUrl'],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Purchasable item features are not allowed for this subscription. Make sure you have an active subscription that provides purchasable item features.',
            });

            await expect(itemsStore.getItemByAddress('testRecord', 'address')).resolves.toBe(null);
        });

        it('should return subscription_limit_reached if the user has reached the maximum number of purchasable items', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                purchasableItems: {
                                    allowed: true,
                                    maxPurchasableItems: 0
                                }
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            const result = await manager.recordItem({
                recordKeyOrRecordName: 'testRecord',
                userId: userId,
                item: {
                    address: 'address',
                    name: 'name',
                    markers: [PUBLIC_READ_MARKER],
                    redirectUrl: 'redirectUrl',
                    roleName: 'roleName',
                    roleGrantTimeMs: 1000,
                    description: 'description',
                    currency: 'USD',
                    cost: 100,
                    imageUrls: ['imageUrl'],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: 'The maximum number of purchasable items has been reached for your subscription.',
            });

            await expect(itemsStore.getItemByAddress('testRecord', 'address')).resolves.toBe(null);
        });
    });

    describe('getItem()', () => {
        it('should be able to get a purchasable item', async () => {
            await itemsStore.putItem('testRecord', {
                address: 'address',
                name: 'name',
                markers: [PUBLIC_READ_MARKER],
                redirectUrl: 'redirectUrl',
                roleName: 'roleName',
                roleGrantTimeMs: 1000,
                description: 'description',
                currency: 'USD',
                cost: 100,
                imageUrls: ['imageUrl'],
            });

            const result = await manager.getItem({
                recordName: 'testRecord', 
                address: 'address',
                userId: userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    name: 'name',
                    markers: [PUBLIC_READ_MARKER],
                    redirectUrl: 'redirectUrl',
                    roleName: 'roleName',
                    roleGrantTimeMs: 1000,
                    description: 'description',
                    currency: 'USD',
                    cost: 100,
                    imageUrls: ['imageUrl'],
                }
            });
        });
    });

    describe('eraseItem()', () => {
        beforeEach(async () => {
            await itemsStore.putItem('testRecord', {
                address: 'address',
                name: 'name',
                markers: [PUBLIC_READ_MARKER],
                redirectUrl: 'redirectUrl',
                roleName: 'roleName',
                roleGrantTimeMs: 1000,
                description: 'description',
                currency: 'USD',
                cost: 100,
                imageUrls: ['imageUrl'],
            });
        });

        it('should delete the given item', async () => {
            const result = await manager.eraseItem({
                recordName: 'testRecord', 
                address: 'address',
                userId: userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });
        });

        it('should return not_authorized when purchasable items are not allowed', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                purchasableItems: {
                                    allowed: false
                                }
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            const result = await manager.eraseItem({
                recordName: 'testRecord', 
                address: 'address',
                userId: userId,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Purchasable item features are not allowed for this subscription. Make sure you have an active subscription that provides purchasable item features.',
            });
        });
    });

});