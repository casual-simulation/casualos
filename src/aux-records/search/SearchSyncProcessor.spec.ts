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

import {
    failure,
    PUBLIC_READ_MARKER,
    success,
} from '@casual-simulation/aux-common';
import type { SearchSyncQueueEvent } from './SearchSyncProcessor';
import { SearchSyncProcessor, mapItem } from './SearchSyncProcessor';
import { MemoryStore } from '../MemoryStore';
import { MemorySearchRecordsStore } from './MemorySearchRecordsStore';
import { MemorySearchInterface } from './MemorySearchInterface';
import type { UserPolicy } from '../DataRecordsStore';

interface DataRecord {
    address: string;
    data: any;
    publisherId: string;
    subjectId: string;
    updatePolicy: UserPolicy;
    deletePolicy: UserPolicy;
    markers: string[];
}

console.warn = jest.fn();

describe('SearchSyncProcessor', () => {
    let processor: SearchSyncProcessor;
    let dataStore: MemoryStore;
    let searchRecordsStore: MemorySearchRecordsStore;
    let searchInterface: MemorySearchInterface;

    beforeEach(() => {
        dataStore = new MemoryStore({
            subscriptions: null,
        });
        searchRecordsStore = new MemorySearchRecordsStore(dataStore);
        searchInterface = new MemorySearchInterface();
        processor = new SearchSyncProcessor({
            search: searchRecordsStore,
            searchInterface: searchInterface,
            data: dataStore,
        });
    });

    async function setData(recordName: string, data: DataRecord[]) {
        for (const record of data) {
            await dataStore.setData(
                recordName,
                record.address,
                record.data,
                record.publisherId,
                record.subjectId,
                record.updatePolicy,
                record.deletePolicy,
                record.markers
            );
        }
    }

    describe('process', () => {
        const targetRecordName = 'targetRecord';
        const searchRecordName = 'searchRecord';
        const searchRecordAddress = 'address';
        const ownerId = 'ownerId';

        const collectionName = 'collectionName';

        beforeEach(async () => {
            await dataStore.addRecord({
                name: targetRecordName,
                ownerId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            await searchRecordsStore.createItem(searchRecordName, {
                address: searchRecordAddress,
                collectionName,
                searchApiKey: 'searchApiKey',
                markers: [PUBLIC_READ_MARKER],
            });

            await searchInterface.createCollection({
                name: collectionName,
                fields: [
                    {
                        name: 'userName',
                        type: 'string',
                    },
                    {
                        name: 'userEmail',
                        type: 'string',
                    },
                ],
            });
        });

        describe('sync_search_record', () => {
            it('should sync data records to the search interface', async () => {
                // Arrange: Set up test data with marker
                const marker = 'test-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: {
                            name: 'John',
                            age: 30,
                            email: 'john@example.com',
                        },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record2',
                        data: {
                            name: 'Jane',
                            age: 25,
                            email: 'jane@example.com',
                        },
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record3',
                        data: {
                            name: 'Bob',
                            age: 35,
                            email: 'bob@example.com',
                        },
                        publisherId: 'pub3',
                        subjectId: 'sub3',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName: searchRecordName,
                        searchRecordAddress: searchRecordAddress,
                        targetRecordName: targetRecordName,
                        targetResourceKind: 'data',
                        targetMarker: marker,
                        targetMapping: [
                            ['$.name', 'userName'],
                            ['$.email', 'userEmail'],
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 3,
                        numErrored: 0,
                        numTotal: 3,
                    },
                ]);

                // Verify documents were added to search interface
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(3);

                // Verify document content
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                expect(documents).toHaveLength(3);

                expect(documents[0]).toMatchObject({
                    userName: 'John',
                    userEmail: 'john@example.com',
                });

                expect(documents[1]).toMatchObject({
                    userName: 'Jane',
                    userEmail: 'jane@example.com',
                });

                expect(documents[2]).toMatchObject({
                    userName: 'Bob',
                    userEmail: 'bob@example.com',
                });
            });

            it('should only sync data with the specified marker', async () => {
                // Arrange: Set up test data with different markers
                const targetMarker = 'target-marker';
                const otherMarker = 'other-marker';

                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: { name: 'John', email: 'john@example.com' },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [targetMarker],
                    },
                    {
                        address: 'record2',
                        data: { name: 'Jane', email: 'jane@example.com' },
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [otherMarker],
                    },
                    {
                        address: 'record3',
                        data: { name: 'Bob', email: 'bob@example.com' },
                        publisherId: 'pub3',
                        subjectId: 'sub3',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [targetMarker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'],
                            ['$.email', 'userEmail'],
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Verify documents were added to search interface
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(2);

                // Verify correct documents were synced
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                const names = documents.map((doc) => doc.userName);
                expect(names).toContain('John');
                expect(names).toContain('Bob');
                expect(names).not.toContain('Jane');
            });

            it('should skip data that does not satisfy the mapping', async () => {
                // Arrange: Set up test data with missing fields
                const marker = 'test-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: { name: 'John', email: 'john@example.com' },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record2',
                        data: { email: 'jane@example.com' }, // Missing name field
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record3',
                        data: { name: 'Bob' }, // Missing email field
                        publisherId: 'pub3',
                        subjectId: 'sub3',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'], // Required field
                            ['$.email', 'userEmail'], // Required field
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify process completed (continues despite mapping failures)
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 1, // Only valid record synced
                        numErrored: 2, // Two records failed mapping
                        numTotal: 3,
                    },
                ]);

                // Verify only valid records were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(1);

                // Verify correct document was synced
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                expect(documents[0]).toMatchObject({
                    userName: 'John',
                    userEmail: 'john@example.com',
                });
            });

            it('should skip data that is not an object', async () => {
                // Arrange: Set up test data with missing fields
                const marker = 'test-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: { name: 'John', email: 'john@example.com' },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record2',
                        data: 2,
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record3',
                        data: 'hello',
                        publisherId: 'pub3',
                        subjectId: 'sub3',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record4',
                        data: true,
                        publisherId: 'pub4',
                        subjectId: 'sub4',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record5',
                        data: [0, 1, 2],
                        publisherId: 'pub5',
                        subjectId: 'sub5',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record6',
                        data: null,
                        publisherId: 'pub6',
                        subjectId: 'sub6',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'], // Required field
                            ['$.email', 'userEmail'], // Required field
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify process completed (continues despite mapping failures)
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 1, // Only valid record synced
                        numErrored: 5, // Five records failed mapping
                        numTotal: 6,
                    },
                ]);

                // Verify only valid records were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(1);

                // Verify correct document was synced
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                expect(documents[0]).toMatchObject({
                    userName: 'John',
                    userEmail: 'john@example.com',
                });
            });

            it('should mark the result as failed if all mappings fail', async () => {
                // Arrange: Set up test data with missing fields
                const marker = 'test-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record2',
                        data: 2,
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record3',
                        data: 'hello',
                        publisherId: 'pub3',
                        subjectId: 'sub3',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record4',
                        data: true,
                        publisherId: 'pub4',
                        subjectId: 'sub4',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record5',
                        data: [0, 1, 2],
                        publisherId: 'pub5',
                        subjectId: 'sub5',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record6',
                        data: null,
                        publisherId: 'pub6',
                        subjectId: 'sub6',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'], // Required field
                            ['$.email', 'userEmail'], // Required field
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify process completed (continues despite mapping failures)
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage:
                            'All mappings failed for all records (5).',
                        status: 'failure',
                        success: false,
                        numSynced: 0,
                        numErrored: 0,
                        numTotal: 0,
                    },
                ]);

                // Verify only valid records were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(0);

                // Verify correct document was synced
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                expect(documents.length).toBe(0);
            });

            it('should handle optional mapping fields with ? suffix', async () => {
                // Arrange: Set up test data with optional fields
                const marker = 'test-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: {
                            name: 'John',
                            email: 'john@example.com',
                            age: 30,
                        },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                    {
                        address: 'record2',
                        data: { name: 'Jane', email: 'jane@example.com' }, // Missing age
                        publisherId: 'pub2',
                        subjectId: 'sub2',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'],
                            ['$.email', 'userEmail'],
                            ['$.age?', 'userAge'], // Optional field
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify success
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 2,
                        numErrored: 0,
                        numTotal: 2,
                    },
                ]);

                // Verify both records were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(2);

                // Verify document content
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);

                const johnDoc = documents.find(
                    (doc) => doc.userName === 'John'
                );
                expect(johnDoc).toMatchObject({
                    userName: 'John',
                    userEmail: 'john@example.com',
                    userAge: 30,
                });

                const janeDoc = documents.find(
                    (doc) => doc.userName === 'Jane'
                );
                expect(janeDoc).toMatchObject({
                    userName: 'Jane',
                    userEmail: 'jane@example.com',
                });
                expect(janeDoc).not.toHaveProperty('userAge');
            });

            it('should handle large datasets (100 records)', async () => {
                // Arrange: Set up 100 test records
                const marker = 'large-test-marker';
                const testData: DataRecord[] = [];

                for (let i = 0; i < 100; i++) {
                    testData.push({
                        address: `record${i}`,
                        data: {
                            name: `User${i}`,
                            email: `user${i}@example.com`,
                            index: i,
                        },
                        publisherId: `pub${i}`,
                        subjectId: `sub${i}`,
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    });
                }

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'],
                            ['$.email', 'userEmail'],
                            ['$.index', 'userIndex'],
                        ],
                    },
                };

                // Act: Process the sync event
                const startTime = Date.now();
                await processor.process(event);
                const endTime = Date.now();

                // Assert: Verify success
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 100,
                        numErrored: 0,
                        numTotal: 100,
                    },
                ]);

                // Verify all records were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(100);

                // Verify performance (should complete within reasonable time)
                const processingTime = endTime - startTime;
                expect(processingTime).toBeLessThan(1000); // Less than 1 second

                // Verify sample documents
                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                const firstDoc = documents.find((doc) => doc.userIndex === 0);
                const lastDoc = documents.find((doc) => doc.userIndex === 99);

                expect(firstDoc).toMatchObject({
                    userName: 'User0',
                    userEmail: 'user0@example.com',
                    userIndex: 0,
                });

                expect(lastDoc).toMatchObject({
                    userName: 'User99',
                    userEmail: 'user99@example.com',
                    userIndex: 99,
                });
            });

            it('should handle empty data gracefully', async () => {
                // Arrange: Set up empty data (no records to add)
                const marker = 'empty-marker';

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.name', 'userName'],
                            ['$.email', 'userEmail'],
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify success
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 0,
                        numErrored: 0,
                        numTotal: 0,
                    },
                ]);

                // Verify no documents were synced
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(0);
            });

            it('should handle data with complex nested structures', async () => {
                // Arrange: Set up test data with nested objects
                const marker = 'nested-marker';
                const testData: DataRecord[] = [
                    {
                        address: 'record1',
                        data: {
                            user: {
                                profile: {
                                    name: 'John Doe',
                                    contact: {
                                        email: 'john@example.com',
                                        phone: '123-456-7890',
                                    },
                                },
                                metadata: {
                                    tags: ['admin', 'active'],
                                },
                            },
                        },
                        publisherId: 'pub1',
                        subjectId: 'sub1',
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [marker],
                    },
                ];

                await setData(targetRecordName, testData);

                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'data',
                        targetMapping: [
                            ['$.user.profile.name', 'fullName'],
                            ['$.user.profile.contact.email', 'email'],
                            ['$.user.metadata.tags.0', 'primaryTag'],
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify success
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: null,
                        status: 'success',
                        success: true,
                        numSynced: 1,
                        numErrored: 0,
                        numTotal: 1,
                    },
                ]);

                // Verify document was synced correctly
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(1);

                const documents =
                    searchInterface.getCollectionDocuments(collectionName);
                expect(documents[0]).toMatchObject({
                    fullName: 'John Doe',
                    email: 'john@example.com',
                    primaryTag: 'admin',
                });
            });

            it('should fail if the resource kind is unsupported', async () => {
                // Arrange: Set up test data with nested objects
                const marker = 'nested-marker';
                const event: SearchSyncQueueEvent = {
                    type: 'sync_search_record',
                    sync: {
                        id: 'sync',
                        searchRecordName,
                        searchRecordAddress,
                        targetRecordName,
                        targetMarker: marker,
                        targetResourceKind: 'file',
                        targetMapping: [
                            ['$.user.profile.name', 'fullName'],
                            ['$.user.profile.contact.email', 'email'],
                            ['$.user.metadata.tags.0', 'primaryTag'],
                        ],
                    },
                };

                // Act: Process the sync event
                await processor.process(event);

                // Assert: Verify success
                expect(searchRecordsStore.syncHistory).toEqual([
                    {
                        id: expect.any(String),
                        runId: expect.any(String),
                        syncId: 'sync',
                        searchRecordAddress: searchRecordAddress,
                        searchRecordName: searchRecordName,
                        timeMs: expect.any(Number),
                        errorMessage: 'Unsupported target resource kind: file',
                        status: 'failure',
                        success: false,
                        numSynced: 0,
                        numErrored: 0,
                        numTotal: 0,
                    },
                ]);

                // Verify document was synced correctly
                const collection = await searchInterface.getCollection(
                    collectionName
                );
                expect(collection).toBeDefined();
                expect(collection!.numDocuments).toBe(0);
            });
        });

        describe('sync_item', () => {});
    });
});

describe('mapItem()', () => {
    it('should produce an object that contains only the specified fields', () => {
        const result = mapItem(
            {
                a: 1,
                b: 2,
                c: 3,
            },
            [
                ['a', 'd'],
                ['c', 'e'],
            ]
        );

        expect(result).toEqual(
            success({
                d: 1,
                e: 3,
            })
        );
    });

    it('should be able to map based on dot notation', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: {
                    z: {
                        w: 3,
                    },
                },
            },
            [
                ['a.x', 'd'],
                ['c.z.w', 'e'],
            ]
        );

        expect(result).toEqual(
            success({
                d: 1,
                e: 3,
            })
        );
    });

    it('should be able to use $ to refer to the root', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: {
                    z: {
                        w: 3,
                    },
                },
            },
            [
                ['$.a.x', 'd'],
                ['$.c.z.w', 'e'],
            ]
        );

        expect(result).toEqual(
            success({
                d: 1,
                e: 3,
            })
        );
    });

    it('should be able to map arrays', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: [3, 4, 5],
            },
            [
                ['a.x', 'd'],
                ['c.1', 'e'],
            ]
        );

        expect(result).toEqual(
            success({
                d: 1,
                e: 4,
            })
        );
    });

    it('should fail if the property does not exist', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: 3,
            },
            [['a.missing', 'd']]
        );

        expect(result).toEqual(
            failure({
                errorCode: 'invalid_request',
                errorMessage: `Property missing. Could not find 'missing' (full path: 'a.missing') on '$.a'`,
            })
        );
    });

    it('should ignore properties if the part ends with ?', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: 3,
            },
            [['a.missing?', 'e']]
        );

        expect(result).toEqual(success({}));
    });

    it('should be able to set values by priority', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: 3,
            },
            [
                ['a.missing?', 'e'],
                ['a.i?', 'e'],
                ['b?', 'e'],
            ]
        );

        expect(result).toEqual(
            success({
                e: 2,
            })
        );
    });

    it('should not be able to access the constructor', () => {
        const result = mapItem(
            {
                a: {
                    x: 1,
                    y: 2,
                },
                b: 2,
                c: 3,
            },
            [
                ['a.x', 'd'],
                ['constructor', 'e'],
            ]
        );

        expect(result).toEqual(
            failure({
                errorCode: 'invalid_request',
                errorMessage: `Property missing. Could not find 'constructor' (full path: 'constructor') on '$'`,
            })
        );
    });
});
