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
import type {
    ListedSharedPermissions,
    SharedPermission,
    SharedPermissionStatus,
    SharedPermissionsStore,
} from '@casual-simulation/aux-records';
import { SHARED_PERMISSIONS_PAGE_SIZE } from '@casual-simulation/aux-records';
import type { SharedMarkerPermission } from '@casual-simulation/aux-common';
import type {
    PrismaClient,
    Prisma,
    SharedPermission as PrismaSharedPermission,
} from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqliteSharedPermissionsStore';

/**
 * Implements SharedPermissionsStore for Prisma (SQLite).
 */
export class SqliteSharedPermissionsStore implements SharedPermissionsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async saveSharedPermission(
        sharedPermission: SharedPermission
    ): Promise<void> {
        await this._client.sharedPermission.upsert({
            where: {
                id: sharedPermission.id,
            },
            create: {
                id: sharedPermission.id,
                recordName: sharedPermission.recordName,
                requestingUserId: sharedPermission.requestingUserId,
                targetUserId: sharedPermission.targetUserId,
                permission:
                    sharedPermission.permission as unknown as Prisma.InputJsonValue,
                status: sharedPermission.status,
                createdAt: sharedPermission.createdAtMs,
                updatedAt: sharedPermission.updatedAtMs,
                expireTime: sharedPermission.expireTimeMs,
                recipientRecordName: sharedPermission.recipientRecordName,
                recipientUserId: sharedPermission.recipientUserId,
                requestingPermissionAssignmentId:
                    sharedPermission.requestingPermissionAssignmentId,
                recipientPermissionAssignmentId:
                    sharedPermission.recipientPermissionAssignmentId,
            },
            update: {
                recordName: sharedPermission.recordName,
                requestingUserId: sharedPermission.requestingUserId,
                targetUserId: sharedPermission.targetUserId,
                permission:
                    sharedPermission.permission as unknown as Prisma.InputJsonValue,
                status: sharedPermission.status,
                updatedAt: sharedPermission.updatedAtMs,
                expireTime: sharedPermission.expireTimeMs,
                recipientRecordName: sharedPermission.recipientRecordName,
                recipientUserId: sharedPermission.recipientUserId,
                requestingPermissionAssignmentId:
                    sharedPermission.requestingPermissionAssignmentId,
                recipientPermissionAssignmentId:
                    sharedPermission.recipientPermissionAssignmentId,
            },
        });
    }

    @traced(TRACE_NAME)
    async findSharedPermissionById(
        id: string
    ): Promise<SharedPermission | null> {
        const p = await this._client.sharedPermission.findUnique({
            where: { id },
        });
        return this._convert(p);
    }

    @traced(TRACE_NAME)
    async listSharedPermissionsForUser(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions> {
        return this._listAndCount(
            {
                OR: [
                    { requestingUserId: userId },
                    { targetUserId: userId },
                    { recipientUserId: userId },
                ],
            },
            page
        );
    }

    @traced(TRACE_NAME)
    async listSharedPermissionsForUserByStatus(
        userId: string,
        status: SharedPermissionStatus,
        page?: number | null
    ): Promise<ListedSharedPermissions> {
        return this._listAndCount(
            {
                status,
                OR: [
                    { requestingUserId: userId },
                    { targetUserId: userId },
                    { recipientUserId: userId },
                ],
            },
            page
        );
    }

    @traced(TRACE_NAME)
    async listSentSharedPermissions(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions> {
        return this._listAndCount(
            {
                requestingUserId: userId,
            },
            page
        );
    }

    @traced(TRACE_NAME)
    async listRequestedSharedPermissions(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions> {
        return this._listAndCount(
            {
                targetUserId: userId,
            },
            page
        );
    }

    private async _listAndCount(
        where: Prisma.SharedPermissionWhereInput,
        page?: number | null
    ): Promise<ListedSharedPermissions> {
        const pageNumber = page && page > 0 ? page : 0;
        const [items, totalCount] = await Promise.all([
            this._client.sharedPermission.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pageNumber * SHARED_PERMISSIONS_PAGE_SIZE,
                take: SHARED_PERMISSIONS_PAGE_SIZE,
            }),
            this._client.sharedPermission.count({ where }),
        ]);

        return {
            sharedPermissions: items.map((i) => this._convert(i)),
            totalCount,
        };
    }

    private _convert(p: PrismaSharedPermission): SharedPermission {
        if (!p) {
            return null;
        }
        return {
            id: p.id,
            recordName: p.recordName,
            requestingUserId: p.requestingUserId,
            targetUserId: p.targetUserId,
            permission: p.permission as unknown as SharedMarkerPermission,
            status: p.status as SharedPermissionStatus,
            createdAtMs: p.createdAt?.toNumber(),
            updatedAtMs: p.updatedAt?.toNumber(),
            expireTimeMs: p.expireTime?.toNumber() ?? null,
            recipientRecordName: p.recipientRecordName,
            recipientUserId: p.recipientUserId,
            requestingPermissionAssignmentId:
                p.requestingPermissionAssignmentId,
            recipientPermissionAssignmentId: p.recipientPermissionAssignmentId,
        };
    }
}
