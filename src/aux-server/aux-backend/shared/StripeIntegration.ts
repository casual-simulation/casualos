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
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';
import {
    SEMATTRS_PEER_SERVICE,
    SEMRESATTRS_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import type Stripe from 'stripe';

const TRACE_NAME = 'StripeIntegration';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.CLIENT,
    attributes: {
        [SEMATTRS_PEER_SERVICE]: 'stripe',
        [SEMRESATTRS_SERVICE_NAME]: 'stripe',
    },
};

/**
 * Defines a concrete implementation of the Stripe Interface that is used by SubscriptionController.
 */
export class StripeIntegration implements StripeInterface {
    private _stripe: Stripe;
    private _publishableKey: string;
    private _testClock: string;

    get publishableKey() {
        return this._publishableKey;
    }

    constructor(stripe: Stripe, publishableKey: string, testClock?: string) {
        this._stripe = stripe;
        this._publishableKey = publishableKey;
        this._testClock = testClock;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async listPricesForProduct(product: string): Promise<StripePrice[]> {
        const prices = await this._stripe.prices.list({
            product: product,
        });

        return prices.data;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getProductAndPriceInfo(product: string): Promise<StripeProduct> {
        const p = await this._stripe.products.retrieve(product, {
            expand: ['default_price'],
        });

        return p as StripeProduct;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
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

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async createPortalSession(
        request: StripePortalRequest
    ): Promise<StripePortalResponse> {
        const result = await this._stripe.billingPortal.sessions.create({
            ...request,
        });

        return {
            url: result.url,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async createCustomer(
        request: StripeCreateCustomerRequest
    ): Promise<StripeCreateCustomerResponse> {
        const response = await this._stripe.customers.create({
            ...request,
            test_clock: this._testClock,
        });

        return response;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
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

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getSubscriptionById(
        id: string
    ): Promise<Omit<StripeSubscription, 'items'>> {
        return await this._stripe.subscriptions.retrieve(id);
    }
}
