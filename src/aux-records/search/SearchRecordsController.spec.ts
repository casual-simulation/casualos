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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
// import { v4 as uuid } from 'uuid';
import { MemorySearchInterface } from './MemorySearchInterface';

// const uuidMock: jest.Mock = <any>uuid;
// jest.mock('uuid');

console.log = jest.fn();
console.error = jest.fn();

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
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            collectionName: `collection(${item.address})`,
            searchApiKey: `apiKey(${item.address})`,
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

        // let num = 0;
        // uuidMock.mockImplementation(() => {
        //     return `uuid-${num++}`;
        // });
        // environment = {
        //     handleHttpRequest: jest.fn(),
        // };

        const context = await setupTestContext<
            SearchRecordInput,
            SearchRecord,
            SearchRecordsStore,
            SearchRecordsController
        >(
            (services) => new MemorySearchRecordsStore(services.store),
            (config, services) => {
                searchInterface = new MemorySearchInterface();
                return new SearchRecordsController({
                    ...config,
                    searchInterface,
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
                                name: 'recordName',
                                type: 'string',
                            },
                            {
                                name: 'address',
                                type: 'string',
                            },
                            {
                                name: 'resourceKind',
                                type: 'string',
                            },
                            {
                                name: '.*',
                                type: 'auto',
                            },
                        ],
                        defaultSortingField: 'address',
                    },
                ]);

                const [collection] = searchInterface.collections;

                expect(searchInterface.apiKeys).toEqual({
                    description: `API Key for \`${collection.name}\``,
                    actions: ['documents:search'],
                    collections: [collection.name],
                    value: 'api_key_2',
                    expiresAt: expect.any(Number),
                });
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
});
