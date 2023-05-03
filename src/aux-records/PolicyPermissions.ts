import { z } from 'zod';

export type AvailablePermissions =
    | CreateDataPermission
    | ReadDataPermission
    | UpdateDataPermission
    | DeleteDataPermission
    | ListDataPermission
    | CreateFilePermission
    | ReadFilePermission
    | UpdateFilePermission
    | DeleteFilePermission
    | IncrementEventPermission
    | CountEventPermission
    | UpdateEventPermission
    | ReadPolicyPermission
    | GrantPermissionToPolicyPermission
    | RevokePermissionFromPolicyPermission
    | ListPoliciesPermission
    | AssignPolicyPermission
    | UnassignPolicyPermission
    | GrantRolePermission
    | RevokeRolePermission
    | ReadRolePermission
    | ListRolesPermission
    | UpdateRolePermission
    | CreateRecordKeyPermission;

export type AvailableDataPermissions =
    | CreateDataPermission
    | ReadDataPermission
    | UpdateDataPermission
    | DeleteDataPermission
    | ListDataPermission;

export type AvailableFilePermissions =
    | CreateFilePermission
    | ReadFilePermission
    | UpdateFilePermission
    | DeleteFilePermission;

export type AvailableEventPermissions =
    | IncrementEventPermission
    | CountEventPermission
    | UpdateEventPermission;

export type AvailablePolicyPermissions =
    | AssignPolicyPermission
    | UnassignPolicyPermission
    | ListPoliciesPermission
    | GrantPermissionToPolicyPermission
    | RevokePermissionFromPolicyPermission
    | ReadPolicyPermission;

export type AvailableRolePermissions =
    | GrantRolePermission
    | RevokeRolePermission
    | ListRolesPermission
    | ReadRolePermission
    | UpdateRolePermission;

/**
 * Defines an interface that describes common options for all permissions.
 */
export interface Permission {
    /**
     * The type of the permission.
     */
    type: string;

    /**
     * The role that this permission is can be performed by.
     *
     * If true, then the permission is valid for all roles. (everyone)
     * If a string, then the permission is valid for that specific role.
     */
    role: string | true;
}

export const PERMISSION_VALIDATION = z.object({
    role: z.union([z.literal(true), z.string()]),
});

type ZodPermission = z.infer<typeof PERMISSION_VALIDATION>;
type ZodPermissionAssertion = HasType<ZodPermission, Permission>;

/**
 * Defines an interface that describes the common options for all permissions that affect data records.
 */
export interface DataPermission extends Permission {
    /**
     * The addresses that can be manipulated.
     *
     * If true, then all addresses are allowed.
     * If a string, then it should be a Regular Expression that matches only addresses that are allowed to be created.
     */
    addresses: string | true;
}

export const DATA_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    addresses: z.union([z.literal(true), z.string()]),
});

type ZodDataPermission = z.infer<typeof DATA_PERMISSION_VALIDATION>;
type ZodDataPermissionAssertion = HasType<ZodDataPermission, DataPermission>;

/**
 * Defines an interface that describes a permission to be able to create data for a record marker.
 */
export interface CreateDataPermission extends DataPermission {
    type: 'data.create';
}

export const CREATE_DATA_VALIDATION = DATA_PERMISSION_VALIDATION.extend({
    type: z.literal('data.create'),
});
type ZodCreateDataPermission = z.infer<typeof CREATE_DATA_VALIDATION>;
type ZodCreateDataPermissionAssertion = HasType<
    ZodCreateDataPermission,
    CreateDataPermission
>;

/**
 * Defines an interface that describes a permission to be able to read data for a record marker.
 */
export interface ReadDataPermission extends DataPermission {
    type: 'data.read';
}

export const READ_DATA_VALIDATION = DATA_PERMISSION_VALIDATION.extend({
    type: z.literal('data.read'),
});
type ZodReadDataPermission = z.infer<typeof READ_DATA_VALIDATION>;
type ZodReadDataPermissionAssertion = HasType<
    ZodReadDataPermission,
    ReadDataPermission
>;

/**
 * Defines an interface that describes a permission to be able to update data for a record marker.
 */
export interface UpdateDataPermission extends DataPermission {
    type: 'data.update';
}

export const UPDATE_DATA_VALIDATION = DATA_PERMISSION_VALIDATION.extend({
    type: z.literal('data.update'),
});
type ZodUpdateDataPermission = z.infer<typeof UPDATE_DATA_VALIDATION>;
type ZodUpdateDataPermissionAssertion = HasType<
    ZodUpdateDataPermission,
    UpdateDataPermission
>;

/**
 * Defines an interface that describes a permission to be able to delete data for a record marker.
 */
export interface DeleteDataPermission extends DataPermission {
    type: 'data.delete';
}

export const DELETE_DATA_VALIDATION = DATA_PERMISSION_VALIDATION.extend({
    type: z.literal('data.delete'),
});
type ZodDeleteDataPermission = z.infer<typeof DELETE_DATA_VALIDATION>;
type ZodDeleteDataPermissionAssertion = HasType<
    ZodDeleteDataPermission,
    DeleteDataPermission
>;

/**
 * Defines an interface that describes a permission to be able to list data for a record marker.
 */
export interface ListDataPermission extends DataPermission {
    type: 'data.list';
}

export const LIST_DATA_VALIDATION = DATA_PERMISSION_VALIDATION.extend({
    type: z.literal('data.list'),
});
type ZodListDataPermission = z.infer<typeof LIST_DATA_VALIDATION>;
type ZodListDataPermissionAssertion = HasType<
    ZodListDataPermission,
    ListDataPermission
>;

/**
 * Defines an interface that describes the common options for all permissions that affect file records.
 */
export interface FilePermission extends Permission {
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

export const FILE_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    maxFileSizeInBytes: z.number().nonnegative().optional(),
    allowedMimeTypes: z
        .union([z.literal(true), z.array(z.string())])
        .optional(),
});
type ZodFilePermission = z.infer<typeof FILE_PERMISSION_VALIDATION>;
type ZodFilePermissionAssertion = HasType<ZodFilePermission, FilePermission>;

/**
 * Defines an interface that describes a permission to be able to create a file for a record marker.
 */
export interface CreateFilePermission extends FilePermission {
    type: 'file.create';
}

export const CREATE_FILE_VALIDATION = FILE_PERMISSION_VALIDATION.extend({
    type: z.literal('file.create'),
});
type ZodCreateFilePermission = z.infer<typeof CREATE_FILE_VALIDATION>;
type ZodCreateFilePermissionAssertion = HasType<
    ZodCreateFilePermission,
    CreateFilePermission
>;

/**
 * Defines an interface that describes a permission to be able to read a file for a record marker.
 */
export interface ReadFilePermission extends FilePermission {
    type: 'file.read';
}

export const READ_FILE_VALIDATION = FILE_PERMISSION_VALIDATION.extend({
    type: z.literal('file.read'),
});
type ZodReadFilePermission = z.infer<typeof READ_FILE_VALIDATION>;
type ZodReadFilePermissionAssertion = HasType<
    ZodReadFilePermission,
    ReadFilePermission
>;

/**
 * Defines an interface that describes a permission to be able to update a file for a record marker.
 * Currently only used to update resource markers that are on a file.
 */
export interface UpdateFilePermission extends FilePermission {
    type: 'file.update';
}

export const UPDATE_FILE_VALIDATION = FILE_PERMISSION_VALIDATION.extend({
    type: z.literal('file.update'),
});
type ZodUpdateFilePermission = z.infer<typeof UPDATE_FILE_VALIDATION>;
type ZodUpdateFilePermissionAssertion = HasType<
    ZodUpdateFilePermission,
    UpdateFilePermission
>;

/**
 * Defines an interface that describes a permission to be able to delete a file for a record marker.
 */
export interface DeleteFilePermission extends FilePermission {
    type: 'file.delete';
}

export const DELETE_FILE_VALIDATION = FILE_PERMISSION_VALIDATION.extend({
    type: z.literal('file.delete'),
});
type ZodDeleteFilePermission = z.infer<typeof DELETE_FILE_VALIDATION>;
type ZodDeleteFilePermissionAssertion = HasType<
    ZodDeleteFilePermission,
    DeleteFilePermission
>;

/**
 * Defines an interface that describes the common options for all permissions that affect event records.
 */
export interface EventPermission extends Permission {
    /**
     * The events that can be manipulated.
     *
     * If true, then all events are allowed.
     * If a string, then it should be a Regular Expression that matches only events that are allowed to be created.
     */
    events: string | true;
}

export const EVENT_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    events: z.union([z.literal(true), z.string()]),
});
type ZodEventPermission = z.infer<typeof EVENT_PERMISSION_VALIDATION>;
type ZodEventPermissionAssertion = HasType<ZodEventPermission, EventPermission>;

/**
 * Defines an interface that describes a permission to be able to increment an event record.
 */
export interface IncrementEventPermission extends EventPermission {
    type: 'event.increment';
}

export const INCREMENT_EVENT_VALIDATION = EVENT_PERMISSION_VALIDATION.extend({
    type: z.literal('event.increment'),
});
type ZodIncrementEventPermission = z.infer<typeof INCREMENT_EVENT_VALIDATION>;
type ZodIncrementEventPermissionAssertion = HasType<
    ZodIncrementEventPermission,
    IncrementEventPermission
>;

/**
 * Defines an interface that describes a permission to be able to count an event record.
 */
export interface CountEventPermission extends EventPermission {
    type: 'event.count';
}

export const COUNT_EVENT_VALIDATION = EVENT_PERMISSION_VALIDATION.extend({
    type: z.literal('event.count'),
});
type ZodCountEventPermission = z.infer<typeof COUNT_EVENT_VALIDATION>;
type ZodCountEventPermissionAssertion = HasType<
    ZodCountEventPermission,
    CountEventPermission
>;

/**
 * Defines an interface that describes a permission to be able to update an event record.
 * Currently only used to update resource markers that are on an event.
 */
export interface UpdateEventPermission extends EventPermission {
    type: 'event.update';
}

export const UPDATE_EVENT_VALIDATION = EVENT_PERMISSION_VALIDATION.extend({
    type: z.literal('event.update'),
});
type ZodUpdateEventPermission = z.infer<typeof UPDATE_EVENT_VALIDATION>;
type ZodUpdateEventPermissionAssertion = HasType<
    ZodUpdateEventPermission,
    UpdateEventPermission
>;

/**
 * Defines an interface that describes the common options for all permissions that affect policies.
 */
export interface PolicyPermission extends Permission {
    /**
     * The policies that can be manipulated.
     *
     * If true, then all policies are allowed.
     * If a string, then it should be a Regular Expression that matches only policies that are allowed to be manipulated.
     */
    policies: string | true;
}

export const POLICY_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    policies: z.union([z.literal(true), z.string()]),
});
type ZodPolicyPermission = z.infer<typeof POLICY_PERMISSION_VALIDATION>;
type ZodPolicyPermissionAssertion = HasType<
    ZodPolicyPermission,
    PolicyPermission
>;

/**
 * Defines an interface that describes a permission to be able to read a policy.
 */
export interface ReadPolicyPermission extends PolicyPermission {
    type: 'policy.read';
}

export const READ_POLICY_VALIDATION = POLICY_PERMISSION_VALIDATION.extend({
    type: z.literal('policy.read'),
});
type ZodReadPolicyPermission = z.infer<typeof READ_POLICY_VALIDATION>;
type ZodReadPolicyPermissionAssertion = HasType<
    ZodReadPolicyPermission,
    ReadPolicyPermission
>;

/**
 * Defines an interface that describes a permission to be able to list policies.
 */
export interface ListPoliciesPermission extends PolicyPermission {
    type: 'policy.list';
}

export const LIST_POLICIES_VALIDATION = POLICY_PERMISSION_VALIDATION.extend({
    type: z.literal('policy.list'),
});
type ZodListPoliciesPermission = z.infer<typeof LIST_POLICIES_VALIDATION>;
type ZodListPoliciesPermissionAssertion = HasType<
    ZodListPoliciesPermission,
    ListPoliciesPermission
>;

/**
 * Defines an interface that describes a permission to be able to grant a permission to a policy.
 */
export interface GrantPermissionToPolicyPermission extends PolicyPermission {
    type: 'policy.grantPermission';
}

export const GRANT_PERMISSION_TO_POLICY_VALIDATION =
    POLICY_PERMISSION_VALIDATION.extend({
        type: z.literal('policy.grantPermission'),
    });
type ZodGrantPermissionToPolicyPermission = z.infer<
    typeof GRANT_PERMISSION_TO_POLICY_VALIDATION
>;
type ZodGrantPermissionToPolicyPermissionAssertion = HasType<
    ZodGrantPermissionToPolicyPermission,
    GrantPermissionToPolicyPermission
>;

/**
 * Defines an interface that describes a permission to revoke a permission from a policy.
 */
export interface RevokePermissionFromPolicyPermission extends PolicyPermission {
    type: 'policy.revokePermission';
}

export const REVOKE_PERMISSION_VALIDATION = POLICY_PERMISSION_VALIDATION.extend(
    {
        type: z.literal('policy.revokePermission'),
    }
);
type ZodRevokePermissionFromPolicyPermission = z.infer<
    typeof REVOKE_PERMISSION_VALIDATION
>;
type ZodRevokePermissionFromPolicyPermissionAssertion = HasType<
    ZodRevokePermissionFromPolicyPermission,
    RevokePermissionFromPolicyPermission
>;

/**
 * Defines an interface that describes a permission to assign a policy to a particular resource.
 */
export interface AssignPolicyPermission extends PolicyPermission {
    type: 'policy.assign';
}

export const ASSIGN_POLICY_VALIDATION = POLICY_PERMISSION_VALIDATION.extend({
    type: z.literal('policy.assign'),
});
type ZodAssignPolicyPermission = z.infer<typeof ASSIGN_POLICY_VALIDATION>;
type ZodAssignPolicyPermissionAssertion = HasType<
    ZodAssignPolicyPermission,
    AssignPolicyPermission
>;

/**
 * Defines an interface that describes a permission to remove a policy from a particular resource.
 */
export interface UnassignPolicyPermission extends PolicyPermission {
    type: 'policy.unassign';
}

export const UNASSIGN_POLICY_VALIDATION = POLICY_PERMISSION_VALIDATION.extend({
    type: z.literal('policy.unassign'),
});
type ZodUnassignPolicyPermission = z.infer<typeof UNASSIGN_POLICY_VALIDATION>;
type ZodUnassignPolicyPermissionAssertion = HasType<
    ZodUnassignPolicyPermission,
    UnassignPolicyPermission
>;

/**
 * Defines an interface that describes the common options for all permissions that affect roles.
 */
export interface RolePermission extends Permission {
    /**
     * The roles that can be manipulated.
     *
     * If true, then all roles are allowed.
     * If a string, then it should be a Regular Expression that matches only roles that are allowed to be manipulated.
     */
    roles: string | true;
}

export const ROLE_PERMISSION_VALIDATION = PERMISSION_VALIDATION.extend({
    roles: z.union([z.literal(true), z.string()]),
});
type ZodRolePermission = z.infer<typeof ROLE_PERMISSION_VALIDATION>;
type ZodRolePermissionAssertion = HasType<ZodRolePermission, RolePermission>;

/**
 * Defines an interface that describes a permission to grant a role.
 */
export interface GrantRolePermission extends RolePermission {
    type: 'role.grant';

    /**
     * What user IDs can the role be granted to?
     * If true, then the role can be granted to anyone.
     * If false, then the role cannot be granted to a user.
     * If an array of strings, then the role can only be granted to the users with the given IDs.
     */
    userIds: string[] | boolean;

    /**
     * What instances can the role be granted to?
     * If true, then the role can be granted to any instance.
     * If false, then the role cannot be granted to an instance.
     * If a string, then it should be a Regular Expression that matches only instances that are allowed to be granted to.
     */
    instances: string | boolean;

    /**
     * The maximum lifetime that the role can be granted for in miliseconds.
     * If not specified, then the role can be granted for an infinite amount of time.
     */
    maxDurationMs?: number;
}

export const GRANT_ROLE_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.grant'),
});
type ZodGrantRolePermission = z.infer<typeof GRANT_ROLE_VALIDATION>;
type ZodGrantRolePermissionAssertion = HasType<
    ZodGrantRolePermission,
    GrantRolePermission
>;

/**
 * Defines an interface that describes a permission to revoke a role.
 */
export interface RevokeRolePermission extends RolePermission {
    type: 'role.revoke';

    /**
     * What user IDs can the role be revoked from?
     * If true, then the role can be revoked from anyone.
     * If false, then the role cannot be revoked from a user.
     * If an array of strings, then the role can only be revoked from the users with the given IDs.
     */
    userIds: string[] | boolean;

    /**
     * What instances can the role be revoked from?
     * If true, then the role can be revoked from any instance.
     * If false, then the role cannot be revoked from an instance.
     * If a string, then it should be a Regular Expression that matches only instances that are allowed to be revoked from.
     */
    instances: string | false;
}

export const REVOKE_ROLE_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.revoke'),
});
type ZodRevokeRolePermission = z.infer<typeof REVOKE_ROLE_VALIDATION>;
type ZodRevokeRolePermissionAssertion = HasType<
    ZodRevokeRolePermission,
    RevokeRolePermission
>;

/**
 * Defines an interface that describes a permission to read a role.
 */
export interface ReadRolePermission extends RolePermission {
    type: 'role.read';
}

export const READ_ROLE_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.read'),
});
type ZodReadRolePermission = z.infer<typeof READ_ROLE_VALIDATION>;
type ZodReadRolePermissionAssertion = HasType<
    ZodReadRolePermission,
    ReadRolePermission
>;

/**
 * Defines an interface that describes a permission to update a role.
 */
export interface UpdateRolePermission extends RolePermission {
    type: 'role.update';
}

export const UPDATE_ROLE_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.update'),
});
type ZodUpdateRolePermission = z.infer<typeof UPDATE_ROLE_VALIDATION>;
type ZodUpdateRolePermissionAssertion = HasType<
    ZodUpdateRolePermission,
    UpdateRolePermission
>;

/**
 * Defines an interface that describes a permission to list the available roles.
 */
export interface ListRolesPermission extends RolePermission {
    type: 'role.list';
}

export const LIST_ROLES_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.list'),
});
type ZodListRolesPermission = z.infer<typeof LIST_ROLES_VALIDATION>;
type ZodListRolesPermissionAssertion = HasType<
    ZodListRolesPermission,
    ListRolesPermission
>;

export const AVAILABLE_PERMISSIONS_VALIDATION = z.discriminatedUnion('type', [
    CREATE_DATA_VALIDATION,
    READ_DATA_VALIDATION,
    UPDATE_DATA_VALIDATION,
    DELETE_DATA_VALIDATION,
    LIST_DATA_VALIDATION,
    CREATE_FILE_VALIDATION,
    READ_FILE_VALIDATION,
    UPDATE_FILE_VALIDATION,
    DELETE_FILE_VALIDATION,
    INCREMENT_EVENT_VALIDATION,
    COUNT_EVENT_VALIDATION,
    UPDATE_EVENT_VALIDATION,
    READ_POLICY_VALIDATION,
    GRANT_PERMISSION_TO_POLICY_VALIDATION,
    REVOKE_PERMISSION_VALIDATION,
    ASSIGN_POLICY_VALIDATION,
    UNASSIGN_POLICY_VALIDATION,
    LIST_POLICIES_VALIDATION,
    GRANT_ROLE_VALIDATION,
    REVOKE_ROLE_VALIDATION,
    LIST_ROLES_VALIDATION,
]);

// /**
//  * A map of permission types to their Zod validation schemas.
//  */
// export const ZOD_PERMISSION_MAP = {
//     'data.create': CREATE_DATA_VALIDATION,
//     'data.read': READ_DATA_VALIDATION,
//     'data.update': UPDATE_DATA_VALIDATION,
//     'data.delete': DELETE_DATA_VALIDATION,
//     'data.list': LIST_DATA_VALIDATION,
//     'file.create': CREATE_FILE_VALIDATION,
//     'file.read': READ_FILE_VALIDATION,
//     'file.update': UPDATE_FILE_VALIDATION,
//     'file.delete': DELETE_FILE_VALIDATION,
//     'event.increment': INCREMENT_EVENT_VALIDATION,
//     'event.count': COUNT_EVENT_VALIDATION,
//     'event.update': UPDATE_EVENT_VALIDATION,
//     'policy.read': READ_POLICY_VALIDATION,
//     'policy.grantPermission': GRANT_PERMISSION_TO_POLICY_VALIDATION,
//     'policy.revokePermission': REVOKE_PERMISSION_VALIDATION,
//     'policy.assign': ASSIGN_POLICY_VALIDATION,
//     'policy.unassign': UNASSIGN_POLICY_VALIDATION,
//     'policy.list': LIST_POLICIES_VALIDATION,
//     'role.grant': GRANT_ROLE_VALIDATION,
//     'role.revoke': REVOKE_ROLE_VALIDATION,
//     'role.list': LIST_ROLES_VALIDATION,
// };

/**
 * Defines an interface for permissions that affect record keys.
 */
export interface RecordKeyPermission extends Permission {}

/**
 * Defines an interface that represents a permission to create a record key.
 */
export interface CreateRecordKeyPermission extends RecordKeyPermission {
    type: 'recordKey.create';

    /**
     * The names of the records that record keys can be created for.
     *
     * If true, then keys can be created for all record names.
     * If a string, then it should be a Regular Expression that matches only record names that are allowed.
     */
    recordNames: string | true;
}

/**
 * Defines an interface that represents a policy document.
 * That is, a list of permissions that are granted to specific roles.
 */
export interface PolicyDocument {
    /**
     * The list of permissions that are allowed by this policy document.
     */
    permissions: AvailablePermissions[];
}

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
 * The name of the "account" resource marker.
 * Used by default for policy and role records.
 */
export const ACCOUNT_MARKER = 'account';

/**
 * Defines a default policy document for any resource.
 */
export const DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT: PolicyDocument = {
    permissions: [
        // Admin permissions
        {
            type: 'data.create',
            role: ADMIN_ROLE_NAME,
            addresses: true,
        },
        {
            type: 'data.read',
            role: ADMIN_ROLE_NAME,
            addresses: true,
        },
        {
            type: 'data.update',
            role: ADMIN_ROLE_NAME,
            addresses: true,
        },
        {
            type: 'data.delete',
            role: ADMIN_ROLE_NAME,
            addresses: true,
        },
        {
            type: 'data.list',
            role: ADMIN_ROLE_NAME,
            addresses: true,
        },
        {
            type: 'file.create',
            role: ADMIN_ROLE_NAME,
        },
        {
            type: 'file.read',
            role: ADMIN_ROLE_NAME,
        },
        {
            type: 'file.delete',
            role: ADMIN_ROLE_NAME,
        },
        {
            type: 'file.update',
            role: ADMIN_ROLE_NAME,
        },
        {
            type: 'event.increment',
            role: ADMIN_ROLE_NAME,
            events: true,
        },
        {
            type: 'event.count',
            role: ADMIN_ROLE_NAME,
            events: true,
        },
        {
            type: 'event.update',
            role: ADMIN_ROLE_NAME,
            events: true,
        },
        {
            type: 'policy.grantPermission',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'policy.revokePermission',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'policy.assign',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'policy.unassign',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'policy.list',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'policy.read',
            role: ADMIN_ROLE_NAME,
            policies: true,
        },
        {
            type: 'role.grant',
            role: ADMIN_ROLE_NAME,
            roles: true,
            userIds: true,
            instances: true,
        },
        {
            type: 'role.revoke',
            role: ADMIN_ROLE_NAME,
            roles: true,
            userIds: true,
            instances: true,
        },
        {
            type: 'role.read',
            role: ADMIN_ROLE_NAME,
            roles: true,
        },
        {
            type: 'role.list',
            role: ADMIN_ROLE_NAME,
            roles: true,
        },
        {
            type: 'role.update',
            role: ADMIN_ROLE_NAME,
            roles: true,
        },

        // Record Owner Permissions
        {
            type: 'recordKey.create',
            role: RECORD_OWNER_ROLE_NAME,
            recordNames: true,
        },
    ],
};

/**
 * Defines a policy document that applies only to resources marked with the "publicRead" marker.
 */
export const DEFAULT_PUBLIC_READ_POLICY_DOCUMENT: PolicyDocument = {
    permissions: [
        {
            type: 'data.read',
            role: true,
            addresses: true,
        },
        {
            type: 'data.list',
            role: true,
            addresses: true,
        },
        {
            type: 'file.read',
            role: true,
        },
        {
            type: 'event.count',
            role: true,
            events: true,
        },
    ],
};

type HasType<T, Q extends T> = Q;
