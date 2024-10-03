import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import {
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    SentNotification,
    SentNotificationUser,
} from './NotificationRecordsStore';
import { SubscriptionFilter } from '../MetricsStore';

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

    get subscriptions() {
        return this._subscriptions;
    }

    get sentNotifications() {
        return this._sentNotifications;
    }

    get sentNotificationUsers() {
        return this._sentNotificationUsers;
    }

    async getSubscriptionById(
        id: string
    ): Promise<NotificationSubscription | null> {
        return this._subscriptions.find((s) => s.id === id) || null;
    }

    async countSubscriptionsForNotification(
        recordName: string,
        address: string
    ): Promise<number> {
        let count = 0;
        for (let s of this._subscriptions) {
            if (
                s.recordName === recordName &&
                s.notificationAddress === address
            ) {
                count++;
            }
        }

        return count;
    }

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

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<NotificationSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;
        let totalSentNotificationsInPeriod = 0;
        let totalSentPushNotificationsInPeriod = 0;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId);
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        for (let send of this._sentNotifications) {
            if (!records.some((r) => r.name === send.recordName)) {
                continue;
            }

            if (
                !info.currentPeriodStartMs ||
                send.sentTimeMs >= info.currentPeriodStartMs ||
                send.sentTimeMs <= info.currentPeriodEndMs
            ) {
                totalSentNotificationsInPeriod++;
            }

            for (let u of this._sentNotificationUsers) {
                if (u.sentNotificationId === send.id) {
                    totalSentPushNotificationsInPeriod++;
                }
            }
        }

        return {
            ...info,
            totalItems,
            totalSentNotificationsInPeriod,
            totalSentPushNotificationsInPeriod,
        };
    }
}
