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
import type { MemoryStore } from './MemoryStore';
import type { RequestSharedPermissionSuccess } from './SharedPermissionsController';
import type { SharedPermissionsController } from './SharedPermissionsController';
import type { TestServices } from './TestUtils';
import { createTestControllers, createTestRecordKey } from './TestUtils';
import type { SharedMarkerPermission } from '@casual-simulation/aux-common';

console.log = jest.fn();
console.error = jest.fn();

describe('SharedPermissionsController', () => {
    let store: MemoryStore;
    let controller: SharedPermissionsController;
    let services: TestServices;

    const userA = 'userA';
    const userB = 'userB';
    const userC = 'userC';
    let recordA: string;
    let recordB: string;

    const permission: SharedMarkerPermission = {
        marker: 'testMarker',
        resourceKind: 'data',
        action: 'read',
        options: {},
        expireTimeMs: null,
    };

    beforeEach(async () => {
        services = createTestControllers();
        store = services.store;
        controller = services.sharedPermissions;

        for (const id of [userA, userB, userC]) {
            await services.authStore.saveNewUser({
                id,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: `${id}@example.com`,
                phoneNumber: null,
            });
        }

        const a = await createTestRecordKey(services, userA, 'recordA');
        recordA = a.recordName;
        const b = await createTestRecordKey(services, userB, 'recordB');
        recordB = b.recordName;
    });

    async function requestPermission(
        targetUserId?: string | null,
        expireTimeMs?: number | null
    ) {
        const result = (await controller.requestSharedPermission({
            userId: userA,
            recordName: recordA,
            permission,
            targetUserId,
            expireTimeMs,
        })) as RequestSharedPermissionSuccess;
        return result.sharedPermissionId;
    }

    describe('requestSharedPermission()', () => {
        it('should create a shared permission request when the user is an admin of the record', async () => {
            const result = await controller.requestSharedPermission({
                userId: userA,
                recordName: recordA,
                permission,
            });

            expect(result).toEqual({
                success: true,
                sharedPermissionId: expect.any(String),
            });

            const id = (result as RequestSharedPermissionSuccess)
                .sharedPermissionId;
            const sp = await store.findSharedPermissionById(id);
            expect(sp).toMatchObject({
                id,
                recordName: recordA,
                requestingUserId: userA,
                targetUserId: null,
                status: 'requested',
                permission,
                recipientRecordName: null,
                recipientUserId: null,
            });
            expect(sp.expireTimeMs).toBeGreaterThan(Date.now());
        });

        it('should support requesting from a specific target user', async () => {
            const result = await controller.requestSharedPermission({
                userId: userA,
                recordName: recordA,
                permission,
                targetUserId: userB,
            });

            expect(result.success).toBe(true);
            const id = (result as RequestSharedPermissionSuccess)
                .sharedPermissionId;
            const sp = await store.findSharedPermissionById(id);
            expect(sp.targetUserId).toBe(userB);
        });

        it('should use the given expireTimeMs', async () => {
            const expireTimeMs = Date.now() + 1000 * 60;
            const result = await controller.requestSharedPermission({
                userId: userA,
                recordName: recordA,
                permission,
                expireTimeMs,
            });

            const id = (result as RequestSharedPermissionSuccess)
                .sharedPermissionId;
            const sp = await store.findSharedPermissionById(id);
            expect(sp.expireTimeMs).toBe(expireTimeMs);
        });

        it('should fail if the given expireTimeMs is in the past', async () => {
            const result = await controller.requestSharedPermission({
                userId: userA,
                recordName: recordA,
                permission,
                expireTimeMs: Date.now() - 1000,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('unacceptable_expire_time');
        });

        it('should fail if the user is not an admin of the record', async () => {
            const result = await controller.requestSharedPermission({
                userId: userC,
                recordName: recordA,
                permission,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
        });
    });

    describe('acceptSharedPermission()', () => {
        it('should grant the permission to both records when accepted', async () => {
            const sharedPermissionId = await requestPermission();

            const result = await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result).toEqual({ success: true });

            const sp = await store.findSharedPermissionById(sharedPermissionId);
            expect(sp.status).toBe('accepted');
            expect(sp.expireTimeMs).toBeNull();
            expect(sp.recipientRecordName).toBe(recordB);
            expect(sp.recipientUserId).toBe(userB);
            expect(sp.requestingPermissionAssignmentId).toEqual(
                expect.any(String)
            );
            expect(sp.recipientPermissionAssignmentId).toEqual(
                expect.any(String)
            );

            const permsInA = await store.listPermissionsInRecord(recordA);
            expect(permsInA.success).toBe(true);
            expect(
                (permsInA as any).markerAssignments.some(
                    (a: any) =>
                        a.subjectType === 'user' &&
                        a.subjectId === userB &&
                        a.marker === 'testMarker'
                )
            ).toBe(true);

            const permsInB = await store.listPermissionsInRecord(recordB);
            expect(permsInB.success).toBe(true);
            expect(
                (permsInB as any).markerAssignments.some(
                    (a: any) =>
                        a.subjectType === 'user' &&
                        a.subjectId === userA &&
                        a.marker === 'testMarker'
                )
            ).toBe(true);
        });

        it('should do nothing if already accepted', async () => {
            const sharedPermissionId = await requestPermission();
            await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            const result = await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result).toEqual({ success: true });
        });

        it('should fail if the shared permission does not exist', async () => {
            const result = await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId: 'missing',
                recordName: recordB,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should fail if the shared permission has expired', async () => {
            const sharedPermissionId = await requestPermission(
                null,
                Date.now() + 10
            );

            await new Promise((resolve) => setTimeout(resolve, 20));

            const result = await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'shared_permission_expired',
                errorMessage: expect.any(String),
            });
        });

        it('should fail if a different user tries to accept a targeted request', async () => {
            const sharedPermissionId = await requestPermission(userB);

            const result = await controller.acceptSharedPermission({
                userId: userC,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
        });

        it('should fail if the accepting user is not an admin of the given record', async () => {
            const sharedPermissionId = await requestPermission();

            const result = await controller.acceptSharedPermission({
                userId: userC,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
        });

        it('should fail if the shared permission was already rejected', async () => {
            const sharedPermissionId = await requestPermission(userB);
            await controller.rejectSharedPermission({
                userId: userB,
                sharedPermissionId,
            });

            const result = await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('invalid_request');
        });
    });

    describe('rejectSharedPermission()', () => {
        it('should reject a request that was targeted at a specific user', async () => {
            const sharedPermissionId = await requestPermission(userB);

            const result = await controller.rejectSharedPermission({
                userId: userB,
                sharedPermissionId,
            });

            expect(result).toEqual({ success: true });

            const sp = await store.findSharedPermissionById(sharedPermissionId);
            expect(sp.status).toBe('rejected');
        });

        it('should fail for an open (non-targeted) request', async () => {
            const sharedPermissionId = await requestPermission();

            const result = await controller.rejectSharedPermission({
                userId: userB,
                sharedPermissionId,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('action_not_supported');
        });

        it('should fail if a different user tries to reject', async () => {
            const sharedPermissionId = await requestPermission(userB);

            const result = await controller.rejectSharedPermission({
                userId: userC,
                sharedPermissionId,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
        });

        it('should fail if the shared permission does not exist', async () => {
            const result = await controller.rejectSharedPermission({
                userId: userB,
                sharedPermissionId: 'missing',
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_found');
        });
    });

    describe('revokeSharedPermission()', () => {
        it('should allow the requesting user to revoke a pending request', async () => {
            const sharedPermissionId = await requestPermission();

            const result = await controller.revokeSharedPermission({
                userId: userA,
                sharedPermissionId,
            });

            expect(result).toEqual({ success: true });
            const sp = await store.findSharedPermissionById(sharedPermissionId);
            expect(sp.status).toBe('revoked');
        });

        it('should allow either party to revoke an accepted shared permission and remove the granted permissions', async () => {
            const sharedPermissionId = await requestPermission();
            await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            const result = await controller.revokeSharedPermission({
                userId: userB,
                sharedPermissionId,
            });

            expect(result).toEqual({ success: true });

            const sp = await store.findSharedPermissionById(sharedPermissionId);
            expect(sp.status).toBe('revoked');

            const permsInA = await store.listPermissionsInRecord(recordA);
            expect(
                (permsInA as any).markerAssignments.some(
                    (a: any) => a.subjectId === userB
                )
            ).toBe(false);

            const permsInB = await store.listPermissionsInRecord(recordB);
            expect(
                (permsInB as any).markerAssignments.some(
                    (a: any) => a.subjectId === userA
                )
            ).toBe(false);
        });

        it('should fail if an unrelated user tries to revoke', async () => {
            const sharedPermissionId = await requestPermission();
            await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId,
                recordName: recordB,
            });

            const result = await controller.revokeSharedPermission({
                userId: userC,
                sharedPermissionId,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
        });

        it('should fail if the shared permission was already revoked', async () => {
            const sharedPermissionId = await requestPermission();
            await controller.revokeSharedPermission({
                userId: userA,
                sharedPermissionId,
            });

            const result = await controller.revokeSharedPermission({
                userId: userA,
                sharedPermissionId,
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('invalid_request');
        });

        it('should fail if the shared permission does not exist', async () => {
            const result = await controller.revokeSharedPermission({
                userId: userA,
                sharedPermissionId: 'missing',
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_found');
        });
    });

    describe('listing', () => {
        let requestedId: string;
        let targetedId: string;
        let acceptedId: string;

        beforeEach(async () => {
            requestedId = await requestPermission();
            targetedId = await requestPermission(userB);
            acceptedId = await requestPermission();
            await controller.acceptSharedPermission({
                userId: userB,
                sharedPermissionId: acceptedId,
                recordName: recordB,
            });
        });

        it('listSharedPermissions() should return every shared permission the user is a party to', async () => {
            const result = await controller.listSharedPermissions({
                userId: userA,
            });

            expect(result.success).toBe(true);
            const ids = (result as any).sharedPermissions.map((p: any) => p.id);
            expect(ids).toEqual(
                expect.arrayContaining([requestedId, targetedId, acceptedId])
            );
        });

        it('listSharedPermissionsByStatus() should filter by status', async () => {
            const result = await controller.listSharedPermissionsByStatus({
                userId: userA,
                status: 'accepted',
            });

            expect(result.success).toBe(true);
            const ids = (result as any).sharedPermissions.map((p: any) => p.id);
            expect(ids).toEqual([acceptedId]);
        });

        it('listSentSharedPermissions() should return permissions requested by the user', async () => {
            const result = await controller.listSentSharedPermissions({
                userId: userA,
            });

            expect(result.success).toBe(true);
            const ids = (result as any).sharedPermissions.map((p: any) => p.id);
            expect(ids).toEqual(
                expect.arrayContaining([requestedId, targetedId, acceptedId])
            );
        });

        it('listRequestedSharedPermissions() should return permissions targeted at the user', async () => {
            const result = await controller.listRequestedSharedPermissions({
                userId: userB,
            });

            expect(result.success).toBe(true);
            const ids = (result as any).sharedPermissions.map((p: any) => p.id);
            expect(ids).toEqual([targetedId]);
        });
    });
});
