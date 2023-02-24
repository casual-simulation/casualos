/**
 * Defines an interface that describes common options for all permissions.
 */
export interface Permission {
    /**
     * The role that this permission is valid for.
     */
    role: string;
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
export interface CreateDataPermission extends DataPermission {}

/**
 * Defines an interface that describes a permission to be able to read data for a record marker.
 */
export interface ReadDataPermission extends DataPermission {}

/**
 * Defines an interface that describes a permission to be able to update data for a record marker.
 */
export interface UpdateDataPermission extends DataPermission {}

/**
 * Defines an interface that describes a permission to be able to delete data for a record marker.
 */
export interface DeleteDataPermission extends DataPermission {}

/**
 * Defines an interface that describes a permission to be able to list data for a record marker.
 */
export interface ListDataPermission extends DataPermission {}

/**
 * Defines an interface that describes the common options for all permissions that affect file records.
 */
export interface FilePermission extends Permission {}

/**
 * Defines an interface that describes a permission to be able to create a file for a record marker.
 */
export interface CreateFilePermission extends FilePermission {}

/**
 * Defines an interface that describes a permission to be able to read a file for a record marker.
 */
export interface ReadFilePermission extends FilePermission {}

/**
 * Defines an interface that describes a permission to be able to delete a file for a record marker.
 */
export interface DeleteFilePermission extends FilePermission {}

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
export interface IncrementEventPermission extends EventPermission {}

/**
 * Defines an interface that describes a permission to be able to count an event record.
 */
export interface CountEventPermission extends EventPermission {}

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
export interface ReadPolicyPermission extends PolicyPermission {}

/**
 * Defines an interface that describes a permission to be able to list policies.
 */
export interface ListPoliciesPermission extends PolicyPermission {}

/**
 * Defines an interface that describes a permission to be able to grant a permission to a policy.
 */
export interface GrantPermissionToPolicyPermission extends PolicyPermission {}

/**
 * Defines an interface that describes a permission to revoke a permission from a policy.
 */
export interface RevokePermissionFromPolicyPermission
    extends PolicyPermission {}

/**
 * Defines an interface that describes a permission to assign a policy to a particular resource.
 */
export interface AssignPolicyPermission extends PolicyPermission {}
