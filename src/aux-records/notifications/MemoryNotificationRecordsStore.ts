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
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type {
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    SaveSubscriptionResult,
    SentNotification,
    NotificationPushSubscription,
    SentPushNotification,
    PushSubscriptionUser,
    UserPushSubscription,
} from './NotificationRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';
import { uniqBy } from 'lodash';

/**
 * A Memory-based implementation of the NotificationRecordsStore.
 */
export class MemoryNotificationRecordsStore
    extends MemoryCrudRecordsStore<NotificationRecord>
    implements NotificationRecordsStore
{
    private _pushSubscriptions: NotificationPushSubscription[] = [];
    private _pushSubscriptionUsers: PushSubscriptionUser[] = [];
    private _subscriptions: NotificationSubscription[] = [];
    private _sentNotifications: SentNotification[] = [];
    private _sentPushNotifications: SentPushNotification[] = [];

    get subscriptions() {
        return this._subscriptions;
    }

    get sentNotifications() {
        return this._sentNotifications;
    }

    get sentPushNotifications() {
        return this._sentPushNotifications;
    }

    get pushSubscriptions() {
        return this._pushSubscriptions;
    }

    get pushSubscriptionUsers() {
        return this._pushSubscriptionUsers;
    }

    async savePushSubscription(
        pushSubscription: NotificationPushSubscription
    ): Promise<void> {
        const index = this._pushSubscriptions.findIndex(
            (s) => s.id === pushSubscription.id
        );

        if (index >= 0) {
            this._pushSubscriptions[index] = {
                ...pushSubscription,
            };
        } else {
            this._pushSubscriptions.push({
                ...pushSubscription,
            });
        }
    }

    async savePushSubscriptionUser(
        pushSubscription: PushSubscriptionUser
    ): Promise<void> {
        const index = this._pushSubscriptionUsers.findIndex(
            (u) =>
                u.pushSubscriptionId === pushSubscription.pushSubscriptionId &&
                u.userId === pushSubscription.userId
        );

        if (index >= 0) {
            this._pushSubscriptionUsers[index] = {
                ...pushSubscription,
            };
        } else {
            this._pushSubscriptionUsers.push({
                ...pushSubscription,
            });
        }
    }

    async markPushSubscriptionsInactiveAndDeleteUserRelations(
        ids: string[]
    ): Promise<void> {
        for (let id of ids) {
            const index = this._pushSubscriptions.findIndex((s) => s.id === id);
            if (index >= 0) {
                this._pushSubscriptions[index] = {
                    ...this._pushSubscriptions[index],
                    active: false,
                };
            }
        }

        this._pushSubscriptionUsers = this._pushSubscriptionUsers.filter((u) =>
            ids.every((id) => id !== u.pushSubscriptionId)
        );
    }

    async getSubscriptionByRecordAddressAndUserId(
        recordName: string,
        notificationAddress: string,
        userId: string
    ): Promise<NotificationSubscription | null> {
        const subscription = this._subscriptions.find(
            (s) =>
                s.recordName === recordName &&
                s.notificationAddress === notificationAddress &&
                s.userId === userId
        );

        return subscription || null;
    }

    async getSubscriptionByRecordAddressAndPushSubscriptionId(
        recordName: string,
        notificationAddress: string,
        pushSubscriptionId: string
    ): Promise<NotificationSubscription | null> {
        const subscription = this._subscriptions.find(
            (s) =>
                s.recordName === recordName &&
                s.notificationAddress === notificationAddress &&
                s.pushSubscriptionId === pushSubscriptionId
        );

        return subscription || null;
    }

    async createSentPushNotifications(
        notifications: SentPushNotification[]
    ): Promise<void> {
        for (let notification of notifications) {
            await this.saveSentPushNotification(notification);
        }
    }

    async listActivePushSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<UserPushSubscription[]> {
        const subscriptions = this._subscriptions.filter(
            (s) =>
                s.recordName === recordName &&
                s.notificationAddress === notificationAddress
        );
        const users: UserPushSubscription[] = [];

        for (let subscription of subscriptions) {
            if (subscription.userId) {
                const subscribedUsers = this._pushSubscriptionUsers.filter(
                    (u) => u.userId === subscription.userId
                );
                for (let user of subscribedUsers) {
                    const sub = this._pushSubscriptions.find(
                        (s) => s.active && s.id === user.pushSubscriptionId
                    );
                    if (sub) {
                        users.push({
                            ...sub,
                            userId: user.userId,
                            subscriptionId: subscription.id,
                        });
                    }
                }
            } else if (subscription.pushSubscriptionId) {
                const sub = this._pushSubscriptions.find(
                    (s) => s.active && s.id === subscription.pushSubscriptionId
                );
                if (sub) {
                    users.push({
                        ...sub,
                        subscriptionId: subscription.id,
                        userId: null,
                    });
                }
            }
        }

        return uniqBy(users, (u) => u.id);
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
    ): Promise<SaveSubscriptionResult> {
        const exists = this._subscriptions.some(
            (s) =>
                s.recordName === subscription.recordName &&
                s.notificationAddress === subscription.notificationAddress &&
                ((s.userId && s.userId === subscription.userId) ||
                    (s.pushSubscriptionId &&
                        s.pushSubscriptionId ===
                            subscription.pushSubscriptionId))
        );

        if (exists) {
            return {
                success: false,
                errorCode: 'subscription_already_exists',
                errorMessage:
                    'This user is already subscribed to this notification.',
            };
        }

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

        return {
            success: true,
        };
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

    async saveSentPushNotification(
        notification: SentPushNotification
    ): Promise<void> {
        const index = this._sentPushNotifications.findIndex(
            (s) => s.id === notification.id
        );
        if (index >= 0) {
            this._sentPushNotifications[index] = {
                ...notification,
            };
        } else {
            this._sentPushNotifications.push({
                ...notification,
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
            : await this.store.listRecordsByStudioId(filter.studioId!);
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        for (let send of this._sentNotifications) {
            if (!records.some((r) => r.name === send.recordName)) {
                continue;
            }

            if (
                !info.currentPeriodStartMs ||
                !info.currentPeriodEndMs ||
                send.sentTimeMs >= info.currentPeriodStartMs ||
                send.sentTimeMs <= info.currentPeriodEndMs
            ) {
                totalSentNotificationsInPeriod++;
            }

            for (let u of this._sentPushNotifications) {
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
