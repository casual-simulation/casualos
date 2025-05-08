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
import { SubscriptionController } from './SubscriptionController';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import type { AuthUser } from './AuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { formatV1SessionKey, parseSessionKey } from './AuthUtils';
import type { StripeInterface, StripeProduct } from './StripeInterface';
import { allowAllFeatures } from './SubscriptionConfiguration';
import type { Studio } from './RecordsStore';
import { MemoryStore } from './MemoryStore';
import { createTestUser } from './TestUtils';

const originalDateNow = Date.now;
console.log = jest.fn();

describe('SubscriptionController', () => {
    let controller: SubscriptionController;
    let auth: AuthController;
    let store: MemoryStore;
    let authMessenger: MemoryAuthMessenger;

    let stripeMock: {
        publishableKey: string;
        getProductAndPriceInfo: jest.Mock<Promise<StripeProduct | null>>;
        listPricesForProduct: jest.Mock<any>;
        createCheckoutSession: jest.Mock<any>;
        createPortalSession: jest.Mock<any>;
        createCustomer: jest.Mock<any>;
        listActiveSubscriptionsForCustomer: jest.Mock<any>;
        constructWebhookEvent: jest.Mock<any>;
        getSubscriptionById: jest.Mock<any>;
    };

    let stripe: StripeInterface;
    let userId: string;
    let sessionKey: string;
    let nowMock: jest.Mock<number>;

    beforeEach(async () => {
        nowMock = Date.now = jest.fn();
        store = new MemoryStore({
            subscriptions: {
                subscriptions: [
                    {
                        id: 'sub_1',
                        product: 'product_99_id',
                        eligibleProducts: [
                            'product_99_id',
                            'product_1_id',
                            'product_2_id',
                            'product_3_id',
                        ],
                        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
                    },
                    {
                        id: 'sub_2',
                        product: 'product_1000_id',
                        eligibleProducts: ['product_1000_id'],
                        featureList: [
                            'Feature 1000',
                            'Feature 2000',
                            'Feature 3000',
                        ],
                        purchasable: false,
                    },
                ],
                webhookSecret: 'webhook_secret',
                cancelUrl: 'http://cancel_url/',
                returnUrl: 'http://return_url/',
                successUrl: 'http://success_url/',
                tiers: {},
                defaultFeatures: {
                    user: allowAllFeatures(),
                    studio: allowAllFeatures(),
                },
            },
        });
        authMessenger = new MemoryAuthMessenger();
        auth = new AuthController(store, authMessenger, store);

        stripe = stripeMock = {
            publishableKey: 'publishable_key',
            getProductAndPriceInfo: jest.fn(),
            listPricesForProduct: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            createCustomer: jest.fn(),
            listActiveSubscriptionsForCustomer: jest.fn(),
            constructWebhookEvent: jest.fn(),
            getSubscriptionById: jest.fn(),
        };

        stripeMock.getProductAndPriceInfo.mockImplementation(async (id) => {
            if (id === 'product_99_id') {
                return {
                    id,
                    name: 'Product 99',
                    description: 'A product named 99.',
                    default_price: {
                        id: 'price_99',
                        currency: 'usd',
                        recurring: {
                            interval: 'month',
                            interval_count: 1,
                        },
                        unit_amount: 100,
                    },
                };
            } else if (id === 'product_1000_id') {
                return {
                    id,
                    name: 'Product 1000',
                    description: 'A product named 1000.',
                    default_price: {
                        id: 'default_price',
                        currency: 'usd',
                        recurring: {
                            interval: 'month',
                            interval_count: 1,
                        },
                        unit_amount: 9999,
                    },
                };
            }
            return null;
        });

        controller = new SubscriptionController(
            stripe,
            auth,
            store,
            store,
            store
        );

        const request = await auth.requestLogin({
            address: 'test@example.com',
            addressType: 'email',
            ipAddress: '123.456.789',
        });

        if (!request.success) {
            throw new Error('Unable to request login!');
        }

        const code = authMessenger.messages[0].code;

        const result = await auth.completeLogin({
            code: code,
            ipAddress: '123.456.789',
            requestId: request.requestId,
            userId: request.userId,
        });

        if (!result.success) {
            throw new Error('Unable to complete login');
        }

        userId = result.userId;
        sessionKey = result.sessionKey;
    });

    afterAll(() => {
        Date.now = originalDateNow;
    });

    describe('getSubscriptionStatus()', () => {
        let user: AuthUser;

        beforeEach(async () => {
            user = await store.findUserByAddress('test@example.com', 'email');
            expect(user.stripeCustomerId).toBeFalsy();
        });

        describe('user', () => {
            it('should be able list subscriptions when the user has no customer ID', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should only list subscriptions purchasable by users', async () => {
                store.subscriptionConfiguration.subscriptions = [
                    ...store.subscriptionConfiguration.subscriptions,
                    {
                        id: 'sub_3',
                        eligibleProducts: ['product_99_id'],
                        product: 'product_99_id',
                        studioOnly: true,
                        featureList: ['Feature 1'],
                    },
                    {
                        id: 'sub_4',
                        eligibleProducts: ['product_1000_id'],
                        product: 'product_1000_id',
                        userOnly: true,
                        featureList: ['Feature 1'],
                    },
                ];

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                        {
                            id: 'sub_4',
                            name: 'Product 1000',
                            description: 'A product named 1000.',
                            featureList: ['Feature 1'],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 9999,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should list the default subscription even though it may not be purchasable', async () => {
                store.subscriptionConfiguration.subscriptions = [
                    ...store.subscriptionConfiguration.subscriptions,
                    {
                        id: 'sub_3',
                        eligibleProducts: ['product_99_id'],
                        product: 'product_99_id',
                        studioOnly: true,
                        featureList: ['Feature 1'],
                    },
                    {
                        id: 'sub_4',
                        eligibleProducts: ['product_1000_id'],
                        product: 'product_1000_id',
                        userOnly: true,
                        featureList: ['Feature 1'],
                    },
                    {
                        id: 'sub_5',
                        name: 'Default Product',
                        description: 'A default product.',
                        featureList: ['Feature 1'],
                        defaultSubscription: true,
                    },
                ];

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                        {
                            id: 'sub_4',
                            name: 'Product 1000',
                            description: 'A product named 1000.',
                            featureList: ['Feature 1'],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 9999,
                                },
                            ],
                        },
                        {
                            id: 'sub_5',
                            name: 'Default Product',
                            description: 'A default product.',
                            featureList: ['Feature 1'],
                            prices: [],
                            defaultSubscription: true,
                        },
                    ],
                });
            });

            it('should be able list subscriptions when the user has a customer ID', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                });
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should be able to list subscriptions that the user has', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                });
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 456,
                                current_period_end: 999,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 123,

                                            product: {
                                                id: 'product_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [
                        {
                            active: true,
                            statusCode: 'active',
                            productName: 'Product Name',
                            startDate: 123,
                            endedDate: null,
                            cancelDate: null,
                            canceledDate: null,
                            currentPeriodStart: 456,
                            currentPeriodEnd: 999,
                            renewalInterval: 'month',
                            intervalLength: 1,
                            intervalCost: 123,
                            currency: 'usd',
                        },
                    ],
                    purchasableSubscriptions: [],
                });
            });

            it('should include the feature list for the active subscription', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                });
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 456,
                                current_period_end: 999,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 123,

                                            product: {
                                                id: 'product_1_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [
                        {
                            active: true,
                            statusCode: 'active',
                            productName: 'Product Name',
                            startDate: 123,
                            endedDate: null,
                            cancelDate: null,
                            canceledDate: null,
                            currentPeriodStart: 456,
                            currentPeriodEnd: 999,
                            renewalInterval: 'month',
                            intervalLength: 1,
                            intervalCost: 123,
                            currency: 'usd',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    purchasableSubscriptions: [],
                });
            });

            it('should return a invalid_key result if given the wrong sessionKey', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey: formatV1SessionKey(
                        'wrong user id',
                        'wrong session id',
                        'wrong session secret',
                        123
                    ),
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a invalid_key result if given a sessionKey with a wrong secret', async () => {
                const [userId, sessionId, secret, expiry] =
                    parseSessionKey(sessionKey);

                const result = await controller.getSubscriptionStatus({
                    sessionKey: formatV1SessionKey(
                        userId,
                        sessionId,
                        'wrong session secret',
                        expiry
                    ),
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a unacceptable_session_key result if given an incorrectly formatted sessionKey', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey: 'wrong',
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                });
            });

            it('should return a unacceptable_request result if given an empty userId', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId: '',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                });
            });

            it('should return a not_supported result if the controller has no stripe integration', async () => {
                (controller as any)._stripe = null;

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This method is not supported.',
                });
            });

            it('should allow super users to get the subscription status of other users', async () => {
                const { sessionKey } = await createTestUser(
                    {
                        auth: auth,
                        authMessenger: authMessenger,
                    },
                    'su@example.com'
                );

                const user = await store.findUserByAddress(
                    'su@example.com',
                    'email'
                );
                await store.saveUser({
                    ...user,
                    role: 'superUser',
                });

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });
        });

        describe('studio', () => {
            let studio: Studio;
            let studioId: string = 'studioId';

            beforeEach(async () => {
                studioId = 'studioId';
                studio = {
                    id: studioId,
                    displayName: 'studio name',
                };
                await store.addStudio(studio);
                await store.addStudioAssignment({
                    studioId: studioId,
                    userId: user.id,
                    isPrimaryContact: true,
                    role: 'admin',
                });
            });

            it('should be able list subscriptions when the studio has no customer ID', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should only list subscriptions purchasable by studios', async () => {
                store.subscriptionConfiguration.subscriptions = [
                    ...store.subscriptionConfiguration.subscriptions,
                    {
                        id: 'sub_3',
                        eligibleProducts: ['product_99_id'],
                        product: 'product_99_id',
                        studioOnly: true,
                        featureList: ['Feature 1'],
                    },
                    {
                        id: 'sub_4',
                        eligibleProducts: ['product_1000_id'],
                        product: 'product_1000_id',
                        userOnly: true,
                        featureList: ['Feature 1'],
                    },
                ];

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                        {
                            id: 'sub_3',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: ['Feature 1'],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should be able list subscriptions when the studio has a customer ID', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });
                studio = await store.getStudioById(studioId);
                expect(studio.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });

            it('should be able to list subscriptions that the studio has', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });
                studio = await store.getStudioById(studioId);
                expect(studio.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 456,
                                current_period_end: 999,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 123,

                                            product: {
                                                id: 'product_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [
                        {
                            active: true,
                            statusCode: 'active',
                            productName: 'Product Name',
                            startDate: 123,
                            endedDate: null,
                            cancelDate: null,
                            canceledDate: null,
                            currentPeriodStart: 456,
                            currentPeriodEnd: 999,
                            renewalInterval: 'month',
                            intervalLength: 1,
                            intervalCost: 123,
                            currency: 'usd',
                        },
                    ],
                    purchasableSubscriptions: [],
                });
            });

            it('should include the feature list for the active subscription', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });
                studio = await store.getStudioById(studioId);
                expect(studio.stripeCustomerId).toBe('stripe_customer');

                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 456,
                                current_period_end: 999,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 123,

                                            product: {
                                                id: 'product_1_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [
                        {
                            active: true,
                            statusCode: 'active',
                            productName: 'Product Name',
                            startDate: 123,
                            endedDate: null,
                            cancelDate: null,
                            canceledDate: null,
                            currentPeriodStart: 456,
                            currentPeriodEnd: 999,
                            renewalInterval: 'month',
                            intervalLength: 1,
                            intervalCost: 123,
                            currency: 'usd',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    purchasableSubscriptions: [],
                });
            });

            it('should return a invalid_key result if the user is not an admin', async () => {
                await store.removeStudioAssignment(studioId, user.id);
                await store.addStudioAssignment({
                    studioId: studioId,
                    userId: user.id,
                    isPrimaryContact: true,
                    role: 'member',
                });

                const result = await controller.getSubscriptionStatus({
                    sessionKey: sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a invalid_key result if given the wrong sessionKey', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey: formatV1SessionKey(
                        'wrong user id',
                        'wrong session id',
                        'wrong session secret',
                        123
                    ),
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a invalid_key result if given a sessionKey with a wrong secret', async () => {
                const [userId, sessionId, secret, expiry] =
                    parseSessionKey(sessionKey);

                const result = await controller.getSubscriptionStatus({
                    sessionKey: formatV1SessionKey(
                        userId,
                        sessionId,
                        'wrong session secret',
                        expiry
                    ),
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a unacceptable_session_key result if given an incorrectly formatted sessionKey', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey: 'wrong',
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                });
            });

            it('should return a unacceptable_request result if given an empty userId', async () => {
                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId: '',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                });
            });

            it('should return a not_supported result if the controller has no stripe integration', async () => {
                (controller as any)._stripe = null;

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This method is not supported.',
                });
            });

            it('should allow super users to get the subscription status of studios that they are not part of', async () => {
                const { sessionKey } = await createTestUser(
                    {
                        auth: auth,
                        authMessenger: authMessenger,
                    },
                    'su@example.com'
                );

                const user = await store.findUserByAddress(
                    'su@example.com',
                    'email'
                );
                await store.saveUser({
                    ...user,
                    role: 'superUser',
                });

                const result = await controller.getSubscriptionStatus({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    userId: user.id,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    purchasableSubscriptions: [
                        {
                            id: 'sub_1',
                            name: 'Product 99',
                            description: 'A product named 99.',
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                            prices: [
                                {
                                    id: 'default',
                                    interval: 'month',
                                    intervalLength: 1,
                                    currency: 'usd',
                                    cost: 100,
                                },
                            ],
                        },
                    ],
                });
            });
        });
    });

    describe('updateSubscription()', () => {
        describe('user', () => {
            let user: AuthUser;

            beforeEach(async () => {
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBeFalsy();

                nowMock.mockReturnValue(101);
            });

            it('should return a not_authorized result if the user is not a super user', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: user.id,
                    currentUserRole: user.role,
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                });
            });

            it('should be able to update the subscription of a user', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to save a subscription with no start or end dates', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to set a subscription to inactive', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'ended',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'ended',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to remove a subscription', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: null,
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    subscriptionId: null,
                    subscriptionStatus: null,
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should not update the stripe customer ID', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should reject if the user already has an active stripe subscription', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The user already has an active stripe subscription. Currently, this operation only supports updating the subscription of a user who does not have an active stripe subscription.',
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });
            });

            it('should work if the user has an inactive stripe subscription', async () => {
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'cancelled',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    userId: user.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.findUser(user.id)).toEqual({
                    ...user,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                    stripeCustomerId: 'stripe_customer',
                });
            });
        });

        describe('studio', () => {
            let studio: Studio;

            beforeEach(async () => {
                studio = {
                    id: 'studio_id',
                    displayName: 'Studio Name',
                };
                await store.addStudio(studio);
                nowMock.mockReturnValue(101);
            });

            it('should return a not_authorized result if the user is not a super user', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'userId',
                    currentUserRole: 'none',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                });
            });

            it('should be able to update the subscription of a user', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to save a subscription with no start or end dates', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to set a subscription to inactive', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'ended',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'ended',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: null,
                });
            });

            it('should be able to remove a subscription', async () => {
                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: null,
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    subscriptionId: null,
                    subscriptionStatus: null,
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should not update the stripe customer ID', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                });
            });

            it('should reject if the user already has an active stripe subscription', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage:
                        'The studio already has an active stripe subscription. Currently, this operation only supports updating the subscription of a studio which does not have an active stripe subscription.',
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });
            });

            it('should work if the user has an inactive stripe subscription', async () => {
                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                    subscriptionId: 'sub_2',
                    subscriptionStatus: 'cancelled',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 200,
                    subscriptionInfoId: 'sub_info_1',
                });

                const result = await controller.updateSubscription({
                    currentUserId: 'super_user_id',
                    currentUserRole: 'superUser',
                    studioId: studio.id,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(await store.getStudioById(studio.id)).toEqual({
                    ...studio,
                    subscriptionId: 'sub_1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: null,
                    subscriptionPeriodEndMs: null,
                    subscriptionInfoId: null,
                    stripeCustomerId: 'stripe_customer',
                });
            });
        });
    });

    describe('createManageSubscriptionLink()', () => {
        describe('user', () => {
            let user: AuthUser;

            beforeEach(async () => {
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBeFalsy();
            });

            it('should return a create subscription URL if the user has no stripe customer', async () => {
                stripeMock.createCustomer.mockResolvedValueOnce({
                    id: 'stripe_customer',
                });
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                    name: 'test name',
                    email: 'test@example.com',
                    phone: null,
                    metadata: {
                        role: 'user',
                        userId: userId,
                    },
                });
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            describe('checkout scenarios', () => {
                beforeEach(async () => {
                    stripeMock.getProductAndPriceInfo.mockImplementation(
                        async (id) => {
                            if (id === 'product_99_id') {
                                return {
                                    id,
                                    name: 'Product 99',
                                    description: 'A product named 99.',
                                    default_price: {
                                        id: 'price_99',
                                        currency: 'usd',
                                        recurring: {
                                            interval: 'month',
                                            interval_count: 1,
                                        },
                                        unit_amount: 100,
                                    },
                                };
                            } else if (id === 'product_100_id') {
                                return {
                                    id,
                                    name: 'Product 100',
                                    description: 'A product named 100.',
                                    default_price: {
                                        id: 'price_100',
                                        currency: 'usd',
                                        recurring: {
                                            interval: 'month',
                                            interval_count: 1,
                                        },
                                        unit_amount: 1000,
                                    },
                                };
                            }
                            return null;
                        }
                    );

                    store.subscriptionConfiguration = {
                        subscriptions: [
                            {
                                id: 'sub_1',
                                product: 'product_99_id',
                                eligibleProducts: [
                                    'product_99_id',
                                    'product_1_id',
                                    'product_2_id',
                                    'product_3_id',
                                ],
                                featureList: [
                                    'Feature 1',
                                    'Feature 2',
                                    'Feature 3',
                                ],
                            },
                            {
                                id: 'sub_2',
                                product: 'product_100_id',
                                eligibleProducts: ['product_100_id'],
                                featureList: [
                                    'Feature 1',
                                    'Feature 2',
                                    'Feature 3',
                                ],
                            },
                        ],
                        webhookSecret: 'webhook_secret',
                        cancelUrl: 'http://cancel_url/',
                        returnUrl: 'http://return_url/',
                        successUrl: 'http://success_url/',

                        tiers: {},
                        defaultFeatures: {
                            user: allowAllFeatures(),
                            studio: allowAllFeatures(),
                        },
                    };

                    stripeMock.createCustomer.mockResolvedValueOnce({
                        id: 'stripe_customer',
                    });
                    stripeMock.createPortalSession.mockRejectedValueOnce(
                        new Error('Should not be hit')
                    );
                    stripeMock.createCheckoutSession.mockResolvedValueOnce({
                        url: 'checkout_url',
                    });

                    await store.saveUser({
                        ...user,
                        name: 'test name',
                    });
                });

                it('should return a create subscription URL for the given subscription ID', async () => {
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            userId,
                            subscriptionId: 'sub_2',
                        });

                    expect(result).toEqual({
                        success: true,
                        url: 'checkout_url',
                    });
                    expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                    expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                        name: 'test name',
                        email: 'test@example.com',
                        phone: null,
                        metadata: {
                            role: 'user',
                            userId,
                        },
                    });
                    expect(
                        stripeMock.createCheckoutSession
                    ).toHaveBeenCalledTimes(1);
                    expect(
                        stripeMock.createCheckoutSession
                    ).toHaveBeenCalledWith({
                        mode: 'subscription',
                        customer: 'stripe_customer',
                        success_url: 'http://success_url/',
                        cancel_url: 'http://cancel_url/',
                        line_items: [
                            {
                                price: 'price_100',
                                quantity: 1,
                            },
                        ],
                        metadata: {
                            userId,
                            subjectId: userId,
                        },
                    });
                });

                it('should return a unacceptable_request if given a subscription that does not have a product', async () => {
                    store.subscriptionConfiguration.subscriptions[1].product =
                        null;
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            userId,
                            subscriptionId: 'sub_2',
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'The given subscription is not purchasable.',
                    });
                    expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                    expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                        name: 'test name',
                        email: 'test@example.com',
                        phone: null,
                        metadata: {
                            role: 'user',
                            userId,
                        },
                    });
                    expect(
                        stripeMock.createCheckoutSession
                    ).not.toHaveBeenCalled();
                });

                it('should return a unacceptable_request if given a subscription that is not purchasable', async () => {
                    store.subscriptionConfiguration.subscriptions[1].purchasable =
                        false;
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            userId,
                            subscriptionId: 'sub_2',
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage:
                            'The given subscription is not purchasable.',
                    });
                    expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                    expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                        name: 'test name',
                        email: 'test@example.com',
                        phone: null,
                        metadata: {
                            role: 'user',
                            userId,
                        },
                    });
                    expect(
                        stripeMock.createCheckoutSession
                    ).not.toHaveBeenCalled();
                });

                it('should return a price_does_not_match if the expected price does not match the subscription', async () => {
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            userId,
                            expectedPrice: {
                                currency: 'usd',
                                cost: 9,
                                interval: 'month',
                                intervalLength: 1,
                            },
                            subscriptionId: 'sub_1',
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'price_does_not_match',
                        errorMessage: expect.any(String),
                    });
                });
            });

            it('should return a portal session URL if the user has a subscription to one of the listed products', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a create subscription URL if the user has a canceled subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'canceled',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            it('should return a create subscription URL if the user has a incomplete_expired subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'incomplete_expired',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            it('should return a create subscription URL if the user has a ended subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'canceled',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            it('should return a create subscription URL if the user has an active subscription but not to the correct product', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'wrong_product_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            it('should use the given config object when creating a checkout session', async () => {
                stripeMock.createCustomer.mockResolvedValueOnce({
                    id: 'stripe_customer',
                });
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.saveUser({
                    ...user,
                    name: 'test name',
                });

                store.subscriptionConfiguration = {
                    subscriptions: [
                        {
                            id: 'sub_1',
                            product: 'product_99_id',
                            eligibleProducts: [
                                'product_99_id',
                                'product_1_id',
                                'product_2_id',
                                'product_3_id',
                            ],
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    checkoutConfig: {
                        mySpecialKey: 123,
                    },
                    webhookSecret: 'webhook_secret',
                    cancelUrl: 'http://cancel_url/',
                    returnUrl: 'http://return_url/',
                    successUrl: 'http://success_url/',

                    tiers: {},
                    defaultFeatures: {
                        user: allowAllFeatures(),
                        studio: allowAllFeatures(),
                    },
                };

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                    name: 'test name',
                    email: 'test@example.com',
                    phone: null,
                    metadata: {
                        role: 'user',
                        userId,
                    },
                });
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mySpecialKey: 123,
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'http://success_url/',
                    cancel_url: 'http://cancel_url/',
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                        subjectId: userId,
                    },
                });
            });

            it('should use the given config object when creating a portal session', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                store.subscriptionConfiguration = {
                    subscriptions: [
                        {
                            id: 'sub_1',
                            product: 'product_99_id',
                            eligibleProducts: [
                                'product_99_id',
                                'product_1_id',
                                'product_2_id',
                                'product_3_id',
                            ],
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    portalConfig: {
                        mySpecialKey: 123,
                    },
                    webhookSecret: 'webhook_secret',
                    cancelUrl: 'http://cancel_url/',
                    returnUrl: 'http://return_url/',
                    successUrl: 'http://success_url/',
                    tiers: {},
                    defaultFeatures: {
                        user: allowAllFeatures(),
                        studio: allowAllFeatures(),
                    },
                };

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    mySpecialKey: 123,
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a portal session URL if the user has a incomplete subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'incomplete',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a portal session URL if the user has a unpaid subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'unpaid',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a portal session URL if the user has a paused subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'paused',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a portal session URL if the user has a trialing subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'trialing',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a portal session URL if the user has a past_due subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'past_due',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.saveUser({
                    ...user,
                    name: 'test name',
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: 'http://return_url/',
                });
            });

            it('should return a unacceptable_session_key error if given an incorrectly formatted sessionKey', async () => {
                const result = await controller.createManageSubscriptionLink({
                    sessionKey: 'wrong',
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                });
            });

            it('should return a unacceptable_request error if given an empty user id', async () => {
                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId: '',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                });
            });

            it('should return an invalid_key error if given the wrong session key', async () => {
                const [sessionUserId, sessionId, sessionSecret, expireTime] =
                    parseSessionKey(sessionKey);
                const result = await controller.createManageSubscriptionLink({
                    sessionKey: formatV1SessionKey(
                        sessionUserId,
                        sessionId,
                        'wrong',
                        expireTime
                    ),
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a not_supported result if the controller has no stripe integration', async () => {
                (controller as any)._stripe = null;

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This method is not supported.',
                });
            });
        });

        describe('studio', () => {
            let studio: Studio;
            let studioId: string;

            beforeEach(async () => {
                studioId = 'studioId';
                studio = {
                    id: studioId,
                    displayName: 'my studio',
                };

                await store.addStudio(studio);
                await store.addStudioAssignment({
                    studioId,
                    userId,
                    role: 'admin',
                    isPrimaryContact: true,
                });
            });

            it('should return a create subscription URL if the user has no stripe customer', async () => {
                stripeMock.createCustomer.mockResolvedValueOnce({
                    id: 'stripe_customer',
                });
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                    name: 'my studio',
                    email: 'test@example.com',
                    phone: null,
                    metadata: {
                        role: 'studio',
                        studioId: studioId,
                        contactUserId: userId,
                    },
                });
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        studioId,
                        contactUserId: userId,
                        subjectId: userId,
                    },
                });
            });

            describe('checkout scenarios', () => {
                beforeEach(async () => {
                    stripeMock.getProductAndPriceInfo.mockImplementation(
                        async (id) => {
                            if (id === 'product_99_id') {
                                return {
                                    id,
                                    name: 'Product 99',
                                    description: 'A product named 99.',
                                    default_price: {
                                        id: 'price_99',
                                        currency: 'usd',
                                        recurring: {
                                            interval: 'month',
                                            interval_count: 1,
                                        },
                                        unit_amount: 100,
                                    },
                                };
                            } else if (id === 'product_100_id') {
                                return {
                                    id,
                                    name: 'Product 100',
                                    description: 'A product named 100.',
                                    default_price: {
                                        id: 'price_100',
                                        currency: 'usd',
                                        recurring: {
                                            interval: 'month',
                                            interval_count: 1,
                                        },
                                        unit_amount: 1000,
                                    },
                                };
                            }
                            return null;
                        }
                    );

                    store.subscriptionConfiguration = {
                        subscriptions: [
                            {
                                id: 'sub_1',
                                product: 'product_99_id',
                                eligibleProducts: [
                                    'product_99_id',
                                    'product_1_id',
                                    'product_2_id',
                                    'product_3_id',
                                ],
                                featureList: [
                                    'Feature 1',
                                    'Feature 2',
                                    'Feature 3',
                                ],
                            },
                            {
                                id: 'sub_2',
                                product: 'product_100_id',
                                eligibleProducts: ['product_100_id'],
                                featureList: [
                                    'Feature 1',
                                    'Feature 2',
                                    'Feature 3',
                                ],
                            },
                        ],
                        webhookSecret: 'webhook_secret',
                        cancelUrl: `http://cancel_url/`,
                        returnUrl: `http://return_url/`,
                        successUrl: `http://success_url/`,

                        tiers: {},
                        defaultFeatures: {
                            user: allowAllFeatures(),
                            studio: allowAllFeatures(),
                        },
                    };

                    stripeMock.createCustomer.mockResolvedValueOnce({
                        id: 'stripe_customer',
                    });
                    stripeMock.createPortalSession.mockRejectedValueOnce(
                        new Error('Should not be hit')
                    );
                    stripeMock.createCheckoutSession.mockResolvedValueOnce({
                        url: 'checkout_url',
                    });
                });

                it('should return a create subscription URL for the given subscription ID', async () => {
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            studioId,
                            subscriptionId: 'sub_2',
                        });

                    expect(result).toEqual({
                        success: true,
                        url: 'checkout_url',
                    });
                    expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                    expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                        name: 'my studio',
                        email: 'test@example.com',
                        phone: null,
                        metadata: {
                            role: 'studio',
                            studioId,
                            contactUserId: userId,
                        },
                    });
                    expect(
                        stripeMock.createCheckoutSession
                    ).toHaveBeenCalledTimes(1);
                    expect(
                        stripeMock.createCheckoutSession
                    ).toHaveBeenCalledWith({
                        mode: 'subscription',
                        customer: 'stripe_customer',
                        success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                            'my studio'
                        )}`,
                        cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                            'my studio'
                        )}`,
                        line_items: [
                            {
                                price: 'price_100',
                                quantity: 1,
                            },
                        ],
                        metadata: {
                            contactUserId: userId,
                            subjectId: userId,
                            studioId: studioId,
                        },
                    });
                });

                it('should return a price_does_not_match if the expected price does not match the subscription', async () => {
                    const result =
                        await controller.createManageSubscriptionLink({
                            sessionKey,
                            userId,
                            expectedPrice: {
                                currency: 'usd',
                                cost: 9,
                                interval: 'month',
                                intervalLength: 1,
                            },
                            subscriptionId: 'sub_1',
                        });

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'price_does_not_match',
                        errorMessage: expect.any(String),
                    });
                });
            });

            it('should return a portal session URL if the user has a subscription to one of the listed products', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a create subscription URL if the user has a canceled subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'canceled',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        contactUserId: userId,
                        subjectId: userId,
                        studioId: studioId,
                    },
                });
            });

            it('should return a create subscription URL if the user has a incomplete_expired subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'incomplete_expired',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        contactUserId: userId,
                        subjectId: userId,
                        studioId: studioId,
                    },
                });
            });

            it('should return a create subscription URL if the user has a ended subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'canceled',
                                start_date: 123,
                                ended_at: 999,
                                cancel_at: null,
                                canceled_at: 999,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        contactUserId: userId,
                        subjectId: userId,
                        studioId,
                    },
                });
            });

            it('should return a create subscription URL if the user has an active subscription but not to the correct product', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'wrong_product_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        contactUserId: userId,
                        subjectId: userId,
                        studioId,
                    },
                });
            });

            it('should use the given config object when creating a checkout session', async () => {
                stripeMock.createCustomer.mockResolvedValueOnce({
                    id: 'stripe_customer',
                });
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                store.subscriptionConfiguration = {
                    subscriptions: [
                        {
                            id: 'sub_1',
                            product: 'product_99_id',
                            eligibleProducts: [
                                'product_99_id',
                                'product_1_id',
                                'product_2_id',
                                'product_3_id',
                            ],
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    checkoutConfig: {
                        mySpecialKey: 123,
                    },
                    webhookSecret: 'webhook_secret',
                    cancelUrl: 'http://cancel_url/',
                    returnUrl: 'http://return_url/',
                    successUrl: 'http://success_url/',

                    tiers: {},
                    defaultFeatures: {
                        user: allowAllFeatures(),
                        studio: allowAllFeatures(),
                    },
                };

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                    subscriptionId: 'sub_1',
                });

                expect(result).toEqual({
                    success: true,
                    url: 'checkout_url',
                });
                expect(stripeMock.createCustomer).toHaveBeenCalledTimes(1);
                expect(stripeMock.createCustomer).toHaveBeenCalledWith({
                    name: 'my studio',
                    email: 'test@example.com',
                    phone: null,
                    metadata: {
                        role: 'studio',
                        studioId,
                        contactUserId: userId,
                    },
                });
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mySpecialKey: 123,
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: `http://success_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    cancel_url: `http://cancel_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                    line_items: [
                        {
                            price: 'price_99',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        contactUserId: userId,
                        subjectId: userId,
                        studioId,
                    },
                });
            });

            it('should use the given config object when creating a portal session', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'active',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                store.subscriptionConfiguration = {
                    subscriptions: [
                        {
                            id: 'sub_1',
                            product: 'product_99_id',
                            eligibleProducts: [
                                'product_99_id',
                                'product_1_id',
                                'product_2_id',
                                'product_3_id',
                            ],
                            featureList: [
                                'Feature 1',
                                'Feature 2',
                                'Feature 3',
                            ],
                        },
                    ],
                    portalConfig: {
                        mySpecialKey: 123,
                    },
                    webhookSecret: 'webhook_secret',
                    cancelUrl: 'http://cancel_url/',
                    returnUrl: 'http://return_url/',
                    successUrl: 'http://success_url/',

                    tiers: {},
                    defaultFeatures: {
                        user: allowAllFeatures(),
                        studio: allowAllFeatures(),
                    },
                };

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    mySpecialKey: 123,
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a portal session URL if the user has a incomplete subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'incomplete',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a portal session URL if the user has a unpaid subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'unpaid',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a portal session URL if the user has a paused subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'paused',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a portal session URL if the user has a trialing subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'trialing',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a portal session URL if the user has a past_due subscription', async () => {
                stripeMock.listActiveSubscriptionsForCustomer.mockResolvedValueOnce(
                    {
                        subscriptions: [
                            {
                                id: 'subscription_id',
                                status: 'past_due',
                                start_date: 123,
                                ended_at: null,
                                cancel_at: null,
                                canceled_at: null,
                                current_period_start: 123,
                                current_period_end: 456,
                                items: [
                                    {
                                        id: 'item_id',
                                        price: {
                                            id: 'price_id',
                                            interval: 'month',
                                            interval_count: 1,
                                            currency: 'usd',
                                            unit_amount: 100,
                                            product: {
                                                id: 'product_2_id',
                                                name: 'Product Name',
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    }
                );
                stripeMock.createPortalSession.mockResolvedValueOnce({
                    url: 'portal_url',
                });
                stripeMock.createCheckoutSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );

                await store.updateStudio({
                    ...studio,
                    stripeCustomerId: 'stripe_customer',
                });

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: true,
                    url: 'portal_url',
                });
                expect(stripeMock.createCustomer).not.toHaveBeenCalled();
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledTimes(1);
                expect(
                    stripeMock.listActiveSubscriptionsForCustomer
                ).toHaveBeenCalledWith('stripe_customer');
                expect(stripeMock.createPortalSession).toHaveBeenCalledTimes(1);
                expect(stripeMock.createPortalSession).toHaveBeenCalledWith({
                    customer: 'stripe_customer',
                    return_url: `http://return_url/studios/${studioId}/${encodeURIComponent(
                        'my studio'
                    )}`,
                });
            });

            it('should return a unacceptable_session_key error if given an incorrectly formatted sessionKey', async () => {
                const result = await controller.createManageSubscriptionLink({
                    sessionKey: 'wrong',
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_session_key',
                    errorMessage:
                        'The given session key is invalid. It must be a correctly formatted string.',
                });
            });

            it('should return a unacceptable_request error if given an empty user id', async () => {
                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId: '',
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'unacceptable_request',
                    errorMessage:
                        'The given request is invalid. It must have a valid user ID or studio ID.',
                });
            });

            it('should return an invalid_key error if given the wrong session key', async () => {
                const [sessionUserId, sessionId, sessionSecret, expireTime] =
                    parseSessionKey(sessionKey);
                const result = await controller.createManageSubscriptionLink({
                    sessionKey: formatV1SessionKey(
                        sessionUserId,
                        sessionId,
                        'wrong',
                        expireTime
                    ),
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_key',
                    errorMessage: INVALID_KEY_ERROR_MESSAGE,
                });
            });

            it('should return a not_supported result if the controller has no stripe integration', async () => {
                (controller as any)._stripe = null;

                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    studioId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This method is not supported.',
                });
            });
        });
    });

    describe('handleStripeWebhook()', () => {
        describe('user', () => {
            let user: AuthUser;

            beforeEach(async () => {
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                await store.saveUser({
                    ...user,
                    stripeCustomerId: 'customer_id',
                });
                user = await store.findUserByAddress(
                    'test@example.com',
                    'email'
                );
                expect(user.stripeCustomerId).toBe('customer_id');
                expect(user.subscriptionStatus).toBeFalsy();
            });

            const subscriptionEventTypes = [
                ['customer.subscription.created'],
                ['customer.subscription.updated'],
                ['customer.subscription.deleted'],
            ] as const;

            const statusTypes = [
                ['active', true] as const,
                ['trialing', true] as const,
                ['canceled', false] as const,
                ['ended', false] as const,
                ['past_due', false] as const,
                ['unpaid', false] as const,
                ['incomplete', false] as const,
                ['incomplete_expired', false] as const,
                ['paused', false] as const,
            ];

            describe.each(subscriptionEventTypes)(
                'should handle %s events',
                (type) => {
                    describe.each(statusTypes)('%s', (status, active) => {
                        beforeEach(async () => {
                            await store.saveUser({
                                ...user,
                                subscriptionStatus: 'anything',
                            });
                        });

                        it('should handle subscriptions', async () => {
                            stripeMock.constructWebhookEvent.mockReturnValueOnce(
                                {
                                    id: 'event_id',
                                    object: 'event',
                                    account: 'account_id',
                                    api_version: 'api_version',
                                    created: 123,
                                    data: {
                                        object: {
                                            id: 'subscription',
                                            status: status,
                                            customer: 'customer_id',
                                            items: {
                                                object: 'list',
                                                data: [
                                                    {
                                                        price: {
                                                            id: 'price_1',
                                                            product:
                                                                'product_1_id',
                                                        },
                                                    },
                                                ],
                                            },
                                            current_period_start: 123,
                                            current_period_end: 456,
                                        },
                                    },
                                    livemode: true,
                                    pending_webhooks: 1,
                                    request: {},
                                    type: type,
                                }
                            );

                            const result = await controller.handleStripeWebhook(
                                {
                                    requestBody: 'request_body',
                                    signature: 'request_signature',
                                }
                            );

                            expect(result).toEqual({
                                success: true,
                            });
                            expect(
                                stripeMock.constructWebhookEvent
                            ).toHaveBeenCalledTimes(1);
                            expect(
                                stripeMock.constructWebhookEvent
                            ).toHaveBeenCalledWith(
                                'request_body',
                                'request_signature',
                                'webhook_secret'
                            );

                            const user = await store.findUser(userId);
                            expect(user?.subscriptionStatus).toBe(status);
                            expect(user?.subscriptionId).toBe('sub_1');
                            expect(user?.subscriptionInfoId).toBeTruthy();
                            expect(user?.subscriptionPeriodStartMs).toBe(
                                123000
                            );
                            expect(user?.subscriptionPeriodEndMs).toBe(456000);

                            // Should create/update subscription info
                            const sub = await store.getSubscriptionById(
                                user?.subscriptionInfoId
                            );
                            expect(sub).toEqual({
                                id: expect.any(String),
                                stripeCustomerId: 'customer_id',
                                stripeSubscriptionId: 'subscription',
                                subscriptionStatus: status,
                                subscriptionId: 'sub_1',
                                userId: user?.id,
                                studioId: null,
                                currentPeriodStartMs: 123000,
                                currentPeriodEndMs: 456000,
                            });
                        });

                        it('should do nothing for products that are not configured', async () => {
                            stripeMock.constructWebhookEvent.mockReturnValueOnce(
                                {
                                    id: 'event_id',
                                    object: 'event',
                                    account: 'account_id',
                                    api_version: 'api_version',
                                    created: 123,
                                    data: {
                                        object: {
                                            id: 'subscription',
                                            status: status,
                                            customer: 'customer_id',
                                            items: {
                                                object: 'list',
                                                data: [
                                                    {
                                                        price: {
                                                            id: 'price_1',
                                                            product:
                                                                'wrong_product_id',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                    livemode: true,
                                    pending_webhooks: 1,
                                    request: {},
                                    type: type,
                                }
                            );

                            const result = await controller.handleStripeWebhook(
                                {
                                    requestBody: 'request_body',
                                    signature: 'request_signature',
                                }
                            );

                            expect(result).toEqual({
                                success: true,
                            });
                            expect(
                                stripeMock.constructWebhookEvent
                            ).toHaveBeenCalledTimes(1);
                            expect(
                                stripeMock.constructWebhookEvent
                            ).toHaveBeenCalledWith(
                                'request_body',
                                'request_signature',
                                'webhook_secret'
                            );

                            const user = await store.findUser(userId);

                            // Do nothing
                            expect(user.subscriptionStatus).toBe('anything');
                        });
                    });
                }
            );

            describe('should handle invoice.paid events', () => {
                it('should update subscription periods', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'invoice.paid',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'invoiceId',
                                customer: 'customer_id',
                                currency: 'usd',
                                total: 1000,
                                subtotal: 1000,
                                tax: 0,
                                description: 'description',
                                status: 'paid',
                                paid: true,
                                hosted_invoice_url: 'invoiceUrl',
                                invoice_pdf: 'pdfUrl',
                                lines: {
                                    object: 'list',
                                    data: [
                                        {
                                            id: 'line_item_1_id',
                                            price: {
                                                id: 'price_1',
                                                product: 'product_1_id',
                                            },
                                        },
                                    ],
                                },
                                subscription: 'sub',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });
                    stripeMock.getSubscriptionById.mockResolvedValueOnce({
                        id: 'sub',
                        status: 'active',
                        current_period_start: 456,
                        current_period_end: 999,
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });
                    expect(
                        stripeMock.constructWebhookEvent
                    ).toHaveBeenCalledTimes(1);
                    expect(
                        stripeMock.constructWebhookEvent
                    ).toHaveBeenCalledWith(
                        'request_body',
                        'request_signature',
                        'webhook_secret'
                    );
                    expect(stripeMock.getSubscriptionById).toHaveBeenCalledWith(
                        'sub'
                    );

                    const user = await store.findUser(userId);
                    expect(user?.subscriptionPeriodStartMs).toBe(456000);
                    expect(user?.subscriptionPeriodEndMs).toBe(999000);

                    // Should create subscription info
                    const sub = await store.getSubscriptionById(
                        user?.subscriptionInfoId
                    );
                    expect(sub).toEqual({
                        id: expect.any(String),
                        stripeCustomerId: 'customer_id',
                        stripeSubscriptionId: 'sub',
                        subscriptionStatus: 'active',
                        subscriptionId: 'sub_1',
                        userId: user?.id,
                        studioId: null,
                        currentPeriodStartMs: 456000,
                        currentPeriodEndMs: 999000,
                    });

                    const subPeriods =
                        await store.listSubscriptionPeriodsBySubscriptionId(
                            sub.id
                        );
                    expect(subPeriods).toEqual([
                        {
                            id: expect.any(String),
                            subscriptionId: sub.id,
                            periodStartMs: 456000,
                            periodEndMs: 999000,
                            invoiceId: expect.any(String),
                        },
                    ]);

                    const invoice = await store.getInvoiceById(
                        subPeriods[0].invoiceId
                    );
                    expect(invoice).toEqual({
                        id: expect.any(String),
                        stripeInvoiceId: 'invoiceId',
                        stripeHostedInvoiceUrl: 'invoiceUrl',
                        stripeInvoicePdfUrl: 'pdfUrl',
                        periodId: subPeriods[0].id,
                        subscriptionId: sub.id,
                        description: 'description',
                        status: 'paid',
                        paid: true,
                        currency: 'usd',
                        total: 1000,
                        subtotal: 1000,
                        tax: 0,
                    });
                });
            });
        });

        describe('studio', () => {
            let studio: Studio;
            let studioId: string;

            beforeEach(async () => {
                studioId = 'studioId';
                studio = {
                    id: studioId,
                    displayName: 'my studio',
                    stripeCustomerId: 'customer_id',
                };

                await store.addStudio(studio);
                await store.addStudioAssignment({
                    userId,
                    studioId,
                    isPrimaryContact: true,
                    role: 'admin',
                });
            });

            const eventTypes = [
                ['customer.subscription.created'],
                ['customer.subscription.updated'],
                ['customer.subscription.deleted'],
            ] as const;

            const statusTypes = [
                ['active', true] as const,
                ['trialing', true] as const,
                ['canceled', false] as const,
                ['ended', false] as const,
                ['past_due', false] as const,
                ['unpaid', false] as const,
                ['incomplete', false] as const,
                ['incomplete_expired', false] as const,
                ['paused', false] as const,
            ];

            describe.each(eventTypes)('should handle %s events', (type) => {
                describe.each(statusTypes)('%s', (status, active) => {
                    beforeEach(async () => {
                        await store.updateStudio({
                            ...studio,
                            subscriptionStatus: 'anything',
                        });
                    });

                    it('should handle subscriptions', async () => {
                        stripeMock.constructWebhookEvent.mockReturnValueOnce({
                            id: 'event_id',
                            object: 'event',
                            account: 'account_id',
                            api_version: 'api_version',
                            created: 123,
                            data: {
                                object: {
                                    id: 'subscription',
                                    status: status,
                                    customer: 'customer_id',
                                    items: {
                                        object: 'list',
                                        data: [
                                            {
                                                price: {
                                                    id: 'price_1',
                                                    product: 'product_1_id',
                                                },
                                            },
                                        ],
                                    },
                                    current_period_start: 123,
                                    current_period_end: 456,
                                },
                            },
                            livemode: true,
                            pending_webhooks: 1,
                            request: {},
                            type: type,
                        });

                        const result = await controller.handleStripeWebhook({
                            requestBody: 'request_body',
                            signature: 'request_signature',
                        });

                        expect(result).toEqual({
                            success: true,
                        });
                        expect(
                            stripeMock.constructWebhookEvent
                        ).toHaveBeenCalledTimes(1);
                        expect(
                            stripeMock.constructWebhookEvent
                        ).toHaveBeenCalledWith(
                            'request_body',
                            'request_signature',
                            'webhook_secret'
                        );

                        const studio = await store.getStudioById(studioId);
                        expect(studio?.subscriptionStatus).toBe(status);
                        expect(studio?.subscriptionId).toBe('sub_1');
                        expect(studio?.subscriptionInfoId).toBeTruthy();
                        expect(studio?.subscriptionPeriodStartMs).toBe(123000);
                        expect(studio?.subscriptionPeriodEndMs).toBe(456000);

                        // Should create/update subscription info
                        const sub = await store.getSubscriptionById(
                            studio?.subscriptionInfoId
                        );
                        expect(sub).toEqual({
                            id: expect.any(String),
                            stripeCustomerId: 'customer_id',
                            stripeSubscriptionId: 'subscription',
                            subscriptionStatus: status,
                            subscriptionId: 'sub_1',
                            userId: null,
                            studioId: studio?.id,
                            currentPeriodStartMs: 123000,
                            currentPeriodEndMs: 456000,
                        });
                    });

                    it('should do nothing for products that are not configured', async () => {
                        stripeMock.constructWebhookEvent.mockReturnValueOnce({
                            id: 'event_id',
                            object: 'event',
                            account: 'account_id',
                            api_version: 'api_version',
                            created: 123,
                            data: {
                                object: {
                                    id: 'subscription',
                                    status: status,
                                    customer: 'customer_id',
                                    items: {
                                        object: 'list',
                                        data: [
                                            {
                                                price: {
                                                    id: 'price_1',
                                                    product: 'wrong_product_id',
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                            livemode: true,
                            pending_webhooks: 1,
                            request: {},
                            type: type,
                        });

                        const result = await controller.handleStripeWebhook({
                            requestBody: 'request_body',
                            signature: 'request_signature',
                        });

                        expect(result).toEqual({
                            success: true,
                        });
                        expect(
                            stripeMock.constructWebhookEvent
                        ).toHaveBeenCalledTimes(1);
                        expect(
                            stripeMock.constructWebhookEvent
                        ).toHaveBeenCalledWith(
                            'request_body',
                            'request_signature',
                            'webhook_secret'
                        );

                        const studio = await store.getStudioById(studioId);

                        // Do nothing
                        expect(studio.subscriptionStatus).toBe('anything');
                    });
                });
            });

            describe('should handle invoice.paid events', () => {
                it('should update subscription periods', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'invoice.paid',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'invoiceId',
                                customer: 'customer_id',
                                currency: 'usd',
                                total: 1000,
                                subtotal: 1000,
                                tax: 0,
                                description: 'description',
                                status: 'paid',
                                paid: true,
                                hosted_invoice_url: 'invoiceUrl',
                                invoice_pdf: 'pdfUrl',
                                lines: {
                                    object: 'list',
                                    data: [
                                        {
                                            id: 'line_item_1_id',
                                            price: {
                                                id: 'price_1',
                                                product: 'product_1_id',
                                            },
                                        },
                                    ],
                                },
                                subscription: 'sub',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });
                    stripeMock.getSubscriptionById.mockResolvedValueOnce({
                        id: 'sub',
                        status: 'active',
                        current_period_start: 456,
                        current_period_end: 999,
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });
                    expect(
                        stripeMock.constructWebhookEvent
                    ).toHaveBeenCalledTimes(1);
                    expect(
                        stripeMock.constructWebhookEvent
                    ).toHaveBeenCalledWith(
                        'request_body',
                        'request_signature',
                        'webhook_secret'
                    );

                    const studio = await store.getStudioById(studioId);
                    expect(studio?.subscriptionPeriodStartMs).toBe(456000);
                    expect(studio?.subscriptionPeriodEndMs).toBe(999000);
                });
            });
        });

        it('should handle when constructWebhookEvent() throws an error', async () => {
            stripeMock.constructWebhookEvent.mockImplementation(() => {
                throw new Error('Unable to parse event!');
            });

            const result = await controller.handleStripeWebhook({
                requestBody: 'request_body',
                signature: 'request_signature',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The request was not valid.',
            });
            expect(stripeMock.constructWebhookEvent).toHaveBeenCalledTimes(1);
        });

        it('should return an invalid_request if no signature is included', async () => {
            stripeMock.constructWebhookEvent.mockReturnValueOnce({
                id: 'event_id',
                object: 'event',
                account: 'account_id',
                api_version: 'api_version',
                created: 123,
                data: {
                    object: {
                        id: 'subscription',
                        status: 'active',
                        customer: 'customer_id',
                    },
                },
                livemode: true,
                pending_webhooks: 1,
                request: {},
                type: 'customer.subscription.created',
            });

            const result = await controller.handleStripeWebhook({
                requestBody: 'request_body',
                signature: '',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The request was not valid.',
            });
        });

        it('should return a not_supported result if the controller has no stripe integration', async () => {
            (controller as any)._stripe = null;

            const result = await controller.handleStripeWebhook({
                requestBody: 'test',
                signature: 'signature',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This method is not supported.',
            });
        });
    });
});
