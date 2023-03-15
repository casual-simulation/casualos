import { AuthController } from './AuthController';
import {
    RecordsController,
    ValidatePublicRecordKeyResult,
} from './RecordsController';
import { ServerError } from './Errors';
import {
    ADMIN_ROLE_NAME,
    AssignPolicyPermission,
    AvailableDataPermissions,
    AvailablePermissions,
    AvailablePolicyPermissions,
    CreateDataPermission,
    DataPermission,
    Permission,
    PolicyDocument,
    PolicyPermission,
} from './PolicyPermissions';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { PolicyStore } from './PolicyStore';
import { UserPacket } from 'livekit-server-sdk/dist/proto/livekit_models';

/**
 * The maximum number of instances that can be authorized at once.
 */
export const MAX_ALLOWED_INSTANCES = 2;

/**
 * The maximum number of markers that can be placed on a resource at once.
 */
export const MAX_ALLOWED_MARKERS = 2;

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
        const recordKeyResult = !!request.recordKey
            ? await this._records.validatePublicRecordKey(request.recordKey)
            : null;

        if (recordKeyResult) {
            if (recordKeyResult.success === false) {
                return {
                    allowed: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                };
            } else {
                if (recordKeyResult.recordName !== request.recordName) {
                    return {
                        allowed: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                    };
                }
            }
        }

        const subjectPolicy =
            !!recordKeyResult && recordKeyResult.success
                ? recordKeyResult.policy
                : 'subjectfull';

        let rolesContext: RolesContext = {
            userRoles: null,
            instRoles: {},
        };

        const markers = await this._listPermissionsForMarkers(
            request.recordName,
            request.resourceMarkers
        );

        const userAuthorization = await this._authorizeCreateDataMarkers(
            rolesContext,
            markers,
            recordKeyResult,
            request,
            'user',
            request.userId
        );
        if (!userAuthorization) {
            return {
                allowed: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
            };
        }

        let authorizedInstances: InstEnvironmentAuthorization[] = [];
        if (request.instances) {
            for (let inst of request.instances) {
                if (recordKeyResult?.success) {
                    authorizedInstances.push({
                        authorizationType: 'not_required',
                        inst,
                    });
                    continue;
                }

                const authorization = await this._authorizeCreateDataMarkers(
                    rolesContext,
                    markers,
                    recordKeyResult,
                    request,
                    'inst',
                    inst
                );
                if (!authorization) {
                    return {
                        allowed: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                    };
                }

                authorizedInstances.push({
                    inst,
                    authorizationType: 'allowed',
                    ...authorization,
                });
            }
        }

        return {
            allowed: true,
            subject: {
                ...userAuthorization,
                subjectPolicy: subjectPolicy,
            },
            instances: authorizedInstances,
        };
    }

    private async _authorizeCreateDataMarkers(
        context: RolesContext,
        markers: MarkerPermission[],
        recordKeyResult: ValidatePublicRecordKeyResult | null,
        request: AuthorizeDataCreateRequest,
        subjectType: 'user' | 'inst',
        id: string
    ): Promise<GenericAuthorization> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        for (let marker of markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byData('data.create', request.address),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(recordKeyResult),
                              this._bySubjectRole(
                                  context,
                                  subjectType,
                                  request.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                return null;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            const policyPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byPolicy('policy.assign', marker.marker),
                    this._some(
                        this._byEveryoneRole(),
                        this._byRole(actionPermission.permission.role)
                    )
                )
            );

            if (!policyPermission) {
                return null;
            }

            authorizations.push({
                marker: marker.marker,
                actions: [
                    {
                        action: request.action,
                        grantingPolicy: actionPermission.policy,
                        grantingPermission: actionPermission.permission,
                    },
                    {
                        action: 'policy.assign',
                        grantingPolicy: policyPermission.policy,
                        grantingPermission: policyPermission.permission,
                    },
                ],
            });
        }

        if (!role) {
            return null;
        }

        return {
            role,
            markers: authorizations,
        };
    }

    private async _listPermissionsForMarkers(
        recordName: string,
        resourceMarkers: string[]
    ): Promise<MarkerPermission[]> {
        const promises = resourceMarkers.map(async (m) => {
            const policies = await this._policies.listPoliciesForMarker(
                recordName,
                m
            );

            return {
                marker: m,
                policies,
            };
        });

        const markerPolicies = await Promise.all(promises);

        const markers: MarkerPermission[] = [];
        for (let { marker, policies } of markerPolicies) {
            let permissions: PossiblePermission[] = [];
            for (let policy of policies) {
                for (let permission of policy.permissions) {
                    permissions.push({
                        policy,
                        permission,
                    });
                }
            }
            markers.push({
                marker,
                permissions,
            });
        }

        return markers;
    }

    private _every<T extends Array<any>>(
        ...filters: ((...args: T) => Promise<boolean>)[]
    ): (...args: T) => Promise<boolean> {
        return async (...args) => {
            for (let filter of filters) {
                if (!(await filter(...args))) {
                    return false;
                }
            }
            return true;
        };
    }

    private _some<T extends Array<any>>(
        ...filters: ((...args: T) => Promise<boolean>)[]
    ): (...args: T) => Promise<boolean> {
        return async (...args) => {
            for (let filter of filters) {
                if (await filter(...args)) {
                    return true;
                }
            }
            return false;
        };
    }

    private _byType(type: AvailablePermissions['type']) {
        return async (permission: AvailablePermissions) => {
            return permission.type === type;
        };
    }

    private _byData(type: AvailableDataPermissions['type'], address: string) {
        return async (permission: AvailablePermissions) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.addresses === true) {
                return true;
            }
            if (this._testRegex(permission.addresses, address)) {
                return true;
            }
            return false;
        };
    }

    private _byEveryoneRole(): PermissionFilter {
        return this._byRole(true);
    }

    private _byAdminRole(
        recordKeyResult: ValidatePublicRecordKeyResult
    ): PermissionFilter {
        if (!!recordKeyResult && recordKeyResult.success) {
            return this._byRole(ADMIN_ROLE_NAME);
        } else {
            return async () => false;
        }
    }

    // private _byUserRole(context: UserRolesContext, recordName: string, userId: string): PermissionFilter {
    //     if (!userId) {
    //         // Never able to filter by role if the User is not logged in.
    //         return async () => false;
    //     }
    //     return async (permission) => {
    //         if (!context.userRoles) {
    //             context.userRoles = await this._policies.listRolesForUser(
    //                 recordName,
    //                 userId
    //             );
    //         }

    //         return typeof permission.role === 'string' && context.userRoles.has(permission.role);
    //     };
    // }

    private _bySubjectRole(
        context: RolesContext,
        subjectType: 'user' | 'inst',
        recordName: string,
        id: string
    ): PermissionFilter {
        if (!id) {
            return async () => false;
        }
        if (subjectType === 'user') {
            return async (permission) => {
                if (!context.userRoles) {
                    context.userRoles = await this._policies.listRolesForUser(
                        recordName,
                        id
                    );
                }

                return (
                    typeof permission.role === 'string' &&
                    context.userRoles.has(permission.role)
                );
            };
        } else {
            return async (permission) => {
                if (!context.instRoles[id]) {
                    context.instRoles[id] =
                        await this._policies.listRolesForInst(recordName, id);
                }

                return (
                    typeof permission.role === 'string' &&
                    context.instRoles[id].has(permission.role)
                );
            };
        }
    }

    // private _byInstRole(instRolesContext: InstRolesContext, recordName: string, inst: string): PermissionFilter {
    //     if (!inst) {
    //         return async () => false;
    //     }

    //     return async (permission) => {
    //         if (!instRolesContext.instRoles[inst]) {
    //             instRolesContext.instRoles[inst] = await this._policies.listRolesForInst(
    //                 recordName,
    //                 inst
    //             );
    //         }

    //         return typeof permission.role === 'string' && instRolesContext.instRoles[inst].has(permission.role);
    //     };
    // }

    private _byRole(role: string | boolean): PermissionFilter {
        return async (permission) => {
            if (permission.role === role) {
                return true;
            }
            return false;
        };
    }

    private _byPolicy(
        type: AvailablePolicyPermissions['type'],
        marker: string
    ): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.policies === true) {
                return true;
            }

            if (this._testRegex(permission.policies, marker)) {
                return true;
            }

            return false;
        };
    }

    // private async _findAuthorizedMarkersByFilter<T extends PolicyPermission>(markers: string[], recordName: string, action: T['type'], filter: PolicyPermissionFilter<T>): Promise<AuthorizedMarker[] | null> {
    //     let authorizedMarkers = [] as AuthorizedMarker[];

    //     for (let marker of markers) {
    //         let permission = await this._findPermissionByMarkerAndFilter(recordName, action, marker, (permission) => filter(permission, marker));

    //         if (permission) {
    //             authorizedMarkers.push({
    //                 marker,
    //                 permission: permission.permission as AvailablePermissions,
    //                 policy: permission.policy
    //             });
    //         } else {
    //             return null;
    //         }
    //     }

    //     return authorizedMarkers;
    // }

    private _testRegex(regex: string, value: string): boolean {
        try {
            return new RegExp(regex).test(value);
        } catch (err) {
            return false;
        }
    }

    private async _findPermissionByFilter(
        permissions: PossiblePermission[],
        filter: PermissionFilter
    ): Promise<PossiblePermission | null> {
        for (let permission of permissions) {
            if (await filter(permission.permission)) {
                return permission;
            }
        }
        return null;
        // const permission = await this._findPermissionByMarkerAndFilter(recordName, action, marker, filter);
        // if (!permission) {
        //     return null;
        // }
        // return permission;
    }

    // private async _findPermissionByMarkerAndFilter<T extends Permission>(
    //     recordName: string,
    //     action: T['type'],
    //     marker: string,
    //     filter: PermissionFilter
    // ): Promise<PossiblePermission> {
    //     const permissions = await this._listPermissionsForAction<T>(recordName, action, marker);
    //     for (let permission of permissions) {
    //         if (await filter(permission.permission)) {
    //             return permission;
    //         }
    //     }
    //     return null;
    // }

    // private async _listPermissionsForAction<T extends Permission>(
    //     recordName: string,
    //     action: T['type'],
    //     marker: string
    // ): Promise<PossiblePermission<T>[]> {
    //     const policies = await this._policies.listPoliciesForMarker(
    //         recordName,
    //         marker
    //     );

    //     let permissions = [] as PossiblePermission<T>[];
    //     for (let policy of policies) {
    //         for (let permission of policy.permissions) {
    //             if (permission.type === action) {
    //                 permissions.push({
    //                     policy,
    //                     permission: permission as T,
    //                 });
    //             }
    //         }
    //     }

    //     return permissions;
    // }

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

interface MarkerPermission {
    marker: string;
    permissions: PossiblePermission[];
}

interface RolesContext {
    userRoles: Set<string> | null;
    instRoles: {
        [inst: string]: Set<string>;
    };
}

type PolicyPermissionFilter<T extends PolicyPermission> = (
    permission: T,
    marker: string
) => Promise<boolean>;

type PermissionFilter = (permission: AvailablePermissions) => Promise<boolean>;

interface AuthorizedPermission<T extends Permission> {
    role: string;
    subjectPolicy: PublicRecordKeyPolicy;
    permission: T;
    policy: PolicyDocument;
}

interface PossiblePermission {
    policy: PolicyDocument;
    permission: AvailablePermissions;
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

    // /**
    //  * The role that was selected.
    //  *
    //  * If true, then that indicates that the "everyone" role was used.
    //  * If a string, then that is the name of the role that was used.
    //  */
    // role: string | true;

    /**
     * The authorization information about the subject.
     */
    subject: SubjectAuthorization;

    /**
     * The authorization information about the instances.
     */
    instances: InstEnvironmentAuthorization[];
}

export interface GenericAuthorization {
    /**
     * The role that was selected for authorization.
     *
     * If true, then that indicates that the "everyone" role was used.
     * If a string, then that is the name of the role that was used.
     */
    role: string | true;

    /**
     * The security markers that were evaluated.
     */
    markers: MarkerAuthorization[];
}

/**
 * Defines an interface that contains authorization information aboutthe subject that is party to an action.
 *
 * Generally, this includes information about the user and if they have the correct permissions for the action.
 */
export interface SubjectAuthorization extends GenericAuthorization {
    /**
     * the policy that should be used for storage of subject information.
     */
    subjectPolicy: PublicRecordKeyPolicy;
}

/**
 * Defines an interface that represents the result of calculating whether a particular action is authorized for a particular marker.
 */
export interface MarkerAuthorization {
    /**
     * The marker that the authorization is for.
     */
    marker: string;

    /**
     * The actions that have been authorized for the marker.
     */
    actions: ActionAuthorization[];
}

/**
 * Defines an interface that represents the result of calculating the policy and permission that grants a particular action.
 */
export interface ActionAuthorization {
    /**
     * The action that was granted.
     */
    action: AvailablePermissions['type'];

    /**
     * The policy document that authorizes the action.
     */
    grantingPolicy: PolicyDocument;

    /**
     * The permission that authorizes the action to be performed.
     */
    grantingPermission: AvailablePermissions;
}

/**
 * Defines an interface that contains authorization information about the environment that is party to an action.
 *
 * Generally, this includes information about the inst that is triggering the operation.
 */
export type InstEnvironmentAuthorization = AuthorizedInst | NotRequiredInst;

export interface AuthorizedInst extends GenericAuthorization {
    /**
     * The type of authorization that this inst has received.
     */
    authorizationType: 'allowed';

    /**
     * The inst that was authorized.
     */
    inst: string;
}

export interface NotRequiredInst {
    /**
     * The inst that was authorized.
     */
    inst: string;

    /**
     * The type of authorization that this inst has received.
     */
    authorizationType: 'not_required';
}

export interface AuthorizeDenied {
    allowed: false;
    errorCode: ServerError | 'action_not_supported' | 'not_authorized';
    errorMessage: string;
}
