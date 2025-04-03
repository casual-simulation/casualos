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
    GenericHttpRequest,
    ServerError,
} from '@casual-simulation/aux-common';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud';
import type { SubscriptionFilter } from '../MetricsStore';
import { PushSubscriptionType } from './WebPushInterface';

/**
 * Defines a store that contains notification records.
 */
export interface NotificationRecordsStore
    extends CrudRecordsStore<NotificationRecord> {
    /**
     * Saves the given push subscription.
     * @param pushSubscription The push subscription to save.
     */
    savePushSubscription(
        pushSubscription: NotificationPushSubscription
    ): Promise<void>;

    /**
     * Saves the given push subscription for the given user.
     * @param pushSubscription The push subscription to save.
     */
    savePushSubscriptionUser(
        pushSubscription: PushSubscriptionUser
    ): Promise<void>;

    /**
     * Saves the given subscription.
     * @param subscription The subscription to save.
     */
    saveSubscription(
        subscription: NotificationSubscription
    ): Promise<SaveSubscriptionResult>;

    /**
     * Deletes the given subscription.
     * @param id The ID of the subscription.
     */
    deleteSubscription(id: string): Promise<void>;

    /**
     * Marks the given list of push subscriptions as inactive and deletes the related
     * PushSubscriptionUser relations.
     * @param ids The IDs of the subscriptions to inactivate.
     */
    markPushSubscriptionsInactiveAndDeleteUserRelations(
        ids: string[]
    ): Promise<void>;

    /**
     * Finds the subscription with the given ID.
     * Returns null if no subscription was found.
     * @param id The ID of the subscription.
     */
    getSubscriptionById(id: string): Promise<NotificationSubscription | null>;

    /**
     * Finds the subscription with the given record, address and user ID.
     * Returns null if no subscription was found.
     * @param recordName The name of the record.
     * @param notificationAddress The address of the notification.
     * @param userId The ID of the user.
     */
    getSubscriptionByRecordAddressAndUserId(
        recordName: string,
        notificationAddress: string,
        userId: string
    ): Promise<NotificationSubscription | null>;

    /**
     * Finds the subscription with the given record, address and push subscription ID.
     * Returns null if no subscription was found.
     * @param recordName The name of the record.
     * @param notificationAddress The address of the notification.
     * @param pushSubscriptionId The ID of the push subscription.
     */
    getSubscriptionByRecordAddressAndPushSubscriptionId(
        recordName: string,
        notificationAddress: string,
        pushSubscriptionId: string
    ): Promise<NotificationSubscription | null>;

    /**
     * Saves the given sent notification.
     * @param notification The notification to save as sent.
     */
    saveSentNotification(notification: SentNotification): Promise<void>;

    /**
     * Saves the given sent push notification.
     * @param push The notification that was sent.
     */
    saveSentPushNotification(push: SentPushNotification): Promise<void>;

    /**
     * Saves the given list of notifications that were sent.
     * @param notifications The list notifications that were sent.
     */
    createSentPushNotifications(
        notifications: SentPushNotification[]
    ): Promise<void>;

    /**
     * Gets the list of active subscriptions for the given notification.
     * @param recordName The record that the notification is in.
     * @param notificationAddress The address that the notification is at.
     */
    listSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<NotificationSubscription[]>;

    /**
     * Gets the list of subscriptions for the given user.
     * @param userId The ID of the user.
     */
    listSubscriptionsForUser(
        userId: string
    ): Promise<NotificationSubscription[]>;

    /**
     * Gets the list of active push subscriptions for the given notification.
     * @param recordName The name of the record.
     * @param notificationAddress The address of the notification.
     */
    listActivePushSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<UserPushSubscription[]>;

    /**
     * Gets the item metrics for the subscription of the given user or studio.
     * @param filter The filter to use.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<NotificationSubscriptionMetrics>;

    /**
     * Gets the total number of subscriptions that are currently active for the given notification.
     * @param recordName The name of the record that the notification is in.
     * @param address The address of the notification.
     */
    countSubscriptionsForNotification(
        recordName: string,
        address: string
    ): Promise<number>;
}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 *
 * @dochash types/records/notifications
 * @docName NotificationRecord
 */
export interface NotificationRecord extends CrudRecord {
    /**
     * The description of the notification.
     */
    description: string | null;
}

/**
 * Defines a push subscription that is stored in the store.
 */
export interface NotificationPushSubscription {
    /**
     * The ID of the push subscription.
     */
    id: string;

    /**
     * The endpoint that should be used to send push notifications.
     */
    endpoint: string;

    // TODO: Support this field.
    // /**
    //  * The expiration time of the subscription.
    //  */
    // expirationTimeMs?: number;

    /**
     * The keys that should be used to send push notifications.
     */
    keys: Record<string, string>;

    /**
     * Whether the push subscription is active.
     */
    active: boolean;
}

/**
 * Defines a relation between a push subscription and a user.
 */
export interface PushSubscriptionUser {
    /**
     * The ID of the push subscription.
     */
    pushSubscriptionId: string;

    /**
     * The ID of the user that the push subscription is for.
     */
    userId: string;
}

/**
 * Defines an active subscription to a notification.
 */
export interface NotificationSubscription {
    /**
     * The ID of the subscription.
     */
    id: string;

    /**
     * The name of the record that the subscription is for.
     */
    recordName: string;

    /**
     * The address of the notification in the record.
     */
    notificationAddress: string;

    /**
     * The ID of the user that is subscribed.
     * If null, then notifications should only be sent to the specified push subscription.
     */
    userId: string | null;

    /**
     * The push subscription that the notification should be sent to.
     * If null, then notifications should be sent to all push subscriptions for the user.
     */
    pushSubscriptionId: string | null;
}

/**
 * Defines a notification that was sent.
 */
export interface SentNotification {
    /**
     * The ID of the sent notification.
     */
    id: string;

    /**
     * The name of the record that the subscription is for.
     */
    recordName: string;

    /**
     * The address of the notification in the record.
     */
    notificationAddress: string;

    /**
     * The title of the notification that was sent.
     */
    title: string;

    /**
     * The body of the sent notification.
     */
    body: string;

    /**
     * The icon URL of the sent notification.
     */
    icon: string | null;

    /**
     * The badge URL of the sent notification.
     */
    badge: string | null;

    /**
     * Whether the notification was silent.
     */
    silent?: boolean;

    /**
     * The tag of the sent notification.
     * Used to group similar notifications together.
     */
    tag?: string;

    /**
     * The topic that the notification should be sent to.
     * A message with a topic will replace any other message with the same topic.
     * Null if no topic was specified.
     */
    topic?: string;

    /**
     * The timestamp of the sent notification.
     */
    timestamp?: number;

    /**
     * The action that should be taken when the notification is clicked.
     */
    defaultAction?: NotificationAction | null;

    /**
     * The actions that should be displayed on the notification.
     */
    actions: NotificationActionUI[];

    /**
     * The time that the notification was sent.
     */
    sentTimeMs: number;
}

/**
 * Defines a model that represents a push notification that was sent.
 */
export interface SentPushNotification {
    /**
     * The ID of the sent notification.
     */
    id: string;

    /**
     * The ID of the notification that was sent.
     */
    sentNotificationId: string;

    /**
     * The subscription that the notification was sent under.
     */
    subscriptionId: string;

    /**
     * The ID of the user that the notification was sent to.
     */
    userId: string;

    /**
     * The ID of the push subscription that the notification was sent to.
     */
    pushSubscriptionId: string;

    /**
     * Whether the notification was successfully sent to the user.
     */
    success: boolean;

    /**
     * The error that occurred when sending the notification.
     * Null if no error occurred.
     */
    errorCode: string | null;
}

/**
 * Defines a action that should be displayed on a notification.
 */
export interface NotificationActionUI {
    /**
     * The title of the action.
     */
    title: string;

    /**
     * The icon that should be shown with the action.
     */
    icon?: string;

    /**
     * The action that should be executed when the action is clicked.
     */
    action: NotificationAction;
}

export type NotificationAction =
    | OpenUrlNotificationAction
    | WebhookNotificationAction;

/**
 * Defines an action that opens a URL when executed.
 */
export interface OpenUrlNotificationAction {
    type: 'open_url';
    url: string;
}

/**
 * Defines an action that sends a HTTP request when executed.
 */
export interface WebhookNotificationAction {
    type: 'webhook';

    /**
     * The HTTP method of the request.
     */
    method: GenericHttpRequest['method'];

    /**
     * The URL to make the request to.
     */
    url: string;

    /**
     * The body of the request.
     */
    body?: string;

    /**
     * The headers to include in the request.
     */
    headers?: GenericHttpRequest['headers'];
}

export interface NotificationSubscriptionMetrics
    extends CrudSubscriptionMetrics {
    /**
     * The total number of notification items that are stored in the subscription.
     */
    totalItems: number;

    /**
     * The number of sent notifications that have been recorded for the last subscription period.
     */
    totalSentNotificationsInPeriod: number;

    /**
     * The number of sent push notifications that have been recorded for the last subscription period.
     */
    totalSentPushNotificationsInPeriod: number;
}

export type SaveSubscriptionResult =
    | SaveSubscriptionSuccess
    | SaveSubscriptionFailure;

export interface SaveSubscriptionSuccess {
    success: true;
}

export interface SaveSubscriptionFailure {
    success: false;

    /**
     * The error that occurred.
     */
    errorCode: ServerError | 'subscription_already_exists';

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines a push subscription that is related to a user.
 */
export interface UserPushSubscription extends NotificationPushSubscription {
    /**
     * The ID of the user that the push subscription is for.
     * If null, then notifications should only be sent to the specified push subscription.
     */
    userId: string | null;

    /**
     * The ID of the subscription.
     */
    subscriptionId: string;
}
