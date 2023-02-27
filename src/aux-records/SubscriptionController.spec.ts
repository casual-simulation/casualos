import { SubscriptionController } from './SubscriptionController';
import { AuthController, INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import { AuthStore } from './AuthStore';
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

        controller = new SubscriptionController(stripe, auth, authStore);

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
        it('should be able list subscriptions when the user has no customer ID', async () => {
            const user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();

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
            let user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
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
            let user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
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
            const user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();

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
            const user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();

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
            const user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();

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
            const user = await authStore.findUserByAddress(
                'test@example.com',
                'email'
            );
            expect(user.stripeCustomerId).toBeFalsy();

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

    // describe('')
});
