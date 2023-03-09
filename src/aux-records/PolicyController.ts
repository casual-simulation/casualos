import { AuthController } from './AuthController';
import { RecordsController } from './RecordsController';
import { ServerError } from './Errors';
import {
    ADMIN_ROLE_NAME,
    AssignPolicyPermission,
    AvailablePermissions,
    CreateDataPermission,
    Permission,
    PolicyDocument,
} from './PolicyPermissions';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { PolicyStore } from './PolicyStore';

/**
 * Defines a class that is able to calculate the policies and permissions that are allowed for specific actions.
 */
export class PolicyController {
    private _auth: AuthController;
    private _records: RecordsController;
    private _policies: PolicyStore;

    constructor(
        auth: AuthController,
        records: RecordsController,
        policies: PolicyStore
    ) {
        this._auth = auth;
        this._records = records;
        this._policies = policies;
    }

    /**
     * Attempts to authorize the given request.
     * Returns a promise that resolves with information about the security properties of the request.
     * @param request The request.
     */
    async authorizeRequest(
        request: AuthorizeRequest
    ): Promise<AuthorizeResult> {
        try {
            if (request.action === 'data.create') {
                return this._authorizeDataCreateRequest(request);
            }

            return {
                allowed: false,
                errorCode: 'action_not_supported',
                errorMessage: 'The given action is not supported.',
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                allowed: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private async _authorizeDataCreateRequest(
        request: AuthorizeDataCreateRequest
    ): Promise<AuthorizeResult> {
        let possiblePermissions =
            [] as PossiblePermission<CreateDataPermission>[];

        for (let marker of request.resourceMarkers) {
            const permissions =
                await this._listPermissionsForAction<CreateDataPermission>(
                    request.recordName,
                    request.action,
                    marker
                );
            for (let possible of permissions) {
                if (possible.permission.addresses === true) {
                    possiblePermissions.push(possible);
                }
            }
        }

        const recordKeyResult = !!request.recordKey
            ? await this._records.validatePublicRecordKey(request.recordKey)
            : null;

        const subjectPolicy =
            !!recordKeyResult && recordKeyResult.success
                ? recordKeyResult.policy
                : 'subjectfull';
        let role: string | true | null = null;
        let actionPermission: AvailablePermissions | null = null;
        let actionPolicy: PolicyDocument | null = null;

        let userRoles: Set<string>;

        for (let possible of possiblePermissions) {
            // attempt to impersonate role
            if (possible.permission.role === true) {
                // Everyone is allowed
                role = true;
                actionPermission = possible.permission;
                actionPolicy = possible.policy;
                break;
            }
            if (possible.permission.role === ADMIN_ROLE_NAME) {
                if (
                    recordKeyResult &&
                    recordKeyResult.success &&
                    recordKeyResult.recordName === request.recordName
                ) {
                    role = ADMIN_ROLE_NAME;
                    actionPermission = possible.permission;
                    actionPolicy = possible.policy;
                    break;
                }
            }
            if (!!request.userId) {
                if (!userRoles) {
                    userRoles = await this._policies.listRolesForUser(
                        request.recordName,
                        request.userId
                    );
                }

                if (userRoles.has(possible.permission.role)) {
                    role = possible.permission.role;
                    actionPermission = possible.permission;
                    actionPolicy = possible.policy;
                    break;
                }
            }
        }

        if (!role) {
            return {
                allowed: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            };
        }

        let authorizedMarkers = [] as AuthorizedMarker[];
        let allMarkersAuthorized = true;

        for (let marker of request.resourceMarkers) {
            const permissions =
                await this._listPermissionsForAction<AssignPolicyPermission>(
                    request.recordName,
                    'policy.assign',
                    marker
                );

            let markerPolicy: PolicyDocument | null = null;
            let markerPermission: AvailablePermissions | null = null;

            for (let possible of permissions) {
                const roleMatches =
                    possible.permission.role === true ||
                    possible.permission.role === role;
                const policyMatches =
                    possible.permission.policies === true ||
                    this._testRegex(possible.permission.policies, marker);
                if (roleMatches && policyMatches) {
                    markerPolicy = possible.policy;
                    markerPermission = possible.permission;
                    break;
                }
            }

            if (!markerPolicy || !markerPermission) {
                allMarkersAuthorized = false;
                break;
            } else {
                authorizedMarkers.push({
                    marker,
                    policy: markerPolicy,
                    permission: markerPermission,
                });
            }
        }

        if (!allMarkersAuthorized) {
            return {
                allowed: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            };
        }

        return {
            allowed: true,
            role,
            actionPolicy,
            actionPermission,
            subjectPolicy,
            resourceMarkers: authorizedMarkers,
        };
    }

    private _testRegex(regex: string, value: string): boolean {
        return new RegExp(regex).test(value);
    }

    private async _listPermissionsForAction<T extends AvailablePermissions>(
        recordName: string,
        action: T['type'],
        marker: string
    ): Promise<PossiblePermission<T>[]> {
        const policies = await this._policies.listPoliciesForMarker(
            recordName,
            marker
        );

        let permissions = [] as PossiblePermission<T>[];
        for (let policy of policies) {
            for (let permission of policy.permissions) {
                if (permission.type === action) {
                    permissions.push({
                        policy,
                        permission: permission as T,
                    });
                }
            }
        }

        return permissions;
    }

    // private async _authorizeActionForMarker(action: string, marker: string, request: AuthorizeRequestBase): Promise<void> {
    //     const policies = await this._policies.listPoliciesForMarker(marker);

    //     for (let policy of policies) {
    //         for(let permission of policy.permissions) {
    //             if (permission.type !== action) {
    //                 continue;
    //             }

    //         }
    //     }
    // }
}

interface PossiblePermission<T> {
    policy: PolicyDocument;
    permission: T;
}

export type AuthorizeRequest = AuthorizeDataCreateRequest;

export interface AuthorizeRequestBase {
    /**
     * The name of the record that the request is being authorized for.
     */
    recordName: string;

    /**
     * The type of the action that is being authorized.
     */
    action: string;

    /**
     * The record key that was included in the request.
     */
    recordKey?: string | null;

    /**
     * The ID of the user that is currently logged in.
     */
    userId?: string | null;

    /**
     * The instances that the request is being made from.
     */
    instances?: string[] | null;
}

export interface AuthorizeDataCreateRequest extends AuthorizeRequestBase {
    action: 'data.create';

    /**
     * The address that the new record will be placed at.
     */
    address: string;

    /**
     * The list of resource markers that should be applied to the data.
     */
    resourceMarkers: string[];
}

export type AuthorizeResult = AuthorizeAllowed | AuthorizeDenied;

export interface AuthorizeAllowed {
    allowed: true;

    /**
     * The role that was selected.
     *
     * If true, then that indicates that the "everyone" role was used.
     * If a string, then that is the name of the role that was used.
     */
    role: string | true;

    /**
     * The policy document that authorizes the action.
     */
    actionPolicy: PolicyDocument;

    /**
     * The policy that should be used for the storage of subject information.
     */
    subjectPolicy: PublicRecordKeyPolicy;

    /**
     * The permission that authorizes the request to be performed.
     */
    actionPermission: AvailablePermissions;

    /**
     * The list of markers that were authorized.
     */
    resourceMarkers: AuthorizedMarker[];

    /**
     * The list of instances that were authorized.
     */
    instPermissions: AuthorizedInst[];
}

export interface AuthorizedMarker {
    /**
     * The marker that was checked.
     */
    marker: string;

    /**
     * The policy that authorizes the operation for the marker.
     */
    policy: PolicyDocument;

    /**
     * The permission that authorizes the operation for the marker.
     */
    permission: AvailablePermissions;
}

export interface AuthorizedInst {
    /**
     * The name of the inst that was authorized.
     */
    inst: string;

    /**
     * The policy that authorizes the operation for this inst.
     */
    policy: PolicyDocument;

    /**
     * The permission that authorizes the operation for this inst.
     */
    permission: AvailablePermissions;
}

export interface AuthorizeDenied {
    allowed: false;
    errorCode: ServerError | 'action_not_supported' | 'not_authorized';
    errorMessage: string;
}
