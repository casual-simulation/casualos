import {
    StripeCheckoutRequest,
    StripeCheckoutResponse,
    StripeCreateCustomerRequest,
    StripeCreateCustomerResponse,
    StripeEvent,
    StripeInterface,
    StripeListActiveSubscriptionsResponse,
    StripePortalRequest,
    StripePortalResponse,
    StripePrice,
    StripeSubscriptionItem,
} from '@casual-simulation/aux-records';
import Stripe from 'stripe';

/**
 * Defines a concrete implementation of the Stripe Interface that is used by SubscriptionController.
 */
export class StripeIntegration implements StripeInterface {
    private _stripe: Stripe;

    constructor(stripe: Stripe) {
        this._stripe = stripe;
    }

    async listPricesForProduct(product: string): Promise<StripePrice[]> {
        const prices = await this._stripe.prices.list({
            product: product,
        });

        return prices.data;
    }

    async createCheckoutSession(
        request: StripeCheckoutRequest
    ): Promise<StripeCheckoutResponse> {
        const result = await this._stripe.checkout.sessions.create({
            ...request,
        });

        return {
            url: result.url,
        };
    }

    async createPortalSession(
        request: StripePortalRequest
    ): Promise<StripePortalResponse> {
        const result = await this._stripe.billingPortal.sessions.create({
            customer: request.customer,
            return_url: request.return_url,
        });

        return {
            url: result.url,
        };
    }

    async createCustomer(
        request: StripeCreateCustomerRequest
    ): Promise<StripeCreateCustomerResponse> {
        const response = await this._stripe.customers.create({
            ...request,
        });

        return response;
    }

    async listActiveSubscriptionsForCustomer(
        id: string
    ): Promise<StripeListActiveSubscriptionsResponse> {
        const result = await this._stripe.subscriptions.list({
            customer: id,
            limit: 5,
            expand: ['items.data.price.product'],
        });

        // result.data[0].items.
        return {
            subscriptions: result.data.map((s) => ({
                id: s.id,
                status: s.status,
                start_date: s.start_date,
                current_period_start: s.current_period_start,
                current_period_end: s.current_period_end,
                cancel_at: s.cancel_at,
                canceled_at: s.canceled_at,
                ended_at: s.ended_at,
                items: s.items.data.map((i) => {
                    const price = i.price;
                    const product = i.price.product as Stripe.Product;
                    return {
                        id: i.id,
                        price: {
                            id: price.id,
                            interval: price.recurring.interval,
                            interval_count: price.recurring.interval_count,
                            unit_amount: price.unit_amount,
                            currency: price.currency,
                            product: {
                                id: product.id,
                                name: product.name,
                            },
                        },
                    } as StripeSubscriptionItem;
                }),
            })),
        };
    }

    constructWebhookEvent(
        payload: string,
        signature: string,
        secret: string
    ): StripeEvent {
        return this._stripe.webhooks.constructEvent(payload, signature, secret);
    }
}
