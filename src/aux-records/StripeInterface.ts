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
     * Gets the stripe interface that can be used for testing.
     * Null if testing is not supported.
     */
    test?: StripeInterface | null;

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
     * Gets the checkout session with the given ID.
     * @param id The ID of the checkout session.
     */
    getCheckoutSessionById(id: string): Promise<StripeCheckoutResponse>;

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

    /**
     * Creates a new account link for the given account ID.
     * @param accountId 
     */
    createAccountLink(request: StripeCreateAccountLinkRequest): Promise<StripeAccountLink>;

    /**
     * Creates a new stripe account.
     * @param request The request.
     */
    createAccount(request: StripeCreateAccountRequest): Promise<StripeAccount>;

    /**
     * Gets the stripe account with the given ID.
     * @param id The ID of the account.
     */
    getAccountById(id: string): Promise<StripeAccount | null>;
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
        price?: string;

        /**
         * The data for the price.
         */
        price_data?: {
            /**
             * The currency of the price.
             */
            currency: string;

            /**
             * The cost in cents of the price.
             */
            unit_amount: number;

            /**
             * The ID of the product.
             */
            product?: string;

            product_data?: {
                /**
                 * The name of the product.
                 */
                name: string;

                /**
                 * The description for the product.
                 */
                description: string;

                /**
                 * The list of image URLs for the product.
                 */
                images: string[];

                /**
                 * The metadata for the product.
                 */
                metadata: any;

                /**
                 * The tax code for the product.
                 */
                tax_code?: string | null;
            }
        };

        /**
         * The quantity to purchase.
         */
        quantity?: number;
    }[];

    /**
     * The mode that the checkout should use.
     */
    mode: 'subscription' | 'payment';

    /**
     * The ID of the customer that the checkout request should be used.
     */
    customer?: string;

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

    /**
     * Data about the payment intent.
     */
    payment_intent_data?: {
        /**
         * The fee that should be charged for the application.
         */
        application_fee_amount?: number;
    }

    /**
     * Stripe connect information.
     */
    connect?: {
        /**
         * The ID of the stripe account that the checkout session should be connected to.
         */
        stripeAccount: string;
    }
}

export interface StripeCheckoutResponse {
    /**
     * The URL that the user should be redirected to.
     */
    url: string;

    /**
     * The ID of the checkout session.
     */
    id: string;

    /**
     * The invoice that was created for the checkout session.
     */
    invoice?: StripeInvoice | null;

    /**
     * The payment status of the checkout session.
     */
    payment_status: StripePaymentStatus;

    /**
     * The status of the checkout session.
     */
    status: StripeCheckoutStatus;
}

/**
 * The payment status of a stripe payment.
 */
export type StripePaymentStatus = 'no_payment_required' | 'paid' | 'unpaid';

export type StripeCheckoutStatus = 'open' | 'complete' | 'expired';

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

export interface StripeCreateAccountLinkRequest {
    /**
     * The ID of the account.
     */
    account: string;

    /**
     * The type of account link the user is requesting.
     */
    type: 'account_onboarding' | 'account_update';

    /**
     * The URL the user will be redirected to if the account link is expired, has been previously-visited, or is otherwise invalid.
     * The URL you specify should attempt to generate a new account link with the same parameters used to create the original account link, then redirect the user to the new account link’s URL so they can continue with Connect Onboarding. If a new account link cannot be generated or the redirect fails you should display a useful error to the user.
     */
    refresh_url: string;

    /**
     * The URL that the user will be redirected to upon leaving or completing the linked flow.
     */
    return_url: string;
}

export interface StripeCreateAccountRequest {
    /**
     * The type of stripe account to create.
     */
    type?: 'custom' | 'express' | 'standard';

    /**
     * Information about how the account is controlled.
     */
    controller: {
        /**
         * A value indicating the responsible payer of Stripe fees on this account. Defaults to account. Learn more about [fee behavior on connected accounts](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior).
         */
        fees: {
            /**
             * Who pays Stripe fees?
             * 
             * - `account`: The account pays the fees.
             * - `application`: Our application pays the fees.
             */
            payer: 'account' | 'application';
        };

        /**
         * A hash of configuration for products that have negative balance liability, and whether Stripe or a Connect application is responsible for them.
         */
        losses?: {
            /**
             * A value indicating who is liable when this account can’t pay back negative balances resulting from payments. Defaults to `stripe`.
             * 
             * - `application`: The Connect application is liable when this account can’t pay back negative balances resulting from payments.
             * - `stripe`: Stripe is liable when this account can’t pay back negative balances resulting from payments.
             */
            payments?: 'application' | 'stripe';
        }

        /**
         * A value indicating responsibility for collecting updated information when requirements on the account are due or change. Defaults to `stripe`.
         * 
         * - `application`: The Connect application is responsible for collecting updated information when requirements on the account are due or change.
         * - `none`: No one is responsible for collecting updated information when requirements on the account are due or change.
         */
        requirement_collection?: 'stripe' | 'application';

        /**
         * A hash of configuration for Stripe-hosted dashboards.
         */
        stripe_dashboard?: {
            /**
             * Whether this account should have access to the full Stripe Dashboard (`full`), to the Express Dashboard (`express`), or to no Stripe-hosted dashboard (`none`). Defaults to `full`.
             */
            type?: 'express' | 'full' | 'none';
        }
    };

    /**
     * Metadata about the account.
     */
    metadata?: {
        [key: string]: string;
    };
}

export interface StripeAccount {
    /**
     * The ID of the account.
     */
    id: string;

    /**
     * The requirements that stripe needs for the account.
     */
    requirements: StripeAccountRequirements | null;

    /**
     * Whether the account can create live charges.
     */
    charges_enabled: boolean;

    /**
     * Metadata about the account.
     */
    metadata?: {
        [key: string]: string;
    };
}

export interface StripeAccountRequirements {
    /**
     * The requirements that are currently due.
     */
    currently_due: string[] | null;

    /**
     * The requirements that are eventually due.
     */
    eventually_due: string[] | null;

    /**
     * The requirements that are past due.
     */
    past_due: string[] | null;

    /**
     * The requirements that are pending verification.
     */
    pending_verification: string[] | null;

    /**
     * The reason why the account is disabled.
     */
    disabled_reason: string | null;

    /**
     * The timestamp of the deadline for the requirements.
     */
    current_deadline: number | null;

    /**
     * Fields that are currently_due and need to be collected again because validation or verification failed.
     */
    errors: {
        /**
         * The code of the error.
         */
        code: string;

        /**
         * The informative message about the error.
         */
        reason: string;

        /**
         * The field that the error is related to.
         */
        requirement: string;
    }[] | null;
}

export interface StripeAccountLink {
    /**
     * The URL that the user can visit to open their account.
     */
    url: string;
}

export const STRIPE_INVOICE_SCHEMA = z.object({
    id: z.string(),
    currency: z.string(),
    customer: z.string(),
    description: z.string().nullable(),
    subscription: z.string().nullable().optional(),
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

export const STRIPE_EVENT_ACCOUNT_UPDATED_SCHEMA = z.object({
    type: z.literal('account.updated'),
    data: z.object({
        object: z.object({
            id: z.string(),
            object: z.literal('account'),
        })
    }),
});

export const STRIPE_EVENT_CHECKOUT_SESSION_SCHEMA = z.object({
    data: z.object({
        object: z.object({
            id: z.string(),
            client_reference_id: z.string().nullable(),
            object: z.literal('checkout.session'),
            status: z.enum([
                'complete',
                'expired',
                'open'
            ]),
            payment_status: z.enum([
                'no_payment_required',
                'paid',
                'unpaid',
            ]),
        })
    }),
});