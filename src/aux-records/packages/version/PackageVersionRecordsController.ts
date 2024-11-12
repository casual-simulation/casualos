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

const TRACE_NAME = 'PackageVersionRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageVersionRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<
            PackageRecordVersion,
            PackageVersionRecordsStore
        >,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageVersionRecordsController extends CrudRecordsController<
    PackageRecordVersion,
    PackageVersionRecordsStore
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

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of package items has been reached for your subscription.',
                };
            }
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
