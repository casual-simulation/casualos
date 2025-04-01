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
import { z } from 'zod';

/**
 * Defines an interface that represents the high-level Stripe-like functions that the SubscriptionController uses.
 */
export interface StripeInterface {
    /**
     * Gets the publishable key.
     */
    publishableKey: string;

    /**
     * Lists the prices for the given product.
     * @param product The ID of the product.
     */
    listPricesForProduct(product: string): Promise<StripePrice[]>;

    /**
     * Gets the information about the given product.
     * @param product The product.
     */
    getProductAndPriceInfo(product: string): Promise<StripeProduct>;

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

    /**
     * Parses and validates the given payload into a StripeEvent object.
     * @param payload The raw request payload.
     * @param signature The signature that was included with the payload.
     * @param secret The secret that should be used to validate the payload against the signature.
     */
    constructWebhookEvent(
        payload: string,
        signature: string,
        secret: string
    ): StripeEvent;

    /**
     * Gets the subscription with the given ID.
     *
     * @param id The ID of the subscription.
     */
    getSubscriptionById(id: string): Promise<Omit<StripeSubscription, 'items'>>;
}

export interface StripePrice {
    /**
     * The ID of the price.
     */
    id: string;

    /**
     * The information about how this price has recurring payments.
     */
    recurring: {
        /**
         * The type of recurring interval that is used for this item's price.
         */
        interval: 'month' | 'year' | 'week' | 'day';

        /**
         * The number of intervals that have to happen in order for the subscription to be renewed.
         */
        interval_count: number;
    };

    /**
     * The currency that the scription is renewed in.
     */
    currency: string;

    /**
     * The amount of units that are charged for each renewal.
     */
    unit_amount: number;
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
    customer_email?: string;

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
     */
    client_reference_id?: string;

    /**
     * The metadata to use.
     */
    metadata?: any;
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

/**
 * Events are our way of letting you know when something interesting happens in
 * your account. When an interesting event occurs, we create a new `Event`
 * object. For example, when a charge succeeds, we create a `charge.succeeded`
 * event; and when an invoice payment attempt fails, we create an
 * `invoice.payment_failed` event. Note that many API requests may cause multiple
 * events to be created. For example, if you create a new subscription for a
 * customer, you will receive both a `customer.subscription.created` event and a
 * `charge.succeeded` event.
 *
 * Events occur when the state of another API resource changes. The state of that
 * resource at the time of the change is embedded in the event's data field. For
 * example, a `charge.succeeded` event will contain a charge, and an
 * `invoice.payment_failed` event will contain an invoice.
 *
 * As with other API resources, you can use endpoints to retrieve an
 * [individual event](https://stripe.com/docs/api#retrieve_event) or a [list of events](https://stripe.com/docs/api#list_events)
 * from the API. We also have a separate
 * [webhooks](http://en.wikipedia.org/wiki/Webhook) system for sending the
 * `Event` objects directly to an endpoint on your server. Webhooks are managed
 * in your
 * [account settings](https://dashboard.stripe.com/account/webhooks),
 * and our [Using Webhooks](https://stripe.com/docs/webhooks) guide will help you get set up.
 *
 * When using [Connect](https://stripe.com/docs/connect), you can also receive notifications of
 * events that occur in connected accounts. For these events, there will be an
 * additional `account` attribute in the received `Event` object.
 *
 * **NOTE:** Right now, access to events through the [Retrieve Event API](https://stripe.com/docs/api#retrieve_event) is
 * guaranteed only for 30 days.
 */
export interface StripeEvent {
    /**
     * Unique identifier for the object.
     */
    id: string;

    /**
     * String representing the object's type. Objects of the same type share the same value.
     */
    object: 'event';

    /**
     * The connected account that originated the event.
     */
    account?: string;

    /**
     * The Stripe API version used to render `data`. *Note: This property is populated only for events on or after October 31, 2014*.
     */
    api_version: string | null;

    /**
     * Time at which the object was created. Measured in seconds since the Unix epoch.
     */
    created: number;

    /**
     * The data contained in the event.
     */
    data: StripeEventData;

    /**
     * Has the value `true` if the object exists in live mode or the value `false` if the object exists in test mode.
     */
    livemode: boolean;

    /**
     * Number of webhooks that have yet to be successfully delivered (i.e., to return a 20x response) to the URLs you've specified.
     */
    pending_webhooks: number;

    /**
     * Information on the API request that instigated the event.
     */
    request: StripeEventRequest | null;

    /**
     * Description of the event (e.g., `invoice.created` or `charge.refunded`).
     */
    type: string;
}

export interface StripeEventData {
    /**
     * Object containing the API resource relevant to the event. For example, an `invoice.created` event will have a full [invoice object](https://stripe.com/docs/api#invoice_object) as the value of the object key.
     */
    object: {
        [key: string]: any;
    };

    /**
     * Object containing the names of the attributes that have changed, and their previous values (sent along only with *.updated events).
     */
    previous_attributes?: {
        [key: string]: any;
    };
}

export interface StripeEventRequest {
    /**
     * ID of the API request that caused the event. If null, the event was automatic (e.g., Stripe's automatic subscription handling). Request logs are available in the [dashboard](https://dashboard.stripe.com/logs), but currently not in the API.
     */
    id: string | null;

    /**
     * The idempotency key transmitted during the request, if any. *Note: This property is populated only for events on or after May 23, 2017*.
     */
    idempotency_key: string | null;
}

export interface StripeProduct {
    /**
     * The ID of the product.
     */
    id: string;

    /**
     * The name of the product.
     */
    name: string;

    /**
     * The description of the product.
     */
    description: string;

    /**
     * The default price for the product.
     */
    default_price: StripePrice;
}

export const STRIPE_INVOICE_SCHEMA = z.object({
    id: z.string(),
    currency: z.string(),
    customer: z.string(),
    description: z.string().nullable(),
    subscription: z.string(),
    hosted_invoice_url: z.string(),
    invoice_pdf: z.string(),
    total: z.number(),
    subtotal: z.number(),
    tax: z.number().nullable(),
    status: z.union([
        z.literal('draft'),
        z.literal('open'),
        z.literal('void'),
        z.literal('paid'),
        z.literal('uncollectible'),
    ]),
    paid: z.boolean(),

    lines: z.object({
        object: z.literal('list'),
        data: z.array(
            z.object({
                id: z.string(),
                price: z.object({
                    id: z.string(),
                    product: z.string(),
                }),
            })
        ),
    }),
});

export const STRIPE_EVENT_INVOICE_PAID_SCHEMA = z.object({
    type: z.literal('invoice.paid'),
    data: z.object({
        object: STRIPE_INVOICE_SCHEMA,
    }),
});

export type StripeInvoice = z.infer<typeof STRIPE_INVOICE_SCHEMA>;
