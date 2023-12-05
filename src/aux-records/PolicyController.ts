import { AuthController } from './AuthController';
import {
    isRecordKey,
    RecordsController,
    ValidatePublicRecordKeyFailure,
    ValidatePublicRecordKeyResult,
} from './RecordsController';
import {
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import {
    ADMIN_ROLE_NAME,
    AssignPolicyPermission,
    AvailableDataPermissions,
    AvailableEventPermissions,
    AvailableFilePermissions,
    AvailablePermissions,
    AvailablePolicyPermissions,
    CreateDataPermission,
    CreateFilePermission,
    DataPermission,
    Permission,
    PolicyDocument,
    PolicyPermission,
    ACCOUNT_MARKER,
    AvailableRolePermissions,
    AvailableInstPermissions,
    DenialReason,
} from '@casual-simulation/aux-common';
import {
    ListedStudioAssignment,
    PublicRecordKeyPolicy,
    StudioAssignmentRole,
} from './RecordsStore';
import {
    AssignedRole,
    getExpireTime,
    GetUserPolicyFailure,
    ListedUserPolicy,
    ListMarkerPoliciesResult,
    PolicyStore,
    RoleAssignment,
    UpdateUserPolicyFailure,
    UpdateUserRolesFailure,
    UserPolicyRecord,
} from './PolicyStore';
import { intersectionBy, isEqual, sortBy, union } from 'lodash';

/**
 * The maximum number of instances that can be authorized at once.
 */
export const MAX_ALLOWED_INSTANCES = 2;

/**
 * The maximum number of markers that can be placed on a resource at once.
 */
export const MAX_ALLOWED_MARKERS = 2;

/**
 * A generic not_authorized result.
 */
export const NOT_AUTHORIZED_RESULT: Omit<AuthorizeDenied, 'reason'> = {
    allowed: false,
    errorCode: 'not_authorized',
    errorMessage: 'You are not authorized to perform this action.',
};

/**
 * A not_authorized result that indicates too many instances were used.
 */
export const NOT_AUTHORIZED_TO_MANY_INSTANCES_RESULT: AuthorizeResult = {
    allowed: false,
    errorCode: 'not_authorized',
    errorMessage: `This action is not authorized because more than ${MAX_ALLOWED_INSTANCES} instances are loaded.`,
    reason: {
        type: 'too_many_insts',
    },
};

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
     * Constructs the authorization context that is needed for the given request.
     * @param request The request that will be authorized.
     * @returns The authorization context that will be used to evaluate whether the request is authorized.
     */
    async constructAuthorizationContext(
        request: Omit<AuthorizeRequestBase, 'action'>
    ): Promise<ConstructAuthorizationContextResult> {
        let recordKeyResult: ValidatePublicRecordKeyResult | null = null;
        let recordName: string;
        let ownerId: string;
        let studioId: string;
        let studioMembers: ListedStudioAssignment[] = undefined;
        const recordKeyProvided = isRecordKey(request.recordKeyOrRecordName);
        if (recordKeyProvided) {
            recordKeyResult = await this._records.validatePublicRecordKey(
                request.recordKeyOrRecordName
            );
            if (recordKeyResult.success === true) {
                recordName = recordKeyResult.recordName;
                ownerId = recordKeyResult.ownerId;
            } else {
                return {
                    success: false,
                    errorCode: recordKeyResult.errorCode,
                    errorMessage: recordKeyResult.errorMessage,
                };
            }
        } else {
            const result = await this._records.validateRecordName(
                request.recordKeyOrRecordName,
                request.userId
            );

            if (result.success === false) {
                return {
                    success: false,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                };
            }

            recordName = result.recordName;
            ownerId = result.ownerId;
            studioId = result.studioId;
            studioMembers = result.studioMembers;
        }

        const subjectPolicy =
            !!recordKeyResult && recordKeyResult.success
                ? recordKeyResult.policy
                : 'subjectfull';

        const context: AuthorizationContext = {
            recordName,
            recordKeyResult,
            subjectPolicy,
            recordKeyProvided,
            recordOwnerId: ownerId,
            recordStudioId: studioId,
            recordStudioMembers: studioMembers,
        };

        return {
            success: true,
            context,
        };
    }

    /**
     * Attempts to authorize the given request.
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeRequest(
        request: AuthorizeRequest
    ): Promise<AuthorizeResult> {
        try {
            const context = await this.constructAuthorizationContext(request);
            if (context.success === false) {
                return {
                    allowed: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }
            return await this._authorizeRequestUsingContext(
                context.context,
                request
            );
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                allowed: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to authorize the given request.
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeRequestUsingContext(
        context: AuthorizationContext,
        request: AuthorizeRequest
    ): Promise<AuthorizeResult> {
        try {
            return this._authorizeRequestUsingContext(context, request);
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                allowed: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to grant a permission to a marker.
     * @param request The request for the operation.
     */
    async grantMarkerPermission(
        request: GrantMarkerPermissionRequest
    ): Promise<GrantMarkerPermissionResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordKeyOrRecordName,
                userId: request.userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'policy.grantPermission',
                    ...baseRequest,
                    policy: request.marker,
                    instances: request.instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const policyResult = await this._policies.getUserPolicy(
                context.context.recordName,
                request.marker
            );

            if (
                policyResult.success === false &&
                policyResult.errorCode !== 'policy_not_found'
            ) {
                console.log(
                    `[PolicyController] Failure while retrieving policy for ${context.context.recordName} and ${request.marker}.`,
                    policyResult
                );
                return {
                    success: false,
                    errorCode: policyResult.errorCode,
                    errorMessage: policyResult.errorMessage,
                };
            }

            const policy: UserPolicyRecord = policyResult.success
                ? policyResult
                : {
                      document: {
                          permissions: [],
                      },
                      markers: [ACCOUNT_MARKER],
                  };

            const alreadyExists = policy.document.permissions.some((p) =>
                isEqual(p, request.permission)
            );

            if (!alreadyExists) {
                console.log(
                    `[PolicyController] Adding permission to policy for ${context.context.recordName} and ${request.marker}.`,
                    request.permission
                );
                policy.document.permissions.push(request.permission);
                const updateResult = await this._policies.updateUserPolicy(
                    context.context.recordName,
                    request.marker,
                    {
                        document: policy.document,
                        markers: policy.markers,
                    }
                );

                if (updateResult.success === false) {
                    console.log(
                        `[PolicyController] Policy update failed:`,
                        updateResult
                    );
                    return updateResult;
                }
            }

            return {
                success: true,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to revoke a permission from a marker.
     * @param request The request for the operation.
     */
    async revokeMarkerPermission(
        request: RevokeMarkerPermissionRequest
    ): Promise<RevokeMarkerPermissionResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: request.recordKeyOrRecordName,
                userId: request.userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'policy.revokePermission',
                    ...baseRequest,
                    policy: request.marker,
                    instances: request.instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const policyResult = await this._policies.getUserPolicy(
                context.context.recordName,
                request.marker
            );

            if (policyResult.success === false) {
                if (policyResult.errorCode === 'policy_not_found') {
                    return {
                        success: true,
                    };
                }
                console.log(
                    `[PolicyController] Failure while retrieving policy for ${context.context.recordName} and ${request.marker}.`,
                    policyResult
                );
                return {
                    success: false,
                    errorCode: policyResult.errorCode,
                    errorMessage: policyResult.errorMessage,
                };
            }

            const policy: UserPolicyRecord = policyResult;

            let hasUpdate = false;
            for (let i = 0; i < policy.document.permissions.length; i++) {
                const p = policy.document.permissions[i];
                if (isEqual(p, request.permission)) {
                    hasUpdate = true;
                    policy.document.permissions.splice(i, 1);
                    i--;
                }
            }

            if (hasUpdate) {
                console.log(
                    `[PolicyController] Removing permission from policy for ${context.context.recordName} and ${request.marker}.`,
                    request.permission
                );
                const updateResult = await this._policies.updateUserPolicy(
                    context.context.recordName,
                    request.marker,
                    {
                        document: policy.document,
                        markers: policy.markers,
                    }
                );

                if (updateResult.success === false) {
                    console.log(
                        `[PolicyController] Policy update failed:`,
                        updateResult
                    );
                    return updateResult;
                }
            }

            return {
                success: true,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to read the policy for a marker.
     * @param recordKeyOrRecordName The record key or record name.
     * @param userId The ID of the user that is currently logged in.
     * @param marker The marker.
     * @param instances The instances that the request is being made from.
     */
    async readUserPolicy(
        recordKeyOrRecordName: string,
        userId: string,
        marker: string,
        instances?: string[] | null
    ): Promise<ReadUserPolicyResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            // Fetch the policy before authorizing because we will need to know which
            // markers are applied to the policy
            const result = await this._policies.getUserPolicy(
                context.context.recordName,
                marker
            );

            if (result.success === false) {
                return result;
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'policy.read',
                    ...baseRequest,
                    policy: marker,
                    instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            return {
                success: true,
                document: result.document,
                markers: result.markers,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to list the policies for a record.
     * @param recordKeyOrRecordName The record key or the name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param startingMarker The marker that policies should be returned after.
     * @param instances The instances that the request is being made from.
     */
    async listUserPolicies(
        recordKeyOrRecordName: string,
        userId: string,
        startingMarker: string | null,
        instances?: string[]
    ): Promise<ListUserPoliciesResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'policy.list',
                    ...baseRequest,
                    instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const result = await this._policies.listUserPolicies(
                context.context.recordName,
                startingMarker
            );

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                policies: result.policies,
                totalCount: result.totalCount,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to list the roles that are assigned to a user.
     * @param recordKeyOrRecordName The record key or the name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param subjectId The ID of the user whose roles should be listed.
     * @param instances The instances that the request is being made from.
     */
    async listUserRoles(
        recordKeyOrRecordName: string,
        userId: string,
        subjectId: string,
        instances?: string[]
    ): Promise<ListAssignedUserRolesResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            if (userId !== subjectId || (!!instances && instances.length > 0)) {
                const authorization = await this.authorizeRequestUsingContext(
                    context.context,
                    {
                        action: 'role.list',
                        ...baseRequest,
                        instances,
                    }
                );

                if (authorization.allowed === false) {
                    return returnAuthorizationResult(authorization);
                }
            }

            const result = await this._policies.listRolesForUser(
                context.context.recordName,
                subjectId
            );

            return {
                success: true,
                roles: sortBy(result, (r) => r.role),
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to list the roles that are assigned to an inst.
     * @param recordKeyOrRecordName The record key or the name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param subjectId The ID of the inst whose roles should be listed.
     * @param instances The instances that the request is being made from.
     */
    async listInstRoles(
        recordKeyOrRecordName: string,
        userId: string,
        subjectId: string,
        instances?: string[]
    ): Promise<ListAssignedInstRolesResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'role.list',
                    ...baseRequest,
                    instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const result = await this._policies.listRolesForInst(
                context.context.recordName,
                subjectId
            );

            return {
                success: true,
                roles: sortBy(result, (r) => r.role),
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to list the entities that are assigned the given role.
     * @param recordKeyOrRecordName The record key or the name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param role The name of the role whose assigments should be listed.
     * @param instances The instances that the request is being made from.
     */
    async listAssignedRoles(
        recordKeyOrRecordName: string,
        userId: string,
        role: string,
        instances?: string[]
    ): Promise<ListRoleAssignmentsResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'role.list',
                    ...baseRequest,
                    instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const result = await this._policies.listAssignmentsForRole(
                context.context.recordName,
                role
            );

            return {
                success: true,
                assignments: result.assignments,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Lists the role assignments that have been made in the given record.
     * @param recordKeyOrRecordName The record key or record name.
     * @param userId The ID of the user that is currently logged in.
     * @param startingRole The role that assignments should be returned after.
     * @param instances The instances that the request is being made from.
     */
    async listRoleAssignments(
        recordKeyOrRecordName: string,
        userId: string,
        startingRole: string | null,
        instances?: string[]
    ): Promise<ListRoleAssignmentsResult> {
        try {
            if (!this._policies.listAssignments) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'role.list',
                    ...baseRequest,
                    instances,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            const result = await this._policies.listAssignments(
                context.context.recordName,
                startingRole
            );

            return {
                success: true,
                assignments: result.assignments,
                totalCount: result.totalCount,
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to grant a role to a user.
     * @param recordKeyOrRecordName The record key or the name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param request The request to grant the role.
     * @param instances The instances that the request is being made from.
     */
    async grantRole(
        recordKeyOrRecordName: string,
        userId: string,
        request: GrantRoleRequest,
        instances?: string[]
    ): Promise<GrantRoleResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const recordName = context.context.recordName;
            const targetUserId = request.userId;
            const targetInstance = request.instance;
            const expireTimeMs = getExpireTime(request.expireTimeMs);
            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'role.grant',
                    ...baseRequest,
                    instances,
                    role: request.role,
                    targetUserId,
                    targetInstance,
                    expireTimeMs,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            if (targetUserId) {
                const result = await this._policies.assignSubjectRole(
                    recordName,
                    targetUserId,
                    'user',
                    {
                        role: request.role,
                        expireTimeMs,
                    }
                );

                if (result.success === false) {
                    return result;
                }

                return {
                    success: true,
                };
            } else if (targetInstance) {
                const result = await this._policies.assignSubjectRole(
                    recordName,
                    targetInstance,
                    'inst',
                    {
                        role: request.role,
                        expireTimeMs,
                    }
                );

                if (result.success === false) {
                    return result;
                }

                return {
                    success: true,
                };
            }

            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'Either a user ID or an instance must be specified.',
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to revoke a role from a user.
     * @param recordKeyOrRecordName The record key or name of the record.
     * @param userId The ID of the user that is currently logged in.
     * @param request The request to revoke the role.
     * @param instances The instances that the request is being made from.
     */
    async revokeRole(
        recordKeyOrRecordName: string,
        userId: string,
        request: RevokeRoleRequest,
        instances?: string[]
    ): Promise<RevokeRoleResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId: userId,
            };
            const context = await this.constructAuthorizationContext(
                baseRequest
            );
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const recordName = context.context.recordName;
            const targetUserId = request.userId;
            const targetInstance = request.instance;
            const authorization = await this.authorizeRequestUsingContext(
                context.context,
                {
                    action: 'role.revoke',
                    ...baseRequest,
                    instances,
                    role: request.role,
                    targetUserId,
                    targetInstance,
                }
            );

            if (authorization.allowed === false) {
                return returnAuthorizationResult(authorization);
            }

            if (targetUserId) {
                const result = await this._policies.revokeSubjectRole(
                    recordName,
                    targetUserId,
                    'user',
                    request.role
                );

                if (result.success === false) {
                    return result;
                }

                return {
                    success: true,
                };
            } else if (targetInstance) {
                const result = await this._policies.revokeSubjectRole(
                    recordName,
                    targetInstance,
                    'inst',
                    request.role
                );

                if (result.success === false) {
                    return result;
                }

                return {
                    success: true,
                };
            }

            return {
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage:
                    'Either a user ID or an instance must be specified.',
            };
        } catch (err) {
            console.error('[PolicyController] A server error occurred.', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to authorize the given request.
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The authorization context for the request.
     * @param request The request.
     */
    private async _authorizeRequestUsingContext(
        context: AuthorizationContext,
        request: AuthorizeRequest
    ): Promise<AuthorizeResult> {
        if (request.action === 'data.create') {
            return this._authorizeDataCreateRequest(context, request);
        } else if (request.action === 'data.read') {
            return this._authorizeDataReadRequest(context, request);
        } else if (request.action === 'data.update') {
            return this._authorizeDataUpdateRequest(context, request);
        } else if (request.action === 'data.delete') {
            return this._authorizeDataDeleteRequest(context, request);
        } else if (request.action === 'data.list') {
            return this._authorizeDataListRequest(context, request);
        } else if (request.action === 'file.create') {
            return this._authorizeFileCreateRequest(context, request);
        } else if (request.action === 'file.read') {
            return this._authorizeFileReadRequest(context, request);
        } else if (request.action === 'file.list') {
            return this._authorizeFileListRequest(context, request);
        } else if (request.action === 'file.update') {
            return this._authorizeFileUpdateRequest(context, request);
        } else if (request.action === 'file.delete') {
            return this._authorizeFileDeleteRequest(context, request);
        } else if (request.action === 'event.count') {
            return this._authorizeEventCountRequest(context, request);
        } else if (request.action === 'event.increment') {
            return this._authorizeEventIncrementRequest(context, request);
        } else if (request.action === 'event.update') {
            return this._authorizeEventUpdateRequest(context, request);
        } else if (request.action === 'event.list') {
            return this._authorizeEventListRequest(context, request);
        } else if (request.action === 'policy.grantPermission') {
            return this._authorizePolicyGrantPermissionRequest(
                context,
                request
            );
        } else if (request.action === 'policy.revokePermission') {
            return this._authorizePolicyRevokePermissionRequest(
                context,
                request
            );
        } else if (request.action === 'policy.read') {
            return this._authorizePolicyReadRequest(context, request);
        } else if (request.action === 'policy.list') {
            return this._authorizePolicyListRequest(context, request);
        } else if (request.action === 'role.list') {
            return this._authorizeRoleListRequest(context, request);
        } else if (request.action === 'role.read') {
            return this._authorizeRoleReadRequest(context, request);
        } else if (request.action === 'role.grant') {
            return this._authorizeRoleGrantRequest(context, request);
        } else if (request.action === 'role.revoke') {
            return this._authorizeRoleRevokeRequest(context, request);
        } else if (request.action === 'inst.create') {
            return this._authorizeInstCreateRequest(context, request);
        } else if (request.action === 'inst.read') {
            return this._authorizeInstReadRequest(context, request);
        } else if (request.action === 'inst.update') {
            return this._authorizeInstUpdateRequest(context, request);
        } else if (request.action === 'inst.updateData') {
            return this._authorizeInstUpdateDataRequest(context, request);
        } else if (request.action === 'inst.delete') {
            return this._authorizeInstDeleteRequest(context, request);
        } else if (request.action === 'inst.list') {
            return this._authorizeInstListRequest(context, request);
        } else if (request.action === 'inst.sendAction') {
            return this._authorizeInstSendActionRequest(context, request);
        }

        return {
            allowed: false,
            errorCode: 'action_not_supported',
            errorMessage: 'The given action is not supported.',
        };
    }

    private async _authorizeDataCreateRequest(
        context: AuthorizationContext,
        request: AuthorizeDataCreateRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeCreateData(context, type, id);
            }
        );
    }

    /**
     * Authorizes the given subject for data.create requests.
     *
     * @param context The context for the authorization.
     * @param subjectType The type of subject that is being authorized.
     * @param id The ID of the subject.
     * @returns The authorization that approves the subject for the request. Null if the subject is not authorized.
     */
    private async _authorizeCreateData(
        context: RolesContext<AuthorizeDataCreateRequest>,
        subjectType: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byData('data.create', context.request.address),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, subjectType, id),
                              this._bySubjectRole(
                                  context,
                                  subjectType,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'data.create',
                        role,
                    },
                };
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
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'policy.assign',
                        role,
                    },
                };
            }

            authorizations.push({
                marker: marker.marker,
                actions: [
                    {
                        action: context.request.action,
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
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private _authorizeDataReadRequest(
        context: AuthorizationContext,
        request: AuthorizeReadDataRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeDataRead(context, type, id);
            }
        );
    }

    private async _authorizeDataRead(
        context: RolesContext<AuthorizeReadDataRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byData('data.read', context.request.address),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'data.read',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeDataUpdateRequest(
        context: AuthorizationContext,
        request: AuthorizeUpdateDataRequest
    ): Promise<AuthorizeResult> {
        if (
            !willMarkersBeRemaining(
                request.existingMarkers,
                request.removedMarkers,
                request.addedMarkers
            )
        ) {
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: {
                    type: 'no_markers_remaining',
                },
            };
        }

        return this._authorizeRequest(
            context,
            request,
            union(
                request.existingMarkers,
                request.addedMarkers,
                request.removedMarkers
            ),
            (context, type, id) => {
                return this._authorizeDataUpdate(context, type, id);
            }
        );
    }

    private async _authorizeDataUpdate(
        context: RolesContext<AuthorizeUpdateDataRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        // The denial reason for if the user does not have permission from an existing marker.
        let denialReason: DenialReason;
        let hasPermissionFromExistingMarker = false;

        for (let marker of context.markers) {
            const isAddedMarker =
                context.request.addedMarkers &&
                context.request.addedMarkers.includes(marker.marker);
            const isRemovedMarker =
                context.request.removedMarkers &&
                context.request.removedMarkers.includes(marker.marker);
            const isExistingMarker = context.request.existingMarkers.includes(
                marker.marker
            );

            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byData('data.update', context.request.address),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                if (isAddedMarker || isRemovedMarker) {
                    // Deny because the user needs permission for all new & removed markers.
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'data.update',
                            role,
                        },
                    };
                } else {
                    // Record that the user does not have permission from this marker.
                    // May or may not be used depending on if a different existing marker
                    // provides permission.
                    denialReason = {
                        type: 'missing_permission',
                        kind: type,
                        id,
                        marker: marker.marker,
                        permission: 'data.update',
                        role,
                    };
                    continue;
                }
            }

            if (isExistingMarker) {
                hasPermissionFromExistingMarker = true;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            const actions: ActionAuthorization[] = [
                {
                    action: context.request.action,
                    grantingPolicy: actionPermission.policy,
                    grantingPermission: actionPermission.permission,
                },
            ];

            if (isAddedMarker) {
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
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.assign',
                            role,
                        },
                    };
                    continue;
                }

                actions.push({
                    action: 'policy.assign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            } else if (isRemovedMarker) {
                const policyPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byPolicy('policy.unassign', marker.marker),
                        this._some(
                            this._byEveryoneRole(),
                            this._byRole(actionPermission.permission.role)
                        )
                    )
                );

                if (!policyPermission) {
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.unassign',
                            role,
                        },
                    };
                }

                actions.push({
                    action: 'policy.unassign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            }

            authorizations.push({
                marker: marker.marker,
                actions,
            });
        }

        // Deny the request if the user does not have permission from at least one existing marker.
        if (!hasPermissionFromExistingMarker && denialReason) {
            return {
                success: false,
                reason: denialReason,
            };
        }

        if (!role) {
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private _authorizeDataDeleteRequest(
        context: AuthorizationContext,
        request: AuthorizeDeleteDataRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeDataDelete(context, type, id);
            }
        );
    }

    private async _authorizeDataDelete(
        context: RolesContext<AuthorizeDeleteDataRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byData('data.delete', context.request.address),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'data.delete',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeDataListRequest(
        context: AuthorizationContext,
        request: AuthorizeListDataRequest
    ): Promise<AuthorizeResult> {
        const allMarkers = union(...request.dataItems.map((i) => i.markers));
        return await this._authorizeRequest(
            context,
            request,
            allMarkers,
            (context, type, id) => {
                return this._authorizeDataList(context, type, id);
            },
            undefined,
            true
        );
    }

    private async _authorizeDataList(
        context: RolesContext<AuthorizeListDataRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        const allowedDataItems = (context.allowedDataItems =
            [] as ListedDataItem[]);

        const markers = new Map<
            string,
            {
                marker: MarkerPermission;
                authorization: MarkerAuthorization;
                usedPermissions: Set<any>;
            }
        >();
        for (let marker of context.markers) {
            const authorization: MarkerAuthorization = {
                marker: marker.marker,
                actions: [],
            };
            authorizations.push(authorization);
            markers.set(marker.marker, {
                marker,
                authorization: authorization,
                usedPermissions: new Set(),
            });
        }

        for (let item of context.request.dataItems) {
            let itemPermission: PossiblePermission;
            for (let m of item.markers) {
                const a = markers.get(m);
                if (!a) {
                    continue;
                }
                const { marker, authorization, usedPermissions } = a;

                itemPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byData('data.list', item.address),
                        role === null
                            ? this._some(
                                  this._byEveryoneRole(),
                                  this._byAdminRole(context, type, id),
                                  this._bySubjectRole(
                                      context,
                                      type,
                                      context.recordName,
                                      id
                                  )
                              )
                            : this._byRole(role)
                    )
                );

                if (!itemPermission) {
                    continue;
                }

                if (role === null) {
                    role = itemPermission.permission.role;
                }

                if (!usedPermissions.has(itemPermission.permission)) {
                    usedPermissions.add(itemPermission.permission);
                    authorization.actions.push({
                        action: context.request.action,
                        grantingPolicy: itemPermission.policy,
                        grantingPermission: itemPermission.permission,
                    });
                }

                if (itemPermission) {
                    break;
                }
            }

            if (itemPermission) {
                allowedDataItems.push(item);
            }
        }

        if (!role) {
            role = true;
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizeFileCreateRequest(
        context: AuthorizationContext,
        request: AuthorizeCreateFileRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeFileCreate(context, type, id);
            }
        );
    }

    private async _authorizeFileCreate(
        context: RolesContext<AuthorizeCreateFileRequest>,
        subjectType: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byFile(
                        'file.create',
                        context.request.fileSizeInBytes,
                        context.request.fileMimeType
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, subjectType, id),
                              this._bySubjectRole(
                                  context,
                                  subjectType,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'file.create',
                        role,
                    },
                };
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
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'policy.assign',
                        role,
                    },
                };
            }

            authorizations.push({
                marker: marker.marker,
                actions: [
                    {
                        action: context.request.action,
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
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizeFileReadRequest(
        context: AuthorizationContext,
        request: AuthorizeReadFileRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeFileRead(context, type, id);
            }
        );
    }

    private async _authorizeFileRead(
        context: RolesContext<AuthorizeReadFileRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byFile(
                        'file.read',
                        context.request.fileSizeInBytes,
                        context.request.fileMimeType
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'file.read',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeFileListRequest(
        context: AuthorizationContext,
        request: AuthorizeListFileRequest
    ): Promise<AuthorizeResult> {
        const allMarkers = union(...request.fileItems.map((i) => i.markers));
        return await this._authorizeRequest(
            context,
            request,
            allMarkers,
            (context, type, id) => {
                return this._authorizeFileList(context, type, id);
            },
            undefined,
            true
        );
    }

    private async _authorizeFileList(
        context: RolesContext<AuthorizeListFileRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        const allowedFileItems = (context.allowedFileItems =
            [] as ListedFileItem[]);

        const markers = new Map<
            string,
            {
                marker: MarkerPermission;
                authorization: MarkerAuthorization;
                usedPermissions: Set<any>;
            }
        >();
        for (let marker of context.markers) {
            const authorization: MarkerAuthorization = {
                marker: marker.marker,
                actions: [],
            };
            authorizations.push(authorization);
            markers.set(marker.marker, {
                marker,
                authorization: authorization,
                usedPermissions: new Set(),
            });
        }

        for (let item of context.request.fileItems) {
            let itemPermission: PossiblePermission;
            for (let m of item.markers) {
                const a = markers.get(m);
                if (!a) {
                    continue;
                }
                const { marker, authorization, usedPermissions } = a;

                itemPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byFile(
                            'file.list',
                            item.fileSizeInBytes,
                            item.fileMimeType
                        ),
                        role === null
                            ? this._some(
                                  this._byEveryoneRole(),
                                  this._byAdminRole(context, type, id),
                                  this._bySubjectRole(
                                      context,
                                      type,
                                      context.recordName,
                                      id
                                  )
                              )
                            : this._byRole(role)
                    )
                );

                if (!itemPermission) {
                    continue;
                }

                if (role === null) {
                    role = itemPermission.permission.role;
                }

                if (!usedPermissions.has(itemPermission.permission)) {
                    usedPermissions.add(itemPermission.permission);
                    authorization.actions.push({
                        action: context.request.action,
                        grantingPolicy: itemPermission.policy,
                        grantingPermission: itemPermission.permission,
                    });
                }

                if (itemPermission) {
                    break;
                }
            }

            if (itemPermission) {
                allowedFileItems.push(item);
            }
        }

        if (!role) {
            role = true;
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizeFileUpdateRequest(
        context: AuthorizationContext,
        request: AuthorizeUpdateFileRequest
    ): Promise<AuthorizeResult> {
        const allMarkers = union(
            request.existingMarkers,
            request.addedMarkers,
            request.removedMarkers
        );
        return await this._authorizeRequest(
            context,
            request,
            allMarkers,
            (context, type, id) => {
                return this._authorizeFileUpdate(context, type, id);
            }
        );
    }

    private async _authorizeFileUpdate(
        context: RolesContext<AuthorizeUpdateFileRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        if (
            (!context.request.addedMarkers ||
                context.request.addedMarkers.length <= 0) &&
            (!context.request.removedMarkers ||
                context.request.removedMarkers.length <= 0)
        ) {
            return {
                success: false,
                reason: {
                    type: 'no_markers',
                },
            };
        }

        if (
            !willMarkersBeRemaining(
                context.request.existingMarkers,
                context.request.removedMarkers,
                context.request.addedMarkers
            )
        ) {
            return {
                success: false,
                reason: {
                    type: 'no_markers_remaining',
                },
            };
        }

        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byFile(
                        'file.update',
                        context.request.fileSizeInBytes,
                        context.request.fileMimeType
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: type,
                        id,
                        marker: marker.marker,
                        permission: 'file.update',
                        role,
                    },
                };
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            const isAddedMarker =
                context.request.addedMarkers &&
                context.request.addedMarkers.includes(marker.marker);
            const isRemovedMarker =
                context.request.removedMarkers &&
                context.request.removedMarkers.includes(marker.marker);

            const actions: ActionAuthorization[] = [
                {
                    action: context.request.action,
                    grantingPolicy: actionPermission.policy,
                    grantingPermission: actionPermission.permission,
                },
            ];

            if (isAddedMarker) {
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
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.assign',
                            role,
                        },
                    };
                }

                actions.push({
                    action: 'policy.assign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            } else if (isRemovedMarker) {
                const policyPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byPolicy('policy.unassign', marker.marker),
                        this._some(
                            this._byEveryoneRole(),
                            this._byRole(actionPermission.permission.role)
                        )
                    )
                );

                if (!policyPermission) {
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.unassign',
                            role,
                        },
                    };
                }

                actions.push({
                    action: 'policy.unassign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            }

            authorizations.push({
                marker: marker.marker,
                actions,
            });
        }

        if (!role) {
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizeFileDeleteRequest(
        context: AuthorizationContext,
        request: AuthorizeDeleteFileRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeFileDelete(context, type, id);
            }
        );
    }

    private async _authorizeFileDelete(
        context: RolesContext<AuthorizeDeleteFileRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byFile(
                        'file.delete',
                        context.request.fileSizeInBytes,
                        context.request.fileMimeType
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'file.delete',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeEventCountRequest(
        context: AuthorizationContext,
        request: AuthorizeCountEventRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeEventCount(context, type, id);
            }
        );
    }

    private async _authorizeEventCount(
        context: RolesContext<AuthorizeCountEventRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byEvent('event.count', context.request.eventName),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'event.count',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeEventIncrementRequest(
        context: AuthorizationContext,
        request: AuthorizeIncrementEventRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeEventIncrement(context, type, id);
            }
        );
    }

    private async _authorizeEventIncrement(
        context: RolesContext<AuthorizeIncrementEventRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byEvent('event.increment', context.request.eventName),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'event.increment',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeEventUpdateRequest(
        context: AuthorizationContext,
        request: AuthorizeUpdateEventRequest
    ): Promise<AuthorizeResult> {
        if (
            !willMarkersBeRemaining(
                request.existingMarkers,
                request.removedMarkers,
                request.addedMarkers
            )
        ) {
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: {
                    type: 'no_markers_remaining',
                },
            };
        }

        return await this._authorizeRequest(
            context,
            request,
            union(
                request.existingMarkers,
                request.addedMarkers,
                request.removedMarkers
            ),
            (context, type, id) => {
                return this._authorizeEventUpdate(context, type, id);
            }
        );
    }

    private async _authorizeEventUpdate(
        context: RolesContext<AuthorizeUpdateEventRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        // The denial reason for if the user does not have permission from an existing marker.
        let denialReason: DenialReason;
        let hasPermissionFromExistingMarker = false;

        for (let marker of context.markers) {
            const isAddedMarker =
                context.request.addedMarkers &&
                context.request.addedMarkers.includes(marker.marker);
            const isRemovedMarker =
                context.request.removedMarkers &&
                context.request.removedMarkers.includes(marker.marker);
            const isExistingMarker = context.request.existingMarkers.includes(
                marker.marker
            );

            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byEvent('event.update', context.request.eventName),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                if (isAddedMarker || isRemovedMarker) {
                    // Deny because the user needs permission for all new & removed markers.
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'event.update',
                            role,
                        },
                    };
                } else {
                    // Record that the user does not have permission from this marker.
                    // May or may not be used depending on if a different existing marker
                    // provides permission.
                    denialReason = {
                        type: 'missing_permission',
                        kind: type,
                        id,
                        marker: marker.marker,
                        permission: 'event.update',
                        role,
                    };
                    continue;
                }
            }

            if (isExistingMarker) {
                hasPermissionFromExistingMarker = true;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            const actions: ActionAuthorization[] = [
                {
                    action: context.request.action,
                    grantingPolicy: actionPermission.policy,
                    grantingPermission: actionPermission.permission,
                },
            ];

            if (isAddedMarker) {
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
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.assign',
                            role,
                        },
                    };
                    continue;
                }

                actions.push({
                    action: 'policy.assign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            } else if (isRemovedMarker) {
                const policyPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byPolicy('policy.unassign', marker.marker),
                        this._some(
                            this._byEveryoneRole(),
                            this._byRole(actionPermission.permission.role)
                        )
                    )
                );

                if (!policyPermission) {
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.unassign',
                            role,
                        },
                    };
                }

                actions.push({
                    action: 'policy.unassign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            }

            authorizations.push({
                marker: marker.marker,
                actions,
            });
        }

        // Deny the request if the user does not have permission from at least one existing marker.
        if (!hasPermissionFromExistingMarker && denialReason) {
            return {
                success: false,
                reason: denialReason,
            };
        }

        if (!role) {
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizeEventListRequest(
        context: AuthorizationContext,
        request: AuthorizeListEventRequest
    ): Promise<AuthorizeResult> {
        const allMarkers = union(...request.eventItems.map((i) => i.markers));
        return await this._authorizeRequest(
            context,
            request,
            allMarkers,
            (context, type, id) => {
                return this._authorizeEventList(context, type, id);
            },
            undefined,
            true
        );
    }

    private async _authorizeEventList(
        context: RolesContext<AuthorizeListEventRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        const allowedEventItems = (context.allowedEventItems =
            [] as ListedEventItem[]);

        const markers = new Map<
            string,
            {
                marker: MarkerPermission;
                authorization: MarkerAuthorization;
                usedPermissions: Set<any>;
            }
        >();
        for (let marker of context.markers) {
            const authorization: MarkerAuthorization = {
                marker: marker.marker,
                actions: [],
            };
            authorizations.push(authorization);
            markers.set(marker.marker, {
                marker,
                authorization: authorization,
                usedPermissions: new Set(),
            });
        }

        for (let item of context.request.eventItems) {
            let itemPermission: PossiblePermission;
            for (let m of item.markers) {
                const a = markers.get(m);
                if (!a) {
                    continue;
                }
                const { marker, authorization, usedPermissions } = a;

                itemPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byEvent('event.list', item.eventName),
                        role === null
                            ? this._some(
                                  this._byEveryoneRole(),
                                  this._byAdminRole(context, type, id),
                                  this._bySubjectRole(
                                      context,
                                      type,
                                      context.recordName,
                                      id
                                  )
                              )
                            : this._byRole(role)
                    )
                );

                if (!itemPermission) {
                    continue;
                }

                if (role === null) {
                    role = itemPermission.permission.role;
                }

                if (!usedPermissions.has(itemPermission.permission)) {
                    usedPermissions.add(itemPermission.permission);
                    authorization.actions.push({
                        action: context.request.action,
                        grantingPolicy: itemPermission.policy,
                        grantingPermission: itemPermission.permission,
                    });
                }

                if (itemPermission) {
                    break;
                }
            }

            if (itemPermission) {
                allowedEventItems.push(item);
            }
        }

        if (!role) {
            role = true;
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private async _authorizePolicyGrantPermissionRequest(
        context: AuthorizationContext,
        request: AuthorizeGrantPermissionToPolicyRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizePolicyGrantPermission(context, type, id);
            },
            false
        );
    }

    private async _authorizePolicyGrantPermission(
        context: RolesContext<AuthorizeGrantPermissionToPolicyRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byPolicy(
                        'policy.grantPermission',
                        context.request.policy
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'policy.grantPermission',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizePolicyRevokePermissionRequest(
        context: AuthorizationContext,
        request: AuthorizeRevokePermissionToPolicyRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizePolicyRevokePermission(context, type, id);
            },
            false
        );
    }

    private async _authorizePolicyRevokePermission(
        context: RolesContext<AuthorizeRevokePermissionToPolicyRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byPolicy(
                        'policy.revokePermission',
                        context.request.policy
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'policy.revokePermission',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizePolicyReadRequest(
        context: AuthorizationContext,
        request: AuthorizeReadPolicyRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizePolicyRead(context, type, id);
            },
            false
        );
    }

    private async _authorizePolicyRead(
        context: RolesContext<AuthorizeReadPolicyRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byPolicy('policy.read', context.request.policy),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'policy.read',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizePolicyListRequest(
        context: AuthorizationContext,
        request: AuthorizeListPoliciesRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizePolicyList(context, type, id);
            },
            false
        );
    }

    private async _authorizePolicyList(
        context: RolesContext<AuthorizeListPoliciesRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byPolicyList('policy.list'),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'policy.list',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeRoleListRequest(
        context: AuthorizationContext,
        request: AuthorizeListRolesRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizeRoleList(context, type, id);
            },
            false
        );
    }

    private async _authorizeRoleList(
        context: RolesContext<AuthorizeListRolesRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byRoleList('role.list'),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'role.list',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeRoleReadRequest(
        context: AuthorizationContext,
        request: AuthorizeReadRoleRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizeRoleRead(context, type, id);
            },
            false
        );
    }

    private async _authorizeRoleRead(
        context: RolesContext<AuthorizeReadRoleRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byRolePermission('role.read', context.request.role),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'role.read',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeRoleGrantRequest(
        context: AuthorizationContext,
        request: AuthorizeGrantRoleRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizeRoleGrant(context, type, id);
            },
            false
        );
    }

    private async _authorizeRoleGrant(
        context: RolesContext<AuthorizeGrantRoleRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        const durationMs =
            getExpireTime(context.request.expireTimeMs) - Date.now();

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byRoleGrant(
                        'role.grant',
                        context.request.role,
                        context.request.targetUserId,
                        context.request.targetInstance,
                        durationMs
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'role.grant',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeRoleRevokeRequest(
        context: AuthorizationContext,
        request: AuthorizeRevokeRoleRequest
    ): Promise<AuthorizeResult> {
        return await this._authorizeRequest(
            context,
            request,
            [ACCOUNT_MARKER],
            (context, type, id) => {
                return this._authorizeRoleRevoke(context, type, id);
            },
            false
        );
    }

    private async _authorizeRoleRevoke(
        context: RolesContext<AuthorizeRevokeRoleRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byRoleRevoke(
                        'role.revoke',
                        context.request.role,
                        context.request.targetUserId,
                        context.request.targetInstance
                    ),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              ),
                              this._byRecordOwner(context, type, id),
                              this._byStudioRole(context, type, id, 'admin')
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'role.revoke',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeInstCreateRequest(
        context: AuthorizationContext,
        request: AuthorizeInstCreateRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeCreateInst(context, type, id);
            }
        );
    }

    /**
     * Authorizes the given subject for inst.create requests.
     *
     * @param context The context for the authorization.
     * @param subjectType The type of subject that is being authorized.
     * @param id The ID of the subject.
     * @returns The authorization that approves the subject for the request. Null if the subject is not authorized.
     */
    private async _authorizeCreateInst(
        context: RolesContext<AuthorizeInstCreateRequest>,
        subjectType: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.create', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, subjectType, id),
                              this._bySubjectRole(
                                  context,
                                  subjectType,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'inst.create',
                        role,
                    },
                };
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
                return {
                    success: false,
                    reason: {
                        type: 'missing_permission',
                        kind: subjectType,
                        id,
                        marker: marker.marker,
                        permission: 'policy.assign',
                        role,
                    },
                };
            }

            authorizations.push({
                marker: marker.marker,
                actions: [
                    {
                        action: context.request.action,
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
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private _authorizeInstReadRequest(
        context: AuthorizationContext,
        request: AuthorizeInstReadRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeInstRead(context, type, id);
            }
        );
    }

    private async _authorizeInstRead(
        context: RolesContext<AuthorizeInstReadRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.read', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'inst.read',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeInstUpdateRequest(
        context: AuthorizationContext,
        request: AuthorizeInstUpdateRequest
    ): Promise<AuthorizeResult> {
        if (
            !willMarkersBeRemaining(
                request.existingMarkers,
                request.removedMarkers,
                request.addedMarkers
            )
        ) {
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: {
                    type: 'no_markers_remaining',
                },
            };
        }

        return this._authorizeRequest(
            context,
            request,
            union(
                request.existingMarkers,
                request.addedMarkers,
                request.removedMarkers
            ),
            (context, type, id) => {
                return this._authorizeInstUpdate(context, type, id);
            }
        );
    }

    private async _authorizeInstUpdate(
        context: RolesContext<AuthorizeInstUpdateRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        // The denial reason for if the user does not have permission from an existing marker.
        let denialReason: DenialReason;
        let hasPermissionFromExistingMarker = false;

        for (let marker of context.markers) {
            const isAddedMarker =
                context.request.addedMarkers &&
                context.request.addedMarkers.includes(marker.marker);
            const isRemovedMarker =
                context.request.removedMarkers &&
                context.request.removedMarkers.includes(marker.marker);
            const isExistingMarker = context.request.existingMarkers.includes(
                marker.marker
            );

            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.update', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                if (isAddedMarker || isRemovedMarker) {
                    // Deny because the user needs permission for all new & removed markers.
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'inst.update',
                            role,
                        },
                    };
                } else {
                    // Record that the user does not have permission from this marker.
                    // May or may not be used depending on if a different existing marker
                    // provides permission.
                    denialReason = {
                        type: 'missing_permission',
                        kind: type,
                        id,
                        marker: marker.marker,
                        permission: 'inst.update',
                        role,
                    };
                    continue;
                }
            }

            if (isExistingMarker) {
                hasPermissionFromExistingMarker = true;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            const actions: ActionAuthorization[] = [
                {
                    action: context.request.action,
                    grantingPolicy: actionPermission.policy,
                    grantingPermission: actionPermission.permission,
                },
            ];

            if (isAddedMarker) {
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
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.assign',
                            role,
                        },
                    };
                    continue;
                }

                actions.push({
                    action: 'policy.assign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            } else if (isRemovedMarker) {
                const policyPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byPolicy('policy.unassign', marker.marker),
                        this._some(
                            this._byEveryoneRole(),
                            this._byRole(actionPermission.permission.role)
                        )
                    )
                );

                if (!policyPermission) {
                    return {
                        success: false,
                        reason: {
                            type: 'missing_permission',
                            kind: type,
                            id,
                            marker: marker.marker,
                            permission: 'policy.unassign',
                            role,
                        },
                    };
                }

                actions.push({
                    action: 'policy.unassign',
                    grantingPolicy: policyPermission.policy,
                    grantingPermission: policyPermission.permission,
                });
            }

            authorizations.push({
                marker: marker.marker,
                actions,
            });
        }

        // Deny the request if the user does not have permission from at least one existing marker.
        if (!hasPermissionFromExistingMarker && denialReason) {
            return {
                success: false,
                reason: denialReason,
            };
        }

        if (!role) {
            return {
                success: false,
                reason: {
                    type: 'missing_role',
                },
            };
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private _authorizeInstUpdateDataRequest(
        context: AuthorizationContext,
        request: AuthorizeInstUpdateDataRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeInstUpdateData(context, type, id);
            }
        );
    }

    private async _authorizeInstUpdateData(
        context: RolesContext<AuthorizeInstUpdateDataRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.updateData', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'inst.updateData',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private _authorizeInstDeleteRequest(
        context: AuthorizationContext,
        request: AuthorizeInstDeleteRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeInstDelete(context, type, id);
            }
        );
    }

    private async _authorizeInstDelete(
        context: RolesContext<AuthorizeInstDeleteRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.delete', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'inst.delete',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    private async _authorizeInstListRequest(
        context: AuthorizationContext,
        request: AuthorizeInstListRequest
    ): Promise<AuthorizeResult> {
        const allMarkers = union(...request.insts.map((i) => i.markers));
        return await this._authorizeRequest(
            context,
            request,
            allMarkers,
            (context, type, id) => {
                return this._authorizeInstList(context, type, id);
            },
            undefined,
            true
        );
    }

    private async _authorizeInstList(
        context: RolesContext<AuthorizeInstListRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        const authorizations: MarkerAuthorization[] = [];
        let role: string | true | null = null;

        const allowedInstItems = (context.allowedInstItems =
            [] as ListedInstItem[]);

        const markers = new Map<
            string,
            {
                marker: MarkerPermission;
                authorization: MarkerAuthorization;
                usedPermissions: Set<any>;
            }
        >();
        for (let marker of context.markers) {
            const authorization: MarkerAuthorization = {
                marker: marker.marker,
                actions: [],
            };
            authorizations.push(authorization);
            markers.set(marker.marker, {
                marker,
                authorization: authorization,
                usedPermissions: new Set(),
            });
        }

        for (let item of context.request.insts) {
            let itemPermission: PossiblePermission;
            for (let m of item.markers) {
                const a = markers.get(m);
                if (!a) {
                    continue;
                }
                const { marker, authorization, usedPermissions } = a;

                itemPermission = await this._findPermissionByFilter(
                    marker.permissions,
                    this._every(
                        this._byInst('inst.list', item.inst),
                        role === null
                            ? this._some(
                                  this._byEveryoneRole(),
                                  this._byAdminRole(context, type, id),
                                  this._bySubjectRole(
                                      context,
                                      type,
                                      context.recordName,
                                      id
                                  )
                              )
                            : this._byRole(role)
                    )
                );

                if (!itemPermission) {
                    continue;
                }

                if (role === null) {
                    role = itemPermission.permission.role;
                }

                if (!usedPermissions.has(itemPermission.permission)) {
                    usedPermissions.add(itemPermission.permission);
                    authorization.actions.push({
                        action: context.request.action,
                        grantingPolicy: itemPermission.policy,
                        grantingPermission: itemPermission.permission,
                    });
                }

                if (itemPermission) {
                    break;
                }
            }

            if (itemPermission) {
                allowedInstItems.push(item);
            }
        }

        if (!role) {
            role = true;
        }

        return {
            success: true,
            authorization: {
                role,
                markers: authorizations,
            },
        };
    }

    private _authorizeInstSendActionRequest(
        context: AuthorizationContext,
        request: AuthorizeInstSendActionListRequest
    ): Promise<AuthorizeResult> {
        return this._authorizeRequest(
            context,
            request,
            request.resourceMarkers,
            (context, type, id) => {
                return this._authorizeInstSendAction(context, type, id);
            }
        );
    }

    private async _authorizeInstSendAction(
        context: RolesContext<AuthorizeInstSendActionListRequest>,
        type: 'user' | 'inst',
        id: string
    ): Promise<GenericResult> {
        let role: string | true | null = null;
        let denialReason: DenialReason;

        for (let marker of context.markers) {
            const actionPermission = await this._findPermissionByFilter(
                marker.permissions,
                this._every(
                    this._byInst('inst.sendAction', context.request.inst),
                    role === null
                        ? this._some(
                              this._byEveryoneRole(),
                              this._byAdminRole(context, type, id),
                              this._bySubjectRole(
                                  context,
                                  type,
                                  context.recordName,
                                  id
                              )
                          )
                        : this._byRole(role)
                )
            );

            if (!actionPermission) {
                denialReason = {
                    type: 'missing_permission',
                    kind: type,
                    id,
                    marker: marker.marker,
                    permission: 'inst.sendAction',
                    role,
                };
                continue;
            }

            if (role === null) {
                role = actionPermission.permission.role;
            }

            return {
                success: true,
                authorization: {
                    role,
                    markers: [
                        {
                            marker: marker.marker,
                            actions: [
                                {
                                    action: context.request.action,
                                    grantingPolicy: actionPermission.policy,
                                    grantingPermission:
                                        actionPermission.permission,
                                },
                            ],
                        },
                    ],
                },
            };
        }

        return {
            success: false,
            reason: denialReason ?? {
                type: 'missing_role',
            },
        };
    }

    /**
     * Attempts to authorize the given request based on common request properties.
     *
     * Evaluates the recordKey, userId, and instances with the given resource markers and authorize function.
     * The given authorize function will be called with the User ID, and each inst and should return the authorization that should be used for each case.
     * If it returns null, then the request is not authorized and will be rejected as such.
     *
     * @param context The context for the request.
     * @param request The request that should be authorized.
     * @param resourceMarkers The list of markers that need to be validated.
     * @param authorize The function that should be used to authorize each subject in the request.
     * @param skipInstanceChecksWhenValidRecordKeyIsProvided Whether or not to skip instance checks when a valid record key is provided.
     * @param isListOperation Whether the request is a list operation.
     */
    private async _authorizeRequest<T extends AuthorizeRequestBase>(
        context: AuthorizationContext,
        request: T,
        resourceMarkers: string[],
        authorize: (
            context: RolesContext<T>,
            type: 'user' | 'inst',
            id: string
        ) => Promise<GenericResult>,
        skipInstanceChecksWhenValidRecordKeyIsProvided: boolean = true,
        isListOperation: boolean = false
    ): Promise<AuthorizeResult> {
        if (
            request.instances &&
            request.instances.length > MAX_ALLOWED_INSTANCES
        ) {
            console.log(
                `[PolicyController] [action: ${request.action} recordName: ${context.recordName}, userId: ${request.userId}] Request denied because too many instances were provided.`
            );
            // More than 2 instances should be auto-denied.
            // This is a "not_authorized" error instead of an "unacceptable_request" because
            // we want integrators to understand that this is an authentication issue, and not a configuration issue.
            // If more than 2 instances are loaded, we always want those passed to the controller, even if having more than 2 fails authentication.
            return NOT_AUTHORIZED_TO_MANY_INSTANCES_RESULT;
        }

        if (resourceMarkers.length <= 0 && !isListOperation) {
            console.log(
                `[PolicyController] [action: ${request.action} recordName: ${context.recordName}, userId: ${request.userId}] Request denied because there are no markers.`
            );
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: {
                    type: 'no_markers',
                },
            };
        }

        const markers = await this._listPermissionsForMarkers(
            context.recordName,
            request.userId,
            resourceMarkers
        );

        const rolesContext: RolesContext<T> = {
            ...context,
            userRoles: null,
            instRoles: {},
            markers,
            request,
        };

        const userAuthorization = await authorize(
            rolesContext,
            'user',
            request.userId
        );
        if (userAuthorization.success === false) {
            if (!request.userId && !context.recordKeyProvided) {
                console.log(
                    `[PolicyController] [action: ${request.action} recordName: ${context.recordName}] Request denied because the user is not signed in.`
                );
                return {
                    allowed: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }
            console.log(
                `[PolicyController] [action: ${request.action} recordName: ${context.recordName}, userId: ${request.userId}] Request denied. Reason:`,
                userAuthorization.reason
            );
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: userAuthorization.reason,
            };
        }

        const authorizedInstances = await this._authorizeInstances(
            request.instances,
            context.recordKeyResult,
            async (inst) => {
                let currentItems: ListedDataItem[] | null =
                    rolesContext.allowedDataItems?.slice();
                let currentFiles: ListedFileItem[] | null =
                    rolesContext.allowedFileItems?.slice();
                let currentEvents: ListedEventItem[] | null =
                    rolesContext.allowedEventItems?.slice();
                let currentInsts: ListedInstItem[] | null =
                    rolesContext.allowedInstItems?.slice();
                const result = await authorize(rolesContext, 'inst', inst);
                if (currentItems) {
                    rolesContext.allowedDataItems = intersectionBy(
                        currentItems,
                        rolesContext.allowedDataItems,
                        (item) => item.address
                    );
                }
                if (currentFiles) {
                    rolesContext.allowedFileItems = intersectionBy(
                        currentFiles,
                        rolesContext.allowedFileItems,
                        (item) => item.fileName
                    );
                }
                if (currentEvents) {
                    rolesContext.allowedEventItems = intersectionBy(
                        currentEvents,
                        rolesContext.allowedEventItems,
                        (item) => item.eventName
                    );
                }
                if (currentInsts) {
                    rolesContext.allowedInstItems = intersectionBy(
                        currentInsts,
                        rolesContext.allowedInstItems,
                        (item) => item.inst
                    );
                }
                return result;
            },
            skipInstanceChecksWhenValidRecordKeyIsProvided
        );

        if (!Array.isArray(authorizedInstances)) {
            console.log(
                `[PolicyController] [action: ${request.action} recordName: ${context.recordName}, userId: ${request.userId}] Request denied. Reason:`,
                authorizedInstances.reason
            );
            return {
                ...NOT_AUTHORIZED_RESULT,
                reason: authorizedInstances.reason,
            };
        }

        const recordKeyOwnerId = context.recordKeyResult?.success
            ? context.recordKeyResult.keyCreatorId
            : null;
        const authorizerId = recordKeyOwnerId ?? request.userId ?? null;

        console.log(
            `[PolicyController] [action: ${request.action} recordName: ${context.recordName}, userId: ${request.userId}] Request authorized.`
        );

        return {
            allowed: true,
            recordName: context.recordName,
            recordKeyOwnerId: recordKeyOwnerId,
            authorizerId: authorizerId,
            subject: {
                ...userAuthorization.authorization,
                userId: request.userId,
                subjectPolicy: context.subjectPolicy,
            },
            instances: authorizedInstances,
            allowedDataItems: rolesContext.allowedDataItems,
            allowedFileItems: rolesContext.allowedFileItems,
            allowedEventItems: rolesContext.allowedEventItems,
            allowedInstItems: rolesContext.allowedInstItems,
        };
    }

    private async _authorizeInstances(
        instances: string[],
        recordKeyResult: ValidatePublicRecordKeyResult,
        authorize: (inst: string) => Promise<GenericResult>,
        skipInstanceChecksWhenValidRecordKeyIsProvided: boolean
    ): Promise<InstEnvironmentAuthorization[] | GenericDenied> {
        const authorizedInstances: InstEnvironmentAuthorization[] = [];
        if (instances) {
            for (let inst of instances) {
                if (
                    skipInstanceChecksWhenValidRecordKeyIsProvided &&
                    recordKeyResult?.success
                ) {
                    authorizedInstances.push({
                        authorizationType: 'not_required',
                        inst,
                    });
                    continue;
                }

                const authorization = await authorize(inst);
                if (authorization.success === false) {
                    return authorization;
                }

                authorizedInstances.push({
                    inst,
                    authorizationType: 'allowed',
                    ...authorization.authorization,
                });
            }
        }

        return authorizedInstances;
    }

    private async _listPermissionsForMarkers(
        recordName: string,
        userId: string,
        resourceMarkers: string[]
    ): Promise<MarkerPermission[]> {
        const promises = resourceMarkers.map(async (m) => {
            const result = await this._policies.listPoliciesForMarkerAndUser(
                recordName,
                userId,
                m
            );

            return {
                marker: m,
                result,
            };
        });

        const markerPolicies = await Promise.all(promises);

        const markers: MarkerPermission[] =
            filterAndMergeMarkerPermissions(markerPolicies);
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

    private _byFile(
        type: AvailableFilePermissions['type'],
        fileSizeInBytes: number,
        fileMimeType: string
    ) {
        return async (permission: AvailablePermissions) => {
            if (permission.type !== type) {
                return false;
            }
            if (
                typeof permission.maxFileSizeInBytes === 'number' &&
                fileSizeInBytes > permission.maxFileSizeInBytes
            ) {
                return false;
            }
            if (
                typeof permission.allowedMimeTypes === 'object' &&
                Array.isArray(permission.allowedMimeTypes)
            ) {
                if (!permission.allowedMimeTypes.includes(fileMimeType)) {
                    return false;
                }
            }
            return true;
        };
    }

    private _byEvent(
        type: AvailableEventPermissions['type'],
        eventName: string
    ) {
        return async (permission: AvailablePermissions) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.events === true) {
                return true;
            }
            if (this._testRegex(permission.events, eventName)) {
                return true;
            }
            return false;
        };
    }

    private _byInst(type: AvailableInstPermissions['type'], inst: string) {
        return async (permission: AvailablePermissions) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.insts === true) {
                return true;
            }
            if (this._testRegex(permission.insts, inst)) {
                return true;
            }
            return false;
        };
    }

    private _byRecordOwner(
        context: AuthorizationContext,
        subjectType: 'user' | 'inst',
        id: string
    ) {
        if (subjectType === 'inst') {
            return async () => false;
        }

        if (context.recordOwnerId === id) {
            return async () => true;
        }

        return async () => false;
    }

    private _byStudioRole(
        context: AuthorizationContext,
        subjectType: 'user' | 'inst',
        id: string,
        role?: StudioAssignmentRole
    ) {
        if (subjectType === 'inst') {
            return async () => false;
        }

        if (
            !context.recordStudioId ||
            !context.recordStudioMembers ||
            context.recordStudioMembers.length <= 0
        ) {
            return async () => false;
        }

        if (role) {
            return async () =>
                context.recordStudioMembers.some(
                    (m) => m.userId === id && m.role === role
                );
        }

        return async () =>
            context.recordStudioMembers.some((m) => m.userId === id);
    }

    private _byEveryoneRole(): PermissionFilter {
        return this._byRole(true);
    }

    private _byAdminRole(
        context: AuthorizationContext,
        subjectType: 'user' | 'inst',
        id: string
    ): PermissionFilter {
        if (!!context.recordKeyResult && context.recordKeyResult.success) {
            return this._byRole(ADMIN_ROLE_NAME);
        } else if (context.recordStudioId) {
            return this._byStudioRole(context, subjectType, id);
        } else {
            return this._byRecordOwner(context, subjectType, id);
        }
    }

    private _bySubjectRole(
        context: RolesContext<AuthorizeRequestBase>,
        subjectType: 'user' | 'inst',
        recordName: string,
        id: string
    ): PermissionFilter {
        if (!id) {
            return async () => false;
        }
        if (subjectType === 'user') {
            return this._byUserRole(context, recordName, id);
        } else {
            return this._byInstRole(context, recordName, id);
        }
    }

    private _byUserRole(
        context: RolesContext<AuthorizeRequestBase>,
        recordName: string,
        userId: string
    ): PermissionFilter {
        return async (permission) => {
            if (!context.userRoles) {
                const roles = await this._policies.listRolesForUser(
                    recordName,
                    userId
                );
                context.userRoles = new Set(roles.map((r) => r.role));
            }

            return (
                typeof permission.role === 'string' &&
                context.userRoles.has(permission.role)
            );
        };
    }

    private _byInstRole(
        context: RolesContext<AuthorizeRequestBase>,
        recordName: string,
        inst: string
    ): PermissionFilter {
        return async (permission) => {
            if (!context.instRoles[inst]) {
                const roles = await this._policies.listRolesForInst(
                    recordName,
                    inst
                );
                context.instRoles[inst] = new Set(roles.map((r) => r.role));
            }

            return (
                typeof permission.role === 'string' &&
                context.instRoles[inst].has(permission.role)
            );
        };
    }

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

    private _byRolePermission(
        type: AvailableRolePermissions['type'],
        marker: string
    ): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.roles === true) {
                return true;
            }

            if (this._testRegex(permission.roles, marker)) {
                return true;
            }

            return false;
        };
    }

    private _byRoleGrant(
        type: 'role.grant',
        role: string,
        targetUserId: string,
        targetInstance: string,
        durationMs: number
    ): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }

            if (
                typeof permission.maxDurationMs === 'number' &&
                durationMs > permission.maxDurationMs
            ) {
                return false;
            }

            if (!!targetUserId && !!targetInstance) {
                return false;
            } else if (!!targetUserId) {
                if (permission.userIds === false) {
                    return false;
                }

                if (
                    typeof permission.userIds === 'object' &&
                    Array.isArray(permission.userIds)
                ) {
                    if (permission.userIds.every((id) => id !== targetUserId)) {
                        return false;
                    }
                }
            } else if (!!targetInstance) {
                if (permission.instances === false) {
                    return false;
                }

                if (
                    typeof permission.instances === 'string' &&
                    !this._testRegex(permission.instances, targetInstance)
                ) {
                    return false;
                }
            } else {
                return false;
            }

            if (permission.roles === true) {
                return true;
            }

            if (this._testRegex(permission.roles, role)) {
                return true;
            }

            return false;
        };
    }

    private _byRoleRevoke(
        type: 'role.revoke',
        role: string,
        targetUserId: string,
        targetInstance: string
    ): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }

            if (!!targetUserId && !!targetInstance) {
                return false;
            } else if (!!targetUserId) {
                if (permission.userIds === false) {
                    return false;
                }

                if (
                    typeof permission.userIds === 'object' &&
                    Array.isArray(permission.userIds)
                ) {
                    if (permission.userIds.every((id) => id !== targetUserId)) {
                        return false;
                    }
                }
            } else if (!!targetInstance) {
                if (permission.instances === false) {
                    return false;
                }

                if (
                    typeof permission.instances === 'string' &&
                    !this._testRegex(permission.instances, targetInstance)
                ) {
                    return false;
                }
            } else {
                return false;
            }

            if (permission.roles === true) {
                return true;
            }

            if (this._testRegex(permission.roles, role)) {
                return true;
            }

            return false;
        };
    }

    private _byPolicyList(type: 'policy.list'): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.policies === true) {
                return true;
            }
            return false;
        };
    }

    private _byRoleList(type: 'role.list'): PermissionFilter {
        return async (permission) => {
            if (permission.type !== type) {
                return false;
            }
            if (permission.roles === true) {
                return true;
            }
            return false;
        };
    }

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
    }
}

/**
 * Determines if any markers will be remaining after the removal and addition of the specified markers.
 * @param existingMarkers The markers that already exist.
 * @param removedMarkers The markers that will be removed.
 * @param addedMarkers The markers that will be added.
 */
export function willMarkersBeRemaining(
    existingMarkers: string[],
    removedMarkers: string[] | null,
    addedMarkers: string[] | null
): boolean {
    if (!removedMarkers) {
        return true;
    }

    if (addedMarkers && addedMarkers.length > 0) {
        return true;
    }

    if (existingMarkers.length !== removedMarkers.length) {
        return true;
    }

    if (!existingMarkers.every((m) => removedMarkers.includes(m))) {
        return true;
    }

    return false;
}

export function returnAuthorizationResult(a: AuthorizeDenied): {
    success: false;
    errorCode: Exclude<AuthorizeDenied['errorCode'], 'action_not_supported'>;
    errorMessage: AuthorizeDenied['errorMessage'];
} & Omit<AuthorizeDenied, 'allowed'> {
    if (a.errorCode === 'action_not_supported') {
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: 'A server error occurred.',
        };
    }
    const { allowed, ...rest } = a;
    return {
        success: false,
        ...rest,
        errorCode: a.errorCode,
    };
}

/**
 * Merges the permissions from the given marker policies and filters out any permissions that are not allowed according to
 * the privacy settings of the record owner and the user.
 * @param markerPolicies The marker policies that should be merged.
 */
export function filterAndMergeMarkerPermissions(
    markerPolicies: { marker: string; result: ListMarkerPoliciesResult }[]
): MarkerPermission[] {
    const markers: MarkerPermission[] = [];
    for (let { marker, result } of markerPolicies) {
        let permissions: PossiblePermission[] = [];
        let valid = true;
        const denyPublicInsts =
            !result.recordOwnerPrivacyFeatures.allowPublicInsts ||
            !result.userPrivacyFeatures.allowPublicInsts;
        let instsValid = true;

        if (
            !result.recordOwnerPrivacyFeatures.publishData ||
            !result.userPrivacyFeatures.publishData
        ) {
            valid = false;
        }

        if (valid) {
            for (let policy of result.policies) {
                if (
                    !result.recordOwnerPrivacyFeatures.allowPublicData ||
                    !result.userPrivacyFeatures.allowPublicData
                ) {
                    if (policy.permissions.some((p) => p.role === true)) {
                        // policy contains a permission that allows everyone to access the data, but the user should not be able to publish public data.
                        // skip all the policies for this marker.
                        valid = false;
                        break;
                    }
                }

                for (let permission of policy.permissions) {
                    if (denyPublicInsts) {
                        if (permission.type.startsWith('inst.')) {
                            if (!instsValid) {
                                // Skip all inst permissions if any inst permissions are invalid.
                                continue;
                            } else if (permission.role === true) {
                                // Mark all insts permissions for this marker as invalid if public insts
                                // are not allowed and this permission is public.
                                instsValid = false;
                                continue;
                            }
                        }
                    }

                    permissions.push({
                        policy,
                        permission,
                    });
                }
            }
        }

        if (!instsValid) {
            // Filter out any inst permissions if insts are invalid
            permissions = permissions.filter(
                (p) => !p.permission.type.startsWith('inst.')
            );
        }

        if (valid) {
            markers.push({
                marker,
                permissions,
            });
        } else {
            markers.push({
                marker,
                permissions: [],
            });
        }
    }

    return markers;
}

export interface MarkerPermission {
    marker: string;
    permissions: PossiblePermission[];
}

export type ConstructAuthorizationContextResult =
    | ConstructAuthorizationContextSuccess
    | ConstructAuthorizationContextFailure;

export interface ConstructAuthorizationContextSuccess {
    success: true;
    context: AuthorizationContext;
}

export interface ConstructAuthorizationContextFailure {
    success: false;
    errorCode:
        | ValidatePublicRecordKeyFailure['errorCode']
        | 'not_authorized'
        | SubscriptionLimitReached
        | ServerError;
    errorMessage: string;
}

export interface AuthorizationContext {
    recordKeyResult: ValidatePublicRecordKeyResult | null;
    recordKeyProvided: boolean;
    recordName: string;
    recordOwnerId: string;
    recordStudioId: string;
    recordStudioMembers?: ListedStudioAssignment[];
    subjectPolicy: PublicRecordKeyPolicy;
}

export interface RolesContext<T extends AuthorizeRequestBase>
    extends AuthorizationContext {
    userRoles: Set<string> | null;
    instRoles: {
        [inst: string]: Set<string>;
    };
    markers: MarkerPermission[];
    request: T;

    allowedDataItems?: ListedDataItem[];
    allowedFileItems?: ListedFileItem[];
    allowedEventItems?: ListedEventItem[];
    allowedInstItems?: ListedInstItem[];
}

type PermissionFilter = (permission: AvailablePermissions) => Promise<boolean>;

interface PossiblePermission {
    policy: PolicyDocument;
    permission: AvailablePermissions;
}

export type AuthorizeRequest =
    | AuthorizeDataCreateRequest
    | AuthorizeReadDataRequest
    | AuthorizeUpdateDataRequest
    | AuthorizeDeleteDataRequest
    | AuthorizeListDataRequest
    | AuthorizeCreateFileRequest
    | AuthorizeReadFileRequest
    | AuthorizeListFileRequest
    | AuthorizeUpdateFileRequest
    | AuthorizeDeleteFileRequest
    | AuthorizeCountEventRequest
    | AuthorizeIncrementEventRequest
    | AuthorizeUpdateEventRequest
    | AuthorizeListEventRequest
    | AuthorizeGrantPermissionToPolicyRequest
    | AuthorizeRevokePermissionToPolicyRequest
    | AuthorizeReadPolicyRequest
    | AuthorizeListPoliciesRequest
    | AuthorizeListRolesRequest
    | AuthorizeReadRoleRequest
    | AuthorizeGrantRoleRequest
    | AuthorizeRevokeRoleRequest
    | AuthorizeInstCreateRequest
    | AuthorizeInstDeleteRequest
    | AuthorizeInstReadRequest
    | AuthorizeInstUpdateDataRequest
    | AuthorizeInstUpdateRequest
    | AuthorizeInstListRequest
    | AuthorizeInstSendActionListRequest;

export interface AuthorizeRequestBase {
    /**
     * The record key that should be used or the name of the record that the request is being authorized for.
     */
    recordKeyOrRecordName: string;

    /**
     * The type of the action that is being authorized.
     */
    action: string;

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

export interface AuthorizeReadDataRequest extends AuthorizeRequestBase {
    action: 'data.read';

    /**
     * The address that the record is placed at.
     */
    address: string;

    /**
     * The list of resource markers that are applied to the data.
     */
    resourceMarkers: string[];
}

export interface AuthorizeUpdateDataRequest extends AuthorizeRequestBase {
    action: 'data.update';

    /**
     * The address that the record is placed at.
     */
    address: string;

    /**
     * The list of resource markers that are applied to the data.
     */
    existingMarkers: string[];

    /**
     * The new resource markers that will be added to the data.
     * If omitted, then no markers are being added to the data.
     */
    addedMarkers?: string[];

    /**
     * The markers that will be removed from the data.
     * If omitted, then no markers are being removed from the data.
     */
    removedMarkers?: string[];
}

export interface AuthorizeDeleteDataRequest extends AuthorizeRequestBase {
    action: 'data.delete';

    /**
     * The address that the record is placed at.
     */
    address: string;

    /**
     * The list of resource markers that are applied to the data.
     */
    resourceMarkers: string[];
}

export interface AuthorizeListDataRequest extends AuthorizeRequestBase {
    action: 'data.list';

    /**
     * The list of items that should be filtered.
     */
    dataItems: ListedDataItem[];
}

export interface AuthorizeFileRequest extends AuthorizeRequestBase {
    /**
     * The size of the file that is being created in bytes.
     */
    fileSizeInBytes: number;

    /**
     * The MIME Type of the file.
     */
    fileMimeType: string;
}

export interface AuthorizeCreateFileRequest extends AuthorizeFileRequest {
    action: 'file.create';

    /**
     * The list of resource markers that should be applied to the file.
     */
    resourceMarkers: string[];
}

export interface AuthorizeReadFileRequest extends AuthorizeFileRequest {
    action: 'file.read';

    /**
     * The list of resource markers that are applied to the file.
     */
    resourceMarkers: string[];
}

export interface AuthorizeListFileRequest extends AuthorizeRequestBase {
    action: 'file.list';

    /**
     * The list of items that should be filtered.
     */
    fileItems: ListedFileItem[];
}

export interface AuthorizeUpdateFileRequest extends AuthorizeFileRequest {
    action: 'file.update';

    /**
     * The list of resource markers that are applied to the file.
     */
    existingMarkers: string[];

    /**
     * The new resource markers that will be added to the file.
     * If omitted, then no markers are being added to the file.
     */
    addedMarkers?: string[];

    /**
     * The markers that will be removed from the file.
     * If omitted, then no markers are being removed from the file.
     */
    removedMarkers?: string[];
}

export interface AuthorizeDeleteFileRequest extends AuthorizeFileRequest {
    action: 'file.delete';

    /**
     * The list of resource markers that are applied to the file.
     */
    resourceMarkers: string[];
}

export interface AuthorizeEventRequest extends AuthorizeRequestBase {
    /**
     * The name of the event.
     */
    eventName: string;
}

export interface AuthorizeCountEventRequest extends AuthorizeEventRequest {
    action: 'event.count';

    /**
     * The list of resource markers that are applied to the event.
     */
    resourceMarkers: string[];
}

export interface AuthorizeIncrementEventRequest extends AuthorizeEventRequest {
    action: 'event.increment';

    /**
     * The list of resource markers that are applied to the event.
     */
    resourceMarkers: string[];
}

export interface AuthorizeUpdateEventRequest extends AuthorizeEventRequest {
    action: 'event.update';

    /**
     * The list of resource markers that are applied to the event.
     */
    existingMarkers: string[];

    /**
     * The new resource markers that will be added to the event.
     * If omitted, then no markers are being added to the event.
     */
    addedMarkers?: string[];

    /**
     * The markers that will be removed from the event.
     * If omitted, then no markers are being removed from the event.
     */
    removedMarkers?: string[];
}

export interface AuthorizeListEventRequest extends AuthorizeRequestBase {
    action: 'event.list';

    /**
     * The list of items that should be filtered.
     */
    eventItems: ListedEventItem[];
}

export interface AuthorizePolicyRequest extends AuthorizeRequestBase {
    /**
     * The name of the policy.
     */
    policy: string;
}

export interface AuthorizeGrantPermissionToPolicyRequest
    extends AuthorizePolicyRequest {
    action: 'policy.grantPermission';
}

export interface AuthorizeRevokePermissionToPolicyRequest
    extends AuthorizePolicyRequest {
    action: 'policy.revokePermission';
}

export interface AuthorizeReadPolicyRequest extends AuthorizePolicyRequest {
    action: 'policy.read';
}

export interface AuthorizeListPoliciesRequest
    extends Omit<AuthorizePolicyRequest, 'policy'> {
    action: 'policy.list';
}

export interface AuthorizeRoleRequest extends AuthorizeRequestBase {
    /**
     * The name of the role.
     */
    role: string;
}

export interface AuthorizeListRolesRequest
    extends Omit<AuthorizeRoleRequest, 'role'> {
    action: 'role.list';
}

export interface AuthorizeReadRoleRequest extends AuthorizeRoleRequest {
    action: 'role.read';
}

export interface AuthorizeGrantRoleRequest extends AuthorizeRoleRequest {
    action: 'role.grant';

    /**
     * The ID of the user that the role should be granted to.
     */
    targetUserId?: string;

    /**
     * The inst that the role should be granted to.
     */
    targetInstance?: string;

    /**
     * The time that the grant will expire.
     * If omitted, then the grant will never expire.
     */
    expireTimeMs?: number | null;
}

export interface AuthorizeRevokeRoleRequest extends AuthorizeRoleRequest {
    action: 'role.revoke';

    /**
     * The ID of the user that the role should be granted to.
     */
    targetUserId?: string;

    /**
     * The inst that the role should be granted to.
     */
    targetInstance?: string;
}

export interface AuthorizeInstRequest extends AuthorizeRequestBase {
    /**
     * The inst that the request is being made for.
     */
    inst: string;

    /**
     * The list of resource markers that are applied to the inst.
     */
    resourceMarkers: string[];
}

export interface AuthorizeInstCreateRequest extends AuthorizeInstRequest {
    action: 'inst.create';
}

export interface AuthorizeInstDeleteRequest extends AuthorizeInstRequest {
    action: 'inst.delete';
}

export interface AuthorizeInstUpdateRequest extends AuthorizeRequestBase {
    action: 'inst.update';

    /**
     * The inst that the request is being made for.
     */
    inst: string;

    /**
     * The list of resource markers that are applied to the inst.
     */
    existingMarkers: string[];

    /**
     * The new resource markers that will be added to the inst.
     * If omitted, then no markers are being added to the inst.
     */
    addedMarkers?: string[];

    /**
     * The markers that will be removed from the inst.
     * If omitted, then no markers are being removed from the inst.
     */
    removedMarkers?: string[];
}

export interface AuthorizeInstUpdateDataRequest extends AuthorizeInstRequest {
    action: 'inst.updateData';
}

export interface AuthorizeInstReadRequest extends AuthorizeInstRequest {
    action: 'inst.read';
}

export interface AuthorizeInstListRequest extends AuthorizeRequestBase {
    action: 'inst.list';

    /**
     * The list of insts.
     */
    insts: ListedInstItem[];
}

export interface AuthorizeInstSendActionListRequest
    extends AuthorizeInstRequest {
    action: 'inst.sendAction';
}

export interface ListedDataItem {
    /**
     * The address of the item.
     */
    address: string;

    /**
     * The list of markers for the item.
     */
    markers: string[];
}

export interface ListedFileItem {
    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The MIME type of the file.
     */
    fileMimeType: string;

    /**
     * The size of the file in bytes.
     */
    fileSizeInBytes: number;

    /**
     * The list of markers for the item.
     */
    markers: string[];
}

export interface ListedEventItem {
    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The list of markers for the item.
     */
    markers: string[];
}

export interface ListedInstItem {
    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The markers that are applied to the inst.
     */
    markers: string[];
}

export type AuthorizeResult = AuthorizeAllowed | AuthorizeDenied;

export interface AuthorizeAllowed {
    allowed: true;

    /**
     * The name of the record that the request should be for.
     */
    recordName: string;

    /**
     * The ID of the owner of the record key.
     * Null if no record key was provided.
     */
    recordKeyOwnerId: string | null;

    /**
     * The ID of the user who (directly or indirectly) authorized the request.
     * If a valid record key was provided, then this is the ID of the owner of the record key.
     * If only a user ID was provided, then this is the ID of the user who is logged in.
     * If no one was logged in, then this is null.
     */
    authorizerId: string | null;

    /**
     * The authorization information about the subject.
     */
    subject: SubjectAuthorization;

    /**
     * The authorization information about the instances.
     */
    instances: InstEnvironmentAuthorization[];

    /**
     * The list of allowed data items.
     */
    allowedDataItems?: ListedDataItem[];

    /**
     * The list of allowed file items.
     */
    allowedFileItems?: ListedFileItem[];

    /**
     * The list of allowed event items.
     */
    allowedEventItems?: ListedEventItem[];

    /**
     * The list of allowed inst items.
     */
    allowedInstItems?: ListedInstItem[];
}

export type GenericResult = GenericAllowed | GenericDenied;

export interface GenericAllowed {
    success: true;
    authorization: GenericAuthorization;
}

export interface GenericDenied {
    success: false;
    reason: DenialReason;
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
     * The ID of the user that was authorized.
     * Null if no user ID was provided.
     */
    userId: string | null;

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
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | 'action_not_supported'
        | 'not_logged_in'
        | 'not_authorized'
        | SubscriptionLimitReached
        | 'unacceptable_request';
    errorMessage: string;

    /**
     * The reason that the authorization was denied.
     */
    reason?: DenialReason;
}

export interface GrantMarkerPermissionRequest {
    recordKeyOrRecordName: string;
    userId: string;
    marker: string;
    permission: AvailablePermissions;
    instances?: string[] | null;
}

/**
 * Defines the possible results of revoking a marker permission from a policy.
 *
 * @dochash types/records/policies
 * @doctitle Policy Types
 * @docsidebar Policies
 * @docdescription Types for working with policies.
 * @docgroup 01-grant
 * @docorder 0
 * @docname GrantMarkerPermissionResult
 */
export type GrantMarkerPermissionResult =
    | GrantMarkerPermissionSuccess
    | GrantMarkerPermissionFailure;

/**
 * Defines an interface that represents a successful request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 1
 * @docname GrantMarkerPermissionSuccess
 */
export interface GrantMarkerPermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 2
 * @docname GrantMarkerPermissionFailure
 */
export interface GrantMarkerPermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | UpdateUserPolicyFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export interface RevokeMarkerPermissionRequest {
    recordKeyOrRecordName: string;
    userId: string;
    marker: string;
    permission: AvailablePermissions;
    instances?: string[] | null;
}

/**
 * Defines the possible results of revoking a marker permission from a policy.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 0
 * @docname RevokeMarkerPermissionResult
 */
export type RevokeMarkerPermissionResult =
    | RevokeMarkerPermissionSuccess
    | RevokeMarkerPermissionFailure;

/**
 * Defines an interface that represents a successful request to revoke a marker permission from a policy.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 1
 * @docname RevokeMarkerPermissionSuccess
 */
export interface RevokeMarkerPermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to revoke a marker permission from a policy.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 2
 * @docname RevokeMarkerPermissionFailure
 */
export interface RevokeMarkerPermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | GetUserPolicyFailure['errorCode']
        | UpdateUserPolicyFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export type ReadUserPolicyResult =
    | ReadUserPolicySuccess
    | ReadUserPolicyFailure;

export interface ReadUserPolicySuccess {
    success: true;
    document: PolicyDocument;
    markers: string[];
}

export interface ReadUserPolicyFailure {
    success: false;
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | GetUserPolicyFailure['errorCode'];
    errorMessage: string;
}

export type ListUserPoliciesResult =
    | ListUserPoliciesSuccess
    | ListUserPoliciesFailure;

export interface ListUserPoliciesSuccess {
    success: true;
    policies: ListedUserPolicy[];
    totalCount: number;
}

export interface ListUserPoliciesFailure {
    success: false;
    errorCode: ServerError | AuthorizeDenied['errorCode'];
    errorMessage: string;
}

export type ListAssignedUserRolesResult =
    | ListAssignedUserRolesSuccess
    | ListAssignedUserRolesFailure;

export interface ListAssignedUserRolesSuccess {
    success: true;

    /**
     * The list of roles that are assigned to the user.
     */
    roles: AssignedRole[];
}

export interface ListAssignedUserRolesFailure {
    success: false;
    errorCode: ServerError | AuthorizeDenied['errorCode'];
    errorMessage: string;
}

export type ListAssignedInstRolesResult =
    | ListAssignedInstRolesSuccess
    | ListAssignedInstRolesFailure;

export interface ListAssignedInstRolesSuccess {
    success: true;

    /**
     * The list of roles that are assigned to the inst.
     */
    roles: AssignedRole[];
}

export interface ListAssignedInstRolesFailure {
    success: false;
    errorCode: ServerError | AuthorizeDenied['errorCode'];
    errorMessage: string;
}

export type ListRoleAssignmentsResult =
    | ListRoleAssignmentsSuccess
    | ListRoleAssignmentsFailure;

export interface ListRoleAssignmentsSuccess {
    success: true;

    /**
     * The list of assignments for the role.
     */
    assignments: RoleAssignment[];

    /**
     * The total number of assignments.
     */
    totalCount?: number;
}

export interface ListRoleAssignmentsFailure {
    success: false;
    errorCode: ServerError | NotSupportedError | AuthorizeDenied['errorCode'];
    errorMessage: string;
}

export interface GrantRoleRequest {
    userId?: string;
    instance?: string;
    role: string;
    expireTimeMs?: number | null;
}

/**
 * Defines the possible results of granting a role.
 *
 * @dochash types/records/roles
 * @doctitle Role Types
 * @docsidebar Roles
 * @docdescription Types for working with roles.
 * @docgroup 01-grant
 * @docorder 0
 * @docname GrantRoleResult
 */
export type GrantRoleResult = GrantRoleSuccess | GrantRoleFailure;

/**
 * Defines an interface that represents a successful request to grant a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-grant
 * @docorder 1
 * @docname GrantRoleSuccess
 */
export interface GrantRoleSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to grant a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-grant
 * @docorder 2
 * @docname GrantRoleFailure
 */
export interface GrantRoleFailure {
    success: false;
    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | UpdateUserRolesFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export interface RevokeRoleRequest {
    userId?: string;
    instance?: string;
    role: string;
}

/**
 * Defines the possible results of revoking a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 0
 * @docname RevokeRoleResult
 */
export type RevokeRoleResult = RevokeRoleSuccess | RevokeRoleFailure;

/**
 * Defines an interface that represents a successful request to revoke a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 1
 * @docname RevokeRoleSuccess
 */
export interface RevokeRoleSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to revoke a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 2
 * @docname RevokeRoleFailure
 */
export interface RevokeRoleFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDenied['errorCode']
        | UpdateUserRolesFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}
