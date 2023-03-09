import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    PolicyDocument,
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
        const policy = this.policies[recordName]?.[marker];
        if (policy) {
            return [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT, policy];
        }
        return [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<Set<string>> {
        const roles = this.roles[recordName]?.[userId];
        return roles ?? new Set();
    }
}
