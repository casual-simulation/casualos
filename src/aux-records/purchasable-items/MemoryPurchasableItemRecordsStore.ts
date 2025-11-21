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
    PurchasableItem,
    PurchasableItemMetrics,
    PurchasableItemRecordsStore,
} from './PurchasableItemRecordsStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';
import type { StripeAccountStatus } from '../StripeInterface';

export class MemoryPurchasableItemRecordsStore
    extends MemoryCrudRecordsStore<PurchasableItem, PurchasableItemMetrics>
    implements PurchasableItemRecordsStore
{
    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PurchasableItemMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let stripeAccountId: string | undefined;
        let stripeAccountStatus: StripeAccountStatus | undefined;

        if (info.studioId) {
            const studio = await this.store.getStudioById(info.studioId);
            stripeAccountId = studio?.stripeAccountId;
            stripeAccountStatus = studio?.stripeAccountStatus;
        } else if (info.ownerId) {
            // TODO: Decide wether to support regular users for purchasable items.
            // const owner = await this.store.getXpUserByUserId(info.ownerId);
            // stripeAccountId = owner?.stripeAccountId;
            // stripeAccountStatus = owner?.stripeAccountId;
        }

        let totalItems = 0;
        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId!);

        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        return {
            ...info,
            totalPurchasableItems: totalItems,
            stripeAccountId: stripeAccountId,
            stripeAccountStatus: stripeAccountStatus,
        };
    }
}
