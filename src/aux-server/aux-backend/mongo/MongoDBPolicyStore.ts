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
    ActionKinds,
    Entitlement,
    EntitlementFeature,
    GrantedEntitlementScope,
    PermissionOptions,
    PrivacyFeatures,
    ResourceKinds,
    SubjectType,
} from '@casual-simulation/aux-common';

import type {
    AssignedRole,
    ListedRoleAssignments,
    PolicyStore,
    RoleAssignment,
    UpdateUserRolesResult,
    AssignPermissionToSubjectAndMarkerResult,
    AssignPermissionToSubjectAndResourceResult,
    DeletePermissionAssignmentResult,
    GetMarkerPermissionResult,
    GetResourcePermissionResult,
    ListPermissionsInRecordResult,
    MarkerPermissionAssignment,
    ResourcePermissionAssignment,
    GrantedPackageEntitlement,
} from '@casual-simulation/aux-records';
import { getExpireTime } from '@casual-simulation/aux-records';
import type { Collection, FilterQuery } from 'mongodb';
import type { MongoDBAuthUser } from './MongoDBAuthStore';
import { v4 as uuid } from 'uuid';

/**
 * Implements PolicyStore for MongoDB.
 */
export class MongoDBPolicyStore implements PolicyStore {
    private _roles: Collection<MongoDBRole>;
    private _users: Collection<MongoDBAuthUser>;
    private _resourcePermissions: Collection<MongoDBResourcePermission>;
    private _markerPermissions: Collection<MongoDBMarkerPermission>;

    constructor(
        roles: Collection<MongoDBRole>,
        users: Collection<MongoDBAuthUser>,
        resourcePermissions: Collection<MongoDBResourcePermission>,
        markerPermissions: Collection<MongoDBMarkerPermission>
    ) {
        this._roles = roles;
        this._users = users;
        this._resourcePermissions = resourcePermissions;
        this._markerPermissions = markerPermissions;
    }

    listGrantedEntitlementsByFeatureAndUserId(
        packageIds: string[],
        feature: Entitlement['feature'],
        userId: string,
        recordName: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        throw new Error('Method not implemented.');
    }

    saveGrantedPackageEntitlement(
        grantedEntitlement: GrantedPackageEntitlement
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    findGrantedPackageEntitlementByUserIdPackageIdFeatureAndScope(
        userId: string,
        packageId: string,
        feature: EntitlementFeature,
        scope: GrantedEntitlementScope,
        recordName: string
    ): Promise<GrantedPackageEntitlement | null> {
        throw new Error('Method not implemented.');
    }

    findGrantedPackageEntitlementById(
        id: string
    ): Promise<GrantedPackageEntitlement | null> {
        throw new Error('Method not implemented.');
    }

    listGrantedEntitlementsForUser(
        userId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        throw new Error('Method not implemented.');
    }

    listGrantedEntitlementsForUserAndPackage(
        userId: string,
        packageId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]> {
        throw new Error('Method not implemented.');
    }

    async getUserPrivacyFeatures(userId: string): Promise<PrivacyFeatures> {
        const user = await this._users.findOne({
            where: {
                id: userId,
            },
        });

        return user?.privacyFeatures;
    }

    async getRecordOwnerPrivacyFeatures(
        recordName: string
    ): Promise<PrivacyFeatures> {
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
        const result = await this._resourcePermissions.findOne({
            recordName: { $eq: recordName },
            resourceKind: { $eq: resourceKind },
            resourceId: { $eq: resourceId },
            subjectType: { $eq: subjectType },
            subjectId: { $eq: subjectId },

            $and: [
                {
                    $or: [
                        { action: { $eq: action } },
                        { action: { $eq: null } },
                    ],
                },
                {
                    $or: [
                        { expireTimeMs: { $eq: null } },
                        { expireTimeMs: { $gt: currentTimeMs } },
                    ],
                },
            ],
        });

        if (result) {
            return {
                success: true,
                permissionAssignment: {
                    id: result._id,
                    recordName: result.recordName,
                    resourceKind: result.resourceKind,
                    resourceId: result.resourceId,
                    action: result.action,
                    options: result.options,
                    subjectId: result.subjectId,
                    subjectType: result.subjectType,
                    userId: result.userId,
                    expireTimeMs: result.expireTimeMs,
                },
            };
        } else {
            return {
                success: true,
                permissionAssignment: null,
            };
        }
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
        const result = await this._markerPermissions.findOne({
            recordName: { $eq: recordName },
            marker: { $in: markers },
            subjectType: { $eq: subjectType },
            subjectId: { $eq: subjectId },

            $and: [
                {
                    $or: [
                        { resourceKind: { $eq: resourceKind } },
                        { resourceKind: { $eq: null } },
                    ],
                },
                {
                    $or: [
                        { action: { $eq: action } },
                        { action: { $eq: null } },
                    ],
                },
                {
                    $or: [
                        { expireTimeMs: { $eq: null } },
                        { expireTimeMs: { $gt: currentTimeMs } },
                    ],
                },
            ],
        });

        if (result) {
            return {
                success: true,
                permissionAssignment: {
                    id: result._id,
                    recordName: result.recordName,
                    resourceKind: result.resourceKind,
                    marker: result.marker,
                    action: result.action,
                    options: result.options,
                    subjectId: result.subjectId,
                    subjectType: result.subjectType,
                    userId: result.userId,
                    expireTimeMs: result.expireTimeMs,
                },
            };
        } else {
            return {
                success: true,
                permissionAssignment: null,
            };
        }
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
        const assignment = await this._resourcePermissions.findOne({
            recordName: { $eq: recordName },
            resourceKind: { $eq: resourceKind },
            resourceId: { $eq: resourceId },
            subjectType: { $eq: subjectType },
            subjectId: { $eq: subjectId },
            action: { $eq: action },
        });

        if (assignment) {
            return {
                success: false,
                errorCode: 'permission_already_exists',
                errorMessage: `A permission already exists for the subject and resource.`,
            };
        }

        const resource: MongoDBResourcePermission = {
            _id: uuid(),
            recordName: recordName,
            resourceKind: resourceKind,
            resourceId: resourceId,
            subjectType: subjectType,
            subjectId: subjectId,
            action: action,
            options: options,
            userId: null,
            expireTimeMs: expireTimeMs,
        };
        await this._resourcePermissions.insertOne(resource);

        return {
            success: true,
            permissionAssignment: {
                id: resource._id,
                recordName: resource.recordName,
                resourceKind: resource.resourceKind,
                resourceId: resource.resourceId,
                action: resource.action,
                options: resource.options,
                subjectId: resource.subjectId,
                subjectType: resource.subjectType,
                userId: resource.userId,
                expireTimeMs: resource.expireTimeMs,
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
        const assignment = await this._markerPermissions.findOne({
            recordName: { $eq: recordName },
            resourceKind: { $eq: resourceKind },
            marker: { $eq: marker },
            subjectType: { $eq: subjectType },
            subjectId: { $eq: subjectId },
            action: { $eq: action },
        });

        if (assignment) {
            return {
                success: false,
                errorCode: 'permission_already_exists',
                errorMessage: `A permission already exists for the subject and marker.`,
            };
        }

        const resource: MongoDBMarkerPermission = {
            _id: uuid(),
            recordName: recordName,
            resourceKind: resourceKind,
            marker,
            subjectType: subjectType,
            subjectId: subjectId,
            action: action,
            options: options,
            userId: null,
            expireTimeMs: expireTimeMs,
        };
        await this._markerPermissions.insertOne(resource);

        return {
            success: true,
            permissionAssignment: {
                id: resource._id,
                recordName: resource.recordName,
                resourceKind: resource.resourceKind,
                marker: resource.marker,
                action: resource.action,
                options: resource.options,
                subjectId: resource.subjectId,
                subjectType: resource.subjectType,
                userId: resource.userId,
                expireTimeMs: resource.expireTimeMs,
            },
        };
    }

    async deleteResourcePermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        const result = await this._resourcePermissions.deleteOne({
            _id: id,
        });

        return {
            success: true,
        };
    }

    async deleteMarkerPermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        const result = await this._markerPermissions.deleteOne({
            _id: id,
        });

        return {
            success: true,
        };
    }

    async listPermissionsInRecord(
        recordName: string
    ): Promise<ListPermissionsInRecordResult> {
        const markerPermissions = await this._markerPermissions
            .find({
                recordName: { $eq: recordName },
            })
            .toArray();

        const resourcePermissions = await this._resourcePermissions
            .find({
                recordName: { $eq: recordName },
            })
            .toArray();

        return {
            success: true,
            markerAssignments: markerPermissions.map((p) => ({
                id: p._id,
                recordName: p.recordName,
                resourceKind: p.resourceKind,
                marker: p.marker,
                action: p.action,
                options: p.options,
                subjectId: p.subjectId,
                subjectType: p.subjectType,
                userId: p.userId,
                expireTimeMs: p.expireTimeMs,
            })),
            resourceAssignments: resourcePermissions.map((p) => ({
                id: p._id,
                recordName: p.recordName,
                resourceKind: p.resourceKind,
                resourceId: p.resourceId,
                action: p.action,
                options: p.options,
                subjectId: p.subjectId,
                subjectType: p.subjectType,
                userId: p.userId,
                expireTimeMs: p.expireTimeMs,
            })),
        };
    }

    async listPermissionsForResource(
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string
    ): Promise<ResourcePermissionAssignment[]> {
        const resourcePermissions = await this._resourcePermissions
            .find({
                recordName: { $eq: recordName },
                resourceKind: { $eq: resourceKind },
                resourceId: { $eq: resourceId },
            })
            .toArray();

        return resourcePermissions.map((p) => ({
            id: p._id,
            recordName: p.recordName,
            resourceKind: p.resourceKind,
            resourceId: p.resourceId,
            action: p.action,
            options: p.options,
            subjectId: p.subjectId,
            subjectType: p.subjectType,
            userId: p.userId,
            expireTimeMs: p.expireTimeMs,
        }));
    }

    async listPermissionsForMarker(
        recordName: string,
        marker: string
    ): Promise<MarkerPermissionAssignment[]> {
        const markerPermissions = await this._markerPermissions
            .find({
                recordName: { $eq: recordName },
                marker: { $eq: marker },
            })
            .toArray();

        return markerPermissions.map((p) => ({
            id: p._id,
            recordName: p.recordName,
            resourceKind: p.resourceKind,
            marker: p.marker,
            action: p.action,
            options: p.options,
            subjectId: p.subjectId,
            subjectType: p.subjectType,
            userId: p.userId,
            expireTimeMs: p.expireTimeMs,
        }));
    }

    async listPermissionsForSubject(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string
    ): Promise<ListPermissionsInRecordResult> {
        const markerPermissions = await this._markerPermissions
            .find({
                recordName: { $eq: recordName },
                subjectType: { $eq: subjectType },
                subjectId: { $eq: subjectId },
            })
            .toArray();

        const resourcePermissions = await this._resourcePermissions
            .find({
                recordName: { $eq: recordName },
                subjectType: { $eq: subjectType },
                subjectId: { $eq: subjectId },
            })
            .toArray();

        return {
            success: true,
            markerAssignments: markerPermissions.map((p) => ({
                id: p._id,
                recordName: p.recordName,
                resourceKind: p.resourceKind,
                marker: p.marker,
                action: p.action,
                options: p.options,
                subjectId: p.subjectId,
                subjectType: p.subjectType,
                userId: p.userId,
                expireTimeMs: p.expireTimeMs,
            })),
            resourceAssignments: resourcePermissions.map((p) => ({
                id: p._id,
                recordName: p.recordName,
                resourceKind: p.resourceKind,
                resourceId: p.resourceId,
                action: p.action,
                options: p.options,
                subjectId: p.subjectId,
                subjectType: p.subjectType,
                userId: p.userId,
                expireTimeMs: p.expireTimeMs,
            })),
        };
    }

    async getMarkerPermissionAssignmentById(
        id: string
    ): Promise<MarkerPermissionAssignment> {
        const result = await this._markerPermissions.findOne({
            _id: id,
        });

        return {
            id: result._id,
            recordName: result.recordName,
            resourceKind: result.resourceKind,
            marker: result.marker,
            action: result.action,
            options: result.options,
            subjectId: result.subjectId,
            subjectType: result.subjectType,
            userId: result.userId,
            expireTimeMs: result.expireTimeMs,
        };
    }

    async getResourcePermissionAssignmentById(
        id: string
    ): Promise<ResourcePermissionAssignment> {
        const result = await this._resourcePermissions.findOne({
            _id: id,
        });

        return {
            id: result._id,
            recordName: result.recordName,
            resourceKind: result.resourceKind,
            resourceId: result.resourceId,
            action: result.action,
            options: result.options,
            subjectId: result.subjectId,
            subjectType: result.subjectType,
            userId: result.userId,
            expireTimeMs: result.expireTimeMs,
        };
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        const roles = await this._roles.findOne({
            recordName: { $eq: recordName },
            type: 'user',
            id: { $eq: userId },
        });

        if (!roles) {
            return [];
        }

        const now = Date.now();

        return roles.assignments.filter(
            (r) => getExpireTime(r.expireTimeMs) > now
        );
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        const roles = await this._roles.findOne({
            recordName: { $eq: recordName },
            type: 'inst',
            id: { $eq: inst },
        });

        if (!roles) {
            return [];
        }

        const now = Date.now();

        return roles.assignments.filter(
            (r) => getExpireTime(r.expireTimeMs) > now
        );
    }

    async listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        const roles = await this._roles
            .find({
                recordName: { $eq: recordName },
                role: { $eq: role },
            })
            .toArray();

        let assignments: RoleAssignment[] = [];

        for (let r of roles) {
            if (r.type === 'inst') {
                for (let a of r.assignments) {
                    assignments.push({
                        type: 'inst',
                        inst: r.id,
                        role: {
                            role: a.role,
                            expireTimeMs: getExpireTime(a.expireTimeMs),
                        },
                    });
                }
            } else {
                for (let a of r.assignments) {
                    assignments.push({
                        type: 'user',
                        userId: r.id,
                        role: {
                            role: a.role,
                            expireTimeMs: getExpireTime(a.expireTimeMs),
                        },
                    });
                }
            }
        }

        return {
            assignments,
            totalCount: assignments.length,
        };
    }

    async listAssignments(
        recordName: string,
        startingRole: string
    ): Promise<ListedRoleAssignments> {
        let query: FilterQuery<MongoDBRole> = {
            recordName: { $eq: recordName },
        };

        if (startingRole) {
            query.role = { $gt: startingRole };
        }

        const roles = await this._roles.find(query).toArray();

        let assignments: RoleAssignment[] = [];

        for (let r of roles) {
            if (r.type === 'inst') {
                for (let a of r.assignments) {
                    assignments.push({
                        type: 'inst',
                        inst: r.id,
                        role: {
                            role: a.role,
                            expireTimeMs: getExpireTime(a.expireTimeMs),
                        },
                    });
                }
            } else {
                for (let a of r.assignments) {
                    assignments.push({
                        type: 'user',
                        userId: r.id,
                        role: {
                            role: a.role,
                            expireTimeMs: getExpireTime(a.expireTimeMs),
                        },
                    });
                }
            }
        }

        return {
            assignments,
            totalCount: assignments.length,
        };
    }

    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        const roles =
            type === 'user'
                ? await this.listRolesForUser(recordName, subjectId)
                : await this.listRolesForInst(recordName, subjectId);

        const filtered = roles.filter(
            (r) =>
                r.role !== role.role ||
                getExpireTime(r.expireTimeMs) <= role.expireTimeMs
        );

        if (type === 'user') {
            return await this._updateUserRoles(recordName, subjectId, {
                roles: [...filtered, role],
            });
        } else {
            return await this._updateInstRoles(recordName, subjectId, {
                roles: [...filtered, role],
            });
        }
    }

    async revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: string
    ): Promise<UpdateUserRolesResult> {
        const roles = await this.listRolesForUser(recordName, subjectId);

        const filtered = roles.filter((r) => r.role !== role);

        if (type === 'user') {
            return await this._updateUserRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        } else {
            return await this._updateInstRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        }
    }

    private async _updateUserRoles(
        recordName: string,
        userId: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));

        await this._roles.updateOne(
            {
                recordName: { $eq: recordName },
                type: 'user',
                id: { $eq: userId },
            },
            {
                $set: {
                    recordName: recordName,
                    type: 'user',
                    id: userId,
                    assignments: assignments,
                },
            },
            {
                upsert: true,
            }
        );

        return {
            success: true,
        };
    }

    private async _updateInstRoles(
        recordName: string,
        inst: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));

        await this._roles.updateOne(
            {
                recordName: { $eq: recordName },
                type: 'inst',
                id: { $eq: inst },
            },
            {
                $set: {
                    recordName: recordName,
                    type: 'inst',
                    id: inst,
                    assignments: assignments,
                },
            },
            {
                upsert: true,
            }
        );

        return {
            success: true,
        };
    }
}

interface UpdateRolesUpdate {
    roles: AssignedRole[];
}

export interface MongoDBRole {
    recordName: string;
    type: 'user' | 'inst';
    id: string;
    assignments: AssignedRole[];
}

interface MongoDBResourcePermission {
    _id: string;
    recordName: string;
    resourceKind: ResourceKinds;
    resourceId: string;
    action: ActionKinds;
    options: PermissionOptions;
    subjectId: string;
    subjectType: SubjectType;
    userId: string;
    expireTimeMs: number;
}

interface MongoDBMarkerPermission {
    _id: string;
    recordName: string;
    resourceKind: ResourceKinds;
    marker: string;
    action: ActionKinds;
    options: PermissionOptions;
    subjectId: string;
    subjectType: SubjectType;
    userId: string;
    expireTimeMs: number;
}

function policyId(recordName: string, marker: string) {
    return `${recordName}:${marker}`;
}
