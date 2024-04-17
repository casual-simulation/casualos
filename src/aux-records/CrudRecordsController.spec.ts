import { DataRecordsController } from './DataRecordsController';
import { MemoryStore } from './MemoryStore';
import { PolicyController } from './PolicyController';
import { RecordsController } from './RecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from './TestUtils';
import { MemoryCrudRecordsStore } from './MemoryCrudRecordsStore';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from './CrudRecordsStore';
import {
    CheckSubscriptionMetricsSuccess,
    CrudRecordItemSuccess,
    CrudRecordsController,
} from './CrudRecordsController';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { address } from 'faker';

console.log = jest.fn();

describe('CrudRecordsController', () => {
    let store: MemoryStore;
    let itemsStore: MemoryCrudRecordsStore<TestItem>;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: CrudRecordsController<TestItem>;
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
        manager = new CrudRecordsController<TestItem>({
            policies,
            store: itemsStore,
            name: 'testItem',
            allowRecordKeys: true,
            resourceKind: 'data',
            config: store,
            checkSubscriptionMetrics: async () => ({
                success: true,
            }),
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
        describe('create', () => {
            it('should store the item in the store', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should support using a record name', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'testRecord',
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if given an invalid key', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'not_a_key',
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toBeFalsy();
            });

            it('should be able to use subjectless keys', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: subjectlessKey,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if record keys are not allowed', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async () => ({
                        success: true,
                    }),
                });

                const result = (await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toBeFalsy();
            });

            it('should reject the request if subjectless keys are not allowed', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async () => ({
                        success: true,
                    }),
                });

                const result = (await manager.recordItem({
                    recordKeyOrRecordName: subjectlessKey,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toBeFalsy();
            });

            it('should reject the request if the subscription check fails', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: true,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async (
                        metrics,
                        action,
                        authorization
                    ) => {
                        expect(action).toBe('create');
                        return {
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage: 'Subscription limit reached',
                        };
                    },
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: 'Subscription limit reached',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toBeFalsy();
            });
        });

        describe('update', () => {
            beforeEach(async () => {
                await itemsStore.createItem('testRecord', {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should update the markers in the store', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PRIVATE_MARKER],
                });
            });

            it('should support using a record name', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'testRecord',
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PRIVATE_MARKER],
                });
            });

            it('should reject the request if given an invalid key', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'not_a_key',
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should be able to use subjectless keys', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: subjectlessKey,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PRIVATE_MARKER],
                });
            });

            it('should reject the request if record keys are not allowed', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async () => ({
                        success: true,
                    }),
                });

                const result = (await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if subjectless keys are not allowed', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async () => ({
                        success: true,
                    }),
                });

                const result = (await manager.recordItem({
                    recordKeyOrRecordName: subjectlessKey,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if the subscription check fails', async () => {
                manager = new CrudRecordsController<TestItem>({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: true,
                    resourceKind: 'data',
                    config: store,
                    checkSubscriptionMetrics: async (
                        metrics,
                        action,
                        authorization
                    ) => {
                        expect(action).toBe('update');
                        return {
                            success: false,
                            errorCode: 'subscription_limit_reached',
                            errorMessage: 'Subscription limit reached',
                        };
                    },
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId,
                    item: {
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage: 'Subscription limit reached',
                });

                await expect(
                    itemsStore.getItemByAddress('testRecord', 'address')
                ).resolves.toEqual({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });
        });
    });
});

export interface TestItem extends CrudRecord {}

// export function testCrudController<T extends CrudRecord, TMetrics extends CrudSubscriptionMetrics>(
//     createStore: () => CrudRecordsStore<T, TMetrics>,
//     createController: (store: CrudRecordsStore<T, TMetrics>) => CrudRecordsController<T, TMetrics>,

// ) {

// }
