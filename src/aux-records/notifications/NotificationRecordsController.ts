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
    ActionKinds,
    KnownErrorCodes,
} from '@casual-simulation/aux-common';
import {
    PRIVATE_MARKER,
    SUBSCRIPTION_ID_NAMESPACE,
    hasValue,
    isFailure,
    logError,
} from '@casual-simulation/aux-common';
import type {
    AuthorizationContext,
    AuthorizeUserAndInstancesSuccess,
    AuthorizeUserAndInstancesForResourcesSuccess,
} from '../PolicyController';
import type {
    CrudRecordsConfiguration,
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
} from '../crud';
import { CrudRecordsController } from '../crud';
import type {
    NotificationAction,
    NotificationActionUI,
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    SentPushNotification,
    UserPushSubscription,
} from './NotificationRecordsStore';
import type {
    NotificationFeaturesConfiguration,
    SubscriptionConfiguration,
} from '../SubscriptionConfiguration';
import { getNotificationFeatures } from '../SubscriptionConfiguration';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { v7 as uuidv7, v5 as uuidv5 } from 'uuid';
import type {
    PushNotificationPayload,
    PushSubscriptionType,
    SendPushNotificationResult,
    WebPushInterface,
} from './WebPushInterface';
import type { FinancialController } from '../financial/FinancialController';
import {
    ACCOUNT_IDS,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
} from '../financial';

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

    /**
     * The financial controller that should be used to charge credits for notification usage.
     */
    financialController?: FinancialController | null;
}

/**
 * Defines a controller that can be used to interact with NotificationRecords.
 */
export class NotificationRecordsController extends CrudRecordsController<
    NotificationRecord,
    NotificationRecord,
    NotificationRecordsStore
> {
    private _pushInterface: WebPushInterface;
    private _financialController: FinancialController | null;

    constructor(config: NotificationRecordsConfiguration) {
        super({
            ...config,
            name: 'NotificationRecordsController',
            resourceKind: 'notification',
        });
        this._pushInterface = config.pushInterface;
        this._financialController = config.financialController || null;
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
                '[NotificationRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Subscribes the user to the given notification.
     * Does nothing if the user is already subscribed.
     * @param request The request.
     */
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

            const pushSubscriptionId = this._getPushSubscriptionId(
                request.pushSubscription.endpoint
            );
            await this.store.savePushSubscription({
                id: pushSubscriptionId,
                active: true,
                endpoint: request.pushSubscription.endpoint,
                keys: request.pushSubscription.keys,
            });

            await this.store.savePushSubscriptionUser({
                pushSubscriptionId: pushSubscriptionId,
                userId: userId,
            });

            let subscriptionId: string = null;
            if (userId) {
                const sub =
                    await this.store.getSubscriptionByRecordAddressAndUserId(
                        recordName,
                        notification.address,
                        userId
                    );

                if (sub) {
                    subscriptionId = sub.id;
                }
            } else {
                const sub =
                    await this.store.getSubscriptionByRecordAddressAndPushSubscriptionId(
                        recordName,
                        notification.address,
                        pushSubscriptionId
                    );

                if (sub) {
                    subscriptionId = sub.id;
                }
            }

            if (!subscriptionId) {
                // Charge credits for the subscription if configured
                if (
                    hasValue(metrics.features.creditFeePerSubscriberPerPeriod)
                ) {
                    if (!this._financialController) {
                        console.warn(
                            `[NotificationRecordsController] Cannot charge credits for notification subscription because FinancialController is not configured.`
                        );
                    } else {
                        // Try to record the credit usage.
                        const accountInfo =
                            await this._financialController.getFinancialAccount(
                                {
                                    userId: context.context.recordOwnerId,
                                    studioId: context.context.recordStudioId,
                                    ledger: LEDGERS.credits,
                                }
                            );

                        if (isFailure(accountInfo)) {
                            logError(
                                accountInfo.error,
                                `[NotificationRecordsController] Failed to get financial account to charge for notification subscription.`
                            );
                        } else {
                            // Charge the account for the subscription.
                            const transactionResult =
                                await this._financialController.internalTransaction(
                                    {
                                        transfers: [
                                            {
                                                amount: metrics.features
                                                    .creditFeePerSubscriberPerPeriod,
                                                debitAccountId:
                                                    accountInfo.value.account
                                                        .id,
                                                creditAccountId:
                                                    ACCOUNT_IDS.revenue_records_usage_credits,
                                                currency: CurrencyCodes.credits,
                                                code: TransferCodes.records_usage_fee,
                                            },
                                        ],
                                    }
                                );

                            if (isFailure(transactionResult)) {
                                if (
                                    transactionResult.error.errorCode ===
                                        'debits_exceed_credits' &&
                                    transactionResult.error.accountId ===
                                        accountInfo.value.account.id.toString()
                                ) {
                                    logError(
                                        transactionResult.error,
                                        `[NotificationRecordsController] Insufficient funds to create notification subscription.`,
                                        console.log
                                    );
                                    // The user does not have enough credits to create the subscription.
                                    return {
                                        success: false,
                                        errorCode: 'insufficient_funds',
                                        errorMessage:
                                            'Not enough credits to create the notification subscription.',
                                    };
                                } else {
                                    logError(
                                        transactionResult.error,
                                        `[NotificationRecordsController] Failed to record financial transaction for notification subscription.`
                                    );
                                }
                            }
                        }
                    }
                }

                subscriptionId = uuidv7();
                await this.store.saveSubscription({
                    id: subscriptionId,
                    recordName,
                    notificationAddress: notification.address,
                    userId: userId,
                    pushSubscriptionId: !userId ? pushSubscriptionId : null,
                });
            }

            console.log(
                `[NotificationRecordsController] [userId: ${userId} pushSubscriptionId: ${pushSubscriptionId} subscriptionId: ${subscriptionId}] Subscribed to notification`
            );

            return {
                success: true,
                subscriptionId,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    private _getPushSubscriptionId(endpoint: string): string {
        return uuidv5(endpoint, SUBSCRIPTION_ID_NAMESPACE);
    }

    /**
     * Unsubscribes the user from the given notification.
     * @param request The request.
     */
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
            await this.store.deleteSubscription(request.subscriptionId);

            console.log(
                `[NotificationRecordsController] [userId: ${userId} subscriptionId: ${request.subscriptionId}] Unsubscribed from notification`
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error subscribing to notification:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Registers a push subscription for the user.
     * This will allow the device to recieve push notifications for the user.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async registerPushSubscription(
        request: RegisterPushSubscriptionRequest
    ): Promise<RegisterPushSubscriptionResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            const pushSubscriptionId = this._getPushSubscriptionId(
                request.pushSubscription.endpoint
            );
            await this.store.savePushSubscription({
                id: pushSubscriptionId,
                active: true,
                endpoint: request.pushSubscription.endpoint,
                keys: request.pushSubscription.keys,
            });

            await this.store.savePushSubscriptionUser({
                pushSubscriptionId: pushSubscriptionId,
                userId: request.userId,
            });

            console.log(
                `[NotificationRecordsController] [userId: ${request.userId} pushSubscriptionId: ${pushSubscriptionId}] Registered push subscription`
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error registering push subscription:',
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

            const pushSubs =
                await this.store.listActivePushSubscriptionsForNotification(
                    recordName,
                    notification.address
                );

            if (
                typeof metrics.features.maxSentPushNotificationsPerPeriod ===
                'number'
            ) {
                if (
                    metrics.metrics.totalSentNotificationsInPeriod +
                        pushSubs.length >=
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

            // Charge credits for sending notification if configured
            if (hasValue(metrics.features.creditFeePerNotificationSent)) {
                if (!this._financialController) {
                    console.warn(
                        `[NotificationRecordsController] Cannot charge credits for sending notification because FinancialController is not configured.`
                    );
                } else {
                    // Try to record the credit usage.
                    const accountInfo =
                        await this._financialController.getFinancialAccount({
                            userId: context.context.recordOwnerId,
                            studioId: context.context.recordStudioId,
                            ledger: LEDGERS.credits,
                        });

                    if (isFailure(accountInfo)) {
                        logError(
                            accountInfo.error,
                            `[NotificationRecordsController] Failed to get financial account to charge for sending notification.`
                        );
                    } else {
                        // Charge the account for sending the notification.
                        const transactionResult =
                            await this._financialController.internalTransaction(
                                {
                                    transfers: [
                                        {
                                            amount: metrics.features
                                                .creditFeePerNotificationSent,
                                            debitAccountId:
                                                accountInfo.value.account.id,
                                            creditAccountId:
                                                ACCOUNT_IDS.revenue_records_usage_credits,
                                            currency: CurrencyCodes.credits,
                                            code: TransferCodes.records_usage_fee,
                                        },
                                    ],
                                }
                            );

                        if (isFailure(transactionResult)) {
                            if (
                                transactionResult.error.errorCode ===
                                    'debits_exceed_credits' &&
                                transactionResult.error.accountId ===
                                    accountInfo.value.account.id.toString()
                            ) {
                                logError(
                                    transactionResult.error,
                                    `[NotificationRecordsController] Insufficient funds to send notification.`,
                                    console.log
                                );
                                // The user does not have enough credits to send the notification.
                                return {
                                    success: false,
                                    errorCode: 'insufficient_funds',
                                    errorMessage:
                                        'Not enough credits to send the notification.',
                                };
                            } else {
                                logError(
                                    transactionResult.error,
                                    `[NotificationRecordsController] Failed to record financial transaction for sending notification.`
                                );
                            }
                        }
                    }
                }
            }

            // Charge credits for push notifications if configured
            if (
                hasValue(metrics.features.creditFeePerPushNotificationSent) &&
                pushSubs.length > 0
            ) {
                if (!this._financialController) {
                    console.warn(
                        `[NotificationRecordsController] Cannot charge credits for push notifications because FinancialController is not configured.`
                    );
                } else {
                    const totalPushFee =
                        BigInt(pushSubs.length) *
                        BigInt(
                            metrics.features.creditFeePerPushNotificationSent
                        );

                    // Try to record the credit usage.
                    const accountInfo =
                        await this._financialController.getFinancialAccount({
                            userId: context.context.recordOwnerId,
                            studioId: context.context.recordStudioId,
                            ledger: LEDGERS.credits,
                        });

                    if (isFailure(accountInfo)) {
                        logError(
                            accountInfo.error,
                            `[NotificationRecordsController] Failed to get financial account to charge for push notifications.`
                        );
                    } else {
                        // Charge the account for the push notifications.
                        const transactionResult =
                            await this._financialController.internalTransaction(
                                {
                                    transfers: [
                                        {
                                            amount: totalPushFee,
                                            debitAccountId:
                                                accountInfo.value.account.id,
                                            creditAccountId:
                                                ACCOUNT_IDS.revenue_records_usage_credits,
                                            currency: CurrencyCodes.credits,
                                            code: TransferCodes.records_usage_fee,
                                        },
                                    ],
                                }
                            );

                        if (isFailure(transactionResult)) {
                            if (
                                transactionResult.error.errorCode ===
                                    'debits_exceed_credits' &&
                                transactionResult.error.accountId ===
                                    accountInfo.value.account.id.toString()
                            ) {
                                logError(
                                    transactionResult.error,
                                    `[NotificationRecordsController] Insufficient funds to send push notifications.`,
                                    console.log
                                );
                                // The user does not have enough credits to send the push notifications.
                                return {
                                    success: false,
                                    errorCode: 'insufficient_funds',
                                    errorMessage:
                                        'Not enough credits to send the push notifications.',
                                };
                            } else {
                                logError(
                                    transactionResult.error,
                                    `[NotificationRecordsController] Failed to record financial transaction for push notifications.`
                                );
                            }
                        }
                    }
                }
            }

            let promises = [] as Promise<
                [UserPushSubscription, SendPushNotificationResult]
            >[];

            const sentTimeMs = Date.now();
            for (let push of pushSubs) {
                promises.push(
                    this._pushInterface
                        .sendNotification(
                            {
                                endpoint: push.endpoint,
                                keys: push.keys as any,
                            },
                            request.payload,
                            request.topic
                        )
                        .then((result) => {
                            return [push, result] as const;
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
                topic: request.topic,
            });

            let sentPushNotifications = [] as SentPushNotification[];
            let failedPushSubscriptions = [] as string[];

            for (let promiseResult of results) {
                if (promiseResult.status === 'rejected') {
                    console.error(
                        '[NotificationRecordsController] Error sending notification:',
                        promiseResult.reason
                    );
                } else {
                    const [push, result] = promiseResult.value;

                    sentPushNotifications.push({
                        id: uuidv7(),
                        pushSubscriptionId: push.id,
                        sentNotificationId: notificationId,
                        userId: push.userId,
                        subscriptionId: push.subscriptionId,
                        success: result.success,
                        errorCode:
                            result.success === false ? result.errorCode : null,
                    });

                    if (result.success === false) {
                        console.error(
                            `[NotificationRecordsController] Error sending notification for ${push.id}:`,
                            result.errorCode
                        );

                        if (
                            result.errorCode === 'subscription_gone' ||
                            result.errorCode === 'subscription_not_found'
                        ) {
                            failedPushSubscriptions.push(push.id);
                        }
                    }
                }
            }

            if (sentPushNotifications.length > 0) {
                await this.store.createSentPushNotifications(
                    sentPushNotifications
                );
            }

            if (failedPushSubscriptions.length > 0) {
                await this.store.markPushSubscriptionsInactiveAndDeleteUserRelations(
                    failedPushSubscriptions
                );
            }

            console.log(
                `[NotificationRecordsController] [userId: ${userId} notificationId: ${notificationId} sent: ${sentPushNotifications.length} failed: ${failedPushSubscriptions.length}] Sent notification`
            );

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error sending notification:',
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
    async listSubscriptionsForUser(
        request: ListSubscriptionsForUserRequest
    ): Promise<ListSubscriptionsResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            const subscriptions = await this.store.listSubscriptionsForUser(
                request.userId
            );
            return {
                success: true,
                subscriptions: subscriptions.map((sub) => ({
                    id: sub.id,
                    userId: sub.userId,
                    recordName: sub.recordName,
                    notificationAddress: sub.notificationAddress,
                    pushSubscriptionId: sub.pushSubscriptionId,
                })),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error listing subscriptions for user:',
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
    async listSubscriptions(
        request: ListSubscriptionsRequest
    ): Promise<ListSubscriptionsResult> {
        try {
            if (!request.userId) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in. Please provide a sessionKey or a recordKey.',
                };
            }

            const context = await this.policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
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
                    userId: request.userId,
                    resourceKind: 'notification',
                    markers: notification.markers,
                    resourceId: notification.address,
                    action: 'listSubscriptions',
                    instances: request.instances,
                }
            );

            if (authorization.success === false) {
                return authorization;
            }

            const subscriptions =
                await this.store.listSubscriptionsForNotification(
                    recordName,
                    request.address
                );
            return {
                success: true,
                subscriptions: subscriptions.map((sub) => ({
                    id: sub.id,
                    userId: sub.userId,
                    recordName: sub.recordName,
                    notificationAddress: sub.notificationAddress,
                    pushSubscriptionId: sub.pushSubscriptionId,
                })),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[NotificationRecordsController] Error listing subscriptions for notification:',
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
    userId: string | null;

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
     * The ID of the subscription.
     */
    subscriptionId: string;

    /**
     * The ID of the user that is logged in.
     */
    userId: string;

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

export interface RegisterPushSubscriptionRequest {
    /**
     * The ID of the user that is logged in.
     */
    userId: string;

    /**
     * The push subscription that should be registered.
     */
    pushSubscription: PushSubscriptionType;

    /**
     * The instances that are currently loaded.
     */
    instances: string[];
}

export type RegisterPushSubscriptionResult =
    | RegisterPushSubscriptionSuccess
    | RegisterPushSubscriptionFailure;

export interface RegisterPushSubscriptionSuccess {
    success: true;
}

export interface RegisterPushSubscriptionFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export interface ListSubscriptionsForUserRequest {
    /**
     * The ID of the user that is currently logged in.
     */
    userId: string;

    /**
     * The instances that are currently loaded.
     */
    instances: string[];
}

export interface ListSubscriptionsRequest {
    /**
     * The ID of the user that is currently logged in.
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
     * The instances that are currently loaded.
     */
    instances: string[];
}

export type ListSubscriptionsResult =
    | ListSubscriptionsSuccess
    | ListSubscriptionsFailure;

export interface ListSubscriptionsSuccess {
    success: true;

    /**
     * The list of subscriptions.
     */
    subscriptions: NotificationSubscription[];
}

export interface ListSubscriptionsFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}
