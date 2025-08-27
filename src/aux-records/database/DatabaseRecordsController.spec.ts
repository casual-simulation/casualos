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
import { MemoryDatabaseRecordsStore } from './MemoryDatabaseRecordsStore';
import type {
    DatabaseRecord,
    DatabaseRecordsStore,
} from './DatabaseRecordsStore';
import type {
    DatabaseRecordInput,
    DatabaseRecordOutput,
} from './DatabaseRecordsController';
import { DatabaseRecordsController } from './DatabaseRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import type { MemoryStore } from '../MemoryStore';
import type { RecordsController } from '../RecordsController';
import type { PolicyController } from '../PolicyController';
import { PUBLIC_READ_MARKER, success } from '@casual-simulation/aux-common';
import { MemoryDatabaseInterface } from './MemoryDatabaseInterface';
import { query } from './DatabaseUtils';

console.log = jest.fn();
// console.error = jest.fn();

describe('DatabaseRecordsController', () => {
    testCrudRecordsController<
        DatabaseRecordInput,
        DatabaseRecord,
        DatabaseRecordsStore,
        DatabaseRecordsController,
        DatabaseRecordOutput
    >(
        false,
        'database',
        (services) => new MemoryDatabaseRecordsStore(services.store),
        (config, services) =>
            new DatabaseRecordsController({
                ...config,
                databaseInterfaceProviderName: 'sqlite',
                databaseInterface: new MemoryDatabaseInterface(),
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            databaseProvider: 'sqlite',
            databaseInfo: {
                filePath: expect.stringMatching(/^[a-z0-9-]+$/),
            },
            databaseName: expect.stringMatching(/^[a-z0-9-]+$/),
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) => features.withAllDefaultFeatures().withDatabases()
            );

            context.store.subscriptionConfiguration = builder.config;
        },
        (item) => ({
            address: item.address,
            markers: item.markers,
        }),
        (context) => {
            (context.manager as any)._databaseInterface.dispose();
        }
    );

    let store: MemoryStore;
    let itemsStore: MemoryDatabaseRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: DatabaseRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;
    let databaseInterface: MemoryDatabaseInterface;

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
            DatabaseRecordInput,
            DatabaseRecord,
            DatabaseRecordsStore,
            DatabaseRecordsController,
            DatabaseRecordOutput
        >(
            (services) => new MemoryDatabaseRecordsStore(services.store),
            (config, services) => {
                databaseInterface = new MemoryDatabaseInterface();
                return new DatabaseRecordsController({
                    ...config,
                    databaseInterfaceProviderName: 'sqlite',
                    databaseInterface: databaseInterface,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryDatabaseRecordsStore;
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
            (features) => features.withAllDefaultFeatures().withDatabases()
        );

        store.subscriptionConfiguration = builder.config;
    });

    afterEach(async () => {
        databaseInterface.dispose();
    });

    describe('recordItem()', () => {
        describe('create', () => {
            it('should create a database', async () => {
                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item1',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'item1',
                });

                expect(databaseInterface.databases).toHaveLength(1);

                const database = await itemsStore.getItemByAddress(
                    recordName,
                    'item1'
                );
                expect(databaseInterface.databases[0]).toEqual(
                    database?.databaseName
                );
            });

            it('should return subscription_limit_reached when the user has reached limit of Databases', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withDatabases()
                                .withDatabasesMaxItems(1)
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
                    databaseName: 'database1',
                    databaseProvider: 'sqlite',
                    databaseInfo: {
                        filePath: 'database1',
                    },
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
                        'The maximum number of database record items has been reached for your subscription.',
                });
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
                },
                userId,
                instances: [],
            });
        });

        it('should erase the database', async () => {
            const result = await manager.eraseItem({
                recordName,
                address: 'item1',
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(databaseInterface.databases).toEqual([]);
        });
    });

    describe('query()', () => {
        beforeEach(async () => {
            await manager.recordItem({
                recordKeyOrRecordName: recordName,
                item: {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                },
                userId,
                instances: [],
            });
        });

        it('should be able to create tables', async () => {
            const result = await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`CREATE TABLE "test" (id INTEGER PRIMARY KEY, name TEXT);`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success([
                    {
                        columns: [],
                        rows: [],
                        affectedRowCount: 0,
                        lastInsertId: undefined,
                    },
                ])
            );
        });

        it('should be able to insert data into tables', async () => {
            await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`CREATE TABLE "test" (id INTEGER PRIMARY KEY, name TEXT);`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            const result = await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`INSERT INTO "test" (id, name) VALUES (1, \'Hello, World!\');`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success([
                    {
                        columns: [],
                        rows: [],
                        affectedRowCount: 1,
                        lastInsertId: 1,
                    },
                ])
            );
        });

        it('should be able to query data in tables', async () => {
            await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`CREATE TABLE "test" (id INTEGER PRIMARY KEY, name TEXT);`,
                    query`INSERT INTO "test" (id, name) VALUES (1, 'Hello, World!');`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            const result = await manager.query({
                recordName,
                address: 'item1',
                statements: [query`SELECT * FROM "test";`],
                readonly: false,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success([
                    {
                        columns: ['id', 'name'],
                        rows: [[1, 'Hello, World!']],
                        affectedRowCount: 0,
                        lastInsertId: undefined,
                    },
                ])
            );
        });

        it('should be able to query data in tables', async () => {
            await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`CREATE TABLE "test" (id INTEGER PRIMARY KEY, name TEXT);`,
                    query`INSERT INTO "test" (id, name) VALUES (1, 'Hello, World!');`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            const result = await manager.query({
                recordName,
                address: 'item1',
                statements: [query`SELECT * FROM "test";`],
                readonly: false,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success([
                    {
                        columns: ['id', 'name'],
                        rows: [[1, 'Hello, World!']],
                        affectedRowCount: 0,
                        lastInsertId: undefined,
                    },
                ])
            );
        });

        it('should be able to use parameters', async () => {
            await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    query`CREATE TABLE "test" (id INTEGER PRIMARY KEY, name TEXT);`,
                ],
                readonly: false,
                userId,
                instances: [],
            });

            const result = await manager.query({
                recordName,
                address: 'item1',
                statements: [
                    {
                        query: `INSERT INTO "test" (id, name) VALUES (?, ?);`,
                        params: [100, 'Hello, World!'],
                    },
                ],
                readonly: false,
                userId,
                instances: [],
            });

            expect(result).toEqual(
                success([
                    {
                        columns: [],
                        rows: [],
                        affectedRowCount: 1,
                        lastInsertId: 100,
                    },
                ])
            );
        });
    });
});
