import { CrudRecordsStore, ListCrudStoreByMarkerRequest, ListCrudStoreSuccess, StudioStripeAccountStatus } from '@casual-simulation/aux-records';
import { PurchasableItem, PurchasableItemMetrics } from '@casual-simulation/aux-records/casualware/PurchasableItemRecordsStore';
import { PrismaClient, Prisma } from '../generated';
import { PrismaMetricsStore } from '../PrismaMetricsStore';
import { convertToMillis } from '../Utils';

export class PrismaPurchasableItemRecordsStore implements CrudRecordsStore<PurchasableItem, PurchasableItemMetrics> {

    private _client: PrismaClient;
    private _metrics: PrismaMetricsStore;

    constructor(client: PrismaClient, metrics: PrismaMetricsStore) {
        this._client = client;
        this._metrics = metrics;
    }

    async createItem(recordName: string, item: PurchasableItem): Promise<void> {
        await this._client.purchasableItemRecord.create({
            data: {
                recordName: recordName,
                address: item.address,
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            }
        });
    }

    async getItemByAddress(recordName: string, address: string): Promise<PurchasableItem> {
        const item = await this._client.purchasableItemRecord.findUnique({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address
                }
            }
        });

        return item;
    }

    async updateItem(recordName: string, item: Partial<PurchasableItem>): Promise<void> {
        await this._client.purchasableItemRecord.update({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address
                }
            },
            data: {
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            }
        });
    }

    async putItem(recordName: string, item: Partial<PurchasableItem>): Promise<void> {
        await this._client.purchasableItemRecord.upsert({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: item.address
                }
            },
            create: {
                recordName: recordName,
                address: item.address,
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            },
            update: {
                name: item.name,
                description: item.description,
                imageUrls: item.imageUrls,
                cost: item.cost,
                currency: item.currency,
                taxCode: item.taxCode,
                roleName: item.roleName,
                roleGrantTimeMs: item.roleGrantTimeMs,
                markers: item.markers,
            }
        });
    }

    async deleteItem(recordName: string, address: string): Promise<void> {
        await this._client.purchasableItemRecord.delete({
            where: {
                recordName_address: {
                    recordName: recordName,
                    address: address
                }
            }
        });
    }

    async listItems(recordName: string, address: string): Promise<ListCrudStoreSuccess<PurchasableItem>> {
        let query: Prisma.PurchasableItemRecordWhereInput = {
            recordName: recordName,
        };

        if (address) {
            query.address = {
                gt: address
            };
        }

        const [count, items] = await Promise.all([
            this._client.purchasableItemRecord.count({
                where: {
                    recordName: recordName
                }
            }),
            this._client.purchasableItemRecord.findMany({
                where: query,
                orderBy: {
                    address: 'asc'
                },
                take: 50
            })
        ]);

        return {
            success: true,
            items,
            marker: null,
            totalCount: count,
        };
    }

    async listItemsByMarker(request: ListCrudStoreByMarkerRequest): Promise<ListCrudStoreSuccess<PurchasableItem>> {
        let query: Prisma.PurchasableItemRecordWhereInput = {
            recordName: request.recordName,
            markers: { has: request.marker }
        };

        if (request.startingAddress) {
            query.address = {
                gt: request.startingAddress
            };
        }

        const [count, items] = await Promise.all([
            this._client.purchasableItemRecord.count({
                where: {
                    recordName: request.recordName,
                    markers: { has: request.marker }
                }
            }),
            this._client.purchasableItemRecord.findMany({
                where: query,
                orderBy: {
                    address: request.sort === 'descending' ? 'desc' : 'asc'
                },
                take: 50
            })
        ]);

        return {
            success: true,
            items,
            marker: request.marker,
            totalCount: count,
        };
    }

    async getSubscriptionMetricsByRecordName(recordName: string): Promise<PurchasableItemMetrics> {
        const info = await this._metrics.findSubscriptionInfoByRecordName(recordName);

        let filter: Prisma.PurchasableItemRecordWhereInput = {};

        if (info.owner) {
            filter.record = {
                ownerId: info.owner.id,
            };
        } else {
            filter.record = {
                studioId: info.studio.id,
            };
        }

        const totalPurchasableItems = await this._client.purchasableItemRecord.count({
            where: filter
        });

        return {
            recordName,
            ownerId: info.owner?.id,
            studioId: info.studio?.id,
            subscriptionId:
                info.owner?.subscriptionId || info.studio?.subscriptionId,
            subscriptionStatus:
                info.owner?.subscriptionStatus ||
                info.studio?.subscriptionStatus,
            subscriptionType: info.owner ? 'user' : 'studio',
            totalPurchasableItems: totalPurchasableItems,
            stripeAccountId: info.studio?.stripeAccountId,
            stripeAccountStatus: info.studio?.stripeAccountStatus as StudioStripeAccountStatus,
            ...(await this._metrics.getSubscriptionPeriod(
                info.owner?.subscriptionStatus ||
                    info.studio?.subscriptionStatus,
                convertToMillis(
                    info.owner?.subscriptionPeriodStart ||
                        info.studio?.subscriptionPeriodStart
                ),
                convertToMillis(
                    info.owner?.subscriptionPeriodEnd ||
                        info.studio?.subscriptionPeriodEnd
                )
            )),
        }
    }

    
}