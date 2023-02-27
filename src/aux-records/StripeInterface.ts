/**
 * Defines an interface that represents the high-level Stripe-like functions that the SubscriptionController uses.
 */
export interface StripeInterface {
    /**
     * Lists the prices for the given product.
     * @param product The ID of the product.
     */
    listPricesForProduct(product: string): Promise<StripePrice[]>;

    /**
     * Creates a new checkout session for a user to use.
     * @param request The checkout session request.
     */
    createCheckoutSession(
        request: StripeCheckoutRequest
    ): Promise<StripeCheckoutResponse>;

    /**
     * Creates a new portal session for a user.
     * @param request The create portal session request.
     */
    createPortalSession(
        request: StripePortalRequest
    ): Promise<StripePortalResponse>;

    /**
     * Creates a new stripe customer.
     * @param request The create customer request.
     */
    createCustomer(
        request: StripeCreateCustomerRequest
    ): Promise<StripeCreateCustomerResponse>;

    /**
     * Lists all the subscriptions that the given customer ID has.
     * @param id The ID of the customer.
     */
    listActiveSubscriptionsForCustomer(
        id: string
    ): Promise<StripeListActiveSubscriptionsResponse>;
}

export interface StripePrice {
    /**
     * The ID of the price.
     */
    id: string;
}

/**
 * A request to create a stripe checkout session.
 */
export interface StripeCheckoutRequest {
    /**
     * The ID of the product that the checkout request is for.
     */
    line_items: {
        /**
         * The ID of the price for the line item.
         */
        price: string;

        /**
         * The quantity to purchase.
         */
        quantity?: number;
    }[];

    /**
     * The mode that the checkout should use.
     */
    mode: 'subscription';

    /**
     * The ID of the customer that the checkout request should be used.
     */
    customer: string;

    /**
     * The email address that should be used for the customer.
     */
    customer_email: string;

    /**
     * The URL that the user should be redirected to after a successful checkout.
     */
    success_url: string;

    /**
     * The URL that the user should be redirected to after an unsuccessful checkout.
     */
    cancel_url: string;

    /**
     * The client reference ID that should be used for the checkout session.
     * Generally, this is the User ID.
     */
    client_reference_id: string;
}

export interface StripeCheckoutResponse {
    /**
     * The URL that the user should be redirected to.
     */
    url: string;
}

export interface StripePortalRequest {
    /**
     * The ID of the customer that the portal request should use.
     */
    customer: string;

    /**
     * The URL that the user should be returned to.
     */
    return_url: string;
}

export interface StripePortalResponse {
    /**
     * The URL that the user should be redirected to.
     */
    url: string;
}

export interface StripeCreateCustomerRequest {
    /**
     * The name of the new customer.
     */
    name?: string;

    /**
     * The email of the customer.
     */
    email?: string;

    /**
     * The phone of the customer.
     */
    phone?: string;

    /**
     * Abitrary description for the customer. For internal use.
     */
    description?: string;

    /**
     * Metadata about the customer.
     */
    metadata?: {
        [key: string]: string;
    };
}

export interface StripeCreateCustomerResponse {
    /**
     * The ID of the created customer object.
     */
    id: string;
}

export interface StripeListActiveSubscriptionsResponse {
    subscriptions: StripeSubscription[];
}

export interface StripeSubscription {
    /**
     * The ID of the subscription.
     */
    id: string;

    /**
     * The status of the subscription.
     */
    status:
        | 'active'
        | 'canceled'
        | 'ended'
        | 'past_due'
        | 'unpaid'
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'paused';

    /**
     * The Unix time in seconds that the subscription was started at.
     */
    start_date: number;

    /**
     * The Unix time in seconds that the subscription ended at.
     */
    ended_at: number | null;

    /**
     * The Unix time in seconds when the subscription will be canceled.
     */
    cancel_at: number | null;

    /**
     * The Unix time in seconds when the subscription was canceled.
     */
    canceled_at: number | null;

    /**
     * The Unix time in seconds of the start of the current period that the subscription has been invoiced for.
     */
    current_period_start: number | null;

    /**
     * The Unix time in seconds of the end of the current period that the subscription has been invoiced for.
     */
    current_period_end: number | null;

    /**
     * The items contained by the subscription.
     */
    items: StripeSubscriptionItem[];
}

export interface StripeSubscriptionItem {
    /**
     * The ID of the subscription item.
     */
    id: string;

    /**
     * The price that this item was purchased at.
     */
    price: {
        /**
         * The ID of the price.
         */
        id: string;

        /**
         * The type of recurring interval that is used for this item's price.
         */
        interval: 'month' | 'year' | 'week' | 'day';

        /**
         * The number of intervals that have to happen in order for the subscription to be renewed.
         */
        interval_count: number;

        /**
         * The currency that the scription is renewed in.
         */
        currency: string;

        /**
         * The amount of units that are charged for each renewal.
         */
        unit_amount: number;

        product: {
            /**
             * The ID of the product.
             */
            id: string;

            /**
             * The name of the product.
             */
            name: string;
        };
    };
}
