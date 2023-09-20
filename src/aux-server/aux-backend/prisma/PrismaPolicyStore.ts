import {
    AssignedRole,
    GetUserPolicyResult,
    ListUserPoliciesStoreResult,
    ListedRoleAssignments,
    ListedUserPolicy,
    PolicyStore,
    RoleAssignment,
    UpdateRolesUpdate,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
    getExpireTime,
} from '@casual-simulation/aux-records';
import { Prisma, PrismaClient } from '@prisma/client';
import { convertMarkers, convertToDate, convertToMillis } from './Utils';
import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    PolicyDocument,
} from '@casual-simulation/aux-common';

/**
 * Implements PolicyStore for Prisma.
 */
export class PrismaPolicyStore implements PolicyStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const policies = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
        if (marker === PUBLIC_READ_MARKER) {
            policies.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
        } else if (marker === PUBLIC_WRITE_MARKER) {
            policies.push(DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT);
        }
        // const id = policyId(recordName, marker);
        const policy = await this._client.policy.findUnique({
            where: {
                recordName_marker: {
                    recordName: recordName,
                    marker: marker,
                },
            },
        });
        if (policy) {
            policies.push(policy.document as unknown as PolicyDocument);
        }
        return policies;
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string
    ): Promise<ListUserPoliciesStoreResult> {
        let query: Prisma.PolicyWhereInput = {
            recordName: recordName,
        };

        if (!!startingMarker) {
            query.marker = {
                gt: startingMarker,
            };
        }
        const policies = await this._client.policy.findMany({
            where: query,
            orderBy: {
                marker: 'asc',
            },
            take: 10,
        });

        const results = policies.map((p) => {
            return {
                marker: p.marker,
                document: p.document as unknown as PolicyDocument,
                markers: p.markers,
            };
        });

        return {
            success: true,
            policies: results,
            totalCount: results.length,
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

    async getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        const policy = await this._client.policy.findUnique({
            where: {
                recordName_marker: {
                    recordName: recordName,
                    marker,
                },
            },
        });
        if (policy) {
            return {
                success: true,
                markers: convertMarkers(policy.markers),
                document: policy.document as unknown as PolicyDocument,
            };
        } else {
            return {
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: `Could not find a user policy for marker ${marker}.`,
            };
        }
    }

    async updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult> {
        await this._client.policy.upsert({
            where: {
                recordName_marker: {
                    recordName,
                    marker,
                },
            },
            create: {
                recordName: recordName,
                marker: marker,
                document: policy.document as any,
                markers: policy.markers,
            },
            update: {
                document: policy.document as any,
                markers: policy.markers,
            },
        });

        return {
            success: true,
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

export interface MongoDBPolicy {
    _id: string;
    recordName: string;
    marker: string;
    document: PolicyDocument;
    markers: string[];
}

export interface MongoDBRole {
    recordName: string;
    type: 'user' | 'inst';
    id: string;
    assignments: AssignedRole[];
}

function policyId(recordName: string, marker: string) {
    return `${recordName}:${marker}`;
}
