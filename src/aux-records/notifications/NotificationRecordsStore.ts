import { GenericHttpRequest } from '@casual-simulation/aux-common';
import { CrudRecord, CrudRecordsStore } from '../crud';

/**
 * Defines a store that contains notification records.
 */
export interface NotificationRecordsStore
    extends CrudRecordsStore<NotificationRecord> {}

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
    pushSubscriptionJson: string | null;
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
     * The action that should be taken when the notification is clicked.
     */
    defaultAction?: NotificationAction | null;

    /**
     * The actions that should be displayed on the notification.
     */
    actions: NotificationActionUI[];
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
     * The ID of the user that the notification was sent to.
     */
    userId: string;
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
