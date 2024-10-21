import {
    NotificationPushSubscription,
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    PUSH_SUBSCRIPTION_SCHEMA,
    PushSubscriptionUser,
    SaveSubscriptionResult,
    SentNotification,
    SentPushNotification,
    SubscriptionFilter,
    UserPushSubscription,
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
    async savePushSubscription(
        pushSubscription: NotificationPushSubscription
    ): Promise<void> {
        await this._client.pushSubscription.upsert({
            where: {
                id: pushSubscription.id,
            },
            create: {
                id: pushSubscription.id,
                endpoint: pushSubscription.endpoint,
                keys: pushSubscription.keys,
                active: pushSubscription.active,
            },
            update: {
                endpoint: pushSubscription.endpoint,
                keys: pushSubscription.keys,
                active: pushSubscription.active,
            },
        });
    }

    @traced(TRACE_NAME)
    async savePushSubscriptionUser(
        pushSubscription: PushSubscriptionUser
    ): Promise<void> {
        await this._client.pushSubscriptionUser.upsert({
            where: {
                pushSubscriptionId_userId: {
                    pushSubscriptionId: pushSubscription.pushSubscriptionId,
                    userId: pushSubscription.userId,
                },
            },
            create: {
                pushSubscriptionId: pushSubscription.pushSubscriptionId,
                userId: pushSubscription.userId,
            },
            update: {},
        });
    }

    @traced(TRACE_NAME)
    async markPushSubscriptionsInactiveAndDeleteUserRelations(
        ids: string[]
    ): Promise<void> {
        await this._client.$transaction([
            this._client.pushSubscription.updateMany({
                where: {
                    id: {
                        in: ids,
                    },
                },
                data: {
                    active: false,
                },
            }),
            this._client.pushSubscriptionUser.deleteMany({
                where: {
                    pushSubscriptionId: {
                        in: ids,
                    },
                },
            }),
        ]);
    }

    @traced(TRACE_NAME)
    async saveSubscription(
        subscription: NotificationSubscription
    ): Promise<SaveSubscriptionResult> {
        try {
            await this._client.notificationSubscription.upsert({
                where: {
                    id: subscription.id,
                },
                create: {
                    id: subscription.id,
                    recordName: subscription.recordName,
                    notificationAddress: subscription.notificationAddress,
                    userId: subscription.userId,
                    pushSubscriptionId: subscription.pushSubscriptionId,
                },
                update: {
                    recordName: subscription.recordName,
                    notificationAddress: subscription.notificationAddress,
                    userId: subscription.userId,
                    pushSubscriptionId: subscription.pushSubscriptionId,
                },
            });
            return {
                success: true,
            };
        } catch (err) {
            throw err;
        }
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
    async getSubscriptionById(
        id: string
    ): Promise<NotificationSubscription | null> {
        const sub = await this._client.notificationSubscription.findUnique({
            where: {
                id: id,
            },
        });

        return this._convertNotificationSubscription(sub);
    }

    @traced(TRACE_NAME)
    async getSubscriptionByRecordAddressAndUserId(
        recordName: string,
        notificationAddress: string,
        userId: string
    ): Promise<NotificationSubscription | null> {
        const sub = await this._client.notificationSubscription.findUnique({
            where: {
                recordName_notificationAddress_userId: {
                    recordName: recordName,
                    notificationAddress: notificationAddress,
                    userId: userId,
                },
            },
        });

        return this._convertNotificationSubscription(sub);
    }

    @traced(TRACE_NAME)
    async getSubscriptionByRecordAddressAndPushSubscriptionId(
        recordName: string,
        notificationAddress: string,
        pushSubscriptionId: string
    ): Promise<NotificationSubscription | null> {
        const sub = await this._client.notificationSubscription.findUnique({
            where: {
                recordName_notificationAddress_pushSubscriptionId: {
                    recordName: recordName,
                    notificationAddress: notificationAddress,
                    pushSubscriptionId: pushSubscriptionId,
                },
            },
        });

        return this._convertNotificationSubscription(sub);
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
    async saveSentPushNotification(push: SentPushNotification): Promise<void> {
        await this._client.sentPushNotification.upsert({
            where: {
                id: push.id,
            },
            create: {
                id: push.id,
                sentNotificationId: push.sentNotificationId,
                pushSubscriptionId: push.pushSubscriptionId,
                userId: push.userId,
                subscriptionId: push.subscriptionId,
                success: push.success,
                errorCode: push.errorCode,
            },
            update: {
                sentNotificationId: push.sentNotificationId,
                pushSubscriptionId: push.pushSubscriptionId,
                userId: push.userId,
                subscriptionId: push.subscriptionId,
                success: push.success,
                errorCode: push.errorCode,
            },
        });
    }

    @traced(TRACE_NAME)
    async createSentPushNotifications(
        notifications: SentPushNotification[]
    ): Promise<void> {
        await this._client.sentPushNotification.createMany({
            data: notifications.map((p) => ({
                id: p.id,
                sentNotificationId: p.sentNotificationId,
                pushSubscriptionId: p.pushSubscriptionId,
                userId: p.userId,
                subscriptionId: p.subscriptionId,
                success: p.success,
                errorCode: p.errorCode,
            })),
        });
    }

    @traced(TRACE_NAME)
    async listSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<NotificationSubscription[]> {
        const subscriptions =
            await this._client.notificationSubscription.findMany({
                where: {
                    recordName: recordName,
                    notificationAddress: notificationAddress,
                },
            });

        return subscriptions.map((sub) =>
            this._convertNotificationSubscription(sub)
        );
    }

    @traced(TRACE_NAME)
    async listSubscriptionsForUser(
        userId: string
    ): Promise<NotificationSubscription[]> {
        const subscriptions =
            await this._client.notificationSubscription.findMany({
                where: {
                    userId: userId,
                },
            });

        return subscriptions.map((sub) =>
            this._convertNotificationSubscription(sub)
        );
    }

    @traced(TRACE_NAME)
    async listActivePushSubscriptionsForNotification(
        recordName: string,
        notificationAddress: string
    ): Promise<UserPushSubscription[]> {
        const subscriptions = await this._client.$queryRaw<
            UserPushSubscription[]
        >`
            SELECT DISTINCT ON ("id")
                "id",
                "endpoint",
                "keys",
                "active",
                "subscriptionId",
                "userId"
            FROM (
                SELECT
                "PushSubscription"."id" as "id",
                "PushSubscription"."endpoint",
                "PushSubscription"."keys",
                "PushSubscription"."active",
                "NotificationSubscription"."id" as "subscriptionId",
                NULL as "userId"
                FROM "PushSubscription"
                INNER JOIN "NotificationSubscription" ON "NotificationSubscription"."pushSubscriptionId" = "PushSubscription"."id"
                WHERE 
                    "NotificationSubscription"."recordName" = ${recordName} AND 
                    "NotificationSubscription"."notificationAddress" = ${notificationAddress} AND
                    "PushSubscription"."active" = TRUE
                UNION
                SELECT
                    "PushSubscription"."id" as "id",
                    "PushSubscription"."endpoint",
                    "PushSubscription"."keys",
                    "PushSubscription"."active",
                    "NotificationSubscription"."id" as "subscriptionId",
                    "NotificationSubscription"."userId" as "userId"
                FROM "PushSubscription"
                INNER JOIN "PushSubscriptionUser" ON "PushSubscriptionUser"."pushSubscriptionId" = "PushSubscription"."id"
                INNER JOIN "NotificationSubscription" ON "PushSubscriptionUser"."userId" = "NotificationSubscription"."userId"
                WHERE 
                    "PushSubscription".active = TRUE AND
                    "NotificationSubscription"."recordName" = ${recordName} AND 
                    "NotificationSubscription"."notificationAddress" = ${notificationAddress}
            );
        `;

        return subscriptions;
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
            this._client.sentPushNotification.count({
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
        if (!sub) {
            return null;
        }

        return {
            id: sub.id,
            recordName: sub.recordName,
            notificationAddress: sub.notificationAddress,
            userId: sub.userId,
            pushSubscriptionId: sub.pushSubscriptionId,
        };
    }
}
