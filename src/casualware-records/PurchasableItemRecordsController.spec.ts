import { MemoryStore, PolicyController, RecordsController } from '@casual-simulation/aux-records';
import { TestController } from '@casual-simulation/aux-records/CrudRecordsController.spec';
import { MemoryCrudRecordsStore } from '@casual-simulation/aux-records/MemoryCrudRecordsStore';
import { PurchasableItem } from './PurchasableItemRecordsStore';
import { MemoryPurchasableItemRecordsStore } from './MemoryPurchasableItemRecordsStore';
import { PurchasableItemRecordsController } from './PurchasableItemRecordsController';
import { createTestControllers, createTestRecordKey, createTestUser } from '@casual-simulation/aux-records/TestUtils';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';

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
        itemsStore = new MemoryCrudRecordsStore(store);
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
                    stripePurchaseLink: 'stripePurchaseLink',
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
                stripePurchaseLink: 'stripePurchaseLink',
            });
        });
    });

});