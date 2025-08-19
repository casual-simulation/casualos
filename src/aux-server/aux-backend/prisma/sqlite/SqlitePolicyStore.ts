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
    AssignPermissionToSubjectAndMarkerResult,
    AssignPermissionToSubjectAndResourceResult,
    AssignedRole,
    DeletePermissionAssignmentResult,
    GetMarkerPermissionResult,
    GetResourcePermissionResult,
    GrantedPackageEntitlement,
    ListPermissionsInRecordResult,
    ListedRoleAssignments,
    MarkerPermissionAssignment,
    PolicyStore,
    ResourcePermissionAssignment,
    UpdateUserRolesResult,
    UserPrivacyFeatures,
} from '@casual-simulation/aux-records';
import { getExpireTime } from '@casual-simulation/aux-records';
import type {
    PrismaClient,
    GrantedPackageEntitlement as PrismaGrantedPackageEntitlement,
} from '../generated-sqlite';
import { Prisma } from '../generated-sqlite';
import { convertToDate, convertToMillis } from '../Utils';
import type {
    ActionKinds,
    Entitlement,
    EntitlementFeature,
    GrantedEntitlementScope,
    PermissionOptions,
    PrivacyFeatures,
    ResourceKinds,
    SubjectType,
    UserRole,
} from '@casual-simulation/aux-common';

import { v4 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqlitePolicyStore';

/**
 * Implements PolicyStore for Prisma.
 */
export class SqlitePolicyStore implements PolicyStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async listGrantedEntitlementsByFeatureAndUserId(
        packageIds: string[],
        feature: Entitlement['feature'],
        userId: string,
        recordName: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        const entitlements =
            await this._client.grantedPackageEntitlement.findMany({
                where: {
                    userId,
                    feature,
                    recordName,
                    expireTime: { gt: convertToDate(nowMs) },
                    revokeTime: { equals: null },
                    packageId: {
                        in: packageIds,
                    },
                },
            });

        return entitlements.map((e) => this._convertEntitlement(e));
    }

    @traced(TRACE_NAME)
    async saveGrantedPackageEntitlement(
        grantedEntitlement: GrantedPackageEntitlement
    ): Promise<void> {
        await this._client.grantedPackageEntitlement.upsert({
            where: {
                id: grantedEntitlement.id,
            },
            create: {
                id: grantedEntitlement.id,
                packageId: grantedEntitlement.packageId,
                feature: grantedEntitlement.feature,
                scope: grantedEntitlement.scope as GrantedEntitlementScope,
                userId: grantedEntitlement.userId,
                recordName: grantedEntitlement.recordName,
                expireTime: convertToDate(grantedEntitlement.expireTimeMs),
                revokeTime: convertToDate(grantedEntitlement.revokeTimeMs),
                createdAt: convertToDate(grantedEntitlement.createdAtMs),
            },
            update: {
                packageId: grantedEntitlement.packageId,
                feature: grantedEntitlement.feature,
                scope: grantedEntitlement.scope as GrantedEntitlementScope,
                userId: grantedEntitlement.userId,
                recordName: grantedEntitlement.recordName,
                expireTime: convertToDate(grantedEntitlement.expireTimeMs),
                revokeTime: convertToDate(grantedEntitlement.revokeTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async findGrantedPackageEntitlementByUserIdPackageIdFeatureAndScope(
        userId: string,
        packageId: string,
        feature: EntitlementFeature,
        scope: GrantedEntitlementScope,
        recordName: string
    ): Promise<GrantedPackageEntitlement | null> {
        const e = await this._client.grantedPackageEntitlement.findFirst({
            where: {
                userId,
                packageId,
                feature,
                scope,
                revokeTime: { equals: null },
                recordName,
            },
        });

        return this._convertEntitlement(e);
    }

    @traced(TRACE_NAME)
    async findGrantedPackageEntitlementById(
        id: string
    ): Promise<GrantedPackageEntitlement | null> {
        const e = await this._client.grantedPackageEntitlement.findUnique({
            where: {
                id,
            },
        });
        return this._convertEntitlement(e);
    }

    @traced(TRACE_NAME)
    async listGrantedEntitlementsForUser(
        userId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        const entitlements =
            await this._client.grantedPackageEntitlement.findMany({
                where: {
                    userId,
                    expireTime: { gt: convertToDate(nowMs) },
                    revokeTime: { equals: null },
                },
            });

        return entitlements.map((e) => this._convertEntitlement(e));
    }

    @traced(TRACE_NAME)
    async listGrantedEntitlementsForUserAndPackage(
        userId: string,
        packageId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        const entitlements =
            await this._client.grantedPackageEntitlement.findMany({
                where: {
                    userId,
                    packageId,
                    expireTime: { gt: convertToDate(nowMs) },
                    revokeTime: { equals: null },
                },
            });

        return entitlements.map((e) => this._convertEntitlement(e));
    }

    private _convertEntitlement(
        e: PrismaGrantedPackageEntitlement
    ): GrantedPackageEntitlement {
        if (!e) {
            return null;
        }
        return {
            id: e.id,
            packageId: e.packageId,
            feature: e.feature as EntitlementFeature,
            scope: e.scope as GrantedEntitlementScope,
            userId: e.userId,
            recordName: e.recordName,
            expireTimeMs: convertToMillis(e.expireTime),
            revokeTimeMs: convertToMillis(e.revokeTime),
            createdAtMs: convertToMillis(e.createdAt),
        };
    }

    @traced(TRACE_NAME)
    async getUserPrivacyFeatures(userId: string): Promise<UserPrivacyFeatures> {
        const user = await this._client.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                allowAI: true,
                allowPublicData: true,
                allowPublicInsts: true,
                allowPublishData: true,
                role: true,
            },
        });

        if (user) {
            return {
                publishData: user.allowPublishData ?? true,
                allowPublicData: user.allowPublicData ?? true,
                allowAI: user.allowAI ?? true,
                allowPublicInsts: user.allowPublicInsts ?? true,
                userRole: user.role as UserRole,
            };
        }

        return null;
    }

    @traced(TRACE_NAME)
    async getRecordOwnerPrivacyFeatures(
        recordName: string
    ): Promise<PrivacyFeatures> {
        const recordOwner = await this._client.record.findUnique({
            where: {
                name: recordName,
            },
            select: {
                owner: {
                    select: {
                        allowAI: true,
                        allowPublicData: true,
                        allowPublicInsts: true,
                        allowPublishData: true,
                    },
                },
            },
        });

        if (recordOwner?.owner) {
            return {
                publishData: recordOwner.owner.allowPublishData ?? true,
                allowPublicData: recordOwner.owner.allowPublicData ?? true,
                allowAI: recordOwner.owner.allowAI ?? true,
                allowPublicInsts: recordOwner.owner.allowPublicInsts ?? true,
            };
        }

        return null;
    }

    @traced(TRACE_NAME)
    async getPermissionForSubjectAndResource(
        subjectType: SubjectType,
        subjectId: string,
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string,
        action: ActionKinds,
        currentTimeMs: number
    ): Promise<GetResourcePermissionResult> {
        // prettier-ignore
        const result = await this._client.$queryRaw<ResourcePermission[]>`SELECT "id", "recordName", "resourceKind", "resourceId", "action", "options", "subjectId", "subjectType", "userId", "expireTime" FROM public."ResourcePermissionAssignment"
            WHERE "recordName" = ${recordName}
            AND "resourceKind" = ${resourceKind} 
            AND "resourceId" = ${resourceId} 
            AND ("action" IS NULL OR "action" = ${action})
            AND ("expireTime" IS NULL OR "expireTime" > ${convertToDate(
                currentTimeMs
            )})
            AND (
                ("subjectId" = ${subjectId} AND "subjectType" = ${subjectType}) OR
                ("subjectType" = 'role' AND "subjectId" IN (SELECT "roleId" FROM "RoleAssignment" WHERE "recordName" = ${recordName} AND "subjectId" = ${subjectId} AND "subjectType" = ${subjectType})))
            LIMIT 1;`;

        if (result.length <= 0) {
            return {
                success: true,
                permissionAssignment: null,
            };
        }

        const first = result[0];
        return {
            success: true,
            permissionAssignment: {
                id: first.id,
                recordName: first.recordName,
                resourceKind: first.resourceKind,
                resourceId: first.resourceId,
                action: first.action,
                options: first.options,
                subjectId: first.subjectId,
                subjectType: first.subjectType,
                userId: first.userId,
                expireTimeMs: convertToMillis(first.expireTime),
            },
        };
    }

    @traced(TRACE_NAME)
    async getPermissionForSubjectAndMarkers(
        subjectType: SubjectType,
        subjectId: string,
        recordName: string,
        resourceKind: ResourceKinds,
        markers: string[],
        action: ActionKinds,
        currentTimeMs: number
    ): Promise<GetMarkerPermissionResult> {
        // prettier-ignore
        const result = await this._client.$queryRaw<MarkerPermission[]>`SELECT "id", "recordName", "resourceKind", "marker", "action", "options", "subjectId", "subjectType", "userId", "expireTime" FROM public."MarkerPermissionAssignment"
            WHERE "recordName" = ${recordName}
            AND ("resourceKind" IS NULL OR "resourceKind" = ${resourceKind})
            AND "marker" IN (${Prisma.join(markers)})
            AND ("action" IS NULL OR "action" = ${action})
            AND ("expireTime" IS NULL OR "expireTime" > ${convertToDate(
                currentTimeMs
            )})
            AND (
                ("subjectId" = ${subjectId} AND "subjectType" = ${subjectType}) OR
                ("subjectType" = 'role' AND "subjectId" IN (SELECT "roleId" FROM "RoleAssignment" WHERE "recordName" = ${recordName} AND "subjectId" = ${subjectId} AND "subjectType" = ${subjectType})))
            LIMIT 1;`;

        if (result.length <= 0) {
            return {
                success: true,
                permissionAssignment: null,
            };
        }

        const first = result[0];
        return {
            success: true,
            permissionAssignment: {
                id: first.id,
                recordName: first.recordName,
                resourceKind: first.resourceKind,
                marker: first.marker,
                action: first.action,
                options: first.options,
                subjectId: first.subjectId,
                subjectType: first.subjectType,
                userId: first.userId,
                expireTimeMs: convertToMillis(first.expireTime),
            },
        };
    }

    @traced(TRACE_NAME)
    async assignPermissionToSubjectAndResource(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string,
        resourceKind: ResourceKinds,
        resourceId: string,
        action: ActionKinds,
        options: PermissionOptions,
        expireTimeMs: number
    ): Promise<AssignPermissionToSubjectAndResourceResult> {
        const existingAssignment =
            await this._client.resourcePermissionAssignment.findFirst({
                where: {
                    recordName,
                    subjectType,
                    subjectId,
                    resourceKind,
                    resourceId,
                    action,
                    expireTime: convertToDate(expireTimeMs),
                },
            });

        if (existingAssignment) {
            return {
                success: false,
                errorCode: 'permission_already_exists',
                errorMessage: 'The permission already exists.',
            };
        }

        const result = await this._client.resourcePermissionAssignment.create({
            data: {
                id: uuid(),
                recordName: recordName,
                resourceKind: resourceKind,
                resourceId: resourceId,
                action: action,
                options: options as object,
                subjectId: subjectId,
                subjectType: subjectType,
                userId: subjectType === 'user' ? subjectId : null,
                expireTime: convertToDate(expireTimeMs),
            },
        });

        return {
            success: true,
            permissionAssignment: {
                id: result.id,
                recordName: result.recordName,
                resourceKind: result.resourceKind as ResourceKinds,
                resourceId: result.resourceId,
                action: result.action as ActionKinds,
                options: result.options as PermissionOptions,
                subjectId: result.subjectId,
                subjectType: result.subjectType as SubjectType,
                userId: result.userId,
                expireTimeMs: convertToMillis(result.expireTime),
            },
        };
    }

    @traced(TRACE_NAME)
    async assignPermissionToSubjectAndMarker(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string,
        resourceKind: ResourceKinds,
        marker: string,
        action: ActionKinds,
        options: PermissionOptions,
        expireTimeMs: number
    ): Promise<AssignPermissionToSubjectAndMarkerResult> {
        const existingAssignment =
            await this._client.markerPermissionAssignment.findFirst({
                where: {
                    recordName,
                    subjectType,
                    subjectId,
                    resourceKind,
                    marker,
                    action,
                    expireTime: convertToDate(expireTimeMs),
                },
            });

        if (existingAssignment) {
            return {
                success: false,
                errorCode: 'permission_already_exists',
                errorMessage: 'The permission already exists.',
            };
        }

        const result = await this._client.markerPermissionAssignment.create({
            data: {
                id: uuid(),
                recordName: recordName,
                resourceKind: resourceKind,
                marker,
                action: action,
                options: options as object,
                subjectId: subjectId,
                subjectType: subjectType,
                userId: subjectType === 'user' ? subjectId : null,
                expireTime: convertToDate(expireTimeMs),
            },
        });

        return {
            success: true,
            permissionAssignment: {
                id: result.id,
                recordName: result.recordName,
                resourceKind: result.resourceKind as ResourceKinds,
                marker: result.marker,
                action: result.action as ActionKinds,
                options: result.options as PermissionOptions,
                subjectId: result.subjectId,
                subjectType: result.subjectType as SubjectType,
                userId: result.userId,
                expireTimeMs: convertToMillis(result.expireTime),
            },
        };
    }

    @traced(TRACE_NAME)
    async deleteResourcePermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        await this._client.resourcePermissionAssignment.delete({
            where: {
                id,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async deleteMarkerPermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        await this._client.markerPermissionAssignment.delete({
            where: {
                id,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async listPermissionsInRecord(
        recordName: string
    ): Promise<ListPermissionsInRecordResult> {
        const resourcePermissions =
            await this._client.resourcePermissionAssignment.findMany({
                where: {
                    recordName,
                },
            });

        const markerPermissions =
            await this._client.markerPermissionAssignment.findMany({
                where: {
                    recordName,
                },
            });

        return {
            success: true,
            resourceAssignments: resourcePermissions.map((p) => ({
                id: p.id,
                recordName: p.recordName,
                resourceKind: p.resourceKind as ResourceKinds,
                resourceId: p.resourceId,
                action: p.action as ActionKinds,
                options: p.options as PermissionOptions,
                subjectId: p.subjectId,
                subjectType: p.subjectType as SubjectType,
                userId: p.userId,
                expireTimeMs: convertToMillis(p.expireTime),
            })),
            markerAssignments: markerPermissions.map((p) => ({
                id: p.id,
                recordName: p.recordName,
                resourceKind: p.resourceKind as ResourceKinds,
                marker: p.marker,
                action: p.action as ActionKinds,
                options: p.options as PermissionOptions,
                subjectId: p.subjectId,
                subjectType: p.subjectType as SubjectType,
                userId: p.userId,
                expireTimeMs: convertToMillis(p.expireTime),
            })),
        };
    }

    @traced(TRACE_NAME)
    async listPermissionsForResource(
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string
    ): Promise<ResourcePermissionAssignment[]> {
        const resourcePermissions =
            await this._client.resourcePermissionAssignment.findMany({
                where: {
                    recordName,
                    resourceKind,
                    resourceId,
                },
            });

        return resourcePermissions.map((p) => ({
            id: p.id,
            recordName: p.recordName,
            resourceKind: p.resourceKind as ResourceKinds,
            resourceId: p.resourceId,
            action: p.action as ActionKinds,
            options: p.options as PermissionOptions,
            subjectId: p.subjectId,
            subjectType: p.subjectType as SubjectType,
            userId: p.userId,
            expireTimeMs: convertToMillis(p.expireTime),
        }));
    }

    @traced(TRACE_NAME)
    async listPermissionsForMarker(
        recordName: string,
        marker: string
    ): Promise<MarkerPermissionAssignment[]> {
        const markerPermissions =
            await this._client.markerPermissionAssignment.findMany({
                where: {
                    recordName,
                    marker,
                },
            });

        return markerPermissions.map((p) => ({
            id: p.id,
            recordName: p.recordName,
            resourceKind: p.resourceKind as ResourceKinds,
            marker: p.marker,
            action: p.action as ActionKinds,
            options: p.options as PermissionOptions,
            subjectId: p.subjectId,
            subjectType: p.subjectType as SubjectType,
            userId: p.userId,
            expireTimeMs: convertToMillis(p.expireTime),
        }));
    }

    @traced(TRACE_NAME)
    async listPermissionsForSubject(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string
    ): Promise<ListPermissionsInRecordResult> {
        const resourcePermissions =
            await this._client.resourcePermissionAssignment.findMany({
                where: {
                    recordName,
                    subjectType,
                    subjectId,
                },
            });

        const markerPermissions =
            await this._client.markerPermissionAssignment.findMany({
                where: {
                    recordName,
                    subjectType,
                    subjectId,
                },
            });

        return {
            success: true,
            resourceAssignments: resourcePermissions.map((p) => ({
                id: p.id,
                recordName: p.recordName,
                resourceKind: p.resourceKind as ResourceKinds,
                resourceId: p.resourceId,
                action: p.action as ActionKinds,
                options: p.options as PermissionOptions,
                subjectId: p.subjectId,
                subjectType: p.subjectType as SubjectType,
                userId: p.userId,
                expireTimeMs: convertToMillis(p.expireTime),
            })),
            markerAssignments: markerPermissions.map((p) => ({
                id: p.id,
                recordName: p.recordName,
                resourceKind: p.resourceKind as ResourceKinds,
                marker: p.marker,
                action: p.action as ActionKinds,
                options: p.options as PermissionOptions,
                subjectId: p.subjectId,
                subjectType: p.subjectType as SubjectType,
                userId: p.userId,
                expireTimeMs: convertToMillis(p.expireTime),
            })),
        };
    }

    @traced(TRACE_NAME)
    async getMarkerPermissionAssignmentById(
        id: string
    ): Promise<MarkerPermissionAssignment> {
        const result = await this._client.markerPermissionAssignment.findUnique(
            {
                where: {
                    id,
                },
            }
        );

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            recordName: result.recordName,
            resourceKind: result.resourceKind as ResourceKinds,
            marker: result.marker,
            action: result.action as ActionKinds,
            options: result.options as PermissionOptions,
            subjectId: result.subjectId,
            subjectType: result.subjectType as SubjectType,
            userId: result.userId,
            expireTimeMs: convertToMillis(result.expireTime),
        };
    }

    @traced(TRACE_NAME)
    async getResourcePermissionAssignmentById(
        id: string
    ): Promise<ResourcePermissionAssignment> {
        const result =
            await this._client.resourcePermissionAssignment.findUnique({
                where: {
                    id,
                },
            });

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            recordName: result.recordName,
            resourceKind: result.resourceKind as ResourceKinds,
            resourceId: result.resourceId,
            action: result.action as ActionKinds,
            options: result.options as PermissionOptions,
            subjectId: result.subjectId,
            subjectType: result.subjectType as SubjectType,
            userId: result.userId,
            expireTimeMs: convertToMillis(result.expireTime),
        };
    }

    @traced(TRACE_NAME)
    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        const now = new Date();
        const assignments = await this._client.roleAssignment.findMany({
            where: {
                recordName: recordName,
                type: 'user',
                userId: userId,
                OR: [
                    {
                        expireTime: {
                            gt: now,
                        },
                    },
                    {
                        expireTime: {
                            equals: null,
                        },
                    },
                ],
            },
        });

        return assignments.map(
            (r) =>
                ({
                    role: r.roleId,
                    expireTimeMs: getExpireTime(convertToMillis(r.expireTime)),
                } as AssignedRole)
        );
    }

    @traced(TRACE_NAME)
    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        const now = new Date();
        const assignments = await this._client.roleAssignment.findMany({
            where: {
                recordName: recordName,
                type: 'inst',
                subjectId: inst,
                OR: [
                    {
                        expireTime: {
                            gt: now,
                        },
                    },
                    {
                        expireTime: {
                            equals: null,
                        },
                    },
                ],
            },
        });

        return assignments.map(
            (r) =>
                ({
                    role: r.roleId,
                    expireTimeMs: getExpireTime(convertToMillis(r.expireTime)),
                } as AssignedRole)
        );
    }

    @traced(TRACE_NAME)
    async listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        const now = new Date();
        const assignments = await this._client.roleAssignment.findMany({
            where: {
                recordName: recordName,
                roleId: role,
                OR: [
                    {
                        expireTime: {
                            gt: now,
                        },
                    },
                    {
                        expireTime: {
                            equals: null,
                        },
                    },
                ],
            },
        });

        const results = assignments.map((a) => {
            if (a.type === 'inst') {
                return {
                    type: 'inst',
                    inst: a.subjectId,
                    role: {
                        role: a.roleId,
                        expireTimeMs: getExpireTime(
                            convertToMillis(a.expireTime)
                        ),
                    },
                } as const;
            } else {
                return {
                    type: 'user',
                    userId: a.userId,
                    role: {
                        role: a.roleId,
                        expireTimeMs: getExpireTime(
                            convertToMillis(a.expireTime)
                        ),
                    },
                } as const;
            }
        });

        return {
            assignments: results,
            totalCount: results.length,
        };
    }

    @traced(TRACE_NAME)
    async listAssignments(
        recordName: string,
        startingRole: string
    ): Promise<ListedRoleAssignments> {
        const now = new Date();
        const simpleQuery: Prisma.RoleAssignmentWhereInput = {
            recordName: recordName,
            OR: [
                {
                    expireTime: {
                        gt: now,
                    },
                },
                {
                    expireTime: {
                        equals: null,
                    },
                },
            ],
        };
        let query: Prisma.RoleAssignmentWhereInput = {
            ...simpleQuery,
        };

        if (startingRole) {
            query.roleId = { gt: startingRole };
        }

        const totalCount = await this._client.roleAssignment.count({
            where: simpleQuery,
        });
        const assignments = await this._client.roleAssignment.findMany({
            where: query,
            select: {
                roleId: true,
                type: true,
                subjectId: true,
                expireTime: true,
            },
            take: 10,
            orderBy: [
                {
                    recordName: 'asc',
                },
                {
                    roleId: 'asc',
                },
                {
                    subjectId: 'asc',
                },
            ],
        });

        const results = assignments.map((a) => {
            if (a.type === 'inst') {
                return {
                    type: 'inst',
                    inst: a.subjectId,
                    role: {
                        role: a.roleId,
                        expireTimeMs: getExpireTime(
                            convertToMillis(a.expireTime)
                        ),
                    },
                } as const;
            } else {
                return {
                    type: 'user',
                    userId: a.subjectId,
                    role: {
                        role: a.roleId,
                        expireTimeMs: getExpireTime(
                            convertToMillis(a.expireTime)
                        ),
                    },
                } as const;
            }
        });

        return {
            assignments: results,
            totalCount: totalCount,
        };
    }

    @traced(TRACE_NAME)
    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        const expireTime =
            role.expireTimeMs === Infinity ? null : new Date(role.expireTimeMs);

        await this._client.roleAssignment.upsert({
            where: {
                recordName_roleId_subjectId: {
                    recordName: recordName,
                    subjectId: subjectId,
                    roleId: role.role,
                },
            },
            create: {
                recordName: recordName,
                roleId: role.role,
                subjectId: subjectId,
                type: type,
                userId: type === 'user' ? subjectId : null,
                expireTime: expireTime,
            },
            update: {
                expireTime: expireTime,
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: string
    ): Promise<UpdateUserRolesResult> {
        await this._client.roleAssignment.delete({
            where: {
                recordName_roleId_subjectId: {
                    recordName: recordName,
                    subjectId: subjectId,
                    roleId: role,
                },
            },
        });

        return {
            success: true,
        };
    }
}

interface ResourcePermission {
    id: string;
    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    action: ActionKinds;
    options: PermissionOptions;
    subjectId: string;
    subjectType: SubjectType;
    userId: string;
    expireTime: Date;
}

interface MarkerPermission {
    id: string;
    recordName: string;
    resourceKind: ResourceKinds;
    marker: string;
    action: ActionKinds;
    options: PermissionOptions;
    subjectId: string;
    subjectType: SubjectType;
    userId: string;
    expireTime: Date;
}
