import { ServerError } from './Errors';
import { PolicyDocument } from './PolicyPermissions';

/**
 * Defines an interface for objects that are able to store and retrieve policy documents.
 */
export interface PolicyStore {
    /**
     * Gets the list of policy documents that apply to the given marker.
     * @param recordName The name of the record that the policies belong to.
     * @param marker The marker.
     */
    listPoliciesForMarker(
        recordName: string,
        marker: string
    ): Promise<PolicyDocument[]>;

    /**
     * Lists the user-created policices for the given record.
     * @param recordName The name of the record.
     * @param startingMarker The marker that policies should be listed after. If null, then the list starts with the first policy.
     */
    listUserPolicies(
        recordName: string,
        startingMarker: string | null
    ): Promise<ListedUserPolicy[]>;

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
     * Gets the user-created policy for the given marker.
     * @param recordName The name of the record.
     * @param marker The name of the marker.
     */
    getUserPolicy(
        recordName: string,
        marker: string
    ): Promise<GetUserPolicyResult>;

    /**
     * Updates the policy for the given marker.
     * @param recordName The name of the record.
     * @param marker The name of the marker.
     * @param document The new policy document.
     */
    updateUserPolicy(
        recordName: string,
        marker: string,
        policy: UserPolicyRecord
    ): Promise<UpdateUserPolicyResult>;

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
}

/**
 * Defines an interface that represents a user-created policy.
 */
export interface UserPolicyRecord {
    /**
     * The policy document.
     */
    document: PolicyDocument;

    /**
     * The list of markers that are applied to the policy.
     */
    markers: string[];
}

export interface ListedUserPolicy extends UserPolicyRecord {
    /**
     * The marker that this policy is for.
     */
    marker: string;
}

export type GetUserPolicyResult = GetUserPolicySuccess | GetUserPolicyFailure;

export interface GetUserPolicySuccess {
    success: true;
    document: PolicyDocument;
    markers: string[];
}

export interface GetUserPolicyFailure {
    success: false;
    errorCode: ServerError | 'policy_not_found';
    errorMessage: string;
}

export type UpdateUserPolicyResult =
    | UpdateUserPolicySuccess
    | UpdateUserPolicyFailure;

export interface UpdateUserPolicySuccess {
    success: true;
}

export interface UpdateUserPolicyFailure {
    success: false;
    errorCode: ServerError | 'policy_too_large';
    errorMessage: string;
}

export interface UpdateRolesUpdate {
    /**
     * The roles that should be assigned.
     */
    roles: AssignedRole[];
}

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

export interface ListedRoleAssignments {
    assignments: RoleAssignment[];
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

/**
 * Gets the expiration time that can be used for comparision.
 * If given null, then this function returns Infinity.
 * Otherwise, it returns the given time.
 * @param expireTimeMs The time that the role expires in milliseconds.
 */
export function getExpireTime(expireTimeMs: number | null): number {
    return expireTimeMs ?? Infinity;
}
