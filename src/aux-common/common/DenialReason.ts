import { AvailablePermissions } from './PolicyPermissions';

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
    permission: string;
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
