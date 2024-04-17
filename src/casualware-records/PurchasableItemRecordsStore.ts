import { CrudRecord, CrudRecordsStore, CrudSubscriptionMetrics } from '@casual-simulation/aux-records';

/**
 * Defines a controller that is able to interact with and manage purchasable items.
 */
export interface PurchasableItemRecordsStore extends CrudRecordsStore<PurchasableItem, PurchasableItemMetrics> {
    
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
     * The Stripe link that the item can be purchased at.
     */
    stripePurchaseLink: string;

    /**
     * The URL that the user should be redirected to after they purchase the item.
     */
    redirectUrl: string;

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
export interface PurchasableItemMetrics extends CrudSubscriptionMetrics {}