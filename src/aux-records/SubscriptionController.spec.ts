import { SubscriptionController } from './SubscriptionController';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import { AuthStore, AuthUser } from './AuthStore';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { AuthMessenger } from './AuthMessenger';
import { formatV1SessionKey, parseSessionKey } from './AuthUtils';
import { StripeInterface, StripeProduct } from './StripeInterface';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';

console.log = jest.fn();

describe('SubscriptionController', () => {
    let controller: SubscriptionController;
    let auth: AuthController;
    let authStore: AuthStore;
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
    };

    let stripe: StripeInterface;
    let userId: string;
    let sessionKey: string;
    let config: SubscriptionConfiguration;

    beforeEach(async () => {
        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();

        config = {
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
            cancelUrl: 'cancel_url',
            returnUrl: 'return_url',
            successUrl: 'success_url',
        };
        auth = new AuthController(authStore, authMessenger, config);

        stripe = stripeMock = {
            publishableKey: 'publishable_key',
            getProductAndPriceInfo: jest.fn(),
            listPricesForProduct: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            createCustomer: jest.fn(),
            listActiveSubscriptionsForCustomer: jest.fn(),
            constructWebhookEvent: jest.fn(),
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
            authStore,
            config
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

    describe('getSubscriptionStatus()', () => {
        let user: AuthUser;

        beforeEach(async () => {
            user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();
        });

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
                        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
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

        it('should be able list subscriptions when the user has a customer ID', async () => {
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'stripe_customer',
            });
            user = await authStore.findUserByAddress(
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
                        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
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
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'stripe_customer',
            });
            user = await authStore.findUserByAddress(
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
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'stripe_customer',
            });
            user = await authStore.findUserByAddress(
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
                        featureList: ['Feature 1', 'Feature 2', 'Feature 3'],
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

        it('should return a unacceptable_user_id result if given an empty userId', async () => {
            const result = await controller.getSubscriptionStatus({
                sessionKey,
                userId: '',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given user ID is invalid. It must be a correctly formatted string.',
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
    });

    describe('createManageSubscriptionLink()', () => {
        let user: AuthUser;

        beforeEach(async () => {
            user = await authStore.findUserByAddress(
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

            await authStore.saveUser({
                ...user,
                name: 'test name',
            });

            const result = await controller.createManageSubscriptionLink({
                sessionKey,
                userId,
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
            });
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

                controller = new SubscriptionController(
                    stripe,
                    auth,
                    authStore,
                    {
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
                                defaultSubscription: true,
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
                        cancelUrl: 'cancel_url',
                        returnUrl: 'return_url',
                        successUrl: 'success_url',
                    }
                );

                stripeMock.createCustomer.mockResolvedValueOnce({
                    id: 'stripe_customer',
                });
                stripeMock.createPortalSession.mockRejectedValueOnce(
                    new Error('Should not be hit')
                );
                stripeMock.createCheckoutSession.mockResolvedValueOnce({
                    url: 'checkout_url',
                });

                await authStore.saveUser({
                    ...user,
                    name: 'test name',
                });
            });

            it('should return a create subscription URL for the given subscription ID', async () => {
                const result = await controller.createManageSubscriptionLink({
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
                });
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(
                    1
                );
                expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                    mode: 'subscription',
                    customer: 'stripe_customer',
                    success_url: 'success_url',
                    cancel_url: 'cancel_url',
                    line_items: [
                        {
                            price: 'price_100',
                            quantity: 1,
                        },
                    ],
                    metadata: {
                        userId,
                    },
                });
            });

            it('should return a price_does_not_match if the expected price does not match the subscription', async () => {
                const result = await controller.createManageSubscriptionLink({
                    sessionKey,
                    userId,
                    expectedPrice: {
                        currency: 'usd',
                        cost: 9,
                        interval: 'month',
                        intervalLength: 1,
                    },
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                url: 'checkout_url',
            });
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledTimes(1);
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledWith('stripe_customer');
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

            await authStore.saveUser({
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
                url: 'checkout_url',
            });
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledTimes(1);
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledWith('stripe_customer');
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

            await authStore.saveUser({
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
                url: 'checkout_url',
            });
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledTimes(1);
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledWith('stripe_customer');
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

            await authStore.saveUser({
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
                url: 'checkout_url',
            });
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledTimes(1);
            expect(
                stripeMock.listActiveSubscriptionsForCustomer
            ).toHaveBeenCalledWith('stripe_customer');
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

            await authStore.saveUser({
                ...user,
                name: 'test name',
            });

            controller = new SubscriptionController(stripe, auth, authStore, {
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
                ],
                checkoutConfig: {
                    mySpecialKey: 123,
                },
                webhookSecret: 'webhook_secret',
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
            });

            const result = await controller.createManageSubscriptionLink({
                sessionKey,
                userId,
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
            });
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mySpecialKey: 123,
                mode: 'subscription',
                customer: 'stripe_customer',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                line_items: [
                    {
                        price: 'price_99',
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId,
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

            controller = new SubscriptionController(stripe, auth, authStore, {
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
                ],
                portalConfig: {
                    mySpecialKey: 123,
                },
                webhookSecret: 'webhook_secret',
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
            });

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

            await authStore.saveUser({
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
                return_url: 'return_url',
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

        it('should return a unacceptable_user_id error if given an empty user id', async () => {
            const result = await controller.createManageSubscriptionLink({
                sessionKey,
                userId: '',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_user_id',
                errorMessage:
                    'The given user ID is invalid. It must be a correctly formatted string.',
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

    describe('handleStripeWebhook()', () => {
        let user: AuthUser;

        beforeEach(async () => {
            user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            await authStore.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });
            user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBe('customer_id');
            expect(user.subscriptionStatus).toBeFalsy();
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
                    await authStore.saveUser({
                        ...user,
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

                    const user = await authStore.findUser(userId);
                    expect(user.subscriptionStatus).toBe(status);
                    expect(user.subscriptionId).toBe('sub_1');
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

                    const user = await authStore.findUser(userId);

                    // Do nothing
                    expect(user.subscriptionStatus).toBe('anything');
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
