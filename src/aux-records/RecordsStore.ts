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
import type { ComIdConfig, ComIdPlayerConfig } from './ComIdConfig';
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common';
import type {
    StripeAccountStatus,
    StripeRequirementsStatus,
} from './StripeInterface';
import type { WebManifest } from '@casual-simulation/aux-common/common/WebManifest';

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
     * Returns only studios that are not owned by any comId.
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
     * Gets the number of studios that are owned by the given comId.
     * @param comId The comId.
     */
    countStudiosInComId(comId: string): Promise<number>;

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

    /**
     * Saves the given comId request.
     * @param request The request.
     */
    saveComIdRequest(request: StudioComIdRequest): Promise<void>;

    /**
     * Gets the loom config for the studio with the given ID.
     * Returns null if the studio does not have a loom config.
     * @param studioId The ID of the studio.
     */
    getStudioLoomConfig(studioId: string): Promise<LoomConfig | null>;

    /**
     * Updates the loom config for the studio with the given ID.
     * @param studioId The ID of the studio that should be updated.
     * @param config The config that should be updated for the studio.
     */
    updateStudioLoomConfig(studioId: string, config: LoomConfig): Promise<void>;

    /**
     * Gets the hume config for the studio with the given ID.
     * Returns null if the studio does not have a hume config.
     * @param studioId The ID of the studio.
     */
    getStudioHumeConfig(studioId: string): Promise<HumeConfig | null>;

    /**
     * Updates the hume config for the studio with the given ID.
     * @param studioId The ID of the studio that should be updated.
     * @param config The config that should be updated for the studio.
     */
    updateStudioHumeConfig(studioId: string, config: HumeConfig): Promise<void>;

    /**
     * Gets the studio with the given stripe account ID. Returns null if no studio has that stripe account ID.
     * @param accountId The ID of the stripe account.
     */
    getStudioByStripeAccountId(accountId: string): Promise<Studio | null>;

    /**
     * Saves the given custom domain to the store.
     * @param domain The custom domain to save.
     */
    saveCustomDomain(domain: CustomDomain): Promise<void>;

    /**
     * Removes the custom domain with the given ID from the store.
     * @param domainId The ID of the custom domain to remove.
     */
    deleteCustomDomain(domainId: string): Promise<void>;

    /**
     * Gets the custom domain with the given ID.
     * @param domainId The ID of the custom domain.
     */
    getCustomDomainById(
        domainId: string
    ): Promise<CustomDomainWithStudio | null>;

    /**
     * Gets the list of custom domains for the given studio ID.
     * @param studioId The ID of the studio.
     */
    listCustomDomainsByStudioId(studioId: string): Promise<CustomDomain[]>;

    /**
     * Gets the verified custom domain with the given domain name.
     * Returns null if no verified custom domain with the given name exists.
     *
     * @param domainName The domain name.
     */
    getVerifiedCustomDomainByName(
        domainName: string
    ): Promise<CustomDomainWithStudio | null>;

    /**
     * Marks the custom domain with the given ID as verified.
     * @param domainId The ID of the custom domain to mark as verified.
     */
    markCustomDomainAsVerified(domainId: string): Promise<void>;
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
     * The ID of the stripe account for this studio.
     */
    stripeAccountId?: string | null;

    /**
     * The status of the stripe account requirements for this studio.
     *
     * If null, then the studio does not have a stripe account.
     * If 'incomplete', then the studio has a stripe account but it is not fully set up.
     * If 'complete', then the studio has a stripe account that is fully set up.
     */
    stripeAccountRequirementsStatus?: StripeRequirementsStatus;

    /**
     * The status of the stripe account that is associated with this studio.
     *
     * If null, then the studio does not have a stripe account.
     * If 'active', then the stripe account has been approved and is active.
     * If 'pending', then the stripe account is waiting approval.
     * If 'rejected', then the stripe account was rejected.
     * If 'disabled', then the stripe account was disabled but not because it was rejected.
     */
    stripeAccountStatus?: StripeAccountStatus;

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
    playerConfig?: ComIdPlayerConfig;

    /**
     * The PWA web manifest that should be served for the player.
     */
    playerWebManifest?: WebManifest;

    /**
     * The config for comId features.
     */
    comIdConfig?: ComIdConfig;
}

export type LoomConfig = z.infer<typeof LOOM_CONFIG>;

export const LOOM_CONFIG = z.object({
    appId: z.string().max(100).describe('The ID of the loom app.'),
    privateKey: z
        .string()
        .max(100)
        .describe('The private key for the loom app.'),
});

export const HUME_CONFIG = z.object({
    apiKey: z.string().max(100).describe('The API key for the Hume service.'),
    secretKey: z
        .string()
        .max(100)
        .describe('The secret key for the Hume service.'),
});

export type HumeConfig = z.infer<typeof HUME_CONFIG>;

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

    /**
     * The ID of the privo service that the user is associated with.
     */
    privoServiceId: string | null;
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

/**
 * Defines an interface that represents a request for a comId to be applied to a studio.
 */
export interface StudioComIdRequest {
    /**
     * The ID of the request.
     */
    id: string;

    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The ID of the user that is making the request.
     * Null if the user has been deleted.
     */
    userId: string;

    /**
     * The comId that is being requested.
     */
    requestedComId: string;

    /**
     * The IP Address that the request came from.
     */
    requestingIpAddress: string;

    /**
     * The unix timestamp in miliseconds when the request was created.
     */
    createdAtMs: number;

    /**
     * The unix timestamp in miliseconds when the request was last updated.
     */
    updatedAtMs: number;
}

/**
 * Represents a custom domain that is associated with a studio.
 *
 * These domains may or may not be verified.
 */
export interface CustomDomain {
    /**
     * The ID of the custom domain.
     */
    id: string;

    /**
     * The domain name.
     */
    domainName: string;

    /**
     * The ID of the studio that the custom domain is associated with.
     */
    studioId: string;

    /**
     * The HMAC-SHA-256 verification key.
     */
    verificationKey: string;

    /**
     * Whether the custom domain has been verified.
     * Null if not verified.
     */
    verified: true | null;
}

export type ListedCustomDomain = Pick<
    CustomDomain,
    'id' | 'domainName' | 'verified'
>;

export interface CustomDomainWithStudio extends CustomDomain {
    studio: Studio;
}
