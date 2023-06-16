import { sortBy } from 'lodash';
import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    PolicyDocument,
    PUBLIC_READ_MARKER,
} from './PolicyPermissions';
import {
    AssignedRole,
    getExpireTime,
    GetUserPolicyResult,
    ListedRoleAssignments,
    ListedUserPolicy,
    PolicyStore,
    RoleAssignment,
    UpdateRolesUpdate,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
} from './PolicyStore';

/**
 * Defines a class that represents an in-memory implementation of a PolicyStore.
 */
export class MemoryPolicyStore implements PolicyStore {
    policies: {
        [recordName: string]: {
            [marker: string]: {
                document: PolicyDocument;
                markers: string[];
            };
        };
    };

    roles: {
        [recordName: string]: {
            [userId: string]: Set<string>;
        };
    };

    roleAssignments: {
        [recordName: string]: {
            [userId: string]: {
                role: string;
                expireTimeMs: number | null;
            }[];
        };
    };

    constructor() {
        this.policies = {};
        this.roles = {};
        this.roleAssignments = {};
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string
    ): Promise<ListedUserPolicy[]> {
        const recordPolicies = this.policies[recordName] ?? {};

        const keys = sortBy(Object.keys(recordPolicies));

        let results: ListedUserPolicy[] = [];
        let start = !startingMarker;
        for (let key of keys) {
            if (start) {
                results.push({
                    marker: key,
                    document: recordPolicies[key].document,
                    markers: recordPolicies[key].markers,
                });
            } else if (key === startingMarker || key > startingMarker) {
                start = true;
            }
        }

        return results;
    }

    async getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        const policy = this.policies[recordName]?.[marker];

        if (!policy) {
            return {
                success: false,
                errorCode: 'policy_not_found',
                errorMessage: 'The policy was not found.',
            };
        }

        return {
            success: true,
            document: policy.document,
            markers: policy.markers,
        };
    }

    async updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult> {
        if (!this.policies[recordName]) {
            this.policies[recordName] = {};
        }

        this.policies[recordName][marker] = {
            document: policy.document,
            markers: policy.markers,
        };

        return {
            success: true,
        };
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const policies = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
        if (marker === PUBLIC_READ_MARKER) {
            policies.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
        }
        const policy = this.policies[recordName]?.[marker];
        if (policy) {
            policies.push(policy.document);
        }
        return policies;
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        return this._getRolesForEntity(recordName, userId);
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        return this._getRolesForEntity(recordName, inst);
    }

    async listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        let record = this.roles[recordName];
        let assignedRoles = this.roleAssignments[recordName];

        let assignments: RoleAssignment[] = [];

        for (let id in record) {
            if (record[id].has(role)) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role: {
                        role,
                        expireTimeMs: null,
                    },
                });
            }
        }

        for (let id in assignedRoles) {
            let roles = assignedRoles[id];
            let assignment = roles.find((r) => r.role === role);
            if (assignment) {
                assignments.push({
                    type: 'user',
                    userId: id,
                    role: assignment,
                });
            }
        }

        return {
            assignments,
        };
    }

    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const roles = this.roleAssignments[recordName][subjectId] ?? [];

        const filtered = roles.filter(
            (r) =>
                r.role !== role.role ||
                getExpireTime(r.expireTimeMs) <= role.expireTimeMs
        );

        this.roleAssignments[recordName][subjectId] = [
            ...filtered,
            {
                role: role.role,
                expireTimeMs:
                    role.expireTimeMs === Infinity ? null : role.expireTimeMs,
            },
        ];

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
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const roles = this.roleAssignments[recordName][subjectId] ?? [];

        const filtered = roles.filter((r) => r.role !== role);

        this.roleAssignments[recordName][subjectId] = filtered;

        return {
            success: true,
        };
    }

    async updateUserRoles(
        recordName: string,
        userId: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }

        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));
        this.roleAssignments[recordName][userId] = assignments;

        return {
            success: true,
        };
    }

    async updateInstRoles(
        recordName: string,
        inst: string,
        update: UpdateRolesUpdate
    ): Promise<UpdateUserRolesResult> {
        if (!this.roleAssignments[recordName]) {
            this.roleAssignments[recordName] = {};
        }
        const assignments = update.roles
            .filter((r) => getExpireTime(r.expireTimeMs) > Date.now())
            .map((r) => ({
                ...r,
                expireTimeMs:
                    r.expireTimeMs === Infinity ? null : r.expireTimeMs,
            }));
        this.roleAssignments[recordName][inst] = assignments;

        return {
            success: true,
        };
    }

    private _getRolesForEntity(recordName: string, id: string): AssignedRole[] {
        const roles = this.roles[recordName]?.[id] ?? new Set<string>();
        const assignments = this.roleAssignments[recordName]?.[id] ?? [];

        return [
            ...[...roles].map(
                (r) =>
                    ({
                        role: r,
                        expireTimeMs: null,
                    } as AssignedRole)
            ),
            ...assignments.filter(
                (a) => getExpireTime(a.expireTimeMs) > Date.now()
            ),
        ];
    }
}
