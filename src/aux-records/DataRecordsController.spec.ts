import { RecordsStore } from './RecordsStore';
import { RecordsController } from './RecordsController';
import {
    DataRecordsController,
    EraseDataFailure,
    EraseDataSuccess,
    GetDataFailure,
    GetDataResult,
    GetDataSuccess,
    RecordDataFailure,
    RecordDataSuccess,
} from './DataRecordsController';
import { DataRecordsStore, UserPolicy } from './DataRecordsStore';
import { PolicyController } from './PolicyController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestSubConfiguration,
    createTestUser,
} from './TestUtils';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { merge } from 'lodash';
import {
    FeaturesConfiguration,
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';

console.log = jest.fn();

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
            store.policies['testRecord'] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.create',
                                role: 'developer',
                                addresses: true,
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

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
            store.policies['testRecord'] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.update',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

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
            store.policies['testRecord'] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.update',
                                role: 'developer',
                                addresses: true,
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
                [PUBLIC_READ_MARKER]: {
                    document: {
                        permissions: [
                            {
                                type: 'data.update',
                                role: 'developer',
                                addresses: true,
                            },
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

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
            store.policies['testRecord'] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'policy.assign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

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
                ['inst']
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
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                data: {
                                    maxItems: 1,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
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
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                data: {
                                    maxItemSizeInBytes: 5,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
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
                        exact: false,
                        inclusive: true,
                        maximum: 5,
                        message: 'Number must be less than or equal to 5',
                        path: ['data', 'sizeInBytes'],
                        type: 'number',
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
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                data: {
                                    allowed: false,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
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
                ['inst']
            )) as GetDataFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'inst',
                    id: 'inst',
                    permission: 'data.read',
                    marker: 'secret',
                    role: null,
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

            const result = await manager.listData('testRecord', 'address/2');

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

        it('should only return data that the user is allowed to access', async () => {
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
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                        markers: [PUBLIC_READ_MARKER],
                    },
                ],
                totalCount: 5,
            });
        });

        it('should only return data that the inst is allowed to access', async () => {
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
                ['inst']
            );

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [],
                totalCount: 5,
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

            store.policies['testRecord'] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'data.delete',
                                role: 'developer',
                                addresses: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
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
                    kind: 'user',
                    id: otherUserId,
                    marker: 'secret',
                    permission: 'data.delete',
                    role: null,
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
                ['inst']
            )) as EraseDataSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
                reason: {
                    type: 'missing_permission',
                    kind: 'inst',
                    id: 'inst',
                    marker: 'secret',
                    permission: 'data.delete',
                    role: null,
                },
            });
        });
    });
});
