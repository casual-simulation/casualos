import {
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    PUSH_SUBSCRIPTION_SCHEMA,
    SentNotification,
    SentNotificationUser,
    SubscriptionFilter,
} from '@casual-simulation/aux-records';
import {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud';
import {
    Prisma,
    PrismaClient,
    NotificationSubscription as PrismaNotificationSubscription,
} from './generated';
import { PrismaMetricsStore } from './PrismaMetricsStore';
import { convertToDate } from './Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'PrismaNotificationRecordsStore';

export class PrismaNotificationRecordsStore
    implements NotificationRecordsStore
{
    private _client: PrismaClient;
    private _metrics: PrismaMetricsStore;

    constructor(client: PrismaClient, metrics: PrismaMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    @traced(TRACE_NAME)
    async saveSubscription(
        subscription: NotificationSubscription
    ): Promise<void> {
        await this._client.notificationSubscription.upsert({
            where: {
                id: subscription.id,
            },
            create: {
                id: subscription.id,
                recordName: subscription.recordName,
                notificationAddress: subscription.notificationAddress,
                userId: subscription.userId,
                active: subscription.active,
                pushSubscription: subscription.pushSubscription,
            },
            update: {
                recordName: subscription.recordName,
                notificationAddress: subscription.notificationAddress,
                userId: subscription.userId,
                active: subscription.active,
                pushSubscription: subscription.pushSubscription,
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteSubscription(id: string): Promise<void> {
        await this._client.notificationSubscription.delete({
            where: {
                id: id,
            },
        });
    }

    @traced(TRACE_NAME)
    async markSubscriptionsInactive(ids: string[]): Promise<void> {
        await this._client.notificationSubscription.updateMany({
            where: {
                id: {
                    in: ids,
                },
            },
            data: {
                active: false,
            },
        });
    }

    @traced(TRACE_NAME)
    async getSubscriptionById(
        id: string
    ): Promise<NotificationSubscription | null> {
        const sub = await this._client.notificationSubscription.findUnique({
            where: {
                id: id,
            },
        });

        if (!sub) {
            return null;
        }

        const pushSubscription = PUSH_SUBSCRIPTION_SCHEMA.parse(
            sub.pushSubscription
        );

        return {
            id: sub.id,
            recordName: sub.recordName,
            notificationAddress: sub.notificationAddress,
            userId: sub.userId,
            active: sub.active,
            pushSubscription: pushSubscription,
        };
    }

    @traced(TRACE_NAME)
    async saveSentNotification(notification: SentNotification): Promise<void> {
        await this._client.sentNotification.upsert({
            where: {
                id: notification.id,
            },
            create: {
                id: notification.id,
                recordName: notification.recordName,
                notificationAddress: notification.notificationAddress,
                title: notification.title,
                body: notification.body,
                icon: notification.icon,
                badge: notification.badge,
                silent: notification.silent,
                tag: notification.tag,
                topic: notification.topic,
                defaultAction: notification.defaultAction ?? (null as any),
                actions: notification.actions ?? (null as any),
                sentTime: convertToDate(notification.sentTimeMs),
            },
            update: {
                recordName: notification.recordName,
                notificationAddress: notification.notificationAddress,
                title: notification.title,
                body: notification.body,
                icon: notification.icon,
                badge: notification.badge,
                silent: notification.silent,
                tag: notification.tag,
                topic: notification.topic,
                defaultAction: notification.defaultAction ?? (null as any),
                actions: notification.actions ?? (null as any),
                sentTime: convertToDate(notification.sentTimeMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async saveSentNotificationUser(user: SentNotificationUser): Promise<void> {
        await this._client.sentNotificationUser.upsert({
            where: {
                sentNotificationId_userId_subscriptionId: {
                    sentNotificationId: user.sentNotificationId,
                    userId: user.userId,
                    subscriptionId: user.subscriptionId,
                },
            },
            create: {
                sentNotificationId: user.sentNotificationId,
                userId: user.userId,
                subscriptionId: user.subscriptionId,
                success: user.success,
                errorCode: user.errorCode,
            },
            update: {
                success: user.success,
                errorCode: user.errorCode,
            },
        });
    }

    @traced(TRACE_NAME)
    async createSentNotificationUsers(
        users: SentNotificationUser[]
    ): Promise<void> {
        await this._client.sentNotificationUser.createMany({
            data: users.map((u) => ({
                sentNotificationId: u.sentNotificationId,
                userId: u.userId,
                subscriptionId: u.subscriptionId,
                success: u.success,
                errorCode: u.errorCode,
            })),
        });
    }

    @traced(TRACE_NAME)
    async listActiveSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<NotificationSubscription[]> {
        const subscriptions =
            await this._client.notificationSubscription.findMany({
                where: {
                    recordName: recordName,
                    notificationAddress: notificationAddress,
                    active: true,
                },
            });

        return subscriptions.map((sub) =>
            this._convertNotificationSubscription(sub)
        );
    }

    @traced(TRACE_NAME)
    async listActiveSubscriptionsForUser(
        userId: string
    ): Promise<NotificationSubscription[]> {
        const subscriptions =
            await this._client.notificationSubscription.findMany({
                where: {
                    userId: userId,
                    active: true,
                },
            });

        return subscriptions.map((sub) =>
            this._convertNotificationSubscription(sub)
        );
    }

    @traced(TRACE_NAME)
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<NotificationSubscriptionMetrics> {
        const metrics = await this._metrics.getSubscriptionRecordMetrics(
            filter
        );

        const where: Prisma.NotificationRecordWhereInput = {};
        const whereRun: Prisma.SentNotificationWhereInput = {};

        if (filter.ownerId) {
            where.record = {
                ownerId: filter.ownerId,
            };
            whereRun.record = {
                ownerId: filter.ownerId,
            };
        } else if (filter.studioId) {
            where.record = {
                studioId: filter.studioId,
            };
            whereRun.record = {
                studioId: filter.studioId,
            };
        } else {
            throw new Error('Invalid filter');
        }

        const [
            totalItems,
            totalSentNotificationsInPeriod,
            totalSentPushNotificationsInPeriod,
        ] = await Promise.all([
            this._client.notificationRecord.count({
                where,
            }),
            this._client.sentNotification.count({
                where: {
                    ...whereRun,
                    sentTime: {
                        lt: new Date(metrics.currentPeriodEndMs),
                        gte: new Date(metrics.currentPeriodStartMs),
                    },
                },
            }),
            this._client.sentNotificationUser.count({
                where: {
                    sentNotification: {
                        ...whereRun,
                        sentTime: {
                            lt: new Date(metrics.currentPeriodEndMs),
                            gte: new Date(metrics.currentPeriodStartMs),
                        },
                    },
                },
            }),
        ]);

        return {
            ...metrics,
            totalItems,
            totalSentNotificationsInPeriod,
            totalSentPushNotificationsInPeriod,
        };
    }

    @traced(TRACE_NAME)
    async countSubscriptionsForNotification(
        recordName: string,
        address: string
    ): Promise<number> {
        return await this._client.notificationSubscription.count({
            where: {
                recordName: recordName,
                notificationAddress: address,
            },
        });
    }

    @traced(TRACE_NAME)
    async createItem(
        recordName: string,
        item: NotificationRecord
    ): Promise<void> {
        await this._client.notificationRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                description: item.description,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async getItemByAddress(
        recordName: string,
        address: string
    ): Promise<NotificationRecord> {
        const item = await this._client.notificationRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });

        if (!item) {
            return null;
        }

        return {
            address: item.address,
            description: item.description,
            markers: item.markers,
        };
    }

    @traced(TRACE_NAME)
    async updateItem(
        recordName: string,
        item: Partial<NotificationRecord>
    ): Promise<void> {
        await this._client.notificationRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            data: {
                description: item.description,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async putItem(
        recordName: string,
        item: Partial<NotificationRecord>
    ): Promise<void> {
        await this._client.notificationRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address,
                },
            },
            create: {
                recordName: recordName,
                address: item.address,
                description: item.description,
                markers: item.markers,
            },
            update: {
                description: item.description,
                markers: item.markers,
            },
        });
    }

    @traced(TRACE_NAME)
    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.notificationRecord.delete({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address,
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async listItems(
        recordName: string,
        address: string | null
    ): Promise<ListCrudStoreSuccess<NotificationRecord>> {
        const filter: Prisma.NotificationRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            filter.address = {
                gt: address,
            };
        }

        const [count, records] = await Promise.all([
            this._client.notificationRecord.count({
                where: {
                    recordName: recordName,
                },
            }),
            this._client.notificationRecord.findMany({
                where: filter,
                orderBy: {
                    address: 'asc',
                },
                take: 25,
            }),
        ]);

        return {
            success: true,
            totalCount: count,
            items: records.map((r) => ({
                address: r.address,
                description: r.description,
                markers: r.markers,
            })),
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<NotificationRecord>> {
        const filter: Prisma.NotificationRecordWhereInput = {
            recordName: request.recordName,
            markers: { has: request.marker },
        };

        if (request.startingAddress) {
            filter.address = {
                gt: request.startingAddress,
            };
        }

        const [count, records] = await Promise.all([
            this._client.notificationRecord.count({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker },
                },
            }),
            this._client.notificationRecord.findMany({
                where: filter,
                orderBy: {
                    address: request.sort === 'descending' ? 'desc' : 'asc',
                },
                take: 25,
            }),
        ]);

        return {
            success: true,
            totalCount: count,
            items: records.map((r) => ({
                address: r.address,
                description: r.description,
                markers: r.markers,
            })),
            marker: null,
        };
    }

    private _convertNotificationSubscription(
        sub: PrismaNotificationSubscription
    ): NotificationSubscription {
        const pushSubscription = PUSH_SUBSCRIPTION_SCHEMA.parse(
            sub.pushSubscription
        );

        return {
            id: sub.id,
            recordName: sub.recordName,
            notificationAddress: sub.notificationAddress,
            userId: sub.userId,
            active: sub.active,
            pushSubscription: pushSubscription,
        };
    }
}
