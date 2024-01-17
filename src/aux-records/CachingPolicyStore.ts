import {
    ActionKinds,
    PermissionOptions,
    PrivacyFeatures,
    ResourceKinds,
    SubjectType,
} from '@casual-simulation/aux-common';
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
    UpdateUserRolesResult,
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

    // TODO: Add caching for these methods when needed.
    async getUserPrivacyFeatures(userId: string): Promise<PrivacyFeatures> {
        return await this._store.getUserPrivacyFeatures(userId);
    }

    async getRecordOwnerPrivacyFeatures(
        recordName: string
    ): Promise<PrivacyFeatures> {
        return await this._store.getRecordOwnerPrivacyFeatures(recordName);
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
        return await this._store.getPermissionForSubjectAndResource(
            subjectType,
            subjectId,
            recordName,
            resourceKind,
            resourceId,
            action,
            currentTimeMs
        );
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
        return await this._store.getPermissionForSubjectAndMarkers(
            subjectType,
            subjectId,
            recordName,
            resourceKind,
            markers,
            action,
            currentTimeMs
        );
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
        return await this._store.assignPermissionToSubjectAndResource(
            recordName,
            subjectType,
            subjectId,
            resourceKind,
            resourceId,
            action,
            options,
            expireTimeMs
        );
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
        return await this._store.assignPermissionToSubjectAndMarker(
            recordName,
            subjectType,
            subjectId,
            resourceKind,
            marker,
            action,
            options,
            expireTimeMs
        );
    }

    async deleteResourcePermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        return await this._store.deleteResourcePermissionAssignmentById(id);
    }

    async deleteMarkerPermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult> {
        return await this._store.deleteMarkerPermissionAssignmentById(id);
    }

    async listPermissionsInRecord(
        recordName: string
    ): Promise<ListPermissionsInRecordResult> {
        return await this._store.listPermissionsInRecord(recordName);
    }

    async listPermissionsForResource(
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string
    ): Promise<ResourcePermissionAssignment[]> {
        return await this._store.listPermissionsForResource(
            recordName,
            resourceKind,
            resourceId
        );
    }

    async listPermissionsForMarker(
        recordName: string,
        marker: string
    ): Promise<MarkerPermissionAssignment[]> {
        return await this._store.listPermissionsForMarker(recordName, marker);
    }

    async listPermissionsForSubject(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string
    ): Promise<ListPermissionsInRecordResult> {
        return await this._store.listPermissionsForSubject(
            recordName,
            subjectType,
            subjectId
        );
    }

    async getMarkerPermissionAssignmentById(
        id: string
    ): Promise<MarkerPermissionAssignment> {
        return await this._store.getMarkerPermissionAssignmentById(id);
    }

    async getResourcePermissionAssignmentById(
        id: string
    ): Promise<ResourcePermissionAssignment> {
        return await this._store.getResourcePermissionAssignmentById(id);
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
