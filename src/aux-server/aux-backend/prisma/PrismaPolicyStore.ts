import {
    AssignPermissionToSubjectAndMarkerResult,
    AssignPermissionToSubjectAndResourceResult,
    AssignedRole,
    DeletePermissionAssignmentResult,
    GetMarkerPermissionResult,
    GetResourcePermissionResult,
    ListPermissionsInRecordResult,
    ListedRoleAssignments,
    MarkerPermissionAssignment,
    PolicyStore,
    ResourcePermissionAssignment,
    RoleAssignment,
    UpdateUserRolesResult,
    getExpireTime,
} from '@casual-simulation/aux-records';
import { Prisma, PrismaClient } from './generated';
import { convertMarkers, convertToDate, convertToMillis } from './Utils';
import {
    ActionKinds,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    PermissionOptions,
    PrivacyFeatures,
    ResourceKinds,
    SubjectType,
} from '@casual-simulation/aux-common';
import { v4 as uuid } from 'uuid';

/**
 * Implements PolicyStore for Prisma.
 */
export class PrismaPolicyStore implements PolicyStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async getUserPrivacyFeatures(userId: string): Promise<PrivacyFeatures> {
        const user = await this._client.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                allowAI: true,
                allowPublicData: true,
                allowPublicInsts: true,
                allowPublishData: true,
            },
        });

        if (user) {
            return {
                publishData: user.allowPublishData ?? true,
                allowPublicData: user.allowPublicData ?? true,
                allowAI: user.allowAI ?? true,
                allowPublicInsts: user.allowPublicInsts ?? true,
            };
        }

        return null;
    }

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
