import { DataRecordsController } from './DataRecordsController';
import { MemoryStore } from './MemoryStore';
import {
    AuthorizeUserAndInstancesForResourcesSuccess,
    PolicyController,
} from './PolicyController';
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
    CheckSubscriptionMetricsResult,
    CheckSubscriptionMetricsSuccess,
    CrudRecordItemSuccess,
    CrudRecordsConfiguration,
    CrudRecordsController,
} from './CrudRecordsController';
import {
    ActionKinds,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';

console.log = jest.fn();

describe('CrudRecordsController', () => {
    let store: MemoryStore;
    let itemsStore: MemoryCrudRecordsStore<TestItem>;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: TestController;
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
        manager = new TestController({
            policies,
            store: itemsStore,
            name: 'testItem',
            allowRecordKeys: true,
            resourceKind: 'data',
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
                manager = new TestController({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
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
                manager = new TestController({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
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
                manager.checkSubscriptionMetrics = async (
                    action,
                    authorization,
                    item
                ) => {
                    expect(action).toBe('create');
                    expect(item).toEqual({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    });
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage: 'Subscription limit reached',
                    };
                };

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
                manager = new TestController({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
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
                manager = new TestController({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: false,
                    resourceKind: 'data',
                    config: store,
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
                manager = new TestController({
                    policies,
                    store: itemsStore,
                    name: 'testItem',
                    allowRecordKeys: true,
                    resourceKind: 'data',
                    config: store,
                });

                manager.checkSubscriptionMetrics = async (
                    action,
                    authorization,
                    item
                ) => {
                    expect(action).toBe('update');
                    expect(item).toEqual({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    });
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage: 'Subscription limit reached',
                    };
                };

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

    describe('getItem()', () => {
        beforeEach(async () => {
            await itemsStore.createItem('testRecord', {
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await itemsStore.createItem('testRecord', {
                address: 'address2',
                markers: [PRIVATE_MARKER],
            });

            await itemsStore.createItem('testRecord', {
                address: 'address3',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should return the item if the user has access', async () => {
            const result = await manager.getItem({
                recordName: 'testRecord',
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                },
            });
        });

        it('should be able to use a record key to access the item', async () => {
            const result = await manager.getItem({
                recordName: key,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                },
            });
        });

        it('should return data_not_found if the item was not found', async () => {
            const result = await manager.getItem({
                recordName: 'testRecord',
                userId,
                address: 'missing',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return record_not_found if the record doesnt exist', async () => {
            const result = await manager.getItem({
                recordName: 'missing',
                userId,
                address: 'address',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should return invalid_record_key if record keys are not allowed', async () => {
            manager = new TestController({
                policies,
                store: itemsStore,
                name: 'testItem',
                allowRecordKeys: false,
                resourceKind: 'data',
                config: store,
            });

            const result = await manager.getItem({
                recordName: key,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: expect.any(String),
            });
        });
    });

    describe('eraseItem()', () => {
        beforeEach(async () => {
            await itemsStore.createItem('testRecord', {
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });

            await itemsStore.createItem('testRecord', {
                address: 'address2',
                markers: [PRIVATE_MARKER],
            });

            await itemsStore.createItem('testRecord', {
                address: 'address3',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should erase the item if the user has access', async () => {
            const result = await manager.eraseItem({
                recordName: 'testRecord',
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            await expect(
                itemsStore.getItemByAddress('testRecord', 'address2')
            ).resolves.toBeFalsy();
        });

        it('should erase the item if the record key has access', async () => {
            const result = await manager.eraseItem({
                recordName: key,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            await expect(
                itemsStore.getItemByAddress('testRecord', 'address2')
            ).resolves.toBeFalsy();
        });

        it('should return data_not_found if the item doesnt exist', async () => {
            const result = await manager.eraseItem({
                recordName: 'testRecord',
                userId,
                address: 'missing',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The item was not found.',
            });
        });

        it('should return invalid_record_key if the controller doesnt allow record keys', async () => {
            manager = new TestController({
                policies,
                store: itemsStore,
                name: 'testItem',
                allowRecordKeys: false,
                resourceKind: 'data',
                config: store,
            });

            const result = await manager.eraseItem({
                recordName: key,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: expect.any(String),
            });

            await expect(
                itemsStore.getItemByAddress('testRecord', 'address2')
            ).resolves.toBeTruthy();
        });

        it('should return record_not_found if the record doesnt exist', async () => {
            const result = await manager.eraseItem({
                recordName: 'missing',
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: expect.any(String),
            });

            await expect(
                itemsStore.getItemByAddress('testRecord', 'address2')
            ).resolves.toBeTruthy();
        });
    });

    describe('listItems()', () => {
        let items: TestItem[];
        beforeEach(async () => {
            items = [];
            for (let i = 0; i < 20; i++) {
                const item: TestItem = {
                    address: 'address' + i,
                    markers: [PRIVATE_MARKER],
                };
                await itemsStore.createItem('testRecord', item);
                items.push(item);
            }
        });

        it('should return a list of items', async () => {
            const result = await manager.listItems({
                recordName: 'testRecord',
                userId,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items.slice(0, 10),
                totalCount: 20,
            });
        });

        it('should be able to use a record key', async () => {
            const result = await manager.listItems({
                recordName: key,
                userId,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items.slice(0, 10),
                totalCount: 20,
            });
        });

        it('should return invalid_record_key if record keys are not allowed', async () => {
            manager = new TestController({
                policies,
                store: itemsStore,
                name: 'testItem',
                allowRecordKeys: false,
                resourceKind: 'data',
                config: store,
            });

            const result = await manager.listItems({
                recordName: key,
                userId,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: expect.any(String),
            });
        });

        it('should return items after the given starting address', async () => {
            const result = await manager.listItems({
                recordName: 'testRecord',
                userId,
                startingAddress: 'address3',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items.slice(4, 10),
                totalCount: 20,
            });
        });

        it('should return not_authorized if the user does not have access to the account marker', async () => {
            const result = await manager.listItems({
                recordName: 'testRecord',
                userId: otherUserId,
                startingAddress: 'address3',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
                reason: {
                    action: 'list',
                    recordName: 'testRecord',
                    resourceId: undefined,
                    resourceKind: 'data',
                    subjectId: otherUserId,
                    subjectType: 'user',
                    type: 'missing_permission',
                },
            });
        });
    });

    describe('listItemsByMarker()', () => {
        let items: TestItem[];
        beforeEach(async () => {
            items = [];
            for (let i = 0; i < 40; i++) {
                const item: TestItem = {
                    address: 'address' + i,
                    markers: [
                        i % 2 === 0 ? PRIVATE_MARKER : PUBLIC_READ_MARKER,
                    ],
                };
                await itemsStore.createItem('testRecord', item);
                items.push(item);
            }
        });

        it('should return a list of items that have the given marker', async () => {
            const result = await manager.listItemsByMarker({
                recordName: 'testRecord',
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items
                    .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                    .slice(0, 10),
                totalCount: 20,
            });
        });

        it('should return a list of items that are after the starting address', async () => {
            const result = await manager.listItemsByMarker({
                recordName: 'testRecord',
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: 'address1',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items
                    .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                    .slice(1, 11),
                totalCount: 20,
            });
        });

        it('should be able to use a record key', async () => {
            const result = await manager.listItemsByMarker({
                recordName: key,
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: items
                    .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                    .slice(0, 10),
                totalCount: 20,
            });
        });

        it('should return invalid_record_key if record keys are not allowed', async () => {
            manager = new TestController({
                policies,
                store: itemsStore,
                name: 'testItem',
                allowRecordKeys: false,
                resourceKind: 'data',
                config: store,
            });

            const result = await manager.listItemsByMarker({
                recordName: key,
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: expect.any(String),
            });
        });

        it('should return not_authorized if the user does not have access to the marker', async () => {
            const result = await manager.listItemsByMarker({
                recordName: 'testRecord',
                userId: otherUserId,
                marker: PRIVATE_MARKER,
                startingAddress: null,
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
                reason: {
                    action: 'list',
                    recordName: 'testRecord',
                    resourceId: undefined,
                    resourceKind: 'data',
                    subjectId: otherUserId,
                    subjectType: 'user',
                    type: 'missing_permission',
                },
            });
        });
    });
});

export interface TestItem extends CrudRecord {}

export class TestController extends CrudRecordsController<TestItem> {
    private __checkSubscriptionMetrics: (
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestItem
    ) => Promise<CheckSubscriptionMetricsResult>;

    set checkSubscriptionMetrics(
        value: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        this.__checkSubscriptionMetrics = value;
    }

    constructor(
        config: CrudRecordsConfiguration<TestItem, CrudSubscriptionMetrics>,
        checkSubscriptionMetrics?: (
            action: ActionKinds,
            authorization: AuthorizeUserAndInstancesForResourcesSuccess,
            item?: TestItem
        ) => Promise<CheckSubscriptionMetricsResult>
    ) {
        super(config);
        this.__checkSubscriptionMetrics = checkSubscriptionMetrics as any;
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        authorization: AuthorizeUserAndInstancesForResourcesSuccess,
        item?: TestItem
    ): Promise<CheckSubscriptionMetricsResult> {
        if (this.__checkSubscriptionMetrics) {
            return await this.__checkSubscriptionMetrics(
                action,
                authorization,
                item
            );
        }
        return {
            success: true,
        };
    }
}

// export function testCrudController<T extends CrudRecord, TMetrics extends CrudSubscriptionMetrics>(
//     createStore: () => CrudRecordsStore<T, TMetrics>,
//     createController: (store: CrudRecordsStore<T, TMetrics>) => CrudRecordsController<T, TMetrics>,

// ) {

// }
