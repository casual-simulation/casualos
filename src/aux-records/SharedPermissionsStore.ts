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
import type { SharedMarkerPermission } from '@casual-simulation/aux-common';

/**
 * The number of shared permissions that are returned per page by default.
 */
export const SHARED_PERMISSIONS_PAGE_SIZE = 100;

/**
 * The possible statuses that a shared permission can have.
 *
 * - "requested" - The shared permission has been requested by one user but has not yet been accepted, rejected, or revoked by the other party.
 * - "accepted" - The shared permission has been accepted by both parties and the underlying permissions have been granted.
 * - "rejected" - The shared permission was requested from a specific user, and that user rejected the request.
 * - "revoked" - The shared permission (and any permissions that were granted because of it) has been revoked by one of the parties.
 *
 * @dochash types/records/policies
 * @docname SharedPermissionStatus
 */
export type SharedPermissionStatus =
    | 'requested'
    | 'accepted'
    | 'rejected'
    | 'revoked';

/**
 * Defines an interface that represents a shared permission.
 * Shared permissions represent a two-way agreement between two users where a marker-based
 * permission is granted to both parties in each of their respective records once the request
 * has been accepted.
 *
 * @dochash types/records/policies
 * @docname SharedPermission
 */
export interface SharedPermission {
    /**
     * The ID of the shared permission.
     */
    id: string;

    /**
     * The name of the record that the shared permission was requested for.
     */
    recordName: string;

    /**
     * The ID of the user that requested the shared permission.
     * This user must have had admin permission in recordName at the time the shared permission was requested.
     */
    requestingUserId: string;

    /**
     * The ID of the user that the shared permission was specifically requested from.
     * If null, then the first user that accepts the shared permission will be used.
     */
    targetUserId: string | null;

    /**
     * The marker-based permission that is shared between the two parties.
     */
    permission: SharedMarkerPermission;

    /**
     * The current status of the shared permission.
     */
    status: SharedPermissionStatus;

    /**
     * The unix time in miliseconds that the shared permission was created (requested) at.
     */
    createdAtMs: number;

    /**
     * The unix time in miliseconds that the shared permission was last updated at.
     */
    updatedAtMs: number;

    /**
     * The unix time in miliseconds that the shared permission request will expire at.
     * If null, then the shared permission does not expire.
     * This is always set to null once the shared permission has been accepted.
     */
    expireTimeMs: number | null;

    /**
     * The name of the record that the other party shared in order to accept the request.
     * Null until the shared permission has been accepted.
     */
    recipientRecordName: string | null;

    /**
     * The ID of the user that accepted the shared permission.
     * Null until the shared permission has been accepted.
     */
    recipientUserId: string | null;

    /**
     * The ID of the permission assignment that was created in recordName to give recipientUserId
     * access to the shared permission. Null until the shared permission has been accepted.
     */
    requestingPermissionAssignmentId: string | null;

    /**
     * The ID of the permission assignment that was created in recipientRecordName to give
     * requestingUserId access to the shared permission. Null until the shared permission has been accepted.
     */
    recipientPermissionAssignmentId: string | null;
}

/**
 * Defines an interface that represents the result of listing shared permissions.
 */
export interface ListedSharedPermissions {
    /**
     * The shared permissions that were found.
     */
    sharedPermissions: SharedPermission[];

    /**
     * The total number of shared permissions that matched the query.
     */
    totalCount: number;
}

/**
 * Defines an interface for objects that are able to store and retrieve shared permissions.
 */
export interface SharedPermissionsStore {
    /**
     * Saves the given shared permission.
     * If a shared permission with the same ID already exists, then it will be overwritten.
     * @param sharedPermission The shared permission that should be saved.
     */
    saveSharedPermission(sharedPermission: SharedPermission): Promise<void>;

    /**
     * Finds the shared permission with the given ID.
     * Returns null if no shared permission could be found.
     * @param id The ID of the shared permission.
     */
    findSharedPermissionById(id: string): Promise<SharedPermission | null>;

    /**
     * Lists the shared permissions that the given user is a party to (either as the requesting user,
     * the target user, or the recipient user).
     * @param userId The ID of the user.
     * @param page The page number to retrieve. Defaults to 0.
     */
    listSharedPermissionsForUser(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions>;

    /**
     * Lists the shared permissions that the given user is a party to and that have the given status.
     * @param userId The ID of the user.
     * @param status The status that the shared permissions should have.
     * @param page The page number to retrieve. Defaults to 0.
     */
    listSharedPermissionsForUserByStatus(
        userId: string,
        status: SharedPermissionStatus,
        page?: number | null
    ): Promise<ListedSharedPermissions>;

    /**
     * Lists the shared permissions that the given user has requested from other users.
     * @param userId The ID of the user.
     * @param page The page number to retrieve. Defaults to 0.
     */
    listSentSharedPermissions(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions>;

    /**
     * Lists the shared permissions that have been requested from the given user by other users.
     * @param userId The ID of the user.
     * @param page The page number to retrieve. Defaults to 0.
     */
    listRequestedSharedPermissions(
        userId: string,
        page?: number | null
    ): Promise<ListedSharedPermissions>;
}
