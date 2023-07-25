import {
    AssignedRole,
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    GetUserPolicyResult,
    ListedRoleAssignments,
    ListedUserPolicy,
    PUBLIC_READ_MARKER,
    PolicyDocument,
    PolicyStore,
    RoleAssignment,
    UpdateRolesUpdate,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
    getExpireTime,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';

/**
 * Implements PolicyStore for MongoDB.
 */
export class MongoDBPolicyStore implements PolicyStore {
    private _policies: Collection<MongoDBPolicy>;
    private _roles: Collection<MongoDBRole>;

    constructor(
        policies: Collection<MongoDBPolicy>,
        roles: Collection<MongoDBRole>
    ) {
        this._policies = policies;
        this._roles = roles;
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const policies = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
        if (marker === PUBLIC_READ_MARKER) {
            policies.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
        }
        const id = policyId(recordName, marker);
        const policy = await this._policies.findOne({ _id: id });
        if (policy) {
            policies.push(policy.document);
        }
        return policies;
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string
    ): Promise<ListedUserPolicy[]> {
        let query = {
            recordName: { $eq: recordName },
        } as FilterQuery<MongoDBPolicy>;

        if (!!startingMarker) {
            query.marker = { $gt: startingMarker };
        }
        const policies = await this._policies.find(query).toArray();

        return policies.map((p) => {
            return {
                marker: p.marker,
                document: p.document,
            } as ListedUserPolicy;
        });
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

    async getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        const id = policyId(recordName, marker);
        const policy = await this._policies.findOne({ _id: id });
        if (policy) {
            return {
                success: true,
                markers: policy.markers,
                document: policy.document,
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
        const id = policyId(recordName, marker);

        await this._policies.updateOne(
            {
                _id: { $eq: id },
            },
            {
                $set: {
                    recordName: recordName,
                    marker: marker,
                    markers: policy.markers,
                    document: policy.document,
                },
            },
            { upsert: true }
        );

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
            return await this.updateUserRoles(recordName, subjectId, {
                roles: [...filtered, role],
            });
        } else {
            return await this.updateInstRoles(recordName, subjectId, {
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
            return await this.updateUserRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        } else {
            return await this.updateInstRoles(recordName, subjectId, {
                roles: [...filtered],
            });
        }
    }

    async updateUserRoles(
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

    async updateInstRoles(
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
