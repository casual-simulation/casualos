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
import type { RecordsController } from './RecordsController';
import type {
    EraseDataFailure,
    EraseDataSuccess,
    GetDataFailure,
    GetDataSuccess,
    RecordDataFailure,
    RecordDataSuccess,
} from './DataRecordsController';
import { DataRecordsController } from './DataRecordsController';
import type { UserPolicy } from './DataRecordsStore';
import type { PolicyController } from './PolicyController';
import {
    checkAccounts,
    checkBillingTotals,
    createTestControllers,
    createTestRecordKey,
    createTestSubConfiguration,
    createTestUser,
} from './TestUtils';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PUBLIC_READ_MARKER,
    unwrap,
} from '@casual-simulation/aux-common';
import type { MemoryStore } from './MemoryStore';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import {
    ACCOUNT_IDS,
    BillingCodes,
    CurrencyCodes,
    FinancialController,
    LEDGERS,
    MemoryFinancialInterface,
    TransferCodes,
} from './financial';

console.log = jest.fn();
console.warn = jest.fn();

describe('DataRecordsController', () => {
    let store: MemoryStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: DataRecordsController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    let otherUserId: string;

    beforeEach(async () => {
        const services = createTestControllers();

        store = services.store;
        policies = services.policies;
        records = services.records;
        manager = new DataRecordsController({
            policies,
            store,
            metrics: store,
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

    describe('recordData()', () => {
        it('should store records in the data store', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: 'subjectId',
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should store objects in the data store', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                { thisIsMyData: true },
                'subjectId',
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: { thisIsMyData: true },
                publisherId: userId,
                subjectId: 'subjectId',
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should store booleans in the data store', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                true,
                'subjectId',
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: true,
                publisherId: userId,
                subjectId: 'subjectId',
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should store numbers in the data store', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                123,
                'subjectId',
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 123,
                publisherId: userId,
                subjectId: 'subjectId',
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should reject the request if given an invalid key', async () => {
            const result = (await manager.recordData(
                'not_a_key',
                'address',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('record_not_found');
        });

        it('should reject the request if it violates the existing update policy', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                ['different_subjectId'],
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_authorized');
            expect(result.errorMessage).toBe(
                'The updatePolicy does not permit this user to update the data record.'
            );
        });

        it('should reject the request if attempts to use an invalid update policy', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId',
                123 as unknown as UserPolicy,
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_update_policy');
            expect(result.errorMessage).toBe(
                'The given updatePolicy is invalid or not supported.'
            );
        });

        it('should reject the request if using a subjectless key to set an update policy', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
                'address',
                'data',
                'subjectId',
                ['test'],
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_record_key');
            expect(result.errorMessage).toBe(
                'It is not possible to set update policies using a subjectless key.'
            );
        });

        it('should reject the request if attempts to use an invalid delete policy', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId',
                null,
                123 as unknown as UserPolicy
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_delete_policy');
            expect(result.errorMessage).toBe(
                'The given deletePolicy is invalid or not supported.'
            );
        });

        it('should reject the request if using a subjectless key to set a delete policy', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
                'address',
                'data',
                'subjectId',
                null,
                ['test']
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_record_key');
            expect(result.errorMessage).toBe(
                'It is not possible to set delete policies using a subjectless key.'
            );
        });

        it('should reject the request if given a null subject ID', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                null,
                null,
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');
        });

        it('should allow the request if given a null subject ID with a subjectless key', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
                'address',
                'data',
                null,
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: null,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should clear the subject if using a subjectless key', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
                'address',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: null,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should store the given user policies', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId',
                ['abc'],
                true
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: 'subjectId',
                updatePolicy: ['abc'],
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should be able to use a policy to create some data', async () => {
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'data',
                'secret',
                'create',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );

            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            const result = (await manager.recordData(
                'testRecord',
                'address',
                'data',
                otherUserId,
                null,
                null,
                ['secret']
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: otherUserId,
                subjectId: otherUserId,
                updatePolicy: true,
                deletePolicy: true,
                markers: ['secret'],
            });
        });

        it('should be able to use a policy to update some data', async () => {
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'data',
                'secret',
                'update',
                {},
                null
            );

            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            await store.setData(
                'testRecord',
                'address',
                123,
                userId,
                userId,
                null,
                null,
                ['secret']
            );

            const result = (await manager.recordData(
                'testRecord',
                'address',
                'data',
                otherUserId,
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: otherUserId,
                subjectId: otherUserId,
                updatePolicy: true,
                deletePolicy: true,
                markers: ['secret'],
            });
        });

        it('should be able to use a policy to add a resource marker to some data', async () => {
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'data',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'data',
                PUBLIC_READ_MARKER,
                'update',
                {},
                null
            );

            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            await store.setData(
                'testRecord',
                'address',
                123,
                userId,
                userId,
                null,
                null,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.recordData(
                'testRecord',
                'address',
                'data',
                otherUserId,
                null,
                null,
                [PUBLIC_READ_MARKER, 'secret']
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: otherUserId,
                subjectId: otherUserId,
                updatePolicy: true,
                deletePolicy: true,
                markers: [PUBLIC_READ_MARKER, 'secret'],
            });
        });

        it('should be able to create some data if the record name matches the user ID', async () => {
            const result = (await manager.recordData(
                userId,
                'address',
                'data',
                userId,
                null,
                null,
                ['secret']
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe(userId);
            expect(result.address).toBe('address');

            await expect(store.getData(userId, 'address')).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: userId,
                updatePolicy: true,
                deletePolicy: true,
                markers: ['secret'],
            });
        });

        it('should be update some data if the record name matches the user ID', async () => {
            await store.setData(
                userId,
                'address',
                123,
                userId,
                userId,
                null,
                null,
                ['secret']
            );

            const result = (await manager.recordData(
                userId,
                'address',
                'data',
                userId,
                null,
                null
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe(userId);
            expect(result.address).toBe('address');

            await expect(store.getData(userId, 'address')).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: userId,
                subjectId: userId,
                updatePolicy: true,
                deletePolicy: true,
                markers: ['secret'],
            });
        });

        it('should reject the request if the user does not have permission to create the data', async () => {
            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );

            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            const result = (await manager.recordData(
                'testRecord',
                'address',
                'data',
                otherUserId,
                null,
                null,
                ['secret']
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_authorized');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should reject the request if the inst does not have permission to create the data', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordData(
                'testRecord',
                'address',
                'data',
                otherUserId,
                null,
                null,
                ['secret'],
                ['/inst']
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_authorized');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should reject the request if the maximum number of items has been hit for the users subscription', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withData()
                            .withDataMaxItems(1)
                    )
            );

            await store.setData(
                'testRecord',
                'address1',
                'data',
                userId,
                userId,
                null,
                null,
                [PUBLIC_READ_MARKER]
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = (await manager.recordData(
                key,
                'address2',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of items has been reached for your subscription.',
                errorReason: 'too_many_items',
            });

            await expect(
                store.getData('testRecord', 'address2')
            ).resolves.toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should reject the request if the item is over the maximum size', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withData()
                            .withDataMaxItemSizeInBytes(5)
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = (await manager.recordData(
                key,
                'address2',
                'data123',
                'subjectId',
                null,
                null
            )) as RecordDataFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The size of the item is larger than the subscription allows.',
                errorReason: 'data_too_large',
                issues: [
                    {
                        code: 'too_big',
                        inclusive: true,
                        maximum: 5,
                        message: 'Too big: expected number to be <=5',
                        path: ['data', 'sizeInBytes'],
                        origin: 'number',
                    },
                ],
            });

            await expect(
                store.getData('testRecord', 'address2')
            ).resolves.toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should reject the request if data features are disabled', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withData({
                                allowed: false,
                            })
                    )
            );

            await store.setData(
                'testRecord',
                'address1',
                'data',
                userId,
                userId,
                null,
                null,
                [PUBLIC_READ_MARKER]
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = (await manager.recordData(
                key,
                'address2',
                'data',
                'subjectId',
                null,
                null
            )) as RecordDataFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'The subscription does not permit the recording of data.',
                errorReason: 'data_not_allowed',
            });

            await expect(
                store.getData('testRecord', 'address2')
            ).resolves.toEqual({
                success: false,
                errorCode: 'data_not_found',
                errorMessage: expect.any(String),
            });
        });

        describe('credits', () => {
            let financialInterface: MemoryFinancialInterface;
            let financialController: FinancialController;

            beforeEach(async () => {
                financialInterface = new MemoryFinancialInterface();
                financialController = new FinancialController(
                    financialInterface,
                    store
                );
                manager = new DataRecordsController({
                    policies,
                    store,
                    metrics: store,
                    config: store,
                    financialController,
                });

                unwrap(await financialController.init());

                const account = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                amount: 1000n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account.account.id,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                            },
                        ],
                    })
                );

                store.subscriptionConfiguration = createTestSubConfiguration(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub.withTier('tier1').withData({
                                allowed: true,
                                creditFeePerWrite: 50, // 50 credits per write
                            })
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });
            });

            it('should try to debit the users credit account for usage', async () => {
                const result = (await manager.recordData(
                    key,
                    'address',
                    'data',
                    'subjectId',
                    null,
                    null
                )) as RecordDataSuccess;

                expect(result.success).toBe(true);
                expect(result.recordName).toBe('testRecord');
                expect(result.address).toBe('address');

                const userAccount = unwrap(
                    await financialController.getAccountBalance({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 50n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(userAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 50n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);

                await expect(
                    store.getData('testRecord', 'address')
                ).resolves.toEqual({
                    success: true,
                    data: 'data',
                    publisherId: userId,
                    subjectId: 'subjectId',
                    updatePolicy: true,
                    deletePolicy: true,
                    markers: [PUBLIC_READ_MARKER],
                });

                await checkBillingTotals(
                    financialController,
                    userAccount!.accountId,
                    {
                        [BillingCodes.data_write]: 50n,
                    }
                );
            });

            it('should fail to write the data if the user doesnt have enough credits', async () => {
                store.subscriptionConfiguration = createTestSubConfiguration(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub.withTier('tier1').withData({
                                allowed: true,
                                creditFeePerWrite: 100_000, // 100,000 credits per write
                            })
                        )
                );

                const result = (await manager.recordData(
                    key,
                    'address',
                    'data',
                    'subjectId',
                    null,
                    null
                )) as RecordDataSuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'insufficient_funds',
                    errorMessage: 'Insufficient funds to cover usage.',
                });

                const userAccount = unwrap(
                    await financialController.getAccountBalance({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 0n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(userAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);

                await expect(
                    store.getData('testRecord', 'address')
                ).resolves.toEqual({
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: expect.any(String),
                });
            });

            describe('studio', () => {
                const studioId = 'studio1';
                const recordName = 'studioRecord';

                beforeEach(async () => {
                    await store.addStudio({
                        id: studioId,
                        displayName: 'My Studio!',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    });

                    await store.addStudioAssignment({
                        studioId,
                        userId,
                        role: 'admin',
                        isPrimaryContact: true,
                    });

                    await store.addRecord({
                        name: recordName,
                        studioId: studioId,
                        ownerId: null,
                        secretHashes: [],
                        secretSalt: '',
                    });

                    const account = unwrap(
                        await financialController.getOrCreateFinancialAccount({
                            studioId: studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    unwrap(
                        await financialController.internalTransaction({
                            transfers: [
                                {
                                    amount: 1000n,
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account.account.id,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );
                });

                it('should try to debit the studio credit account for usage', async () => {
                    const result = (await manager.recordData(
                        recordName,
                        'address',
                        'data',
                        userId,
                        null,
                        null
                    )) as RecordDataSuccess;

                    expect(result.success).toBe(true);
                    expect(result.recordName).toBe(recordName);
                    expect(result.address).toBe('address');

                    const studioAccount = unwrap(
                        await financialController.getAccountBalance({
                            studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    await checkAccounts(financialInterface, [
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 50n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: BigInt(studioAccount!.accountId),
                            credits_posted: 1000n,
                            debits_posted: 50n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    await checkBillingTotals(
                        financialController,
                        studioAccount!.accountId,
                        {
                            [BillingCodes.data_write]: 50n,
                        }
                    );

                    await expect(
                        store.getData(recordName, 'address')
                    ).resolves.toEqual({
                        success: true,
                        data: 'data',
                        publisherId: userId,
                        subjectId: userId,
                        updatePolicy: true,
                        deletePolicy: true,
                        markers: [PUBLIC_READ_MARKER],
                    });
                });

                it('should fail to write the data if the studio doesnt have enough credits', async () => {
                    store.subscriptionConfiguration =
                        createTestSubConfiguration((config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub.withTier('tier1').withData({
                                    allowed: true,
                                    creditFeePerWrite: 100_000, // 100,000 credits per write
                                })
                            )
                        );

                    const result = (await manager.recordData(
                        recordName,
                        'address',
                        'data',
                        userId,
                        null,
                        null
                    )) as RecordDataSuccess;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    const studioAccount = unwrap(
                        await financialController.getAccountBalance({
                            studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    await checkAccounts(financialInterface, [
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 0n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: BigInt(studioAccount!.accountId),
                            credits_posted: 1000n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    await expect(
                        store.getData(recordName, 'address')
                    ).resolves.toEqual({
                        success: false,
                        errorCode: 'data_not_found',
                        errorMessage: expect.any(String),
                    });
                });
            });
        });
    });

    describe('getData()', () => {
        it('should retrieve records from the data store', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
        });

        it('should default the update and delete policies to true', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                null,
                null,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
        });

        it('should return a data_not_found error if the data is not in the store', async () => {
            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('data_not_found');
            expect(result.errorMessage).toBe('The data was not found.');
        });

        it('should default to the publicRead marker for data that doesnt have a marker', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                null as any
            );

            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
            expect(result.markers).toEqual([PUBLIC_READ_MARKER]);
        });

        it('should not be able to retrieve data if there is not a policy that allows it', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');
            expect(result.errorMessage).toBe(
                'The user must be logged in. Please provide a sessionKey or a recordKey.'
            );
        });

        it('should reject if the inst does not have permission', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.getData(
                'testRecord',
                'address',
                otherUserId,
                ['/inst']
            )) as GetDataFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'read',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });

        it('should be able to retrieve secret data if the user has the admin role', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.getData(
                'testRecord',
                'address',
                otherUserId
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
        });

        it('should be able to retrieve secret data if the record name matches the user ID', async () => {
            await store.setData(
                userId,
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.getData(
                userId,
                'address',
                userId
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
        });

        it('should be able to retrieve secret data with a record key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.getData(
                key,
                'address',
                userId
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe(userId);
            expect(result.subjectId).toBe('subjectId');
            expect(result.updatePolicy).toBe(true);
            expect(result.deletePolicy).toBe(true);
        });

        describe('credits', () => {
            let financialInterface: MemoryFinancialInterface;
            let financialController: FinancialController;

            beforeEach(async () => {
                financialInterface = new MemoryFinancialInterface();
                financialController = new FinancialController(
                    financialInterface,
                    store
                );
                manager = new DataRecordsController({
                    policies,
                    store,
                    metrics: store,
                    config: store,
                    financialController,
                });

                unwrap(await financialController.init());

                const account = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                amount: 1000n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account.account.id,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                            },
                        ],
                    })
                );

                store.subscriptionConfiguration = createTestSubConfiguration(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub.withTier('tier1').withData({
                                allowed: true,
                                creditFeePerRead: 25, // 25 credits per read
                            })
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                // Add some data to read
                await store.setData(
                    'testRecord',
                    'address',
                    'data',
                    userId,
                    'subjectId',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );
            });

            it('should try to debit the users credit account for usage', async () => {
                const result = (await manager.getData(
                    'testRecord',
                    'address'
                )) as GetDataSuccess;

                expect(result.success).toBe(true);
                expect(result.data).toBe('data');
                expect(result.publisherId).toBe(userId);
                expect(result.subjectId).toBe('subjectId');

                const userAccount = unwrap(
                    await financialController.getAccountBalance({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 25n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(userAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 25n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);

                await checkBillingTotals(
                    financialController,
                    userAccount!.accountId,
                    {
                        [BillingCodes.data_read]: 25n,
                    }
                );
            });

            it('should fail to read the data if the user doesnt have enough credits', async () => {
                store.subscriptionConfiguration = createTestSubConfiguration(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub.withTier('tier1').withData({
                                allowed: true,
                                creditFeePerRead: 100_000, // 100,000 credits per read
                            })
                        )
                );

                const result = (await manager.getData(
                    'testRecord',
                    'address'
                )) as GetDataFailure;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'insufficient_funds',
                    errorMessage: 'Insufficient funds to cover usage.',
                });

                const userAccount = unwrap(
                    await financialController.getAccountBalance({
                        userId: userId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 0n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(userAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);
            });

            describe('studio', () => {
                const studioId = 'studio1';
                const recordName = 'studioRecord';

                beforeEach(async () => {
                    await store.addStudio({
                        id: studioId,
                        displayName: 'My Studio!',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                    });

                    await store.addStudioAssignment({
                        studioId,
                        userId,
                        role: 'admin',
                        isPrimaryContact: true,
                    });

                    await store.addRecord({
                        name: recordName,
                        studioId: studioId,
                        ownerId: null,
                        secretHashes: [],
                        secretSalt: '',
                    });

                    const account = unwrap(
                        await financialController.getOrCreateFinancialAccount({
                            studioId: studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    unwrap(
                        await financialController.internalTransaction({
                            transfers: [
                                {
                                    amount: 1000n,
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account.account.id,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    // Add some data to read
                    await store.setData(
                        recordName,
                        'address',
                        'data',
                        userId,
                        userId,
                        true,
                        true,
                        [PUBLIC_READ_MARKER]
                    );
                });

                it('should try to debit the studio credit account for usage', async () => {
                    const result = (await manager.getData(
                        recordName,
                        'address'
                    )) as GetDataSuccess;

                    expect(result.success).toBe(true);
                    expect(result.data).toBe('data');
                    expect(result.publisherId).toBe(userId);
                    expect(result.subjectId).toBe(userId);

                    const studioAccount = unwrap(
                        await financialController.getAccountBalance({
                            studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    await checkAccounts(financialInterface, [
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 25n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: BigInt(studioAccount!.accountId),
                            credits_posted: 1000n,
                            debits_posted: 25n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    await checkBillingTotals(
                        financialController,
                        studioAccount!.accountId,
                        {
                            [BillingCodes.data_read]: 25n,
                        }
                    );
                });

                it('should fail to read the data if the studio doesnt have enough credits', async () => {
                    store.subscriptionConfiguration =
                        createTestSubConfiguration((config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub.withTier('tier1').withData({
                                    allowed: true,
                                    creditFeePerRead: 100_000, // 100,000 credits per read
                                })
                            )
                        );

                    const result = (await manager.getData(
                        recordName,
                        'address'
                    )) as GetDataFailure;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'insufficient_funds',
                        errorMessage: 'Insufficient funds to cover usage.',
                    });

                    const studioAccount = unwrap(
                        await financialController.getAccountBalance({
                            studioId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    await checkAccounts(financialInterface, [
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 0n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: BigInt(studioAccount!.accountId),
                            credits_posted: 1000n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                });
            });
        });
    });

    describe('listData()', () => {
        it('should retrieve multiple records from the data store', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );
            }

            const result = await manager.listData(
                'testRecord',
                'address/2',
                userId
            );

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: [PUBLIC_READ_MARKER],
                    },
                ],
                totalCount: 5,
            });
        });

        it('should be able to use the admin policy to retrieve secret markers', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listData(
                'testRecord',
                'address/2',
                otherUserId
            );

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: ['secret'],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: ['secret'],
                    },
                ],
                totalCount: 5,
            });
        });

        it('should be able to list items if the record name matches the user ID', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    userId,
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            const result = await manager.listData(userId, 'address/2', userId);

            expect(result).toEqual({
                success: true,
                recordName: userId,
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: ['secret'],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: ['secret'],
                    },
                ],
                totalCount: 5,
            });
        });

        it('should be able to use a record key to retrieve secret markers', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listData(
                key,
                'address/2',
                otherUserId
            );

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: ['secret'],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: ['secret'],
                    },
                ],
                totalCount: 5,
            });
        });

        it('should return not_authorized if the user does not have access to the account marker', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    i % 2 === 0 ? ['secret'] : [PUBLIC_READ_MARKER]
                );
            }

            const result = await manager.listData(
                'testRecord',
                'address/2',
                otherUserId
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });
        });

        it('should return not_authorized if the inst does not have access to the account marker', async () => {
            store.roles['testRecord'] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            const result = await manager.listData(
                'testRecord',
                'address/2',
                userId,
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('listDataByMarker()', () => {
        it('should retrieve multiple records from the data store', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );
            }

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: 'address/2',
                userId,
                marker: PUBLIC_READ_MARKER,
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: [PUBLIC_READ_MARKER],
                    },
                ],
                totalCount: 5,
                marker: PUBLIC_READ_MARKER,
            });
        });

        it('should sort records by the given sort order', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    [PUBLIC_READ_MARKER]
                );
            }

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: 'address/4',
                userId,
                marker: PUBLIC_READ_MARKER,
                sort: 'descending',
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    {
                        address: 'address/2',
                        data: 'data2',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    {
                        address: 'address/1',
                        data: 'data1',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    {
                        address: 'address/0',
                        data: 'data0',
                        markers: [PUBLIC_READ_MARKER],
                    },
                ],
                totalCount: 5,
                marker: PUBLIC_READ_MARKER,
            });
        });

        it('should only list the marker that is specified', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    [i % 2 === 0 ? 'secret' : PUBLIC_READ_MARKER]
                );
            }

            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: 'address/2',
                userId,
                marker: PUBLIC_READ_MARKER,
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: [PUBLIC_READ_MARKER],
                    },
                ],
                totalCount: 2,
                marker: PUBLIC_READ_MARKER,
            });
        });

        it('should be able to list by markers with paths', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    [i % 2 === 0 ? 'secret:path' : PUBLIC_READ_MARKER]
                );
            }

            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: null,
                userId,
                marker: 'secret:path',
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/0',
                        data: 'data0',
                        markers: ['secret:path'],
                    },
                    {
                        address: 'address/2',
                        data: 'data2',
                        markers: ['secret:path'],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: ['secret:path'],
                    },
                ],
                totalCount: 3,
                marker: 'secret:path',
            });
        });

        it('should be able to use a record key to retrieve secret markers', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listDataByMarker({
                recordKeyOrName: key,
                startingAddress: 'address/2',
                userId,
                marker: 'secret',
            });

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: ['secret'],
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                        markers: ['secret'],
                    },
                ],
                totalCount: 5,
                marker: 'secret',
            });
        });

        it('should return not_authorized if the user does not have access to the marker', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    i % 2 === 0 ? ['secret'] : [PUBLIC_READ_MARKER]
                );
            }

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: 'address/2',
                userId: otherUserId,
                marker: 'secret',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });
        });

        it('should return not_authorized if the inst does not have access to the marker', async () => {
            store.roles['testRecord'] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    userId,
                    'subjectId',
                    true,
                    true,
                    ['secret']
                );
            }

            const result = await manager.listDataByMarker({
                recordKeyOrName: 'testRecord',
                startingAddress: 'address/2',
                userId,
                marker: 'secret',
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('eraseData()', () => {
        it('should delete the record from the data store', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                key,
                'address',
                'userId'
            )) as EraseDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should reject the request if given an invalid key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                'wrongkey',
                'address',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('record_not_found');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
            expect(storeResult.publisherId).toBe(userId);
            expect(storeResult.subjectId).toBe('subjectId');
        });

        it('should reject the request if given a null subjectId', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                key,
                'address',
                null
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
        });

        it('should be able to delete items with a subjectless key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                subjectlessKey,
                'address',
                null
            )) as EraseDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should do nothing if trying to delete some data that doesnt exist', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                subjectlessKey,
                'missing',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('data_not_found');
        });

        it('should reject the request if it violates the existing delete policy', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                ['different_subjectId'],
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                key,
                'address',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_authorized');
            expect(result.errorMessage).toBe(
                'The deletePolicy does not permit this user to erase the data record.'
            );

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
            expect(storeResult.publisherId).toBe(userId);
            expect(storeResult.subjectId).toBe('subjectId');
        });

        it('should set the subjectId to null if using a subjectless key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                ['userId'],
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                subjectlessKey,
                'address',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_authorized');
            expect(result.errorMessage).toBe(
                'The deletePolicy does not permit this user to erase the data record.'
            );

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
            expect(storeResult.publisherId).toBe(userId);
            expect(storeResult.subjectId).toBe('subjectId');
        });

        it('should allow the owner of the record to erase the record even if it violates the policy when they use a record key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                ['different_subjectId'],
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                key,
                'address',
                userId
            )) as EraseDataFailure;

            expect(result.success).toBe(true);

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should allow the owner of the record to erase the record even if it violates the policy', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                ['different_subjectId'],
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                'testRecord',
                'address',
                userId
            )) as EraseDataFailure;

            expect(result.success).toBe(true);

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should allow if the record name matches the user ID', async () => {
            await store.setData(
                userId,
                'address',
                'data',
                userId,
                'subjectId',
                true,
                ['different_subjectId'],
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseData(
                userId,
                'address',
                userId
            )) as EraseDataFailure;

            expect(result.success).toBe(true);

            const storeResult = await store.getData(userId, 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should be able to use the admin policy to delete data without a marker', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                null as any
            );

            const result = (await manager.eraseData(
                'testRecord',
                'address',
                otherUserId
            )) as EraseDataSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                address: 'address',
            });
        });

        it('should be able to use the marker policy to delete data', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            await store.assignPermissionToSubjectAndMarker(
                'testRecord',
                'role',
                'developer',
                'data',
                'secret',
                'delete',
                {},
                null
            );

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.eraseData(
                'testRecord',
                'address',
                otherUserId
            )) as EraseDataSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                address: 'address',
            });
        });

        it('should reject the request if no policy allows the deletion of the data', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set(['developer']),
            };

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.eraseData(
                'testRecord',
                'address',
                otherUserId
            )) as EraseDataSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'delete',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });
        });

        it('should reject the request if the inst is not authorized', async () => {
            store.roles['testRecord'] = {
                [otherUserId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.setData(
                'testRecord',
                'address',
                'data',
                userId,
                'subjectId',
                true,
                true,
                ['secret']
            );

            const result = (await manager.eraseData(
                'testRecord',
                'address',
                otherUserId,
                ['/inst']
            )) as EraseDataSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    resourceKind: 'data',
                    resourceId: 'address',
                    action: 'delete',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });
});
