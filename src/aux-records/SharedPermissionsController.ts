/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { ServerError } from '@casual-simulation/aux-common/Errors';
import type {
    AvailablePermissions,
    SharedMarkerPermission,
} from '@casual-simulation/aux-common';
import { ACCOUNT_MARKER } from '@casual-simulation/aux-common';
import type { AuthStore } from './AuthStore';
import type {
    AuthorizeSubjectFailure,
    ConstructAuthorizationContextFailure,
    GrantMarkerPermissionFailure,
    PolicyController,
    RevokeMarkerPermissionFailure,
} from './PolicyController';
import type {
    SharedPermission,
    SharedPermissionStatus,
    SharedPermissionsStore,
} from './SharedPermissionsStore';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { v7 as uuidv7 } from 'uuid';

const TRACE_NAME = 'SharedPermissionsController';

/**
 * The default amount of time (in miliseconds) that a shared permission request is valid for
 * before it needs to be accepted.
 */
export const SHARED_PERMISSION_REQUEST_LIFETIME_MS = 1000 * 60 * 60 * 24;

/**
 * Defines a class that is able to manage shared permissions.
 * Shared permissions are permissions that have to be requested by one user and then accepted by
 * another user before they take effect. Once accepted, both users are granted the same
 * marker-based permission in each other's respective records. Either party can revoke the shared
 * permission, which removes the permissions that were granted to both parties.
 */
export class SharedPermissionsController {
    private _store: SharedPermissionsStore;
    private _policies: PolicyController;
    private _auth: AuthStore;

    constructor(
        store: SharedPermissionsStore,
        policies: PolicyController,
        auth: AuthStore
    ) {
        this._store = store;
        this._policies = policies;
        this._auth = auth;
    }

    /**
     * Requests a shared permission from another user.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async requestSharedPermission(
        request: RequestSharedPermissionRequest
    ): Promise<RequestSharedPermissionResult> {
        try {
            const context = await this._policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });
            if (context.success === false) {
                return {
                    success: false,
                    errorCode: context.errorCode,
                    errorMessage: context.errorMessage,
                };
            }

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        action: 'grantPermission',
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

            if (
                typeof request.expireTimeMs === 'number' &&
                request.expireTimeMs <= Date.now()
            ) {
                return {
                    success: false,
                    errorCode: 'unacceptable_expire_time',
                    errorMessage: 'The expiration time must be in the future.',
                };
            }

            if (request.targetUserId && request.targetUserEmail) {
                return {
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'targetUserId and targetUserEmail are mutually exclusive. Only one may be provided.',
                };
            }

            let targetUserId: string | null = request.targetUserId ?? null;
            if (!targetUserId && request.targetUserEmail) {
                const targetUser = await this._auth.findUserByAddress(
                    request.targetUserEmail,
                    'email'
                );

                if (!targetUser) {
                    return {
                        success: false,
                        errorCode: 'user_not_found',
                        errorMessage:
                            'The user with the given email address could not be found.',
                    };
                }

                targetUserId = targetUser.id;
            }

            const recordName = context.context.recordName;
            const now = Date.now();
            const id = uuidv7();

            const sharedPermission: SharedPermission = {
                id,
                recordName,
                requestingUserId: request.userId,
                targetUserId,
                permission: request.permission,
                status: 'requested',
                createdAtMs: now,
                updatedAtMs: now,
                expireTimeMs:
                    request.expireTimeMs ??
                    now + SHARED_PERMISSION_REQUEST_LIFETIME_MS,
                recipientRecordName: null,
                recipientUserId: null,
                requestingPermissionAssignmentId: null,
                recipientPermissionAssignmentId: null,
            };

            await this._store.saveSharedPermission(sharedPermission);

            console.log(
                `[SharedPermissionsController] [requestSharedPermission] [userId: ${request.userId}, recordName: ${recordName}, sharedPermissionId: ${id}] Requested shared permission.`
            );

            return {
                success: true,
                sharedPermissionId: id,
            };
        } catch (err) {
            return this._handleError(err, 'requesting a shared permission');
        }
    }

    /**
     * Accepts a shared permission request.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async acceptSharedPermission(
        request: AcceptSharedPermissionRequest
    ): Promise<AcceptSharedPermissionResult> {
        try {
            const sharedPermission = await this._store.findSharedPermissionById(
                request.sharedPermissionId
            );

            if (!sharedPermission) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The shared permission could not be found.',
                };
            }

            if (sharedPermission.status === 'accepted') {
                // Already accepted. Do nothing.
                return {
                    success: true,
                };
            }

            if (sharedPermission.status !== 'requested') {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: `The shared permission cannot be accepted because it has already been ${sharedPermission.status}.`,
                };
            }

            if (
                sharedPermission.targetUserId &&
                sharedPermission.targetUserId !== request.userId
            ) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to accept this shared permission.',
                };
            }

            if (
                sharedPermission.expireTimeMs !== null &&
                Date.now() >= sharedPermission.expireTimeMs
            ) {
                return {
                    success: false,
                    errorCode: 'shared_permission_expired',
                    errorMessage: 'The shared permission request has expired.',
                };
            }

            // Grant the permission to the requesting user inside the recipient's record.
            const recipientGrant = await this._policies.grantMarkerPermission({
                recordKeyOrRecordName: request.recordName,
                marker: sharedPermission.permission.marker,
                userId: request.userId,
                permission: {
                    ...sharedPermission.permission,
                    subjectType: 'user',
                    subjectId: sharedPermission.requestingUserId,
                    resourceId: null,
                } as AvailablePermissions,
                instances: request.instances,
            });

            if (recipientGrant.success === false) {
                return {
                    success: false,
                    errorCode: recipientGrant.errorCode,
                    errorMessage: recipientGrant.errorMessage,
                };
            }

            // Grant the permission to the recipient user inside the requester's record.
            const requesterGrant = await this._policies.grantMarkerPermission({
                recordKeyOrRecordName: sharedPermission.recordName,
                marker: sharedPermission.permission.marker,
                userId: sharedPermission.requestingUserId,
                permission: {
                    ...sharedPermission.permission,
                    subjectType: 'user',
                    subjectId: request.userId,
                    resourceId: null,
                } as AvailablePermissions,
                instances: request.instances,
            });

            if (requesterGrant.success === false) {
                // Roll back the grant that was made to the recipient's record.
                if (recipientGrant.permissionAssignmentId) {
                    await this._policies.revokeMarkerPermission({
                        permissionId: recipientGrant.permissionAssignmentId,
                        userId: request.userId,
                        instances: request.instances,
                    });
                }

                return {
                    success: false,
                    errorCode: requesterGrant.errorCode,
                    errorMessage: requesterGrant.errorMessage,
                };
            }

            const updated: SharedPermission = {
                ...sharedPermission,
                status: 'accepted',
                updatedAtMs: Date.now(),
                expireTimeMs: null,
                recipientRecordName: request.recordName,
                recipientUserId: request.userId,
                requestingPermissionAssignmentId:
                    requesterGrant.permissionAssignmentId ?? null,
                recipientPermissionAssignmentId:
                    recipientGrant.permissionAssignmentId ?? null,
            };

            await this._store.saveSharedPermission(updated);

            console.log(
                `[SharedPermissionsController] [acceptSharedPermission] [userId: ${request.userId}, sharedPermissionId: ${request.sharedPermissionId}] Accepted shared permission.`
            );

            return {
                success: true,
            };
        } catch (err) {
            return this._handleError(err, 'accepting a shared permission');
        }
    }

    /**
     * Rejects a shared permission request from another user.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async rejectSharedPermission(
        request: RejectSharedPermissionRequest
    ): Promise<RejectSharedPermissionResult> {
        try {
            const sharedPermission = await this._store.findSharedPermissionById(
                request.sharedPermissionId
            );

            if (!sharedPermission) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The shared permission could not be found.',
                };
            }

            if (sharedPermission.status !== 'requested') {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: `The shared permission cannot be rejected because it has already been ${sharedPermission.status}.`,
                };
            }

            if (!sharedPermission.targetUserId) {
                return {
                    success: false,
                    errorCode: 'action_not_supported',
                    errorMessage:
                        'This shared permission was not requested from a specific user, so it cannot be rejected. It can only expire.',
                };
            }

            if (sharedPermission.targetUserId !== request.userId) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to reject this shared permission.',
                };
            }

            const updated: SharedPermission = {
                ...sharedPermission,
                status: 'rejected',
                updatedAtMs: Date.now(),
            };

            await this._store.saveSharedPermission(updated);

            console.log(
                `[SharedPermissionsController] [rejectSharedPermission] [userId: ${request.userId}, sharedPermissionId: ${request.sharedPermissionId}] Rejected shared permission.`
            );

            return {
                success: true,
            };
        } catch (err) {
            return this._handleError(err, 'rejecting a shared permission');
        }
    }

    /**
     * Revokes a shared permission that was previously requested or accepted.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async revokeSharedPermission(
        request: RevokeSharedPermissionRequest
    ): Promise<RevokeSharedPermissionResult> {
        try {
            const sharedPermission = await this._store.findSharedPermissionById(
                request.sharedPermissionId
            );

            if (!sharedPermission) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'The shared permission could not be found.',
                };
            }

            if (
                sharedPermission.status === 'rejected' ||
                sharedPermission.status === 'revoked'
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: `The shared permission cannot be revoked because it has already been ${sharedPermission.status}.`,
                };
            }

            const isRequestingUser =
                sharedPermission.requestingUserId === request.userId;
            const isRecipientUser =
                sharedPermission.status === 'accepted' &&
                sharedPermission.recipientUserId === request.userId;

            if (!isRequestingUser && !isRecipientUser) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to revoke this shared permission.',
                };
            }

            if (sharedPermission.status === 'accepted') {
                if (sharedPermission.requestingPermissionAssignmentId) {
                    const result = await this._policies.revokeMarkerPermission({
                        permissionId:
                            sharedPermission.requestingPermissionAssignmentId,
                        userId: sharedPermission.requestingUserId,
                        instances: request.instances,
                    });

                    if (
                        result.success === false &&
                        result.errorCode !== 'permission_not_found'
                    ) {
                        return result;
                    }
                }

                if (sharedPermission.recipientPermissionAssignmentId) {
                    const result = await this._policies.revokeMarkerPermission({
                        permissionId:
                            sharedPermission.recipientPermissionAssignmentId,
                        userId: sharedPermission.recipientUserId,
                        instances: request.instances,
                    });

                    if (
                        result.success === false &&
                        result.errorCode !== 'permission_not_found'
                    ) {
                        return result;
                    }
                }
            }

            const updated: SharedPermission = {
                ...sharedPermission,
                status: 'revoked',
                updatedAtMs: Date.now(),
            };

            await this._store.saveSharedPermission(updated);

            console.log(
                `[SharedPermissionsController] [revokeSharedPermission] [userId: ${request.userId}, sharedPermissionId: ${request.sharedPermissionId}] Revoked shared permission.`
            );

            return {
                success: true,
            };
        } catch (err) {
            return this._handleError(err, 'revoking a shared permission');
        }
    }

    /**
     * Lists all the active shared permissions for a user.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listSharedPermissions(
        request: ListSharedPermissionsRequest
    ): Promise<ListSharedPermissionsResult> {
        try {
            const result = await this._store.listSharedPermissionsForUser(
                request.userId,
                request.page
            );

            return {
                success: true,
                sharedPermissions: result.sharedPermissions,
                totalCount: result.totalCount,
            };
        } catch (err) {
            return this._handleError(err, 'listing shared permissions');
        }
    }

    /**
     * Lists shared permissions for a user, filtered by status.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listSharedPermissionsByStatus(
        request: ListSharedPermissionsByStatusRequest
    ): Promise<ListSharedPermissionsResult> {
        try {
            const result =
                await this._store.listSharedPermissionsForUserByStatus(
                    request.userId,
                    request.status,
                    request.page
                );

            return {
                success: true,
                sharedPermissions: result.sharedPermissions,
                totalCount: result.totalCount,
            };
        } catch (err) {
            return this._handleError(
                err,
                'listing shared permissions by status'
            );
        }
    }

    /**
     * Lists shared permissions that this user has requested from other users.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listSentSharedPermissions(
        request: ListSharedPermissionsRequest
    ): Promise<ListSharedPermissionsResult> {
        try {
            const result = await this._store.listSentSharedPermissions(
                request.userId,
                request.page
            );

            return {
                success: true,
                sharedPermissions: result.sharedPermissions,
                totalCount: result.totalCount,
            };
        } catch (err) {
            return this._handleError(err, 'listing sent shared permissions');
        }
    }

    /**
     * Lists shared permissions that have been requested from this user by other users.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listRequestedSharedPermissions(
        request: ListSharedPermissionsRequest
    ): Promise<ListSharedPermissionsResult> {
        try {
            const result = await this._store.listRequestedSharedPermissions(
                request.userId,
                request.page
            );

            return {
                success: true,
                sharedPermissions: result.sharedPermissions,
                totalCount: result.totalCount,
            };
        } catch (err) {
            return this._handleError(
                err,
                'listing requested shared permissions'
            );
        }
    }

    /**
     * Lists the records that have been shared with the given user via accepted shared permissions.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async listSharedRecords(
        request: ListSharedRecordsRequest
    ): Promise<ListSharedRecordsResult> {
        try {
            const result =
                await this._store.listSharedPermissionsForUserByStatus(
                    request.userId,
                    'accepted',
                    request.page
                );

            const sharedRecords: SharedRecordListItem[] =
                result.sharedPermissions.map((sp) => {
                    const isRequestingUser =
                        sp.requestingUserId === request.userId;
                    return {
                        recordName: isRequestingUser
                            ? sp.recipientRecordName
                            : sp.recordName,
                        ownerUserId: isRequestingUser
                            ? sp.recipientUserId
                            : sp.requestingUserId,
                        sharedPermissionId: sp.id,
                        permission: sp.permission,
                    };
                });

            return {
                success: true,
                sharedRecords,
                totalCount: result.totalCount,
            };
        } catch (err) {
            return this._handleError(err, 'listing shared records');
        }
    }

    private _handleError(
        err: any,
        action: string
    ): { success: false; errorCode: 'server_error'; errorMessage: string } {
        const span = trace.getActiveSpan();
        span?.recordException(err);
        span?.setStatus({ code: SpanStatusCode.ERROR });

        console.error(
            `[SharedPermissionsController] A server error occurred while ${action}.`,
            err
        );
        return {
            success: false,
            errorCode: 'server_error',
            errorMessage: 'A server error occurred.',
        };
    }
}

export interface RequestSharedPermissionRequest {
    /**
     * The ID of the user that is currently logged in and is requesting the shared permission.
     * This user must have admin permission in recordName.
     */
    userId: string;

    /**
     * The name (or record key) of the record that the current user wants to share.
     */
    recordName: string;

    /**
     * The marker-based permission that the user wants to share and receive.
     */
    permission: SharedMarkerPermission;

    /**
     * The ID of the other user that the user wants to share with.
     * If omitted, then the first user to accept the share will be used.
     * Mutually exclusive with targetUserEmail.
     */
    targetUserId?: string | null;

    /**
     * The email address of the other user that the user wants to share with.
     * If omitted, then the first user to accept the share will be used.
     * Mutually exclusive with targetUserId.
     */
    targetUserEmail?: string | null;

    /**
     * The unix time in miliseconds that the shared permission request will expire.
     * Defaults to 24 hours from now.
     */
    expireTimeMs?: number | null;

    /**
     * The instances that are loaded.
     */
    instances?: string[] | null;
}

export type RequestSharedPermissionResult =
    | RequestSharedPermissionSuccess
    | RequestSharedPermissionFailure;

export interface RequestSharedPermissionSuccess {
    success: true;

    /**
     * The ID of the shared permission that was created.
     */
    sharedPermissionId: string;
}

export interface RequestSharedPermissionFailure {
    success: false;
    errorCode:
        | ServerError
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | 'unacceptable_expire_time'
        | 'unacceptable_request'
        | 'user_not_found';
    errorMessage: string;
}

export interface AcceptSharedPermissionRequest {
    /**
     * The ID of the user that is currently logged in and is accepting the shared permission.
     * This user must have admin permission in recordName.
     */
    userId: string;

    /**
     * The ID of the shared permission.
     */
    sharedPermissionId: string;

    /**
     * The name (or record key) of the record that should be shared with the other user.
     */
    recordName: string;

    /**
     * The instances that are loaded.
     */
    instances?: string[] | null;
}

export type AcceptSharedPermissionResult =
    | AcceptSharedPermissionSuccess
    | AcceptSharedPermissionFailure;

export interface AcceptSharedPermissionSuccess {
    success: true;
}

export interface AcceptSharedPermissionFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_found'
        | 'invalid_request'
        | 'shared_permission_expired'
        | ConstructAuthorizationContextFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | GrantMarkerPermissionFailure['errorCode'];
    errorMessage: string;
}

export interface RejectSharedPermissionRequest {
    /**
     * The ID of the user that is currently logged in and is rejecting the shared permission.
     */
    userId: string;

    /**
     * The ID of the shared permission to reject.
     */
    sharedPermissionId: string;
}

export type RejectSharedPermissionResult =
    | RejectSharedPermissionSuccess
    | RejectSharedPermissionFailure;

export interface RejectSharedPermissionSuccess {
    success: true;
}

export interface RejectSharedPermissionFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_found'
        | 'invalid_request'
        | 'not_authorized'
        | 'action_not_supported';
    errorMessage: string;
}

export interface RevokeSharedPermissionRequest {
    /**
     * The ID of the user that is currently logged in and is revoking the shared permission.
     */
    userId: string;

    /**
     * The ID of the shared permission that should be revoked.
     */
    sharedPermissionId: string;

    /**
     * The instances that are loaded.
     */
    instances?: string[] | null;
}

export type RevokeSharedPermissionResult =
    | RevokeSharedPermissionSuccess
    | RevokeSharedPermissionFailure;

export interface RevokeSharedPermissionSuccess {
    success: true;
}

export interface RevokeSharedPermissionFailure {
    success: false;
    errorCode:
        | ServerError
        | 'not_found'
        | 'invalid_request'
        | 'not_authorized'
        | RevokeMarkerPermissionFailure['errorCode'];
    errorMessage: string;
}

export interface ListSharedPermissionsRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The page number to request. Defaults to 0.
     */
    page?: number | null;
}

export interface ListSharedPermissionsByStatusRequest
    extends ListSharedPermissionsRequest {
    /**
     * The status to filter by.
     */
    status: SharedPermissionStatus;
}

export type ListSharedPermissionsResult =
    | ListSharedPermissionsSuccess
    | ListSharedPermissionsFailure;

export interface ListSharedPermissionsSuccess {
    success: true;
    sharedPermissions: SharedPermission[];
    totalCount: number;
}

export interface ListSharedPermissionsFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export interface ListSharedRecordsRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The page number to request. Defaults to 0.
     */
    page?: number | null;
}

export type ListSharedRecordsResult =
    | ListSharedRecordsSuccess
    | ListSharedRecordsFailure;

export interface ListSharedRecordsSuccess {
    success: true;
    sharedRecords: SharedRecordListItem[];
    totalCount: number;
}

export interface ListSharedRecordsFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

/**
 * Defines an interface that represents a record that has been shared with a user via an
 * accepted shared permission.
 */
export interface SharedRecordListItem {
    /**
     * The name of the record that is shared with the user.
     */
    recordName: string;

    /**
     * The ID of the user that owns the record (the other party of the shared permission).
     */
    ownerUserId: string;

    /**
     * The ID of the shared permission that granted access to this record.
     */
    sharedPermissionId: string;

    /**
     * The marker-based permission that was granted.
     */
    permission: SharedMarkerPermission;
}
