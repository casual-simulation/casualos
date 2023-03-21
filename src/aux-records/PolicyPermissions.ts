export type AvailablePermissions =
    | CreateDataPermission
    | ReadDataPermission
    | UpdateDataPermission
    | DeleteDataPermission
    | ListDataPermission
    | CreateFilePermission
    | ReadFilePermission
    | DeleteFilePermission
    | IncrementEventPermission
    | CountEventPermission
    | ReadPolicyPermission
    | GrantPermissionToPolicyPermission
    | RevokePermissionFromPolicyPermission
    | ListPoliciesPermission
    | AssignPolicyPermission
    | UnassignPolicyPermission
    | GrantRolePermission
    | RevokeRolePermission
    | ListRolesPermission
    | CreateRecordKeyPermission;

export type AvailableDataPermissions =
    | CreateDataPermission
    | ReadDataPermission
    | UpdateDataPermission
    | DeleteDataPermission
    | ListDataPermission;

export type AvailablePolicyPermissions =
    | AssignPolicyPermission
    | UnassignPolicyPermission
    | ListPoliciesPermission;

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

/**
 * Defines an interface that describes a permission to be able to create data for a record marker.
 */
export interface CreateDataPermission extends DataPermission {
    type: 'data.create';
}

/**
 * Defines an interface that describes a permission to be able to read data for a record marker.
 */
export interface ReadDataPermission extends DataPermission {
    type: 'data.read';
}

/**
 * Defines an interface that describes a permission to be able to update data for a record marker.
 */
export interface UpdateDataPermission extends DataPermission {
    type: 'data.update';
}

/**
 * Defines an interface that describes a permission to be able to delete data for a record marker.
 */
export interface DeleteDataPermission extends DataPermission {
    type: 'data.delete';
}

/**
 * Defines an interface that describes a permission to be able to list data for a record marker.
 */
export interface ListDataPermission extends DataPermission {
    type: 'data.list';
}

/**
 * Defines an interface that describes the common options for all permissions that affect file records.
 */
export interface FilePermission extends Permission {}

/**
 * Defines an interface that describes a permission to be able to create a file for a record marker.
 */
export interface CreateFilePermission extends FilePermission {
    type: 'file.create';
}

/**
 * Defines an interface that describes a permission to be able to read a file for a record marker.
 */
export interface ReadFilePermission extends FilePermission {
    type: 'file.read';
}

/**
 * Defines an interface that describes a permission to be able to delete a file for a record marker.
 */
export interface DeleteFilePermission extends FilePermission {
    type: 'file.delete';
}

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

/**
 * Defines an interface that describes a permission to be able to increment an event record.
 */
export interface IncrementEventPermission extends EventPermission {
    type: 'event.increment';
}

/**
 * Defines an interface that describes a permission to be able to count an event record.
 */
export interface CountEventPermission extends EventPermission {
    type: 'event.count';
}

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

/**
 * Defines an interface that describes a permission to be able to read a policy.
 */
export interface ReadPolicyPermission extends PolicyPermission {
    type: 'policy.read';
}

/**
 * Defines an interface that describes a permission to be able to list policies.
 */
export interface ListPoliciesPermission extends PolicyPermission {
    type: 'policy.list';
}

/**
 * Defines an interface that describes a permission to be able to grant a permission to a policy.
 */
export interface GrantPermissionToPolicyPermission extends PolicyPermission {
    type: 'policy.grantPermission';
}

/**
 * Defines an interface that describes a permission to revoke a permission from a policy.
 */
export interface RevokePermissionFromPolicyPermission extends PolicyPermission {
    type: 'policy.revokePermission';
}

/**
 * Defines an interface that describes a permission to assign a policy to a particular resource.
 */
export interface AssignPolicyPermission extends PolicyPermission {
    type: 'policy.assign';
}

/**
 * Defines an interface that describes a permission to remove a policy from a particular resource.
 */
export interface UnassignPolicyPermission extends PolicyPermission {
    type: 'policy.unassign';
}

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

/**
 * Defines an interface that describes a permission to grant a role.
 */
export interface GrantRolePermission extends RolePermission {
    type: 'role.grant';
}

/**
 * Defines an interface that describes a permission to revoke a role.
 */
export interface RevokeRolePermission extends RolePermission {
    type: 'role.revoke';
}

/**
 * Defines an interface that describes a permission to list the available roles.
 */
export interface ListRolesPermission extends RolePermission {
    type: 'role.list';
}

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
 */
export const PUBLIC_READ_MARKER = 'publicRead';

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
        },
        {
            type: 'role.revoke',
            role: ADMIN_ROLE_NAME,
            roles: true,
        },
        {
            type: 'role.list',
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
