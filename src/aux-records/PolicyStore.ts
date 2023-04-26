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
     * Lists the roles that are assigned to the user.
     * @param recordName The name of the record that the role assignments belong to.
     * @param userId The ID of the user.
     */
    listRolesForUser(recordName: string, userId: string): Promise<Set<string>>;

    /**
     * Lists the roles that are assigned to the given inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    listRolesForInst(recordName: string, inst: string): Promise<Set<string>>;

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
        policy: UserPolicy
    ): Promise<UpdateUserPolicyResult>;
}

/**
 * Defines an interface that represents a user-created policy.
 */
export interface UserPolicy {
    /**
     * The policy document.
     */
    document: PolicyDocument;

    /**
     * The list of markers that are applied to the policy.
     */
    markers: string[];
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
