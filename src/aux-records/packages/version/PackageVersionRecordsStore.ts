import {
    Entitlement,
    GenericHttpRequest,
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
    SubCrudRecord,
    SubCrudRecordsStore,
} from '../../crud/sub/SubCrudRecordsStore';

/**
 * Defines a store that contains notification records.
 */
export interface PackageVersionRecordsStore
    extends SubCrudRecordsStore<PackageRecordVersionKey, PackageRecordVersion> {
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
}

export interface PackageRecordVersionKey extends PackageVersion {}

export interface PackageRecordVersion
    extends SubCrudRecord<PackageRecordVersionKey> {
    /**
     * The name of the aux file that is stored for this version.
     */
    auxFileName: string;

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
     * Whether the package version has been approved.
     * If true, then the package either has been manually approved or does not require approval.
     */
    approved: boolean;
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
