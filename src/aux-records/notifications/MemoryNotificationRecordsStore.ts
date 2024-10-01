import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    SentNotification,
    SentNotificationUser,
} from './NotificationRecordsStore';

/**
 * A Memory-based implementation of the NotificationRecordsStore.
 */
export class MemoryNotificationRecordsStore
    extends MemoryCrudRecordsStore<NotificationRecord>
    implements NotificationRecordsStore
{
    private _subscriptions: NotificationSubscription[] = [];
    private _sentNotifications: SentNotification[] = [];
    private _sentNotificationUsers: SentNotificationUser[] = [];

    async saveSubscription(
        subscription: NotificationSubscription
    ): Promise<void> {
        const index = this._subscriptions.findIndex(
            (s) => s.id === subscription.id
        );
        if (index >= 0) {
            this._subscriptions[index] = {
                ...subscription,
            };
        } else {
            this._subscriptions.push({
                ...subscription,
            });
        }
    }

    async deleteSubscription(id: string): Promise<void> {
        const index = this._subscriptions.findIndex((s) => s.id === id);
        if (index >= 0) {
            this._subscriptions.splice(index, 1);
        }
    }

    async saveSentNotification(notification: SentNotification): Promise<void> {
        const index = this._sentNotifications.findIndex(
            (s) => s.id === notification.id
        );
        if (index >= 0) {
            this._sentNotifications[index] = {
                ...notification,
            };
        } else {
            this._sentNotifications.push({
                ...notification,
            });
        }
    }

    async saveSentNotificationUser(user: SentNotificationUser): Promise<void> {
        const index = this._sentNotificationUsers.findIndex(
            (s) =>
                s.sentNotificationId === user.sentNotificationId &&
                s.userId === user.userId
        );
        if (index >= 0) {
            this._sentNotificationUsers[index] = {
                ...user,
            };
        } else {
            this._sentNotificationUsers.push({
                ...user,
            });
        }
    }

    async listSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<NotificationSubscription[]> {
        return this._subscriptions.filter(
            (s) =>
                s.recordName === recordName &&
                s.notificationAddress === notificationAddress
        );
    }

    async listSubscriptionsForUser(
        userId: string
    ): Promise<NotificationSubscription[]> {
        return this._subscriptions.filter((s) => s.userId === userId);
    }
}
