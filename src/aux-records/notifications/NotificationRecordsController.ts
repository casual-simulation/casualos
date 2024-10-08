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
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    SentNotificationUser,
} from './NotificationRecordsStore';
import {
    getNotificationFeatures,
    NotificationFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { v7 as uuidv7 } from 'uuid';
import {
    PushNotificationPayload,
    PushSubscriptionType,
    SendPushNotificationResult,
    WebPushInterface,
} from './WebPushInterface';

const TRACE_NAME = 'NotificationRecordsController';

/**
 * Defines the configuration for a webhook records controller.
 */
export interface NotificationRecordsConfiguration
    extends Omit<
        CrudRecordsConfiguration<NotificationRecord, NotificationRecordsStore>,
        'resourceKind' | 'allowRecordKeys' | 'name'
    > {
    /**
     * The interface that should be used to send push notifications.
     */
    pushInterface: WebPushInterface;
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class NotificationRecordsController extends CrudRecordsController<
    NotificationRecord,
    NotificationRecordsStore
> {
    private _pushInterface: WebPushInterface;

    constructor(config: NotificationRecordsConfiguration) {
        super({
            ...config,
            name: 'NotificationRecordsController',
            resourceKind: 'notification',
        });
        this._pushInterface = config.pushInterface;
    }

    @traced(TRACE_NAME)
    async getApplicationServerKey(): Promise<GetApplicationServerKeyResult> {
        try {
            const key = this._pushInterface.getServerApplicationKey();
            return {
                success: true,
                key,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async subscribeToNotification(
        request: SubscribeToNotificationRequest
    ): Promise<SubscribeToNotificationResult> {
        try {
            const context = await this.policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: request.recordName,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const userId = context.context.userId;
            const notification = await this.store.getItemByAddress(
                recordName,
                request.address
            );

            if (!notification) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'Notification not found.',
                };
            }

            const authorization = await this.policies.authorizeUserAndInstances(
                context.context,
                {
                    action: 'subscribe',
                    resourceKind: 'notification',
                    resourceId: notification.address,
                    markers: notification.markers,
                    userId: userId,
                    instances: request.instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const metrics = await this._checkSubscriptionMetrics(
                'subscribe',
                context.context,
                authorization,
                notification
            );

            if (metrics.success === false) {
                return metrics;
            }

            const subscriptionId = uuidv7();
            await this.store.saveSubscription({
                id: subscriptionId,
                recordName,
                notificationAddress: notification.address,
                pushSubscription: request.pushSubscription,
                userId: userId,
                active: true,
            });

            return {
                success: true,
                subscriptionId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async unsubscribeFromNotification(
        request: UnsubscribeToNotificationRequest
    ): Promise<UnsubscribeToNotificationResult> {
        try {
            const subscription = await this.store.getSubscriptionById(
                request.subscriptionId
            );
            if (!subscription) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'Subscription not found.',
                };
            }

            const context = await this.policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: subscription.recordName,
            });

            if (context.success === false) {
                return context;
            }

            let successfulAuthorization = false;
            if (subscription.userId) {
                const userContext =
                    await this.policies.constructAuthorizationContext({
                        userId: request.userId,
                        recordKeyOrRecordName: subscription.userId,
                    });

                if (userContext.success === true) {
                    const userAuthorization =
                        await this.policies.authorizeUserAndInstances(
                            userContext.context,
                            {
                                userId: request.userId,
                                action: 'unsubscribe',
                                resourceKind: 'notification',
                                resourceId: subscription.id,
                                instances: request.instances,
                                markers: [PRIVATE_MARKER],
                            }
                        );

                    if (userAuthorization.success === true) {
                        successfulAuthorization = true;
                    }
                }
            }

            const userId = context.context.userId;
            const recordName = context.context.recordName;
            if (!successfulAuthorization) {
                const notification = await this.store.getItemByAddress(
                    recordName,
                    subscription.notificationAddress
                );

                if (!notification) {
                    return {
                        success: false,
                        errorCode: 'data_not_found',
                        errorMessage: 'Notification not found.',
                    };
                }

                const authorization =
                    await this.policies.authorizeUserAndInstances(
                        context.context,
                        {
                            userId,
                            action: 'unsubscribe',
                            resourceKind: 'notification',
                            resourceId: notification.address,
                            instances: request.instances,
                            markers: notification.markers,
                        }
                    );

                if (authorization.success === false) {
                    return authorization;
                }
            }

            // allowed
            await this.store.markSubscriptionsInactive([
                request.subscriptionId,
            ]);
            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async sendNotification(
        request: SendNotificationRequest
    ): Promise<SendNotificationResult> {
        try {
            const context = await this.policies.constructAuthorizationContext({
                userId: request.userId,
                recordKeyOrRecordName: request.recordName,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const userId = context.context.userId;

            const notification = await this.store.getItemByAddress(
                recordName,
                request.address
            );

            if (!notification) {
                return {
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: 'Notification not found.',
                };
            }

            const authorization = await this.policies.authorizeUserAndInstances(
                context.context,
                {
                    action: 'send',
                    resourceKind: 'notification',
                    resourceId: notification.address,
                    markers: notification.markers,
                    userId: userId,
                    instances: request.instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const metrics = await this._checkSubscriptionMetrics(
                'send',
                context.context,
                authorization,
                notification
            );

            if (metrics.success === false) {
                return metrics;
            }

            const subscriptions =
                await this.store.listActiveSubscriptionsForNotification(
                    recordName,
                    notification.address
                );

            if (
                typeof metrics.features.maxSentPushNotificationsPerPeriod ===
                'number'
            ) {
                if (
                    metrics.metrics.totalSentNotificationsInPeriod +
                        subscriptions.length >=
                    metrics.features.maxSentPushNotificationsPerPeriod
                ) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The maximum number of sent push notifications has been reached for this period.',
                    };
                }
            }

            let promises = [] as Promise<
                [NotificationSubscription, SendPushNotificationResult]
            >[];

            const sentTimeMs = Date.now();
            for (let sub of subscriptions) {
                promises.push(
                    this._pushInterface
                        .sendNotification(
                            sub.pushSubscription,
                            request.payload,
                            request.topic
                        )
                        .then((result) => {
                            return [sub, result] as const;
                        })
                );
            }

            const results = await Promise.allSettled(promises);

            const notificationId = uuidv7();
            await this.store.saveSentNotification({
                id: notificationId,
                recordName,
                notificationAddress: notification.address,
                title: request.payload.title,
                body: request.payload.body,
                icon: request.payload.icon,
                badge: request.payload.badge,
                defaultAction: request.payload.action as NotificationAction,
                actions: request.payload.actions as NotificationActionUI[],
                silent: request.payload.silent,
                tag: request.payload.tag,
                timestamp: request.payload.timestamp,
                sentTimeMs: sentTimeMs,
            });

            let sentNotificationUsers = [] as SentNotificationUser[];
            let failedSubscriptions = [] as string[];

            for (let promiseResult of results) {
                if (promiseResult.status === 'rejected') {
                    console.error(
                        '[WebhookRecordsController] Error sending notification:',
                        promiseResult.reason
                    );
                } else {
                    const [sub, result] = promiseResult.value;

                    sentNotificationUsers.push({
                        sentNotificationId: notificationId,
                        userId: sub.userId,
                        subscriptionId: sub.id,
                        success: result.success,
                        errorCode:
                            result.success === false ? result.errorCode : null,
                    });

                    if (result.success === false) {
                        console.error(
                            `[WebhookRecordsController] Error sending notification for ${sub.id}:`,
                            result.errorCode
                        );

                        if (
                            result.errorCode === 'subscription_gone' ||
                            result.errorCode === 'subscription_not_found'
                        ) {
                            failedSubscriptions.push(sub.id);
                        }
                    }
                }
            }

            if (sentNotificationUsers.length > 0) {
                await this.store.saveSentNotificationUsers(
                    sentNotificationUsers
                );
            }

            if (failedSubscriptions.length > 0) {
                await this.store.markSubscriptionsInactive(failedSubscriptions);
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[WebhookRecordsController] Error sending notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: NotificationRecord
    ): Promise<NotificationRecordsSubscriptionMetricsResult> {
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

export type NotificationRecordsSubscriptionMetricsResult =
    | NotificationRecordsSubscriptionMetricsSuccess
    | CheckSubscriptionMetricsFailure;

export interface NotificationRecordsSubscriptionMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    config: SubscriptionConfiguration;
    metrics: NotificationSubscriptionMetrics;
    features: NotificationFeaturesConfiguration;
}

export interface SubscribeToNotificationRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The name of the record that the notification is in.
     */
    recordName: string;

    /**
     * The address of the notification.
     */
    address: string;

    /**
     * The push subscription to include with the subscription.
     */
    pushSubscription: PushSubscriptionType;

    /**
     * The instances that are currently loaded.
     */
    instances: string[];
}

export type SubscribeToNotificationResult =
    | SubscribeToNotificationSuccess
    | SubscribeToNotificationFailure;

export interface SubscribeToNotificationSuccess {
    success: true;

    /**
     * The ID of the subscription that was created.
     */
    subscriptionId: string;
}

export interface SubscribeToNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export interface UnsubscribeToNotificationRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The ID of the subscription to remove.
     */
    subscriptionId: string;

    /**
     * The instances that are currently loaded.
     */
    instances: string[];
}

export type UnsubscribeToNotificationResult =
    | UnsubscribeToNotificationSuccess
    | UnsubscribeToNotificationFailure;

export interface UnsubscribeToNotificationSuccess {
    success: true;
}

export interface UnsubscribeToNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export type GetApplicationServerKeyResult =
    | GetApplicationServerKeySuccess
    | GetApplicationServerKeyFailure;

export interface GetApplicationServerKeySuccess {
    success: true;

    /*
     * The public key that the server is using.
     */
    key: string;
}

export interface GetApplicationServerKeyFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export interface SendNotificationRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The name of the record that the notification is in.
     */
    recordName: string;

    /**
     * The address of the notification.
     */
    address: string;

    /**
     * The payload that should be sent.
     */
    payload: PushNotificationPayload;

    /**
     * The topic that the notification should be sent to.
     * A message with a topic will replace any other message with the same topic.
     * If omitted, then no topic will be used.
     */
    topic?: string;

    /**
     * The instances that are currently loaded.
     */
    instances: string[];
}

export type SendNotificationResult =
    | SendNotificationSuccess
    | SendNotificationFailure;

export interface SendNotificationSuccess {
    success: true;
}

export interface SendNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}
