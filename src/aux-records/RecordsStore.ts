import { WebConfig } from '@casual-simulation/aux-common';
import { ComIdConfig } from './ComIdConfig';

/**
 * Defines an interface for objects that can store records.
 */
export interface RecordsStore {
    /**
     * Updates the given record.
     * @param record The record that should be updated.
     */
    updateRecord(record: Record): Promise<void>;

    /**
     * Adds the given record to the store.
     * @param record The record to add.
     */
    addRecord(record: Record): Promise<void>;

    /**
     * Gets the record with the given name.
     * @param name The name of the record.
     */
    getRecordByName(name: string): Promise<Record>;

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    addRecordKey(key: RecordKey): Promise<void>;

    /**
     * Gets the record key for the given record name that has the given hash.
     * @param recordName The name of the record.
     * @param hash The scrypt hash of the key that should be retrieved.
     */
    getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey>;

    /**
     * Gets the list of records that the user with the given ID owns.
     *
     * If null or undefined, then this store does not support this method.
     *
     * @param ownerId The ID of the user that owns the records.
     */
    listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]>;

    /**
     * Gets the list of records that the studio with the given ID owns.
     *
     * If null or undefined, then this store does not support this method.
     *
     * @param studioId The ID of the studio that owns the records.
     */
    listRecordsByStudioId(studioId: string): Promise<ListedRecord[]>;

    /**
     * Gets the list of records that the studio with the given ID owns and that the user with the given ID has access to.
     * @param studioId The ID of the studio.
     * @param userId The ID of the user.
     */
    listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]>;

    /**
     * Adds the given studio to the store.
     * @param studio The studio to add.
     */
    addStudio(studio: Studio): Promise<void>;

    /**
     * Creates a new studio and adds the given user as an admin.
     * @param studio The studio to create.
     * @param adminId The ID of the admin user.
     */
    createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{
        studio: Studio;
        assignment: StudioAssignment;
    }>;

    /**
     * Updates the given studio.
     * @param studio The studio record that should be updated.
     */
    updateStudio(studio: Studio): Promise<void>;

    /**
     * Gets the studio with the given ID.
     * @param id The ID of the studio.
     */
    getStudioById(id: string): Promise<Studio>;

    /**
     * Gets the studio that has the given comId.
     * @param comId The comId of the studio.
     */
    getStudioByComId(comId: string): Promise<Studio>;

    /**
     * Gets the studio that has the given stripe customer ID.
     * @param customerId The stripe customer ID for the studio.
     */
    getStudioByStripeCustomerId(customerId: string): Promise<Studio>;

    /**
     * Gets the list of studios that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
    listStudiosForUser(userId: string): Promise<StoreListedStudio[]>;

    /**
     * Gets the list of studios that are owned by the given comId and that the user with the given ID has access to.
     * @param userId The ID of the user.
     * @param comId The comId of the studio that owns the studios.
     */
    listStudiosForUserAndComId(
        userId: string,
        comId: string
    ): Promise<StoreListedStudio[]>;

    /**
     * Adds the given studio assignment to the store.
     * @param assignment The assignment to add.
     */
    addStudioAssignment(assignment: StudioAssignment): Promise<void>;

    /**
     * Updates the given studio assignment.
     * @param assignment The assignment that should be updated.
     */
    updateStudioAssignment(assignment: StudioAssignment): Promise<void>;

    /**
     * Removes the given user from the given studio.
     * @param studioId The ID of the studio.
     * @param userId The ID of the user.
     */
    removeStudioAssignment(studioId: string, userId: string): Promise<void>;

    /**
     * Gets the list of users that have been assigned to the given studio.
     * @param studioId The ID of the studio.
     * @param filters The additional filters that should be used.
     */
    listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]>;

    /**
     * Gets the list of studio assignments that the user with the given ID has access to.
     * @param userId The ID of the user.
     */
    listUserAssignments(userId: string): Promise<ListedUserAssignment[]>;

    /**
     * Counts the number of records that match the given filter.
     * @param filter The filter.
     */
    countRecords(filter: CountRecordsFilter): Promise<number>;
}

export interface CountRecordsFilter {
    /**
     * The ID of user that owns the record.
     */
    ownerId?: string;

    /**
     * The ID of the studio that owns the record.
     */
    studioId?: string;
}

/**
 * Defines an interface for record objects.
 */
export interface Record {
    /**
     * The name of the record.
     */
    name: string;

    /**
     * The ID of the user that owns the record.
     * Null if the record is owned by a studio.
     */
    ownerId: string | null;

    /**
     * The ID of the studio that owns the record.
     * Null if the record is owned by a user.
     */
    studioId: string | null;

    /**
     * The scrypt hashes of the secrets that allow access to the record.
     */
    secretHashes: string[];

    /**
     * The salt that is used to hash the secrets.
     *
     * Normally it is bad to share a salt between multiple secrets but in this case
     * it is fine because there are very few secrets per salt (i.e. not 1 salt per million users but 1 salt per couple record keys) and the secrets are randomly generated.
     */
    secretSalt: string;
}

export interface ListedRecord {
    /**
     * The name of the record.
     */
    name: string;

    /**
     * The ID of the user that owns the record.
     * Null if owned by a studio.
     */
    ownerId: string | null;

    /**
     * The ID of the studio that owns the record.
     * Null if owned by a user.
     */
    studioId: string | null;
}

/**
 * Defines an interface for studio objects.
 */
export interface Studio {
    /**
     * The ID of the studio.
     */
    id: string;

    /**
     * The name of the studio.
     */
    displayName: string;

    /**
     * The URL of the logo for the studio.
     */
    logoUrl?: string | null;

    /**
     * The ID of the stripe customer for this studio.
     */
    stripeCustomerId?: string;

    /**
     * The current subscription status for this studio.
     */
    subscriptionStatus?: string;

    /**
     * The ID of the purchasable subscription that the user has.
     * Note that this is the ID of the subscription in the config, not the ID of the stripe subscription.
     */
    subscriptionId?: string;

    /**
     * The ID of the subscription that this studio record references.
     */
    subscriptionInfoId?: string;

    /**
     * The unix time in miliseconds that the studio's current subscription period started at.
     */
    subscriptionPeriodStartMs?: number | null;

    /**
     * The unix time in miliseconds that the studio's current subscription period ends at.
     */
    subscriptionPeriodEndMs?: number | null;

    /**
     * The comId that this studio owns.
     */
    comId?: string | null;

    /**
     * The comId of the studio that owns this studio.
     */
    ownerStudioComId?: string | null;

    /**
     * The player web config for the studio.
     */
    playerConfig?: Partial<WebConfig>;

    /**
     * The config for comId features.
     */
    comIdConfig?: ComIdConfig;
}

/**
 * Defines the list of possible studio roles that a user can be assigned.
 *
 * @dochash types/records/studios
 * @docname StudioAssignmentRole
 */
export type StudioAssignmentRole = 'admin' | 'member';

/**
 * Defines an interface for studio assignment objects.
 */
export interface StudioAssignment {
    /**
     * The ID of the studio that this assignment applies to.
     */
    studioId: string;

    /**
     * The ID of the user that this assignment applies to.
     */
    userId: string;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The role that this user has in the studio.
     */
    role: StudioAssignmentRole;
}

export interface ListedStudioAssignment {
    /**
     * The ID of the studio that this assignment applies to.
     */
    studioId: string;

    /**
     * The ID of the user that this assignment applies to.
     */
    userId: string;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The role that this user has in the studio.
     */
    role: StudioAssignmentRole;

    /**
     * The user that this assignment applies to.
     */
    user: ListedStudioAssignmentUser;
}

export interface ListedUserAssignment {
    /**
     * The name of the studio that this assignment applies to.
     */
    displayName: string;

    /**
     * The ID of the studio that this assignment applies to.
     */
    studioId: string;

    /**
     * The ID of the user that this assignment applies to.
     */
    userId: string;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The role that this user has in the studio.
     */
    role: StudioAssignmentRole;
}

/**
 * The user information for a listed studio assignment.
 */
export interface ListedStudioAssignmentUser {
    /**
     * The ID of the user.
     */
    id: string;

    /**
     * The name of the user.
     */
    name: string;

    /**
     * The email address of the user.
     */
    email: string;

    /**
     * The phone number of the user.
     */
    phoneNumber: string;
}

/**
 * Defines an interface that represents a studio that a user has access to.
 */
export interface StoreListedStudio {
    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The name of the studio.
     */
    displayName: string;

    /**
     * The URL of the logo for the studio.
     */
    logoUrl: string;

    /**
     * The role that the user has in the studio.
     */
    role: StudioAssignmentRole;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The ID of the studio's subscription.
     */
    subscriptionId: string;

    /**
     * The current subscription status for this studio.
     */
    subscriptionStatus: string;

    /**
     * The comId of the studio.
     */
    comId: string | null;

    /**
     * The comId of the studio that owns this studio.
     */
    ownerStudioComId: string | null;
}

export interface ListStudioAssignmentFilters {
    /**
     * The ID of the user to filter by.
     */
    userId?: string;

    /**
     * The role to filter by.
     */
    role?: string;

    /**
     * Whether to filter by primary contact.
     */
    isPrimaryContact?: boolean;
}

/**
 * Defines a type that represents the different kinds of policies that a record key can have.
 *
 * - null and "subjectfull" indicate that actions performed with this key must require a subject to provide their access token in order for operations to succeed.
 * - "subjectless" indicates that actions may be performed with key despite not having an access key from a subject.
 */
export type PublicRecordKeyPolicy = null | 'subjectfull' | 'subjectless';

/**
 * Defines an interface for record key objects.
 */
export interface RecordKey {
    /**
     * The name of the record that the key is for.
     */
    recordName: string;

    /**
     * The scrypt hash of the secret that this key is for.
     */
    secretHash: string;

    /**
     * The policy that the key uses.
     */
    policy: PublicRecordKeyPolicy;

    /**
     * The ID of the user that created this key.
     */
    creatorId: string;
}
