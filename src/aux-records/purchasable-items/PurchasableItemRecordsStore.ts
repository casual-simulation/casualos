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
import type { SubscriptionFilter } from '../MetricsStore';
import type { StudioStripeAccountStatus } from '../RecordsStore';
import type {
    CrudRecord,
    CrudRecordsStore,
    CrudSubscriptionMetrics,
} from '../crud/CrudRecordsStore';

/**
 * Defines a controller that is able to interact with and manage purchasable items.
 */
export interface PurchasableItemRecordsStore
    extends CrudRecordsStore<PurchasableItem> {
    /**
     * Gets the item metrics for the subscription of the given record.
     * @param recordName The name of the record.
     */
    getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<PurchasableItemMetrics>;
}

/**
 * Defines a purchasable item.
 * That is, an item that can be purchased by a user to grant them a role.
 */
export interface PurchasableItem extends CrudRecord {
    /**
     * The name of the item.
     */
    name: string;

    /**
     * The description of the item.
     */
    description: string;

    /**
     * The list of image URLs that represent the item.
     */
    imageUrls: string[];

    /**
     * The [3-letter ISO currency code](https://www.iso.org/iso-4217-currency-codes.html) that the item is priced in.
     *
     * See https://www.iso.org/iso-4217-currency-codes.html
     */
    currency: string;

    /**
     * The cost of the item in the currency's smallest unit. (e.g. cents, pence, etc.)
     */
    cost: number;

    /**
     * The [tax code](https://docs.stripe.com/tax/tax-codes) for the item.
     * Currently only stripe tax codes are supported.
     *
     * See https://docs.stripe.com/tax/tax-codes
     */
    taxCode?: string | null;

    /**
     * The name of the role that the item grants.
     */
    roleName: string;

    /**
     * The amount of time in miliseconds that the role is granted for after purchase.
     * If null, then the role is granted forever.
     */
    roleGrantTimeMs: number | null;
}

/**
 * Defines the subscription metrics for a purchasable item.
 */
export interface PurchasableItemMetrics extends CrudSubscriptionMetrics {
    /**
     * The total number of purchasable items that have been recorded.
     */
    totalPurchasableItems: number;

    /**
     * The ID of the stripe account that the record is associated with.
     * Null if the stripe account is not associated with the record.
     */
    stripeAccountId: string | null;

    /**
     * The status of the stripe account that the record is associated with.
     * Null if the stripe account is not associated with the record.
     */
    stripeAccountStatus: StudioStripeAccountStatus | null;
}
