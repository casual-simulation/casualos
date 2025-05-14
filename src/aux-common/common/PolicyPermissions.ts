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
import { z } from 'zod';

/**
 * The possible types of subjects that can be affected by permissions.
 *
 * - "user" - The permission is for a user.
 * - "inst" - The permission is for an inst.
 * - "role" - The permission is for a role.
 *
 * @dochash types/permissions
 * @doctitle Permissions Types
 * @docsidebar Permissions
 * @docdescription Types that represent permissions that control access to resources.
 * @docname SubjectType
 */
export type SubjectType = 'user' | 'inst' | 'role';

export const DATA_RESOURCE_KIND = 'data';
export const FILE_RESOURCE_KIND = 'file';
export const EVENT_RESOURCE_KIND = 'event';
export const MARKER_RESOURCE_KIND = 'marker';
export const ROLE_RESOURCE_KIND = 'role';
export const INST_RESOURCE_KIND = 'inst';
export const LOOM_RESOURCE_KIND = 'loom';
export const SLOYD_RESOURCE_KIND = 'ai.sloyd';
export const HUME_RESOURCE_KIND = 'ai.hume';
export const OPENAI_REALTIME_RESOURCE_KIND = 'ai.openai.realtime';
export const WEBHOOK_RESOURCE_KIND = 'webhook';
export const NOTIFICATION_RESOURCE_KIND = 'notification';
export const PACKAGE_RESOURCE_KIND = 'package';
export const PACKAGE_VERSION_RESOURCE_KIND = 'package.version';
export const PURCHASABLE_ITEM_RESOURCE_KIND = 'purchasableItem';

/**
 * The possible types of resources that can be affected by permissions.
 *
 * @dochash types/permissions
 * @docname ResourceKinds
 */
export type ResourceKinds =
    | 'data'
    | 'file'
    | 'event'
    | 'marker'
    | 'role'
    | 'inst'
    | 'webhook'
    | 'notification'
    | 'package'
    | 'package.version'
    | 'loom'
    | 'ai.sloyd'
    | 'ai.hume'
    | 'ai.openai.realtime'
    | 'purchasableItem';

export const READ_ACTION = 'read';
export const CREATE_ACTION = 'create';
export const UPDATE_ACTION = 'update';
export const DELETE_ACTION = 'delete';
export const ASSIGN_ACTION = 'assign';
export const UNASSIGN_ACTION = 'unassign';
export const INCREMENT_ACTION = 'increment';
export const COUNT_ACTION = 'count';
export const LIST_ACTION = 'list';
export const GRANT_PERMISSION_ACTION = 'grantPermission';
export const REVOKE_PERMISSION_ACTION = 'revokePermission';
export const GRANT_ACTION = 'grant';
export const REVOKE_ACTION = 'revoke';
export const SEND_ACTION_ACTION = 'sendAction';
export const UPDATE_DATA_ACTION = 'updateData';
export const RUN_ACTION = 'run';
export const SEND_ACTION = 'send';
export const SUBSCRIBE_ACTION = 'subscribe';
export const UNSUBSCRIBE_ACTION = 'unsubscribe';
export const LIST_SUBSCRIPTIONS_ACTION = 'listSubscriptions';
export const PURCHASE_ACTION = 'purchase';

/**
 * The possible types of actions that can be performed on resources.
 *
 * @dochash types/permissions
 * @docname ActionKinds
 */
export type ActionKinds =
    | 'read'
    | 'create'
    | 'update'
    | 'delete'
    | 'assign'
    | 'unassign'
    | 'increment'
    | 'count'
    | 'list'
    | 'grantPermission'
    | 'revokePermission'
    | 'grant'
    | 'revoke'
    | 'sendAction'
    | 'updateData'
    | 'run'
    | 'send'
    | 'subscribe'
    | 'unsubscribe'
    | 'listSubscriptions'
    | 'purchase';

/**
 * The possible types of actions that can be performed on data resources.
 *
 * @dochash types/permissions
 * @docname DataActionKinds
 */
export type DataActionKinds = 'read' | 'create' | 'update' | 'delete' | 'list';

/**
 * The possible types of actions that can be performed on file resources.
 *
 * @dochash types/permissions
 * @docname FileActionKinds
 */
export type FileActionKinds = 'read' | 'create' | 'update' | 'delete' | 'list';

/**
 * The possible types of actions that can be performed on event resources.
 *
 * @dochash types/permissions
 * @docname EventActionKinds
 */
export type EventActionKinds = 'increment' | 'count' | 'update' | 'list';

/**
 * The possible types of actions that can be performed on marker resources.
 *
 * @dochash types/permissions
 * @docname MarkerActionKinds
 */
export type MarkerActionKinds =
    | 'assign'
    | 'unassign'
    | 'grantPermission'
    | 'revokePermission'
    | 'read';

/**
 * The possible types of actions that can be performed on roles resources.
 *
 * @dochash types/permissions
 * @docname RoleActionKinds
 */
export type RoleActionKinds = 'grant' | 'revoke' | 'read' | 'update' | 'list';

/**
 * The possible types of actions that can be performed on inst resources.
 *
 * @dochash types/permissions
 * @docname InstActionKinds
 */
export type InstActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'updateData'
    | 'delete'
    | 'list'
    | 'sendAction';

/**
 * The possible types of actions that can be performed on loom resources.
 *
 * @dochash types/permissions
 * @docname LoomActionKinds
 */
export type LoomActionKinds = 'create';

/**
 * The possible types of actions that can be performed on ai.sloyd resources.
 *
 * @dochash types/permissions
 * @docname SloydActionKinds
 */
export type SloydActionKinds = 'create';

/**
 * The possible types of actions that can be performed on ai.hume resources.
 *
 * @dochash types/permissions
 * @docname HumeActionKinds
 */
export type HumeActionKinds = 'create';

/**
 * The possible types of actions that can be performed on ai.openai.realtime resources.
 *
 * @dochash types/permissions
 * @docname OpenAIRealtimeActionKinds
 */
export type OpenAIRealtimeActionKinds = 'create';

/**
 * The possible types of actions that can be performed on webhook resources.
 *
 * @dochash types/permissions
 * @docname WebhookActionKinds
 */
export type WebhookActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'list'
    | 'run';

/**
 * The possible types of actions that can be performed on notification resources.
 *
 * @dochash types/permissions
 * @docname NotificationActionKinds
 */
export type NotificationActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'list'
    | 'send'
    | 'subscribe'
    | 'unsubscribe'
    | 'listSubscriptions';

/**
 * The possible types of actions that can be performed on package resources.
 *
 * @dochash types/permissions
 * @docname PackageActionKinds
 */
export type PackageActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'list'
    | 'run';

/**
 * The possible types of actions that can be performed on package.version resources.
 *
 * @dochash types/permissions
 * @docname PackageVersionActionKinds
 */
export type PackageVersionActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'list'
    | 'run';

/**
 * The possible types of actions that can be performed on purchasableItem resources.
 * 
 * @dochash types/permissions
 * @docname PurchasableItemActionKinds
 */
export type PurchasableItemActionKinds = 'read' | 'create' | 'update' | 'delete' | 'list' | 'purchase';

/**
 * The possible types of permissions that can be added to policies.
 *
 * @dochash types/permissions
 * @doctitle Permissions Types
 * @docsidebar Permissions
 * @docdescription Types that represent permissions that control access to resources.
 * @docname AvailablePermissions
 */
export type AvailablePermissions =
    | DataPermission
    | FilePermission
    | EventPermission
    | MarkerPermission
    | RolePermission
    | InstPermission
    | PurchasableItemPermission
    | LoomPermission
    | SloydPermission
    | HumePermission
    | OpenAIRealtimePermission
    | WebhookPermission
    | NotificationPermission
    | PackagePermission
    | PackageVersionPermission;

export const SUBJECT_TYPE_VALIDATION = z.enum(['user', 'inst', 'role']);

export const DATA_ACTION_KINDS_VALIDATION = z.enum([
    READ_ACTION,
    CREATE_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
]);

export const FILE_ACTION_KINDS_VALIDATION = z.enum([
    READ_ACTION,
    CREATE_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
]);

export const EVENT_ACTION_KINDS_VALIDATION = z.enum([
    INCREMENT_ACTION,
    COUNT_ACTION,
    UPDATE_ACTION,
    LIST_ACTION,
]);

export const MARKER_ACTION_KINDS_VALIDATION = z.enum([
    ASSIGN_ACTION,
    UNASSIGN_ACTION,
    GRANT_PERMISSION_ACTION,
    REVOKE_PERMISSION_ACTION,
    READ_ACTION,
]);

export const ROLE_ACTION_KINDS_VALIDATION = z.enum([
    GRANT_ACTION,
    REVOKE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    LIST_ACTION,
]);

export const INST_ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    UPDATE_DATA_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    SEND_ACTION_ACTION,
]);

export const LOOM_ACTION_KINDS_VALIDATION = z.enum([CREATE_ACTION]);

export const SLOYD_ACTION_KINDS_VALIDATION = z.enum([CREATE_ACTION]);

export const HUME_ACTION_KINDS_VALIDATION = z.enum([CREATE_ACTION]);

export const OPENAI_REALTIME_ACTION_KINDS_VALIDATION = z.enum([CREATE_ACTION]);

export const WEBHOOK_ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    RUN_ACTION,
]);

export const NOTIFICATION_ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    SEND_ACTION,
    SUBSCRIBE_ACTION,
    UNSUBSCRIBE_ACTION,
    LIST_SUBSCRIPTIONS_ACTION,
]);

export const PACKAGE_ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    RUN_ACTION,
]);

export const PACKAGE_VERSION_ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    RUN_ACTION,
]);

export const RESOURCE_KIND_VALIDATION = z.enum([
    DATA_RESOURCE_KIND,
    FILE_RESOURCE_KIND,
    EVENT_RESOURCE_KIND,
    MARKER_RESOURCE_KIND,
    ROLE_RESOURCE_KIND,
    INST_RESOURCE_KIND,
    LOOM_RESOURCE_KIND,
    SLOYD_RESOURCE_KIND,
    HUME_RESOURCE_KIND,
    OPENAI_REALTIME_RESOURCE_KIND,
    WEBHOOK_RESOURCE_KIND,
    NOTIFICATION_RESOURCE_KIND,
    PACKAGE_RESOURCE_KIND,
    PACKAGE_VERSION_RESOURCE_KIND,
]);

export const ACTION_KINDS_VALIDATION = z.enum([
    CREATE_ACTION,
    READ_ACTION,
    UPDATE_ACTION,
    UPDATE_DATA_ACTION,
    DELETE_ACTION,
    LIST_ACTION,
    SEND_ACTION_ACTION,

    ASSIGN_ACTION,
    UNASSIGN_ACTION,

    GRANT_ACTION,
    REVOKE_ACTION,

    INCREMENT_ACTION,
    COUNT_ACTION,

    GRANT_PERMISSION_ACTION,
    REVOKE_PERMISSION_ACTION,

    RUN_ACTION,

    SEND_ACTION,
    SUBSCRIBE_ACTION,
    UNSUBSCRIBE_ACTION,
    LIST_SUBSCRIPTIONS_ACTION,
]);

/**
 * The scopes that can be used for requested entitlements.
 * This can be used to limit the entitlement to requesting a category of resources.
 * For example, the "personal" scope would limit the entitlement to requesting access to the user's personal resources.
 *
 * - "personal" - The entitlement is for personal (user-specific) records. This would allow the package to request access to resources in the user's player record. Once granted, the package would have access to the user's personal record.
 * - "owned" - The entitlement is for user (user-owned) records. This would allow the package to request access to resources in a record that the user owns. Once granted, the package would have access to the user's owned records.
 * - "studio" - The entitlement is for studio records. This would allow the package to request access to resources in studios in which the user is an admin or member of.
 * - "shared" - The entitlement is for shared records. This would allow the package to request access to records that are either owned or granted to the user.
 * - "designated" - The entitlement is for specific records. This would allow the package to only request access to specific records.
 */
export type EntitlementScope =
    | 'personal'
    | 'owned'
    | 'studio'
    | 'shared'
    | 'designated';

/**
 * The scopes that can be granted for entitlements.
 * Compared to the requested entitlement scopes, the granted entitlement scopes are more restrictive.
 *
 * This ultimately means that while a package can have the ability to request access to a bunch of different records,
 * they can only be granted access to a single record at once (for now).
 *
 * - "designated" - The entitlement is for specific records. This would allow the package to access specific records.
 */
export type GrantedEntitlementScope = 'designated';

/**
 * The feature categories that entitlements support.
 * Generally, features align with resource kinds, but don't have to.
 */
export type EntitlementFeature =
    | 'data'
    | 'file'
    | 'event'
    | 'inst'
    | 'notification'
    | 'package'
    | 'permissions'
    | 'webhook'
    | 'ai';

/**
 * Defines an interface that represents an entitlement.
 * That is, a feature that can be granted to a package but still requires user approval.
 *
 * In essence, this allows a package to ask the user for permission for a category of permissions.
 */
export interface Entitlement {
    /**
     * The feature category that the entitlement is for.
     * Generally, features align with resource kinds, but don't have to.
     */
    feature: EntitlementFeature;

    /**
     * The scope of the entitlement.
     * This can be used to limit the entitlement to a category of resources.
     * For example, the "personal" scope would limit the entitlement to requesting access to the user's personal resources.
     *
     *
     * - "personal" - The entitlement is for personal (user-specific) records. This would allow the package to request access to resources in the user's player record.
     * - "owned" - The entitlement is for user (user-owned) records. This would allow the package to request access to resources in a record that the user owns.
     * - "studio" - The entitlement is for studio records. This would allow the package to request access to resources in studios in which the user is an admin or member of.
     * - "shared" - The entitlement is for shared records. This would allow the package to request access to records that are either owned or granted to the user.
     * - "designated" - The entitlement is for specific records. This would allow the package to only request access to specific records.
     */
    scope: EntitlementScope;

    /**
     * The list of records that the entitlement is for.
     */
    designatedRecords?: string[];
}

export const ENTITLEMENT_FEATURE_VALIDATION = z.enum([
    'data',
    'file',
    'event',
    'inst',
    'notification',
    'package',
    'permissions',
    'webhook',
    'ai',
]);

export const ENTITLEMENT_VALIDATION = z.object({
    feature: ENTITLEMENT_FEATURE_VALIDATION,
    scope: z.enum(['personal', 'owned', 'studio', 'shared', 'designated']),
    designatedRecords: z.array(z.string()).optional(),
});
type ZodEntitlement = z.infer<typeof ENTITLEMENT_VALIDATION>;
type ZodEntitlementAssertion = HasType<ZodEntitlement, Entitlement>;

/**
 * Defines an interface that describes common options for all permissions.
 */
export interface Permission {
    /**
     * The marker that the permission is for.
     * If null or undefined, then the permission is for a specific resource instead of a marker.
     */
    marker?: string;

    /**
     * The type of the subject that the permission is for.
     *
     * "user" - The permission is for a user.
     * "inst" - The permission is for an inst.
     * "role" - The permission is for a role.
     */
    subjectType: SubjectType;

    /**
     * The ID of the subject.
     */
    subjectId: string;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId?: string | null;

    /**
     * The options for the permission.
     */
    // Disabled because this is mostly a placeholder for future options
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    options: {};

    /**
     * The unix time in miliseconds that the permission will expire at.
     * If null, then the permission does not expire.
     */
    expireTimeMs: number | null;
}

export const PERMISSION_VALIDATION = z.object({
    subjectType: SUBJECT_TYPE_VALIDATION,
    subjectId: z.string().min(1),
    resourceId: z.string().min(1).nullable().optional(),
    expireTimeMs: z.number().nullable(),
    marker: z.string().min(1).max(100).optional(),
});

type ZodPermission = z.infer<typeof PERMISSION_VALIDATION>;
type ZodPermissionAssertion = HasType<ZodPermission, Permission>;

/**
 * Defines an interface that describes the common options for all permissions that affect data records.
 *
 * @dochash types/permissions
 * @docname DataPermission
 */
export interface DataPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'data';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: DataActionKinds | null;
}

export const DATA_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(DATA_RESOURCE_KIND),
    action: DATA_ACTION_KINDS_VALIDATION.nullable(),
});

type ZodDataPermission = z.infer<typeof DATA_PERMISSION_VALIDATION>;
type ZodDataPermissionAssertion = HasType<ZodDataPermission, DataPermission>;

/**
 * Options for file permissions.
 *
 * @dochash types/permissions
 * @docname FilePermissionOptions
 */
export interface FilePermissionOptions {
    /**
     * The maximum allowed file size in bytes.
     * Defaults to Infinity.
     */
    maxFileSizeInBytes?: number;

    /**
     * The list of allowed file MIME types.
     * If true, then all file types are allowed.
     * If an array of strings, then only MIME types that are specified are allowed.
     */
    allowedMimeTypes?: true | string[];
}

export const FILE_PERMISSION_OPTIONS_VALIDATION = z.object({
    maxFileSizeInBytes: z.number().nonnegative().optional(),
    allowedMimeTypes: z
        .union([z.literal(true), z.array(z.string())])
        .optional(),
});
type ZodFilePermissionOptions = z.infer<
    typeof FILE_PERMISSION_OPTIONS_VALIDATION
>;
type ZodFilePermissionOptionsAssertion = HasType<
    ZodFilePermissionOptions,
    FilePermissionOptions
>;

/**
 * Defines an interface that describes the common options for all permissions that affect file records.
 *
 * @dochash types/permissions
 * @docname FilePermission
 */
export interface FilePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'file';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: FileActionKinds | null;

    /**
     * The options for the permission.
     */
    options: FilePermissionOptions;
}

export const FILE_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(FILE_RESOURCE_KIND),
    action: FILE_ACTION_KINDS_VALIDATION.nullable(),
    options: FILE_PERMISSION_OPTIONS_VALIDATION,
});
type ZodFilePermission = z.infer<typeof FILE_PERMISSION_VALIDATION>;
type ZodFilePermissionAssertion = HasType<ZodFilePermission, FilePermission>;

/**
 * Defines an interface that describes the common options for all permissions that affect event records.
 *
 * @dochash types/permissions
 * @docname EventPermission
 */
export interface EventPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'event';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: EventActionKinds | null;
}

export const EVENT_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(EVENT_RESOURCE_KIND),
    resourceId: z.string().min(1).nullable(),
    action: EVENT_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodEventPermission = z.infer<typeof EVENT_PERMISSION_VALIDATION>;
type ZodEventPermissionAssertion = HasType<ZodEventPermission, EventPermission>;

/**
 * Defines an interface that describes the common options for all permissions that affect markers.
 *
 * @dochash types/permissions
 * @docname MarkerPermission
 */
export interface MarkerPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'marker';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: MarkerActionKinds | null;
}

export const MARKER_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(MARKER_RESOURCE_KIND),
    action: MARKER_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodMarkerPermission = z.infer<typeof MARKER_PERMISSION_VALIDATION>;
type ZodMarkerPermissionAssertion = HasType<
    ZodMarkerPermission,
    MarkerPermission
>;

/**
 * Options for role permissions.
 *
 * @dochash types/permissions
 * @docname RolePermissionOptions
 */
export interface RolePermissionOptions {
    /**
     * The maximum lifetime that the role can be granted for in miliseconds.
     * If not specified, then the role can be granted for an infinite amount of time.
     */
    maxDurationMs?: number;
}

export const ROLE_PERMISSION_OPTIONS_VALIDATION = z.object({
    maxDurationMs: z.number().optional(),
});
type ZodRolePermissionOptions = z.infer<
    typeof ROLE_PERMISSION_OPTIONS_VALIDATION
>;
type ZodRolePermissionOptionsAssertion = HasType<
    ZodRolePermissionOptions,
    RolePermissionOptions
>;

/**
 * Defines an interface that describes the common options for all permissions that affect roles.
 *
 * @dochash types/permissions
 * @docname RolePermission
 */
export interface RolePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'role';

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: RoleActionKinds | null;

    /**
     * The options for the permission.
     */
    options: RolePermissionOptions;
}

export const ROLE_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(ROLE_RESOURCE_KIND),
    action: ROLE_ACTION_KINDS_VALIDATION.nullable(),
    options: ROLE_PERMISSION_OPTIONS_VALIDATION,
});
type ZodRolePermission = z.infer<typeof ROLE_PERMISSION_VALIDATION>;
type ZodRolePermissionAssertion = HasType<ZodRolePermission, RolePermission>;

/**
 * Defines an interface that describes common options for all permissions that affect insts.
 *
 * @dochash types/permissions
 * @docname InstPermission
 */
export interface InstPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'inst';

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: InstActionKinds | null;
}
export const INST_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(INST_RESOURCE_KIND),
    action: INST_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodInstPermission = z.infer<typeof INST_PERMISSION_VALIDATION>;
type ZodInstPermissionAssertion = HasType<ZodInstPermission, InstPermission>;

/**
 * Defines an interface that describes common options for all permissions that affect loom resources.
 *
 * @dochash types/permissions
 * @docname LoomPermission
 */
export interface LoomPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'loom';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: LoomActionKinds | null;
}
export const LOOM_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(LOOM_RESOURCE_KIND),
    action: LOOM_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodLoomPermission = z.infer<typeof LOOM_PERMISSION_VALIDATION>;
type ZodLoomPermissionAssertion = HasType<ZodLoomPermission, LoomPermission>;

/**
 * Defines an interface that describes common options for all permissions that affect ai.sloyd resources.
 *
 * @dochash types/permissions
 * @docname SloydPermission
 */
export interface SloydPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'ai.sloyd';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: SloydActionKinds | null;
}
export const SLOYD_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(SLOYD_RESOURCE_KIND),
    action: SLOYD_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodSloydPermission = z.infer<typeof SLOYD_PERMISSION_VALIDATION>;
type ZodSloydPermissionAssertion = HasType<ZodSloydPermission, SloydPermission>;

/**
 * Defines an interface that describes common options for all permissions that affect ai.hume resources.
 *
 * @dochash types/permissions
 * @docname HumePermission
 */
export interface HumePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'ai.hume';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: HumeActionKinds | null;
}
export const HUME_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(HUME_RESOURCE_KIND),
    action: HUME_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodHumePermission = z.infer<typeof HUME_PERMISSION_VALIDATION>;
type ZodHumePermissionAssertion = HasType<ZodHumePermission, HumePermission>;

/**
 * Defines an interface that describes common options for all permissions that affect ai.openai.realtime resources.
 *
 * @dochash types/permissions
 * @docname OpenAIRealtimePermission
 */
export interface OpenAIRealtimePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'ai.openai.realtime';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: OpenAIRealtimeActionKinds | null;
}
export const OPENAI_REALTIME_PERMISSION_VALIDATION =
    PERMISSION_VALIDATION.extend({
        resourceKind: z.literal(OPENAI_REALTIME_RESOURCE_KIND),
        action: OPENAI_REALTIME_ACTION_KINDS_VALIDATION.nullable(),
    });
type ZodOpenAIRealtimePermission = z.infer<
    typeof OPENAI_REALTIME_PERMISSION_VALIDATION
>;
type ZodOpenAIRealtimePermissionAssertion = HasType<
    ZodOpenAIRealtimePermission,
    OpenAIRealtimePermission
>;

/**
 * Defines an interface that describes common options for all permissions that affect webhook resources.
 *
 * @dochash types/permissions
 * @docname WebhookPermission
 */
export interface WebhookPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'webhook';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: WebhookActionKinds | null;
}
export const WEBHOOK_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(WEBHOOK_RESOURCE_KIND),
    action: WEBHOOK_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodWebhookPermission = z.infer<typeof WEBHOOK_PERMISSION_VALIDATION>;
type ZodWebhookPermissionAssertion = HasType<
    ZodWebhookPermission,
    WebhookPermission
>;

/**
 * Defines an interface that describes common options for all permissions that affect notification resources.
 *
 * @dochash types/permissions
 * @docname NotificationPermission
 */
export interface NotificationPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'notification';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: NotificationActionKinds | null;
}
export const NOTIFICATION_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(NOTIFICATION_RESOURCE_KIND),
    action: NOTIFICATION_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodNotificationPermission = z.infer<
    typeof NOTIFICATION_PERMISSION_VALIDATION
>;
type ZodNotificationPermissionAssertion = HasType<
    ZodNotificationPermission,
    NotificationPermission
>;

/**
 * Defines an interface that describes common options for all permissions that affect package resources.
 *
 * @dochash types/permissions
 * @docname PackagePermission
 */
export interface PackagePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'package';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: PackageActionKinds | null;
}
export const PACKAGE_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(PACKAGE_RESOURCE_KIND),
    action: PACKAGE_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodPackagePermission = z.infer<typeof PACKAGE_PERMISSION_VALIDATION>;
type ZodPackagePermissionAssertion = HasType<
    ZodPackagePermission,
    PackagePermission
>;

/**
 * Defines an interface that describes common options for all permissions that affect package.version resources.
 *
 * @dochash types/permissions
 * @docname PackageVersionPermission
 */
export interface PackageVersionPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'package.version';

    /**
     * The action that is allowed.
     * If null, then all actions are allowed.
     */
    action: PackageVersionActionKinds | null;
}
export const PACKAGE_VERSION_PERMISSION_VALIDATION =
    PERMISSION_VALIDATION.extend({
        resourceKind: z.literal(PACKAGE_VERSION_RESOURCE_KIND),
        action: PACKAGE_VERSION_ACTION_KINDS_VALIDATION.nullable(),
    });
type ZodPackageVersionPermission = z.infer<
    typeof PACKAGE_VERSION_PERMISSION_VALIDATION
>;
type ZodPackageVersionPermissionAssertion = HasType<
    ZodPackageVersionPermission,
    PackageVersionPermission
>;

/**
 * Defines an interface that describes common options for all purchasableItem permissions.
 * 
 * @dochash types/permissions
 * @docname PurchasableItemPermission
 */
export interface PurchasableItemPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'purchasableItem';

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    action: PurchasableItemActionKinds | null;
}
export const PURCHASABLE_ITEM_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(PURCHASABLE_ITEM_RESOURCE_KIND),
    action: PURCHASABLE_ITEM_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodPurchasableItemPermission = z.infer<typeof PURCHASABLE_ITEM_PERMISSION_VALIDATION>;
type ZodPurchasableItemPermissionAssertion = HasType<ZodPurchasableItemPermission, PurchasableItemPermission>;


export const AVAILABLE_PERMISSIONS_VALIDATION = z.discriminatedUnion(
    'resourceKind',
    [
        DATA_PERMISSION_VALIDATION,
        FILE_PERMISSION_VALIDATION,
        EVENT_PERMISSION_VALIDATION,
        MARKER_PERMISSION_VALIDATION,
        ROLE_PERMISSION_VALIDATION,
        INST_PERMISSION_VALIDATION,
        LOOM_PERMISSION_VALIDATION,
        SLOYD_PERMISSION_VALIDATION,
        HUME_PERMISSION_VALIDATION,
        OPENAI_REALTIME_PERMISSION_VALIDATION,
        WEBHOOK_PERMISSION_VALIDATION,
        NOTIFICATION_PERMISSION_VALIDATION,
        PACKAGE_PERMISSION_VALIDATION,
        PACKAGE_VERSION_PERMISSION_VALIDATION,
        PURCHASABLE_ITEM_PERMISSION_VALIDATION
    ]
);

export type PermissionOptions = FilePermissionOptions | RolePermissionOptions;

// /**
//  * Defines an interface that represents a policy document.
//  * That is, a list of permissions that are granted to specific roles.
//  */
// export interface PolicyDocument {
//     /**
//      * The list of permissions that are allowed by this policy document.
//      */
//     permissions: AvailablePermissions[];
// }

/**
 * The name of the admin role.
 */
export const ADMIN_ROLE_NAME = 'admin';

/**
 * The name of the recordOwner role.
 */
export const RECORD_OWNER_ROLE_NAME = 'recordOwner';

/**
 * The name of the "publicRead" resource marker.
 * Used by default for data, file, and event records.
 */
export const PUBLIC_READ_MARKER = 'publicRead';

/**
 * The name of the "publicWrite" resource marker.
 * Used by default for public insts.
 */
export const PUBLIC_WRITE_MARKER = 'publicWrite';

/**
 * The name of the "private" resource marker.
 * Used by default for private insts.
 */
export const PRIVATE_MARKER = 'private';

/**
 * The name of the "account" resource marker.
 * Used by default for policy and role records.
 */
export const ACCOUNT_MARKER = 'account';

// /**
//  * Defines a default policy document for any resource.
//  */
// export const DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT: PolicyDocument = {
//     permissions: [
//         // Admin permissions
//         {
//             type: 'data.create',
//             role: ADMIN_ROLE_NAME,
//             addresses: true,
//         },
//         {
//             type: 'data.read',
//             role: ADMIN_ROLE_NAME,
//             addresses: true,
//         },
//         {
//             type: 'data.update',
//             role: ADMIN_ROLE_NAME,
//             addresses: true,
//         },
//         {
//             type: 'data.delete',
//             role: ADMIN_ROLE_NAME,
//             addresses: true,
//         },
//         {
//             type: 'data.list',
//             role: ADMIN_ROLE_NAME,
//             addresses: true,
//         },
//         {
//             type: 'file.create',
//             role: ADMIN_ROLE_NAME,
//         },
//         {
//             type: 'file.read',
//             role: ADMIN_ROLE_NAME,
//         },
//         {
//             type: 'file.list',
//             role: ADMIN_ROLE_NAME,
//         },
//         {
//             type: 'file.delete',
//             role: ADMIN_ROLE_NAME,
//         },
//         {
//             type: 'file.update',
//             role: ADMIN_ROLE_NAME,
//         },
//         {
//             type: 'event.increment',
//             role: ADMIN_ROLE_NAME,
//             events: true,
//         },
//         {
//             type: 'event.count',
//             role: ADMIN_ROLE_NAME,
//             events: true,
//         },
//         {
//             type: 'event.update',
//             role: ADMIN_ROLE_NAME,
//             events: true,
//         },
//         {
//             type: 'event.list',
//             role: ADMIN_ROLE_NAME,
//             events: true,
//         },
//         {
//             type: 'policy.grantPermission',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'policy.revokePermission',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'policy.assign',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'policy.unassign',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'policy.list',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'policy.read',
//             role: ADMIN_ROLE_NAME,
//             policies: true,
//         },
//         {
//             type: 'role.grant',
//             role: ADMIN_ROLE_NAME,
//             roles: true,
//             userIds: true,
//             instances: true,
//         },
//         {
//             type: 'role.revoke',
//             role: ADMIN_ROLE_NAME,
//             roles: true,
//             userIds: true,
//             instances: true,
//         },
//         {
//             type: 'role.read',
//             role: ADMIN_ROLE_NAME,
//             roles: true,
//         },
//         {
//             type: 'role.list',
//             role: ADMIN_ROLE_NAME,
//             roles: true,
//         },
//         {
//             type: 'role.update',
//             role: ADMIN_ROLE_NAME,
//             roles: true,
//         },
//         {
//             type: 'inst.create',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.read',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.delete',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.update',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.updateData',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.list',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },
//         {
//             type: 'inst.sendAction',
//             role: ADMIN_ROLE_NAME,
//             insts: true,
//         },

//         // Record Owner Permissions
//         {
//             type: 'recordKey.create',
//             role: RECORD_OWNER_ROLE_NAME,
//             recordNames: true,
//         },
//     ],
// };

// /**
//  * Defines a policy document that applies only to resources marked with the "publicRead" marker.
//  */
// export const DEFAULT_PUBLIC_READ_POLICY_DOCUMENT: PolicyDocument = {
//     permissions: [
//         {
//             type: 'data.read',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'data.list',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'file.read',
//             role: true,
//         },
//         {
//             type: 'event.count',
//             role: true,
//             events: true,
//         },
//         {
//             type: 'inst.read',
//             role: true,
//             insts: true,
//         },
//     ],
// };

// /**
//  * Defines a policy document that applies only to resources marked with the "publicWrite" marker.
//  */
// export const DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT: PolicyDocument = {
//     permissions: [
//         {
//             type: 'data.create',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'data.delete',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'data.read',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'data.update',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'data.list',
//             role: true,
//             addresses: true,
//         },
//         {
//             type: 'file.read',
//             role: true,
//         },
//         {
//             type: 'file.create',
//             role: true,
//         },
//         {
//             type: 'file.delete',
//             role: true,
//         },
//         {
//             type: 'event.count',
//             role: true,
//             events: true,
//         },
//         {
//             type: 'event.increment',
//             role: true,
//             events: true,
//         },
//         {
//             type: 'inst.read',
//             role: true,
//             insts: true,
//         },
//         {
//             type: 'inst.updateData',
//             role: true,
//             insts: true,
//         },
//         {
//             type: 'inst.delete',
//             role: true,
//             insts: true,
//         },
//         {
//             type: 'inst.create',
//             role: true,
//             insts: true,
//         },
//     ],
// };

type HasType<T, Q extends T> = Q;
