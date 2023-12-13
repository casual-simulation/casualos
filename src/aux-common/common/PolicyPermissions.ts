import { z } from 'zod';

export const DATA_RESOURCE_KIND = 'data';
export const FILE_RESOURCE_KIND = 'file';
export const EVENT_RESOURCE_KIND = 'event';
export const POLICY_RESOURCE_KIND = 'policy';
export const ROLE_RESOURCE_KIND = 'role';
export const INST_RESOURCE_KIND = 'inst';
export type ResourceKinds =
    | typeof DATA_RESOURCE_KIND
    | typeof FILE_RESOURCE_KIND
    | typeof EVENT_RESOURCE_KIND
    | typeof POLICY_RESOURCE_KIND
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
    | CreateDataPermission
    | ReadDataPermission
    | UpdateDataPermission
    | DeleteDataPermission
    | ListDataPermission
    | CreateFilePermission
    | ReadFilePermission
    | ListFilePermission
    | UpdateFilePermission
    | DeleteFilePermission
    | IncrementEventPermission
    | CountEventPermission
    | UpdateEventPermission
    | ListEventPermission
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
    | AvailableInstPermissions
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
    | ListFilePermission
    | UpdateFilePermission
    | DeleteFilePermission;

export type AvailableEventPermissions =
    | IncrementEventPermission
    | CountEventPermission
    | UpdateEventPermission
    | ListEventPermission;

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

export type AvailableInstPermissions =
    | CreateInstPermission
    | ReadInstPermission
    | DeleteInstPermission
    | UpdateInstPermission
    | UpdateDataInstPermission
    | ListInstPermission
    | SendInstActionPermission;

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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 * Defines an interface that describes a permission to be able to list a file for a record marker.
 */
export interface ListFilePermission extends FilePermission {
    type: 'file.list';
}

export const LIST_FILE_VALIDATION = FILE_PERMISSION_VALIDATION.extend({
    type: z.literal('file.list'),
});
type ZodListFilePermission = z.infer<typeof LIST_FILE_VALIDATION>;
type ZodListFilePermissionAssertion = HasType<
    ZodListFilePermission,
    ListFilePermission
>;

/**
 * Defines an interface that describes a permission to be able to update a file for a record marker.
 * Currently only used to update resource markers that are on a file.
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 * Defines an interface that describes a permission to be able to list events in a record.
 *
 * @dochash types/permissions
 */
export interface ListEventPermission extends EventPermission {
    type: 'event.list';
}

export const LIST_EVENT_VALIDATION = EVENT_PERMISSION_VALIDATION.extend({
    type: z.literal('event.list'),
});
type ZodListEventPermission = z.infer<typeof LIST_EVENT_VALIDATION>;
type ZodListEventPermissionAssertion = HasType<
    ZodListEventPermission,
    ListEventPermission
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
    userIds: z.union([z.boolean(), z.array(z.string())]),
    instances: z.union([z.boolean(), z.string()]),
    maxDurationMs: z.number().optional(),
});
type ZodGrantRolePermission = z.infer<typeof GRANT_ROLE_VALIDATION>;
type ZodGrantRolePermissionAssertion = HasType<
    ZodGrantRolePermission,
    GrantRolePermission
>;

/**
 * Defines an interface that describes a permission to revoke a role.
 *
 * @dochash types/permissions
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
    instances: string | boolean;
}

export const REVOKE_ROLE_VALIDATION = ROLE_PERMISSION_VALIDATION.extend({
    type: z.literal('role.revoke'),
    userIds: z.union([z.boolean(), z.array(z.string())]),
    instances: z.union([z.boolean(), z.string()]),
});
type ZodRevokeRolePermission = z.infer<typeof REVOKE_ROLE_VALIDATION>;
type ZodRevokeRolePermissionAssertion = HasType<
    ZodRevokeRolePermission,
    RevokeRolePermission
>;

/**
 * Defines an interface that describes a permission to read a role.
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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
 *
 * @dochash types/permissions
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

export interface InstPermission extends Permission {
    /**
     * The insts that this permission allows access to.
     *
     * If true, then all insts are allowed.
     * If a string, then it should be a Regular Expression that matches only insts that are allowed to be manipulated.
     */
    insts: string | true;
}
export const INST_VALIDATION = PERMISSION_VALIDATION.extend({
    insts: z.union([z.literal(true), z.string()]),
});
type ZodInstPermission = z.infer<typeof INST_VALIDATION>;
type ZodInstPermissionAssertion = HasType<ZodInstPermission, InstPermission>;

/**
 * Defines an interface that describes a permission to create an inst.
 */
export interface CreateInstPermission extends InstPermission {
    type: 'inst.create';
}

export const CREATE_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.create'),
});
type ZodCreateInstPermission = z.infer<typeof CREATE_INST_VALIDATION>;
type ZodCreateInstPermissionAssertion = HasType<
    ZodCreateInstPermission,
    CreateInstPermission
>;

/**
 * Defines an interface that describes a permission to read data from an inst.
 */
export interface ReadInstPermission extends InstPermission {
    type: 'inst.read';
}

export const READ_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.read'),
});
type ZodReadInstPermission = z.infer<typeof READ_INST_VALIDATION>;
type ZodReadInstPermissionAssertion = HasType<
    ZodReadInstPermission,
    ReadInstPermission
>;

/**
 * Defines an interface that describes a permission to update information about an inst.
 */
export interface UpdateInstPermission extends InstPermission {
    type: 'inst.update';
}

export const UPDATE_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.update'),
});
type ZodUpdateInstPermission = z.infer<typeof UPDATE_INST_VALIDATION>;
type ZodUpdateInstPermissionAssertion = HasType<
    ZodUpdateInstPermission,
    UpdateInstPermission
>;

/**
 * Defines an interface that describes a permission to update data in an inst.
 */
export interface UpdateDataInstPermission extends InstPermission {
    type: 'inst.updateData';
}

export const UPDATE_DATA_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.updateData'),
});
type ZodUpdateDataInstPermission = z.infer<typeof UPDATE_DATA_INST_VALIDATION>;
type ZodUpdateDataInstPermissionAssertion = HasType<
    ZodUpdateDataInstPermission,
    UpdateDataInstPermission
>;

/**
 * Defines an interface that describes a permission to delete an inst.
 */
export interface DeleteInstPermission extends InstPermission {
    type: 'inst.delete';
}

export const DELETE_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.delete'),
});
type ZodDeleteInstPermission = z.infer<typeof DELETE_INST_VALIDATION>;
type ZodDeleteInstPermissionAssertion = HasType<
    ZodDeleteInstPermission,
    DeleteInstPermission
>;

/**
 * Defines an interface that describes a permission to list insts.
 */
export interface ListInstPermission extends InstPermission {
    type: 'inst.list';
}

export const LIST_INST_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.list'),
});
type ZodListInstPermission = z.infer<typeof LIST_INST_VALIDATION>;
type ZodListInstPermissionAssertion = HasType<
    ZodListInstPermission,
    ListInstPermission
>;

/**
 * Defines an interface that describes a permission to send actions in insts.
 */
export interface SendInstActionPermission extends InstPermission {
    type: 'inst.sendAction';
}

export const SEND_INST_ACTION_PERMISSION_VALIDATION = INST_VALIDATION.extend({
    type: z.literal('inst.sendAction'),
});
type ZodSendInstActionPermission = z.infer<
    typeof SEND_INST_ACTION_PERMISSION_VALIDATION
>;
type ZodSendInstActionPermissionAssertion = HasType<
    ZodSendInstActionPermission,
    SendInstActionPermission
>;

export const AVAILABLE_PERMISSIONS_VALIDATION = z.discriminatedUnion('type', [
    CREATE_DATA_VALIDATION,
    READ_DATA_VALIDATION,
    UPDATE_DATA_VALIDATION,
    DELETE_DATA_VALIDATION,
    LIST_DATA_VALIDATION,
    CREATE_FILE_VALIDATION,
    READ_FILE_VALIDATION,
    LIST_FILE_VALIDATION,
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

    CREATE_INST_VALIDATION,
    READ_INST_VALIDATION,
    UPDATE_INST_VALIDATION,
    UPDATE_DATA_INST_VALIDATION,
    DELETE_INST_VALIDATION,
    LIST_INST_VALIDATION,
    SEND_INST_ACTION_PERMISSION_VALIDATION,
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
 * The possible options for a permission.
 */
export interface PermissionOptions {
    /**
     * The maximum size that file resources are allowed to be in bytes.
     * If not specified, then the default is Infinity.
     */
    maxFileSizeInBytes?: number;

    /**
     * The list of allowed MIME types that are allowed for file resources.
     * If not specified, then the default is all MIME types.
     */
    allowedMimeTypes?: string[];
}
export const PERMISSION_OPTIONS_VALIDATION = z.object({
    maxFileSizeInBytes: z.number().nonnegative().optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
});
type ZodPermissionOptions = z.infer<typeof PERMISSION_OPTIONS_VALIDATION>;
type ZodPermissionOptionsAssertion = HasType<
    ZodPermissionOptions,
    PermissionOptions
>;

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
            type: 'file.list',
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
            type: 'event.list',
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
        {
            type: 'inst.create',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.read',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.delete',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.update',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.updateData',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.list',
            role: ADMIN_ROLE_NAME,
            insts: true,
        },
        {
            type: 'inst.sendAction',
            role: ADMIN_ROLE_NAME,
            insts: true,
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
        {
            type: 'inst.read',
            role: true,
            insts: true,
        },
    ],
};

/**
 * Defines a policy document that applies only to resources marked with the "publicWrite" marker.
 */
export const DEFAULT_PUBLIC_WRITE_POLICY_DOCUMENT: PolicyDocument = {
    permissions: [
        {
            type: 'data.create',
            role: true,
            addresses: true,
        },
        {
            type: 'data.delete',
            role: true,
            addresses: true,
        },
        {
            type: 'data.read',
            role: true,
            addresses: true,
        },
        {
            type: 'data.update',
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
            type: 'file.create',
            role: true,
        },
        {
            type: 'file.delete',
            role: true,
        },
        {
            type: 'event.count',
            role: true,
            events: true,
        },
        {
            type: 'event.increment',
            role: true,
            events: true,
        },
        {
            type: 'inst.read',
            role: true,
            insts: true,
        },
        {
            type: 'inst.updateData',
            role: true,
            insts: true,
        },
        {
            type: 'inst.delete',
            role: true,
            insts: true,
        },
        {
            type: 'inst.create',
            role: true,
            insts: true,
        },
    ],
};

type HasType<T, Q extends T> = Q;
