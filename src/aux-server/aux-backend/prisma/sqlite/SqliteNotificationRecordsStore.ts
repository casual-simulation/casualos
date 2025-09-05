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
    NotificationPushSubscription,
    NotificationRecord,
    NotificationRecordsStore,
    NotificationSubscription,
    NotificationSubscriptionMetrics,
    PushSubscriptionUser,
    SaveSubscriptionResult,
    SentNotification,
    SentPushNotification,
    SubscriptionFilter,
    UserPushSubscription,
} from '@casual-simulation/aux-records';
import type {
    ListCrudStoreSuccess,
    ListCrudStoreByMarkerRequest,
} from '@casual-simulation/aux-records/crud';
import type {
    Prisma,
    PrismaClient,
    NotificationSubscription as PrismaNotificationSubscription,
    NotificationRecord as PrismaNotificationRecord,
} from '../generated-sqlite';
import type { SqliteMetricsStore } from './SqliteMetricsStore';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqliteNotificationRecordsStore';

export class SqliteNotificationRecordsStore
    implements NotificationRecordsStore
{
    private _client: PrismaClient;
    private _metrics: SqliteMetricsStore;

    constructor(client: PrismaClient, metrics: SqliteMetricsStore) {
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                endpoint: pushSubscription.endpoint,
                keys: pushSubscription.keys,
                active: pushSubscription.active,
                updatedAt: Date.now(),
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
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
                    updatedAt: Date.now(),
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                recordName: subscription.recordName,
                notificationAddress: subscription.notificationAddress,
                userId: subscription.userId,
                pushSubscriptionId: subscription.pushSubscriptionId,
                updatedAt: Date.now(),
            },
        });
        return {
            success: true,
        };
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
                sentTime: notification.sentTimeMs,
                createdAt: Date.now(),
                updatedAt: Date.now(),
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
                sentTime: notification.sentTimeMs,
                updatedAt: Date.now(),
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                sentNotificationId: push.sentNotificationId,
                pushSubscriptionId: push.pushSubscriptionId,
                userId: push.userId,
                subscriptionId: push.subscriptionId,
                success: push.success,
                errorCode: push.errorCode,
                updatedAt: Date.now(),
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
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
                        lt: metrics.currentPeriodEndMs,
                        gte: metrics.currentPeriodStartMs,
                    },
                },
            }),
            this._client.sentPushNotification.count({
                where: {
                    sentNotification: {
                        ...whereRun,
                        sentTime: {
                            lt: metrics.currentPeriodEndMs,
                            gte: metrics.currentPeriodStartMs,
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
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
            markers: item.markers as string[],
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                description: item.description,
                markers: item.markers,
                updatedAt: Date.now(),
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
                markers: r.markers as string[],
            })),
            marker: null,
        };
    }

    @traced(TRACE_NAME)
    async listItemsByMarker(
        request: ListCrudStoreByMarkerRequest
    ): Promise<ListCrudStoreSuccess<NotificationRecord>> {
        const countPromise = this._client.$queryRaw<
            { count: number }[]
        >`SELECT COUNT(*) FROM "NotificationRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers")`;
        const itemsPromise: Promise<PrismaNotificationRecord[]> =
            !!request.startingAddress
                ? request.sort === 'descending'
                    ? this._client
                          .$queryRaw`SELECT "address", "description", "markers" FROM "NotificationRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" < ${request.startingAddress} ORDER BY "address" DESC LIMIT 25`
                    : this._client
                          .$queryRaw`SELECT "address", "description", "markers" FROM "NotificationRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") AND "address" > ${request.startingAddress} ORDER BY "address" ASC LIMIT 25`
                : this._client
                      .$queryRaw`SELECT "address", "description", "markers" FROM "NotificationRecord" WHERE "recordName" = ${request.recordName} AND ${request.marker} IN json_each("markers") ORDER BY "address" ASC LIMIT 25`;

        const [count, records] = await Promise.all([
            countPromise,
            itemsPromise,
        ]);

        return {
            success: true,
            totalCount: count[0].count,
            items: records.map((r) => ({
                address: r.address,
                description: r.description,
                markers: r.markers as string[],
            })),
            marker: request.marker,
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
