import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    AddCountFailure,
    AddCountSuccess,
    EventRecordsController,
    GetCountFailure,
    GetCountSuccess,
    UpdateEventRecordSuccess,
} from './EventRecordsController';
import { MemoryEventRecordsStore } from './MemoryEventRecordsStore';
import { EventRecordsStore } from './EventRecordsStore';
import {
    createTestControllers,
    createTestRecordKey,
    createTestSubConfiguration,
    createTestUser,
} from './TestUtils';
import { PolicyController } from './PolicyController';
import { PolicyStore } from './PolicyStore';
import { MemoryPolicyStore } from './MemoryPolicyStore';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PUBLIC_READ_MARKER,
} from './PolicyPermissions';
import { ConfigurationStore } from './ConfigurationStore';
import { MemoryConfigurationStore } from './MemoryConfigurationStore';
import { merge } from 'lodash';
import {
    FeaturesConfiguration,
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { MemoryAuthStore } from './MemoryAuthStore';

console.log = jest.fn();

describe('EventRecordsController', () => {
    let recordsStore: RecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let policyStore: MemoryPolicyStore;
    let store: EventRecordsStore;
    let manager: EventRecordsController;
    let configStore: MemoryConfigurationStore;
    let authStore: MemoryAuthStore;
    const userId = 'testUser';
    let key: string;
    let recordName: string;

    beforeEach(async () => {
        const controllers = createTestControllers();
        recordsStore = controllers.recordsStore;
        records = controllers.records;
        policies = controllers.policies;
        policyStore = controllers.policyStore;
        configStore = controllers.configStore;
        authStore = controllers.authStore;

        store = new MemoryEventRecordsStore();
        manager = new EventRecordsController(policies, store);

        const owner = await createTestUser(controllers, 'owner@example.com');

        const recordKeyResult = await createTestRecordKey(
            controllers,
            userId,
            'testRecord',
            'subjectfull'
        );

        key = recordKeyResult.recordKey;
        recordName = recordKeyResult.recordName;

        const record = await controllers.recordsStore.getRecordByName(
            recordName
        );
        await controllers.recordsStore.updateRecord({
            name: recordName,
            ownerId: owner.userId,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
            studioId: null,
        });
    });

    describe('addCount()', () => {
        it('should add the given count to the records store', async () => {
            const result = (await manager.addCount(
                key,
                'address',
                5,
                'userId'
            )) as AddCountSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.eventName).toBe('address');

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 5,
            });
        });

        it('should return a not_logged_in error if a null user ID is given for a subjectfull key', async () => {
            const result = (await manager.addCount(
                key,
                'address',
                5,
                null
            )) as AddCountFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');
            expect(result.errorMessage).toBe(
                'The user must be logged in in order to record events.'
            );

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });

        it('should be able to add the given count if the user has the correct permissions', async () => {
            policyStore.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'event.increment',
                                role: 'developer',
                                events: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            policyStore.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.updateEvent(recordName, 'address', {
                markers: ['secret'],
            });

            const result = (await manager.addCount(
                recordName,
                'address',
                5,
                userId
            )) as AddCountSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.eventName).toBe('address');

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 5,
                markers: ['secret'],
            });
        });

        it('should deny the request if the user does not have permissions', async () => {
            const result = (await manager.addCount(
                recordName,
                'address',
                5,
                userId
            )) as AddCountFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'user',
                    id: userId,
                    permission: 'event.increment',
                    marker: PUBLIC_READ_MARKER,
                    role: null,
                },
            });

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });

        it('should deny the request if the inst does not have permissions', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.addCount(
                recordName,
                'address',
                5,
                userId,
                ['inst']
            )) as AddCountFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'inst',
                    id: 'inst',
                    permission: 'event.increment',
                    marker: PUBLIC_READ_MARKER,
                    role: null,
                },
            });

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });

        it('should deny the request if event records are not allowed', async () => {
            configStore.subscriptionConfiguration = merge(
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
                                events: {
                                    allowed: false,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            const user = await authStore.findUser(userId);
            await authStore.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = (await manager.addCount(
                recordName,
                'address',
                5,
                userId
            )) as AddCountFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Events are not allowed for this subscription.',
            });

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });
    });

    describe('getData()', () => {
        it('should retrieve records from the data store', async () => {
            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.getCount(
                'testRecord',
                'address',
                userId
            )) as GetCountSuccess;

            expect(result).toEqual({
                success: true,
                count: 10,
                recordName: 'testRecord',
                eventName: 'address',
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should be able to use record keys to get events that are private', async () => {
            await store.updateEvent(recordName, 'address', {
                markers: ['secret'],
            });

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.getCount(
                key,
                'address',
                userId
            )) as GetCountSuccess;

            expect(result).toEqual({
                success: true,
                count: 10,
                recordName: 'testRecord',
                eventName: 'address',
                markers: ['secret'],
            });
        });

        it('should be able to get the event count if the user has permission', async () => {
            policyStore.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'event.count',
                                role: 'developer',
                                events: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            policyStore.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.updateEvent(recordName, 'address', {
                markers: ['secret'],
            });

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.getCount(
                recordName,
                'address',
                userId
            )) as GetCountSuccess;

            expect(result).toEqual({
                success: true,
                count: 10,
                recordName: 'testRecord',
                eventName: 'address',
                markers: ['secret'],
            });
        });

        it('should deny requests for events that the user doesnt have permission for', async () => {
            await store.updateEvent(recordName, 'address', {
                markers: ['secret'],
            });

            await store.addEventCount(recordName, 'address', 10);

            const result = (await manager.getCount(
                recordName,
                'address',
                userId
            )) as GetCountFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'user',
                    id: userId,
                    permission: 'event.count',
                    marker: 'secret',
                    role: null,
                },
            });
        });

        it('should deny requests for events that the inst doesnt have permission for', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            await store.updateEvent(recordName, 'address', {
                markers: ['secret'],
            });

            await store.addEventCount(recordName, 'address', 10);

            const result = (await manager.getCount(
                recordName,
                'address',
                userId,
                ['inst']
            )) as GetCountFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'inst',
                    id: 'inst',
                    permission: 'event.count',
                    marker: 'secret',
                    role: null,
                },
            });
        });
    });

    describe('updateEvent()', () => {
        it('should be able to update the count for an event', async () => {
            policyStore.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'event.update',
                                role: 'developer',
                                events: true,
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
                                type: 'event.update',
                                role: 'developer',
                                events: true,
                            },
                            {
                                type: 'policy.unassign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            policyStore.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                count: 0,
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });

        it('should be able to update the markers for an event', async () => {
            policyStore.policies[recordName] = {
                ['secret']: {
                    document: {
                        permissions: [
                            {
                                type: 'event.update',
                                role: 'developer',
                                events: true,
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
                                type: 'event.update',
                                role: 'developer',
                                events: true,
                            },
                            {
                                type: 'policy.unassign',
                                role: 'developer',
                                policies: true,
                            },
                        ],
                    },
                    markers: [ACCOUNT_MARKER],
                },
            };

            policyStore.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                markers: ['secret'],
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 10,
                markers: ['secret'],
            });
        });

        it('should be able to use a record key', async () => {
            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: key,
                eventName: 'address',
                userId,
                count: 0,
                markers: ['secret'],
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
                markers: ['secret'],
            });
        });

        it('should deny the request if the user doesnt have permissions', async () => {
            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                count: 0,
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'user',
                    id: userId,
                    permission: 'event.update',
                    marker: PUBLIC_READ_MARKER,
                    role: null,
                },
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 10,
            });
        });

        it('should deny the request if the inst doesnt have permissions', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                count: 0,
                instances: ['inst'],
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    kind: 'inst',
                    id: 'inst',
                    permission: 'event.update',
                    marker: PUBLIC_READ_MARKER,
                    role: null,
                },
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 10,
            });
        });
    });

    describe('listEvents()', () => {
        let events: any[] = [];
        beforeEach(async () => {
            events = [];
            for (let i = 0; i < 20; i++) {
                const name = `test${i.toString().padStart(2, '0')}`;
                await store.addEventCount(recordName, name, i);
                events.push({
                    eventName: name,
                    count: i,
                    markers: [PUBLIC_READ_MARKER],
                });
            }
        });

        it('should be able to list events', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(recordName, null, userId);

            expect(result).toEqual({
                success: true,
                events: events.slice(0, 10),
                totalCount: 20,
            });
        });

        it('should return an empty list if the user is not authorized', async () => {
            const result = await manager.listEvents(recordName, null, userId);

            expect(result).toEqual({
                success: true,
                events: [],
                totalCount: 20,
            });
        });

        it('should skip events until after the given event name', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(
                recordName,
                'test05',
                userId
            );

            expect(result).toEqual({
                success: true,
                events: events.slice(6, 16),
                totalCount: 20,
            });
        });

        it('should return an empty list if the inst is not authorized', async () => {
            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(recordName, null, userId, [
                'inst',
            ]);

            expect(result).toEqual({
                success: true,
                events: [],
                totalCount: 20,
            });
        });

        it('should return a not_supported result if the store does not implement listEvents()', async () => {
            (store as any).listEvents = null;

            policyStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(recordName, null, userId, [
                'inst',
            ]);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });
    });
});
