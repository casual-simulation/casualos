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
import {
    StripeAccount,
    StripeAccountLink,
    StripeCheckoutRequest,
    StripeCheckoutResponse,
    StripeCreateAccountLinkRequest,
    StripeCreateAccountRequest,
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
    test?: StripeInterface;
    
    async getCheckoutSessionById(id: string): Promise<StripeCheckoutResponse> {
        const session = await this._stripe.checkout.sessions.retrieve(id, {
            expand: ['invoice']
        });

        return this._convertCheckoutSession(session);
    }

    async createAccountLink(request: StripeCreateAccountLinkRequest): Promise<StripeAccountLink> {
        const link = await this._stripe.accountLinks.create({
            account: request.account,
            refresh_url: request.refresh_url,
            return_url: request.return_url,
            type: request.type,
        });

        return {
            url: link.url,
        };
    }
    
    async createAccount(request: StripeCreateAccountRequest): Promise<StripeAccount> {
        const account = await this._stripe.accounts.create({
            controller: request.controller,
            type: request.type,
            metadata: request.metadata,
        });
        return this._convertToAccount(account);
    }
    
    async getAccountById(id: string): Promise<StripeAccount> {
        const account = await this._stripe.accounts.retrieve(id);
        return this._convertToAccount(account);
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
        const { connect, ...rest } = request;
        const result = await this._stripe.checkout.sessions.create({
            ...rest,
        }, {
            stripeAccount: connect?.stripeAccount,
        });

        return this._convertCheckoutSession(result);
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

    private _convertToAccount(account: Stripe.Response<Stripe.Account>): StripeAccount {
        return {
            id: account.id,
            charges_enabled: account.charges_enabled,
            metadata: account.metadata,
            requirements: account.requirements,
        };
    }

    private _convertCheckoutSession(session: Stripe.Checkout.Session): StripeCheckoutResponse {
        return {
            id: session.id,
            url: session.url,
            status: session.status,
            payment_status: session.payment_status,
            
            invoice: session.invoice && typeof session.invoice === 'object' ? {
                id: session.invoice.id,
                status: session.invoice.status,
                currency: session.invoice.currency,
                customer: typeof session.invoice.customer === 'string' ? session.invoice.customer : session.invoice.customer.id,
                description: session.invoice.description,
                hosted_invoice_url: session.invoice.hosted_invoice_url,
                invoice_pdf: session.invoice.invoice_pdf,
                paid: session.invoice.paid,
                subscription: typeof session.invoice.subscription === 'string' ?
                    session.invoice.subscription :
                    session.invoice.subscription.id,
                subtotal: session.invoice.subtotal,
                total: session.invoice.total,
                tax: session.invoice.tax,
                lines: {
                    data: session.invoice.lines.data.map(l => ({
                        id: l.id,
                        price: {
                            id: l.price.id,
                            product: typeof l.price.product === 'string' ? l.price.product : l.price.product.id
                        }
                    })),
                },
            } : null,
        };
    }
}
