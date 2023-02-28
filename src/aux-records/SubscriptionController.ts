import {
    AuthController,
    INVALID_KEY_ERROR_MESSAGE,
    ValidateSessionKeyFailure,
} from './AuthController';
import { AuthSession, AuthStore } from './AuthStore';
import { StripeEvent, StripeInterface } from './StripeInterface';
import { ServerError } from './Errors';
import { isActiveSubscription } from './Utils';

export interface SubscriptionConfiguration {
    /**
     * The line items that should be included in the checkout request.
     */
    lineItems: {
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
     * The IDs of the products that should be recognized as active subscriptions for the user.
     */
    products: string[];

    /**
     * The webhook secret that should be used for validating webhooks.
     */
    webhookSecret: string;

    /**
     * The URL that the user should be sent to upon successfully purchasing a subscription.
     */
    successUrl: string;

    /**
     * The URL that the user should be sent to upon cancelling a subscription purchase.
     */
    cancelUrl: string;

    /**
     * The URL that the user should be returned to after managing their subscriptions.
     */
    returnUrl: string;
}

/**
 * Defines a class that is able to handle subscriptions.
 */
export class SubscriptionController {
    private _stripe: StripeInterface;
    private _auth: AuthController;
    private _authStore: AuthStore;
    private _config: SubscriptionConfiguration;

    constructor(
        stripe: StripeInterface,
        auth: AuthController,
        authStore: AuthStore,
        config: SubscriptionConfiguration
    ) {
        this._stripe = stripe;
        this._auth = auth;
        this._authStore = authStore;
        this._config = config;
    }

    /**
     * Gets the status of the given user's scription.
     * @param request
     */
    async getSubscriptionStatus(
        request: GetSubscriptionStatusRequest
    ): Promise<GetSubscriptionStatusResult> {
        try {
            if (typeof request.userId !== 'string' || request.userId === '') {
                return {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage:
                        'The given user ID is invalid. It must be a correctly formatted string.',
                };
            }

            const keyResult = await this._auth.validateSessionKey(
                request.sessionKey
            );

            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                console.log(
                    '[SubscriptionController] [getSubscriptionStatus] Request User ID doesnt match session key User ID!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            const user = await this._authStore.findUser(keyResult.userId);
            let customerId = user.stripeCustomerId;

            if (!customerId) {
                return {
                    success: true,
                    userId: keyResult.userId,
                    subscriptions: [],
                };
            }

            const listResult =
                await this._stripe.listActiveSubscriptionsForCustomer(
                    customerId
                );

            const subscriptions: SubscriptionStatus[] =
                listResult.subscriptions.map((s) => {
                    const item = s.items[0];
                    return {
                        active: s.status === 'active',
                        statusCode: s.status,
                        startDate: s.start_date,
                        cancelDate: s.cancel_at,
                        canceledDate: s.canceled_at,
                        endedDate: s.ended_at,
                        currentPeriodEnd: s.current_period_end,
                        currentPeriodStart: s.current_period_start,
                        renewalInterval: item.price.interval,
                        intervalLength: item.price.interval_count,
                        intervalCost: item.price.unit_amount,
                        currency: item.price.currency,
                        productName: item.price.product.name,
                    };
                });

            return {
                success: true,
                userId: keyResult.userId,
                subscriptions,
            };
        } catch (err) {
            console.log(
                '[SubscriptionController] An error occurred while getting subscription status:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Creates a link that the user can be redirected to in order to manage their subscription.
     * Returns a link that the user can be redirected to to initiate a purchase of the subscription.
     */
    async createManageSubscriptionLink(
        request: CreateManageSubscriptionRequest
    ): Promise<CreateManageSubscriptionResult> {
        try {
            if (typeof request.userId !== 'string' || request.userId === '') {
                return {
                    success: false,
                    errorCode: 'unacceptable_user_id',
                    errorMessage:
                        'The given user ID is invalid. It must be a correctly formatted string.',
                };
            }

            const keyResult = await this._auth.validateSessionKey(
                request.sessionKey
            );

            if (keyResult.success === false) {
                return keyResult;
            } else if (keyResult.userId !== request.userId) {
                console.log(
                    '[SubscriptionController] [createManageSubscriptionLink] Request User ID doesnt match session key User ID!'
                );
                return {
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                };
            }

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Creating a checkout/management session for User (${keyResult.userId}).`
            );
            const user = await this._authStore.findUser(keyResult.userId);
            let customerId = user.stripeCustomerId;

            if (!customerId) {
                console.log(
                    '[SubscriptionController] [createManageSubscriptionLink] No Stripe Customer ID. Creating New Customer and Checkout Session in Stripe.'
                );
                const result = await this._stripe.createCustomer({
                    name: user.name,
                    email: user.email,
                    phone: user.phoneNumber,
                });

                customerId = user.stripeCustomerId = result.id;
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Saving Stripe Customer ID (${customerId}) to User Record (${user.id}).`
                );
                await this._authStore.saveUser({
                    ...user,
                });

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Creating Checkout Session.`
                );

                const session = await this._stripe.createCheckoutSession({
                    customer: customerId,
                    success_url: this._config.successUrl,
                    cancel_url: this._config.cancelUrl,
                    line_items: this._config.lineItems,
                    customer_email: user.email,
                    mode: 'subscription',
                });

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Checkout Session Success!`
                );
                return {
                    success: true,
                    url: session.url,
                };
            }

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] User (${user.id}) Has Stripe Customer ID (${user.stripeCustomerId}). Checking active subscriptions for customer.`
            );
            const subs = await this._stripe.listActiveSubscriptionsForCustomer(
                customerId
            );

            const hasSubscription = subs.subscriptions.some((s) => {
                const isManagable =
                    s.status === 'active' ||
                    s.status === 'trialing' ||
                    s.status === 'paused' ||
                    s.status === 'incomplete' ||
                    s.status === 'past_due' ||
                    s.status === 'unpaid';

                if (!isManagable) {
                    return false;
                }

                const hasManagableProduct = this._config.products.some((p) =>
                    s.items.some((i) => i.price.product.id === p)
                );

                return hasManagableProduct;
            });

            if (hasSubscription) {
                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Customer has a managable subscription. Creating a portal session.`
                );
                const session = await this._stripe.createPortalSession({
                    customer: customerId,
                    return_url: this._config.returnUrl,
                });

                console.log(
                    `[SubscriptionController] [createManageSubscriptionLink] Portal session success!`
                );

                return {
                    success: true,
                    url: session.url,
                };
            }

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Customer does not have a managable subscription. Creating a checkout session.`
            );
            const session = await this._stripe.createCheckoutSession({
                customer: customerId,
                success_url: this._config.successUrl,
                cancel_url: this._config.cancelUrl,
                line_items: this._config.lineItems,
                customer_email: user.email,
                mode: 'subscription',
            });

            console.log(
                `[SubscriptionController] [createManageSubscriptionLink] Checkout Session Success!`
            );
            return {
                success: true,
                url: session.url,
            };
        } catch (err) {
            console.log(
                '[SubscriptionController] An error occurred while creating a manage subscription link:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Handles the webhook from Stripe for updating the internal database.
     */
    async handleStripeWebhook(
        request: HandleStripeWebhookRequest
    ): Promise<HandleStripeWebhookResponse> {
        try {
            if (
                typeof request.requestBody !== 'string' ||
                request.requestBody === ''
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            if (
                typeof request.signature !== 'string' ||
                request.signature === ''
            ) {
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            const body = request.requestBody;
            const signature = request.signature;
            let event: StripeEvent;
            try {
                event = this._stripe.constructWebhookEvent(
                    body,
                    signature,
                    this._config.webhookSecret
                );
            } catch (err) {
                console.log(
                    `[SubscriptionController] [handleStripeWebhook] Unable to construct webhook event:`,
                    err
                );
                return {
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The request was not valid.',
                };
            }

            console.log(
                `[SubscriptionController] [handleStripeWebhook] Got event: ${event.type}`
            );
            if (
                event.type === 'customer.subscription.created' ||
                event.type === 'customer.subscription.deleted' ||
                event.type === 'customer.subscription.updated'
            ) {
                const subscription = event.data.object;
                const status = subscription.status;
                const active = isActiveSubscription(status);
                const customerId = subscription.customer;

                console.log(
                    `[SubscriptionController] [handleStripeWebhook] Customer ID: ${customerId}. Subscription status: ${status}. Is Active: ${active}.`
                );
                const user = await this._authStore.findUserByStripeCustomerId(
                    customerId
                );

                if (!user) {
                    console.log(
                        `[SubscriptionController] [handleStripeWebhook] No user found for Customer ID (${customerId})`
                    );
                    return {
                        success: true,
                    };
                }

                if (user.subscriptionStatus !== status) {
                    console.log(
                        `[SubscriptionController] [handleStripeWebhook] User subscription status doesn't match stored. Updating...`
                    );
                    await this._authStore.saveUser({
                        ...user,
                        subscriptionStatus: status,
                    });
                }
            }

            return {
                success: true,
            };
        } catch (err) {
            console.log(
                '[SubscriptionController] An error occurred while handling a stripe webhook:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

/**
 * Defines a request for managing a user's subscription.
 */
export interface CreateManageSubscriptionRequest {
    /**
     * The session key that should be used to validate the request.
     */
    sessionKey: string;

    /**
     * The User ID that the management session should be created for.
     */
    userId: string;
}

export type CreateManageSubscriptionResult =
    | CreateManageSubscriptionSuccess
    | CreateManageSubscriptionFailure;

export interface CreateManageSubscriptionSuccess {
    success: true;

    /**
     * The URL that the user should be redirected to.
     */
    url: string;
}

export interface CreateManageSubscriptionFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | ValidateSessionKeyFailure['errorCode']
        | 'unacceptable_user_id';

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface GetSubscriptionStatusRequest {
    /**
     * The session key that should be used to validate the request.
     */
    sessionKey: string;

    /**
     * The ID of the user whose subscription status should be retrieved.
     */
    userId: string;
}

export type GetSubscriptionStatusResult =
    | GetSubscriptionStatusSuccess
    | GetSubscriptionStatusFailure;

export interface GetSubscriptionStatusSuccess {
    success: true;

    /**
     * The ID of the user.
     */
    userId: string;

    /**
     * The list of subscriptions that the user has.
     */
    subscriptions: SubscriptionStatus[];
}

export interface SubscriptionStatus {
    /**
     * Whether the user has an active subscription.
     */
    active: boolean;

    /**
     * The status code for the subscription.
     *
     * Possible values are `incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, or `unpaid`.
     * For collection_method=charge_automatically a subscription moves into incomplete if the initial payment attempt fails. A subscription in this state can only have metadata and default_source updated. Once the first invoice is paid, the subscription moves into an active state. If the first invoice is not paid within 23 hours, the subscription transitions to incomplete_expired. This is a terminal state, the open invoice will be voided and no further invoices will be generated.
     *
     * A subscription that is currently in a trial period is trialing and moves to active when the trial period is over.
     *
     * If subscription collection_method=charge_automatically it becomes past_due when payment to renew it fails and canceled or unpaid (depending on your subscriptions settings) when Stripe has exhausted all payment retry attempts.
     *
     * If subscription collection_method=send_invoice it becomes past_due when its invoice is not paid by the due date, and canceled or unpaid if it is still not paid by an additional deadline after that. Note that when a subscription has a status of unpaid, no subsequent invoices will be attempted (invoices will be created, but then immediately automatically closed). After receiving updated payment information from a customer, you may choose to reopen and pay their closed invoices.
     */
    statusCode:
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
     * The name of the product.
     */
    productName: string;

    /**
     * The Unix time in seconds that the subscription was started at.
     */
    startDate: number;

    /**
     * The Unix time in seconds that the subscription ended at.
     */
    endedDate: number | null;

    /**
     * The Unix time in seconds when the subscription will be canceled.
     */
    cancelDate: number | null;

    /**
     * The Unix time in seconds when the subscription was canceled.
     */
    canceledDate: number | null;

    /**
     * The Unix time in seconds of the start of the current period that the subscription has been invoiced for.
     */
    currentPeriodStart: number | null;

    /**
     * The Unix time in seconds of the end of the current period that the subscription has been invoiced for.
     */
    currentPeriodEnd: number | null;

    /**
     * How frequently the subscription renews.
     */
    renewalInterval: 'month' | 'year' | 'week' | 'day';

    /**
     * The number of months/years/weeks/days that the interval lasts for.
     */
    intervalLength: number;

    /**
     * The price charged per interval.
     */
    intervalCost: number;

    /**
     * The currency that was used.
     */
    currency: string;
}

export interface GetSubscriptionStatusFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | ValidateSessionKeyFailure['errorCode']
        | 'unacceptable_user_id';

    /**
     * The error message.
     */
    errorMessage: string;
}

export interface HandleStripeWebhookRequest {
    /**
     * The raw request body.
     */
    requestBody: string;

    /**
     * The signature that was included with the request.
     */
    signature: string;
}

export type HandleStripeWebhookResponse =
    | HandleStripeWebhookSuccess
    | HandleStripeWebhookFailure;

export interface HandleStripeWebhookSuccess {
    success: true;
}

export interface HandleStripeWebhookFailure {
    success: false;
    errorCode: ServerError | 'invalid_request';
    errorMessage: string;
}
