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
import type { MemoryStore } from '../../MemoryStore';
import type { RecordsController } from '../../RecordsController';
import type { PolicyController } from '../../PolicyController';
import type {
    SubCrudRecordsConfiguration,
    SubCrudRecordsController,
} from './SubCrudRecordsController';
import type { CrudRecord, CrudRecordsStore } from '../CrudRecordsStore';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../../TestUtils';
import type { ActionKinds, ResourceKinds } from '@casual-simulation/aux-common';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import type { SubCrudRecord, SubCrudRecordsStore } from './SubCrudRecordsStore';
import type { CrudRecordItemSuccess } from '../CrudRecordsController';

export type TestControllers = ReturnType<typeof createTestControllers>;

export type TestControllerConfiguration<
    TKey,
    TItem extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, TItem>,
    TRecordStore extends CrudRecordsStore<CrudRecord>
> = Omit<
    SubCrudRecordsConfiguration<TKey, TItem, TStore, TRecordStore>,
    'resourceKind' | 'allowRecordKeys' | 'name'
>;

export interface TestContext<
    TKey,
    TItem extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, TItem>,
    TRecordStore extends CrudRecordsStore<CrudRecord>,
    TController extends SubCrudRecordsController<
        TKey,
        TItem,
        TStore,
        TRecordStore
    >
> {
    services: TestControllers;
    store: MemoryStore;
    itemsStore: TStore;
    recordItemsStore: TRecordStore;
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
    TKey,
    TItem extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, TItem>,
    TRecordStore extends CrudRecordsStore<CrudRecord>,
    TController extends SubCrudRecordsController<
        TKey,
        TItem,
        TStore,
        TRecordStore
    >
>(
    recordStoreFactory: (services: TestControllers) => TRecordStore,
    storeFactory: (
        services: TestControllers,
        recordStore: TRecordStore
    ) => TStore,
    controllerFactory: (
        config: TestControllerConfiguration<TKey, TItem, TStore, TRecordStore>,
        services: TestControllers
    ) => TController
): Promise<TestContext<TKey, TItem, TStore, TRecordStore, TController>> {
    const services = createTestControllers();
    const store = services.store;
    const recordItemsStore = recordStoreFactory(services);
    const itemsStore = storeFactory(services, recordItemsStore);
    const policies = services.policies;
    const recordName = 'testRecord';
    const manager = controllerFactory(
        {
            policies,
            store: itemsStore,
            recordItemStore: recordItemsStore,
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
        recordItemsStore,
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
 * @param createTestItem The factory function that creates a test item.
 * @param configureEnvironment An optional function that can be used to configure the environment before the tests are run.
 */
export function testCrudRecordsController<
    TKey,
    TItem extends SubCrudRecord<TKey>,
    TStore extends SubCrudRecordsStore<TKey, TItem>,
    TRecordStore extends CrudRecordsStore<CrudRecord>,
    TController extends SubCrudRecordsController<
        TKey,
        TItem,
        TStore,
        TRecordStore
    >
>(
    allowRecordKeys: boolean,
    resourceKind: ResourceKinds,
    recordStoreFactory: (services: TestControllers) => TRecordStore,
    storeFactory: (
        services: TestControllers,
        recordStore: TRecordStore
    ) => TStore,
    controllerFactory: (
        config: TestControllerConfiguration<TKey, TItem, TStore, TRecordStore>,
        services: TestControllers
    ) => TController,
    createKey: (id: number) => TKey,
    createTestItem: (item: SubCrudRecord<TKey>) => TItem,
    createRecordItem: (item: CrudRecord) => CrudRecord,
    configureEnvironment?: (
        context: TestContext<TKey, TItem, TStore, TRecordStore, TController>
    ) => Promise<void>,
    allowedActions: ActionKinds[] = [
        'create',
        'read',
        'update',
        'delete',
        'list',
    ]
) {
    let context: TestContext<TKey, TItem, TStore, TRecordStore, TController>;
    let services: TestControllers;
    let store: MemoryStore;
    let itemsStore: TStore;
    let recordItemsStore: TRecordStore;
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
        context = await setupTestContext(
            recordStoreFactory,
            storeFactory,
            controllerFactory
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore;
        recordItemsStore = context.recordItemsStore;
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

    if (
        allowedActions.includes('create') ||
        allowedActions.includes('update')
    ) {
        describe('recordItem()', () => {
            if (allowedActions.includes('create')) {
                describe('create', () => {
                    beforeEach(async () => {
                        await recordItemsStore.createItem(
                            recordName,
                            createRecordItem({
                                address: 'address',
                                markers: [PUBLIC_READ_MARKER],
                            })
                        );
                    });

                    it('should store the item in the store', async () => {
                        const item = createTestItem({
                            address: 'address',
                            key: createKey(0),
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
                            itemsStore.getItemByKey(
                                recordName,
                                'address',
                                createKey(0)
                            )
                        ).resolves.toMatchObject({
                            item,
                            parentMarkers: [PUBLIC_READ_MARKER],
                        });
                    });

                    it('should return data_not_found if the record item doesnt exist', async () => {
                        const item = createTestItem({
                            address: 'missing',
                            key: createKey(0),
                        });
                        const result = (await manager.recordItem({
                            recordKeyOrRecordName: recordName,
                            userId,
                            item,
                            instances: [],
                        })) as CrudRecordItemSuccess;

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'data_not_found',
                            errorMessage: expect.any(String),
                        });

                        await expect(
                            itemsStore.getItemByKey(
                                recordName,
                                'missing',
                                createKey(0)
                            )
                        ).resolves.toMatchObject({
                            item: null,
                            parentMarkers: null,
                        });
                    });

                    it('should reject the request if given an invalid key', async () => {
                        const result = (await manager.recordItem({
                            recordKeyOrRecordName: 'not_a_key',
                            userId,
                            item: createTestItem({
                                address: 'address',
                                key: createKey(0),
                            }),
                            instances: [],
                        })) as CrudRecordItemSuccess;

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'record_not_found',
                            errorMessage: expect.any(String),
                        });

                        await expect(
                            itemsStore.getItemByKey(
                                recordName,
                                'address',
                                createKey(0)
                            )
                        ).resolves.toMatchObject({
                            item: null,
                            parentMarkers: [PUBLIC_READ_MARKER],
                        });
                    });

                    if (allowRecordKeys) {
                        it('should support using a record key', async () => {
                            const result = (await manager.recordItem({
                                recordKeyOrRecordName: key,
                                userId: otherUserId,
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
                                }),
                                instances: [],
                            })) as CrudRecordItemSuccess;

                            expect(result).toEqual({
                                success: true,
                                recordName: recordName,
                                address: 'address',
                            });

                            await expect(
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toEqual({
                                item: {
                                    address: 'address',
                                    key: createKey(0),
                                },
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });

                        it('should be able to use subjectless keys', async () => {
                            const result = (await manager.recordItem({
                                recordKeyOrRecordName: subjectlessKey,
                                userId: otherUserId,
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
                                }),
                                instances: [],
                            })) as CrudRecordItemSuccess;

                            expect(result).toEqual({
                                success: true,
                                recordName: recordName,
                                address: 'address',
                            });

                            await expect(
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toEqual({
                                item: {
                                    address: 'address',
                                    key: createKey(0),
                                },
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });
                    } else {
                        it('should reject the request if record keys are not allowed', async () => {
                            const result = (await manager.recordItem({
                                recordKeyOrRecordName: key,
                                userId: otherUserId,
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item: null,
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });

                        it('should reject the request if subjectless keys are not allowed', async () => {
                            const result = (await manager.recordItem({
                                recordKeyOrRecordName: subjectlessKey,
                                userId: otherUserId,
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item: null,
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });
                    }
                });
            }

            if (allowedActions.includes('update')) {
                describe('update', () => {
                    beforeEach(async () => {
                        await recordItemsStore.createItem(
                            recordName,
                            createRecordItem({
                                address: 'address',
                                markers: [PUBLIC_READ_MARKER],
                            })
                        );
                        await itemsStore.createItem(
                            recordName,
                            createTestItem({
                                address: 'address',
                                key: createKey(0),
                            })
                        );
                    });

                    it('should update the markers in the store', async () => {
                        const item = createTestItem({
                            address: 'address',
                            key: createKey(0),
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
                            itemsStore.getItemByKey(
                                recordName,
                                'address',
                                createKey(0)
                            )
                        ).resolves.toMatchObject({
                            item,
                            parentMarkers: [PUBLIC_READ_MARKER],
                        });
                    });

                    it('should reject the request if given an invalid key', async () => {
                        const item = createTestItem({
                            address: 'address',
                            key: createKey(0),
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
                            itemsStore.getItemByKey(
                                recordName,
                                'address',
                                createKey(0)
                            )
                        ).resolves.toMatchObject({
                            item,
                            parentMarkers: [PUBLIC_READ_MARKER],
                        });
                    });

                    if (allowRecordKeys) {
                        it('should support using a record key', async () => {
                            const item = createTestItem({
                                address: 'address',
                                key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item,
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });

                        it('should be able to use subjectless keys', async () => {
                            const item = createTestItem({
                                address: 'address',
                                key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item,
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });
                    } else {
                        it('should reject the request if record keys are not allowed', async () => {
                            const item = createTestItem({
                                address: 'address',
                                key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
                                }),
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });

                        it('should reject the request if subjectless keys are not allowed', async () => {
                            const item = createTestItem({
                                address: 'address',
                                key: createKey(0),
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
                                itemsStore.getItemByKey(
                                    recordName,
                                    'address',
                                    createKey(0)
                                )
                            ).resolves.toMatchObject({
                                item: createTestItem({
                                    address: 'address',
                                    key: createKey(0),
                                }),
                                parentMarkers: [PUBLIC_READ_MARKER],
                            });
                        });
                    }
                });
            }
        });
    }

    if (allowedActions.includes('read')) {
        describe('getItem()', () => {
            beforeEach(async () => {
                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address2',
                        markers: [PRIVATE_MARKER],
                    })
                );

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address3',
                        markers: [PRIVATE_MARKER],
                    })
                );

                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address',
                        key: createKey(1),
                    })
                );

                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address2',
                        key: createKey(2),
                    })
                );

                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address3',
                        key: createKey(3),
                    })
                );
            });

            it('should return the item if the user has access', async () => {
                const result = await manager.getItem({
                    recordName: recordName,
                    userId,
                    address: 'address2',
                    key: createKey(2),
                    instances: [],
                });

                expect(result).toMatchObject({
                    success: true,
                    item: createTestItem({
                        address: 'address2',
                        key: createKey(2),
                    }),
                });
            });

            it('should return data_not_found if the item was not found', async () => {
                const result = await manager.getItem({
                    recordName: recordName,
                    userId,
                    address: 'missing',
                    key: createKey(0),
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
                    key: createKey(1),
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
                        key: createKey(2),
                        instances: [],
                    });

                    expect(result).toEqual({
                        success: true,
                        item: createTestItem({
                            address: 'address2',
                            key: createKey(2),
                        }),
                    });
                });
            } else {
                it('should return not_authorized if record keys are not allowed', async () => {
                    const result = await manager.getItem({
                        recordName: key,
                        userId: otherUserId,
                        address: 'address2',
                        key: createKey(2),
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
    }

    if (allowedActions.includes('delete')) {
        describe('eraseItem()', () => {
            beforeEach(async () => {
                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );
                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address',
                        key: createKey(1),
                    })
                );

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address2',
                        markers: [PRIVATE_MARKER],
                    })
                );
                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address2',
                        key: createKey(2),
                    })
                );

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address3',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );
                await itemsStore.createItem(
                    recordName,
                    createTestItem({
                        address: 'address3',
                        key: createKey(3),
                    })
                );
            });

            it('should erase the item if the user has access', async () => {
                const result = await manager.eraseItem({
                    recordName: recordName,
                    userId,
                    address: 'address2',
                    key: createKey(2),
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                });

                await expect(
                    itemsStore.getItemByKey(
                        recordName,
                        'address2',
                        createKey(2)
                    )
                ).resolves.toMatchObject({
                    item: null,
                    parentMarkers: [PRIVATE_MARKER],
                });
            });

            it('should return data_not_found if the record item doesnt exist', async () => {
                const result = await manager.eraseItem({
                    recordName: recordName,
                    userId,
                    address: 'missing',
                    key: createKey(2),
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'The item was not found.',
                });
            });

            it('should return data_not_found if the item doesnt exist', async () => {
                const result = await manager.eraseItem({
                    recordName: recordName,
                    userId,
                    address: 'address',
                    key: createKey(99),
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
                        key: createKey(2),
                        instances: [],
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    await expect(
                        itemsStore.getItemByKey(
                            recordName,
                            'address2',
                            createKey(2)
                        )
                    ).resolves.toMatchObject({
                        item: null,
                        parentMarkers: [PRIVATE_MARKER],
                    });
                });
            } else {
                it('should return not_authorized if the controller doesnt allow record keys', async () => {
                    const result = await manager.eraseItem({
                        recordName: key,
                        userId: otherUserId,
                        address: 'address2',
                        key: createKey(2),
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
                        itemsStore.getItemByKey(
                            recordName,
                            'address2',
                            createKey(2)
                        )
                    ).resolves.toBeTruthy();
                });
            }

            it('should return record_not_found if the record doesnt exist', async () => {
                const result = await manager.eraseItem({
                    recordName: 'missing',
                    userId,
                    address: 'address2',
                    key: createKey(2),
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByKey(
                        recordName,
                        'address2',
                        createKey(2)
                    )
                ).resolves.toBeTruthy();
            });
        });
    }

    if (allowedActions.includes('list')) {
        describe('listItems()', () => {
            let items: TItem[];
            beforeEach(async () => {
                items = [];

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address',
                        markers: [PUBLIC_READ_MARKER],
                    })
                );

                for (let i = 0; i < 20; i++) {
                    const item = createTestItem({
                        address: 'address',
                        key: createKey(i),
                    });
                    await itemsStore.createItem(recordName, item);
                    items.push(item);
                }
            });

            it('should return a list of items', async () => {
                const result = await manager.listItems({
                    recordName: recordName,
                    userId: otherUserId,
                    address: 'address',
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName: recordName,
                    items: items,
                    totalCount: 20,
                });
            });

            if (allowRecordKeys) {
                it('should be able to use a record key', async () => {
                    await recordItemsStore.updateItem(
                        recordName,
                        createRecordItem({
                            address: 'address',
                            markers: [PRIVATE_MARKER],
                        })
                    );

                    const result = await manager.listItems({
                        recordName: key,
                        userId: otherUserId,
                        address: 'address',
                        instances: [],
                    });

                    expect(result).toEqual({
                        success: true,
                        recordName: recordName,
                        items: items,
                        totalCount: 20,
                    });
                });
            } else {
                it('should return not_authorized if record keys are not allowed', async () => {
                    await recordItemsStore.updateItem(
                        recordName,
                        createRecordItem({
                            address: 'address',
                            markers: [PRIVATE_MARKER],
                        })
                    );

                    const result = await manager.listItems({
                        recordName: key,
                        userId: otherUserId,
                        address: 'address',
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

            it('should return not_authorized if the user does not have access to the record item marker', async () => {
                items = [];

                await recordItemsStore.createItem(
                    recordName,
                    createRecordItem({
                        address: 'address2',
                        markers: [PRIVATE_MARKER],
                    })
                );

                for (let i = 0; i < 20; i++) {
                    const item = createTestItem({
                        address: 'address2',
                        key: createKey(i),
                    });
                    await itemsStore.createItem(recordName, item);
                    items.push(item);
                }

                const result = await manager.listItems({
                    recordName: recordName,
                    userId: otherUserId,
                    address: 'address2',
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
}
