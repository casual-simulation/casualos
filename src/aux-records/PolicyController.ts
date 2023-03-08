import { ServerError } from './Errors';
import { AvailablePermissions, PolicyDocument } from './PolicyPermissions';
import { PublicRecordKeyPolicy } from './RecordsStore';

/**
 * Defines a class that is able to calculate the policies and permissions that are allowed for specific actions.
 */
export class PolicyController {
    /**
     * Attempts to authorize the given request.
     * Returns a promise that resolves with information about the security properties of the request.
     * @param request The request.
     */
    async authorizeRequest(
        request: AuthorizeRequest
    ): Promise<AuthorizeResult> {
        return {
            allowed: false,
            errorCode: 'action_not_supported',
            errorMessage: 'The given action is not supported.',
        };
    }
}

export type AuthorizeRequest = AuthorizeDataCreateRequest;

export interface AuthorizeRequestBase {
    /**
     * The type of the action that is being authorized.
     */
    action: string;

    /**
     * The record key that was included in the request.
     */
    recordKey?: string | null;

    /**
     * The resource markers that are currently on the target resource.
     * Should be null/undefined if the resource does not exist.
     */
    existingResourceMarkers?: string[] | null;

    /**
     * The resource markers that should be placed on new resources.
     * Should be null/undefined if the action does not create a resource.
     */
    newResourceMarkers?: string[] | null;
}

export interface AuthorizeDataCreateRequest extends AuthorizeRequestBase {
    action: 'data.create';

    /**
     * The address that the new record will be placed at.
     */
    address: string;
}

export type AuthorizeResult = AuthorizeAllowed | AuthorizeDenied;

export interface AuthorizeAllowed {
    allowed: true;

    /**
     * The role that was selected.
     */
    selectedRole: string;

    /**
     * The policy document that authorizes the request.
     */
    selectedPolicy: PolicyDocument;

    /**
     * The policy that should be used for the storage of subject information.
     */
    subjectPolicy: PublicRecordKeyPolicy;
}

export interface AuthorizeDenied {
    allowed: false;
    errorCode: ServerError | 'action_not_supported';
    errorMessage: string;
}
