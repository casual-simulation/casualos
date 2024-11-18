import { Record, RecordKey } from './RecordsStore';
import { MemoryStore } from './MemoryStore';
import {
    PolicyController,
    explainationForPermissionAssignment,
    getMarkerResourcesForCreation,
    willMarkersBeRemaining,
} from './PolicyController';
import {
    ACCOUNT_MARKER,
    ActionKinds,
    ADMIN_ROLE_NAME,
    AvailablePermissions,
    DATA_RESOURCE_KIND,
    EVENT_RESOURCE_KIND,
    FILE_RESOURCE_KIND,
    INST_RESOURCE_KIND,
    MARKER_RESOURCE_KIND,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    ResourceKinds,
    ROLE_RESOURCE_KIND,
    SubjectType,
} from '@casual-simulation/aux-common';
import {
    CreateRecordSuccess,
    CreateStudioResult,
    CreateStudioSuccess,
    formatV1RecordKey,
    parseRecordKey,
    RecordsController,
} from './RecordsController';
import {
    TestServices,
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from './TestUtils';
import {
    AssignPermissionToSubjectAndMarkerSuccess,
    AssignPermissionToSubjectAndResourceSuccess,
    MarkerPermissionAssignment,
    ResourcePermissionAssignment,
} from './PolicyStore';
import { formatInstId } from './websockets';
import { AuthController } from './AuthController';
import { PrivoClientInterface } from './PrivoClient';

console.log = jest.fn();

describe('PolicyController', () => {
    let store: MemoryStore;
    let controller: PolicyController;

    const ownerId: string = 'ownerId';
    const userId: string = 'userId';
    let recordKey: string;
    let savedRecordKey: RecordKey;
    let recordName: string;
    let record: Record = null;
    let services: TestServices;

    const memberId: string = 'memberId';
    let studioId: string;
    const studioRecord: string = 'studioRecord';

    let wrongRecordKey: string;

    beforeAll(async () => {
        const services = createTestControllers();
        const testRecordKey = await createTestRecordKey(services, userId);
        recordKey = testRecordKey.recordKey;
        recordName = testRecordKey.recordName;
        record = await services.store.getRecordByName(recordName);

        savedRecordKey = services.store.recordKeys.find(
            (k) => k.recordName === recordName
        );
    });

    beforeEach(async () => {
        services = createTestControllers();

        store = services.store;
        controller = services.policies;

        await services.store.addRecord({
            ...record,
        });

        await services.store.addRecordKey({
            ...savedRecordKey,
        });

        await services.authStore.saveNewUser({
            id: ownerId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'owner@example.com',
            phoneNumber: null,
        });
        await services.authStore.saveNewUser({
            id: userId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'user@example.com',
            phoneNumber: null,
        });
        await services.authStore.saveNewUser({
            id: memberId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'member@example.com',
            phoneNumber: null,
        });

        await services.store.updateRecord({
            name: recordName,
            ownerId: ownerId,
            studioId: null,
            secretHashes: record.secretHashes,
            secretSalt: record.secretSalt,
        });

        const [name, password] = parseRecordKey(recordKey);
        wrongRecordKey = formatV1RecordKey('wrong record name', password);

        const studioResult = (await services.records.createStudio(
            'myStudio',
            ownerId
        )) as CreateStudioSuccess;

        const studioRecordResult = (await services.records.createRecord({
            recordName: studioRecord,
            userId: ownerId,
            studioId: studioResult.studioId,
        })) as CreateRecordSuccess;

        studioId = studioResult.studioId;

        await services.records.addStudioMember({
            studioId: studioId,
            userId: ownerId,
            addedUserId: memberId,
            role: 'member',
        });
    });

    describe('listPermissions()', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'create',
                {},
                null
            );

            await store.assignPermissionToSubjectAndResource(
                recordName,
                'user',
                userId,
                'data',
                'address',
                'delete',
                {},
                null
            );
        });

        it('should return the list of permissions in the given record', async () => {
            const result = await controller.listPermissions(recordName, userId);

            expect(result).toEqual({
                success: true,
                recordName,
                resourcePermissions: [
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        resourceId: 'address',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
                        expireTimeMs: null,
                        options: {},
                    },
                ],
                markerPermissions: [
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'read',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'create',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                ],
            });
        });

        it('should return a not_authorized result if the user does not have access to the account marker', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listPermissions(recordName, userId);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'marker',
                    action: 'list',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });
        });
    });

    describe('listPermissionsForMarker()', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'create',
                {},
                null
            );

            await store.assignPermissionToSubjectAndResource(
                recordName,
                'user',
                userId,
                'data',
                'address',
                'delete',
                {},
                null
            );
        });

        it('should return the list of permissions in the given record', async () => {
            const result = await controller.listPermissionsForMarker(
                recordName,
                'test',
                userId
            );

            expect(result).toEqual({
                success: true,
                recordName,
                markerPermissions: [
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'read',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'create',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                ],
            });
        });

        it('should return the list for the root marker only', async () => {
            const result = await controller.listPermissionsForMarker(
                recordName,
                'test:tag',
                userId
            );

            expect(result).toEqual({
                success: true,
                recordName,
                markerPermissions: [
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'read',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        marker: 'test',
                        action: 'create',
                        subjectType: 'role',
                        subjectId: 'developer',
                        expireTimeMs: null,
                        options: {},
                    },
                ],
            });
        });

        it('should return a not_authorized result if the user does not have access to the account marker', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listPermissionsForMarker(
                recordName,
                'test',
                userId
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'marker',
                    action: 'list',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });
        });
    });

    describe('listPermissionsForResource()', () => {
        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'create',
                {},
                null
            );

            await store.assignPermissionToSubjectAndResource(
                recordName,
                'user',
                userId,
                'data',
                'address',
                'delete',
                {},
                null
            );
        });

        it('should return the list of permissions in the given record', async () => {
            const result = await controller.listPermissionsForResource(
                recordName,
                'data',
                'address',
                userId
            );

            expect(result).toEqual({
                success: true,
                recordName,
                resourcePermissions: [
                    {
                        id: expect.any(String),
                        recordName: recordName,
                        resourceKind: 'data',
                        resourceId: 'address',
                        action: 'delete',
                        subjectType: 'user',
                        subjectId: userId,
                        expireTimeMs: null,
                        options: {},
                    },
                ],
            });
        });

        it('should return a not_authorized result if the user does not have access to the account marker', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listPermissionsForResource(
                recordName,
                'data',
                'address',
                userId
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'marker',
                    action: 'list',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });
        });
    });

    describe('grantMarkerPermission()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant a permission to a marker', async () => {
            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    resourceId: null,
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'data',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });

        it('should simplify the marker to a root marker', async () => {
            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test:tag',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    resourceId: null,
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'data',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });

        it('should do nothing if the marker already has the permission', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );

            expect(
                await store.listPermissionsForMarker(recordName, 'test')
            ).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'data',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'data',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });

        it('should update the permission if it has different options from the existing one', async () => {
            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                'test',
                'read',
                { maxFileSizeInBytes: 100 },
                null
            );

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'file',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {
                        maxFileSizeInBytes: 200,
                    },
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'file',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {
                        maxFileSizeInBytes: 200,
                    },
                },
            ]);
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'grantPermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );
            expect(permissions).toEqual([]);
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'grantPermission',
                    subjectId: '/inst',
                    subjectType: 'inst',
                },
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );
            expect(permissions).toEqual([]);
        });

        it('should work if both the user and the instance have the admin role', async () => {
            store.roles[recordName]['/inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.grantMarkerPermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                marker: 'test',
                permission: {
                    resourceKind: 'data',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForMarker(
                recordName,
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    marker: 'test',
                    action: 'read',
                    resourceKind: 'data',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });
    });

    describe('revokeMarkerPermission()', () => {
        let permissionId: string;

        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            )) as AssignPermissionToSubjectAndMarkerSuccess;

            permissionId = result.permissionAssignment.id;
        });

        it('should remove a permission from a policy', async () => {
            const result = await controller.revokeMarkerPermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getMarkerPermissionAssignmentById(
                permissionId
            );
            expect(permission).toBe(null);
        });

        it('should do nothing if the permission was not found', async () => {
            await store.deleteMarkerPermissionAssignmentById(permissionId);

            const result = await controller.revokeMarkerPermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'permission_not_found',
                errorMessage: 'The permission was not found.',
            });
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.revokeMarkerPermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'revokePermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const permission = await store.getMarkerPermissionAssignmentById(
                permissionId
            );

            expect(permission).not.toBe(null);
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.revokeMarkerPermission({
                userId: userId,
                permissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'revokePermission',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const permission = await store.getMarkerPermissionAssignmentById(
                permissionId
            );

            expect(permission).not.toBe(null);
        });

        it('should work if both the user and the inst have admin permissions', async () => {
            store.roles[recordName]['/inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.revokeMarkerPermission({
                userId: userId,
                permissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getMarkerPermissionAssignmentById(
                permissionId
            );
            expect(permission).toBe(null);
        });
    });

    describe('grantResourcePermission()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant a permission to a resource', async () => {
            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'data',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    action: 'read',
                    resourceKind: 'data',
                    resourceId: 'test',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });

        it('should do nothing if the user already has the permission', async () => {
            await store.assignPermissionToSubjectAndResource(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            );

            expect(
                await store.listPermissionsForResource(
                    recordName,
                    'data',
                    'test'
                )
            ).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    action: 'read',
                    resourceKind: 'data',
                    resourceId: 'test',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);

            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'data',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    action: 'read',
                    resourceKind: 'data',
                    resourceId: 'test',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });

        it('should update the permission if it has different options from the existing one', async () => {
            await store.assignPermissionToSubjectAndResource(
                recordName,
                'role',
                'developer',
                'file',
                'test',
                'read',
                { maxFileSizeInBytes: 100 },
                null
            );

            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'file',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {
                        maxFileSizeInBytes: 200,
                    },
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'file',
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    action: 'read',
                    resourceKind: 'file',
                    resourceId: 'test',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {
                        maxFileSizeInBytes: 200,
                    },
                },
            ]);
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'data',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'grantPermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );
            expect(permissions).toEqual([]);
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'data',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'grantPermission',
                    subjectId: '/inst',
                    subjectType: 'inst',
                },
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );
            expect(permissions).toEqual([]);
        });

        it('should work if both the user and the instance have the admin role', async () => {
            store.roles[recordName]['/inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.grantResourcePermission({
                recordKeyOrRecordName: recordName,
                userId: userId,
                permission: {
                    resourceKind: 'data',
                    resourceId: 'test',
                    action: 'read',
                    subjectType: 'role',
                    subjectId: 'developer',
                    options: {},
                    expireTimeMs: null,
                },
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const permissions = await store.listPermissionsForResource(
                recordName,
                'data',
                'test'
            );

            expect(permissions).toEqual([
                {
                    id: expect.any(String),
                    recordName: recordName,
                    action: 'read',
                    resourceKind: 'data',
                    resourceId: 'test',
                    subjectId: 'developer',
                    subjectType: 'role',
                    userId: null,
                    expireTimeMs: null,
                    options: {},
                },
            ]);
        });
    });

    describe('revokeResourcePermission()', () => {
        let permissionId: string;

        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await store.assignPermissionToSubjectAndResource(
                recordName,
                'role',
                'developer',
                'data',
                'test',
                'read',
                {},
                null
            )) as AssignPermissionToSubjectAndResourceSuccess;

            permissionId = result.permissionAssignment.id;
        });

        it('should remove a permission from a policy', async () => {
            const result = await controller.revokeResourcePermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getResourcePermissionAssignmentById(
                permissionId
            );
            expect(permission).toBe(null);
        });

        it('should do nothing if the permission was not found', async () => {
            await store.deleteResourcePermissionAssignmentById(permissionId);

            const result = await controller.revokeResourcePermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'permission_not_found',
                errorMessage: 'The permission was not found.',
            });
        });

        it('should do nothing if the user is not authorized', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.revokeResourcePermission({
                userId: userId,
                permissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'revokePermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const permission = await store.getResourcePermissionAssignmentById(
                permissionId
            );

            expect(permission).not.toBe(null);
        });

        it('should do nothing if the inst is not authorized', async () => {
            const result = await controller.revokeResourcePermission({
                userId: userId,
                permissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'revokePermission',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const permission = await store.getResourcePermissionAssignmentById(
                permissionId
            );

            expect(permission).not.toBe(null);
        });

        it('should work if both the user and the inst have admin permissions', async () => {
            store.roles[recordName]['/inst'] = new Set([ADMIN_ROLE_NAME]);

            const result = await controller.revokeResourcePermission({
                userId: userId,
                permissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getResourcePermissionAssignmentById(
                permissionId
            );
            expect(permission).toBe(null);
        });
    });

    describe('revokePermission()', () => {
        let markerPermissionId: string;
        let resourcePermissionId: string;

        beforeEach(async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const markerResult =
                (await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'role',
                    'developer',
                    'data',
                    'test',
                    'read',
                    {},
                    null
                )) as AssignPermissionToSubjectAndMarkerSuccess;

            markerPermissionId = markerResult.permissionAssignment.id;

            const resourceResult =
                (await store.assignPermissionToSubjectAndResource(
                    recordName,
                    'role',
                    'developer',
                    'data',
                    'test',
                    'read',
                    {},
                    null
                )) as AssignPermissionToSubjectAndResourceSuccess;

            resourcePermissionId = resourceResult.permissionAssignment.id;
        });

        it('should be able to revoke a marker permission', async () => {
            const result = await controller.revokePermission({
                userId: userId,
                permissionId: markerPermissionId,
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getMarkerPermissionAssignmentById(
                markerPermissionId
            );
            expect(permission).toBe(null);
        });

        it('should be able to revoke a resource permission', async () => {
            const result = await controller.revokePermission({
                userId: userId,
                permissionId: resourcePermissionId,
            });

            expect(result).toEqual({
                success: true,
            });

            const permission = await store.getResourcePermissionAssignmentById(
                resourcePermissionId
            );
            expect(permission).toBe(null);
        });

        it('should do nothing if the permission was not found', async () => {
            const result = await controller.revokePermission({
                userId: userId,
                permissionId: 'missingPermissionId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'permission_not_found',
                errorMessage: 'The permission was not found.',
            });

            const markerPermission =
                await store.getMarkerPermissionAssignmentById(
                    markerPermissionId
                );
            expect(markerPermission).not.toBe(null);

            const resourcePermission =
                await store.getResourcePermissionAssignmentById(
                    resourcePermissionId
                );
            expect(resourcePermission).not.toBe(null);
        });

        it('should do nothing if the user is not authorized to revoke a marker permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.revokePermission({
                userId: userId,
                permissionId: markerPermissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'revokePermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const markerPermission =
                await store.getMarkerPermissionAssignmentById(
                    markerPermissionId
                );
            expect(markerPermission).not.toBe(null);

            const resourcePermission =
                await store.getResourcePermissionAssignmentById(
                    resourcePermissionId
                );
            expect(resourcePermission).not.toBe(null);
        });

        it('should do nothing if the inst is not authorized to revoke a marker permission', async () => {
            const result = await controller.revokePermission({
                userId: userId,
                permissionId: markerPermissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: 'test',
                    action: 'revokePermission',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const markerPermission =
                await store.getMarkerPermissionAssignmentById(
                    markerPermissionId
                );
            expect(markerPermission).not.toBe(null);

            const resourcePermission =
                await store.getResourcePermissionAssignmentById(
                    resourcePermissionId
                );
            expect(resourcePermission).not.toBe(null);
        });

        it('should do nothing if the user is not authorized to revoke a resource permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([]),
            };

            const result = await controller.revokePermission({
                userId: userId,
                permissionId: resourcePermissionId,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'revokePermission',
                    subjectId: userId,
                    subjectType: 'user',
                },
            });

            const markerPermission =
                await store.getMarkerPermissionAssignmentById(
                    markerPermissionId
                );
            expect(markerPermission).not.toBe(null);

            const resourcePermission =
                await store.getResourcePermissionAssignmentById(
                    resourcePermissionId
                );
            expect(resourcePermission).not.toBe(null);
        });

        it('should do nothing if the inst is not authorized to revoke a resource permission', async () => {
            const result = await controller.revokePermission({
                userId: userId,
                permissionId: resourcePermissionId,
                instances: ['/inst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
                    action: 'revokePermission',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const markerPermission =
                await store.getMarkerPermissionAssignmentById(
                    markerPermissionId
                );
            expect(markerPermission).not.toBe(null);

            const resourcePermission =
                await store.getResourcePermissionAssignmentById(
                    resourcePermissionId
                );
            expect(resourcePermission).not.toBe(null);
        });
    });

    describe('listUserRoles()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
            };
        });

        it('should list the roles for the given user', async () => {
            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });
        });

        it('should list the roles if the current user is the same as the target user', async () => {
            const result = await controller.listUserRoles(
                recordName,
                'testId',
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });
        });

        it('should not allow listing the roles for the own user account if an instance is involved', async () => {
            const result = await controller.listUserRoles(
                recordName,
                'testId',
                'testId',
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: 'testId',
                },
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listUserRoles(
                recordName,
                userId,
                'testId',
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('listInstRoles()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['/testId']: new Set(['role1', 'role2', 'abc']),
            };
        });

        it('should list the roles for the given inst', async () => {
            const result = await controller.listInstRoles(
                recordName,
                userId,
                '/testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });
        });

        it('should normalize inst IDs', async () => {
            const result = await controller.listInstRoles(
                recordName,
                userId,
                'testId'
            );

            expect(result).toEqual({
                success: true,
                roles: [
                    {
                        role: 'abc',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listInstRoles(
                recordName,
                userId,
                '/testId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listInstRoles(
                recordName,
                userId,
                '/testId',
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('listAssignedRoles()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
                ['testId2']: new Set(['role1', 'role2', 'abc']),
                ['testId4']: new Set(['role2']),
                ['testId3']: new Set(['role1']),
            };
        });

        it('should list the users that are assigned the given role', async () => {
            const result = await controller.listAssignedRoles(
                recordName,
                userId,
                'role1'
            );

            expect(result).toEqual({
                success: true,
                assignments: [
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId3',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listAssignedRoles(
                recordName,
                userId,
                'role1'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listAssignedRoles(
                recordName,
                userId,
                'role1',
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('listRoleAssignments()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
                ['testId']: new Set(['role1', 'role2', 'abc']),
                ['testId2']: new Set(['role1', 'role2', 'abc']),
                ['testId4']: new Set(['role2']),
                ['testId3']: new Set(['role1']),
            };
        });

        it('should return a not_supported result if the store does not implement listAssignments()', async () => {
            (store as any).listAssignments = null;

            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                null
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should list all role assignments', async () => {
            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                null
            );

            expect(result).toEqual({
                success: true,
                totalCount: 9,
                assignments: [
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'abc',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'abc',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: userId,
                        role: {
                            role: ADMIN_ROLE_NAME,
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId3',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId4',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                ],
            });
        });

        it('should list roles after the given role', async () => {
            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                ADMIN_ROLE_NAME
            );

            expect(result).toEqual({
                success: true,
                totalCount: 9,
                assignments: [
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId3',
                        role: {
                            role: 'role1',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId2',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                    {
                        type: 'user',
                        userId: 'testId4',
                        role: {
                            role: 'role2',
                            expireTimeMs: null,
                        },
                    },
                ],
            });
        });

        it('should deny the request if the user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                null
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
        });

        it('should deny the request if the inst is not authorized', async () => {
            const result = await controller.listRoleAssignments(
                recordName,
                userId,
                null,
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    action: 'list',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
        });
    });

    describe('grantRole()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should grant the role to the given user', async () => {
            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should be able to set an expiration time', async () => {
            const expireTime = Date.now() + 100000;
            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
                expireTimeMs: expireTime,
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: expireTime,
                },
            ]);
        });

        it('should grant the role to the given instance', async () => {
            const result = await controller.grantRole(recordName, userId, {
                instance: '/inst',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForInst(recordName, '/inst');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should normalize inst IDs', async () => {
            const result = await controller.grantRole(recordName, userId, {
                instance: 'inst',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const actualRoles = await store.listRolesForInst(
                recordName,
                '/inst'
            );

            expect(actualRoles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
            ]);

            const wrongRoles = await store.listRolesForInst(recordName, 'inst');
            expect(wrongRoles).toEqual([]);
        });

        it('should deny the request if the current user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.grantRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    resourceId: 'role1',
                    action: 'grant',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });

        it('should deny the request if one of the given instances is not authorized', async () => {
            const result = await controller.grantRole(
                recordName,
                userId,
                {
                    userId: 'testId',
                    role: 'role1',
                },
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    resourceId: 'role1',
                    action: 'grant',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([]);
        });
    });

    describe('revokeRole()', () => {
        beforeEach(() => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            store.roleAssignments[recordName] = {
                ['testId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
                ['/instId']: [
                    {
                        role: 'role1',
                        expireTimeMs: null,
                    },
                    {
                        role: 'role2',
                        expireTimeMs: null,
                    },
                ],
            };
        });

        it('should revoke the role from the given user', async () => {
            const result = await controller.revokeRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should revoke the role from the given inst', async () => {
            const result = await controller.revokeRole(recordName, userId, {
                instance: '/instId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForInst(recordName, '/instId');

            expect(roles).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should normalize inst IDs', async () => {
            const result = await controller.revokeRole(recordName, userId, {
                instance: 'instId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForInst(recordName, '/instId');

            expect(roles).toEqual([
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should deny the request if the current user is not authorized', async () => {
            delete store.roles[recordName][userId];

            const result = await controller.revokeRole(recordName, userId, {
                userId: 'testId',
                role: 'role1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    resourceId: 'role1',
                    action: 'revoke',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);
        });

        it('should deny the request if one of the instances are not authorized', async () => {
            const result = await controller.revokeRole(
                recordName,
                userId,
                {
                    userId: 'testId',
                    role: 'role1',
                },
                ['/inst']
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'role',
                    resourceId: 'role1',
                    action: 'revoke',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            const roles = await store.listRolesForUser(recordName, 'testId');

            expect(roles).toEqual([
                {
                    role: 'role1',
                    expireTimeMs: null,
                },
                {
                    role: 'role2',
                    expireTimeMs: null,
                },
            ]);
        });
    });

    describe('authorizeSubject()', () => {
        const adminOrGrantedActionCases: [ActionKinds, string | null][] = [
            ['create', 'resourceId'],
            ['update', 'resourceId'],
            ['delete', 'resourceId'],
            ['read', 'resourceId'],
            ['list', null],
            ['updateData', 'resourceId'],
            ['increment', 'resourceId'],
            ['count', 'resourceId'],
            ['sendAction', 'resourceId'],
            ['assign', 'resourceId'],
            ['unassign', 'resourceId'],
            ['grantPermission', 'resourceId'],
            ['revokePermission', 'resourceId'],
            ['grant', 'resourceId'],
            ['revoke', 'resourceId'],
            ['run', 'resourceId'],
            ['send', 'resourceId'],
            ['subscribe', 'resourceId'],
            ['listSubscriptions', 'resourceId'],
        ];

        const moderatorActionCases: [ActionKinds][] = [
            ['read'],
            ['list'],
            ['count'],
            ['listSubscriptions'],
        ];

        const adminOrGrantedResourceKindCases: [ResourceKinds][] = [
            ['data'],
            ['file'],
            ['event'],
            ['inst'],
            ['marker'],
            ['role'],
            ['loom'],
            ['ai.sloyd'],
            ['ai.hume'],
            ['webhook'],
            ['notification'],
            ['package'],
            ['package.version'],
        ];

        // Admins can perform all actions on all resources
        describe.each(adminOrGrantedResourceKindCases)('%s', (resourceKind) => {
            describe.each(adminOrGrantedActionCases)(
                '%s',
                (action, resourceId) => {
                    const marker = 'secret';

                    it('should allow the action if the user is the owner of the record', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: ownerId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,

                                // The role that record owners recieve
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // resourceKind and action are null because this permission
                                // applies to all resources and actions.
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is the owner of the record.',
                        });
                    });

                    it('should allow the action if the user is an admin of the studio', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: studioRecord,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: ownerId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: studioRecord,
                            permission: {
                                id: null,
                                recordName: studioRecord,
                                userId: null,

                                // The role that admins recieve automatically
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // Null because admins have all access in a studio
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation:
                                "User is an admin in the record's studio.",
                        });
                    });

                    it('should allow the action if the user was granted the admin role in the record', async () => {
                        await store.assignSubjectRole(
                            recordName,
                            userId,
                            'user',
                            {
                                expireTimeMs: null,
                                role: ADMIN_ROLE_NAME,
                            }
                        );

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,

                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // resourceKind and action are null because this permission
                                // applies to all resources and actions.
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is assigned the "admin" role.',
                        });
                    });

                    it('should allow the action if the inst was granted the admin role in the record', async () => {
                        await store.assignSubjectRole(
                            recordName,
                            '/myInst',
                            'inst',
                            {
                                expireTimeMs: null,
                                role: ADMIN_ROLE_NAME,
                            }
                        );

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: '/myInst',
                                subjectType: 'inst',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,

                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // resourceKind and action are null because this permission
                                // applies to all resources and actions.
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'Inst is assigned the "admin" role.',
                        });
                    });

                    it('should allow the action if the role is the admin role', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: ADMIN_ROLE_NAME,
                                subjectType: 'role',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,

                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // resourceKind and action are null because this permission
                                // applies to all resources and actions.
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'Role is "admin".',
                        });
                    });

                    it('should allow the action if the user is a superUser', async () => {
                        const user = await store.findUser(userId);
                        await store.saveUser({
                            ...user,
                            role: 'superUser',
                        });

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,

                                // The role that record owners recieve
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // resourceKind and action are null because this permission
                                // applies to all resources and actions.
                                resourceKind: null,
                                action: null,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is a superUser.',
                        });
                    });

                    if (resourceId) {
                        it('should allow the action if the user was granted access to the resource', async () => {
                            const permission =
                                (await store.assignPermissionToSubjectAndResource(
                                    recordName,
                                    'user',
                                    userId,
                                    resourceKind,
                                    resourceId,
                                    action,
                                    {},
                                    null
                                )) as AssignPermissionToSubjectAndResourceSuccess;

                            const context =
                                await controller.constructAuthorizationContext({
                                    recordKeyOrRecordName: recordName,
                                    userId: userId,
                                });

                            const result = await controller.authorizeSubject(
                                context,
                                {
                                    subjectId: userId,
                                    subjectType: 'user',
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                    markers: [marker],
                                }
                            );

                            expect(result).toEqual({
                                success: true,
                                recordName: recordName,
                                permission: permission.permissionAssignment,
                                explanation: `User was granted access to resource "resourceId" by "${permission.permissionAssignment.id}"`,
                            });
                        });

                        it('should allow the action if the user was granted access to the resource via a role', async () => {
                            await store.assignSubjectRole(
                                recordName,
                                userId,
                                'user',
                                {
                                    role: 'myRole',
                                    expireTimeMs: null,
                                }
                            );

                            const permission =
                                (await store.assignPermissionToSubjectAndResource(
                                    recordName,
                                    'role',
                                    'myRole',
                                    resourceKind,
                                    resourceId,
                                    action,
                                    {},
                                    null
                                )) as AssignPermissionToSubjectAndResourceSuccess;

                            const context =
                                await controller.constructAuthorizationContext({
                                    recordKeyOrRecordName: recordName,
                                    userId: userId,
                                });

                            const result = await controller.authorizeSubject(
                                context,
                                {
                                    subjectId: userId,
                                    subjectType: 'user',
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                    markers: [marker],
                                }
                            );

                            expect(result).toEqual({
                                success: true,
                                recordName: recordName,
                                permission: permission.permissionAssignment,
                                explanation: `User was granted access to resource "resourceId" by "${permission.permissionAssignment.id}" using role "myRole"`,
                            });
                        });
                    } else {
                        // permissions that do not provide a resource ID are not allowed to provide multiple markers
                        it('should reject the action if given more than one marker', async () => {
                            const context =
                                await controller.constructAuthorizationContext({
                                    recordKeyOrRecordName: recordName,
                                    userId: userId,
                                });

                            const result = await controller.authorizeSubject(
                                context,
                                {
                                    subjectId: userId,
                                    subjectType: 'user',
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                    markers: [marker, 'marker2'],
                                }
                            );

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage: `The "${action}" action cannot be used with multiple markers.`,
                                reason: {
                                    type: 'too_many_markers',
                                },
                            });
                        });
                    }

                    it('should allow the action if the user was granted access to the marker', async () => {
                        const permission =
                            (await store.assignPermissionToSubjectAndMarker(
                                recordName,
                                'user',
                                userId,
                                resourceKind,
                                marker,
                                action,
                                {},
                                null
                            )) as AssignPermissionToSubjectAndMarkerSuccess;

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: permission.permissionAssignment,
                            explanation: `User was granted access to marker "${marker}" by "${permission.permissionAssignment.id}"`,
                        });
                    });

                    it('should support markers with paths', async () => {
                        const permission =
                            (await store.assignPermissionToSubjectAndMarker(
                                recordName,
                                'user',
                                userId,
                                resourceKind,
                                marker,
                                action,
                                {},
                                null
                            )) as AssignPermissionToSubjectAndMarkerSuccess;

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: ['secret:tag'],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: permission.permissionAssignment,
                            explanation: `User was granted access to marker "${marker}" by "${permission.permissionAssignment.id}"`,
                        });
                    });

                    it('should allow the action if the user was granted access to the marker via a role', async () => {
                        await store.assignSubjectRole(
                            recordName,
                            userId,
                            'user',
                            {
                                role: 'myRole',
                                expireTimeMs: null,
                            }
                        );

                        const permission =
                            (await store.assignPermissionToSubjectAndMarker(
                                recordName,
                                'role',
                                'myRole',
                                resourceKind,
                                marker,
                                action,
                                {},
                                null
                            )) as AssignPermissionToSubjectAndMarkerSuccess;

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: permission.permissionAssignment,
                            explanation: `User was granted access to marker "${marker}" by "${permission.permissionAssignment.id}" using role "myRole"`,
                        });
                    });

                    it('should return not_logged_in if given a null user ID', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: null,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_logged_in',
                            errorMessage:
                                'The user must be logged in. Please provide a sessionKey or a recordKey.',
                        });
                    });

                    it('should return not_authorized if given a null user ID and configured to do so', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                                sendNotLoggedIn: false,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: null,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                            reason: {
                                type: 'missing_permission',
                                recordName: recordName,
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                subjectType: 'user',
                                subjectId: null,
                            },
                        });
                    });

                    it('should deny the action if the user is not the owner of the record', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                            reason: {
                                type: 'missing_permission',
                                recordName: recordName,
                                subjectType: 'user',
                                subjectId: userId,
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                            },
                        });
                    });

                    if (moderatorActionCases.some(([a]) => action === a)) {
                        it('should allow the action if the user is a moderator', async () => {
                            const user = await store.findUser(userId);
                            await store.saveUser({
                                ...user,
                                role: 'moderator',
                            });

                            const context =
                                await controller.constructAuthorizationContext({
                                    recordKeyOrRecordName: recordName,
                                    userId: userId,
                                });

                            const result = await controller.authorizeSubject(
                                context,
                                {
                                    subjectId: userId,
                                    subjectType: 'user',
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                    markers: [marker],
                                }
                            );

                            expect(result).toEqual({
                                success: true,
                                recordName: recordName,
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,

                                    // The role that record owners recieve
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,

                                    // resourceKind and action are null because this permission
                                    // applies to all resources and actions.
                                    resourceKind: null,
                                    action: action,

                                    marker: marker,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: 'User is a moderator.',
                            });
                        });
                    } else {
                        it('should deny the action even if the user is a moderator', async () => {
                            const user = await store.findUser(userId);
                            await store.saveUser({
                                ...user,
                                role: 'moderator',
                            });

                            const context =
                                await controller.constructAuthorizationContext({
                                    recordKeyOrRecordName: recordName,
                                    userId: userId,
                                });

                            const result = await controller.authorizeSubject(
                                context,
                                {
                                    subjectId: userId,
                                    subjectType: 'user',
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                    markers: [marker],
                                }
                            );

                            expect(result).toEqual({
                                success: false,
                                errorCode: 'not_authorized',
                                errorMessage:
                                    'You are not authorized to perform this action.',
                                reason: {
                                    type: 'missing_permission',
                                    recordName: recordName,
                                    subjectType: 'user',
                                    subjectId: userId,
                                    resourceKind: resourceKind,
                                    action: action,
                                    resourceId: resourceId,
                                },
                            });
                        });
                    }
                }
            );
        });

        const recordKeyResourceKindCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'data',
                [
                    ['create', 'resourceId'],
                    ['update', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'file',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                ],
            ],
            [
                'event',
                [
                    ['create', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['count', 'resourceId'],
                    ['update', 'resourceId'],
                ],
            ],
            [
                'inst',
                [
                    ['create', 'resourceId'],
                    ['update', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                ],
            ],
        ];

        const recordKeySubjectTypeCases: [SubjectType, string][] = [
            ['user', 'subjectId'],
            ['inst', '/subjectId'],
        ];

        describe.each(recordKeyResourceKindCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    describe.each(recordKeySubjectTypeCases)(
                        'subject %s',
                        (subjectType, subjectId) => {
                            const marker = 'marker';

                            it('should allow the action if using a recordKey', async () => {
                                const context =
                                    await controller.constructAuthorizationContext(
                                        {
                                            recordKeyOrRecordName: recordKey,
                                            userId: userId,
                                        }
                                    );

                                const result =
                                    await controller.authorizeSubject(context, {
                                        subjectId: subjectId,
                                        subjectType: subjectType,
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                        markers: [marker],
                                    });

                                expect(result).toEqual({
                                    success: true,
                                    recordName: recordName,
                                    permission: {
                                        id: null,
                                        recordName,
                                        userId: null,

                                        // The role that record keys recieve
                                        subjectType: 'role',
                                        subjectId: ADMIN_ROLE_NAME,

                                        // This permission may only apply to this specific resource kind
                                        // or action
                                        resourceKind: resourceKind,
                                        action: action,

                                        marker: marker,
                                        options: {},
                                        expireTimeMs: null,
                                    },
                                    explanation: 'A recordKey was used.',
                                });
                            });

                            if (subjectType === 'user') {
                                it('should deny the action if the user is not logged in but is using a subjectfull record key', async () => {
                                    const context =
                                        await controller.constructAuthorizationContext(
                                            {
                                                recordKeyOrRecordName:
                                                    recordKey,
                                                userId: userId,
                                            }
                                        );

                                    const result =
                                        await controller.authorizeSubject(
                                            context,
                                            {
                                                subjectId: null,
                                                subjectType: subjectType,
                                                resourceKind: resourceKind,
                                                action: action,
                                                resourceId: resourceId,
                                                markers: [marker],
                                            }
                                        );

                                    expect(result).toEqual({
                                        success: false,
                                        errorCode: 'not_logged_in',
                                        errorMessage:
                                            'You must be logged in in order to use this record key.',
                                    });
                                });

                                it('should allow the action if the user is not logged in but is using a subjectless record key', async () => {
                                    const testRecordKey =
                                        await createTestRecordKey(
                                            services,
                                            ownerId,
                                            recordName,
                                            'subjectless'
                                        );

                                    const context =
                                        await controller.constructAuthorizationContext(
                                            {
                                                recordKeyOrRecordName:
                                                    testRecordKey.recordKey,
                                                userId: userId,
                                            }
                                        );

                                    const result =
                                        await controller.authorizeSubject(
                                            context,
                                            {
                                                subjectId: null,
                                                subjectType: subjectType,
                                                resourceKind: resourceKind,
                                                action: action,
                                                resourceId: resourceId,
                                                markers: [marker],
                                            }
                                        );

                                    expect(result).toEqual({
                                        success: true,
                                        recordName: recordName,
                                        permission: {
                                            id: null,
                                            recordName,
                                            userId: null,

                                            // The role that record keys recieve
                                            subjectType: 'role',
                                            subjectId: ADMIN_ROLE_NAME,

                                            // This permission may only apply to this specific resource kind
                                            // or action
                                            resourceKind: resourceKind,
                                            action: action,

                                            marker: marker,
                                            options: {},
                                            expireTimeMs: null,
                                        },
                                        explanation: 'A recordKey was used.',
                                    });
                                });
                            }
                        }
                    );
                });
            }
        );

        const recordKeyResourceKindDenialCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'file',
                [
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'event',
                [
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                ],
            ],
            [
                'inst',
                [
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'marker',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['assign', 'resourceId'],
                    ['assign', PUBLIC_READ_MARKER],
                    ['unassign', 'resourceId'],
                    ['unassign', PUBLIC_READ_MARKER],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['list', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'role',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['list', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            ['loom', [['create', 'resourceId']]],
            ['ai.sloyd', [['create', 'resourceId']]],
            ['ai.hume', [['create', 'resourceId']]],
            [
                'webhook',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['run', 'resourceId'],
                ],
            ],
            [
                'notification',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['run', 'resourceId'],
                    ['send', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['listSubscriptions', 'resourceId'],
                ],
            ],
            [
                'package',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['run', 'resourceId'],
                    ['send', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['listSubscriptions', 'resourceId'],
                ],
            ],
            [
                'package.version',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['run', 'resourceId'],
                    ['send', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['listSubscriptions', 'resourceId'],
                ],
            ],
        ];

        const recordKeySubjectTypeDenialCases: [SubjectType, string][] = [
            ['user', 'subjectId'],
            ['inst', '/subjectId'],
        ];

        describe.each(recordKeyResourceKindDenialCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    describe.each(recordKeySubjectTypeDenialCases)(
                        'subject %s',
                        (subjectType, subjectId) => {
                            const marker = 'marker';

                            it('should deny the action if using a recordKey', async () => {
                                const context =
                                    await controller.constructAuthorizationContext(
                                        {
                                            recordKeyOrRecordName: recordKey,
                                            userId: userId,
                                        }
                                    );

                                const result =
                                    await controller.authorizeSubject(context, {
                                        subjectId: subjectId,
                                        subjectType: subjectType,
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                        markers: [marker],
                                    });

                                expect(result).toEqual({
                                    success: false,
                                    errorCode: 'not_authorized',
                                    errorMessage:
                                        'You are not authorized to perform this action.',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName: recordName,
                                        subjectType: subjectType,
                                        subjectId: subjectId,
                                        action: action,
                                        resourceKind: resourceKind,
                                        resourceId: resourceId,
                                    },
                                });
                            });
                        }
                    );
                });
            }
        );

        const studioMemberResourceKindCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'data',
                [
                    ['create', 'resourceId'],
                    ['update', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'file',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'event',
                [
                    ['increment', 'resourceId'],
                    ['count', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'inst',
                [
                    ['create', 'resourceId'],
                    ['update', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['list', null],
                ],
            ],
            ['loom', [['create', 'resourceId']]],
            [
                'marker',
                [
                    ['assign', PUBLIC_READ_MARKER],
                    ['assign', PRIVATE_MARKER],
                ],
            ],
            [
                'webhook',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                    ['run', 'resourceId'],
                ],
            ],
            [
                'package',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'package.version',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['run', 'resourceId'],
                    ['list', null],
                ],
            ],
        ];

        describe.each(studioMemberResourceKindCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    const marker =
                        resourceKind !== 'marker' ? 'marker' : ACCOUNT_MARKER;

                    it('should allow the action if the user is a member of the studio', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: studioRecord,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: memberId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: studioRecord,
                            permission: {
                                id: null,
                                recordName: studioRecord,

                                userId: memberId,
                                subjectType: 'user',
                                subjectId: memberId,

                                // resourceKind and action are specified
                                // because members don't necessarily have all permissions in the studio
                                resourceKind: resourceKind,
                                action: action,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation:
                                "User is a member in the record's studio.",
                        });
                    });

                    it('should deny the action if the user is not a member of the studio', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: studioRecord,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: userId,
                                subjectType: 'user',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                            reason: {
                                type: 'missing_permission',
                                recordName: studioRecord,
                                subjectType: 'user',
                                subjectId: userId,
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                            },
                        });
                    });
                });
            }
        );

        describe.each(studioMemberResourceKindCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    const marker =
                        resourceKind !== 'marker' ? 'marker' : ACCOUNT_MARKER;
                    const inst = 'inst';
                    let instId: string;

                    beforeEach(() => {
                        instId = formatInstId(recordName, inst);
                    });

                    it('should allow the action if the inst is owned by the record', async () => {
                        await store.saveInst({
                            recordName,
                            inst: inst,
                            markers: ['anything'],
                            branches: [],
                        });

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: instId,
                                subjectType: 'inst',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: instId,

                                // resourceKind and action are specified
                                // because members don't necessarily have all permissions in the studio
                                resourceKind: resourceKind,
                                action: action,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'Inst is owned by the record.',
                        });
                    });

                    it('should deny the action if the inst is not owned by the record', async () => {
                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: studioRecord,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: instId,
                                subjectType: 'inst',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: false,
                            errorCode: 'not_authorized',
                            errorMessage:
                                'You are not authorized to perform this action.',
                            reason: {
                                type: 'missing_permission',
                                recordName: studioRecord,
                                subjectType: 'inst',
                                subjectId: instId,
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                            },
                        });
                    });

                    it('should allow the action if the inst is owned by the studio', async () => {
                        const otherStudioRecord = 'otherStudioRecord';
                        const studioRecordResult =
                            (await services.records.createRecord({
                                recordName: otherStudioRecord,
                                userId: ownerId,
                                studioId: studioId,
                            })) as CreateRecordSuccess;

                        await store.saveInst({
                            recordName: otherStudioRecord,
                            inst: inst,
                            markers: ['anything'],
                            branches: [],
                        });
                        instId = formatInstId(otherStudioRecord, inst);

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: studioRecord,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: instId,
                                subjectType: 'inst',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: studioRecord,
                            permission: {
                                id: null,
                                recordName: studioRecord,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: instId,

                                // resourceKind and action are specified
                                // because members don't necessarily have all permissions in the studio
                                resourceKind: resourceKind,
                                action: action,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: `Inst is owned by the record's (${studioRecord}) studio (${studioId}).`,
                        });
                    });

                    it('should allow the action if the inst is owned by the user', async () => {
                        const otherRecord = 'otherRecord';
                        const studioRecordResult =
                            (await services.records.createRecord({
                                recordName: otherRecord,
                                userId: ownerId,
                                ownerId: ownerId,
                            })) as CreateRecordSuccess;

                        await store.saveInst({
                            recordName: otherRecord,
                            inst: inst,
                            markers: ['anything'],
                            branches: [],
                        });
                        instId = formatInstId(otherRecord, inst);

                        const context =
                            await controller.constructAuthorizationContext({
                                recordKeyOrRecordName: recordName,
                                userId: userId,
                            });

                        const result = await controller.authorizeSubject(
                            context,
                            {
                                subjectId: instId,
                                subjectType: 'inst',
                                resourceKind: resourceKind,
                                action: action,
                                resourceId: resourceId,
                                markers: [marker],
                            }
                        );

                        expect(result).toEqual({
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: instId,

                                // resourceKind and action are specified
                                // because members don't necessarily have all permissions in the studio
                                resourceKind: resourceKind,
                                action: action,

                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: `Inst is owned by the record's (${recordName}) owner (${ownerId}).`,
                        });
                    });
                });
            }
        );

        const studioMemberResourceKindDenialCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'file',
                [
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'event',
                [
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                ],
            ],
            [
                'inst',
                [
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'marker',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['list', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            [
                'role',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['list', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                ],
            ],
            ['ai.sloyd', [['create', 'resourceId']]],
            ['ai.hume', [['create', 'resourceId']]],
            [
                'notification',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['update', 'resourceId'],
                    ['read', 'resourceId'],
                    ['assign', 'resourceId'],
                    ['unassign', 'resourceId'],
                    ['grant', 'resourceId'],
                    ['revoke', 'resourceId'],
                    ['grantPermission', 'resourceId'],
                    ['revokePermission', 'resourceId'],
                    ['list', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                    ['count', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['send', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['listSubscriptions', 'resourceId'],
                ],
            ],
        ];

        describe.each(studioMemberResourceKindDenialCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    describe.each(recordKeySubjectTypeCases)(
                        'subject %s',
                        (subjectType) => {
                            const marker = 'marker';

                            it('should deny the action even if the user is a member of the studio', async () => {
                                const context =
                                    await controller.constructAuthorizationContext(
                                        {
                                            recordKeyOrRecordName: studioRecord,
                                            userId: userId,
                                        }
                                    );

                                const result =
                                    await controller.authorizeSubject(context, {
                                        subjectId: memberId,
                                        subjectType: 'user',
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                        markers: [marker],
                                    });

                                expect(result).toEqual({
                                    success: false,
                                    errorCode: 'not_authorized',
                                    errorMessage:
                                        'You are not authorized to perform this action.',
                                    reason: {
                                        type: 'missing_permission',
                                        recordName: studioRecord,
                                        subjectType: 'user',
                                        subjectId: memberId,
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                    },
                                });
                            });
                        }
                    );
                });
            }
        );

        const publicReadResourceKindCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'data',
                [
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            ['file', [['read', 'resourceId']]],
            ['event', [['count', 'resourceId']]],
            ['inst', [['read', 'resourceId']]],
            ['webhook', [['run', 'resourceId']]],
            [
                'notification',
                [
                    ['read', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'package',
                [
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'package.version',
                [
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
        ];

        const publicReadSubjectTypeCases: [
            string,
            SubjectType,
            string | null
        ][] = [
            ['user', 'user', 'randomUserId'],
            ['not logged in', 'user', null],
            ['inst', 'inst', '/instId'],
        ];

        describe.each(publicReadResourceKindCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    describe.each(publicReadSubjectTypeCases)(
                        '%s',
                        (desc, subjectType, subjectId) => {
                            const marker = PUBLIC_READ_MARKER;

                            it('should allow the action', async () => {
                                const context =
                                    await controller.constructAuthorizationContext(
                                        {
                                            recordKeyOrRecordName: studioRecord,
                                            userId: userId,
                                        }
                                    );

                                const result =
                                    await controller.authorizeSubject(context, {
                                        subjectId: subjectId,
                                        subjectType: subjectType,
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                        markers: [marker],
                                    });

                                expect(result).toEqual({
                                    success: true,
                                    recordName: studioRecord,
                                    permission: {
                                        id: null,
                                        recordName: studioRecord,

                                        userId: null,
                                        subjectType: subjectType,
                                        subjectId: subjectId,

                                        // resourceKind and action are specified
                                        // because members don't necessarily have all permissions in the studio
                                        resourceKind: resourceKind,
                                        action: action,

                                        marker: marker,
                                        options: {},
                                        expireTimeMs: null,
                                    },
                                    explanation:
                                        'Resource has the publicRead marker.',
                                });
                            });
                        }
                    );
                });
            }
        );

        const publicWriteResourceKindCases: [
            ResourceKinds,
            [ActionKinds, string | null][]
        ][] = [
            [
                'data',
                [
                    ['create', 'resourceId'],
                    ['update', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'file',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                ],
            ],
            [
                'event',
                [
                    ['create', 'resourceId'],
                    ['increment', 'resourceId'],
                    ['count', 'resourceId'],
                ],
            ],
            [
                'inst',
                [
                    ['create', 'resourceId'],
                    ['delete', 'resourceId'],
                    ['read', 'resourceId'],
                    ['updateData', 'resourceId'],
                    ['sendAction', 'resourceId'],
                ],
            ],
            ['webhook', [['run', 'resourceId']]],
            [
                'notification',
                [
                    ['read', 'resourceId'],
                    ['subscribe', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'package',
                [
                    ['read', 'resourceId'],
                    ['list', null],
                ],
            ],
            [
                'package.version',
                [
                    ['read', 'resourceId'],
                    ['run', 'resourceId'],
                    ['list', null],
                ],
            ],
        ];

        const publicWriteSubjectTypeCases: [
            string,
            SubjectType,
            string | null
        ][] = [
            ['user', 'user', 'randomUserId'],
            ['not logged in', 'user', null],
            ['inst', 'inst', '/instId'],
        ];

        describe.each(publicWriteResourceKindCases)(
            '%s',
            (resourceKind, actions) => {
                describe.each(actions)('%s', (action, resourceId) => {
                    describe.each(publicWriteSubjectTypeCases)(
                        '%s',
                        (desc, subjectType, subjectId) => {
                            const marker = PUBLIC_WRITE_MARKER;

                            it('should allow the action', async () => {
                                const context =
                                    await controller.constructAuthorizationContext(
                                        {
                                            recordKeyOrRecordName: studioRecord,
                                            userId: userId,
                                        }
                                    );

                                const result =
                                    await controller.authorizeSubject(context, {
                                        subjectId: subjectId,
                                        subjectType: subjectType,
                                        resourceKind: resourceKind,
                                        action: action,
                                        resourceId: resourceId,
                                        markers: [marker],
                                    });

                                expect(result).toEqual({
                                    success: true,
                                    recordName: studioRecord,
                                    permission: {
                                        id: null,
                                        recordName: studioRecord,

                                        userId: null,
                                        subjectType: subjectType,
                                        subjectId: subjectId,

                                        // resourceKind and action are specified
                                        // because members don't necessarily have all permissions in the studio
                                        resourceKind: resourceKind,
                                        action: action,

                                        marker: marker,
                                        options: {},
                                        expireTimeMs: null,
                                    },
                                    explanation:
                                        'Resource has the publicWrite marker.',
                                });
                            });
                        }
                    );
                });
            }
        );

        describe('privacy features', () => {
            describe('missing', () => {
                let privoClient: jest.Mocked<PrivoClientInterface>;
                let auth: AuthController;
                let records: RecordsController;

                beforeEach(() => {
                    privoClient = {
                        createAdultAccount: jest.fn(),
                        createChildAccount: jest.fn(),
                        getUserInfo: jest.fn(),
                        generateAuthorizationUrl: jest.fn(),
                        processAuthorizationCallback: jest.fn(),
                        checkEmail: jest.fn(),
                        checkDisplayName: jest.fn(),
                        generateLogoutUrl: jest.fn(),
                        resendConsentRequest: jest.fn(),
                    };
                    auth = new AuthController(
                        store,
                        services.authMessenger,
                        store,
                        true,
                        privoClient
                    );
                    records = new RecordsController({
                        auth: store,
                        config: store,
                        messenger: store,
                        metrics: store,
                        store,
                    });

                    controller = new PolicyController(auth, records, store);
                });

                it('should default to not allowing any privacy features if privo is enabled and if the user is not logged in', async () => {
                    const owner = await store.findUser(ownerId);
                    await store.saveUser({
                        ...owner,
                        privacyFeatures: null,
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId: null,
                        });

                    expect(context).toEqual({
                        success: true,
                        context: {
                            recordName,
                            recordKeyResult: null,
                            subjectPolicy: 'subjectfull',
                            recordKeyProvided: false,
                            recordKeyCreatorId: undefined,
                            recordOwnerId: ownerId,
                            recordOwnerPrivacyFeatures: {
                                allowAI: true,
                                allowPublicData: true,
                                allowPublicInsts: true,
                                publishData: true,
                            },
                            recordStudioId: null,
                            recordStudioMembers: undefined,
                            userId: null,
                            userPrivacyFeatures: {
                                allowAI: false,
                                allowPublicData: false,
                                allowPublicInsts: false,
                                publishData: false,
                            },
                            sendNotLoggedIn: true,
                            userRole: 'none',
                        },
                    });

                    expect(auth.privoEnabled).toBe(true);
                });
            });

            describe('publishData', () => {
                it('should reject the request if the user is not allowed to publish data', async () => {
                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: false,
                            allowPublicData: false,
                            allowPublicInsts: false,
                            publishData: false,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId: ownerId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: ownerId,
                        subjectType: 'user',
                        resourceKind: 'data',
                        action: 'read',
                        resourceId: 'resourceId',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: recordName,
                            subjectType: 'user',
                            subjectId: ownerId,
                            resourceKind: 'data',
                            action: 'read',
                            resourceId: 'resourceId',
                            privacyFeature: 'publishData',
                        },
                    });
                });

                it('should allow the request if the user is accessing an inst in a record own as long as they can publish data', async () => {
                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: false,
                            allowPublicData: false,
                            allowPublicInsts: false,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId: ownerId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: ownerId,
                        subjectType: 'user',
                        resourceKind: 'inst',
                        action: 'read',
                        resourceId: 'myInst',
                        markers: ['secret'],
                    });

                    expect(result).toEqual({
                        success: true,
                        explanation: 'User is the owner of the record.',
                        permission: {
                            id: null,

                            recordName: recordName,
                            action: null,
                            userId: null,
                            resourceKind: null,

                            subjectId: 'admin',
                            subjectType: 'role',

                            marker: 'secret',
                            options: {},
                            expireTimeMs: null,
                        },
                        recordName: 'testRecord',
                    });
                });
            });

            describe('allowPublicData', () => {
                it('should reject the request if the user is accessing data from a record they dont own and privacy features disallow public data', async () => {
                    await services.records.createRecord({
                        recordName: 'otherRecord',
                        userId: ownerId,
                        ownerId: ownerId,
                    });

                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: false,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: 'otherRecord',
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: userId,
                        subjectType: 'user',
                        resourceKind: 'data',
                        action: 'read',
                        resourceId: 'resourceId',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: 'otherRecord',
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'data',
                            action: 'read',
                            resourceId: 'resourceId',
                            privacyFeature: 'allowPublicData',
                        },
                    });
                });

                it('should reject the request if the user is accessing public data and their privacy features disallow public data', async () => {
                    await services.records.createRecord({
                        recordName: 'otherRecord',
                        userId: userId,
                        ownerId: userId,
                    });

                    const user = await store.findUser(userId);

                    await store.saveUser({
                        ...user,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: false,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: 'otherRecord',
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: userId,
                        subjectType: 'user',
                        resourceKind: 'data',
                        action: 'read',
                        resourceId: 'resourceId',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: 'otherRecord',
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'data',
                            action: 'read',
                            resourceId: 'resourceId',
                            privacyFeature: 'allowPublicData',
                        },
                    });
                });

                it('should reject the request if the inst is accessing data from a record they dont own and privacy features disallow public data', async () => {
                    await services.records.createRecord({
                        recordName: 'otherRecord',
                        userId: ownerId,
                        ownerId: ownerId,
                    });

                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: false,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: 'otherRecord',
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: '/myInst',
                        subjectType: 'inst',
                        resourceKind: 'data',
                        action: 'read',
                        resourceId: 'resourceId',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: 'otherRecord',
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'data',
                            action: 'read',
                            resourceId: 'resourceId',
                            privacyFeature: 'allowPublicData',
                        },
                    });
                });

                it('should reject the request if the user is not logged in but is accessing from a user that disallows public data', async () => {
                    await services.records.createRecord({
                        recordName: 'otherRecord',
                        userId: ownerId,
                        ownerId: ownerId,
                    });

                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: false,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: 'otherRecord',
                            userId: null,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: null,
                        subjectType: 'user',
                        resourceKind: 'data',
                        action: 'read',
                        resourceId: 'resourceId',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: 'otherRecord',
                            subjectType: 'user',
                            subjectId: null,
                            resourceKind: 'data',
                            action: 'read',
                            resourceId: 'resourceId',
                            privacyFeature: 'allowPublicData',
                        },
                    });
                });
            });

            describe('allowPublicInsts', () => {
                it('should reject the request if the user is accessing an inst in a record they do not own but the user privacy features disallow public insts', async () => {
                    const user = await store.findUser(userId);

                    await store.saveUser({
                        ...user,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: false,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: userId,
                        subjectType: 'user',
                        resourceKind: 'inst',
                        action: 'read',
                        resourceId: 'myInst',
                        markers: ['secret'],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: recordName,
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'inst',
                            action: 'read',
                            resourceId: 'myInst',
                            privacyFeature: 'allowPublicInsts',
                        },
                    });
                });

                it('should reject the request if the user is accessing an inst in a record they do not own but the owner privacy features disallow public insts', async () => {
                    const owner = await store.findUser(ownerId);

                    await store.saveUser({
                        ...owner,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: false,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: recordName,
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: userId,
                        subjectType: 'user',
                        resourceKind: 'inst',
                        action: 'read',
                        resourceId: 'myInst',
                        markers: ['secret'],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: recordName,
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'inst',
                            action: 'read',
                            resourceId: 'myInst',
                            privacyFeature: 'allowPublicInsts',
                        },
                    });
                });

                it('should reject the request if the user is accessing an inst in a record they own but their privacy features disallow public insts', async () => {
                    await services.records.createRecord({
                        recordName: 'otherRecord',
                        userId: ownerId,
                        ownerId: ownerId,
                    });

                    const user = await store.findUser(userId);

                    await store.saveUser({
                        ...user,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: false,
                            publishData: true,
                        },
                    });

                    const context =
                        await controller.constructAuthorizationContext({
                            recordKeyOrRecordName: 'otherRecord',
                            userId: userId,
                        });

                    const result = await controller.authorizeSubject(context, {
                        subjectId: userId,
                        subjectType: 'user',
                        resourceKind: 'inst',
                        action: 'read',
                        resourceId: 'myInst',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: 'otherRecord',
                            subjectType: 'user',
                            subjectId: userId,
                            resourceKind: 'inst',
                            action: 'read',
                            resourceId: 'myInst',
                            privacyFeature: 'allowPublicInsts',
                        },
                    });
                });
            });
        });

        it('should normalize inst IDs', async () => {
            const context = await controller.constructAuthorizationContext({
                recordKeyOrRecordName: studioRecord,
                userId: userId,
            });

            const result = await controller.authorizeSubject(context, {
                subjectId: 'instId',
                subjectType: 'inst',
                resourceKind: 'data',
                action: 'read',
                resourceId: 'resourceId',
                markers: [PUBLIC_READ_MARKER],
            });

            expect(result).toEqual({
                success: true,
                recordName: studioRecord,
                permission: {
                    id: null,
                    recordName: studioRecord,

                    userId: null,
                    subjectType: 'inst',
                    subjectId: '/instId',

                    // resourceKind and action are specified
                    // because members don't necessarily have all permissions in the studio
                    resourceKind: 'data',
                    action: 'read',

                    marker: PUBLIC_READ_MARKER,
                    options: {},
                    expireTimeMs: null,
                },
                explanation: 'Resource has the publicRead marker.',
            });
        });
    });

    describe('authorizeSubjects()', () => {
        it('should authorize both subjects', async () => {
            const marker = 'marker';
            const resourceKind: ResourceKinds = 'data';
            const resourceId = 'resourceId';
            const action: ActionKinds = 'create';
            const instId = '/myInst';

            await store.assignSubjectRole(recordName, instId, 'inst', {
                expireTimeMs: null,
                role: ADMIN_ROLE_NAME,
            });

            const context = await controller.constructAuthorizationContext({
                recordKeyOrRecordName: recordName,
                userId: userId,
            });

            if (context.success === false) {
                throw new Error('Failed to construct authorization context.');
            }

            const result = await controller.authorizeSubjects(context.context, {
                subjects: [
                    {
                        subjectType: 'user',
                        subjectId: ownerId,
                    },
                    {
                        subjectType: 'inst',
                        subjectId: instId,
                    },
                ],
                resourceKind: resourceKind,
                action: action,
                resourceId: resourceId,
                markers: [marker],
            });

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                results: [
                    {
                        success: true,
                        recordName: recordName,
                        subjectType: 'user',
                        subjectId: ownerId,
                        permission: {
                            id: null,
                            recordName,
                            userId: null,

                            // The role that record owners recieve
                            subjectType: 'role',
                            subjectId: ADMIN_ROLE_NAME,

                            // resourceKind and action are null because this permission
                            // applies to all resources and actions.
                            resourceKind: null,
                            action: null,

                            marker: marker,
                            options: {},
                            expireTimeMs: null,
                        },
                        explanation: 'User is the owner of the record.',
                    },
                    {
                        success: true,
                        recordName: recordName,
                        subjectType: 'inst',
                        subjectId: instId,
                        permission: {
                            id: null,
                            recordName,
                            userId: null,
                            subjectType: 'role',
                            subjectId: ADMIN_ROLE_NAME,
                            resourceKind: null,
                            action: null,
                            marker: marker,
                            options: {},
                            expireTimeMs: null,
                        },
                        explanation: 'Inst is assigned the "admin" role.',
                    },
                ],
            });
        });
    });

    describe('authorizeUserAndInstancesForResources()', () => {
        const marker = 'marker';

        it('should be able to authorize a user and inst for a resource', async () => {
            await store.assignSubjectRole(recordName, '/myInst', 'inst', {
                expireTimeMs: null,
                role: ADMIN_ROLE_NAME,
            });

            const context = await controller.constructAuthorizationContext({
                recordKeyOrRecordName: recordName,
                userId: ownerId,
            });

            if (context.success === false) {
                throw new Error('Failed to construct authorization context.');
            }

            const result =
                await controller.authorizeUserAndInstancesForResources(
                    context.context,
                    {
                        userId: ownerId,
                        instances: ['/myInst'],
                        resources: [
                            {
                                resourceKind: 'data',
                                action: 'create',
                                resourceId: 'resourceId',
                                markers: [marker],
                            },
                            {
                                resourceKind: 'marker',
                                action: 'assign',
                                resourceId: marker,
                                markers: [ACCOUNT_MARKER],
                            },
                            {
                                resourceKind: 'data',
                                action: 'read',
                                resourceId: 'resourceId',
                                markers: [marker],
                            },
                        ],
                    }
                );

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                results: [
                    {
                        success: true,
                        recordName: recordName,
                        resourceKind: 'data',
                        resourceId: 'resourceId',
                        action: 'create',
                        markers: [marker],
                        user: {
                            success: true,
                            recordName,
                            subjectType: 'user',
                            subjectId: ownerId,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,
                                resourceKind: null,
                                action: null,
                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is the owner of the record.',
                        },
                        results: [
                            {
                                success: true,
                                recordName,
                                subjectType: 'user',
                                subjectId: ownerId,
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: marker,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: 'User is the owner of the record.',
                            },
                            {
                                success: true,
                                recordName,
                                subjectType: 'inst',
                                subjectId: '/myInst',
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: marker,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: `Inst is assigned the "${ADMIN_ROLE_NAME}" role.`,
                            },
                        ],
                    },
                    {
                        success: true,
                        recordName: recordName,
                        resourceKind: 'marker',
                        resourceId: marker,
                        action: 'assign',
                        markers: [ACCOUNT_MARKER],
                        user: {
                            success: true,
                            recordName,
                            subjectType: 'user',
                            subjectId: ownerId,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,
                                resourceKind: null,
                                action: null,
                                marker: ACCOUNT_MARKER,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is the owner of the record.',
                        },
                        results: [
                            {
                                success: true,
                                recordName,
                                subjectType: 'user',
                                subjectId: ownerId,
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: ACCOUNT_MARKER,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: 'User is the owner of the record.',
                            },
                            {
                                success: true,
                                recordName,
                                subjectType: 'inst',
                                subjectId: '/myInst',
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: ACCOUNT_MARKER,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: `Inst is assigned the "${ADMIN_ROLE_NAME}" role.`,
                            },
                        ],
                    },
                    {
                        success: true,
                        recordName: recordName,
                        resourceKind: 'data',
                        resourceId: 'resourceId',
                        action: 'read',
                        markers: [marker],
                        user: {
                            success: true,
                            recordName,
                            subjectType: 'user',
                            subjectId: ownerId,
                            permission: {
                                id: null,
                                recordName,
                                userId: null,
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,
                                resourceKind: null,
                                action: null,
                                marker: marker,
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: 'User is the owner of the record.',
                        },
                        results: [
                            {
                                success: true,
                                recordName,
                                subjectType: 'user',
                                subjectId: ownerId,
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: marker,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: 'User is the owner of the record.',
                            },
                            {
                                success: true,
                                recordName,
                                subjectType: 'inst',
                                subjectId: '/myInst',
                                permission: {
                                    id: null,
                                    recordName,
                                    userId: null,
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,
                                    resourceKind: null,
                                    action: null,
                                    marker: marker,
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation: `Inst is assigned the "${ADMIN_ROLE_NAME}" role.`,
                            },
                        ],
                    },
                ],
            });
        });

        it('should return not_authorized if one of the resources fails', async () => {
            // await store.assignSubjectRole(recordName, '/myInst', 'inst', {
            //     expireTimeMs: null,
            //     role: ADMIN_ROLE_NAME,
            // });

            await store.assignPermissionToSubjectAndResource(
                recordName,
                'inst',
                '/myInst',
                'data',
                'resourceId',
                null,
                {},
                null
            );

            const context = await controller.constructAuthorizationContext({
                recordKeyOrRecordName: recordName,
                userId: ownerId,
            });

            if (context.success === false) {
                throw new Error('Failed to construct authorization context.');
            }

            const result =
                await controller.authorizeUserAndInstancesForResources(
                    context.context,
                    {
                        userId: ownerId,
                        instances: ['/myInst'],
                        resources: [
                            {
                                resourceKind: 'data',
                                action: 'create',
                                resourceId: 'resourceId',
                                markers: [marker],
                            },
                            {
                                resourceKind: 'marker',
                                action: 'assign',
                                resourceId: marker,
                                markers: [ACCOUNT_MARKER],
                            },
                            {
                                resourceKind: 'data',
                                action: 'read',
                                resourceId: 'resourceId',
                                markers: [marker],
                            },
                        ],
                    }
                );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    subjectType: 'inst',
                    subjectId: '/myInst',
                    resourceKind: 'marker',
                    action: 'assign',
                    resourceId: marker,
                },
            });
        });
    });

    // Two ways to authorize access:
    // 1. By Marker
    //   - This is basically role based access control.
    //   - Resources have markers, which have policies, which grant permissions to roles.
    //   - This system allows us to grant default permissions.
    // 2. By Permission
    //   - This is basically one-off access control.
    //   - Users are granted permissions directly to resources - no markers involved.
    //   - This system allows users to easily manage permissions in an ad-hoc manner.

    // Each resource has an ID: '{resourceKind}/{resourceId}'
    // Examples:
    //  - 'data/address'
    //  - 'file/hash'
    //  - 'event/name'
    //  - 'inst/instId'
    //  - 'policy/policyId'
    //  - 'user/userId'
    //  - 'role/roleId'

    // Example permissions:
    // - subject: 'user/userId', resourceKind: 'data', resourceId: 'address', action: null -> grants all actions to 'data/address' for 'user/userId'
    // - subject: 'user/userId', resourceKind: 'data', marker: 'theMarker', action: null -> grants all actions to 'data#theMarker' for 'user/userId'
    // - subject: 'user/userId', resourceKind: 'file', marker: 'theMarker', action: null, options: { "maxFileSizeInBytes": 1000 } -> grants all actions to 'file#theMarker' for 'user/userId' with a max file size of 1000 bytes

    // Examples checks:
    // - subject: 'user/userId', resourceKind: 'data' resourceId: 'address', action: 'read' -> boolean
    // - subject: 'user/userId', resourceKind: 'data' resourceId: 'address', action: 'update' -> boolean
    // - subject: 'user/userId', resourceKind: 'marker' resourceId: 'theMarker', action: 'assign' -> boolean
    // - subject: 'user/userId', resourceKind: 'marker' resourceId: 'theMarker', action: 'revoke' -> boolean
    // - subject: 'user/userId', resourceKind: 'data', marker: 'theMarker', action: 'list' -> boolean

    // Actions describe the kinds of operations that can be performed on a resource.
    // For operations that are not resource specific, then permission has to be determined by the marker.
    // For example, a user cannot be granted permission to list a single resource, they must instead be granted permission to list all resources of a given marker.

    // getPermissionForSubjectAndResource(subjectType, subjectId, recordName, resourceKind, resourceId, action)
    // getPermissionForSubjectAndMarkers(subjectType, subjectId, recordName, resourceKind, markers, action)
    // assignPermissionToSubjectAndResource(subjectType, subjectId, recordName, resourceKind, resourceId, action, options)
    // assignPermissionToSubjectAndMarker(subjectType, subjectId, recordName, resourceKind, marker, action, options)
});

describe('explainationForPermissionAssignment()', () => {
    it('should return the explanation for a resource permission assignment', () => {
        const permissionAssignment: ResourcePermissionAssignment = {
            subjectType: 'user',
            subjectId: 'userId',
            resourceKind: 'data',
            action: 'read',
            id: 'permissionId',
            expireTimeMs: null,
            options: {},
            recordName: 'recordName',
            resourceId: 'resourceId',
            userId: 'userId',
        };

        expect(
            explainationForPermissionAssignment('user', permissionAssignment)
        ).toBe(
            'User was granted access to resource "resourceId" by "permissionId"'
        );
    });

    it('should return the explanation for a marker permission assignment', () => {
        const permissionAssignment: MarkerPermissionAssignment = {
            subjectType: 'user',
            subjectId: 'userId',
            resourceKind: 'data',
            action: 'read',
            id: 'permissionId',
            expireTimeMs: null,
            options: {},
            recordName: 'recordName',
            userId: 'userId',
            marker: 'marker',
        };

        expect(
            explainationForPermissionAssignment('user', permissionAssignment)
        ).toBe('User was granted access to marker "marker" by "permissionId"');
    });

    it('should return the explanation for a marker permission assignment that uses a role', () => {
        const permissionAssignment: MarkerPermissionAssignment = {
            subjectType: 'role',
            subjectId: 'roleId',
            resourceKind: 'data',
            action: 'read',
            id: 'permissionId',
            expireTimeMs: null,
            options: {},
            recordName: 'recordName',
            userId: 'userId',
            marker: 'marker',
        };

        expect(
            explainationForPermissionAssignment('user', permissionAssignment)
        ).toBe(
            'User was granted access to marker "marker" by "permissionId" using role "roleId"'
        );
    });
});

describe('willMarkersBeRemaining()', () => {
    it('should return true if no markers are being removed', () => {
        const existing = ['first', 'second'];
        const removed = [] as string[];
        const added = [] as string[];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });

    it('should return false if all markers are being removed', () => {
        const existing = ['first', 'second'];
        const removed = ['second', 'first'];
        const added = [] as string[];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(false);
    });

    it('should return true if all markers are being replaced', () => {
        const existing = ['first', 'second'];
        const removed = ['first', 'second'];
        const added = ['third'];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });

    it('should return true if only adding markers', () => {
        const existing = ['first', 'second'];
        const removed = [] as string[];
        const added = ['third'];
        expect(willMarkersBeRemaining(existing, removed, added)).toBe(true);
    });
});
