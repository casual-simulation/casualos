import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    PolicyDocument,
    PUBLIC_READ_MARKER,
} from './PolicyPermissions';
import {
    GetUserPolicyResult,
    PolicyStore,
    UpdateUserPolicyResult,
    UserPolicy,
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

    constructor() {
        this.policies = {};
        this.roles = {};
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
        policy: UserPolicy
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
    ): Promise<Set<string>> {
        const roles = this.roles[recordName]?.[userId];
        return roles ?? new Set();
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<Set<string>> {
        const roles = this.roles[recordName]?.[inst];
        return roles ?? new Set();
    }
}
