import {
    ActionKinds,
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
} from '../../crud';
import {
    PackageRecordVersion,
    PackageRecordVersionKey,
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
    SubCrudRecordsConfiguration,
    SubCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsController';
import { PackageRecordsStore } from '../PackageRecordsStore';

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
    PackageRecordVersion,
    PackageVersionRecordsStore,
    PackageRecordsStore
> {
    constructor(config: PackageVersionRecordsConfiguration) {
        super({
            ...config,
            name: 'PackageVersionRecordsController',
            resourceKind: 'package.version',
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: PackageRecordVersion
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

export type PackageRecordsSubscriptionMetricsResult =
    | PackageRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface PackageRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: PackageVersionSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
