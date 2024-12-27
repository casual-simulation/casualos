import {
    Entitlement,
    GenericHttpRequest,
    KnownErrorCodes,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../../crud';
import { SubscriptionFilter } from '../../MetricsStore';
import {
    CrudResult,
    GetSubCrudItemResult,
    SubCrudRecord,
    SubCrudRecordsStore,
} from '../../crud/sub/SubCrudRecordsStore';
import { parseVersionNumber } from '../../Utils';

/**
 * Defines a store that contains notification records.
 */
export interface PackageVersionRecordsStore
    extends SubCrudRecordsStore<PackageRecordVersionKey, PackageRecordVersion> {
    /**
     * Reads the item with the given address. Always returns an object with the item and any markers that are related to the item.
     * @param recordName The name of the record that the item lives in.
     * @param address The address of the record item.
     * @param key The key of the item to read.
     */
    getItemByKey(
        recordName: string,
        address: string,
        key: PackageRecordVersionKey
    ): Promise<GetPackageVersionByKeyResult>;

    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageVersionSubscriptionMetrics>;

    /**
     * Gets the list of reviews for the given package version.
     *
     * @param recordName The name of the record.
     * @param address The address of the package.
     * @param version The version.
     */
    listReviewsForVersion(
        recordName: string,
        address: string,
        version: PackageRecordVersionKey
    ): Promise<PackageVersionReview[]>;

    /**
     * Creates or updates a review for a package version.
     * @param review The review to create or update.
     */
    putReviewForVersion(review: PackageVersionReview): Promise<CrudResult>;

    /**
     * Updates the given package version review with the given review status and comments.
     * @param id The ID of the review.
     * @param reviewStatus The new review status.
     * @param comments The new comments.
     */
    updatePackageVersionReviewStatus(
        id: string,
        reviewStatus: PackageVersionReview['reviewStatus'],
        comments: string
    ): Promise<CrudResult>;

    /**
     * Gets a review for a package version by its ID.
     * Returns null if the review does not exist.
     * @param id The ID of the review.
     */
    getPackageVersionReviewById(
        id: string
    ): Promise<PackageVersionReview | null>;

    /**
     * Gets the most recent review for the given package version.
     * Returns null if there are no reviews for the package version.
     *
     * @param recordName The name of the record.
     * @param address The address of the package.
     * @param version The version of the package.
     */
    getMostRecentPackageVersionReview(
        recordName: string,
        address: string,
        version: PackageRecordVersionKey
    ): Promise<PackageVersionReview | null>;

    /**
     * Gets the list of entitlements for the given package IDs, feature, and userId.
     *
     * This returns a list of entitlements that are for the given packages and feature, and granted by the given user.
     * If the entitlement has not been granted, then the fields that are specific to granted entitlements will be null.
     *
     * @param packageIds The IDs of the packages to list the entitlements for.
     * @param feature The feature that the entitlements are granted for.
     * @param userId The ID of the user that the entitlements are granted to.
     */
    listEntitlementsByFeatureAndUserId(
        packageIds: string[],
        feature: Entitlement['feature'],
        userId: string
    ): Promise<ListedPackageEntitlement[]>;

    /**
     * Saves the given granted entitlement.
     * @param grantedEntitlement The entitlement that should be saved.
     */
    saveGrantedPackageEntitlement(
        grantedEntitlement: GrantedPackageEntitlement
    ): Promise<void>;
}

/**
 * Defines an interface that represents an entitlement that has been granted to a package.
 */
export interface GrantedPackageEntitlement {
    /**
     * The ID of the entitlement.
     */
    id: string;

    /**
     * The ID of the user that granted the entitlement.
     */
    userId: string;

    /**
     * The ID of the package that the entitlement is granted for.
     */
    packageId: string;

    /**
     * The feature that was granted.
     */
    feature: Entitlement['feature'];

    /**
     * The scope of the feature.
     */
    scope: Entitlement['scope'];

    /**
     * The records that the entitlement requires access to based on its scope.
     * Empty if the entitlement does not require access to any records.
     */
    designatedRecords: string[];

    /**
     * The unix time that the entitlement expires in miliseconds.
     */
    expireTimeMs: number;

    /**
     * The unix time that the grant was created at in miliseconds.
     */
    createdAtMs: number;
}

/**
 * Defines an interface that represents an entitlement that has been granted to a package.
 */
export interface ListedPackageEntitlement {
    /**
     * The ID of the granted entitlement.
     * Null if the enetitlement has not been granted.
     */
    id: string | null;

    /**
     * Whether the entitlement has been granted.
     */
    granted: boolean;

    /**
     * The ID of the user that granted the entitlement.
     * Null if the entitlement has not been granted.
     */
    grantingUserId: string | null;

    /**
     * The ID of the package that the entitlement is granted for.
     */
    packageId: string;

    /**
     * The feature that was granted.
     */
    feature: Entitlement['feature'];

    /**
     * The scope of the feature.
     */
    scope: Entitlement['scope'];

    /**
     * The records that the entitlement requires access to based on its scope.
     * Empty if the entitlement does not require access to any records.
     */
    designatedRecords: string[];

    /**
     * The unix time that the entitlement expires in miliseconds.
     * Null if the entitlementhas not been granted.
     */
    expireTimeMs: number | null;

    /**
     * The unix time that the grant was created at in miliseconds.
     * Null if the entitlementhas not been granted.
     */
    createdAtMs: number | null;
}

export interface PackageRecordVersionKey extends PackageVersion {}

export interface PackageRecordVersion
    extends SubCrudRecord<PackageRecordVersionKey> {
    /**
     * The ID of the package version.
     */
    id: string;

    /**
     * The name of the aux file that is stored for this version.
     */
    auxFileName: string;

    /**
     * Whether the aux file was created for this version.
     */
    createdFile: boolean;

    /**
     * The SHA-256 hash of the package version.
     */
    sha256: string;

    /**
     * The SHA-256 hash of the aux.
     */
    auxSha256: string;

    /**
     * The list of entitlements that the package requires.
     */
    entitlements: Entitlement[];

    /**
     * Whether the package version requires review.
     * Packages that do not require review are automatically approved and cannot have entitlements that require review.
     */
    requiresReview: boolean;

    /**
     * The readme of the package.
     */
    readme: string;

    /**
     * The size of the package version in bytes.
     */
    sizeInBytes: number;

    /**
     * The unix time in miliseconds that this package version was created at.
     */
    createdAtMs: number;
}

export interface PackageRecordVersionWithMetadata extends PackageRecordVersion {
    /**
     * The ID of the package that the version is stored under.
     */
    packageId: string;

    /**
     * Whether the package version has been approved.
     * If true, then the package either has been manually approved or does not require approval.
     */
    approved: boolean;

    /**
     * The type of approval that was given to the package.
     *
     * - null means that the package has not been approved.
     * - "normal" means that the package was approved by the reviewer, but that individual permissions still need to be approved by the user.
     * - "super" means that the package was approved by the reviewer and that individual permissions will not need to be approved by the user.
     */
    approvalType: null | 'normal' | 'super';
}

export interface ListedPackageVersion {
    /**
     * The name of the record that the package versions are stored in.
     */
    recordName: string;

    /**
     * The address of the package that the versions are stored under.
     */
    address: string;

    /**
     * The version of the package.
     */
    version: PackageVersion;

    /**
     * The SHA-256 hash of the package version.
     */
    sha256: string;

    /**
     * The SHA-256 hash of the aux.
     */
    auxSha256: string;

    /**
     * The SHA-256 of the scripts that are stored in the aux.
     */
    scriptSha256: string;

    /**
     * The list of entitlements that the package requires.
     */
    entitlements: string[];

    /**
     * The size of the version in bytes.
     */
    sizeInBytes: number;

    /**
     * The unix time in miliseconds that this version was created at.
     */
    createdAtMs: number;
}

/**
 * Creates a new package version.
 * @param major The major version of the package.
 * @param minor The minor version of the package.
 * @param patch The patch version of the package.
 * @param tag The tag.
 */
export function version(
    major: number,
    minor: number = 0,
    patch: number = 0,
    tag: string = ''
): PackageVersion {
    return {
        major,
        minor,
        patch,
        tag,
    };
}

export interface PackageVersion {
    /**
     * The major version of the package.
     */
    major: number;

    /**
     * The minor version of the package.
     */
    minor: number;

    /**
     * The patch version of the package.
     */
    patch: number;

    /**
     * The pre-release version of the package.
     * If empty or null, then this is a stable release.
     */
    tag: string | null;
}

export interface PackageVersionSubscriptionMetrics
    extends CrudSubscriptionMetrics {
    /**
     * The total number of package versions stored in the subscription.
     */
    totalItems: number;

    /**
     * The total number of bytes stored in package versions in the subscription.
     */
    totalPackageVersionBytes: number;
}

/**
 * Defines an interface that represents a review of a package version.
 */
export interface PackageVersionReview {
    /**
     * The ID of the review.
     */
    id: string;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The address of the package.
     */
    address: string;

    /**
     * The key of the package version.
     */
    key: PackageRecordVersionKey;

    /**
     * Whether the package version has been approved.
     */
    approved: boolean;

    /**
     * The type of approval that was given to the package.
     *
     * - null means that the package has not been approved.
     * - "normal" means that the package was approved by the reviewer, but that individual permissions still need to be approved by the user.
     * - "super" means that the package was approved by the reviewer and that individual permissions will not need to be approved by the user.
     */
    approvalType: null | 'normal' | 'super';

    /**
     * The status of the review.
     *
     * - "pending" means that the review is in progress.
     * - "approved" means that the review has been completed and the package version is approved.
     * - "rejected" means that the review has been completed and the package version is rejected.
     */
    reviewStatus: 'pending' | 'approved' | 'rejected';

    /**
     * The comments that were left by the reviewer.
     */
    reviewComments: string;

    /**
     * The ID of the user that reviewed the package version.
     */
    reviewingUserId: string;

    /**
     * The unix time in miliseconds that the review was created.
     */
    createdAtMs: number;

    /**
     * The unix time in miliseconds that the review was updated.
     */
    updatedAtMs: number;
}

export interface GetPackageVersionByKeyResult
    extends GetSubCrudItemResult<PackageRecordVersion> {
    /**
     * The ID of the package that the version is stored under.
     */
    packageId: string;
}

export function getPackageVersionKey(
    key: string,
    major: number | null,
    minor: number,
    patch: number,
    tag: string
): GetPackageVersionKeyResult {
    if (key && major) {
        return {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage:
                'You cannot provide both key and major version number.',
        };
    } else if (key) {
        const parsed = parseVersionNumber(key);
        if (typeof parsed.major === 'number') {
            major = parsed.major;
            minor = parsed.minor;
            patch = parsed.patch;
            tag = parsed.tag ?? '';
        }
    }

    if (typeof major !== 'number') {
        return {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage: 'major version is required and must be a number.',
        };
    }

    return {
        success: true,
        key: {
            major,
            minor,
            patch,
            tag,
        },
    };
}

export type GetPackageVersionKeyResult =
    | GetPackageRecordKeySuccess
    | GetPackageRecordKeyFailure;

export interface GetPackageRecordKeySuccess {
    success: true;
    key: PackageRecordVersionKey;
}

export interface GetPackageRecordKeyFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}
