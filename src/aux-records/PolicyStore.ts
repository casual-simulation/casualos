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
import type { ServerError } from '@casual-simulation/aux-common/Errors';
import type {
    ActionKinds,
    PermissionOptions,
    ResourceKinds,
    SubjectType,
    PrivacyFeatures,
    Entitlement,
    EntitlementFeature,
    GrantedEntitlementScope,
} from '@casual-simulation/aux-common';
import {
    PUBLIC_READ_MARKER,
    PUBLIC_WRITE_MARKER,
} from '@casual-simulation/aux-common';
import type { UserRole } from './AuthStore';

/**
 * Defines an interface for objects that are able to store and retrieve policy documents.
 */
export interface PolicyStore {
    // /**
    //  * Gets the list of policy documents that apply to the given marker and user.
    //  * @param recordName The name of the record that the policies belong to.
    //  * @param userId The ID of the user that is attempting to utilize the markers. Null if the user is not logged in.
    //  * @param marker The marker.
    //  */
    // listPoliciesForMarkerAndUser(
    //     recordName: string,
    //     userId: string,
    //     marker: string
    // ): Promise<ListMarkerPoliciesResult>;

    // /**
    //  * Lists the user-created policices for the given record.
    //  * @param recordName The name of the record.
    //  * @param startingMarker The marker that policies should be listed after. If null, then the list starts with the first policy.
    //  */
    // listUserPolicies(
    //     recordName: string,
    //     startingMarker: string | null
    // ): Promise<ListUserPoliciesStoreResult>;

    /**
     * Lists the roles that are assigned to the user.
     * @param recordName The name of the record that the role assignments belong to.
     * @param userId The ID of the user.
     */
    listRolesForUser(
        recordName: string,
        userId: string
    ): Promise<AssignedRole[]>;

    /**
     * Lists the roles that are assigned to the given inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    listRolesForInst(recordName: string, inst: string): Promise<AssignedRole[]>;

    /**
     * Lists the assignments for the given role.
     * @param recordName The name of the record.
     * @param role The name of the role.
     */
    listAssignmentsForRole(
        recordName: string,
        role: string
    ): Promise<ListedRoleAssignments>;

    /**
     * Lists the role assignments in the given record.
     * @param recordName The name of the record.
     * @param role The name of the role that the assignments should be listed after. If null, then the list starts with the first role assignment.
     */
    listAssignments?(
        recordName: string,
        startingRole: string | null
    ): Promise<ListedRoleAssignments>;

    // /**
    //  * Gets the user-created policy for the given marker.
    //  * @param recordName The name of the record.
    //  * @param marker The name of the marker.
    //  */
    // getUserPolicy(
    //     recordName: string,
    //     marker: string
    // ): Promise<GetUserPolicyResult>;

    // /**
    //  * Updates the policy for the given marker.
    //  * @param recordName The name of the record.
    //  * @param marker The name of the marker.
    //  * @param document The new policy document.
    //  */
    // updateUserPolicy(
    //     recordName: string,
    //     marker: string,
    //     policy: UserPolicyRecord
    // ): Promise<UpdateUserPolicyResult>;

    /**
     * Gets the privacy features that are enabled for the given user.
     * Returns null if the given user does not exist.
     * @param userId The ID of the user.
     */
    getUserPrivacyFeatures(userId: string): Promise<UserPrivacyFeatures>;

    /**
     * Gets the privacy features for the owner of the given record.
     * Returns null if the record does not exist or if the record does not have an owner.
     * @param recordName The name of the record.
     */
    getRecordOwnerPrivacyFeatures(recordName: string): Promise<PrivacyFeatures>;

    /**
     * Gets the permission for the given subject, resource, and action.
     * @param subjectType The type of the subject. Must be either a user, inst, or role.
     * @param subjectId The ID of the subject.
     * @param recordName The name of the record that the resource belongs to.
     * @param resourceKind The kind of the resource.
     * @param resourceId The ID of the resource.
     * @param action The action that the subject is attempting to perform on the resource.
     * @param currentTimeMs The current unix time in milliseconds.
     */
    getPermissionForSubjectAndResource(
        subjectType: SubjectType,
        subjectId: string,
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string,
        action: ActionKinds,
        currentTimeMs: number
    ): Promise<GetResourcePermissionResult>;

    /**
     * Gets the permission for the given subject, markers, and action.
     * @param subjectType The type of the subject. Must be either a user, inst, or role.
     * @param subjectId The ID of the subject.
     * @param recordName The name of the record that the resource belongs to.
     * @param resourceKind The kind of the resource.
     * @param markers The markers that are applied to the resource.
     * @param action The action that the subject is attempting to perform on the resource.
     * @param currentTimeMs The current unix time in milliseconds.
     */
    getPermissionForSubjectAndMarkers(
        subjectType: SubjectType,
        subjectId: string,
        recordName: string,
        resourceKind: ResourceKinds,
        markers: string[],
        action: ActionKinds,
        currentTimeMs: number
    ): Promise<GetMarkerPermissionResult>;

    // TODO: Support global permissions
    // /**
    //  * Assigns the given permission to the given subject for all resources in all records.
    //  * @param subjectType The type of the subject. If "role", then all users/insts that have the given role in the related record are granted permission.
    //  * @param subjectId The ID of the subject.
    //  * @param resourceKind The kind of the resource. If null, then the permission applies to all resources.
    //  * @param action The action that the subject is allowed to perform on the resource. If null, then all actions are allowed.
    //  * @param options The options for the permission.
    //  * @param expireTimeMs The time that the permission expires. If null, then the permission never expires.
    //  */
    // assignGlobalPermissionToSubject(
    //     subjectType: SubjectType,
    //     subjectId: string,
    //     resourceKind: ResourceKinds,
    //     action: ActionKinds,
    //     options: PermissionOptions,
    //     expireTimeMs: number | null
    // ): Promise<AssignGlobalPermissionToSubjectResult>;

    /**
     * Assigns the given permission to the given subject for the given resource.
     * @param recordName The name of the record that the resource exists in.
     * @param subjectType The type of the subject. This can be either a user, inst, or role.
     * @param subjectId The ID of the subject.
     * @param resourceKind The kind of the resource.
     * @param resourceId The ID of the resource.
     * @param action The action that the subject is allowed to perform on the resource. If null, then all actions are allowed.
     * @param options The options for the permission.
     * @param expireTimeMs The time that the permission expires. If null, then the permission never expires.
     */
    assignPermissionToSubjectAndResource(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string,
        resourceKind: ResourceKinds,
        resourceId: string,
        action: ActionKinds,
        options: PermissionOptions,
        expireTimeMs: number | null
    ): Promise<AssignPermissionToSubjectAndResourceResult>;

    /**
     * Assigns the given permission to the given subject for the given resource.
     * @param recordName The name of the record that the resource exists in.
     * @param subjectType The type of the subject. This can be either a user, inst, or role.
     * @param subjectId The ID of the subject.
     * @param resourceKind The kind of the resource.
     * @param marker The ID of the marker.
     * @param action The action that the subject is allowed to perform on the resource. If null, then all actions are allowed.
     * @param options The options for the permission.
     * @param expireTimeMs The time that the permission expires. If null, then the permission never expires.
     */
    assignPermissionToSubjectAndMarker(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string,
        resourceKind: ResourceKinds,
        marker: string,
        action: ActionKinds,
        options: PermissionOptions,
        expireTimeMs: number | null
    ): Promise<AssignPermissionToSubjectAndMarkerResult>;

    /**
     * Deletes the given resource permission assignment from the store.
     * @param id The ID of the resource permission assignment.
     */
    deleteResourcePermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult>;

    /**
     * Deletes the given marker permission assignment from the store.
     * @param id The ID of the permission assignment.
     */
    deleteMarkerPermissionAssignmentById(
        id: string
    ): Promise<DeletePermissionAssignmentResult>;

    /**
     * Lists the resource permission assignments for the given record.
     * @param recordName The name of the record.
     */
    listPermissionsInRecord(
        recordName: string
    ): Promise<ListPermissionsInRecordResult>;

    /**
     * Lists the resource permission assignments for the given record and resource.
     * @param recordName The name of the record.
     * @param resourceKind The kind of the resource.
     * @param resourceId The ID of the resource.
     */
    listPermissionsForResource(
        recordName: string,
        resourceKind: ResourceKinds,
        resourceId: string
    ): Promise<ResourcePermissionAssignment[]>;

    /**
     * Lists the marker permission assignments for the given record and marker.
     * @param recordName The record that the permission assignments should be listed for.
     * @param marker The marker that the permission assignments should be listed for.
     */
    listPermissionsForMarker(
        recordName: string,
        marker: string
    ): Promise<MarkerPermissionAssignment[]>;

    /**
     * Lists the resource permission assignments for the given subject in the given record.
     * @param recordName The name of the record.
     * @param subjectType The type of the subject.
     * @param subjectId The ID of the subject.
     */
    listPermissionsForSubject(
        recordName: string,
        subjectType: SubjectType,
        subjectId: string
    ): Promise<ListPermissionsInRecordResult>;

    /**
     * Gets the marker permission assignment with the given ID.
     * Returns null if no assignment was found.
     * @param id The ID of the assignment.
     */
    getMarkerPermissionAssignmentById(
        id: string
    ): Promise<MarkerPermissionAssignment>;

    /**
     * Gets the resource permission assignment with the given ID.
     * Returns null if no assignment was found.
     * @param id The ID of the assignment.
     */
    getResourcePermissionAssignmentById(
        id: string
    ): Promise<ResourcePermissionAssignment>;

    /**
     * Assigns the given role to the given subject.
     * If the role already is assigned, then it will be overwritten.
     *
     * @param recordName The name of the record.
     * @param subjectId The ID of the subject.
     * @param type The type of subject.
     * @param role The role that should be assigned.
     */
    assignSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: AssignedRole
    ): Promise<UpdateUserRolesResult>;

    /**
     * Revokes the given role from the subject.
     * If the role is not assigned, then this function does nothing.
     *
     * @param recordName The name of the record.
     * @param subjectId The ID of the subject.
     * @param type The type of subject.
     * @param role The ID of the role that should be revoked.
     */
    revokeSubjectRole(
        recordName: string,
        subjectId: string,
        type: 'user' | 'inst',
        role: string
    ): Promise<UpdateUserRolesResult>;

    /**
     * Gets the list of non-revoked granted entitlements for the given package IDs, feature, and userId.
     * @param packageIds The IDs of the packages to list the entitlements for.
     * @param feature The feature that the entitlements are granted for.
     * @param userId The ID of the user that the entitlements are granted to.
     * @param recordName The name of the record that the entitlements are granted for.
     * @param nowMs The current unix time in milliseconds.
     */
    listGrantedEntitlementsByFeatureAndUserId(
        packageIds: string[],
        feature: Entitlement['feature'],
        userId: string,
        recordName: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]>;

    /**
     * Saves the given granted entitlement.
     * @param grantedEntitlement The entitlement that should be saved.
     */
    saveGrantedPackageEntitlement(
        grantedEntitlement: GrantedPackageEntitlement
    ): Promise<void>;

    /**
     * Attempts to find the non-revoked granted entitlement for the given user, package, feature, and scope.
     * @param userId The ID of the user that granted the entitlement.
     * @param packageId The ID of the package that the entitlement is granted for.
     * @param feature The feature that was granted.
     * @param scope The scope that was granted.
     * @param recordName The name of the record that the entitlement was granted for.
     */
    findGrantedPackageEntitlementByUserIdPackageIdFeatureAndScope(
        userId: string,
        packageId: string,
        feature: EntitlementFeature,
        scope: GrantedEntitlementScope,
        recordName: string
    ): Promise<GrantedPackageEntitlement | null>;

    /**
     * Attempts to find the granted entitlement for the given ID.
     * @param id The ID of the entitlement.
     */
    findGrantedPackageEntitlementById(
        id: string
    ): Promise<GrantedPackageEntitlement | null>;

    /**
     * Lists all the active entitlements that the user has granted.
     * @param userId The ID of the user.
     * @param nowMs The current unix time in milliseconds.
     */
    listGrantedEntitlementsForUser(
        userId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]>;

    /**
     * Lists all the active entitlements that the user has granted for the given package.
     * @param userId The ID of the user.
     * @param packageId The ID of the package.
     * @param nowMs The current unix time in milliseconds.
     */
    listGrantedEntitlementsForUserAndPackage(
        userId: string,
        packageId: string,
        nowMs: number
    ): Promise<GrantedPackageEntitlement[]>;
}

/**
 * Defines an interface that represents an entitlement that has been granted to a package.
 */
export interface GrantedPackageEntitlement {
    /**
     * The ID of the entitlement.
     */
    id: string;

    /**
     * The ID of the user that granted the entitlement.
     */
    userId: string;

    /**
     * The ID of the package that the entitlement is granted for.
     */
    packageId: string;

    /**
     * The feature that was granted.
     */
    feature: EntitlementFeature;

    /**
     * The scope of the granted entitlement.
     */
    scope: GrantedEntitlementScope;

    /**
     * The record that the entitlement was granted for.
     */
    recordName: string;

    /**
     * The unix time that the entitlement expires in miliseconds.
     */
    expireTimeMs: number;

    /**
     * The unix time that the entitlement was revoked at in miliseconds.
     * If null, then the entitlement has not been revoked.
     */
    revokeTimeMs: number | null;

    /**
     * The unix time that the grant was created at in miliseconds.
     */
    createdAtMs: number;
}

// /**
//  * Defines an interface that represents a user-created policy.
//  */
// export interface UserPolicyRecord {
//     /**
//      * The policy document.
//      */
//     document: PolicyDocument;

//     /**
//      * The list of markers that are applied to the policy.
//      */
//     markers: string[];
// }

// export interface ListedUserPolicy extends UserPolicyRecord {
//     /**
//      * The marker that this policy is for.
//      */
//     marker: string;
// }

// export type GetUserPolicyResult = GetUserPolicySuccess | GetUserPolicyFailure;

// export interface GetUserPolicySuccess {
//     success: true;
//     document: PolicyDocument;
//     markers: string[];
// }

// export interface GetUserPolicyFailure {
//     success: false;
//     errorCode: ServerError | 'policy_not_found';
//     errorMessage: string;
// }

// export type UpdateUserPolicyResult =
//     | UpdateUserPolicySuccess
//     | UpdateUserPolicyFailure;

// export interface UpdateUserPolicySuccess {
//     success: true;
// }

// export interface UpdateUserPolicyFailure {
//     success: false;
//     errorCode: ServerError | 'policy_too_large';
//     errorMessage: string;
// }

// export interface UpdateRolesUpdate {
//     /**
//      * The roles that should be assigned.
//      */
//     roles: AssignedRole[];
// }

export interface AssignedRole {
    /**
     * The name of the role.
     */
    role: string;

    /**
     * The Unix time in miliseconds that the role assignment expires.
     * If null, then the role assignment never expires.
     */
    expireTimeMs: number | null;
}

export type UpdateUserRolesResult =
    | UpdateUserRolesSuccess
    | UpdateUserRolesFailure;

export interface UpdateUserRolesSuccess {
    success: true;
}

export interface UpdateUserRolesFailure {
    success: false;
    errorCode: ServerError | 'roles_too_large';
    errorMessage: string;
}

// export type ListUserPoliciesStoreResult =
//     | ListUserPoliciesStoreSuccess
//     | ListUserPoliciesStoreFailure;

// export interface ListUserPoliciesStoreSuccess {
//     success: true;
//     policies: ListedUserPolicy[];
//     totalCount: number;
// }

// export interface ListUserPoliciesStoreFailure {
//     success: false;
//     errorCode: ServerError;
//     errorMessage: string;
// }

export interface ListedRoleAssignments {
    assignments: RoleAssignment[];
    totalCount: number;
}

export type RoleAssignment = UserRoleAssignment | InstRoleAssignment;

export interface UserRoleAssignment {
    type: 'user';
    userId: string;
    role: AssignedRole;
}

export interface InstRoleAssignment {
    type: 'inst';
    inst: string;
    role: AssignedRole;
}

// export interface ListMarkerPoliciesResult {
//     /**
//      * The policies that were returned.
//      */
//     policies: PolicyDocument[];

//     /**
//      * The privacy features that are enabled for the record owner.
//      */
//     recordOwnerPrivacyFeatures: PrivacyFeatures;

//     /**
//      * The privacy features that are enabled for the user.
//      */
//     userPrivacyFeatures: PrivacyFeatures;
// }

/**
 * Gets the expiration time that can be used for comparision.
 * If given null, then this function returns Infinity.
 * Otherwise, it returns the given time.
 * @param expireTimeMs The time that the role expires in milliseconds.
 */
export function getExpireTime(expireTimeMs: number | null): number {
    return expireTimeMs ?? Infinity;
}

export type GetResourcePermissionResult =
    | GetResourcePermissionSuccess
    | GetResourcePermissionFailure;

export interface GetResourcePermissionSuccess {
    success: true;

    /**
     * The permission that was assigned to the subject.
     * Null if no permission was found.
     */
    permissionAssignment: ResourcePermissionAssignment | null;
}

export interface GetResourcePermissionFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode: ServerError;

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface PermissionAssignment {
    /**
     * The ID of the permission assignment.
     */
    id: string;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The kind of the actions that the subject is allowed to perform.
     * Null if the subject is allowed to perform any action.
     */
    action: ActionKinds | null;

    /**
     * The options for the permission assignment.
     */
    options: PermissionOptions;

    /**
     * The ID of the subject.
     */
    subjectId: string;

    /**
     * The type of the subject.
     */
    subjectType: SubjectType;

    /**
     * The ID of the user that the assignment grants permission to.
     * Null if the subject type is not "user".
     */
    userId: string | null;

    /**
     * The time that the permission expires.
     * Null if the permission never expires.
     */
    expireTimeMs: number | null;
}

// TODO: Support global permissions
// /**
//  * Defines an interface that represents a global permission assignment.
//  * That is, a permission assignment that applies to all resources in all records.
//  */
// export interface GlobalPermissionAssignment {
//     /**
//      * The ID of the permission assignment.
//      */
//     id: string;

//     /**
//      * The kind of the resources that the subject is allowed to perform actions on.
//      * Null if the subject is allowed to perform actions on all kinds of resources.
//      */
//     resourceKind: ResourceKinds | null;

//     /**
//      * The kind of the actions that the subject is allowed to perform.
//      * Null if the subject is allowed to perform any action.
//      */
//     action: ActionKinds | null;

//     /**
//      * The options for the permission assignment.
//      */
//     options: PermissionOptions;

//     /**
//      * The ID of the subject.
//      */
//     subjectId: string;

//     /**
//      * The type of the subject.
//      * If set to "role", then all users/insts that have the given role in the record are granted permission.
//      * If set to "user" or "inst", then only the given user/inst is granted permission.
//      */
//     subjectType: SubjectType;

//     /**
//      * The ID of the user that the assignment grants permission to.
//      * Null if the subject type is not "user".
//      */
//     userId: string | null;

//     /**
//      * The time that the permission expires.
//      * Null if the permission never expires.
//      */
//     expireTimeMs: number | null;
// }

/**
 * Defines an interface that represents a resource permission assignment.
 */
export interface ResourcePermissionAssignment extends PermissionAssignment {
    /**
     * The kind of the resource.
     */
    resourceKind: ResourceKinds;

    /**
     * The ID of the resource.
     */
    resourceId: string;
}

/**
 * Defines an interface that represents a marker permission assignment.
 */
export interface MarkerPermissionAssignment extends PermissionAssignment {
    /**
     * The marker that the permission applies to.
     */
    marker: string;

    /**
     * The kind of the resource.
     * Null if the permission applies to all resources.
     */
    resourceKind: ResourceKinds | null;
}

export type GetMarkerPermissionResult =
    | GetMarkerPermissionSuccess
    | GetMarkerPermissionFailure;

export interface GetMarkerPermissionSuccess {
    success: true;

    /**
     * The permission that was assigned to the subject.
     * Null if no permission was found.
     */
    permissionAssignment: MarkerPermissionAssignment | null;
}

export interface GetMarkerPermissionFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode: ServerError;

    /**
     * The error message.
     */
    errorMessage: string;
}

// TODO: Support global permissions
// export type AssignGlobalPermissionToSubjectResult =
//     | AssignGlobalPermissionToSubjectSuccess
//     | AssignGlobalPermissionToSubjectFailure;

// export interface AssignGlobalPermissionToSubjectSuccess {
//     success: true;

//     /**
//      * The assignment that was created or updated.
//      */
//     permissionAssignment: GlobalPermissionAssignment;
// }

// export interface AssignGlobalPermissionToSubjectFailure {
//     success: false;
//     errorCode: ServerError;
//     errorMessage: string;
// }

export type AssignPermissionToSubjectAndResourceResult =
    | AssignPermissionToSubjectAndResourceSuccess
    | AssignPermissionToSubjectAndResourceFailure;

export interface AssignPermissionToSubjectAndResourceSuccess {
    success: true;

    /**
     * The assignment that was created or updated.
     */
    permissionAssignment: ResourcePermissionAssignment;
}

export interface AssignPermissionToSubjectAndResourceFailure {
    success: false;
    errorCode: ServerError | 'permission_already_exists';
    errorMessage: string;
}

export type AssignPermissionToSubjectAndMarkerResult =
    | AssignPermissionToSubjectAndMarkerSuccess
    | AssignPermissionToSubjectAndMarkerFailure;

export interface AssignPermissionToSubjectAndMarkerSuccess {
    success: true;

    /**
     * The assignment that was created or updated.
     */
    permissionAssignment: MarkerPermissionAssignment;
}

export interface AssignPermissionToSubjectAndMarkerFailure {
    success: false;
    errorCode: ServerError | 'permission_already_exists';
    errorMessage: string;
}

export type DeletePermissionAssignmentResult =
    | DeletePermissionAssignmentSuccess
    | DeletePermissionAssignmentFailure;

export interface DeletePermissionAssignmentSuccess {
    success: true;
}

export interface DeletePermissionAssignmentFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type ListPermissionsInRecordResult =
    | ListPermissionsInRecordSuccess
    | ListPermissionsInRecordFailure;

export interface ListPermissionsInRecordSuccess {
    success: true;

    resourceAssignments: ResourcePermissionAssignment[];
    markerAssignments: MarkerPermissionAssignment[];
}

export interface ListPermissionsInRecordFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

/**
 * Gets the publicRead permission for the given resource kind and action.
 * @param resourceKind The kind of the resource.
 * @param action The kind of the action.
 */
export function getPublicReadPermission(
    resourceKind: ResourceKinds,
    action: ActionKinds
) {
    if (resourceKind === 'data') {
        // data.read and data.list
        if (action === 'read' || action === 'list') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'file' || resourceKind === 'inst') {
        // file.read, inst.read
        if (action === 'read') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'event') {
        // event.count
        if (action === 'count') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'webhook') {
        if (action === 'run') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'notification') {
        if (action === 'read' || action === 'list' || action === 'subscribe') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'package') {
        if (action === 'read' || action === 'list') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'package.version') {
        if (action === 'read' || action === 'list' || action === 'run') {
            return {
                resourceKind,
                action,
            };
        }
    }

    // All other actions are not allowed.
    return null;
}

/**
 * Gets the publicWrite permission for the given resource kind and action.
 * @param resourceKind The kind of the resource.
 * @param action The kind of the action.
 */
export function getPublicWritePermission(
    resourceKind: ResourceKinds,
    action: ActionKinds
) {
    if (resourceKind === 'data') {
        if (
            action === 'read' ||
            action === 'create' ||
            action === 'update' ||
            action === 'delete' ||
            action === 'list'
        ) {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'file') {
        if (action === 'read' || action === 'delete' || action === 'create') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'event') {
        if (
            action === 'increment' ||
            action === 'count' ||
            action === 'create'
        ) {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'inst') {
        if (
            action === 'read' ||
            action === 'updateData' ||
            action === 'sendAction' ||
            action === 'delete' ||
            action === 'create'
        ) {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'webhook') {
        if (action === 'run') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'notification') {
        if (action === 'read' || action === 'list' || action === 'subscribe') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'package') {
        if (action === 'read' || action === 'list') {
            return {
                resourceKind,
                action,
            };
        }
    } else if (resourceKind === 'package.version') {
        if (action === 'read' || action === 'list' || action === 'run') {
            return {
                resourceKind,
                action,
            };
        }
    }

    return null;
}

export function getPublicMarkerPermission(
    marker: string,
    resourceKind: ResourceKinds,
    action: ActionKinds
) {
    if (marker === PUBLIC_READ_MARKER) {
        return getPublicReadPermission(resourceKind, action);
    } else if (marker === PUBLIC_WRITE_MARKER) {
        return getPublicWritePermission(resourceKind, action);
    }

    return null;
}

export function getPublicMarkersPermission(
    markers: string[],
    resourceKind: ResourceKinds,
    action: ActionKinds
) {
    for (let marker of markers) {
        const result = getPublicMarkerPermission(marker, resourceKind, action);
        if (result) {
            return {
                marker,
                ...result,
            };
        }
    }
    return null;
}

export function getSubjectUserId(
    subjectType: SubjectType,
    subjectId: string
): string | null {
    if (subjectType === 'user') {
        return subjectId;
    }
    return null;
}

export interface UserPrivacyFeatures extends PrivacyFeatures {
    /**
     * The role of the user.
     * Null or undefined if the user doesn't have a role.
     */
    userRole?: UserRole | null;
}
