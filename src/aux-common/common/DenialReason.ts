import {
    ActionKinds,
    AvailablePermissions,
    ResourceKinds,
    SubjectType,
} from './PolicyPermissions';
import { PrivacyFeatures } from './PrivacyFeatures';

export type DenialReason =
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
