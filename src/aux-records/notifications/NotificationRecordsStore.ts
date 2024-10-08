import { GenericHttpRequest } from '@casual-simulation/aux-common';
import { CrudRecord, CrudRecordsStore, CrudSubscriptionMetrics } from '../crud';
import { SubscriptionFilter } from '../MetricsStore';
import { PushSubscriptionType } from './WebPushInterface';

/**
 * Defines a store that contains notification records.
 */
export interface NotificationRecordsStore
    extends CrudRecordsStore<NotificationRecord> {
    /**
     * Saves the given subscription.
     * @param subscription The subscription to save.
     */
    saveSubscription(subscription: NotificationSubscription): Promise<void>;

    /**
     * Deletes the given subscription.
     * @param id The ID of the subscription.
     */
    deleteSubscription(id: string): Promise<void>;

    /**
     * Marks the given list of subscriptions as inactive.
     * @param ids The IDs of the subscriptions to inactivate.
     */
    markSubscriptionsInactive(ids: string[]): Promise<void>;

    /**
     * Finds the subscription with the given ID.
     * Returns null if no subscription was found.
     * @param id The ID of the subscription.
     */
    getSubscriptionById(id: string): Promise<NotificationSubscription | null>;

    /**
     * Saves the given sent notification.
     * @param notification The notification to save as sent.
     */
    saveSentNotification(notification: SentNotification): Promise<void>;

    /**
     * Saves the given sent notification user.
     * @param user The user that the notification was sent to.
     */
    saveSentNotificationUser(user: SentNotificationUser): Promise<void>;

    /**
     * Saves the given list of notifications that were sent to users.
     * @param users The list of users that the notifications were sent to.
     */
    createSentNotificationUsers(users: SentNotificationUser[]): Promise<void>;

    /**
     * Gets the list of active subscriptions for the given notification.
     * @param recordName The record that the notification is in.
     * @param notificationAddress The address that the notification is at.
     */
    listActiveSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<NotificationSubscription[]>;

    /**
     * Gets the list of subscriptions for the given user.
     * @param userId The ID of the user.
     */
    listActiveSubscriptionsForUser(
        userId: string
    ): Promise<NotificationSubscription[]>;

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
 */
export interface NotificationRecord extends CrudRecord {
    /**
     * The description of the notification.
     */
    description: string | null;
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
     * Whether the subscription is active or not.
     */
    active: boolean;

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
     */
    userId: string;

    /**
     * The JSON of the [push subscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription).
     * Null if none was provided.
     */
    pushSubscription: PushSubscriptionType | null;
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
 * Relates a sent notification to a user.
 */
export interface SentNotificationUser {
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
