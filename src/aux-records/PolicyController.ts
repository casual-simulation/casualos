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
    DenialReason,
    PrivacyFeatures,
    PermissionOptions,
} from '@casual-simulation/aux-common';
import { ListedStudioAssignment, PublicRecordKeyPolicy } from './RecordsStore';
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
import { sortBy, without } from 'lodash';
import { getMarkersOrDefault } from './Utils';
import { normalizeInstId, parseInstId } from './websockets';

/**
 * The maximum number of instances that can be authorized at once.
 */
export const MAX_ALLOWED_INSTANCES = 2;

/**
 * The maximum number of markers that can be placed on a resource at once.
 */
export const MAX_ALLOWED_MARKERS = 2;

const ALLOWED_RECORD_KEY_RESOURCES: [ResourceKinds, ActionKinds[]][] = [
    ['data', ['read', 'create', 'delete', 'update', 'list']],
    ['file', ['read', 'create', 'delete']],
    ['event', ['create', 'count', 'increment', 'update']],
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

/**
 * Gets the resources that need to be authorized when creating a resource with the given markers.
 * @param markers The markers that will be placed on the resource.
 */
export function getMarkerResourcesForCreation(
    markers: string[]
): ResourceInfo[] {
    // If the resource has the PUBLIC_READ_MARKER, then we only need the "create" permission and not the "assign" permission.
    return markers
        .filter((m) => m !== PUBLIC_READ_MARKER)
        .map(
            (m) =>
                ({
                    resourceKind: 'marker',
                    resourceId: m,
                    action: 'assign',
                    markers: [ACCOUNT_MARKER],
                } as ResourceInfo)
        );
}

/**
 * Gets the resources that need to be authorized when updating a resource with the given markers.
 * @param existingMarkers The markers that already exist on the resource.
 * @param newMarkers The markers that will replace the existing markers. If null, then no markers will be added or removed.
 */
export function getMarkerResourcesForUpdate(
    existingMarkers: string[],
    newMarkers: string[]
): ResourceInfo[] {
    const addedMarkers = newMarkers
        ? without(newMarkers, ...existingMarkers)
        : [];
    const removedMarkers = newMarkers
        ? without(existingMarkers, ...newMarkers)
        : [];

    const resources: ResourceInfo[] = [];
    for (let marker of addedMarkers) {
        resources.push({
            resourceKind: 'marker',
            resourceId: marker,
            action: 'assign',
            markers: [ACCOUNT_MARKER],
        });
    }

    for (let marker of removedMarkers) {
        resources.push({
            resourceKind: 'marker',
            resourceId: marker,
            action: 'unassign',
            markers: [ACCOUNT_MARKER],
        });
    }

    return resources;
}

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
        let recordKeyCreatorId: string;
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
                recordKeyCreatorId = recordKeyResult.keyCreatorId;
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
            recordKeyCreatorId,
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

    /**
     * Attempts to authorize the given user and instances for the action and resource(s).
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeUserAndInstances(
        context: AuthorizationContext,
        request: AuthorizeUserAndInstancesRequest
    ): Promise<AuthorizeUserAndInstancesResult> {
        try {
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
                '[PolicyController] A server error occurred while authorizing user and instances.',
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
     * Attempts to authorize the given user and instances for the given resources.
     * @param context The authorization context for the request.
     * @param request The request.
     */
    async authorizeUserAndInstancesForResources(
        context: AuthorizationContext,
        request: AuthorizeUserAndInstancesForResources
    ): Promise<AuthorizeUserAndInstancesForResourcesResult> {
        try {
            const subjects: AuthorizeSubject[] = [
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
            ];

            const subjectPermission = new Map<string, AuthorizedSubject>();
            const results: AuthorizedResource[] = [];
            const recordName = context.recordName;

            for (let resource of request.resources) {
                let subjectsToAuthorize: AuthorizeSubject[] = [];
                let authorizations: AuthorizedSubject[] = [];

                for (let subject of subjects) {
                    const subjectKey = `${subject.subjectType}.${subject.subjectId}`;
                    const authorizedSubject = subjectPermission.get(subjectKey);

                    if (authorizedSubject) {
                        const permission = authorizedSubject.permission;
                        const isCorrectResourceKind =
                            permission.resourceKind === null ||
                            permission.resourceKind === resource.resourceKind;
                        const isCorrectAction =
                            permission.action === null ||
                            permission.action === resource.action;
                        const isCorrectMarker =
                            !('marker' in permission) ||
                            resource.markers.includes(permission.marker);
                        const isCorrectResource =
                            !('resourceId' in permission) ||
                            permission.resourceId === null ||
                            permission.resourceId === resource.resourceId;

                        if (
                            isCorrectResourceKind &&
                            isCorrectAction &&
                            isCorrectMarker &&
                            isCorrectResource
                        ) {
                            // Record the authorization
                            authorizations.push(authorizedSubject);
                        } else {
                            subjectsToAuthorize.push(subject);
                        }
                    } else {
                        subjectsToAuthorize.push(subject);
                    }
                }

                if (subjectsToAuthorize.length > 0) {
                    const result = await this.authorizeSubjects(context, {
                        action: resource.action,
                        markers: resource.markers,
                        resourceKind: resource.resourceKind,
                        resourceId: resource.resourceId,
                        subjects: subjectsToAuthorize,
                    });

                    if (result.success === false) {
                        return result;
                    }
                    for (let authorization of result.results) {
                        const subjectKey = `${authorization.subjectType}.${authorization.subjectId}`;
                        authorizations.push(authorization);

                        const permission = authorization.permission;

                        const existingAuthorization =
                            subjectPermission.get(subjectKey);
                        if (!existingAuthorization) {
                            subjectPermission.set(subjectKey, authorization);
                        } else {
                            const existingPermission =
                                existingAuthorization.permission;

                            const isResourceKindMoreGeneral =
                                permission.resourceKind === null &&
                                existingPermission.resourceKind !== null;
                            const isActionMoreGeneral =
                                permission.action === null &&
                                existingPermission.action !== null;
                            const isMarkerMoreGeneral =
                                'marker' in permission &&
                                'marker' in existingPermission &&
                                permission.marker === null &&
                                existingPermission.marker !== null;
                            const isResourceMoreGeneral =
                                'resourceId' in permission &&
                                'resourceId' in existingPermission &&
                                permission.resourceId === null &&
                                existingPermission.resourceId !== null;

                            if (
                                isResourceKindMoreGeneral ||
                                isActionMoreGeneral ||
                                isMarkerMoreGeneral ||
                                isResourceMoreGeneral
                            ) {
                                subjectPermission.set(
                                    subjectKey,
                                    authorization
                                );
                            }
                        }
                    }
                }

                if (authorizations.length !== subjects.length) {
                    console.error(
                        '[PolicyController] [authorizeUserAndInstancesForResources] The number of authorizations does not match the number of subjects!'
                    );
                    return {
                        success: false,
                        errorCode: 'server_error',
                        errorMessage: 'A server error occurred.',
                    };
                }

                results.push({
                    success: true,
                    recordName: recordName,
                    resourceKind: resource.resourceKind,
                    resourceId: resource.resourceId,
                    action: resource.action,
                    markers: resource.markers,
                    results: authorizations,
                    user: authorizations.find(
                        (r) =>
                            r.subjectType === 'user' &&
                            r.subjectId === request.userId
                    ),
                });
            }

            return {
                success: true,
                recordName: recordName,
                results,
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while authorizing user and instances for resources.',
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
        context: AuthorizationContext,
        request: AuthorizeSubjectsRequest
    ): Promise<AuthorizeSubjectsResult> {
        try {
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
                    context,
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
                recordName: context.recordName,
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
        const result = await this._authorizeSubjectUsingContext(
            context,
            request
        );

        if (result.success) {
            console.log(
                `[PolicyController] [action: ${request.resourceKind}.${request.action} resourceId: ${request.resourceId} recordName: ${context.recordName}, userId: ${context.userId}] Request authorized.`
            );
        } else {
            console.log(
                `[PolicyController] [action: ${request.resourceKind}.${request.action} resourceId: ${request.resourceId} recordName: ${context.recordName}, userId: ${context.userId}] Request denied:`,
                result
            );
        }

        return result;
    }

    /**
     * Attempts to authorize the given subject for the action and resource(s).
     * Returns a promise that resolves with information about the security properties of the request.
     * @param context The context for the request.
     * @param request The request to authorize.
     */
    private async _authorizeSubjectUsingContext(
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
            const subjectType = request.subjectType;
            let subjectId = request.subjectId;

            if (subjectType === 'inst') {
                subjectId = normalizeInstId(subjectId);
            }

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
                        subjectType: subjectType,
                        subjectId: subjectId,
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

            if (subjectType === 'role' && subjectId === ADMIN_ROLE_NAME) {
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
                    subjectType === 'user' &&
                    !subjectId
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

            if (subjectType === 'user' && subjectId) {
                if (subjectId === context.recordOwnerId) {
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
                        (m) => m.userId === subjectId
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
                                    userId: subjectId,
                                    subjectType: 'user',
                                    subjectId: subjectId,

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
            } else if (subjectType === 'inst' && subjectId) {
                const instId = parseInstId(subjectId);
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
                                subjectId: subjectId,

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
                                subjectId: subjectId,

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
                                subjectId: subjectId,

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

            if (subjectId) {
                if (subjectType === 'inst' || subjectType === 'user') {
                    // check for admin role
                    const roles =
                        subjectType === 'user'
                            ? await this._policies.listRolesForUser(
                                  recordName,
                                  subjectId
                              )
                            : await this._policies.listRolesForInst(
                                  recordName,
                                  subjectId
                              );

                    const role = roles.find((r) => r.role === ADMIN_ROLE_NAME);
                    if (role) {
                        const kindString =
                            subjectType === 'user' ? 'User' : 'Inst';
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
                            subjectType,
                            subjectId,
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
                            subjectType,
                            subjectId,
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
                    return {
                        success: true,
                        recordName,
                        permission: permission,
                        explanation: explainationForPermissionAssignment(
                            subjectType,
                            permission
                        ),
                    };
                }
            }

            if (
                !subjectId &&
                (!context.recordKeyProvided ||
                    !isAllowedRecordKeyResource(
                        request.resourceKind,
                        request.action
                    ))
            ) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    subjectType: subjectType,
                    subjectId: subjectId,
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
     * Gets the list of permissions in the given record.
     * @param recordKeyOrRecordName The name of the record.
     * @param userId The ID of the currently logged in user.
     * @param instances The instances that are loaded.
     */
    async listPermissions(
        recordKeyOrRecordName: string,
        userId: string,
        instances?: string[] | null
    ): Promise<ListPermissionsResult> {
        try {
            const context = await this.constructAuthorizationContext({
                recordKeyOrRecordName,
                userId,
            });

            if (context.success === false) {
                return context;
            }

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    userId,
                    instances,
                    resourceKind: 'marker',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const recordName = context.context.recordName;

            const result = await this._policies.listPermissionsInRecord(
                recordName
            );

            if (result.success === false) {
                return result;
            }

            return {
                success: true,
                recordName,
                resourcePermissions: result.resourceAssignments.map(
                    (r) =>
                        ({
                            id: r.id,
                            recordName: r.recordName,
                            subjectType: r.subjectType,
                            subjectId: r.subjectId,
                            resourceKind: r.resourceKind,
                            action: r.action,
                            resourceId: r.resourceId,
                            options: r.options,
                            expireTimeMs: r.expireTimeMs,
                        } as ListedResourcePermission)
                ),
                markerPermissions: result.markerAssignments.map(
                    (r) =>
                        ({
                            id: r.id,
                            recordName: r.recordName,
                            subjectType: r.subjectType,
                            subjectId: r.subjectId,
                            resourceKind: r.resourceKind,
                            action: r.action,
                            marker: r.marker,
                            options: r.options,
                            expireTimeMs: r.expireTimeMs,
                        } as ListedMarkerPermission)
                ),
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while listing permissions.',
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
     * Gets the list of permissions that have been assigned to the given marker.
     * @param recordKeyOrRecordName The name of the record.
     * @param marker The marker that the permissions should be listed for.
     * @param userId The ID of the currently logged in user.
     * @param instances The instances that are loaded.
     */
    async listPermissionsForMarker(
        recordKeyOrRecordName: string,
        marker: string,
        userId: string,
        instances?: string[] | null
    ): Promise<ListPermissionsForMarkerResult> {
        try {
            const context = await this.constructAuthorizationContext({
                recordKeyOrRecordName,
                userId,
            });

            if (context.success === false) {
                return context;
            }

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    userId,
                    instances,
                    resourceKind: 'marker',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const recordName = context.context.recordName;

            const result = await this._policies.listPermissionsForMarker(
                recordName,
                marker
            );
            return {
                success: true,
                recordName,
                markerPermissions: result.map(
                    (r) =>
                        ({
                            id: r.id,
                            recordName: r.recordName,
                            subjectType: r.subjectType,
                            subjectId: r.subjectId,
                            resourceKind: r.resourceKind,
                            action: r.action,
                            marker: r.marker,
                            options: r.options,
                            expireTimeMs: r.expireTimeMs,
                        } as ListedMarkerPermission)
                ),
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while listing permissions for marker.',
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
     * Gets the list of permissions that have been assigned to the given marker.
     * @param recordKeyOrRecordName The name of the record.
     * @param resourceKind The kind of the resource.
     * @param resourceId The ID of the resource.
     * @param userId The ID of the currently logged in user.
     * @param instances The instances that are loaded.
     */
    async listPermissionsForResource(
        recordKeyOrRecordName: string,
        resourceKind: ResourceKinds,
        resourceId: string,
        userId: string,
        instances?: string[] | null
    ): Promise<ListPermissionsForResourceResult> {
        try {
            const context = await this.constructAuthorizationContext({
                recordKeyOrRecordName,
                userId,
            });

            if (context.success === false) {
                return context;
            }

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    userId,
                    instances,
                    resourceKind: 'marker',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const recordName = context.context.recordName;

            const result = await this._policies.listPermissionsInRecord(
                recordName
            );

            if (result.success === false) {
                return result;
            }

            return {
                success: true,
                recordName,
                resourcePermissions: result.resourceAssignments.map(
                    (r) =>
                        ({
                            id: r.id,
                            recordName: r.recordName,
                            subjectType: r.subjectType,
                            subjectId: r.subjectId,
                            resourceKind: r.resourceKind,
                            action: r.action,
                            resourceId: r.resourceId,
                            options: r.options,
                            expireTimeMs: r.expireTimeMs,
                        } as ListedResourcePermission)
                ),
            };
        } catch (err) {
            console.error(
                '[PolicyController] A server error occurred while listing permissions for resource.',
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
                context.context,
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
            console.error(
                '[PolicyController] A server error occurred while granting a marker permission.',
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
     * Attempts to revoke a permission from a marker.
     * @param request The request for the operation.
     */
    async revokeMarkerPermission(
        request: RevokeMarkerPermissionRequest
    ): Promise<RevokeMarkerPermissionResult> {
        try {
            const permission =
                await this._policies.getMarkerPermissionAssignmentById(
                    request.permissionId
                );

            if (!permission) {
                return {
                    success: true,
                };
            }

            const baseRequest = {
                recordKeyOrRecordName: permission.recordName,
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
                context.context,
                {
                    action: 'revokePermission',
                    resourceKind: 'marker',
                    resourceId: permission.marker,
                    markers: [ACCOUNT_MARKER],
                    userId: request.userId,
                    instances: request.instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const deleteResult =
                await this._policies.deleteMarkerPermissionAssignmentById(
                    permission.id
                );

            if (!deleteResult.success) {
                return deleteResult;
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
     * Attempts to grant a permission to a resource.
     * @param request The request.
     */
    async grantResourcePermission(
        request: GrantResourcePermissionRequest
    ): Promise<GrantResourcePermissionResult> {
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

            if (!request.permission.resourceId) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'You must provide a resourceId for the permission.',
                };
            } else if (!request.permission.resourceKind) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'You must provide a resourceKind for the permission.',
                };
            }

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    action: 'grantPermission',

                    // Resource permissions require access to the "account" marker
                    // because there is currently no other marker that would make sense
                    // for per-resource permissions.
                    resourceKind: 'marker',
                    resourceId: ACCOUNT_MARKER,
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
                await this._policies.assignPermissionToSubjectAndResource(
                    recordName,
                    request.permission.subjectType,
                    request.permission.subjectId,
                    request.permission.resourceKind,
                    request.permission.resourceId,
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
            console.error(
                '[PolicyController] A server error occurred while granting a resource permission.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
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
                const authorization = await this.authorizeUserAndInstances(
                    context.context,
                    {
                        resourceKind: 'role',
                        action: 'list',
                        markers: [ACCOUNT_MARKER],
                        userId: userId,
                        instances: instances,
                    }
                );

                if (authorization.success === false) {
                    return authorization;
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

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'role',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                    userId: userId,
                    instances: instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const result = await this._policies.listRolesForInst(
                context.context.recordName,
                normalizeInstId(subjectId)
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

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'role',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                    userId: userId,
                    instances: instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
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

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'role',
                    action: 'list',
                    markers: [ACCOUNT_MARKER],
                    userId: userId,
                    instances: instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
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
            const targetInstance = normalizeInstId(request.instance);
            const expireTimeMs = getExpireTime(request.expireTimeMs);

            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'role',
                    action: 'grant',
                    resourceId: request.role,
                    markers: [ACCOUNT_MARKER],
                    userId: userId,
                    instances: instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
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
            const targetInstance = normalizeInstId(request.instance);
            const authorization = await this.authorizeUserAndInstances(
                context.context,
                {
                    resourceKind: 'role',
                    action: 'revoke',
                    resourceId: request.role,
                    markers: [ACCOUNT_MARKER],
                    userId: userId,
                    instances: instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
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
     * The ID of the user who created the record key.
     */
    recordKeyCreatorId: string;

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

export interface GrantMarkerPermissionRequest {
    recordKeyOrRecordName: string;
    userId: string;
    marker: string;
    permission: AvailablePermissions;
    instances?: string[] | null;
}

/**
 * Defines the possible results of granting a permission to a marker.
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

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export interface RevokeMarkerPermissionRequest {
    permissionId: string;
    userId: string;
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


export interface GrantResourcePermissionRequest {
    recordKeyOrRecordName: string;
    userId: string;
    permission: AvailablePermissions;
    instances?: string[] | null;
}

/**
 * Defines the possible results of granting a permission to a resource.
 *
 * @dochash types/records/policies
 * @docname GrantResourcePermissionResult
 */
export type GrantResourcePermissionResult =
    | GrantResourcePermissionSuccess
    | GrantResourcePermissionFailure;


/**
 * Defines an interface that represents a successful request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 1
 * @docname GrantResourcePermissionSuccess
 */
export interface GrantResourcePermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 2
 * @docname GrantResourcePermissionFailure
 */
export interface GrantResourcePermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | AssignPermissionToSubjectAndMarkerFailure['errorCode'];

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
    action: ActionKinds;

    /**
     * The markers that are applied to the resource.
     */
    markers: string[];
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

export interface AuthorizeUserAndInstancesForResources {
    /**
     * The ID of the user that should be authorized.
     */
    userId: string;

    /**
     * The instances that should be authorized.
     */
    instances: string[];

    /**
     * The resources that should be authorized.
     */
    resources: ResourceInfo[];
}

export type AuthorizeUserAndInstancesForResourcesResult =
    | AuthorizeUserAndInstancesForResourcesSuccess
    | AuthorizeSubjectFailure;

export interface AuthorizeUserAndInstancesForResourcesSuccess {
    success: true;
    recordName: string;
    results: AuthorizedResource[];
}

export interface AuthorizedResource
    extends ResourceInfo,
        AuthorizeUserAndInstancesSuccess {}

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
    reason?: DenialReason;
}

export type ListPermissionsResult =
    | ListPermissionsSuccess
    | ListPermissionsFailure;

export interface ListPermissionsSuccess {
    success: true;
    recordName: string;

    resourcePermissions: ListedResourcePermission[];
    markerPermissions: ListedMarkerPermission[];
}

export interface ListPermissionsFailure {
    success: false;
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
    errorMessage: string;
}

export type ListPermissionsForMarkerResult =
    | ListPermissionsForMarkerSuccess
    | ListPermissionsFailure;

export interface ListPermissionsForMarkerSuccess {
    success: true;
    recordName: string;
    markerPermissions: ListedMarkerPermission[];
}

export type ListPermissionsForResourceResult =
    | ListPermissionsForResourceSuccess
    | ListPermissionsFailure;

export interface ListPermissionsForResourceSuccess {
    success: true;
    recordName: string;
    resourcePermissions: ListedResourcePermission[];
}

/**
 * Defines an interface that represents a permission that grants access.
 */
export interface ListedPermission {
    /**
     * The ID of the permission.
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

/**
 * Defines an interface that represents a permission that grants access to a single resource.
 *
 * @dochash types/permissions
 * @docname ResourcePermission
 */
export interface ListedResourcePermission extends ListedPermission {
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
 * Defines an interface that represents a permission that grants access to resources with a marker.
 *
 * @dochash types/permissions
 * @docname MarkerPermission
 */
export interface ListedMarkerPermission extends ListedPermission {
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
