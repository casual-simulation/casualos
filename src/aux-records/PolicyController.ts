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
    AvailablePermissions,
    ResourceKinds,
    ActionKinds,
    PUBLIC_READ_MARKER,
    SubjectType,
    ACCOUNT_MARKER,
} from '@casual-simulation/aux-common';
import {
    ListedStudioAssignment,
    PublicRecordKeyPolicy,
    StudioAssignmentRole,
} from './RecordsStore';
import {
    AssignedRole,
    AssignPermissionToSubjectAndMarkerFailure,
    getExpireTime,
    getPublicMarkersPermission,
    MarkerPermissionAssignment,
    PolicyStore,
    ResourcePermissionAssignment,
    RoleAssignment,
    UpdateUserRolesFailure,
} from './PolicyStore';
import { intersectionBy, isEqual, sortBy, union } from 'lodash';
import { getMarkersOrDefault } from './Utils';
import { parseInstId } from './websockets';
import { PrivacyFeatures } from './AuthStore';

/**
 * The maximum number of instances that can be authorized at once.
 */
export const MAX_ALLOWED_INSTANCES = 2;

/**
 * The maximum number of markers that can be placed on a resource at once.
 */
export const MAX_ALLOWED_MARKERS = 2;

// /**
//  * A generic not_authorized result.
//  */
// export const NOT_AUTHORIZED_RESULT: Omit<AuthorizeDenied, 'reason'> = {
//     allowed: false,
//     errorCode: 'not_authorized',
//     errorMessage: 'You are not authorized to perform this action.',
// };

// /**
//  * A not_authorized result that indicates too many instances were used.
//  */
// export const NOT_AUTHORIZED_TO_MANY_INSTANCES_RESULT: AuthorizeResult = {
//     allowed: false,
//     errorCode: 'not_authorized',
//     errorMessage: `This action is not authorized because more than ${MAX_ALLOWED_INSTANCES} instances are loaded.`,
//     reason: {
//         type: 'too_many_insts',
//     },
// };

const ALLOWED_RECORD_KEY_RESOURCES: [ResourceKinds, ActionKinds[]][] = [
    ['data', ['read', 'create', 'delete', 'update', 'list']],
    ['file', ['read', 'create', 'delete']],
    ['event', ['create', 'count', 'increment']],
    [
        'inst',
        ['read', 'create', 'delete', 'update', 'updateData', 'sendAction'],
    ],
];

const ALLOWED_STUDIO_MEMBER_RESOURCES: [ResourceKinds, ActionKinds[]][] = [
    ['data', ['read', 'create', 'delete', 'update', 'list']],
    ['file', ['read', 'create', 'delete', 'list']],
    ['event', ['create', 'count', 'increment', 'list']],
    [
        'inst',
        [
            'read',
            'create',
            'delete',
            'update',
            'updateData',
            'sendAction',
            'list',
        ],
    ],
];

function constructAllowedResourcesLookup(
    allowedResources: [ResourceKinds, ActionKinds[]][]
): Set<string> {
    const lookup = new Set<string>();
    for (let [resourceKind, actions] of allowedResources) {
        for (let action of actions) {
            lookup.add(`${resourceKind}.${action}`);
        }
    }
    return lookup;
}

const ALLOWED_RECORD_KEY_RESOURCES_LOOKUP = constructAllowedResourcesLookup(
    ALLOWED_RECORD_KEY_RESOURCES
);
const ALLOWED_STUDIO_MEMBER_RESOURCES_LOOKUP = constructAllowedResourcesLookup(
    ALLOWED_STUDIO_MEMBER_RESOURCES
);

/**
 * Determines if the given resource kind and action are allowed to be accessed by a record key.
 * @param resourceKind The kind of the resource kind.
 * @param action The action.
 */
function isAllowedRecordKeyResource(
    resourceKind: string,
    action: string
): boolean {
    return ALLOWED_RECORD_KEY_RESOURCES_LOOKUP.has(`${resourceKind}.${action}`);
}

/**
 * Determines if the given resource kind and action are allowed to be accessed by a studio member.
 * @param resourceKind The kind of the resource kind.
 * @param action The action.
 */
function isAllowedStudioMemberResource(
    resourceKind: string,
    action: string
): boolean {
    return ALLOWED_STUDIO_MEMBER_RESOURCES_LOOKUP.has(
        `${resourceKind}.${action}`
    );
}

export let returnAuthorizationResult: any;
// export type AuthorizeDenied =

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
        request: ConstructAuthorizationContextRequest
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

        let recordOwnerPrivacyFeatures: PrivacyFeatures = null;
        let userPrivacyFeatures: PrivacyFeatures = null;
        if (ownerId) {
            recordOwnerPrivacyFeatures =
                await this._policies.getUserPrivacyFeatures(ownerId);
        }

        if (!recordOwnerPrivacyFeatures) {
            recordOwnerPrivacyFeatures = {
                allowAI: true,
                allowPublicData: true,
                allowPublicInsts: true,
                publishData: true,
            };
        }

        if (request.userId) {
            userPrivacyFeatures = await this._policies.getUserPrivacyFeatures(
                request.userId
            );
        }

        if (!userPrivacyFeatures) {
            userPrivacyFeatures = {
                allowAI: true,
                allowPublicData: true,
                allowPublicInsts: true,
                publishData: true,
            };
        }

        const context: AuthorizationContext = {
            recordName,
            recordKeyResult,
            subjectPolicy,
            recordKeyProvided,
            recordOwnerId: ownerId,
            recordOwnerPrivacyFeatures,
            recordStudioId: studioId,
            recordStudioMembers: studioMembers,
            userId: request.userId,
            userPrivacyFeatures,
        };

        return {
            success: true,
            context,
        };
    }

    authorizeRequestUsingContext: any;

    /**
     * Attempts to authorize the given user and instances for the action and resource(s).
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeUserAndInstances(
        context: ConstructAuthorizationContextResult,
        request: AuthorizeUserAndInstancesRequest
    ): Promise<AuthorizeUserAndInstancesResult> {
        try {
            if (context.success === false) {
                return context;
            }

            const authorization = await this.authorizeSubjects(context, {
                action: request.action,
                markers: request.markers,
                resourceKind: request.resourceKind,
                resourceId: request.resourceId,
                subjects: [
                    {
                        subjectType: 'user',
                        subjectId: request.userId,
                    },
                    ...(request.instances ?? []).map(
                        (i) =>
                            ({
                                subjectType: 'inst',
                                subjectId: i,
                            } as AuthorizeSubject)
                    ),
                ],
            });

            if (authorization.success === false) {
                return authorization;
            }

            const userResult = authorization.results.find(
                (r) =>
                    r.subjectType === 'user' && r.subjectId === request.userId
            );

            return {
                ...authorization,
                user: userResult,
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while authorizing subjects.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to authorize the given subjects for the action and resource(s).
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeSubjects(
        context: ConstructAuthorizationContextResult,
        request: AuthorizeSubjectsRequest
    ): Promise<AuthorizeSubjectsResult> {
        try {
            if (context.success === false) {
                return context;
            }

            if (request.subjects.length <= 0) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'You must provide at least one subject to authorize.',
                };
            }

            const results: AuthorizedSubject[] = [];
            for (let subject of request.subjects) {
                const subjectResult = await this.authorizeSubjectUsingContext(
                    context.context,
                    {
                        ...subject,
                        action: request.action,
                        resourceKind: request.resourceKind,
                        resourceId: request.resourceId,
                        markers: request.markers,
                    }
                );

                if (subjectResult.success === false) {
                    return subjectResult;
                }

                results.push({
                    ...subjectResult,
                    subjectType: subject.subjectType,
                    subjectId: subject.subjectId,
                });
            }

            return {
                success: true,
                recordName: context.context.recordName,
                results: results,
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while authorizing subjects.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to authorize the given subject for the action and resource(s).
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The context for the request.
     * @param request The request to authorize.
     */
    async authorizeSubject(
        context: ConstructAuthorizationContextResult,
        request: AuthorizeSubjectRequest
    ): Promise<AuthorizeSubjectResult> {
        try {
            if (context.success === false) {
                return context;
            }

            return await this.authorizeSubjectUsingContext(
                context.context,
                request
            );
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while authorizing a subject.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to authorize the given subject for the action and resource(s).
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The context for the request.
     * @param request The request to authorize.
     */
    async authorizeSubjectUsingContext(
        context: AuthorizationContext,
        request: AuthorizeSubjectRequest
    ): Promise<AuthorizeSubjectResult> {
        try {
            const markers = getMarkersOrDefault(request.markers);
            if (request.action === 'list' && markers.length > 1) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: `The "${request.action}" action cannot be used with multiple markers.`,
                    reason: {
                        type: 'too_many_markers',
                    },
                };
            }

            if (!context.userPrivacyFeatures.publishData) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'disabled_privacy_feature',
                        recordName: context.recordName,
                        subjectType: 'user',
                        subjectId: context.userId,
                        resourceKind: request.resourceKind,
                        action: request.action,
                        resourceId: request.resourceId,
                        privacyFeature: 'publishData',
                    },
                };
            }

            const recordName = context.recordName;
            const publicPermission = getPublicMarkersPermission(
                markers,
                request.resourceKind,
                request.action
            );

            if (
                context.recordOwnerId &&
                context.userId !== context.recordOwnerId
            ) {
                if (!context.recordOwnerPrivacyFeatures.allowPublicData) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: context.recordName,
                            subjectType: 'user',
                            subjectId: context.userId,
                            resourceKind: request.resourceKind,
                            action: request.action,
                            resourceId: request.resourceId,
                            privacyFeature: 'allowPublicData',
                        },
                    };
                }

                if (
                    request.resourceKind === 'inst' &&
                    (!context.recordOwnerPrivacyFeatures.allowPublicInsts ||
                        !context.userPrivacyFeatures.allowPublicInsts)
                ) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: context.recordName,
                            subjectType: 'user',
                            subjectId: context.userId,
                            resourceKind: request.resourceKind,
                            action: request.action,
                            resourceId: request.resourceId,
                            privacyFeature: 'allowPublicInsts',
                        },
                    };
                }
            }

            if (publicPermission) {
                if (!context.userPrivacyFeatures.allowPublicData) {
                    return {
                        success: false,
                        errorCode: 'not_authorized',
                        errorMessage:
                            'You are not authorized to perform this action.',
                        reason: {
                            type: 'disabled_privacy_feature',
                            recordName: context.recordName,
                            subjectType: 'user',
                            subjectId: context.userId,
                            resourceKind: request.resourceKind,
                            action: request.action,
                            resourceId: request.resourceId,
                            privacyFeature: 'allowPublicData',
                        },
                    };
                }

                return {
                    success: true,
                    recordName,
                    permission: {
                        id: null,
                        recordName: recordName,
                        userId: null,
                        subjectType: request.subjectType,
                        subjectId: request.subjectId,
                        resourceKind: publicPermission.resourceKind,
                        action: publicPermission.action,
                        marker: publicPermission.marker,
                        options: {},
                        expireTimeMs: null,
                    },
                    explanation:
                        publicPermission.marker === PUBLIC_READ_MARKER
                            ? 'Resource has the publicRead marker.'
                            : 'Resource has the publicWrite marker.',
                };
            }

            if (
                request.subjectType === 'role' &&
                request.subjectId === ADMIN_ROLE_NAME
            ) {
                return {
                    success: true,
                    recordName: recordName,
                    permission: {
                        id: null,
                        recordName: recordName,
                        userId: null,

                        // Record owners are treated as if they are admins in the record
                        subjectType: 'role',
                        subjectId: ADMIN_ROLE_NAME,

                        // Admins get all access to all resources in a record
                        resourceKind: null,
                        action: null,

                        marker: markers[0],
                        options: {},
                        expireTimeMs: null,
                    },
                    explanation: `Role is "${ADMIN_ROLE_NAME}".`,
                };
            }

            if (
                context.recordKeyProvided &&
                context.recordKeyResult &&
                context.recordKeyResult.success &&
                isAllowedRecordKeyResource(request.resourceKind, request.action)
            ) {
                if (
                    context.subjectPolicy === 'subjectfull' &&
                    request.subjectType === 'user' &&
                    !request.subjectId
                ) {
                    return {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage:
                            'You must be logged in in order to use this record key.',
                    };
                }

                return {
                    success: true,
                    recordName: context.recordName,
                    permission: {
                        id: null,
                        recordName: recordName,
                        userId: null,

                        // Record owners are treated as if they are admins in the record
                        subjectType: 'role',
                        subjectId: ADMIN_ROLE_NAME,

                        // Admins get all access to all resources in a record
                        resourceKind: request.resourceKind,
                        action: request.action,

                        marker: markers[0],
                        options: {},
                        expireTimeMs: null,
                    },
                    explanation: 'A recordKey was used.',
                };
            }

            if (request.subjectType === 'user' && request.subjectId) {
                if (request.subjectId === context.recordOwnerId) {
                    return {
                        success: true,
                        recordName: recordName,
                        permission: {
                            id: null,
                            recordName: recordName,
                            userId: null,

                            // Record owners are treated as if they are admins in the record
                            subjectType: 'role',
                            subjectId: ADMIN_ROLE_NAME,

                            // Admins get all access to all resources in a record
                            resourceKind: null,
                            action: null,

                            marker: markers[0],
                            options: {},
                            expireTimeMs: null,
                        },
                        explanation: 'User is the owner of the record.',
                    };
                } else if (context.recordStudioMembers) {
                    const member = context.recordStudioMembers.find(
                        (m) => m.userId === request.subjectId
                    );

                    if (member) {
                        if (member.role === 'admin') {
                            return {
                                success: true,
                                recordName: recordName,
                                permission: {
                                    id: null,
                                    recordName: recordName,
                                    userId: null,

                                    // Admins in a studio are treated as if they are admins in the record.
                                    subjectType: 'role',
                                    subjectId: ADMIN_ROLE_NAME,

                                    // Admins get all access to all resources in a record
                                    resourceKind: null,
                                    action: null,

                                    marker: markers[0],
                                    options: {},

                                    // No expiration
                                    expireTimeMs: null,
                                },
                                explanation:
                                    "User is an admin in the record's studio.",
                            };
                        } else if (
                            member.role === 'member' &&
                            isAllowedStudioMemberResource(
                                request.resourceKind,
                                request.action
                            )
                        ) {
                            return {
                                success: true,
                                recordName: recordName,
                                permission: {
                                    id: null,
                                    recordName: recordName,

                                    // Members in a studio are treated as if they are granted direct access to most resources
                                    // in the record.
                                    userId: request.subjectId,
                                    subjectType: 'user',
                                    subjectId: request.subjectId,

                                    // Not all actions or resources are granted though
                                    resourceKind: request.resourceKind,
                                    action: request.action,

                                    marker: markers[0],
                                    options: {},
                                    expireTimeMs: null,
                                },
                                explanation:
                                    "User is a member in the record's studio.",
                            };
                        }
                    }
                }
            } else if (request.subjectType === 'inst' && request.subjectId) {
                const instId = parseInstId(request.subjectId);
                if (!instId) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'Invalid inst ID. It must contain a forward slash',
                    };
                }

                if (instId.recordName) {
                    if (instId.recordName === recordName) {
                        return {
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: request.subjectId,

                                // resourceKind and action are specified
                                // because insts don't necessarily have all permissions in the record
                                resourceKind: request.resourceKind,
                                action: request.action,

                                marker: markers[0],
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: `Inst is owned by the record.`,
                        };
                    }

                    const instRecord = await this._records.validateRecordName(
                        instId.recordName,
                        context.userId
                    );

                    if (instRecord.success === false) {
                        return instRecord;
                    } else if (
                        instRecord.ownerId &&
                        instRecord.ownerId === context.recordOwnerId
                    ) {
                        return {
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: request.subjectId,

                                // resourceKind and action are specified
                                // because insts don't necessarily have all permissions in the record
                                resourceKind: request.resourceKind,
                                action: request.action,

                                marker: markers[0],
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: `Inst is owned by the record's (${recordName}) owner (${context.recordOwnerId}).`,
                        };
                    } else if (
                        instRecord.studioId &&
                        instRecord.studioId === context.recordStudioId
                    ) {
                        return {
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,

                                userId: null,
                                subjectType: 'inst',
                                subjectId: request.subjectId,

                                // resourceKind and action are specified
                                // because insts don't necessarily have all permissions in the record
                                resourceKind: request.resourceKind,
                                action: request.action,

                                marker: markers[0],
                                options: {},
                                expireTimeMs: null,
                            },
                            explanation: `Inst is owned by the record's (${recordName}) studio (${context.recordStudioId}).`,
                        };
                    }
                }
            }

            if (request.subjectId) {
                if (
                    request.subjectType === 'inst' ||
                    request.subjectType === 'user'
                ) {
                    // check for admin role
                    const roles =
                        request.subjectType === 'user'
                            ? await this._policies.listRolesForUser(
                                  recordName,
                                  request.subjectId
                              )
                            : await this._policies.listRolesForInst(
                                  recordName,
                                  request.subjectId
                              );

                    const role = roles.find((r) => r.role === ADMIN_ROLE_NAME);
                    if (role) {
                        const kindString =
                            request.subjectType === 'user' ? 'User' : 'Inst';
                        return {
                            success: true,
                            recordName: recordName,
                            permission: {
                                id: null,
                                recordName: recordName,
                                userId: null,

                                // Admins in a studio are treated as if they are admins in the record.
                                subjectType: 'role',
                                subjectId: ADMIN_ROLE_NAME,

                                // Admins get all access to all resources in a record
                                resourceKind: null,
                                action: null,

                                marker: markers[0],
                                options: {},

                                // No expiration
                                expireTimeMs: role.expireTimeMs,
                            },
                            explanation: `${kindString} is assigned the "${ADMIN_ROLE_NAME}" role.`,
                        };
                    }
                }

                let permission:
                    | ResourcePermissionAssignment
                    | MarkerPermissionAssignment = null;
                if (request.resourceId) {
                    const result =
                        await this._policies.getPermissionForSubjectAndResource(
                            request.subjectType,
                            request.subjectId,
                            recordName,
                            request.resourceKind,
                            request.resourceId,
                            request.action,
                            Date.now()
                        );

                    if (result.success === false) {
                        return result;
                    }

                    permission = result.permissionAssignment;
                }

                if (!permission) {
                    const result =
                        await this._policies.getPermissionForSubjectAndMarkers(
                            request.subjectType,
                            request.subjectId,
                            recordName,
                            request.resourceKind,
                            markers,
                            request.action,
                            Date.now()
                        );

                    if (result.success === false) {
                        return result;
                    }

                    permission = result.permissionAssignment;
                }

                if (permission) {
                    // const subjectString = request.subjectType === 'user' ? 'User' :
                    //     request.subjectType === 'inst' ? 'Inst' : 'Role';
                    return {
                        success: true,
                        recordName,
                        permission: permission,
                        explanation: explainationForPermissionAssignment(
                            request.subjectType,
                            permission
                        ),
                    };
                }
            }

            if (!request.subjectId && !context.recordKeyProvided) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'You must be logged in to perform this action.',
                };
            }

            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    subjectType: request.subjectType,
                    subjectId: request.subjectId,
                    resourceKind: request.resourceKind,
                    resourceId: request.resourceId,
                    action: request.action,
                },
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while authorizing a subject.',
                err
            );
            return {
                success: false,
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

            const authorization = await this.authorizeUserAndInstances(
                context,
                {
                    action: 'grantPermission',
                    resourceKind: 'marker',
                    resourceId: request.marker,
                    markers: [ACCOUNT_MARKER],
                    userId: request.userId,
                    instances: request.instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const recordName = context.context.recordName;

            const assignmentResult =
                await this._policies.assignPermissionToSubjectAndMarker(
                    recordName,
                    request.permission.subjectType,
                    request.permission.subjectId,
                    request.permission.resourceKind,
                    request.marker,
                    request.permission.action,
                    request.permission.options,
                    request.permission.expireTimeMs
                );

            if (assignmentResult.success === false) {
                return assignmentResult;
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

    // /**
    //  * Attempts to revoke a permission from a marker.
    //  * @param request The request for the operation.
    //  */
    // async revokeMarkerPermission(
    //     request: RevokeMarkerPermissionRequest
    // ): Promise<RevokeMarkerPermissionResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: request.recordKeyOrRecordName,
    //             userId: request.userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const authorization = await this.authorizeUserAndInstances(context, {
    //             action: 'revokePermission',
    //             resourceKind: 'marker',
    //             resourceId: request.marker,
    //             markers: [ACCOUNT_MARKER],
    //             userId: request.userId,
    //             instances: request.instances,
    //         });

    //         if (authorization.success === false) {
    //             return authorization;
    //         }

    //         const policyResult = await this._policies.getUserPolicy(
    //             context.context.recordName,
    //             request.marker
    //         );

    //         if (policyResult.success === false) {
    //             if (policyResult.errorCode === 'policy_not_found') {
    //                 return {
    //                     success: true,
    //                 };
    //             }
    //             console.log(
    //                 `[PolicyController] Failure while retrieving policy for ${context.context.recordName} and ${request.marker}.`,
    //                 policyResult
    //             );
    //             return {
    //                 success: false,
    //                 errorCode: policyResult.errorCode,
    //                 errorMessage: policyResult.errorMessage,
    //             };
    //         }

    //         const policy: UserPolicyRecord = policyResult;

    //         let hasUpdate = false;
    //         for (let i = 0; i < policy.document.permissions.length; i++) {
    //             const p = policy.document.permissions[i];
    //             if (isEqual(p, request.permission)) {
    //                 hasUpdate = true;
    //                 policy.document.permissions.splice(i, 1);
    //                 i--;
    //             }
    //         }

    //         if (hasUpdate) {
    //             console.log(
    //                 `[PolicyController] Removing permission from policy for ${context.context.recordName} and ${request.marker}.`,
    //                 request.permission
    //             );
    //             const updateResult = await this._policies.updateUserPolicy(
    //                 context.context.recordName,
    //                 request.marker,
    //                 {
    //                     document: policy.document,
    //                     markers: policy.markers,
    //                 }
    //             );

    //             if (updateResult.success === false) {
    //                 console.log(
    //                     `[PolicyController] Policy update failed:`,
    //                     updateResult
    //                 );
    //                 return updateResult;
    //             }
    //         }

    //         return {
    //             success: true,
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to read the policy for a marker.
    //  * @param recordKeyOrRecordName The record key or record name.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param marker The marker.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async readUserPolicy(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     marker: string,
    //     instances?: string[] | null
    // ): Promise<ReadUserPolicyResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         // Fetch the policy before authorizing because we will need to know which
    //         // markers are applied to the policy
    //         const result = await this._policies.getUserPolicy(
    //             context.context.recordName,
    //             marker
    //         );

    //         if (result.success === false) {
    //             return result;
    //         }

    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'policy.read',
    //                 ...baseRequest,
    //                 policy: marker,
    //                 instances,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         return {
    //             success: true,
    //             document: result.document,
    //             markers: result.markers,
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to list the policies for a record.
    //  * @param recordKeyOrRecordName The record key or the name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param startingMarker The marker that policies should be returned after.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async listUserPolicies(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     startingMarker: string | null,
    //     instances?: string[]
    // ): Promise<ListUserPoliciesResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'policy.list',
    //                 ...baseRequest,
    //                 instances,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         const result = await this._policies.listUserPolicies(
    //             context.context.recordName,
    //             startingMarker
    //         );

    //         if (!result.success) {
    //             return result;
    //         }

    //         return {
    //             success: true,
    //             policies: result.policies,
    //             totalCount: result.totalCount,
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to list the roles that are assigned to a user.
    //  * @param recordKeyOrRecordName The record key or the name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param subjectId The ID of the user whose roles should be listed.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async listUserRoles(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     subjectId: string,
    //     instances?: string[]
    // ): Promise<ListAssignedUserRolesResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         if (userId !== subjectId || (!!instances && instances.length > 0)) {
    //             const authorization = await this.authorizeRequestUsingContext(
    //                 context.context,
    //                 {
    //                     action: 'role.list',
    //                     ...baseRequest,
    //                     instances,
    //                 }
    //             );

    //             if (authorization.allowed === false) {
    //                 return returnAuthorizationResult(authorization);
    //             }
    //         }

    //         const result = await this._policies.listRolesForUser(
    //             context.context.recordName,
    //             subjectId
    //         );

    //         return {
    //             success: true,
    //             roles: sortBy(result, (r) => r.role),
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to list the roles that are assigned to an inst.
    //  * @param recordKeyOrRecordName The record key or the name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param subjectId The ID of the inst whose roles should be listed.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async listInstRoles(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     subjectId: string,
    //     instances?: string[]
    // ): Promise<ListAssignedInstRolesResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'role.list',
    //                 ...baseRequest,
    //                 instances,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         const result = await this._policies.listRolesForInst(
    //             context.context.recordName,
    //             subjectId
    //         );

    //         return {
    //             success: true,
    //             roles: sortBy(result, (r) => r.role),
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to list the entities that are assigned the given role.
    //  * @param recordKeyOrRecordName The record key or the name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param role The name of the role whose assigments should be listed.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async listAssignedRoles(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     role: string,
    //     instances?: string[]
    // ): Promise<ListRoleAssignmentsResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'role.list',
    //                 ...baseRequest,
    //                 instances,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         const result = await this._policies.listAssignmentsForRole(
    //             context.context.recordName,
    //             role
    //         );

    //         return {
    //             success: true,
    //             assignments: result.assignments,
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Lists the role assignments that have been made in the given record.
    //  * @param recordKeyOrRecordName The record key or record name.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param startingRole The role that assignments should be returned after.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async listRoleAssignments(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     startingRole: string | null,
    //     instances?: string[]
    // ): Promise<ListRoleAssignmentsResult> {
    //     try {
    //         if (!this._policies.listAssignments) {
    //             return {
    //                 success: false,
    //                 errorCode: 'not_supported',
    //                 errorMessage: 'This operation is not supported.',
    //             };
    //         }
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'role.list',
    //                 ...baseRequest,
    //                 instances,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         const result = await this._policies.listAssignments(
    //             context.context.recordName,
    //             startingRole
    //         );

    //         return {
    //             success: true,
    //             assignments: result.assignments,
    //             totalCount: result.totalCount,
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to grant a role to a user.
    //  * @param recordKeyOrRecordName The record key or the name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param request The request to grant the role.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async grantRole(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     request: GrantRoleRequest,
    //     instances?: string[]
    // ): Promise<GrantRoleResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const recordName = context.context.recordName;
    //         const targetUserId = request.userId;
    //         const targetInstance = request.instance;
    //         const expireTimeMs = getExpireTime(request.expireTimeMs);
    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'role.grant',
    //                 ...baseRequest,
    //                 instances,
    //                 role: request.role,
    //                 targetUserId,
    //                 targetInstance,
    //                 expireTimeMs,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         if (targetUserId) {
    //             const result = await this._policies.assignSubjectRole(
    //                 recordName,
    //                 targetUserId,
    //                 'user',
    //                 {
    //                     role: request.role,
    //                     expireTimeMs,
    //                 }
    //             );

    //             if (result.success === false) {
    //                 return result;
    //             }

    //             return {
    //                 success: true,
    //             };
    //         } else if (targetInstance) {
    //             const result = await this._policies.assignSubjectRole(
    //                 recordName,
    //                 targetInstance,
    //                 'inst',
    //                 {
    //                     role: request.role,
    //                     expireTimeMs,
    //                 }
    //             );

    //             if (result.success === false) {
    //                 return result;
    //             }

    //             return {
    //                 success: true,
    //             };
    //         }

    //         return {
    //             success: false,
    //             errorCode: 'unacceptable_request',
    //             errorMessage:
    //                 'Either a user ID or an instance must be specified.',
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }

    // /**
    //  * Attempts to revoke a role from a user.
    //  * @param recordKeyOrRecordName The record key or name of the record.
    //  * @param userId The ID of the user that is currently logged in.
    //  * @param request The request to revoke the role.
    //  * @param instances The instances that the request is being made from.
    //  */
    // async revokeRole(
    //     recordKeyOrRecordName: string,
    //     userId: string,
    //     request: RevokeRoleRequest,
    //     instances?: string[]
    // ): Promise<RevokeRoleResult> {
    //     try {
    //         const baseRequest = {
    //             recordKeyOrRecordName: recordKeyOrRecordName,
    //             userId: userId,
    //         };
    //         const context = await this.constructAuthorizationContext(
    //             baseRequest
    //         );
    //         if (context.success === false) {
    //             return {
    //                 success: false,
    //                 errorCode: context.errorCode,
    //                 errorMessage: context.errorMessage,
    //             };
    //         }

    //         const recordName = context.context.recordName;
    //         const targetUserId = request.userId;
    //         const targetInstance = request.instance;
    //         const authorization = await this.authorizeRequestUsingContext(
    //             context.context,
    //             {
    //                 action: 'role.revoke',
    //                 ...baseRequest,
    //                 instances,
    //                 role: request.role,
    //                 targetUserId,
    //                 targetInstance,
    //             }
    //         );

    //         if (authorization.allowed === false) {
    //             return returnAuthorizationResult(authorization);
    //         }

    //         if (targetUserId) {
    //             const result = await this._policies.revokeSubjectRole(
    //                 recordName,
    //                 targetUserId,
    //                 'user',
    //                 request.role
    //             );

    //             if (result.success === false) {
    //                 return result;
    //             }

    //             return {
    //                 success: true,
    //             };
    //         } else if (targetInstance) {
    //             const result = await this._policies.revokeSubjectRole(
    //                 recordName,
    //                 targetInstance,
    //                 'inst',
    //                 request.role
    //             );

    //             if (result.success === false) {
    //                 return result;
    //             }

    //             return {
    //                 success: true,
    //             };
    //         }

    //         return {
    //             success: false,
    //             errorCode: 'unacceptable_request',
    //             errorMessage:
    //                 'Either a user ID or an instance must be specified.',
    //         };
    //     } catch (err) {
    //         console.error('[PolicyController] A server error occurred.', err);
    //         return {
    //             success: false,
    //             errorCode: 'server_error',
    //             errorMessage: 'A server error occurred.',
    //         };
    //     }
    // }
}

// /**
//  * Gets the resource info for the given context and request.
//  * Returns null if there is no resource info defined for the request.
//  * @param request The request.
//  */
// export function getResourceInfo(permission: AvailablePermissions): ResourceInfo {
//     if (permission.type === 'data.read') {
//         return {
//             resourceKind: 'data',
//             resourceId: permission.addresses === true ? null : permission.addresses,
//             actionKind: 'read',
//         };
//     } else if (permission.type === 'data.create') {
//         return {
//             resourceKind: 'data',
//             resourceId: permission.addresses === true ? null : permission.addresses,
//             actionKind: 'create',
//         };
//     } else if (permission.type === 'data.delete') {
//         return {
//             resourceKind: 'data',
//             resourceId: permission.addresses === true ? null : permission.addresses,
//             actionKind: 'delete',
//         };
//     } else if (permission.type === 'data.update') {
//         return {
//             resourceKind: 'data',
//             resourceId: permission.addresses === true ? null : permission.addresses,
//             actionKind: 'update',
//         };
//     } else if (permission.type === 'data.list') {
//         return {
//             resourceKind: 'data',
//             resourceId: null,
//             actionKind: 'list'
//         };
//     } else if (permission.type === 'file.read') {
//         return {
//             resourceKind: 'file',
//             resourceId: null,
//             actionKind: 'read',
//         };
//     } else if (permission.type === 'file.create') {
//         return {
//             resourceKind: 'file',
//             resourceId: null,
//             actionKind: 'create',
//         };
//     } else if (permission.type === 'file.delete') {
//         return {
//             resourceKind: 'file',
//             resourceId: null,
//             actionKind: 'delete',
//         };
//     } else if (permission.type === 'file.update') {
//         return {
//             resourceKind: 'file',
//             resourceId: null,
//             actionKind: 'update',
//         };
//     } else if (permission.type === 'file.list') {
//         return {
//             resourceKind: 'file',
//             resourceId: null,
//             actionKind: 'list',
//         };
//     } else if (permission.type === 'event.increment') {
//         return {
//             resourceKind: 'event',
//             resourceId: permission.events === true ? null : permission.events,
//             actionKind: 'increment',
//         };
//     } else if (permission.type === 'event.count') {
//         return {
//             resourceKind: 'event',
//             resourceId: permission.events === true ? null : permission.events,
//             actionKind: 'count',
//         };
//     } else if (permission.type === 'event.update') {
//         return {
//             resourceKind: 'event',
//             resourceId: permission.events === true ? null : permission.events,
//             actionKind: 'update',
//         };
//     } else if (permission.type === 'event.list') {
//         return {
//             resourceKind: 'event',
//             resourceId: null,
//             actionKind: 'list',
//         };
//     } else if (permission.type === 'inst.create') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'create',
//         };
//     } else if (permission.type === 'inst.update') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'update',
//         };
//     } else if (permission.type === 'inst.delete') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'delete',
//         };
//     } else if (permission.type === 'inst.read') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'read',
//         };
//     } else if (permission.type === 'inst.updateData') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'updateData',
//         };
//     } else if (permission.type === 'inst.sendAction') {
//         return {
//             resourceKind: 'inst',
//             resourceId: permission.insts === true ? null : permission.insts,
//             actionKind: 'sendAction',
//         };
//     } else if (permission.type === 'inst.list') {
//         return {
//             resourceKind: 'inst',
//             actionKind: 'list',
//             resourceId: null
//         };
//     } else if (permission.type === 'policy.grantPermission') {
//         return {
//             resourceKind: 'marker',
//             resourceId: permission.policies === true ? null : permission.policies,
//             actionKind: 'grantPermission',
//         };
//     } else if (permission.type === 'policy.revokePermission') {
//         return {
//             resourceKind: 'marker',
//             resourceId: permission.policies === true ? null : permission.policies,
//             actionKind: 'revokePermission',
//         };
//     } else if (permission.type === 'policy.read') {
//         return {
//             resourceKind: 'marker',
//             resourceId: permission.policies === true ? null : permission.policies,
//             actionKind: 'read',
//         };
//     } else if (permission.type === 'policy.list') {
//         return {
//             resourceKind: 'marker',
//             actionKind: 'list',
//             resourceId: null
//         };
//     } else if (permission.type === 'role.grant') {
//         return {
//             resourceKind: 'role',
//             resourceId: permission.role === true ? null : permission.role,
//             actionKind: 'grant',
//         };
//     } else if (permission.type === 'role.revoke') {
//         return {
//             resourceKind: 'role',
//             resourceId: permission.role === true ? null : permission.role,
//             actionKind: 'revoke',
//         };
//     } else if (permission.type === 'role.read') {
//         return {
//             resourceKind: 'role',
//             resourceId: permission.role === true ? null : permission.role,
//             actionKind: 'read',
//         };
//     } else if (permission.type === 'role.list') {
//         return {
//             resourceKind: 'role',
//             actionKind: 'list',
//             resourceId: null
//         };
//     }

//     return null;
// }

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

// export function returnAuthorizationResult(a: AuthorizeDenied): {
//     success: false;
//     errorCode: Exclude<AuthorizeDenied['errorCode'], 'action_not_supported'>;
//     errorMessage: AuthorizeDenied['errorMessage'];
// } & Omit<AuthorizeDenied, 'allowed'> {
//     if (a.errorCode === 'action_not_supported') {
//         return {
//             success: false,
//             errorCode: 'server_error',
//             errorMessage: 'A server error occurred.',
//         };
//     }
//     const { allowed, ...rest } = a;
//     return {
//         success: false,
//         ...rest,
//         errorCode: a.errorCode,
//     };
// }

// /**
//  * Merges the permissions from the given marker policies and filters out any permissions that are not allowed according to
//  * the privacy settings of the record owner and the user.
//  * @param markerPolicies The marker policies that should be merged.
//  */
// export function filterAndMergeMarkerPermissions(
//     markerPolicies: { marker: string; result: ListMarkerPoliciesResult }[]
// ): MarkerPermission[] {
//     const markers: MarkerPermission[] = [];
//     for (let { marker, result } of markerPolicies) {
//         let permissions: PossiblePermission[] = [];
//         let valid = true;
//         const denyPublicInsts =
//             !result.recordOwnerPrivacyFeatures.allowPublicInsts ||
//             !result.userPrivacyFeatures.allowPublicInsts;
//         let instsValid = true;

//         if (
//             !result.recordOwnerPrivacyFeatures.publishData ||
//             !result.userPrivacyFeatures.publishData
//         ) {
//             valid = false;
//         }

//         if (valid) {
//             for (let policy of result.policies) {
//                 if (
//                     !result.recordOwnerPrivacyFeatures.allowPublicData ||
//                     !result.userPrivacyFeatures.allowPublicData
//                 ) {
//                     if (policy.permissions.some((p) => p.role === true)) {
//                         // policy contains a permission that allows everyone to access the data, but the user should not be able to publish public data.
//                         // skip all the policies for this marker.
//                         valid = false;
//                         break;
//                     }
//                 }

//                 for (let permission of policy.permissions) {
//                     if (denyPublicInsts) {
//                         if (permission.type.startsWith('inst.')) {
//                             if (!instsValid) {
//                                 // Skip all inst permissions if any inst permissions are invalid.
//                                 continue;
//                             } else if (permission.role === true) {
//                                 // Mark all insts permissions for this marker as invalid if public insts
//                                 // are not allowed and this permission is public.
//                                 instsValid = false;
//                                 continue;
//                             }
//                         }
//                     }

//                     permissions.push({
//                         policy,
//                         permission,
//                     });
//                 }
//             }
//         }

//         if (!instsValid) {
//             // Filter out any inst permissions if insts are invalid
//             permissions = permissions.filter(
//                 (p) => !p.permission.type.startsWith('inst.')
//             );
//         }

//         if (valid) {
//             markers.push({
//                 marker,
//                 permissions,
//             });
//         } else {
//             markers.push({
//                 marker,
//                 permissions: [],
//             });
//         }
//     }

//     return markers;
// }

/**
 * Gets a simple human readable explaination for the given permission assignment.
 */
export function explainationForPermissionAssignment(
    subjectType: SubjectType,
    permissionAssignment:
        | MarkerPermissionAssignment
        | ResourcePermissionAssignment
): string {
    const subjectString =
        subjectType === 'user'
            ? 'User'
            : subjectType === 'inst'
            ? 'Inst'
            : 'Role';

    let permissionString: string;
    if ('marker' in permissionAssignment) {
        permissionString = `${subjectString} was granted access to marker "${permissionAssignment.marker}" by "${permissionAssignment.id}"`;
    } else {
        permissionString = `${subjectString} was granted access to resource "${permissionAssignment.resourceId}" by "${permissionAssignment.id}"`;
    }

    if (permissionAssignment.subjectType === 'role') {
        permissionString += ` using role "${permissionAssignment.subjectId}"`;
    }

    return permissionString;
}

// export interface MarkerPermission {
//     marker: string;
//     permissions: PossiblePermission[];
// }

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

    /**
     * The privacy features of the user that owns the record.
     */
    recordOwnerPrivacyFeatures: PrivacyFeatures;

    /**
     * The privacy features of the user that is currently logged in.
     */
    userPrivacyFeatures: PrivacyFeatures;

    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;
}

export interface ConstructAuthorizationContextRequest {
    /**
     * The record key that should be used or the name of the record that the request is being authorized for.
     */
    recordKeyOrRecordName: string;

    /**
     * The ID of the user that is currently logged in.
     */
    userId?: string | null;
}

// export interface RolesContext<T extends AuthorizeRequestBase>
//     extends AuthorizationContext {
//     userRoles: Set<string> | null;
//     instRoles: {
//         [inst: string]: Set<string>;
//     };
//     markers: MarkerPermission[];
//     request: T;

//     allowedDataItems?: ListedDataItem[];
//     allowedFileItems?: ListedFileItem[];
//     allowedEventItems?: ListedEventItem[];
//     allowedInstItems?: ListedInstItem[];
// }

// type PermissionFilter = (permission: AvailablePermissions) => Promise<boolean>;

// interface PossiblePermission {
//     policy: PolicyDocument;
//     permission: AvailablePermissions;
// }

// export type AuthorizeRequest =
//     | AuthorizeDataCreateRequest
//     | AuthorizeReadDataRequest
//     | AuthorizeUpdateDataRequest
//     | AuthorizeDeleteDataRequest
//     | AuthorizeListDataRequest
//     | AuthorizeCreateFileRequest
//     | AuthorizeReadFileRequest
//     | AuthorizeListFileRequest
//     | AuthorizeUpdateFileRequest
//     | AuthorizeDeleteFileRequest
//     | AuthorizeCountEventRequest
//     | AuthorizeIncrementEventRequest
//     | AuthorizeUpdateEventRequest
//     | AuthorizeListEventRequest
//     | AuthorizeGrantPermissionToPolicyRequest
//     | AuthorizeRevokePermissionToPolicyRequest
//     | AuthorizeReadPolicyRequest
//     | AuthorizeListPoliciesRequest
//     | AuthorizeListRolesRequest
//     | AuthorizeReadRoleRequest
//     | AuthorizeGrantRoleRequest
//     | AuthorizeRevokeRoleRequest
//     | AuthorizeInstCreateRequest
//     | AuthorizeInstDeleteRequest
//     | AuthorizeInstReadRequest
//     | AuthorizeInstUpdateDataRequest
//     | AuthorizeInstUpdateRequest
//     | AuthorizeInstListRequest
//     | AuthorizeInstSendActionListRequest;

// export interface AuthorizeRequestBase {
//     /**
//      * The record key that should be used or the name of the record that the request is being authorized for.
//      */
//     recordKeyOrRecordName: string;

//     /**
//      * The type of the action that is being authorized.
//      */
//     action: string;

//     /**
//      * The ID of the user that is currently logged in.
//      */
//     userId?: string | null;

//     /**
//      * The instances that the request is being made from.
//      */
//     instances?: string[] | null;
// }

// export interface AuthorizeDataCreateRequest extends AuthorizeRequestBase {
//     action: 'data.create';

//     /**
//      * The address that the new record will be placed at.
//      */
//     address: string;

//     /**
//      * The list of resource markers that should be applied to the data.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeReadDataRequest extends AuthorizeRequestBase {
//     action: 'data.read';

//     /**
//      * The address that the record is placed at.
//      */
//     address: string;

//     /**
//      * The list of resource markers that are applied to the data.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeUpdateDataRequest extends AuthorizeRequestBase {
//     action: 'data.update';

//     /**
//      * The address that the record is placed at.
//      */
//     address: string;

//     /**
//      * The list of resource markers that are applied to the data.
//      */
//     existingMarkers: string[];

//     /**
//      * The new resource markers that will be added to the data.
//      * If omitted, then no markers are being added to the data.
//      */
//     addedMarkers?: string[];

//     /**
//      * The markers that will be removed from the data.
//      * If omitted, then no markers are being removed from the data.
//      */
//     removedMarkers?: string[];
// }

// export interface AuthorizeDeleteDataRequest extends AuthorizeRequestBase {
//     action: 'data.delete';

//     /**
//      * The address that the record is placed at.
//      */
//     address: string;

//     /**
//      * The list of resource markers that are applied to the data.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeListDataRequest extends AuthorizeRequestBase {
//     action: 'data.list';

//     /**
//      * The list of items that should be filtered.
//      */
//     dataItems: ListedDataItem[];
// }

// export interface AuthorizeFileRequest extends AuthorizeRequestBase {
//     /**
//      * The name of the file.
//      */
//     fileName?: string;

//     /**
//      * The size of the file that is being created in bytes.
//      */
//     fileSizeInBytes: number;

//     /**
//      * The MIME Type of the file.
//      */
//     fileMimeType: string;
// }

// export interface AuthorizeCreateFileRequest extends AuthorizeFileRequest {
//     action: 'file.create';

//     /**
//      * The list of resource markers that should be applied to the file.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeReadFileRequest extends AuthorizeFileRequest {
//     action: 'file.read';

//     /**
//      * The list of resource markers that are applied to the file.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeListFileRequest extends AuthorizeRequestBase {
//     action: 'file.list';

//     /**
//      * The list of items that should be filtered.
//      */
//     fileItems: ListedFileItem[];
// }

// export interface AuthorizeUpdateFileRequest extends AuthorizeFileRequest {
//     action: 'file.update';

//     /**
//      * The list of resource markers that are applied to the file.
//      */
//     existingMarkers: string[];

//     /**
//      * The new resource markers that will be added to the file.
//      * If omitted, then no markers are being added to the file.
//      */
//     addedMarkers?: string[];

//     /**
//      * The markers that will be removed from the file.
//      * If omitted, then no markers are being removed from the file.
//      */
//     removedMarkers?: string[];
// }

// export interface AuthorizeDeleteFileRequest extends AuthorizeFileRequest {
//     action: 'file.delete';

//     /**
//      * The list of resource markers that are applied to the file.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeEventRequest extends AuthorizeRequestBase {
//     /**
//      * The name of the event.
//      */
//     eventName: string;
// }

// export interface AuthorizeCountEventRequest extends AuthorizeEventRequest {
//     action: 'event.count';

//     /**
//      * The list of resource markers that are applied to the event.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeIncrementEventRequest extends AuthorizeEventRequest {
//     action: 'event.increment';

//     /**
//      * The list of resource markers that are applied to the event.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeUpdateEventRequest extends AuthorizeEventRequest {
//     action: 'event.update';

//     /**
//      * The list of resource markers that are applied to the event.
//      */
//     existingMarkers: string[];

//     /**
//      * The new resource markers that will be added to the event.
//      * If omitted, then no markers are being added to the event.
//      */
//     addedMarkers?: string[];

//     /**
//      * The markers that will be removed from the event.
//      * If omitted, then no markers are being removed from the event.
//      */
//     removedMarkers?: string[];
// }

// export interface AuthorizeListEventRequest extends AuthorizeRequestBase {
//     action: 'event.list';

//     /**
//      * The list of items that should be filtered.
//      */
//     eventItems: ListedEventItem[];
// }

// export interface AuthorizePolicyRequest extends AuthorizeRequestBase {
//     /**
//      * The name of the policy.
//      */
//     policy: string;
// }

// export interface AuthorizeGrantPermissionToPolicyRequest
//     extends AuthorizePolicyRequest {
//     action: 'policy.grantPermission';
// }

// export interface AuthorizeRevokePermissionToPolicyRequest
//     extends AuthorizePolicyRequest {
//     action: 'policy.revokePermission';
// }

// export interface AuthorizeReadPolicyRequest extends AuthorizePolicyRequest {
//     action: 'policy.read';
// }

// export interface AuthorizeListPoliciesRequest
//     extends Omit<AuthorizePolicyRequest, 'policy'> {
//     action: 'policy.list';
// }

// export interface AuthorizeRoleRequest extends AuthorizeRequestBase {
//     /**
//      * The name of the role.
//      */
//     role: string;
// }

// export interface AuthorizeListRolesRequest
//     extends Omit<AuthorizeRoleRequest, 'role'> {
//     action: 'role.list';
// }

// export interface AuthorizeReadRoleRequest extends AuthorizeRoleRequest {
//     action: 'role.read';
// }

// export interface AuthorizeGrantRoleRequest extends AuthorizeRoleRequest {
//     action: 'role.grant';

//     /**
//      * The ID of the user that the role should be granted to.
//      */
//     targetUserId?: string;

//     /**
//      * The inst that the role should be granted to.
//      */
//     targetInstance?: string;

//     /**
//      * The time that the grant will expire.
//      * If omitted, then the grant will never expire.
//      */
//     expireTimeMs?: number | null;
// }

// export interface AuthorizeRevokeRoleRequest extends AuthorizeRoleRequest {
//     action: 'role.revoke';

//     /**
//      * The ID of the user that the role should be granted to.
//      */
//     targetUserId?: string;

//     /**
//      * The inst that the role should be granted to.
//      */
//     targetInstance?: string;
// }

// export interface AuthorizeInstRequest extends AuthorizeRequestBase {
//     /**
//      * The inst that the request is being made for.
//      */
//     inst: string;

//     /**
//      * The list of resource markers that are applied to the inst.
//      */
//     resourceMarkers: string[];
// }

// export interface AuthorizeInstCreateRequest extends AuthorizeInstRequest {
//     action: 'inst.create';
// }

// export interface AuthorizeInstDeleteRequest extends AuthorizeInstRequest {
//     action: 'inst.delete';
// }

// export interface AuthorizeInstUpdateRequest extends AuthorizeRequestBase {
//     action: 'inst.update';

//     /**
//      * The inst that the request is being made for.
//      */
//     inst: string;

//     /**
//      * The list of resource markers that are applied to the inst.
//      */
//     existingMarkers: string[];

//     /**
//      * The new resource markers that will be added to the inst.
//      * If omitted, then no markers are being added to the inst.
//      */
//     addedMarkers?: string[];

//     /**
//      * The markers that will be removed from the inst.
//      * If omitted, then no markers are being removed from the inst.
//      */
//     removedMarkers?: string[];
// }

// export interface AuthorizeInstUpdateDataRequest extends AuthorizeInstRequest {
//     action: 'inst.updateData';
// }

// export interface AuthorizeInstReadRequest extends AuthorizeInstRequest {
//     action: 'inst.read';
// }

// export interface AuthorizeInstListRequest extends AuthorizeRequestBase {
//     action: 'inst.list';

//     /**
//      * The list of insts.
//      */
//     insts: ListedInstItem[];
// }

// export interface AuthorizeInstSendActionListRequest
//     extends AuthorizeInstRequest {
//     action: 'inst.sendAction';
// }

// export interface ListedDataItem {
//     /**
//      * The address of the item.
//      */
//     address: string;

//     /**
//      * The list of markers for the item.
//      */
//     markers: string[];
// }

// export interface ListedFileItem {
//     /**
//      * The name of the file.
//      */
//     fileName: string;

//     /**
//      * The MIME type of the file.
//      */
//     fileMimeType: string;

//     /**
//      * The size of the file in bytes.
//      */
//     fileSizeInBytes: number;

//     /**
//      * The list of markers for the item.
//      */
//     markers: string[];
// }

// export interface ListedEventItem {
//     /**
//      * The name of the event.
//      */
//     eventName: string;

//     /**
//      * The list of markers for the item.
//      */
//     markers: string[];
// }

// export interface ListedInstItem {
//     /**
//      * The name of the inst.
//      */
//     inst: string;

//     /**
//      * The markers that are applied to the inst.
//      */
//     markers: string[];
// }

// export type AuthorizeResult = AuthorizeAllowed | AuthorizeDenied;

// export interface AuthorizeAllowed {
//     allowed: true;

//     /**
//      * The name of the record that the request should be for.
//      */
//     recordName: string;

//     /**
//      * The ID of the owner of the record key.
//      * Null if no record key was provided.
//      */
//     recordKeyOwnerId: string | null;

//     /**
//      * The ID of the user who (directly or indirectly) authorized the request.
//      * If a valid record key was provided, then this is the ID of the owner of the record key.
//      * If only a user ID was provided, then this is the ID of the user who is logged in.
//      * If no one was logged in, then this is null.
//      */
//     authorizerId: string | null;

//     /**
//      * The authorization information about the subject.
//      */
//     subject: SubjectAuthorization;

//     /**
//      * The authorization information about the instances.
//      */
//     instances: InstEnvironmentAuthorization[];

//     /**
//      * The list of allowed data items.
//      */
//     allowedDataItems?: ListedDataItem[];

//     /**
//      * The list of allowed file items.
//      */
//     allowedFileItems?: ListedFileItem[];

//     /**
//      * The list of allowed event items.
//      */
//     allowedEventItems?: ListedEventItem[];

//     /**
//      * The list of allowed inst items.
//      */
//     allowedInstItems?: ListedInstItem[];
// }

// export type GenericResult = GenericAllowed | GenericDenied;

// export interface GenericAllowed {
//     success: true;
//     authorization: GenericAuthorization;
// }

// export interface GenericDenied {
//     success: false;
//     reason: DenialReason;
// }

// export interface GenericAuthorization {
//     /**
//      * The role that was selected for authorization.
//      *
//      * If true, then that indicates that the "everyone" role was used.
//      * If a string, then that is the name of the role that was used.
//      */
//     role: string | true;

//     /**
//      * The security markers that were evaluated.
//      */
//     markers: MarkerAuthorization[];
// }

/**
 * Defines an interface that contains authorization information aboutthe subject that is party to an action.
 *
 * Generally, this includes information about the user and if they have the correct permissions for the action.
 */
// export interface SubjectAuthorization extends GenericAuthorization {
//     /**
//      * The ID of the user that was authorized.
//      * Null if no user ID was provided.
//      */
//     userId: string | null;

//     /**
//      * the policy that should be used for storage of subject information.
//      */
//     subjectPolicy: PublicRecordKeyPolicy;
// }

// /**
//  * Defines an interface that represents the result of calculating whether a particular action is authorized for a particular marker.
//  */
// export interface MarkerAuthorization {
//     /**
//      * The marker that the authorization is for.
//      */
//     marker: string;

//     /**
//      * The actions that have been authorized for the marker.
//      */
//     actions: ActionAuthorization[];
// }

// /**
//  * Defines an interface that represents the result of calculating the policy and permission that grants a particular action.
//  */
// export interface ActionAuthorization {
//     /**
//      * The action that was granted.
//      */
//     action: AvailablePermissions['type'];

//     /**
//      * The policy document that authorizes the action.
//      */
//     grantingPolicy: PolicyDocument;

//     /**
//      * The permission that authorizes the action to be performed.
//      */
//     grantingPermission: AvailablePermissions;
// }

// /**
//  * Defines an interface that contains authorization information about the environment that is party to an action.
//  *
//  * Generally, this includes information about the inst that is triggering the operation.
//  */
// export type InstEnvironmentAuthorization = AuthorizedInst | NotRequiredInst;

// export interface AuthorizedInst extends GenericAuthorization {
//     /**
//      * The type of authorization that this inst has received.
//      */
//     authorizationType: 'allowed';

//     /**
//      * The inst that was authorized.
//      */
//     inst: string;
// }

// export interface NotRequiredInst {
//     /**
//      * The inst that was authorized.
//      */
//     inst: string;

//     /**
//      * The type of authorization that this inst has received.
//      */
//     authorizationType: 'not_required';
// }

// export interface AuthorizeDenied {
//     allowed: false;
//     errorCode:
//         | ServerError
//         | ValidatePublicRecordKeyFailure['errorCode']
//         | 'action_not_supported'
//         | 'not_logged_in'
//         | 'not_authorized'
//         | SubscriptionLimitReached
//         | 'unacceptable_request';
//     errorMessage: string;

//     /**
//      * The reason that the authorization was denied.
//      */
//     reason?: DenialReason;
// }

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
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | AssignPermissionToSubjectAndMarkerFailure['errorCode'];
    // | AuthorizeDenied['errorCode']
    // | UpdateUserPolicyFailure['errorCode'];

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
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];

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
    // document: PolicyDocument;
    markers: string[];
}

export interface ReadUserPolicyFailure {
    success: false;
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
    errorMessage: string;
}

export type ListUserPoliciesResult =
    | ListUserPoliciesSuccess
    | ListUserPoliciesFailure;

export interface ListUserPoliciesSuccess {
    success: true;
    // policies: ListedUserPolicy[];
    totalCount: number;
}

export interface ListUserPoliciesFailure {
    success: false;
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
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
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
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
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
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
    errorCode:
        | ServerError
        | NotSupportedError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
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
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
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
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | UpdateUserRolesFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export interface ResourceInfo {
    /**
     * The kind of the resource.
     */
    resourceKind: ResourceKinds;

    /**
     * The ID of the resource.
     */
    resourceId: string;

    /**
     * The kind of the action.
     */
    actionKind: ActionKinds;
}

export interface AuthorizeSubject {
    /**
     * The type of the subject that should be authorized.
     */
    subjectType: SubjectType;

    /**
     * The ID of the subject that should be authorized.
     */
    subjectId: string | null;
}

export interface AuthorizeUserAndInstancesRequest {
    /**
     * The ID of the user that should be authorized.
     */
    userId: string;

    /**
     * The instances that should be authorized.
     */
    instances: string[];

    /**
     * The kind of resource that the action is being performed on.
     */
    resourceKind: ResourceKinds;

    /**
     * The kind of the action.
     */
    action: ActionKinds;

    /**
     * The ID of the resource.
     * Should be omitted if the action is "list".
     */
    resourceId?: string;

    /**
     * The markers that are applied to the resource.
     */
    markers: string[];
}

export type AuthorizeUserAndInstancesResult =
    | AuthorizeUserAndInstancesSuccess
    | AuthorizeSubjectFailure;

export interface AuthorizeUserAndInstancesSuccess {
    success: true;
    recordName: string;

    /**
     * The permission that authorizes the user to perform the request.
     */
    user: AuthorizedSubject;

    /**
     * The results for each subject.
     */
    results: AuthorizedSubject[];
}

export interface AuthorizeSubjectsRequest {
    /**
     * The list of subjects that should be authorized.
     */
    subjects: AuthorizeSubject[];

    /**
     * The kind of resource that the action is being performed on.
     */
    resourceKind: ResourceKinds;

    /**
     * The kind of the action.
     */
    action: ActionKinds;

    /**
     * The ID of the resource.
     * Should be omitted if the action is "list".
     */
    resourceId?: string;

    /**
     * The markers that are applied to the resource.
     */
    markers: string[];
}

export interface AuthorizeSubjectRequest {
    /**
     * The type of the subject that should be authorized.
     */
    subjectType: SubjectType;

    /**
     * The ID of the subject that should be authorized.
     */
    subjectId: string | null;

    /**
     * The kind of resource that the action is being performed on.
     */
    resourceKind: ResourceKinds;

    /**
     * The kind of the action.
     */
    action: ActionKinds;

    /**
     * The ID of the resource.
     * Should be omitted if the action is "list".
     */
    resourceId?: string;

    /**
     * The markers that are applied to the resource.
     */
    markers: string[];
}

export type AuthorizeSubjectsResult =
    | AuthorizeSubjectsSuccess
    | AuthorizeSubjectFailure;

export interface AuthorizeSubjectsSuccess {
    success: true;
    recordName: string;

    /**
     * The results for each subject.
     */
    results: AuthorizedSubject[];
}

export type AuthorizeSubjectResult =
    | AuthorizeSubjectSuccess
    | AuthorizeSubjectFailure;

export interface AuthorizeSubjectSuccess {
    success: true;

    /**
     * The name of the record that the action should be for.
     */
    recordName: string;

    /**
     * The permission that authorizes the request.
     */
    permission: MarkerPermissionAssignment | ResourcePermissionAssignment;

    /**
     * The explaination for the authorization.
     */
    explanation: string;
}

export interface AuthorizedSubject extends AuthorizeSubjectSuccess {
    /**
     * The type of the subject that was authorized.
     */
    subjectType: SubjectType;

    /**
     * The ID of the subject that was authorized.
     */
    subjectId: string;
}

export interface AuthorizeSubjectFailure {
    success: false;

    /**
     * The error code that occurred.
     */
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | 'action_not_supported'
        | 'not_logged_in'
        | 'not_authorized'
        | SubscriptionLimitReached
        | 'unacceptable_request';

    /**
     * The error message that occurred.
     */
    errorMessage: string;

    /**
     * The denial reason.
     */
    reason?: AuthorizeSubjectDenialReason;
}

export type AuthorizeSubjectDenialReason =
    | AuthorizeActionMissingPermission
    | AuthorizeActionTooManyMarkers
    | AuthorizeActionDisabledPrivacyFeature;

export interface AuthorizeActionMissingPermission {
    type: 'missing_permission';

    /**
     * The name of the record that the permission is missing in.
     */
    recordName: string;

    /**
     * Whether the user or inst is missing the permission.
     */
    subjectType: SubjectType;

    /**
     * The ID of the user/inst that is missing the permission.
     */
    subjectId: string;

    /**
     * The kind of the resource.
     */
    resourceKind: ResourceKinds;

    /**
     * The action that was attempted.
     */
    action: ActionKinds;

    /**
     * The ID of the resource that was being accessed.
     */
    resourceId?: string;
}

export interface AuthorizeActionDisabledPrivacyFeature {
    type: 'disabled_privacy_feature';

    /**
     * The name of the record that the permission is missing in.
     */
    recordName: string;

    /**
     * Whether the user or inst is missing the permission.
     */
    subjectType: SubjectType;

    /**
     * The ID of the user/inst that is missing the permission.
     */
    subjectId: string;

    /**
     * The kind of the resource.
     */
    resourceKind: ResourceKinds;

    /**
     * The action that was attempted.
     */
    action: ActionKinds;

    /**
     * The ID of the resource that was being accessed.
     */
    resourceId?: string;

    /**
     * The privacy feature that is missing.
     */
    privacyFeature: keyof PrivacyFeatures;
}

export interface AuthorizeActionTooManyMarkers {
    type: 'too_many_markers';
}
