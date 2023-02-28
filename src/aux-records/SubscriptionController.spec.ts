import { SubscriptionController } from './SubscriptionController';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import { AuthStore, AuthUser } from './AuthStore';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { AuthMessenger } from './AuthMessenger';
import { formatV1SessionKey, parseSessionKey } from './AuthUtils';
import { StripeInterface } from './StripeInterface';

console.log = jest.fn();

describe('SubscriptionController', () => {
    let controller: SubscriptionController;
    let auth: AuthController;
    let authStore: AuthStore;
    let authMessenger: MemoryAuthMessenger;

    let stripeMock: {
        listPricesForProduct: jest.Mock<any>;
        createCheckoutSession: jest.Mock<any>;
        createPortalSession: jest.Mock<any>;
        createCustomer: jest.Mock<any>;
        listActiveSubscriptionsForCustomer: jest.Mock<any>;
    };

    let stripe: StripeInterface;
    let userId: string;
    let sessionKey: string;

    beforeEach(async () => {
        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();
        auth = new AuthController(authStore, authMessenger);

        stripe = stripeMock = {
            listPricesForProduct: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            createCustomer: jest.fn(),
            listActiveSubscriptionsForCustomer: jest.fn(),
        };

        controller = new SubscriptionController(stripe, auth, authStore, {
            lineItems: [
                {
                    price: 'price_1_id',
                    quantity: 1,
                },
            ],
            products: ['product_1_id', 'product_2_id', 'product_3_id'],
        });

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
                subscriptions: [],
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
                subscriptions: [],
            });
        });

        it('should be able to list subscriptions that thge user has', async () => {
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                customer_email: 'test@example.com',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                client_reference_id: userId,
                line_items: [
                    {
                        price: 'price_1_id',
                        quantity: 1,
                    },
                ],
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                customer_email: 'test@example.com',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                client_reference_id: userId,
                line_items: [
                    {
                        price: 'price_1_id',
                        quantity: 1,
                    },
                ],
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                customer_email: 'test@example.com',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                client_reference_id: userId,
                line_items: [
                    {
                        price: 'price_1_id',
                        quantity: 1,
                    },
                ],
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                customer_email: 'test@example.com',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                client_reference_id: userId,
                line_items: [
                    {
                        price: 'price_1_id',
                        quantity: 1,
                    },
                ],
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                customer_email: 'test@example.com',
                success_url: 'success_url',
                cancel_url: 'cancel_url',
                client_reference_id: userId,
                line_items: [
                    {
                        price: 'price_1_id',
                        quantity: 1,
                    },
                ],
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
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
                cancelUrl: 'cancel_url',
                returnUrl: 'return_url',
                successUrl: 'success_url',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_key',
                errorMessage: INVALID_KEY_ERROR_MESSAGE,
            });
        });
    });
});
