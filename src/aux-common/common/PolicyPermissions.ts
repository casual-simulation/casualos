import { z } from 'zod';

export const USER_SUBJECT_TYPE = 'user';
export const INST_SUBJECT_TYPE = 'inst';
export const ROLE_SUBJECT_TYPE = 'role';

export type SubjectType =
    | typeof USER_SUBJECT_TYPE
    | typeof INST_SUBJECT_TYPE
    | typeof ROLE_SUBJECT_TYPE;

export const DATA_RESOURCE_KIND = 'data';
export const FILE_RESOURCE_KIND = 'file';
export const EVENT_RESOURCE_KIND = 'event';
export const MARKER_RESOURCE_KIND = 'marker';
export const ROLE_RESOURCE_KIND = 'role';
export const INST_RESOURCE_KIND = 'inst';
export type ResourceKinds =
    | typeof DATA_RESOURCE_KIND
    | typeof FILE_RESOURCE_KIND
    | typeof EVENT_RESOURCE_KIND
    | typeof MARKER_RESOURCE_KIND
    | typeof ROLE_RESOURCE_KIND
    | typeof INST_RESOURCE_KIND;

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

export type ActionKinds =
    | typeof READ_ACTION
    | typeof CREATE_ACTION
    | typeof UPDATE_ACTION
    | typeof DELETE_ACTION
    | typeof ASSIGN_ACTION
    | typeof UNASSIGN_ACTION
    | typeof INCREMENT_ACTION
    | typeof COUNT_ACTION
    | typeof LIST_ACTION
    | typeof GRANT_PERMISSION_ACTION
    | typeof REVOKE_PERMISSION_ACTION
    | typeof GRANT_ACTION
    | typeof REVOKE_ACTION
    | typeof SEND_ACTION_ACTION
    | typeof UPDATE_DATA_ACTION;

export type DataActionKinds =
    | typeof READ_ACTION
    | typeof CREATE_ACTION
    | typeof UPDATE_ACTION
    | typeof DELETE_ACTION
    | typeof LIST_ACTION;

export type FileActionKinds =
    | typeof READ_ACTION
    | typeof CREATE_ACTION
    | typeof UPDATE_ACTION
    | typeof DELETE_ACTION
    | typeof LIST_ACTION;

export type EventActionKinds =
    | typeof INCREMENT_ACTION
    | typeof COUNT_ACTION
    | typeof UPDATE_ACTION
    | typeof LIST_ACTION;

export type MarkerActionKinds =
    | typeof ASSIGN_ACTION
    | typeof UNASSIGN_ACTION
    | typeof GRANT_PERMISSION_ACTION
    | typeof REVOKE_PERMISSION_ACTION
    | typeof READ_ACTION;

export type RoleActionKinds =
    | typeof GRANT_ACTION
    | typeof REVOKE_ACTION
    | typeof READ_ACTION
    | typeof UPDATE_ACTION
    | typeof LIST_ACTION;

export type InstActionKinds =
    | typeof CREATE_ACTION
    | typeof READ_ACTION
    | typeof UPDATE_ACTION
    | typeof UPDATE_DATA_ACTION
    | typeof DELETE_ACTION
    | typeof LIST_ACTION
    | typeof SEND_ACTION_ACTION;

/**
 * The possible types of permissions that can be added to policies.
 *
 * @dochash types/permissions
 * @doctitle Permission Types
 * @docsidebar Permissions
 * @docdescription Defines the types of permissions that can be added to policies.
 * @docname AvailablePermissions
 */
export type AvailablePermissions =
    | DataPermission
    | FilePermission
    | EventPermission
    | MarkerPermission
    | RolePermission
    | InstPermission;

export const SUBJECT_TYPE_VALIDATION = z.union([
    z.literal(USER_SUBJECT_TYPE),
    z.literal(INST_SUBJECT_TYPE),
    z.literal(ROLE_SUBJECT_TYPE),
]);

export const DATA_ACTION_KINDS_VALIDATION = z.union([
    z.literal(READ_ACTION),
    z.literal(CREATE_ACTION),
    z.literal(UPDATE_ACTION),
    z.literal(DELETE_ACTION),
    z.literal(LIST_ACTION),
]);

export const FILE_ACTION_KINDS_VALIDATION = z.union([
    z.literal(READ_ACTION),
    z.literal(CREATE_ACTION),
    z.literal(UPDATE_ACTION),
    z.literal(DELETE_ACTION),
    z.literal(LIST_ACTION),
]);

export const EVENT_ACTION_KINDS_VALIDATION = z.union([
    z.literal(INCREMENT_ACTION),
    z.literal(COUNT_ACTION),
    z.literal(UPDATE_ACTION),
    z.literal(LIST_ACTION),
]);

export const MARKER_ACTION_KINDS_VALIDATION = z.union([
    z.literal(ASSIGN_ACTION),
    z.literal(UNASSIGN_ACTION),
    z.literal(GRANT_PERMISSION_ACTION),
    z.literal(REVOKE_PERMISSION_ACTION),
    z.literal(READ_ACTION),
]);

export const ROLE_ACTION_KINDS_VALIDATION = z.union([
    z.literal(GRANT_ACTION),
    z.literal(REVOKE_ACTION),
    z.literal(READ_ACTION),
    z.literal(UPDATE_ACTION),
    z.literal(LIST_ACTION),
]);

export const INST_ACTION_KINDS_VALIDATION = z.union([
    z.literal(CREATE_ACTION),
    z.literal(READ_ACTION),
    z.literal(UPDATE_ACTION),
    z.literal(UPDATE_DATA_ACTION),
    z.literal(DELETE_ACTION),
    z.literal(LIST_ACTION),
    z.literal(SEND_ACTION_ACTION),
]);

/**
 * Defines an interface that describes common options for all permissions.
 */
export interface Permission {
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
}

export const PERMISSION_VALIDATION = z.object({
    subjectType: SUBJECT_TYPE_VALIDATION,
    subjectId: z.string().min(1),
});

type ZodPermission = z.infer<typeof PERMISSION_VALIDATION>;
type ZodPermissionAssertion = HasType<ZodPermission, Permission>;

/**
 * Defines an interface that describes the common options for all permissions that affect data records.
 */
export interface DataPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof DATA_RESOURCE_KIND;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: DataActionKinds | null;
}

export const DATA_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(DATA_RESOURCE_KIND),
    resourceId: z.string().min(1).nullable(),
    action: DATA_ACTION_KINDS_VALIDATION.nullable(),
});

type ZodDataPermission = z.infer<typeof DATA_PERMISSION_VALIDATION>;
type ZodDataPermissionAssertion = HasType<ZodDataPermission, DataPermission>;

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
 */
export interface FilePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof FILE_RESOURCE_KIND;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

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
    resourceId: z.string().min(1).nullable(),
    action: FILE_ACTION_KINDS_VALIDATION.nullable(),
    options: FILE_PERMISSION_OPTIONS_VALIDATION,
});
type ZodFilePermission = z.infer<typeof FILE_PERMISSION_VALIDATION>;
type ZodFilePermissionAssertion = HasType<ZodFilePermission, FilePermission>;

/**
 * Defines an interface that describes the common options for all permissions that affect event records.
 */
export interface EventPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof EVENT_RESOURCE_KIND;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

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
 * Defines an interface that describes the common options for all permissions that affect policies.
 */
export interface MarkerPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof MARKER_RESOURCE_KIND;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: MarkerActionKinds | null;
}

export const MARKER_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    resourceKind: z.literal(MARKER_RESOURCE_KIND),
    resourceId: z.string().min(1).nullable(),
    action: MARKER_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodMarkerPermission = z.infer<typeof MARKER_PERMISSION_VALIDATION>;
type ZodMarkerPermissionAssertion = HasType<
    ZodMarkerPermission,
    MarkerPermission
>;

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
 */
export interface RolePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof ROLE_RESOURCE_KIND;

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
    resourceId: z.string().min(1).nullable(),
    action: ROLE_ACTION_KINDS_VALIDATION.nullable(),
    options: ROLE_PERMISSION_OPTIONS_VALIDATION,
});
type ZodRolePermission = z.infer<typeof ROLE_PERMISSION_VALIDATION>;
type ZodRolePermissionAssertion = HasType<ZodRolePermission, RolePermission>;

export interface InstPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: typeof INST_RESOURCE_KIND;

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
    resourceId: z.string().min(1).nullable(),
    action: INST_ACTION_KINDS_VALIDATION.nullable(),
});
type ZodInstPermission = z.infer<typeof INST_PERMISSION_VALIDATION>;
type ZodInstPermissionAssertion = HasType<ZodInstPermission, InstPermission>;

export const AVAILABLE_PERMISSIONS_VALIDATION = z.discriminatedUnion(
    'resourceKind',
    [
        DATA_PERMISSION_VALIDATION,
        FILE_PERMISSION_VALIDATION,
        EVENT_PERMISSION_VALIDATION,
        MARKER_PERMISSION_VALIDATION,
        ROLE_PERMISSION_VALIDATION,
        INST_PERMISSION_VALIDATION,
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
