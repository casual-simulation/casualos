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
import type { RecordsController } from '../RecordsController';
import type { PolicyController } from '../PolicyController';
import type {
    CrudListItemsSuccess,
    CrudRecordItemSuccess,
    CrudRecordsConfiguration,
    CrudRecordsController,
} from './CrudRecordsController';
import type { CrudRecord, CrudRecordsStore } from './CrudRecordsStore';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../TestUtils';
import type { ResourceKinds } from '@casual-simulation/aux-common';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';

export type TestControllers = ReturnType<typeof createTestControllers>;

export type TestControllerConfiguration<
    TItem extends CrudRecord,
    TStore extends CrudRecordsStore<CrudRecord>
> = Omit<
    CrudRecordsConfiguration<TItem, TStore>,
    'resourceKind' | 'allowRecordKeys' | 'name'
>;

export interface TestContext<
    TItem extends CrudRecord,
    TStoreItem extends CrudRecord,
    TStore extends CrudRecordsStore<TStoreItem>,
    TController extends CrudRecordsController<
        TItem,
        TStoreItem,
        TStore,
        TResult
    >,
    TResult extends Partial<TStoreItem> = TStoreItem
> {
    services: TestControllers;
    store: MemoryStore;
    itemsStore: TStore;
    manager: TController;
    userId: string;
    sessionKey: string;
    otherUserId: string;
    key: string;
    subjectlessKey: string;
    recordName: string;
    connectionKey: string;
}

/**
 * Creates a new test context that can be used to test a CRUD records controller.
 * @param storeFactory The factory function that creates the store.
 * @param controllerFactory The factory function that creates the controller.
 */
export async function setupTestContext<
    TItem extends CrudRecord,
    TStoreItem extends CrudRecord,
    TStore extends CrudRecordsStore<TStoreItem>,
    TController extends CrudRecordsController<
        TItem,
        TStoreItem,
        TStore,
        TResult
    >,
    TResult extends Partial<TStoreItem> = TStoreItem
>(
    storeFactory: (services: TestControllers) => TStore,
    controllerFactory: (
        config: TestControllerConfiguration<TItem, TStore>,
        services: TestControllers
    ) => TController
): Promise<TestContext<TItem, TStoreItem, TStore, TController, TResult>> {
    const services = createTestControllers();
    const store = services.store;
    const itemsStore = storeFactory(services);
    const policies = services.policies;
    const recordName = 'testRecord';
    const manager = controllerFactory(
        {
            policies,
            store: itemsStore,
            config: store,
        },
        services
    );

    const user = await createTestUser(services, 'test@example.com');
    const userId = user.userId;
    const sessionKey = user.sessionKey;
    const connectionKey = user.connectionKey;

    const testRecordKey = await createTestRecordKey(
        services,
        userId,
        recordName,
        'subjectfull'
    );
    const key = testRecordKey.recordKey;

    const subjectlessRecordKey = await createTestRecordKey(
        services,
        userId,
        recordName,
        'subjectless'
    );
    const subjectlessKey = subjectlessRecordKey.recordKey;

    const otherUserId = 'otherUserId';
    await store.saveUser({
        id: otherUserId,
        allSessionRevokeTimeMs: null,
        currentLoginRequestId: null,
        email: 'other@example.com',
        phoneNumber: null,
    });

    return {
        services,
        key,
        manager,
        otherUserId,
        sessionKey,
        store,
        itemsStore,
        subjectlessKey,
        userId,
        recordName,
        connectionKey,
    };
}

/**
 * Runs all of the common tests for a CRUD records controller.
 * @param allowRecordKeys Whether record keys can be used to access the resources.
 * @param resourceKind The resource kind that should be expected.
 * @param storeFactory The factory function that creates the store.
 * @param controllerFactory The factory function that creates the controller.
 * @param createStoreItem The factory function that creates a test item.
 * @param configureEnvironment An optional function that can be used to configure the environment before the tests are run.
 */
export function testCrudRecordsController<
    TItem extends CrudRecord,
    TStoreItem extends CrudRecord,
    TStore extends CrudRecordsStore<TStoreItem>,
    TController extends CrudRecordsController<
        TItem,
        TStoreItem,
        TStore,
        TResult
    >,
    TResult extends Partial<TStoreItem> = TStoreItem
>(
    allowRecordKeys: boolean,
    resourceKind: ResourceKinds,
    storeFactory: (services: TestControllers) => TStore,
    controllerFactory: (
        config: TestControllerConfiguration<TItem, TStore>,
        services: TestControllers
    ) => TController,
    createStoreItem: (item: CrudRecord) => TStoreItem,
    createInputItem: (item: CrudRecord) => TItem,
    configureEnvironment?: (
        context: TestContext<TItem, TStoreItem, TStore, TController, TResult>
    ) => Promise<void>
) {
    let context: TestContext<TItem, TStoreItem, TStore, TController, TResult>;
    let services: TestControllers;
    let store: MemoryStore;
    let itemsStore: TStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: TController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        context = await setupTestContext(storeFactory, controllerFactory);

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore;
        records = services.records;
        policies = services.policies;
        manager = context.manager;
        key = context.key;
        subjectlessKey = context.subjectlessKey;
        userId = context.userId;
        sessionKey = context.sessionKey;
        otherUserId = context.otherUserId;
        recordName = context.recordName;

        if (configureEnvironment) {
            await configureEnvironment(context);
        }
    });

    describe('recordItem()', () => {
        describe('create', () => {
            it('should store the item in the store', async () => {
                const item = createInputItem({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId,
                    item,
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: recordName,
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address')
                ).resolves.toMatchObject(
                    createStoreItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );
            });

            it('should reject the request if given an invalid key', async () => {
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'not_a_key',
                    userId,
                    item: createInputItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    }),
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address')
                ).resolves.toBeFalsy();
            });

            if (allowRecordKeys) {
                it('should support using a record key', async () => {
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: key,
                        userId: otherUserId,
                        item: createInputItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        }),
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: true,
                        recordName: recordName,
                        address: 'address',
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toEqual({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    });
                });

                it('should be able to use subjectless keys', async () => {
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: subjectlessKey,
                        userId: otherUserId,
                        item: createInputItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        }),
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: true,
                        recordName: recordName,
                        address: 'address',
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toEqual({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    });
                });
            } else {
                it('should reject the request if record keys are not allowed', async () => {
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: key,
                        userId: otherUserId,
                        item: createInputItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        }),
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: expect.any(String),
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            action: 'create',
                            resourceKind,
                            resourceId: 'address',
                            subjectType: 'user',
                            subjectId: otherUserId,
                        },
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toBeFalsy();
                });

                it('should reject the request if subjectless keys are not allowed', async () => {
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: subjectlessKey,
                        userId: otherUserId,
                        item: createInputItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        }),
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: expect.any(String),
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            action: 'create',
                            resourceKind,
                            resourceId: 'address',
                            subjectType: 'user',
                            subjectId: otherUserId,
                        },
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toBeFalsy();
                });
            }
        });

        describe('update', () => {
            beforeEach(async () => {
                await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId,
                    item: createInputItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    }),
                    instances: [],
                });
            });

            it('should update the markers in the store', async () => {
                const item = createInputItem({
                    address: 'address',
                    markers: [PRIVATE_MARKER],
                });
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId,
                    item,
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: recordName,
                    address: 'address',
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address')
                ).resolves.toMatchObject(
                    createStoreItem({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    })
                );
            });

            it('should reject the request if given an invalid key', async () => {
                const item = createInputItem({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
                const result = (await manager.recordItem({
                    recordKeyOrRecordName: 'not_a_key',
                    userId,
                    item,
                    instances: [],
                })) as CrudRecordItemSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address')
                ).resolves.toMatchObject(
                    createStoreItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );
            });

            if (allowRecordKeys) {
                it('should support using a record key', async () => {
                    const item = createInputItem({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    });
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: key,
                        userId,
                        item,
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: true,
                        recordName: recordName,
                        address: 'address',
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toMatchObject(item);
                });

                it('should be able to use subjectless keys', async () => {
                    const item = createInputItem({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    });
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: subjectlessKey,
                        userId,
                        item,
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: true,
                        recordName: recordName,
                        address: 'address',
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toMatchObject(item);
                });
            } else {
                it('should reject the request if record keys are not allowed', async () => {
                    const item = createInputItem({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    });
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: key,
                        userId: otherUserId,
                        item,
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: expect.any(String),
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            action: 'update',
                            resourceKind,
                            resourceId: 'address',
                            subjectType: 'user',
                            subjectId: otherUserId,
                        },
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toMatchObject(
                        createStoreItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        })
                    );
                });

                it('should reject the request if subjectless keys are not allowed', async () => {
                    const item = createInputItem({
                        address: 'address',
                        markers: [PRIVATE_MARKER],
                    });
                    const result = (await manager.recordItem({
                        recordKeyOrRecordName: subjectlessKey,
                        userId: otherUserId,
                        item,
                        instances: [],
                    })) as CrudRecordItemSuccess;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage: expect.any(String),
                        reason: {
                            type: 'missing_permission',
                            recordName,
                            action: 'update',
                            resourceKind,
                            resourceId: 'address',
                            subjectType: 'user',
                            subjectId: otherUserId,
                        },
                    });

                    await expect(
                        itemsStore.getItemByAddress(recordName, 'address')
                    ).resolves.toMatchObject(
                        createStoreItem({
                            address: 'address',
                            markers: [PUBLIC_READ_MARKER],
                        })
                    );
                });
            }
        });
    });

    describe('getItem()', () => {
        beforeEach(async () => {
            await itemsStore.createItem(
                recordName,
                createStoreItem({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                })
            );

            await itemsStore.createItem(
                recordName,
                createStoreItem({
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                })
            );

            await itemsStore.createItem(
                recordName,
                createStoreItem({
                    address: 'address3',
                    markers: [PUBLIC_READ_MARKER],
                })
            );
        });

        it('should return the item if the user has access', async () => {
            const result = await manager.getItem({
                recordName: recordName,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toMatchObject({
                success: true,
                item: createStoreItem({
                    address: 'address2',
                    markers: [PRIVATE_MARKER],
                }),
            });
        });

        it('should return data_not_found if the item was not found', async () => {
            const result = await manager.getItem({
                recordName: recordName,
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

        if (allowRecordKeys) {
            it('should be able to use a record key to access the item', async () => {
                const result = await manager.getItem({
                    recordName: key,
                    userId,
                    address: 'address2',
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    item: createStoreItem({
                        address: 'address2',
                        markers: [PRIVATE_MARKER],
                    }),
                });
            });
        } else {
            it('should return not_authorized if record keys are not allowed', async () => {
                const result = await manager.getItem({
                    recordName: key,
                    userId: otherUserId,
                    address: 'address2',
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'read',
                        resourceKind,
                        resourceId: 'address2',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });
            });
        }
    });

    describe('eraseItem()', () => {
        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: createInputItem({
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                }),
                userId,
                instances: [],
            });

            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: createInputItem({
                    address: 'address2',
                    markers: [PUBLIC_READ_MARKER],
                }),
                userId,
                instances: [],
            });

            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: createInputItem({
                    address: 'address3',
                    markers: [PUBLIC_READ_MARKER],
                }),
                userId,
                instances: [],
            });
        });

        it('should erase the item if the user has access', async () => {
            const result = await manager.eraseItem({
                recordName: recordName,
                userId,
                address: 'address2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            await expect(
                itemsStore.getItemByAddress(recordName, 'address2')
            ).resolves.toBeFalsy();
        });

        it('should return data_not_found if the item doesnt exist', async () => {
            const result = await manager.eraseItem({
                recordName: recordName,
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

        if (allowRecordKeys) {
            it('should erase the item if the record key has access', async () => {
                const result = await manager.eraseItem({
                    recordName: key,
                    userId: otherUserId,
                    address: 'address2',
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address2')
                ).resolves.toBeFalsy();
            });
        } else {
            it('should return not_authorized if the controller doesnt allow record keys', async () => {
                const result = await manager.eraseItem({
                    recordName: key,
                    userId: otherUserId,
                    address: 'address2',
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'delete',
                        resourceKind,
                        resourceId: 'address2',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });

                await expect(
                    itemsStore.getItemByAddress(recordName, 'address2')
                ).resolves.toBeTruthy();
            });
        }

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
                itemsStore.getItemByAddress(recordName, 'address2')
            ).resolves.toBeTruthy();
        });
    });

    describe('listItems()', () => {
        let items: TStoreItem[];
        beforeEach(async () => {
            items = [];
            for (let i = 0; i < 20; i++) {
                const item = createStoreItem({
                    address: 'address' + i,
                    markers: [PRIVATE_MARKER],
                });
                await itemsStore.createItem(recordName, item);
                items.push(item);
            }
        });

        it('should return a list of items', async () => {
            const result = (await manager.listItems({
                recordName: recordName,
                userId,
                startingAddress: null,
                instances: [],
            })) as CrudListItemsSuccess<any>;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                items: expect.any(Array),
                totalCount: 20,
            });

            const expectedItems = items.slice(0, 10);
            expect(result.items.length).toBe(expectedItems.length);
            for (let i = 0; i < expectedItems.length; i++) {
                expect(result.items[i]).toMatchObject(expectedItems[i]);
            }
        });

        if (allowRecordKeys) {
            it('should be able to use a record key', async () => {
                const result = (await manager.listItems({
                    recordName: key,
                    userId: otherUserId,
                    startingAddress: null,
                    instances: [],
                })) as CrudListItemsSuccess<any>;

                expect(result).toEqual({
                    success: true,
                    recordName: recordName,
                    items: expect.any(Array),
                    totalCount: 20,
                });

                const expectedItems = items.slice(0, 10);
                expect(result.items.length).toBe(expectedItems.length);
                for (let i = 0; i < expectedItems.length; i++) {
                    expect(result.items[i]).toMatchObject(expectedItems[i]);
                }
            });
        } else {
            it('should return not_authorized if record keys are not allowed', async () => {
                const result = await manager.listItems({
                    recordName: key,
                    userId: otherUserId,
                    startingAddress: null,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'list',
                        resourceKind,
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });
            });
        }

        it('should return items after the given starting address', async () => {
            const result = (await manager.listItems({
                recordName: recordName,
                userId,
                startingAddress: 'address3',
                instances: [],
            })) as CrudListItemsSuccess<any>;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                items: expect.any(Array),
                totalCount: 20,
            });

            const expectedItems = items.slice(4, 10);
            expect(result.items.length).toBe(expectedItems.length);
            for (let i = 0; i < expectedItems.length; i++) {
                expect(result.items[i]).toMatchObject(expectedItems[i]);
            }
        });

        it('should return not_authorized if the user does not have access to the account marker', async () => {
            const result = await manager.listItems({
                recordName: recordName,
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
                    recordName: recordName,
                    resourceId: undefined,
                    resourceKind: resourceKind,
                    subjectId: otherUserId,
                    subjectType: 'user',
                    type: 'missing_permission',
                },
            });
        });
    });

    describe('listItemsByMarker()', () => {
        let items: TStoreItem[];
        beforeEach(async () => {
            items = [];
            for (let i = 0; i < 40; i++) {
                const item = createStoreItem({
                    address: 'address' + i,
                    markers: [
                        i % 2 === 0 ? PRIVATE_MARKER : PUBLIC_READ_MARKER,
                    ],
                });
                await itemsStore.createItem(recordName, item);
                items.push(item);
            }
        });

        it('should return a list of items that have the given marker', async () => {
            const result = (await manager.listItemsByMarker({
                recordName: recordName,
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: null,
                instances: [],
            })) as CrudListItemsSuccess<any>;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                items: expect.any(Array),
                totalCount: 20,
            });

            const expectedItems = items
                .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                .slice(0, 10);
            expect(result.items.length).toBe(expectedItems.length);
            for (let i = 0; i < expectedItems.length; i++) {
                expect(result.items[i]).toMatchObject(expectedItems[i]);
            }
        });

        it('should return a list of items that are after the starting address', async () => {
            const result = (await manager.listItemsByMarker({
                recordName: recordName,
                userId,
                marker: PRIVATE_MARKER,
                startingAddress: 'address1',
                instances: [],
            })) as CrudListItemsSuccess<any>;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                items: expect.any(Array),
                totalCount: 20,
            });

            const expectedItems = items
                .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                .slice(1, 11);
            expect(result.items.length).toBe(expectedItems.length);
            for (let i = 0; i < expectedItems.length; i++) {
                expect(result.items[i]).toMatchObject(expectedItems[i]);
            }
        });

        if (allowRecordKeys) {
            it('should be able to use a record key', async () => {
                const result = (await manager.listItemsByMarker({
                    recordName: key,
                    userId: otherUserId,
                    marker: PRIVATE_MARKER,
                    startingAddress: null,
                    instances: [],
                })) as CrudListItemsSuccess<any>;

                expect(result).toEqual({
                    success: true,
                    recordName: recordName,
                    items: expect.any(Array),
                    totalCount: 20,
                });

                const expectedItems = items
                    .filter((i) => i.markers.indexOf(PRIVATE_MARKER) >= 0)
                    .slice(0, 10);
                expect(result.items.length).toBe(expectedItems.length);
                for (let i = 0; i < expectedItems.length; i++) {
                    expect(result.items[i]).toMatchObject(expectedItems[i]);
                }
            });
        } else {
            it('should return not_authorized if record keys are not allowed', async () => {
                const result = (await manager.listItemsByMarker({
                    recordName: key,
                    userId: otherUserId,
                    marker: PRIVATE_MARKER,
                    startingAddress: null,
                    instances: [],
                })) as CrudListItemsSuccess<any>;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'list',
                        resourceKind,
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });
            });
        }

        it('should return not_authorized if the user does not have access to the marker', async () => {
            const result = await manager.listItemsByMarker({
                recordName: recordName,
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
                    recordName: recordName,
                    resourceId: undefined,
                    resourceKind: resourceKind,
                    subjectId: otherUserId,
                    subjectType: 'user',
                    type: 'missing_permission',
                },
            });
        });
    });
}
