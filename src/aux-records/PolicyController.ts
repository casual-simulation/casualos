import { AuthController } from './AuthController';
import {
    isRecordKey,
    RecordsController,
    ValidatePublicRecordKeyFailure,
    ValidatePublicRecordKeyResult,
} from './RecordsController';
import { ServerError } from './Errors';
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
} from './PolicyPermissions';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { PolicyStore } from './PolicyStore';
import { UserPacket } from 'livekit-server-sdk/dist/proto/livekit_models';
import { intersectionBy, union } from 'lodash';

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
        const recordKeyProvided = isRecordKey(request.recordKeyOrRecordName);
        if (recordKeyProvided) {
            recordKeyResult = await this._records.validatePublicRecordKey(
                request.recordKeyOrRecordName
            );
            if (recordKeyResult.success === true) {
                recordName = recordKeyResult.recordName;
            } else {
                return {
                    success: false,
                    errorCode: recordKeyResult.errorCode,
                    errorMessage: recordKeyResult.errorMessage,
                };
            }
        } else {
            recordName = request.recordKeyOrRecordName;
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
            }
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
                                  this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
                              this._byAdminRole(context.recordKeyResult),
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
     */
    private async _authorizeRequest<T extends AuthorizeRequestBase>(
        context: AuthorizationContext,
        request: T,
        resourceMarkers: string[],
        authorize: (
            context: RolesContext<T>,
            type: 'user' | 'inst',
            id: string
        ) => Promise<GenericResult>
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

        if (resourceMarkers.length <= 0) {
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
                const result = await authorize(rolesContext, 'inst', inst);
                if (currentItems) {
                    rolesContext.allowedDataItems = intersectionBy(
                        currentItems,
                        rolesContext.allowedDataItems,
                        (item) => item.address
                    );
                }
                return result;
            }
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
            ? context.recordKeyResult.ownerId
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
        };
    }

    private async _authorizeInstances(
        instances: string[],
        recordKeyResult: ValidatePublicRecordKeyResult,
        authorize: (inst: string) => Promise<GenericResult>
    ): Promise<InstEnvironmentAuthorization[] | GenericDenied> {
        const authorizedInstances: InstEnvironmentAuthorization[] = [];
        if (instances) {
            for (let inst of instances) {
                if (recordKeyResult?.success) {
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
                context.userRoles = await this._policies.listRolesForUser(
                    recordName,
                    userId
                );
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
                context.instRoles[inst] = await this._policies.listRolesForInst(
                    recordName,
                    inst
                );
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
    errorCode: ValidatePublicRecordKeyFailure['errorCode'];
    errorMessage: string;
}

export interface AuthorizationContext {
    recordKeyResult: ValidatePublicRecordKeyResult | null;
    recordKeyProvided: boolean;
    recordName: string;
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
    | AuthorizeUpdateFileRequest
    | AuthorizeDeleteFileRequest
    | AuthorizeCountEventRequest
    | AuthorizeIncrementEventRequest
    | AuthorizeUpdateEventRequest;

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
        | 'unacceptable_request';
    errorMessage: string;

    /**
     * The reason that the authorization was denied.
     */
    reason?: DenialReason;
}

export type DenialReason =
    | NoMarkersDenialReason
    | MissingPermissionDenialReason
    | TooManyInstsDenialReason
    | MissingRoleDenialReason
    | NoMarkersRemainingDenialReason;

/**
 * Defines an interface that represents a denial reason that is returned when the resource has no markers.
 */
export interface NoMarkersDenialReason {
    type: 'no_markers';
}

export interface MissingPermissionDenialReason {
    type: 'missing_permission';

    /**
     * Whether the user or inst is missing the permission.
     */
    kind: 'user' | 'inst';

    /**
     * The ID of the user/inst that is missing the permission.
     */
    id: string;

    /**
     * The marker that was being evaluated.
     */
    marker: string;

    /**
     * The role that was selected for authorization.
     *
     * If not specified, then no role could be determined.
     * This often happens when the user/inst hasn't been assigned a role, but it can also happen when no permissions match any of the roles that the user/inst has assigned.
     *
     * If true, then that indicates that the "everyone" role was used.
     * If a string, then that is the name of the role that was used.
     */
    role?: string | true;

    /**
     * The permission that is missing.
     */
    permission: AvailablePermissions['type'];
}

export interface MissingRoleDenialReason {
    type: 'missing_role';
}

export interface NoMarkersRemainingDenialReason {
    type: 'no_markers_remaining';
}

export interface TooManyInstsDenialReason {
    type: 'too_many_insts';
}