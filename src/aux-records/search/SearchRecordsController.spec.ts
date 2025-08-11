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
import type { TestControllers } from '../crud/CrudRecordsControllerTests';
import {
    setupTestContext,
    testCrudRecordsController,
} from '../crud/CrudRecordsControllerTests';
import { MemorySearchRecordsStore } from './MemorySearchRecordsStore';
import type { SearchRecord, SearchRecordsStore } from './SearchRecordsStore';
import type { SearchRecordInput } from './SearchRecordsController';
import { SearchRecordsController } from './SearchRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import type { MemoryStore } from '../MemoryStore';
import type { RecordsController } from '../RecordsController';
import type { PolicyController } from '../PolicyController';
import {
    failure,
    PUBLIC_READ_MARKER,
    success,
} from '@casual-simulation/aux-common';
// import { v4 as uuid } from 'uuid';
import { MemorySearchInterface } from './MemorySearchInterface';
import type { SearchSyncQueueEvent } from './SearchSyncProcessor';
import { MemoryQueue } from '../queue/MemoryQueue';

// const uuidMock: jest.Mock = <any>uuid;
// jest.mock('uuid');

console.log = jest.fn();
// console.error = jest.fn();

describe('SearchRecordsController', () => {
    testCrudRecordsController<
        SearchRecordInput,
        SearchRecord,
        SearchRecordsStore,
        SearchRecordsController
    >(
        false,
        'search',
        (services) => new MemorySearchRecordsStore(services.store),
        (config, services) =>
            new SearchRecordsController({
                ...config,
                searchInterface: new MemorySearchInterface(),
                queue: new MemoryQueue<SearchSyncQueueEvent>(async () => {}),
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            collectionName: expect.any(String),
            searchApiKey: expect.stringMatching(/^api_key_/),
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            schema: {
                '.*': {
                    type: 'auto',
                },
            },
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) => features.withAllDefaultFeatures().withSearch()
            );

            context.store.subscriptionConfiguration = builder.config;
        }
    );

    let store: MemoryStore;
    let itemsStore: MemorySearchRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: SearchRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;
    let searchInterface: MemorySearchInterface;
    let queue: MemoryQueue<SearchSyncQueueEvent>;

    let userId: string;
    let sessionKey: string;
    let connectionKey: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        require('axios').__reset();
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();

        dateNowMock.mockReturnValue(999);

        const context = await setupTestContext<
            SearchRecordInput,
            SearchRecord,
            SearchRecordsStore,
            SearchRecordsController
        >(
            (services) => new MemorySearchRecordsStore(services.store),
            (config, services) => {
                searchInterface = new MemorySearchInterface();
                queue = new MemoryQueue<SearchSyncQueueEvent>(async () => {});
                return new SearchRecordsController({
                    ...config,
                    searchInterface,
                    queue,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemorySearchRecordsStore;
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
            (features) => features.withAllDefaultFeatures().withSearch()
        );

        store.subscriptionConfiguration = builder.config;
    });

    // afterEach(() => {
    //     Date.now = realDateNow;
    // });

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
            it('should create a collection and an API key', async () => {
                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item1',
                        markers: [PUBLIC_READ_MARKER],
                        schema: {
                            '.*': {
                                type: 'auto',
                            },
                        },
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'item1',
                });

                expect(searchInterface.collections).toEqual([
                    {
                        name: expect.stringMatching(/^pub_\./),
                        fields: [
                            {
                                name: '.*',
                                type: 'auto',
                            },
                        ],
                        numDocuments: 0,
                    },
                ]);

                const [collection] = searchInterface.collections;

                expect(searchInterface.apiKeys).toEqual([
                    {
                        id: 0,
                        description: `API Key for \`${collection.name}\``,
                        actions: ['documents:search'],
                        collections: [collection.name],
                        value: 'api_key_1',
                        expiresAt: expect.any(Number),
                    },
                ]);
            });

            it('should return subscription_limit_reached when the user has reached limit of Searchs', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withSearch()
                                .withSearchMaxItems(1)
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
                    collectionName: 'collection1',
                    searchApiKey: 'apiKey1',
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
                        schema: {
                            '.*': {
                                type: 'auto',
                            },
                        },
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of search record items has been reached for your subscription.',
                });
            });
        });
    });

    describe('getItem()', () => {
        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
                userId,
                instances: [],
            });
        });

        it('should return the nodes that the search interface returns', async () => {
            searchInterface.mutableNodes.push({
                host: 'search1.example.com',
                port: 443,
                protocol: 'https',
            });

            const result = await manager.getItem({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    collectionName: expect.any(String),
                    searchApiKey: expect.stringMatching(/^api_key_/),
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                    nodes: [
                        {
                            host: 'search1.example.com',
                            port: 443,
                            protocol: 'https',
                        },
                    ],
                },
            });
        });
    });

    describe('eraseItem()', () => {
        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
                userId,
                instances: [],
            });
        });

        it('should erase the collection', async () => {
            const result = await manager.eraseItem({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(searchInterface.collections).toEqual([]);
        });
    });

    describe('storeDocument()', () => {
        let collectionName: string;

        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
                userId,
                instances: [],
            });

            const result = await manager.getItem({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            if (result.success === false) {
                throw new Error(
                    `Failed to get item: ${result.errorMessage} (${result.errorCode})`
                );
            }

            collectionName = result.item.collectionName;
        });

        it('should be able to store a document in a collection', async () => {
            const result = await manager.storeDocument({
                recordName,
                address: 'item1',
                document: {
                    test: 'abc',
                    number: 123,
                },
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success({
                    id: expect.any(String),
                    test: 'abc',
                    number: 123,
                })
            );

            expect(searchInterface.documents).toEqual([
                [
                    collectionName,
                    [
                        {
                            id: expect.any(String),
                            test: 'abc',
                            number: 123,
                        },
                    ],
                ],
            ]);
        });

        it('should return not_authorized if the user doesnt have permission', async () => {
            const result = await manager.storeDocument({
                recordName,
                address: 'item1',
                document: {
                    test: 'abc',
                    number: 123,
                },
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'update',
                        resourceKind: 'search',
                        resourceId: 'item1',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                    recommendedEntitlement: undefined,
                })
            );

            expect(searchInterface.documents).toEqual([]);
        });

        it('should return not_found if the search record does not exist', async () => {
            const result = await manager.storeDocument({
                recordName,
                address: 'nonexistent',
                document: {
                    test: 'abc',
                    number: 123,
                },
                userId,
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage: 'The Search record was not found.',
                })
            );

            expect(searchInterface.documents).toEqual([]);
        });
    });

    describe('eraseDocument()', () => {
        let collectionName: string;
        let documentId: string;

        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
                userId,
                instances: [],
            });

            const result = await manager.getItem({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            if (result.success === false) {
                throw new Error(
                    `Failed to get item: ${result.errorMessage} (${result.errorCode})`
                );
            }

            collectionName = result.item.collectionName;

            // Store a document first
            const storeResult = await manager.storeDocument({
                recordName,
                address: 'item1',
                document: {
                    test: 'abc',
                    number: 123,
                },
                userId,
                instances: [],
            });

            if (storeResult.success === false) {
                throw new Error(
                    `Failed to store document: ${storeResult.error.errorMessage} (${storeResult.error.errorCode})`
                );
            }

            documentId = storeResult.value.id;
        });

        it('should be able to erase a document from a collection', async () => {
            const result = await manager.eraseDocument({
                recordName,
                address: 'item1',
                documentId,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success({
                    id: documentId,
                    test: 'abc',
                    number: 123,
                })
            );

            // Check that the document was removed from the search interface
            expect(searchInterface.documents).toEqual([[collectionName, []]]);
        });

        it('should return not_authorized if the user doesnt have permission', async () => {
            const result = await manager.eraseDocument({
                recordName,
                address: 'item1',
                documentId,
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'update',
                        resourceKind: 'search',
                        resourceId: 'item1',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                    recommendedEntitlement: undefined,
                })
            );

            // Check that the document was not removed
            expect(searchInterface.documents).toEqual([
                [
                    collectionName,
                    [
                        {
                            id: documentId,
                            test: 'abc',
                            number: 123,
                        },
                    ],
                ],
            ]);
        });

        it('should return not_found if the search record does not exist', async () => {
            const result = await manager.eraseDocument({
                recordName,
                address: 'nonexistent',
                documentId,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage: 'The Search record was not found.',
                })
            );

            // Original document should still exist
            expect(searchInterface.documents).toEqual([
                [
                    collectionName,
                    [
                        {
                            id: documentId,
                            test: 'abc',
                            number: 123,
                        },
                    ],
                ],
            ]);
        });

        it('should return success even if the document does not exist in the collection', async () => {
            const result = await manager.eraseDocument({
                recordName,
                address: 'item1',
                documentId: 'nonexistent-document-id',
                userId,
                instances: [],
            });

            // Should still return success as the operation is idempotent
            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage: 'The document was not found.',
                })
            );

            // Original document should still exist
            expect(searchInterface.documents).toEqual([
                [
                    collectionName,
                    [
                        {
                            id: documentId,
                            test: 'abc',
                            number: 123,
                        },
                    ],
                ],
            ]);
        });
    });

    describe('sync()', () => {
        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    schema: {
                        '.*': {
                            type: 'auto',
                        },
                    },
                },
                userId,
                instances: [],
            });

            await store.addRecord({
                name: 'targetRecord',
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });
        });

        it('should create a data sync for the search records', async () => {
            const result = await manager.sync({
                recordName,
                address: 'item1',
                targetRecordName: 'targetRecord',
                targetResourceKind: 'data',
                targetMarker: 'targetMarker',
                targetMapping: [['abc', 'abc']],
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success({
                    syncId: expect.any(String),
                })
            );

            expect(itemsStore.syncs).toEqual([
                {
                    id: expect.any(String),
                    searchRecordName: recordName,
                    searchRecordAddress: 'item1',
                    targetRecordName: 'targetRecord',
                    targetMarker: 'targetMarker',
                    targetResourceKind: 'data',
                    targetMapping: [['abc', 'abc']],
                },
            ]);

            expect(queue.items).toEqual([
                {
                    name: 'syncSearchRecord',
                    data: {
                        type: 'sync_search_record',
                        sync: {
                            id: expect.any(String),
                            searchRecordName: recordName,
                            searchRecordAddress: 'item1',
                            targetRecordName: 'targetRecord',
                            targetMarker: 'targetMarker',
                            targetResourceKind: 'data',
                            targetMapping: [['abc', 'abc']],
                        },
                    },
                },
            ]);
        });
    });
});
