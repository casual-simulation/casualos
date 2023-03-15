import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    PolicyDocument,
    PUBLIC_READ_MARKER,
} from './PolicyPermissions';
import { PolicyStore } from './PolicyStore';

/**
 * Defines a class that represents an in-memory implementation of a PolicyStore.
 */
export class MemoryPolicyStore implements PolicyStore {
    policies: {
        [recordName: string]: {
            [marker: string]: PolicyDocument;
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
            policies.push(policy);
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
