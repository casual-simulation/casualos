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
import type { ContractRecordInput } from './ContractRecordsController';
import { ContractRecordsController } from './ContractRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import type { MemoryStore } from '../MemoryStore';
import type { RecordsController } from '../RecordsController';
import type { PolicyController } from '../PolicyController';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import type {
    ContractRecord,
    ContractRecordsStore,
} from './ContractRecordsStore';
import { MemoryContractRecordsStore } from './MemoryContractRecordsStore';

console.log = jest.fn();
console.error = jest.fn();

describe('ContractRecordsController', () => {
    testCrudRecordsController<
        ContractRecordInput,
        ContractRecord,
        ContractRecordsStore,
        ContractRecordsController
    >(
        false,
        'package',
        (services) => new MemoryContractRecordsStore(services.store),
        (config, services) =>
            new ContractRecordsController({
                ...config,
                authStore: services.authStore,
                privo: null,
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            id: item.address,
            holdingUserId: 'holdingUser',
            issuingUserId: 'issuingUser',
            initialValue: 100,
            issuedAtMs: 100,
            rate: 1,
            status: 'pending',
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            holdingUser: 'holdingUser',
            initialValue: 100,
            issuedAtMs: 100,
            rate: 1,
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) =>
                    features.withAllDefaultFeatures().withNotifications()
            );

            context.store.subscriptionConfiguration = builder.config;
        }
    );

    let store: MemoryStore;
    let itemsStore: MemoryContractRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: ContractRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;

    let userId: string;
    let sessionKey: string;
    let connectionKey: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        // require('axios').__reset();
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();

        dateNowMock.mockReturnValue(999);

        const context = await setupTestContext<
            ContractRecordInput,
            ContractRecord,
            ContractRecordsStore,
            ContractRecordsController
        >(
            (services) => new MemoryContractRecordsStore(services.store),
            (config, services) => {
                return new ContractRecordsController({
                    ...config,
                    authStore: services.authStore,
                    privo: null,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryContractRecordsStore;
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
            (features) => features.withAllDefaultFeatures().withNotifications()
        );

        store.subscriptionConfiguration = builder.config;
    });

    afterEach(() => {
        Date.now = realDateNow;
    });

    // function setResponse(response: any) {
    //     require('axios').__setResponse(response);
    // }

    // function setNextResponse(response: any) {
    //     require('axios').__setNextResponse(response);
    // }

    // function getLastPost() {
    //     return require('axios').__getLastPost();
    // }

    // function getLastGet() {
    //     return require('axios').__getLastGet();
    // }

    // function getLastDelete() {
    //     return require('axios').__getLastDelete();
    // }

    // function getRequests() {
    //     return require('axios').__getRequests();
    // }

    // interface TestSubscription {
    //     id: string;
    //     userId: string | null;
    //     recordName: string;
    //     notificationAddress: string;
    //     pushSubscription: {
    //         endpoint: string;
    //         keys: any;
    //     };
    //     active?: boolean;
    // }

    // async function saveTestSubscription(sub: TestSubscription) {
    //     const pushSubId = uuidv5(
    //         sub.pushSubscription.endpoint,
    //         SUBSCRIPTION_ID_NAMESPACE
    //     );
    //     await itemsStore.savePushSubscription({
    //         id: pushSubId,
    //         active: sub.active ?? true,
    //         endpoint: sub.pushSubscription.endpoint,
    //         keys: sub.pushSubscription.keys,
    //     });
    //     if (sub.userId) {
    //         await itemsStore.savePushSubscriptionUser({
    //             userId: sub.userId,
    //             pushSubscriptionId: pushSubId,
    //         });
    //     }
    //     await itemsStore.saveSubscription({
    //         id: sub.id,
    //         recordName: sub.recordName,
    //         notificationAddress: sub.notificationAddress,
    //         userId: sub.userId,
    //         pushSubscriptionId: !sub.userId ? pushSubId : null,
    //     });
    // }

    describe('recordItem()', () => {
        describe('create', () => {
            it('should return subscription_limit_reached when the user has reached limit of contracts', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withContracts()
                                .withContractsMaxItems(1)
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await itemsStore.createItem(recordName, {
                    id: 'id',
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    holdingUserId: 'holdingUser',
                    issuingUserId: 'issuingUser',
                    initialValue: 100,
                    issuedAtMs: 100,
                    rate: 1,
                    status: 'pending',
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
                        holdingUserId: 'holdingUser',
                        issuingUserId: 'issuingUser',
                        initialValue: 100,
                        rate: 1,
                        status: 'pending',
                        issuedAtMs: 100,
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of package items has been reached for your subscription.',
                });
            });

            it('should properly create the item with a new ID even if there is no contract limit', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withContracts()
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
                        holdingUserId: 'holdingUser',
                        issuingUserId: 'issuingUser',
                        initialValue: 100,
                        rate: 1,
                        status: 'pending',
                        issuedAtMs: 100,
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'item2',
                });

                const item = await itemsStore.getItemByAddress(
                    recordName,
                    'item2'
                );

                expect(item).toEqual({
                    id: expect.any(String),
                    address: 'item2',
                    markers: [PUBLIC_READ_MARKER],
                });
            });
        });
    });
});
