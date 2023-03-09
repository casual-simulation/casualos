import { PolicyDocument } from 'PolicyPermissions';

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
}
