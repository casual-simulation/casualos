import {
    GenericHttpRequest,
    ServerError,
    StoredAux,
} from '@casual-simulation/aux-common';
import { CrudRecord, CrudRecordsStore, CrudSubscriptionMetrics } from '../crud';
import { SubscriptionFilter } from '../MetricsStore';

/**
 * Defines a store that contains notification records.
 */
export interface PackageRecordsStore extends CrudRecordsStore<PackageRecord> {
    /**
     * Adds the given package version to the store.
     * @param version The version of the package to save.
     */
    addPackageVersion(version: PackageRecordVersion): Promise<void>;

    /**
     * Gets the list of package versions for the given record name and address.
     * The resulting list will be sorted by the version in descending order.
     * @param recordName The name of the record.
     * @param address The address of the package.
     */
    listPackageVersions(
        recordName: string,
        address: string
    ): Promise<ListedPackageVersion[]>;

    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageSubscriptionMetrics>;
}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 *
 * @dochash types/records/packages
 * @docName PackageRecord
 */
export interface PackageRecord extends CrudRecord {
    // /**
    //  * The description of the package.
    //  */
    // description: string | null;
}

export interface PackageRecordVersion {
    /**
     * The name of the record that this package version is stored in.
     */
    recordName: string;

    /**
     * The address of the package that this version is stored under.
     */
    address: string;

    /**
     * The version of the package.
     */
    version: PackageVersion;

    /**
     * The aux that is recorded in the version.
     */
    aux: StoredAux;

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

export interface PackageSubscriptionMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of packages stored in the subscription.
     */
    totalItems: number;

    /**
     * The total number of package versions stored in the subscription.
     */
    totalPackageVersions: number;

    /**
     * The total number of bytes stored in package versions in the subscription.
     */
    totalPackageVersionBytes: number;
}
