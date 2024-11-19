import {
    ActionKinds,
    Entitlement,
    KnownErrorCodes,
    PRIVATE_MARKER,
    ServerError,
} from '@casual-simulation/aux-common';
import {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeSubjectFailure,
} from '../../PolicyController';
import {
    CheckSubscriptionMetricsResult,
    CrudRecordsConfiguration,
    CrudRecordsController,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
    CrudGetItemResult,
} from '../../crud';
import {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionWithMetadata,
    PackageVersionRecordsStore,
    PackageVersionSubscriptionMetrics,
} from './PackageVersionRecordsStore';
import {
    getNotificationFeatures,
    getPackageFeatures,
    NotificationFeaturesConfiguration,
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../../SubscriptionConfiguration';
import {
    SubCrudGetItemRequest,
    SubCrudRecordsConfiguration,
    SubCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsController';
import { PackageRecordsStore } from '../PackageRecordsStore';
import { getHash } from '@casual-simulation/crypto';
import { sha256 } from 'hash.js';

const TRACE_NAME = 'PackageVersionRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageVersionRecordsConfiguration
    extends Omit<
        SubCrudRecordsConfiguration<
            PackageRecordVersionKey,
            PackageRecordVersion,
            PackageVersionRecordsStore,
            PackageRecordsStore
        >,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageVersionRecordsController extends SubCrudRecordsController<
    PackageRecordVersionKey,
    PackageRecordVersionInput,
    PackageVersionRecordsStore,
    PackageRecordsStore,
    PackageRecordVersionWithMetadata
> {
    constructor(config: PackageVersionRecordsConfiguration) {
        super({
            ...config,
            name: 'PackageVersionRecordsController',
            resourceKind: 'package.version',
        });
    }

    async getItem(
        request: SubCrudGetItemRequest<PackageRecordVersionKey>
    ): Promise<CrudGetItemResult<PackageRecordVersionWithMetadata>> {
        const result = await super.getItem(request);

        if (result.success === true) {
            const item = result.item;

            if (item.entitlements.some((e) => entitlementRequiresApproval(e))) {
                item.approved = false;
            } else {
                item.approved = true;
            }
        }

        return result;
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: PackageRecordVersionWithMetadata
    ): Promise<PackageRecordsSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getPackageFeatures(
            config,
            metrics.subscriptionStatus,
            metrics.subscriptionId,
            metrics.subscriptionType,
            metrics.currentPeriodStartMs,
            metrics.currentPeriodEndMs
        );

        if (!features.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Packages are not allowed for this subscription.',
            };
        }

        if (action === 'create') {
            const auxHash = getHash(item.aux);

            if (item.auxSha256 !== auxHash) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The aux hash does not match the aux.',
                };
            }

            item.createdAtMs = Date.now();
            item.sha256 = getHash({
                auxSha256: item.auxSha256,
                createdAtMs: item.createdAtMs,
                entitlements: item.entitlements,
                readme: item.readme,
                sizeInBytes: item.sizeInBytes,
            });

            if (typeof features.maxPackageVersions === 'number') {
                if (metrics.totalItems >= features.maxPackageVersions) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum number of package versions has been reached for your subscription.',
                    };
                }
            }

            if (
                typeof features.maxPackageVersionSizeInBytes === 'number' &&
                item.sizeInBytes >= features.maxPackageVersionSizeInBytes
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The package version is too large for your subscription.',
                };
            }

            if (
                action === 'create' &&
                typeof features.maxPackageBytesTotal === 'number'
            ) {
                if (
                    metrics.totalPackageVersionBytes + item.sizeInBytes >=
                    features.maxPackageBytesTotal
                ) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum size of package versions has been reached for your subscription.',
                    };
                }
            }
        } else if (action === 'update') {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Updating package versions is not supported.',
            };
        }

        return {
            success: true,
            config,
            metrics,
            features,
        };
    }
}

/**
 * Determines whether the given entitlement requires approval.
 * @param entitlement The entitlement to test.
 */
export function entitlementRequiresApproval(entitlement: Entitlement): boolean {
    return entitlement.scope === 'shared' || entitlement.scope === 'designated';
}

export type PackageRecordVersionInput = Omit<
    PackageRecordVersion,
    'createdAtMs' | 'sha256' | 'sizeInBytes'
>;

export type PackageRecordsSubscriptionMetricsResult =
    | PackageRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface PackageRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: PackageVersionSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
