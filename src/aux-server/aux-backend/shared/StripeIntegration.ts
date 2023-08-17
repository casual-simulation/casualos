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
    StripeProduct,
    StripeSubscription,
    StripeSubscriptionItem,
} from '@casual-simulation/aux-records';
import Stripe from 'stripe';

/**
 * Defines a concrete implementation of the Stripe Interface that is used by SubscriptionController.
 */
export class StripeIntegration implements StripeInterface {
    private _stripe: Stripe;
    private _publishableKey: string;

    get publishableKey() {
        return this._publishableKey;
    }

    constructor(stripe: Stripe, publishableKey: string) {
        this._stripe = stripe;
        this._publishableKey = publishableKey;
    }

    async listPricesForProduct(product: string): Promise<StripePrice[]> {
        const prices = await this._stripe.prices.list({
            product: product,
        });

        return prices.data;
    }

    async getProductAndPriceInfo(product: string): Promise<StripeProduct> {
        const p = await this._stripe.products.retrieve(product, {
            expand: ['default_price'],
        });

        return p as StripeProduct;
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
        });

        const productIds = new Set<string>();
        for (let s of result.data) {
            for (let i of s.items.data) {
                productIds.add(i.price.product as string);
            }
        }

        const products = await this._stripe.products.list({
            ids: [...productIds],
        });

        const productsById = new Map<string, Stripe.Product>();
        for (let p of products.data) {
            productsById.set(p.id, p);
        }

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
                    const product = productsById.get(i.price.product as string);
                    return {
                        id: i.id,
                        price: {
                            id: price.id,
                            interval: price.recurring.interval,
                            interval_count: price.recurring.interval_count,
                            unit_amount: price.unit_amount,
                            currency: price.currency,
                            product: {
                                id: product?.id ?? (price.product as string),
                                name: product.name ?? '',
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

    async getSubscriptionById(
        id: string
    ): Promise<Omit<StripeSubscription, 'items'>> {
        return await this._stripe.subscriptions.retrieve(id);
    }
}
