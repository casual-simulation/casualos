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
    NotificationAction,
    NotificationActionUI,
    NotificationRecord,
    PackageRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    SentPushNotification,
    UserPushSubscription,
} from './PackageRecordsStore';
import {
    getNotificationFeatures,
    NotificationFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { v7 as uuidv7, v5 as uuidv5 } from 'uuid';

const TRACE_NAME = 'PackageRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface PackageRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<NotificationRecord, PackageRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class PackageRecordsController extends CrudRecordsController<
    NotificationRecord,
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
        item?: NotificationRecord
    ): Promise<CheckSubscriptionMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getNotificationFeatures(
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
                errorMessage:
                    'Notifications are not allowed for this subscription.',
            };
        }

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of notification items has been reached for your subscription.',
                };
            }
        }

        if (
            action === 'subscribe' &&
            typeof features.maxSubscribersPerItem === 'number'
        ) {
            const totalSubscriptions =
                await this.store.countSubscriptionsForNotification(
                    context.recordName,
                    item.address
                );
            if (totalSubscriptions >= features.maxSubscribersPerItem) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of subscriptions has been reached for this notification.',
                };
            }
        }

        if (action === 'send') {
            if (
                typeof features.maxSentNotificationsPerPeriod === 'number' &&
                metrics.totalSentNotificationsInPeriod >=
                    features.maxSentNotificationsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of sent notifications has been reached for this period.',
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
