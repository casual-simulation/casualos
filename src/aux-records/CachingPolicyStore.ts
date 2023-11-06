import {
    DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_READ_POLICY_DOCUMENT,
    DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT,
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
    PolicyDocument,
} from '@casual-simulation/aux-common';
import {
    AssignedRole,
    GetUserPolicyResult,
    ListUserPoliciesStoreResult,
    ListUserPoliciesStoreSuccess,
    ListedRoleAssignments,
    PolicyStore,
    UpdateUserPolicyResult,
    UpdateUserRolesResult,
    UserPolicyRecord,
    getExpireTime,
} from './PolicyStore';
import { Cache } from './Cache';

/**
 * Defines a policy store that uses a cache.
 */
export class CachingPolicyStore implements PolicyStore {
    private _store: PolicyStore;
    private _cache: Cache;
    private _cacheSeconds: number;

    /**
     * Creates a new CachingPolicyStore.
     * @param store The store.
     * @param cache The cache.
     * @param cacheSeconds The number of seconds that cache entries should be stored.
     */
    constructor(store: PolicyStore, cache: Cache, cacheSeconds: number) {
        this._store = store;
        this._cache = cache;
        this._cacheSeconds = cacheSeconds;
    }

    async listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]> {
        const result = await this._cache.retrieve<PolicyDocument[]>(
            `policies/${recordName}/${marker}`
        );

        if (result) {
            let list: PolicyDocument[] = [DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT];

            if (marker === PUBLIC_READ_MARKER) {
                list.push(DEFAULT_PUBLIC_READ_POLICY_DOCUMENT);
            } else if (marker === PUBLIC_WRITE_MARKER) {
                list.push(DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT);
            }

            return list.concat(result);
        }

        const policies = await this._store.listPoliciesForMarker(
            recordName,
            marker
        );
        if (policies) {
            const cachable = policies.filter(
                (p) =>
                    p !== DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT &&
                    p !== DEFAULT_PUBLIC_READ_POLICY_DOCUMENT &&
                    p !== DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT
            );
            await this._cache.store(
                `policies/${recordName}/${marker}`,
                cachable,
                this._cacheSeconds
            );
        }

        return policies;
    }

    async listUserPolicies(
        recordName: string,
        startingMarker: string
    ): Promise<ListUserPoliciesStoreResult> {
        return this._store.listUserPolicies(recordName, startingMarker);
    }

    async listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]> {
        const cacheResult = await this._cache.retrieve<AssignedRole[]>(
            `userRoles/${recordName}/${userId}`
        );

        if (cacheResult) {
            const now = Date.now();
            return cacheResult.filter(
                (r) => getExpireTime(r.expireTimeMs) > now
            );
        }

        const roles = await this._store.listRolesForUser(recordName, userId);

        if (roles) {
            await this._cache.store(
                `userRoles/${recordName}/${userId}`,
                roles,
                this._cacheSeconds
            );
        }

        return roles;
    }

    async listRolesForInst(
        recordName: string,
        inst: string
    ): Promise<AssignedRole[]> {
        const cacheResult = await this._cache.retrieve<AssignedRole[]>(
            `instRoles/${recordName}/${inst}`
        );

        if (cacheResult) {
            const now = Date.now();
            return cacheResult.filter(
                (r) => getExpireTime(r.expireTimeMs) > now
            );
        }

        const roles = await this._store.listRolesForInst(recordName, inst);

        if (roles) {
            await this._cache.store(
                `instRoles/${recordName}/${inst}`,
                roles,
                this._cacheSeconds
            );
        }

        return roles;
    }

    listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments> {
        return this._store.listAssignmentsForRole(recordName, role);
    }

    listAssignments(
        recordName: string,
        startingRole: string
    ): Promise<ListedRoleAssignments> {
        return this._store.listAssignments(recordName, startingRole);
    }

    getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult> {
        return this._store.getUserPolicy(recordName, marker);
    }

    async updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult> {
        const result = await this._store.updateUserPolicy(
            recordName,
            marker,
            policy
        );

        if (result.success === false) {
            return result;
        }

        // Update the cache.
        await this._cache.remove(`policies/${recordName}/${marker}`);

        return result;
    }

    async assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'inst' | 'user',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult> {
        const result = await this._store.assignSubjectRole(
            recordName,
            subjectId,
            type,
            role
        );

        if (result.success === false) {
            return result;
        }

        // Update the cache.
        if (type === 'user') {
            await this._cache.remove(`userRoles/${recordName}/${subjectId}`);
        } else {
            await this._cache.remove(`instRoles/${recordName}/${subjectId}`);
        }

        return result;
    }

    async revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'inst' | 'user',
        role: string
    ): Promise<UpdateUserRolesResult> {
        const result = await this._store.revokeSubjectRole(
            recordName,
            subjectId,
            type,
            role
        );

        if (result.success === false) {
            return result;
        }

        // Update the cache.
        if (type === 'user') {
            await this._cache.remove(`userRoles/${recordName}/${subjectId}`);
        } else {
            await this._cache.remove(`instRoles/${recordName}/${subjectId}`);
        }

        return result;
    }
}
