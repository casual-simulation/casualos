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
import type {
    ActionKinds,
    ResourceKinds,
    SubjectType,
} from './PolicyPermissions';
import type { PrivacyFeatures } from './PrivacyFeatures';

export type DenialReason =
    | AuthorizeActionMissingPermission
    | AuthorizeActionTooManyMarkers
    | AuthorizeActionDisabledPrivacyFeature
    | AuthorizeActionInvalidToken;

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

export interface AuthorizeActionInvalidToken {
    type: 'invalid_token';
}
