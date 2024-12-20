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
} from '../PolicyController';
import {
    CheckSubscriptionMetricsResult,
    CrudRecordsConfiguration,
    CrudRecordsController,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
} from '../crud';
import {
    PackageRecordsStore,
    PackageRecord,
    PackageSubscriptionMetrics,
} from './PackageRecordsStore';
import {
    getNotificationFeatures,
    getPackageFeatures,
    NotificationFeaturesConfiguration,
    PackageFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { v7 as uuid } from 'uuid';

const TRACE_NAME = 'PackageRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<PackageRecord, PackageRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

export type PackageRecordInput = Omit<PackageRecord, 'id'>;

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageRecordsController extends CrudRecordsController<
    PackageRecordInput,
    PackageRecordsStore
> {
    constructor(config: PackageRecordsConfiguration) {
        super({
            ...config,
            name: 'PackageRecordsController',
            resourceKind: 'package',
        });
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: PackageRecord
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

            item.id = uuid();
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
    metrics: PackageSubscriptionMetrics;
    features: PackageFeaturesConfiguration;
}
