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
    AddCountFailure,
    AddCountSuccess,
    GetCountFailure,
    GetCountSuccess,
    UpdateEventRecordFailure,
    UpdateEventRecordSuccess,
} from './EventRecordsController';
import { EventRecordsController } from './EventRecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from './TestUtils';
import type { PolicyController } from './PolicyController';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import type { MemoryStore } from './MemoryStore';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';

console.log = jest.fn();

describe('EventRecordsController', () => {
    let store: MemoryStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: EventRecordsController;
    const userId = 'testUser';
    let ownerId: string;
    let key: string;
    let recordName: string;

    beforeEach(async () => {
        const controllers = createTestControllers();
        store = controllers.store;
        records = controllers.records;
        policies = controllers.policies;

        manager = new EventRecordsController({
            policies,
            store,
            metrics: store,
            config: store,
        });

        const owner = await createTestUser(controllers, 'owner@example.com');
        ownerId = owner.userId;

        const recordKeyResult = await createTestRecordKey(
            controllers,
            userId,
            'testRecord',
            'subjectfull'
        );

        key = recordKeyResult.recordKey;
        recordName = recordKeyResult.recordName;

        const record = await controllers.store.getRecordByName(recordName);
        await controllers.store.updateRecord({
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
                'You must be logged in in order to use this record key.'
            );

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 0,
            });
        });

        it('should be able to add the given count if the user has the correct permissions', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'increment',
                {},
                null
            );

            store.roles[recordName] = {
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

        it('should support custom markers with paths', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'increment',
                {},
                null
            );

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.updateEvent(recordName, 'address', {
                markers: ['secret:custom'],
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
                markers: ['secret:custom'],
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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'increment',
                    subjectType: 'user',
                    subjectId: userId,
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
            store.roles[recordName] = {
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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'increment',
                    subjectType: 'inst',
                    subjectId: '/inst',
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
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withEvents({
                                allowed: false,
                            })
                    )
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
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
                errorMessage:
                    'The subscription does not permit the recording of events.',
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
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'count',
                {},
                null
            );

            store.roles[recordName] = {
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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'count',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should deny requests for events that the inst doesnt have permission for', async () => {
            store.roles[recordName] = {
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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'count',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('updateEvent()', () => {
        it('should be able to update the count for an event', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                PUBLIC_READ_MARKER,
                'update',
                {},
                null
            );

            store.roles[recordName] = {
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
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'unassign',
                {},
                null
            );

            store.roles[recordName] = {
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

        it('should support custom markers with paths', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'event',
                'secret',
                'update',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'marker',
                ACCOUNT_MARKER,
                'unassign',
                {},
                null
            );

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                markers: ['secret:custom'],
            })) as UpdateEventRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 10,
                markers: ['secret:custom'],
            });
        });

        it('should be able to use a record key', async () => {
            await store.updateEvent(recordName, 'address', {
                count: 10,
                markers: ['secret'],
            });

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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'update',
                    subjectType: 'user',
                    subjectId: userId,

                    // type: 'missing_permission',
                    // kind: 'user',
                    // id: userId,
                    // permission: 'event.update',
                    // marker: PUBLIC_READ_MARKER,
                    // role: null,
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
            store.roles[recordName] = {
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
                    recordName,
                    resourceKind: 'event',
                    resourceId: 'address',
                    action: 'update',
                    subjectType: 'inst',
                    subjectId: '/inst',

                    // kind: 'inst',
                    // id: 'inst',
                    // permission: 'event.update',
                    // marker: PUBLIC_READ_MARKER,
                    // role: null,
                },
            });

            await expect(
                store.getEventCount(recordName, 'address')
            ).resolves.toEqual({
                success: true,
                count: 10,
            });
        });

        it('should deny the request if event records are not allowed', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withEvents({
                                allowed: false,
                            })
                    )
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const owner = await store.findUser(ownerId);
            await store.saveUser({
                ...owner,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.updateEvent({
                recordKeyOrRecordName: recordName,
                eventName: 'address',
                userId,
                count: 0,
            })) as UpdateEventRecordFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'The subscription does not permit the recording of events.',
            });

            await expect(
                store.getEventCount('testRecord', 'address')
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
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(recordName, null, userId);

            expect(result).toEqual({
                success: true,
                events: events.slice(0, 10),
                totalCount: 20,
            });
        });

        it('should return not_authorized if the user is not authorized', async () => {
            const result = await manager.listEvents(recordName, null, userId);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'event',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should skip events until after the given event name', async () => {
            store.roles[recordName] = {
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

        it('should return a not_authorized error if the inst is not allowed to access the account marker', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = await manager.listEvents(recordName, null, userId, [
                'inst',
            ]);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'event',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });

        it('should return a not_supported result if the store does not implement listEvents()', async () => {
            (store as any).listEvents = null;

            store.roles[recordName] = {
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
