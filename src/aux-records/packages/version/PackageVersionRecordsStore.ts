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
import type {
    Entitlement,
    KnownErrorCodes,
} from '@casual-simulation/aux-common';

import type { CrudSubscriptionMetrics } from '../../crud';
import type { SubscriptionFilter } from '../../MetricsStore';
import type {
    CrudResult,
    GetSubCrudItemResult,
    SubCrudRecord,
    SubCrudRecordsStore,
} from '../../crud/sub/SubCrudRecordsStore';
import { parseVersionNumber } from '@casual-simulation/aux-common';

/**
 * Defines a store that contains notification records.
 */
export interface PackageVersionRecordsStore
    extends SubCrudRecordsStore<PackageRecordVersionKey, PackageRecordVersion> {
    /**
     * Reads the item with the given address and key. Always returns an object with the item and any markers that are related to the item.
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
     * Gets the package version that most closely matches the given specifier.
     * Always returns an object with the item and any markers that are related to the item.
     * @param recordName The name of the record.
     * @param address The address of the item.
     * @param specifier The specifier to use to find the item.
     */
    getItemBySpecifier(
        recordName: string,
        address: string,
        specifier: PackageRecordVersionKeySpecifier
    ): Promise<GetPackageVersionByKeyResult>;

    /**
     * Reads the item with the given ID.
     * @param id The ID of the item.
     */
    getItemById(id: string): Promise<GetPackageVersionByKeyResult>;

    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PackageVersionSubscriptionMetrics>;

    // /**
    //  * Gets the list of reviews for the given package version.
    //  *
    //  * @param recordName The name of the record.
    //  * @param address The address of the package.
    //  * @param version The version.
    //  */
    // listReviewsForVersion(
    //     packageVersionId: string,
    // ): Promise<PackageVersionReview[]>;

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
     * @param packageVersionId The ID of the package version.
     */
    getMostRecentPackageVersionReview(
        packageVersionId: string
    ): Promise<PackageVersionReview | null>;
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
     * The description of the package.
     */
    description: string;

    /**
     * The size of the package version in bytes.
     */
    sizeInBytes: number;

    /**
     * The unix time in miliseconds that this package version was created at.
     */
    createdAtMs: number;

    /**
     * The markers for the package version.
     */
    markers: string[];
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
     * The ID of the package version that was reviewed.
     */
    packageVersionId: string;

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
     * The name of the record that the package version is stored in.
     * Null if the package was not found.
     */
    recordName: string | null;

    /**
     * The ID of the package that the version is stored under.
     * Null if the package was not found.
     */
    packageId: string | null;
}

export function getPackageVersionKey(
    key: string | null,
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

export function getPackageVersionSpecifier(
    key: string | null,
    major: number | null,
    minor: number | null,
    patch: number | null,
    tag: string | null,
    sha256: string | null
): GetPackageVersionSpecifierResult {
    if (sha256 && key) {
        return {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage:
                'You cannot provide both key and sha256 version number.',
        };
    } else if (sha256 && major) {
        return {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage:
                'You cannot provide both major version number and sha256.',
        };
    } else if (key && major) {
        return {
            success: false,
            errorCode: 'unacceptable_request',
            errorMessage:
                'You cannot provide both key and major version number.',
        };
    } else if (sha256) {
        return {
            success: true,
            key: {
                sha256,
            },
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

    return {
        success: true,
        key: {
            major: major ?? undefined,
            minor: minor ?? undefined,
            patch: patch ?? undefined,
            tag: tag ?? undefined,
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

export type GetPackageVersionSpecifierResult =
    | GetPackageVersionSpecifierSuccess
    | GetPackageVersionSpecifierFailure;

export interface GetPackageVersionSpecifierSuccess {
    success: true;
    key: PackageRecordVersionKeySpecifier;
}

export interface GetPackageVersionSpecifierFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

/**
 * Defines an interface that represents a package specifier.
 * That is, a way to identify a package version that is stored in a record.
 */
export interface PackageVersionSpecifier {
    /**
     * The name of the record that the package should be loaded from.
     */
    recordName: string;

    /**
     * The address of the package to load.
     */
    address: string;

    /**
     * The version to load.
     * If not specified, then the latest version will be installed.
     */
    key?: PackageRecordVersionKeySpecifier;
}

/**
 * Defines an interface that represents a package version key specifier.
 * That is, a way to identify a package version by its key.
 */
export interface PackageRecordVersionKeySpecifier {
    /**
     * The major number of the version to load.
     * If omitted, then the latest major version will be loaded.
     */
    major?: number;

    /**
     * The minor number of the version to load.
     * If not specifed, then the latest minor version will be loaded.
     */
    minor?: number;

    /**
     * The patch number of the version to load.
     * If not specified, then the latest patch version will be loaded.
     */
    patch?: number;

    /**
     * The tag of the version to load.
     * If not specified, then the untagged version will be loaded.
     */
    tag?: string | null;

    /**
     * The SHA-256 hash of the version to load.
     * If not specified, then the SHA-256 will not be checked.
     * If specified, then the SHA-256 will be checked against the version that is loaded.
     */
    sha256?: string | null;
}

/**
 * Formats the given version specifier into a string.
 * @param specifier The specifier to format.
 */
export function formatVersionSpecifier(
    specifier: PackageRecordVersionKeySpecifier
): string {
    if (specifier.sha256) {
        return specifier.sha256;
    }
    if (typeof specifier.tag === 'string' && specifier.tag.length > 0) {
        return `${specifier.major}.${specifier.minor}.${specifier.patch}-${specifier.tag}`;
    } else if (typeof specifier.patch === 'number') {
        return `${specifier.major}.${specifier.minor}.${specifier.patch}`;
    } else if (typeof specifier.minor === 'number') {
        return `${specifier.major}.${specifier.minor}.x`;
    } else if (typeof specifier.major === 'number') {
        return `${specifier.major}.x.x`;
    } else {
        return 'latest';
    }
}
