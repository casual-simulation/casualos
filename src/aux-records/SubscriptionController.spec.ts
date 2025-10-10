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
    ClaimActivationKeySuccess,
    FulfillCheckoutSessionSuccess,
} from './SubscriptionController';
import {
    SubscriptionController,
    formatV1ActivationKey,
    getAccountStatus,
    parseActivationKey,
} from './SubscriptionController';
import type { AuthController } from './AuthController';
import { INVALID_KEY_ERROR_MESSAGE } from './AuthController';
import type { AuthUser } from './AuthStore';
import type { MemoryAuthMessenger } from './MemoryAuthMessenger';
import {
    failure,
    formatV1SessionKey,
    generateV1ConnectionToken,
    parseSessionKey,
    PUBLIC_WRITE_MARKER,
    success,
    unwrap,
} from '@casual-simulation/aux-common';
import type {
    StripeAccount,
    StripeAccountLink,
    StripeAccountStatus,
    StripeCheckoutResponse,
    StripeCreateCustomerResponse,
    StripeInterface,
    StripeProduct,
} from './StripeInterface';
import type {
    FeaturesConfiguration,
    SubscriptionConfiguration,
} from './SubscriptionConfiguration';
import { allowAllFeatures } from './SubscriptionConfiguration';
import type { Studio } from './RecordsStore';
import type { MemoryStore } from './MemoryStore';
import {
    checkAccounts,
    checkTransfers,
    createTestControllers,
    createTestSubConfiguration,
    createTestUser,
    randomBigInt,
} from './TestUtils';
import { merge } from 'es-toolkit/compat';
import { MemoryPurchasableItemRecordsStore } from './purchasable-items/MemoryPurchasableItemRecordsStore';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    toBase64String,
} from '@casual-simulation/aux-common';
import type { FinancialController } from './financial';
import {
    ACCOUNT_IDS,
    AccountCodes,
    CREDITS_DISPLAY_FACTOR,
    CurrencyCodes,
    LEDGERS,
    TigerBeetleFinancialInterface,
    TransferCodes,
    USD_TO_CREDITS,
} from './financial';
import { AccountFlags, TransferFlags } from 'tigerbeetle-node';
import { MemoryContractRecordsStore } from './contracts/MemoryContractRecordsStore';
import type { Client, Account } from 'tigerbeetle-node';
import { createClient } from 'tigerbeetle-node';
import type { ChildProcess } from 'child_process';
import { runTigerBeetle } from './financial/TigerBeetleTestUtils';

const originalDateNow = Date.now;
console.log = jest.fn();
console.warn = jest.fn();
// console.error = jest.fn();

describe('SubscriptionController', () => {
    let controller: SubscriptionController;
    let auth: AuthController;
    let store: MemoryStore;
    let authMessenger: MemoryAuthMessenger;
    let financialInterface: TigerBeetleFinancialInterface;
    let financialController: FinancialController;
    let purchasableItemsStore: MemoryPurchasableItemRecordsStore;
    let contractStore: MemoryContractRecordsStore;

    let stripeMock: {
        publishableKey: string;
        getProductAndPriceInfo: jest.Mock<Promise<StripeProduct | null>>;
        listPricesForProduct: jest.Mock<any>;
        createCheckoutSession: jest.Mock<Promise<StripeCheckoutResponse>>;
        createPortalSession: jest.Mock<any>;
        createCustomer: jest.Mock<Promise<StripeCreateCustomerResponse>>;
        listActiveSubscriptionsForCustomer: jest.Mock<any>;
        constructWebhookEvent: jest.Mock<any>;
        getSubscriptionById: jest.Mock<any>;
        createAccountLink: jest.Mock<Promise<StripeAccountLink>>;
        createAccount: jest.Mock<Promise<StripeAccount>>;
        getAccountById: jest.Mock<Promise<StripeAccount>>;
        getCheckoutSessionById: jest.Mock<Promise<StripeCheckoutResponse>>;
    };

    let stripe: StripeInterface;
    let userId: string;
    let sessionKey: string;
    let nowMock: jest.Mock<number>;
    let currentId = 1n;

    let tbClient: Client;
    let tbProcess: ChildProcess;

    beforeAll(async () => {
        const { port, process } = await runTigerBeetle(
            'subscription-controller'
        );

        tbProcess = process;
        if (!port) {
            throw new Error('Failed to start TigerBeetle!');
        }

        tbClient = createClient({
            replica_addresses: [port],
            cluster_id: 0n,
        });
    });

    beforeEach(async () => {
        currentId = 1n;
        nowMock = Date.now = jest.fn();
        const idOffset = randomBigInt();
        financialInterface = new TigerBeetleFinancialInterface({
            client: tbClient,
            id: () => currentId++,
            idOffset: idOffset,
        });
        const services = createTestControllers(
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
            financialInterface
        );

        store = services.store;
        authMessenger = services.authMessenger;
        purchasableItemsStore = new MemoryPurchasableItemRecordsStore(store);
        contractStore = new MemoryContractRecordsStore(store);
        auth = services.auth;
        financialController = services.financialController;

        await financialController.init();

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
            createAccountLink: jest.fn(),
            createAccount: jest.fn(),
            getAccountById: jest.fn(),
            getCheckoutSessionById: jest.fn(),
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
            store,
            services.policies,
            store,
            purchasableItemsStore,
            services.financialController,
            contractStore
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
        if (tbProcess) {
            tbProcess.kill();
        }
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

            it('should return the balances of the accounts that the user has', async () => {
                const account1 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.usd,
                        userId,
                    })
                );
                const account2 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.credits,
                        userId,
                    })
                );

                await financialController.internalTransaction({
                    transfers: [
                        {
                            transferId: 201n,
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: account1.id,
                            amount: 5000,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.usd,
                        },
                        {
                            transferId: 202n,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            creditAccountId: account2.id,
                            amount: 2000,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.credits,
                        },
                    ],
                });

                const result = await controller.getSubscriptionStatus({
                    userId,
                    sessionKey,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    accountBalances: {
                        usd: {
                            pendingCreditsN: '0',
                            pendingDebitsN: '0',
                            creditsN: '5000',
                            debitsN: '0',
                            displayFactorN: '100',
                            accountId: account1.id.toString(),
                            currency: 'usd',
                        },
                        credits: {
                            pendingCreditsN: '0',
                            pendingDebitsN: '0',
                            creditsN: '2000',
                            debitsN: '0',
                            displayFactorN: CREDITS_DISPLAY_FACTOR.toString(),
                            accountId: account2.id.toString(),
                            currency: 'credits',
                        },
                    },
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

            it('should include pending credits and debits in the account balances', async () => {
                const account1 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.usd,
                        userId,
                    })
                );
                const account2 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.credits,
                        userId,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 201n,
                                debitAccountId: ACCOUNT_IDS.assets_cash,
                                creditAccountId: account1.id,
                                amount: 5000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.usd,
                            },
                            {
                                transferId: 202n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account2.id,
                                amount: 2000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                            },
                        ],
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 203n,
                                debitAccountId: ACCOUNT_IDS.assets_cash,
                                creditAccountId: account1.id,
                                amount: 5000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                            {
                                transferId: 204n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account2.id,
                                amount: 2000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                                pending: true,
                            },
                        ],
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 205n,
                                debitAccountId: account1.id,
                                creditAccountId: ACCOUNT_IDS.assets_cash,
                                amount: 123,
                                code: TransferCodes.admin_debit,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                            {
                                transferId: 206n,
                                debitAccountId: account2.id,
                                creditAccountId: ACCOUNT_IDS.liquidity_credits,
                                amount: 123,
                                code: TransferCodes.admin_debit,
                                currency: CurrencyCodes.credits,
                                pending: true,
                            },
                        ],
                    })
                );

                const result = await controller.getSubscriptionStatus({
                    userId,
                    sessionKey,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    accountBalances: {
                        usd: {
                            pendingCreditsN: '5000',
                            pendingDebitsN: '123',
                            creditsN: '5000',
                            debitsN: '0',
                            displayFactorN: '100',
                            accountId: account1.id.toString(),
                            currency: 'usd',
                        },
                        credits: {
                            pendingCreditsN: '2000',
                            pendingDebitsN: '123',
                            creditsN: '2000',
                            debitsN: '0',
                            displayFactorN: CREDITS_DISPLAY_FACTOR.toString(),
                            accountId: account2.id.toString(),
                            currency: 'credits',
                        },
                    },
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

            it('should return the balances of the accounts that the user has', async () => {
                const account1 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.usd,
                        studioId,
                    })
                );
                const account2 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.credits,
                        studioId,
                    })
                );

                await financialController.internalTransaction({
                    transfers: [
                        {
                            transferId: 201n,
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: account1.id,
                            amount: 5000,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.usd,
                        },
                        {
                            transferId: 202n,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            creditAccountId: account2.id,
                            amount: 2000,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.credits,
                        },
                    ],
                });

                const result = await controller.getSubscriptionStatus({
                    studioId,
                    sessionKey,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    accountBalances: {
                        usd: {
                            pendingCreditsN: '0',
                            pendingDebitsN: '0',
                            creditsN: '5000',
                            debitsN: '0',
                            displayFactorN: '100',
                            accountId: account1.id.toString(),
                            currency: 'usd',
                        },
                        credits: {
                            pendingCreditsN: '0',
                            pendingDebitsN: '0',
                            creditsN: '2000',
                            debitsN: '0',
                            displayFactorN: CREDITS_DISPLAY_FACTOR.toString(),
                            accountId: account2.id.toString(),
                            currency: 'credits',
                        },
                    },
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

            it('should include pending credits and debits in the account balances', async () => {
                const account1 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.usd,
                        studioId,
                    })
                );
                const account2 = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        ledger: LEDGERS.credits,
                        studioId,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 201n,
                                debitAccountId: ACCOUNT_IDS.assets_cash,
                                creditAccountId: account1.id,
                                amount: 5000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.usd,
                            },
                            {
                                transferId: 202n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account2.id,
                                amount: 2000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                            },
                        ],
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 203n,
                                debitAccountId: ACCOUNT_IDS.assets_cash,
                                creditAccountId: account1.id,
                                amount: 5000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                            {
                                transferId: 204n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account2.id,
                                amount: 2000,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                                pending: true,
                            },
                        ],
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: 205n,
                                debitAccountId: account1.id,
                                creditAccountId: ACCOUNT_IDS.assets_cash,
                                amount: 123,
                                code: TransferCodes.admin_debit,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                            {
                                transferId: 206n,
                                debitAccountId: account2.id,
                                creditAccountId: ACCOUNT_IDS.liquidity_credits,
                                amount: 123,
                                code: TransferCodes.admin_debit,
                                currency: CurrencyCodes.credits,
                                pending: true,
                            },
                        ],
                    })
                );

                const result = await controller.getSubscriptionStatus({
                    studioId,
                    sessionKey,
                });

                expect(result).toEqual({
                    success: true,
                    userId,
                    studioId,
                    publishableKey: 'publishable_key',
                    subscriptions: [],
                    accountBalances: {
                        usd: {
                            pendingCreditsN: '5000',
                            pendingDebitsN: '123',
                            creditsN: '5000',
                            debitsN: '0',
                            displayFactorN: '100',
                            accountId: account1.id.toString(),
                            currency: 'usd',
                        },
                        credits: {
                            pendingCreditsN: '2000',
                            pendingDebitsN: '123',
                            creditsN: '2000',
                            debitsN: '0',
                            displayFactorN: CREDITS_DISPLAY_FACTOR.toString(),
                            accountId: account2.id.toString(),
                            currency: 'credits',
                        },
                    },
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                        id: 'session_id',
                        status: 'open',
                        payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                        id: 'session_id',
                        status: 'open',
                        payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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
                    id: 'session_id',
                    status: 'open',
                    payment_status: 'unpaid',
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

    describe('createManageStoreAccountLink()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            nowMock.mockReturnValue(101);

            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });
        });

        it('should create a link to manage the studio account and return it', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_update',
            });
        });

        it('should create a link to onboard the studio if the requirements are incomplete', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            await store.updateStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'incomplete',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_onboarding',
            });
        });

        it('should create a new account for the studio if it doesnt have one', async () => {
            stripeMock.createAccount.mockResolvedValueOnce({
                id: 'accountId',
                requirements: {
                    currently_due: ['requirement1'],
                    current_deadline: null,
                    disabled_reason: null,
                    errors: [],
                    eventually_due: [],
                    past_due: [],
                    pending_verification: [],
                },
                charges_enabled: false,
            });

            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            await store.updateStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: null,
                stripeAccountStatus: null,
                stripeAccountRequirementsStatus: null,
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            await expect(store.getStudioById('studioId')).resolves.toEqual({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'pending',
                stripeAccountRequirementsStatus: 'incomplete',
            });

            expect(stripeMock.createAccount).toHaveBeenCalledWith({
                controller: {
                    fees: {
                        payer: 'account',
                    },
                    losses: {
                        payments: 'stripe',
                    },
                    requirement_collection: 'stripe',
                    stripe_dashboard: {
                        type: 'full',
                    },
                },
                metadata: {
                    studioId: 'studioId',
                },
            });
            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_onboarding',
            });
        });

        it('should return not_authorized if store features are not allowed', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: false,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: userId,
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                })
            );

            expect(stripeMock.createAccountLink).not.toHaveBeenCalled();
        });

        it('should return not_authorized if the user is not a member of the studio', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: 'wrongUserId',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                })
            );

            expect(stripeMock.createAccountLink).not.toHaveBeenCalled();
        });

        it('should return not_authorized if the user is not an admin in the studio', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            await store.saveNewUser({
                id: 'wrongUserId',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'wrongUserId',
                isPrimaryContact: false,
                role: 'member',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'studioId',
                userId: 'wrongUserId',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                })
            );

            expect(stripeMock.createAccountLink).not.toHaveBeenCalled();
        });

        it('should return studio_not_found if the studio does not exist', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageStoreAccountLink({
                studioId: 'missingStudio',
                userId: userId,
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'studio_not_found',
                    errorMessage: 'The given studio was not found.',
                })
            );

            expect(stripeMock.createAccountLink).not.toHaveBeenCalled();
        });
    });

    describe('createManageXpAccountLink()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = createTestSubConfiguration();
            nowMock.mockReturnValue(101);

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });
        });

        it('should create a link to manage the stripe account and return it', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageXpAccountLink({
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_update',
            });

            const user = await store.findUser(userId);
            expect(user.stripeAccountId).toBe('accountId');
            expect(user.stripeAccountRequirementsStatus).toBe('complete');
            expect(user.stripeAccountStatus).toBe('active');
        });

        it('should create a link to onboard the user if the requirements are incomplete', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'incomplete',
            });

            const result = await controller.createManageXpAccountLink({
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_onboarding',
            });
        });

        it('should create a new stripe account for the studio if it doesnt have one', async () => {
            stripeMock.createAccount.mockResolvedValueOnce({
                id: 'accountId',
                requirements: {
                    currently_due: ['requirement1'],
                    current_deadline: null,
                    disabled_reason: null,
                    errors: [],
                    eventually_due: [],
                    past_due: [],
                    pending_verification: [],
                },
                charges_enabled: false,
            });

            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeAccountId: null,
                stripeAccountStatus: null,
                stripeAccountRequirementsStatus: null,
            });

            const result = await controller.createManageXpAccountLink({
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            await expect(store.findUser(userId)).resolves.toEqual({
                ...user,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'pending',
                stripeAccountRequirementsStatus: 'incomplete',
            });

            expect(stripeMock.createAccount).toHaveBeenCalledWith({
                controller: {
                    fees: {
                        payer: 'application',
                    },
                    losses: {
                        payments: 'application',
                    },
                    requirement_collection: 'stripe',
                    stripe_dashboard: {
                        type: 'express',
                    },
                },
                metadata: {
                    userId: userId,
                },
            });
            expect(stripeMock.createAccountLink).toHaveBeenCalledWith({
                account: 'accountId',
                refresh_url: 'https://return-url/',
                return_url: 'https://return-url/',
                type: 'account_onboarding',
            });
        });

        it('should create a new financial account for the studio if it doesnt have one', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
            });

            const result = await controller.createManageXpAccountLink({
                userId: userId,
            });

            expect(result).toEqual(
                success({
                    url: 'account_link',
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: '1',
                    userId: userId,
                    ledger: LEDGERS.usd,
                    currency: 'usd',
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: 1n,
                    debits_pending: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    credits_posted: 0n,
                    user_data_128: 0n,
                    user_data_64: 0n,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: 1,
                    flags:
                        AccountFlags.debits_must_not_exceed_credits |
                        AccountFlags.history,
                    code: AccountCodes.liabilities_user,
                },
            ]);
        });

        it('should return user_not_found if the user does not exist', async () => {
            stripeMock.createAccountLink.mockResolvedValueOnce({
                url: 'account_link',
            });

            const result = await controller.createManageXpAccountLink({
                userId: 'missing_user_id',
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'user_not_found',
                    errorMessage: 'The user was not found.',
                })
            );

            expect(stripeMock.createAccountLink).not.toHaveBeenCalled();
        });
    });

    describe('createPurchaseItemLink()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'fixed',
                                                amount: 10,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            nowMock.mockReturnValue(101);

            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await store.addRecord({
                name: 'studioId',
                studioId: 'studioId',
                ownerId: null,
                secretHashes: [],
                secretSalt: 'secret',
            });

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                name: 'Item 1',
                description: 'Description 1',
                imageUrls: [],
                currency: 'usd',
                cost: 100,
                roleName: 'myRole',
                taxCode: null,
                roleGrantTimeMs: null,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should create a new checkout session', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                url: 'checkout_url',
                sessionId: expect.any(String),
            });

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Item 1',
                                description: 'Description 1',
                                images: [],
                                metadata: {
                                    recordName: 'studioId',
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    application_fee_amount: 10,
                },
                connect: {
                    stripeAccount: 'accountId',
                },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);

            await expect(store.findUser(userId)).resolves.toEqual({
                ...user,
            });
        });

        it('should support users that are not logged in', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const result = await controller.createPurchaseItemLink({
                userId: null,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                url: 'checkout_url',
                sessionId: expect.any(String),
            });

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Item 1',
                                description: 'Description 1',
                                images: [],
                                metadata: {
                                    recordName: 'studioId',
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: null,
                metadata: {
                    userId: null,
                    checkoutSessionId: expect.any(String),
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    application_fee_amount: 10,
                },
                connect: {
                    stripeAccount: 'accountId',
                },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: null,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);
        });

        it('should be able to charge fixed application fees', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'fixed',
                                                amount: 10,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                url: 'checkout_url',
                sessionId: expect.any(String),
            });

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Item 1',
                                description: 'Description 1',
                                images: [],
                                metadata: {
                                    recordName: 'studioId',
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    application_fee_amount: 10,
                },
                connect: {
                    stripeAccount: 'accountId',
                },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);
        });

        it('should be able to charge percentage application fees', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'percent',
                                                percent: 15,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                url: 'checkout_url',
                sessionId: expect.any(String),
            });

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Item 1',
                                description: 'Description 1',
                                images: [],
                                metadata: {
                                    recordName: 'studioId',
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    application_fee_amount: 15,
                },
                connect: {
                    stripeAccount: 'accountId',
                },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);
        });

        it('should round partial cents from the application fee up', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'percent',
                                                percent: 15,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                cost: 49,
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 49,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                url: 'checkout_url',
                sessionId: expect.any(String),
            });

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 49,
                            product_data: {
                                name: 'Item 1',
                                description: 'Description 1',
                                images: [],
                                metadata: {
                                    recordName: 'studioId',
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // 49 * 0.15 = 7.35 rounds up 8
                    application_fee_amount: 8,
                },
                connect: {
                    stripeAccount: 'accountId',
                },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);
        });

        it('should return price_does_not_match if the expected cost doesnt match the item cost', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 999,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'price_does_not_match',
                errorMessage:
                    'The expected price does not match the actual price of the item.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return price_does_not_match if the currency doesnt match the item currency', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'wrong',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'price_does_not_match',
                errorMessage:
                    'The expected price does not match the actual price of the item.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return store_disabled if store subscription doesnt allow store features', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: false,
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'store_disabled',
                errorMessage:
                    'The store you are trying to purchase from is disabled.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return store_disabled if the store doesnt have a stripe account', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const studio = await store.getStudioById('studioId');
            await store.updateStudio({
                ...studio,
                stripeAccountId: null,
                stripeAccountStatus: null,
                stripeAccountRequirementsStatus: null,
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'store_disabled',
                errorMessage:
                    'The store you are trying to purchase from is disabled.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return store_disabled if the store doesnt have an active status', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const studio = await store.getStudioById('studioId');
            await store.updateStudio({
                ...studio,
                stripeAccountId: 'account_id',
                stripeAccountStatus: 'pending',
                stripeAccountRequirementsStatus: 'complete',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'store_disabled',
                errorMessage:
                    'The store you are trying to purchase from is disabled.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return currency_not_supported if the subscription doesnt have limits for it', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                currency: 'eur',
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'eur',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'currency_not_supported',
                errorMessage: 'The currency is not supported.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return subscription_limit_reached if the item cost is greater than the max cost for the subscription', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                cost: 10001,
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 10001,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The item you are trying to purchase has a price that is not allowed.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return server_error if the application fee is greater than the item cost', async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'fixed',
                                                amount: 100,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                cost: 10,
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 10,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'server_error',
                errorMessage:
                    'The application fee is greater than the cost of the item.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return not_authorized if the user does not have the purchase permission for the item', async () => {
            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                name: 'Item 1',
                description: 'Description 1',
                imageUrls: [],
                currency: 'usd',
                cost: 100,
                roleName: 'myRole',
                taxCode: null,
                roleGrantTimeMs: null,
                markers: [PRIVATE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'studioId',
                    resourceKind: 'purchasableItem',
                    resourceId: 'item1',
                    action: 'purchase',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return not_authorized if the inst does not have the purchase permission for the item', async () => {
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: userId,
                isPrimaryContact: true,
                role: 'admin',
            });
            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                name: 'Item 1',
                description: 'Description 1',
                imageUrls: [],
                currency: 'usd',
                cost: 100,
                roleName: 'myRole',
                taxCode: null,
                roleGrantTimeMs: null,
                markers: [PRIVATE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: ['myInst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'studioId',
                    resourceKind: 'purchasableItem',
                    resourceId: 'item1',
                    action: 'purchase',
                    subjectType: 'inst',
                    subjectId: '/myInst',
                },
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return item_already_purchased if the user already has the role', async () => {
            await store.assignSubjectRole('studioId', userId, 'user', {
                role: 'myRole',
                expireTimeMs: null,
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: ['myInst'],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'item_already_purchased',
                errorMessage:
                    'You already have the role that the item would grant.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });
    });

    describe('purchaseContract()', () => {
        const recordName = 'recordName';

        beforeEach(async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                                fee: {
                                    type: 'fixed',
                                    amount: 10,
                                },
                            })
                    )
            );

            nowMock.mockReturnValue(101);

            await store.addRecord({
                name: recordName,
                ownerId: userId,
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.saveUser({
                id: 'xpUserId',
                email: 'xpUser@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should create a new checkout session', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 110,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    // contract value
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                    // platform fee
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 10,
                            product_data: {
                                name: 'Application Fee',
                                images: [],
                                metadata: {
                                    fee: true,
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // application_fee_amount: 10,
                    transfer_group: 'contract1',
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['3', '4'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.linked | TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 10n,
                    code: TransferCodes.xp_platform_fee,
                    // contract account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 110n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 10n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 100n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should allow using the users USD account for the purchase', async () => {
            const userAccount = unwrap(
                await financialController.getOrCreateFinancialAccount({
                    userId: userId,
                    ledger: LEDGERS.usd,
                })
            );

            // Give the user 1000 USD
            unwrap(
                await financialController.internalTransaction({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: userAccount!.id,
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.usd,
                        },
                    ],
                })
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 110,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'no_payment_required',
                    paid: true,
                    stripeCheckoutSessionId: null,
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['6', '7'],
                    transactionId: '5',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([6n, 7n]), [
                {
                    id: 6n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 4n,
                    // User account
                    debit_account_id: userAccount!.id,
                    flags: TransferFlags.linked,
                    ledger: LEDGERS.usd,

                    user_data_128: 5n,
                },
                {
                    id: 7n,
                    amount: 10n,
                    code: TransferCodes.xp_platform_fee,
                    // revenue account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // User account
                    debit_account_id: userAccount!.id,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,

                    user_data_128: 5n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.assets_cash,
                    credits_posted: 0n,
                    debits_posted: 1000n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: userAccount!.id,
                    credits_posted: 1000n,
                    debits_posted: 110n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 10n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: 4n,
                    code: AccountCodes.liabilities_contract,
                    credits_posted: 100n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should allow using the users Credits account for the purchase', async () => {
            const userAccount = unwrap(
                await financialController.getOrCreateFinancialAccount({
                    userId: userId,
                    ledger: LEDGERS.credits,
                })
            );

            // Give the user 1000 USD
            unwrap(
                await financialController.internalTransaction({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: ACCOUNT_IDS.liquidity_usd,
                            amount: 1000n,
                            code: TransferCodes.exchange,
                            currency: CurrencyCodes.usd,
                        },
                        {
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            creditAccountId: userAccount!.id,
                            amount: 1000n * USD_TO_CREDITS,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.credits,
                        },
                    ],
                })
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 110,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'no_payment_required',
                    paid: true,
                    stripeCheckoutSessionId: null,
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['7', '8', '9'],
                    transactionId: '6',
                },
            ]);

            checkTransfers(
                await financialInterface.lookupTransfers([7n, 8n, 9n]),
                [
                    {
                        id: 7n,
                        amount: 110n * USD_TO_CREDITS,
                        code: TransferCodes.exchange,
                        credit_account_id: ACCOUNT_IDS.liquidity_credits,
                        debit_account_id: userAccount!.id,
                        flags: TransferFlags.linked,
                        ledger: LEDGERS.credits,

                        user_data_128: 6n,
                    },
                    {
                        id: 8n,
                        amount: 100n,
                        code: TransferCodes.contract_payment,
                        // contract account
                        credit_account_id: 5n,
                        // User account
                        debit_account_id: ACCOUNT_IDS.liquidity_usd,
                        flags: TransferFlags.linked,
                        ledger: LEDGERS.usd,

                        user_data_128: 6n,
                    },
                    {
                        id: 9n,
                        amount: 10n,
                        code: TransferCodes.xp_platform_fee,
                        // contract account
                        credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                        // User account
                        debit_account_id: ACCOUNT_IDS.liquidity_usd,
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,

                        user_data_128: 6n,
                    },
                ]
            );

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.assets_cash,
                    credits_posted: 0n,
                    debits_posted: 1000n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: userAccount!.id,
                    credits_posted: 1000n * USD_TO_CREDITS,
                    debits_posted: 110n * USD_TO_CREDITS,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 10n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: 5n,
                    code: AccountCodes.liabilities_contract,
                    credits_posted: 100n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.liquidity_credits,
                    credits_posted: 110n * USD_TO_CREDITS,
                    debits_posted: 1000n * USD_TO_CREDITS,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.liquidity_usd,
                    credits_posted: 1000n,
                    debits_posted: 110n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should support users that are not logged in for publicWrite contracts', async () => {
            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PUBLIC_WRITE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const result = await controller.purchaseContract({
                userId: null,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 110,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 10,
                            product_data: {
                                name: 'Application Fee',
                                images: [],
                                metadata: {
                                    fee: true,
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: null,
                metadata: {
                    userId: null,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    transfer_group: 'contract1',
                    // application_fee_amount: 10,
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: null,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['3', '4'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.linked | TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 10n,
                    code: TransferCodes.xp_platform_fee,
                    // contract account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 110n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 10n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 100n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should automatically void the transfers when stripe fails to create a checkout session', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                            })
                    )
            );

            stripeMock.createCheckoutSession.mockRejectedValueOnce(
                new Error('Stripe error')
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'server_error',
                    errorMessage:
                        'Failed to create checkout session for contract.',
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalled();

            expect(store.checkoutSessions).toEqual([]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 0n,
                    code: 0,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.void_pending_transfer,
                    ledger: LEDGERS.credits,

                    pending_id: 3n,
                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should be able to charge no fee', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                            })
                    )
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // application_fee_amount: 10,
                    transfer_group: 'contract1',
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['3'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 100n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 100n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should be able to charge fixed application fees', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                                fee: {
                                    type: 'fixed',
                                    amount: 20,
                                },
                            })
                    )
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 120,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 20,
                            product_data: {
                                name: 'Application Fee',
                                images: [],
                                metadata: {
                                    fee: true,
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // application_fee_amount: 10,
                    transfer_group: 'contract1',
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['3', '4'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.linked | TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 20n,
                    code: TransferCodes.xp_platform_fee,
                    // contract account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 120n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 20n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 100n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should be able to charge a percentage application fee', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                                fee: {
                                    type: 'percent',
                                    percent: 35,
                                },
                            })
                    )
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 135,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 100,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 35,
                            product_data: {
                                name: 'Application Fee',
                                images: [],
                                metadata: {
                                    fee: true,
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // application_fee_amount: 10,
                    transfer_group: 'contract1',
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 100,
                        },
                    ],
                    transferIds: ['3', '4'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.linked | TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 35n,
                    code: TransferCodes.xp_platform_fee,
                    // contract account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 135n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 35n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 100n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should round partial cents from the application fee up', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                                fee: {
                                    type: 'percent',
                                    percent: 15,
                                },
                            })
                    )
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 49,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PRIVATE_MARKER],
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 49 + 8,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                success({
                    url: 'checkout_url',
                    sessionId: expect.any(String),
                })
            );

            expect(stripeMock.createCheckoutSession).toHaveBeenCalledWith({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 49,
                            product_data: {
                                name: 'Contract',
                                images: [],
                                metadata: {
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: 8,
                            product_data: {
                                name: 'Application Fee',
                                images: [],
                                metadata: {
                                    fee: true,
                                    resourceKind: 'contract',
                                    recordName: recordName,
                                    address: 'item1',
                                },
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: expect.stringMatching(
                    /^https:\/\/return-url\/store\/fulfillment\//
                ),
                cancel_url: 'return-url',
                customer_email: 'test@example.com',
                metadata: {
                    userId: userId,
                    checkoutSessionId: expect.any(String),
                    transactionId: '2',
                },
                client_reference_id: expect.any(String),
                payment_intent_data: {
                    // application_fee_amount: 10,
                    transfer_group: 'contract1',
                },
                // connect: {
                //     stripeAccount: 'accountId',
                // },
            });

            expect(store.checkoutSessions).toEqual([
                {
                    id: expect.any(String),
                    stripeStatus: 'open',
                    stripePaymentStatus: 'unpaid',
                    paid: false,
                    stripeCheckoutSessionId: 'checkout_id',
                    invoiceId: null,
                    userId: userId,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: recordName,
                            contractAddress: 'item1',
                            contractId: 'contract1',
                            value: 49,
                        },
                    ],
                    transferIds: ['3', '4'],
                    transfersPending: true,
                    transactionId: '2',
                },
            ]);

            checkTransfers(await financialInterface.lookupTransfers([3n, 4n]), [
                {
                    id: 3n,
                    amount: 49n,
                    code: TransferCodes.contract_payment,
                    // contract account
                    credit_account_id: 1n,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.linked | TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
                {
                    id: 4n,
                    amount: 8n,
                    code: TransferCodes.xp_platform_fee,
                    // contract account
                    credit_account_id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    // Stripe account
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.pending,
                    ledger: LEDGERS.usd,

                    user_data_128: 2n,
                },
            ]);

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 49n + 8n,
                },
                {
                    id: ACCOUNT_IDS.revenue_xp_platform_fees,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 8n,
                    debits_pending: 0n,
                },
                {
                    id: 1n,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 49n,
                    debits_pending: 0n,
                },
            ]);
        });

        it('should return price_does_not_match if the expected cost doesnt match the item cost', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 999,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price of the contract.',
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return price_does_not_match if the currency doesnt match the item currency', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'wrong',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'price_does_not_match',
                    errorMessage:
                        'The expected price does not match the actual price of the contract.',
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return store_disabled if store subscription doesnt allow contract features', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub.withTier('tier1').withAllDefaultFeatures()
                    )
            );

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'store_disabled',
                    errorMessage:
                        "The account you are trying to purchase the contract for doesn't have access to contracting features.",
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it.skip('should return currency_not_supported if the subscription doesnt have limits for it', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                    )
            );
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                currency: 'eur',
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.createPurchaseItemLink({
                userId: userId,
                item: {
                    recordName: 'studioId',
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'eur',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'currency_not_supported',
                errorMessage: 'The currency is not supported.',
            });

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return subscription_limit_reached if the item cost is greater than the max cost for the subscription', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                            })
                    )
            );

            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 10001,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PRIVATE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                stripeCustomerId: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 10001,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The contract you are trying to purchase has a price that is not allowed.',
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return not_authorized if the user does not have the purchase permission for the item', async () => {
            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PRIVATE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: 'xpUserId',
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName: recordName,
                        resourceKind: 'contract',
                        resourceId: 'item1',
                        action: 'purchase',
                        subjectType: 'user',
                        subjectId: 'xpUserId',
                    },
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return not_authorized if the inst does not have the purchase permission for the item', async () => {
            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'pending',
                markers: [PRIVATE_MARKER],
            });

            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: ['myInst'],
            });

            expect(result).toEqual(
                failure({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName: recordName,
                        resourceKind: 'contract',
                        resourceId: 'item1',
                        action: 'purchase',
                        subjectType: 'inst',
                        subjectId: '/myInst',
                    },
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });

        it('should return item_already_purchased if the contract has a status other than pending', async () => {
            stripeMock.createCheckoutSession.mockResolvedValueOnce({
                url: 'checkout_url',
                id: 'checkout_id',
                payment_status: 'unpaid',
                status: 'open',
            });

            stripeMock.createCustomer.mockResolvedValueOnce({
                id: 'customer_id',
            });

            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'open',
                markers: [PRIVATE_MARKER],
            });

            const result = await controller.purchaseContract({
                userId: userId,
                contract: {
                    recordName: recordName,
                    address: 'item1',
                    expectedCost: 100,
                    currency: 'usd',
                },
                returnUrl: 'return-url',
                successUrl: 'success-url',
                instances: ['myInst'],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'item_already_purchased',
                    errorMessage: 'The contract has already been purchased.',
                })
            );

            expect(stripeMock.createCheckoutSession).not.toHaveBeenCalled();
            expect(stripeMock.createCustomer).not.toHaveBeenCalled();
            expect(store.checkoutSessions).toEqual([]);
        });
    });

    describe('cancelContract()', () => {
        const recordName = 'recordName';

        beforeEach(async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withContracts()
                            .withContractsCurrencyLimit('usd', {
                                maxCost: 10000,
                                minCost: 10,
                                fee: {
                                    type: 'fixed',
                                    amount: 10,
                                },
                            })
                    )
            );

            nowMock.mockReturnValue(101);

            await store.addRecord({
                name: recordName,
                ownerId: userId,
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.saveUser({
                id: 'xpUserId',
                email: 'xpUser@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await contractStore.putItem(recordName, {
                id: 'contract1',
                address: 'item1',
                initialValue: 100,
                holdingUserId: 'xpUserId',
                issuingUserId: userId,
                issuedAtMs: 100,
                rate: 1,
                status: 'open',
                markers: [PRIVATE_MARKER],
            });
        });

        it('should return not_found if the contract does not exist', async () => {
            const result = await controller.cancelContract({
                recordName: recordName,
                address: 'missing',
                userId: userId,
                instances: [],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'not_found',
                    errorMessage: 'The contract could not be found.',
                })
            );
        });

        describe('USD', () => {
            let contractAccount: Account | null;
            let userAccount: Account | null;
            beforeEach(async () => {
                userAccount = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        userId: userId,
                        ledger: LEDGERS.usd,
                    })
                );

                contractAccount = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        contractId: 'contract1',
                        ledger: LEDGERS.usd,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: '200',
                                amount: 200,
                                code: TransferCodes.contract_payment,
                                debitAccountId: ACCOUNT_IDS.assets_stripe,
                                creditAccountId: userAccount!.id,
                                currency: CurrencyCodes.usd,
                            },
                            {
                                transferId: '201',
                                amount: 100,
                                code: TransferCodes.contract_payment,
                                debitAccountId: userAccount!.id,
                                creditAccountId: contractAccount!.id,
                                currency: CurrencyCodes.usd,
                            },
                            {
                                transferId: '202',
                                amount: 10,
                                code: TransferCodes.xp_platform_fee,
                                debitAccountId: userAccount!.id,
                                creditAccountId:
                                    ACCOUNT_IDS.revenue_xp_platform_fees,
                                currency: CurrencyCodes.usd,
                            },
                        ],
                    })
                );
            });

            it('should cancel the contract and refund the payment to the USD account', async () => {
                const result = await controller.cancelContract({
                    recordName: recordName,
                    address: 'item1',
                    userId,
                    instances: [],
                });

                expect(result).toEqual(
                    success({
                        refundedAmount: 100,
                        refundCurrency: 'usd',
                    })
                );

                const contract = await contractStore.getItemByAddress(
                    recordName,
                    'item1'
                );

                expect(contract).toMatchObject({
                    status: 'closed',
                    closedAtMs: 101,
                });

                checkTransfers(
                    await financialInterface.lookupTransfers([4n, 5n]),
                    [
                        {
                            id: 4n,
                            amount: 100n,
                            code: TransferCodes.contract_refund,
                            credit_account_id: userAccount!.id,
                            debit_account_id: contractAccount!.id,
                            flags:
                                TransferFlags.linked |
                                TransferFlags.balancing_debit,
                            ledger: LEDGERS.usd,
                            user_data_128: 6n,
                        },
                        {
                            id: 5n,
                            amount: 0n,
                            code: TransferCodes.account_closing,
                            credit_account_id: userAccount!.id,
                            debit_account_id: contractAccount!.id,
                            flags:
                                TransferFlags.closing_debit |
                                TransferFlags.pending,
                            ledger: LEDGERS.usd,
                            user_data_128: 6n,
                        },
                    ]
                );

                checkAccounts(financialInterface, [
                    {
                        id: userAccount!.id,
                        credits_posted: 300n,
                        credits_pending: 0n,
                        debits_posted: 110n,
                        debits_pending: 0n,
                    },
                    {
                        id: contractAccount!.id,
                        credits_posted: 100n,
                        credits_pending: 0n,
                        debits_posted: 100n,
                        debits_pending: 0n,
                        flags:
                            AccountFlags.history |
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.closed,
                    },
                    {
                        id: ACCOUNT_IDS.revenue_xp_platform_fees,
                        credits_posted: 10n,
                        credits_pending: 0n,
                        debits_posted: 0n,
                        debits_pending: 0n,
                    },
                ]);
            });

            it('should be able to cancel pending contracts', async () => {
                await contractStore.updateItem(recordName, {
                    id: 'differentContractId',
                    address: 'item1',
                    status: 'pending',
                });

                const result = await controller.cancelContract({
                    recordName: recordName,
                    address: 'item1',
                    userId,
                    instances: [],
                });

                expect(result).toEqual(
                    success({
                        refundedAmount: 0,
                        refundCurrency: 'usd',
                    })
                );

                const contract = await contractStore.getItemByAddress(
                    recordName,
                    'item1'
                );

                expect(contract).toMatchObject({
                    status: 'closed',
                    closedAtMs: 101,
                });

                // checkTransfers(await financialInterface.transfers.slice(3), []);

                checkAccounts(financialInterface, [
                    {
                        id: userAccount!.id,
                        credits_posted: 200n,
                        credits_pending: 0n,
                        debits_posted: 110n,
                        debits_pending: 0n,
                    },
                    {
                        id: ACCOUNT_IDS.revenue_xp_platform_fees,
                        credits_posted: 10n,
                        credits_pending: 0n,
                        debits_posted: 0n,
                        debits_pending: 0n,
                    },
                ]);
            });

            it('should do nothing if the contract is already closed', async () => {
                await contractStore.updateItem(recordName, {
                    address: 'item1',
                    status: 'closed',
                    closedAtMs: 99,
                });

                const result = await controller.cancelContract({
                    recordName: recordName,
                    address: 'item1',
                    userId,
                    instances: [],
                });

                expect(result).toEqual(
                    success({
                        refundedAmount: 0,
                        refundCurrency: 'usd',
                    })
                );

                const contract = await contractStore.getItemByAddress(
                    recordName,
                    'item1'
                );

                expect(contract).toMatchObject({
                    status: 'closed',
                    closedAtMs: 99,
                });

                // checkTransfers(financialInterface.transfers.slice(3), []);

                checkAccounts(financialInterface, [
                    {
                        id: userAccount!.id,
                        credits_posted: 200n,
                        credits_pending: 0n,
                        debits_posted: 110n,
                        debits_pending: 0n,
                    },
                    {
                        id: contractAccount!.id,
                        credits_posted: 100n,
                        credits_pending: 0n,
                        debits_posted: 0n,
                        debits_pending: 0n,
                        flags:
                            AccountFlags.history |
                            AccountFlags.debits_must_not_exceed_credits,
                    },
                    {
                        id: ACCOUNT_IDS.revenue_xp_platform_fees,
                        credits_posted: 10n,
                        credits_pending: 0n,
                        debits_posted: 0n,
                        debits_pending: 0n,
                    },
                ]);
            });
        });
    });

    describe('fulfillCheckoutSession()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'fixed',
                                                amount: 10,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            nowMock.mockReturnValue(101);

            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await store.addRecord({
                name: 'studioId',
                studioId: 'studioId',
                ownerId: null,
                secretHashes: [],
                secretSalt: 'secret',
            });

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                name: 'Item 1',
                description: 'Description 1',
                imageUrls: [],
                currency: 'usd',
                cost: 100,
                roleName: 'myRole',
                taxCode: null,
                roleGrantTimeMs: null,
                markers: [PUBLIC_READ_MARKER],
            });

            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'open',
                paymentStatus: 'unpaid',
                paid: false,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: {
                    currency: 'usd',
                    paid: false,
                    status: 'open',
                    description: 'description',
                    stripeInvoiceId: 'invoice1',
                    tax: 0,
                    subtotal: 100,
                    total: 100,
                    stripeHostedInvoiceUrl: 'hosted-url',
                    stripeInvoicePdfUrl: 'pdf-url',
                },
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });
        });

        it('should return not_found if the checkout session does not exist', async () => {
            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'missing',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_found',
                errorMessage: 'The checkout session does not exist.',
            });
        });

        it('should return not_authorized if the user ID doesnt match the session', async () => {
            const result = await controller.fulfillCheckoutSession({
                userId: 'different',
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to accept fulfillment of this checkout session.',
            });
        });

        it('should return invalid_request if the session has expired', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'expired',
                paymentStatus: 'unpaid',
                paid: false,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The checkout session has expired.',
            });
        });

        it('should return invalid_request if the session is still open', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'open',
                paymentStatus: 'paid',
                paid: false,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The checkout session has not been completed.',
            });
        });

        it('should return invalid_request if the session is complete but not paid', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'unpaid',
                paid: false,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The checkout session has not been paid for.',
            });
        });

        it('should return success if the session has already been fulfilled', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'paid',
                paid: true,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: 199,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([]);
            expect(store.purchasedItems).toEqual([]);
        });

        it('should grant the purchased items if personally accepting fulfillment', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'paid',
                paid: true,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            nowMock.mockReturnValue(200);

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: true,
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([
                {
                    role: 'myRole',
                    expireTimeMs: null,
                },
            ]);

            expect(store.purchasedItems).toEqual([
                {
                    id: expect.any(String),
                    recordName: 'studioId',
                    userId: userId,
                    purchasableItemAddress: 'item1',
                    checkoutSessionId: 'session1',
                    roleName: 'myRole',
                    roleGrantTimeMs: null,
                    activatedTimeMs: 200,
                    activationKeyId: null,
                },
            ]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: 200,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                    transfersPending: false,
                },
            ]);
        });

        describe('contract', () => {
            beforeEach(async () => {
                await contractStore.createItem('studioId', {
                    id: 'contractId',
                    address: 'item1',
                    holdingUserId: userId,
                    issuingUserId: userId,
                    initialValue: 100,
                    rate: 1,
                    issuedAtMs: 100,
                    markers: [PUBLIC_READ_MARKER],
                    status: 'pending',
                });
            });

            it('should open the contract and complete the pending transfers', async () => {
                const contractAccount = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        contractId: 'contractId',
                        ledger: LEDGERS.usd,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                transferId: '10',
                                amount: 100,
                                code: TransferCodes.contract_payment,
                                debitAccountId: ACCOUNT_IDS.assets_stripe,
                                creditAccountId: contractAccount!.id,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                            {
                                transferId: '11',
                                amount: 10,
                                code: TransferCodes.contract_payment,
                                debitAccountId: ACCOUNT_IDS.assets_stripe,
                                creditAccountId:
                                    ACCOUNT_IDS.revenue_xp_platform_fees,
                                currency: CurrencyCodes.usd,
                                pending: true,
                            },
                        ],
                        transactionId: '9',
                    })
                );

                await store.updateCheckoutSessionInfo({
                    id: 'session1',
                    status: 'complete',
                    paymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoice: null,
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'contract',
                            recordName: 'studioId',
                            contractAddress: 'item1',
                            contractId: 'contractId',
                            value: 100,
                        },
                    ],
                    transferIds: ['10', '11'],
                    transfersPending: true,
                    transactionId: '9',
                });

                nowMock.mockReturnValue(200);

                const result = await controller.fulfillCheckoutSession({
                    userId: userId,
                    sessionId: 'session1',
                    activation: 'now',
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(store.checkoutSessions).toEqual([
                    {
                        id: 'session1',
                        stripeStatus: 'complete',
                        stripePaymentStatus: 'paid',
                        paid: true,
                        stripeCheckoutSessionId: 'checkout1',
                        userId: userId,
                        invoiceId: expect.any(String),
                        fulfilledAtMs: 200,
                        items: [
                            {
                                type: 'contract',
                                recordName: 'studioId',
                                contractAddress: 'item1',
                                contractId: 'contractId',
                                value: 100,
                            },
                        ],
                        transferIds: ['10', '11'],
                        transfersPending: false,
                        transactionId: '9',
                    },
                ]);

                const contract = await contractStore.getItemByAddress(
                    'studioId',
                    'item1'
                );
                expect(contract).toEqual({
                    id: 'contractId',
                    address: 'item1',
                    holdingUserId: userId,
                    issuingUserId: userId,
                    initialValue: 100,
                    rate: 1,
                    issuedAtMs: 100,
                    markers: [PUBLIC_READ_MARKER],
                    status: 'open',
                });

                // Check that the pending transfers have been posted
                checkTransfers(
                    await financialInterface.lookupTransfers([
                        10n,
                        11n,
                        2n,
                        3n,
                    ]),
                    [
                        {
                            id: 10n,
                            amount: 100n,
                            code: TransferCodes.contract_payment,
                            credit_account_id: contractAccount!.id,
                            debit_account_id: ACCOUNT_IDS.assets_stripe,
                            flags: TransferFlags.linked | TransferFlags.pending,
                            ledger: LEDGERS.usd,
                            user_data_128: 9n,
                        },
                        {
                            id: 11n,
                            amount: 10n,
                            code: TransferCodes.contract_payment,
                            credit_account_id:
                                ACCOUNT_IDS.revenue_xp_platform_fees,
                            debit_account_id: ACCOUNT_IDS.assets_stripe,
                            flags: TransferFlags.pending,
                            ledger: LEDGERS.usd,
                            user_data_128: 9n,
                        },
                        {
                            id: 2n,
                            pending_id: 10n,
                            flags:
                                TransferFlags.linked |
                                TransferFlags.post_pending_transfer,
                            user_data_128: 9n,
                        },
                        {
                            id: 3n,
                            pending_id: 11n,
                            flags: TransferFlags.post_pending_transfer,
                            user_data_128: 9n,
                        },
                    ]
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.assets_stripe,
                        credits_posted: 0n,
                        debits_posted: 110n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: ACCOUNT_IDS.revenue_xp_platform_fees,
                        credits_posted: 10n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: contractAccount!.id,
                        credits_posted: 100n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);
            });
        });

        it('should return invalid_request if trying to personally accept fulfillment as a guest', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'paid',
                paid: true,
                stripeCheckoutSessionId: 'checkout1',
                userId: null,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            nowMock.mockReturnValue(200);

            const result = await controller.fulfillCheckoutSession({
                userId: null,
                sessionId: 'session1',
                activation: 'now',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage:
                    'Guests cannot accept immediate fulfillment of a checkout session.',
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([]);

            expect(store.purchasedItems).toEqual([]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: null,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: null,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                },
            ]);
        });

        it('should return an access key if not personally accepting fulfillment', async () => {
            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'paid',
                paid: true,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: null,
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
                transfersPending: false,
            });

            nowMock.mockReturnValue(200);

            const result = await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'later',
            });

            expect(result).toEqual({
                success: true,
                activationKey: expect.any(String),
                activationUrl: expect.stringMatching(
                    /^https:\/\/return-url\/store\/activate\?key=/
                ),
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([]);

            expect(store.purchasedItems).toEqual([
                {
                    id: expect.any(String),
                    recordName: 'studioId',
                    userId: null,
                    purchasableItemAddress: 'item1',
                    checkoutSessionId: 'session1',
                    roleName: 'myRole',
                    roleGrantTimeMs: null,
                    activatedTimeMs: null,
                    activationKeyId: expect.any(String),
                },
            ]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: 200,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                    transfersPending: false,
                },
            ]);
        });
    });

    describe('claimActivationKey()', () => {
        let activationKey: string;

        beforeEach(async () => {
            store.subscriptionConfiguration = merge(
                createTestSubConfiguration(),
                {
                    subscriptions: [
                        {
                            id: 'sub1',
                            eligibleProducts: [],
                            product: '',
                            featureList: [],
                            tier: 'tier1',
                        },
                    ],
                    tiers: {
                        tier1: {
                            features: merge(allowAllFeatures(), {
                                store: {
                                    allowed: true,
                                    currencyLimits: {
                                        usd: {
                                            maxCost: 10000,
                                            minCost: 10,
                                            fee: {
                                                type: 'fixed',
                                                amount: 10,
                                            },
                                        },
                                    },
                                },
                            } as Partial<FeaturesConfiguration>),
                        },
                    },
                } as Partial<SubscriptionConfiguration>
            );

            nowMock.mockReturnValue(101);

            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                subscriptionPeriodStartMs: 100,
                subscriptionPeriodEndMs: 1000,
                stripeAccountId: 'accountId',
                stripeAccountStatus: 'active',
                stripeAccountRequirementsStatus: 'complete',
            });

            await store.addRecord({
                name: 'studioId',
                studioId: 'studioId',
                ownerId: null,
                secretHashes: [],
                secretSalt: 'secret',
            });

            await purchasableItemsStore.putItem('studioId', {
                address: 'item1',
                name: 'Item 1',
                description: 'Description 1',
                imageUrls: [],
                currency: 'usd',
                cost: 100,
                roleName: 'myRole',
                taxCode: null,
                roleGrantTimeMs: null,
                markers: [PUBLIC_READ_MARKER],
            });

            await store.updateCheckoutSessionInfo({
                id: 'session1',
                status: 'complete',
                paymentStatus: 'paid',
                paid: true,
                stripeCheckoutSessionId: 'checkout1',
                userId: userId,
                invoice: {
                    currency: 'usd',
                    paid: false,
                    status: 'open',
                    description: 'description',
                    stripeInvoiceId: 'invoice1',
                    tax: 0,
                    subtotal: 100,
                    total: 100,
                    stripeHostedInvoiceUrl: 'hosted-url',
                    stripeInvoicePdfUrl: 'pdf-url',
                },
                fulfilledAtMs: null,
                items: [
                    {
                        type: 'role',
                        recordName: 'studioId',
                        purchasableItemAddress: 'item1',
                        role: 'myRole',
                        roleGrantTimeMs: null,
                    },
                ],
            });

            nowMock.mockReturnValue(200);

            const result = (await controller.fulfillCheckoutSession({
                userId: userId,
                sessionId: 'session1',
                activation: 'later',
            })) as FulfillCheckoutSessionSuccess;

            expect(result).toEqual({
                success: true,
                activationKey: expect.any(String),
                activationUrl: expect.any(String),
            });

            activationKey = result.activationKey;

            nowMock.mockReturnValue(300);
        });

        it('should grant the purchased items to the user if the activation key is valid', async () => {
            const result = await controller.claimActivationKey({
                userId,
                activationKey,
                target: 'self',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId,
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([
                {
                    role: 'myRole',
                    expireTimeMs: null,
                },
            ]);
            expect(store.purchasedItems).toEqual([
                {
                    id: expect.any(String),
                    recordName: 'studioId',
                    userId: userId,
                    purchasableItemAddress: 'item1',
                    checkoutSessionId: 'session1',
                    roleName: 'myRole',
                    roleGrantTimeMs: null,
                    activatedTimeMs: 300,
                    activationKeyId: expect.any(String),
                },
            ]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: 200,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                    transfersPending: false,
                },
            ]);
        });

        it('should create a new user account when the target is a guest', async () => {
            const result = (await controller.claimActivationKey({
                userId,
                activationKey,
                target: 'guest',
                ipAddress: '127.0.0.1',
            })) as ClaimActivationKeySuccess;

            expect(result).toEqual({
                success: true,
                userId: expect.any(String),
                sessionKey: expect.any(String),
                connectionKey: expect.any(String),
                expireTimeMs: null,
            });

            const roles = await store.listRolesForUser(
                'studioId',
                result.userId
            );

            expect(roles).toEqual([
                {
                    role: 'myRole',
                    expireTimeMs: null,
                },
            ]);
            expect(store.purchasedItems).toEqual([
                {
                    id: expect.any(String),
                    recordName: 'studioId',
                    userId: result.userId,
                    purchasableItemAddress: 'item1',
                    checkoutSessionId: 'session1',
                    roleName: 'myRole',
                    roleGrantTimeMs: null,
                    activatedTimeMs: 300,
                    activationKeyId: expect.any(String),
                },
            ]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: 200,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                    transfersPending: false,
                },
            ]);

            const validation = await auth.validateSessionKey(result.sessionKey);
            expect(validation).toMatchObject({
                success: true,
                userId: result.userId,
                sessionId: expect.any(String),
            });

            const token = generateV1ConnectionToken(
                result.connectionKey,
                'connectionId',
                'recordName',
                'inst'
            );

            const validation2 = await auth.validateConnectionToken(token);
            expect(validation2).toMatchObject({
                success: true,
                userId: result.userId,
                sessionId: expect.any(String),
                connectionId: 'connectionId',
                recordName: 'recordName',
                inst: 'inst',
            });
        });

        it('should return invalid_request if given an invalid activation key', async () => {
            const result = await controller.claimActivationKey({
                userId,
                activationKey: 'invalid',
                target: 'self',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: 'The activation key is invalid.',
            });
        });

        it('should return not_logged_in if given a null user when self activating', async () => {
            const result = await controller.claimActivationKey({
                userId: null,
                activationKey: activationKey,
                target: 'self',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'You need to be logged in to use target = self.',
            });
        });

        it('should do nothing if the items have already been activated', async () => {
            const item = store.purchasedItems[0];
            await store.savePurchasedItem({
                ...item,
                activatedTimeMs: 100,
            });

            const result = await controller.claimActivationKey({
                userId,
                activationKey,
                target: 'self',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
                userId,
            });

            const roles = await store.listRolesForUser('studioId', userId);

            expect(roles).toEqual([]);
            expect(store.purchasedItems).toEqual([
                {
                    id: expect.any(String),
                    recordName: 'studioId',
                    userId: null,
                    purchasableItemAddress: 'item1',
                    checkoutSessionId: 'session1',
                    roleName: 'myRole',
                    roleGrantTimeMs: null,
                    activatedTimeMs: 100,
                    activationKeyId: expect.any(String),
                },
            ]);
            expect(store.checkoutSessions).toEqual([
                {
                    id: 'session1',
                    stripeStatus: 'complete',
                    stripePaymentStatus: 'paid',
                    paid: true,
                    stripeCheckoutSessionId: 'checkout1',
                    userId: userId,
                    invoiceId: expect.any(String),
                    fulfilledAtMs: 200,
                    items: [
                        {
                            type: 'role',
                            recordName: 'studioId',
                            purchasableItemAddress: 'item1',
                            role: 'myRole',
                            roleGrantTimeMs: null,
                        },
                    ],
                    transfersPending: false,
                },
            ]);
        });
    });

    describe.only('handleStripeWebhook()', () => {
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
                        checkoutSessionId: null,
                    });
                });
            });

            describe('creditGrant', () => {
                it('should support match-price', async () => {
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

                    const userAccount = unwrap(
                        await financialController.getFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    checkAccounts(financialInterface, [
                        {
                            id: userAccount.id,
                            credits_pending: 0n,
                            credits_posted: 1000n * USD_TO_CREDITS,
                            debits_pending: 0n,
                            debits_posted: 0n,
                        },
                    ]);

                    checkTransfers(
                        await financialInterface.lookupTransfers([3n, 4n]),
                        [
                            {
                                id: 3n,
                                amount: 1000n,
                                code: TransferCodes.purchase_credits,
                                debit_account_id: ACCOUNT_IDS.assets_stripe,
                                credit_account_id: ACCOUNT_IDS.liquidity_usd,
                            },
                            {
                                id: 4n,
                                amount: 1000n * USD_TO_CREDITS,
                                code: TransferCodes.purchase_credits,
                                debit_account_id: ACCOUNT_IDS.liquidity_credits,
                                credit_account_id: userAccount.id,
                            },
                        ]
                    );
                });

                it('should support a fixed number', async () => {
                    for (let sub of store.subscriptionConfiguration
                        .subscriptions) {
                        sub.creditGrant = 500;
                    }

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

                    const userAccount = unwrap(
                        await financialController.getFinancialAccount({
                            userId: userId,
                            ledger: LEDGERS.credits,
                        })
                    );

                    checkAccounts(financialInterface, [
                        {
                            id: userAccount.id,
                            credits_pending: 0n,
                            credits_posted: 500n,
                            debits_pending: 0n,
                            debits_posted: 0n,
                        },
                    ]);

                    checkTransfers(
                        await financialInterface.lookupTransfers([3n, 4n]),
                        [
                            {
                                id: 3n,
                                amount: 1000n,
                                code: TransferCodes.purchase_credits,
                                debit_account_id: ACCOUNT_IDS.assets_stripe,
                                credit_account_id: ACCOUNT_IDS.liquidity_usd,
                            },
                            {
                                id: 4n,
                                amount: 500n,
                                code: TransferCodes.purchase_credits,
                                debit_account_id: ACCOUNT_IDS.liquidity_credits,
                                credit_account_id: userAccount.id,
                            },
                        ]
                    );
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

                describe('creditGrant', () => {
                    it('should support match-price', async () => {
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

                        const studioAccount = unwrap(
                            await financialController.getFinancialAccount({
                                studioId: studioId,
                                ledger: LEDGERS.credits,
                            })
                        );

                        checkAccounts(financialInterface, [
                            {
                                id: studioAccount.id,
                                credits_pending: 0n,
                                credits_posted: 1000n * USD_TO_CREDITS,
                                debits_pending: 0n,
                                debits_posted: 0n,
                            },
                        ]);

                        checkTransfers(
                            await financialInterface.lookupTransfers([3n, 4n]),
                            [
                                {
                                    id: 3n,
                                    amount: 1000n,
                                    code: TransferCodes.purchase_credits,
                                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                                    credit_account_id:
                                        ACCOUNT_IDS.liquidity_usd,
                                },
                                {
                                    id: 4n,
                                    amount: 1000n * USD_TO_CREDITS,
                                    code: TransferCodes.purchase_credits,
                                    debit_account_id:
                                        ACCOUNT_IDS.liquidity_credits,
                                    credit_account_id: studioAccount.id,
                                },
                            ]
                        );
                    });

                    it('should support a fixed number', async () => {
                        for (let sub of store.subscriptionConfiguration
                            .subscriptions) {
                            sub.creditGrant = 500;
                        }

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

                        const studioAccount = unwrap(
                            await financialController.getFinancialAccount({
                                studioId: studioId,
                                ledger: LEDGERS.credits,
                            })
                        );

                        checkAccounts(financialInterface, [
                            {
                                id: studioAccount.id,
                                credits_pending: 0n,
                                credits_posted: 500n,
                                debits_pending: 0n,
                                debits_posted: 0n,
                            },
                        ]);

                        checkTransfers(
                            await financialInterface.lookupTransfers([3n, 4n]),
                            [
                                {
                                    id: 3n,
                                    amount: 1000n,
                                    code: TransferCodes.purchase_credits,
                                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                                    credit_account_id:
                                        ACCOUNT_IDS.liquidity_usd,
                                },
                                {
                                    id: 4n,
                                    amount: 500n,
                                    code: TransferCodes.purchase_credits,
                                    debit_account_id:
                                        ACCOUNT_IDS.liquidity_credits,
                                    credit_account_id: studioAccount.id,
                                },
                            ]
                        );
                    });
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

        describe('store', () => {
            let studio: Studio;
            let studioId: string;

            beforeEach(async () => {
                store.subscriptionConfiguration = merge(
                    createTestSubConfiguration(),
                    {
                        subscriptions: [
                            {
                                id: 'sub1',
                                eligibleProducts: [],
                                product: '',
                                featureList: [],
                                tier: 'tier1',
                            },
                        ],
                        tiers: {
                            tier1: {
                                features: merge(allowAllFeatures(), {
                                    store: {
                                        allowed: true,
                                        currencyLimits: {
                                            usd: {
                                                maxCost: 10000,
                                                minCost: 10,
                                            },
                                        },
                                    },
                                } as Partial<FeaturesConfiguration>),
                            },
                        },
                    } as Partial<SubscriptionConfiguration>
                );

                studioId = 'studioId';
                studio = {
                    id: studioId,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                    subscriptionPeriodStartMs: 100,
                    subscriptionPeriodEndMs: 1000,
                    displayName: 'my studio',
                    stripeCustomerId: 'customer_id',
                    stripeAccountId: 'account_id',
                    stripeAccountRequirementsStatus: null,
                    stripeAccountStatus: null,
                };

                await store.addStudio(studio);
                await store.addStudioAssignment({
                    userId,
                    studioId,
                    isPrimaryContact: true,
                    role: 'admin',
                });

                nowMock.mockReturnValue(200);
            });

            describe('account.updated', () => {
                it('should update account statuses', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'account.updated',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'account_id',
                                object: 'account',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    stripeMock.getAccountById.mockResolvedValueOnce({
                        id: 'account_id',
                        charges_enabled: true,
                        requirements: {
                            currently_due: [],
                            current_deadline: null,
                            disabled_reason: null,
                            errors: [],
                            eventually_due: [],
                            past_due: [],
                            pending_verification: [],
                        },
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    const studio = await store.getStudioById(studioId);
                    expect(studio?.stripeAccountStatus).toBe('active');
                    expect(studio?.stripeAccountRequirementsStatus).toBe(
                        'complete'
                    );
                });

                it('should do nothing if no studio matches the account', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'account.updated',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'missing',
                                object: 'account',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    stripeMock.getAccountById.mockResolvedValueOnce({
                        id: 'account_id',
                        charges_enabled: true,
                        requirements: {
                            currently_due: [],
                            current_deadline: null,
                            disabled_reason: null,
                            errors: [],
                            eventually_due: [],
                            past_due: [],
                            pending_verification: [],
                        },
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    const studio = await store.getStudioById(studioId);
                    expect(studio?.stripeAccountStatus).toBe(null);
                    expect(studio?.stripeAccountRequirementsStatus).toBe(null);
                });
            });

            describe('checkout.session.completed', () => {
                it('should update checkout session status', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.completed',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'paid',
                                status: 'complete',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'role',
                                recordName: 'studioId',
                                purchasableItemAddress: 'item1',
                                role: 'myRole',
                                roleGrantTimeMs: null,
                            },
                        ],
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: true,
                            stripeStatus: 'complete',
                            stripePaymentStatus: 'paid',
                            invoiceId: null,
                            fulfilledAtMs: null,
                            items: [
                                {
                                    type: 'role',
                                    recordName: 'studioId',
                                    purchasableItemAddress: 'item1',
                                    role: 'myRole',
                                    roleGrantTimeMs: null,
                                },
                            ],
                        },
                    ]);
                });
            });

            describe('checkout.session.expired', () => {
                it('should update checkout session status', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.expired',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'unpaid',
                                status: 'expired',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'role',
                                recordName: 'studioId',
                                purchasableItemAddress: 'item1',
                                role: 'myRole',
                                roleGrantTimeMs: null,
                            },
                        ],
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: false,
                            stripeStatus: 'expired',
                            stripePaymentStatus: 'unpaid',
                            invoiceId: null,
                            fulfilledAtMs: null,
                            items: [
                                {
                                    type: 'role',
                                    recordName: 'studioId',
                                    purchasableItemAddress: 'item1',
                                    role: 'myRole',
                                    roleGrantTimeMs: null,
                                },
                            ],
                        },
                    ]);
                });
            });

            describe('invoice.paid', () => {
                it('should update the invoice attached to a checkout session', async () => {
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
                                total: 100,
                                subtotal: 100,
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
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: {
                            stripeInvoiceId: 'invoiceId',
                            currency: 'usd',
                            description: 'description',
                            status: 'open',
                            paid: false,
                            tax: 0,
                            subtotal: 100,
                            total: 100,
                            stripeHostedInvoiceUrl: 'invoiceUrl',
                            stripeInvoicePdfUrl: 'pdfUrl',
                        },
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'role',
                                recordName: 'studioId',
                                purchasableItemAddress: 'item1',
                                role: 'myRole',
                                roleGrantTimeMs: null,
                            },
                        ],
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(
                        await store.getInvoiceByStripeId('invoiceId')
                    ).toEqual({
                        id: expect.any(String),
                        stripeInvoiceId: 'invoiceId',
                        currency: 'usd',
                        description: 'description',
                        status: 'paid',
                        paid: true,
                        tax: 0,
                        subtotal: 100,
                        total: 100,
                        stripeHostedInvoiceUrl: 'invoiceUrl',
                        stripeInvoicePdfUrl: 'pdfUrl',
                        subscriptionId: null,
                        checkoutSessionId: 'uuid',
                        periodId: null,
                    });
                });
            });
        });

        describe('xp', () => {
            let user: AuthUser;
            const recordName = 'recordName';

            beforeEach(async () => {
                store.subscriptionConfiguration = createTestSubConfiguration();

                const userAccount = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        userId: userId,
                        ledger: LEDGERS.usd,
                    })
                );
                user = await store.findUser(userId);

                user = {
                    ...user,
                    stripeAccountId: 'account_id',
                    stripeAccountRequirementsStatus: null,
                    stripeAccountStatus: null,
                };

                await store.saveUser(user);

                await store.addRecord({
                    name: recordName,
                    ownerId: userId,
                    secretHashes: [],
                    secretSalt: '',
                    studioId: null,
                });

                nowMock.mockReturnValue(200);
            });

            describe('account.updated', () => {
                it('should update account statuses', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'account.updated',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'account_id',
                                object: 'account',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    stripeMock.getAccountById.mockResolvedValueOnce({
                        id: 'account_id',
                        charges_enabled: true,
                        requirements: {
                            currently_due: [],
                            current_deadline: null,
                            disabled_reason: null,
                            errors: [],
                            eventually_due: [],
                            past_due: [],
                            pending_verification: [],
                        },
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    const studio = await store.findUser(userId);
                    expect(studio?.stripeAccountStatus).toBe('active');
                    expect(studio?.stripeAccountRequirementsStatus).toBe(
                        'complete'
                    );
                });

                it('should do nothing if no user matches the account', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'account.updated',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'missing',
                                object: 'account',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    stripeMock.getAccountById.mockResolvedValueOnce({
                        id: 'account_id',
                        charges_enabled: true,
                        requirements: {
                            currently_due: [],
                            current_deadline: null,
                            disabled_reason: null,
                            errors: [],
                            eventually_due: [],
                            past_due: [],
                            pending_verification: [],
                        },
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    const studio = await store.findUser(userId);
                    expect(studio?.stripeAccountStatus).toBe(null);
                    expect(studio?.stripeAccountRequirementsStatus).toBe(null);
                });
            });

            describe('checkout.session.completed', () => {
                it('should update checkout session status', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.completed',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'paid',
                                status: 'complete',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await contractStore.createItem(recordName, {
                        id: 'contractId',
                        address: 'item1',
                        holdingUserId: userId,
                        issuingUserId: userId,
                        initialValue: 100,
                        rate: 1,
                        issuedAtMs: 100,
                        markers: [PUBLIC_READ_MARKER],
                        status: 'pending',
                    });

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'contract',
                                contractId: 'contractId',
                                recordName: 'studioId',
                                contractAddress: 'item1',
                                value: 100,
                            },
                        ],
                        shouldBeAutomaticallyFulfilled: true,
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: true,
                            stripeStatus: 'complete',
                            stripePaymentStatus: 'paid',
                            invoiceId: null,
                            fulfilledAtMs: 200,
                            items: [
                                {
                                    type: 'contract',
                                    contractId: 'contractId',
                                    recordName: 'studioId',
                                    contractAddress: 'item1',
                                    value: 100,
                                },
                            ],
                            shouldBeAutomaticallyFulfilled: true,
                            transfersPending: false,
                        },
                    ]);
                });

                it('should automatically fulfill the checkout session if paid', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.completed',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'paid',
                                status: 'complete',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await contractStore.createItem(recordName, {
                        id: 'contractId',
                        address: 'item1',
                        holdingUserId: userId,
                        issuingUserId: userId,
                        initialValue: 100,
                        rate: 1,
                        issuedAtMs: 100,
                        markers: [PUBLIC_READ_MARKER],
                        status: 'pending',
                    });

                    const contractAccount = unwrap(
                        await financialController.getOrCreateFinancialAccount({
                            contractId: 'contractId',
                            ledger: LEDGERS.usd,
                        })
                    );

                    unwrap(
                        await financialController.internalTransaction({
                            transfers: [
                                {
                                    transferId: '10',
                                    amount: 100,
                                    code: TransferCodes.contract_payment,
                                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                                    creditAccountId: contractAccount!.id,
                                    currency: CurrencyCodes.usd,
                                    pending: true,
                                },
                                {
                                    transferId: '11',
                                    amount: 10,
                                    code: TransferCodes.xp_platform_fee,
                                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                                    creditAccountId:
                                        ACCOUNT_IDS.revenue_xp_platform_fees,
                                    currency: CurrencyCodes.usd,
                                    pending: true,
                                },
                            ],
                        })
                    );

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'contract',
                                contractId: 'contractId',
                                recordName: recordName,
                                contractAddress: 'item1',
                                value: 100,
                            },
                        ],
                        transferIds: ['10', '11'],
                        transfersPending: true,
                        transactionId: '9',
                        shouldBeAutomaticallyFulfilled: true,
                    });

                    nowMock.mockReturnValue(333);

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: true,
                            stripeStatus: 'complete',
                            stripePaymentStatus: 'paid',
                            invoiceId: null,
                            fulfilledAtMs: 333,
                            items: [
                                {
                                    type: 'contract',
                                    contractId: 'contractId',
                                    recordName: recordName,
                                    contractAddress: 'item1',
                                    value: 100,
                                },
                            ],
                            transferIds: ['10', '11'],
                            transfersPending: false,
                            transactionId: '9',
                            shouldBeAutomaticallyFulfilled: true,
                        },
                    ]);

                    const contract = await contractStore.getItemByAddress(
                        recordName,
                        'item1'
                    );
                    expect(contract).toMatchObject({
                        status: 'open',
                    });

                    checkTransfers(
                        await financialInterface.lookupTransfers([
                            10n,
                            11n,
                            4n,
                            5n,
                        ]),
                        [
                            {
                                id: 10n,
                                amount: 100n,
                                code: TransferCodes.contract_payment,
                                credit_account_id: contractAccount!.id,
                                debit_account_id: ACCOUNT_IDS.assets_stripe,
                                // Should no longer be pending
                                flags:
                                    TransferFlags.linked |
                                    TransferFlags.pending,
                                ledger: LEDGERS.usd,
                            },
                            {
                                id: 11n,
                                amount: 10n,
                                code: TransferCodes.xp_platform_fee,
                                credit_account_id:
                                    ACCOUNT_IDS.revenue_xp_platform_fees,
                                debit_account_id: ACCOUNT_IDS.assets_stripe,
                                flags: TransferFlags.pending,
                                ledger: LEDGERS.usd,
                            },
                            {
                                id: 4n,
                                pending_id: 10n,
                                flags:
                                    TransferFlags.linked |
                                    TransferFlags.post_pending_transfer,
                                user_data_128: 9n,
                            },
                            {
                                id: 5n,
                                pending_id: 11n,
                                flags: TransferFlags.post_pending_transfer,
                                user_data_128: 9n,
                            },
                        ]
                    );

                    await checkAccounts(financialInterface, [
                        {
                            id: ACCOUNT_IDS.assets_stripe,
                            credits_posted: 0n,
                            debits_posted: 110n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: ACCOUNT_IDS.revenue_xp_platform_fees,
                            credits_posted: 10n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                        {
                            id: contractAccount!.id,
                            credits_posted: 100n,
                            debits_posted: 0n,
                            credits_pending: 0n,
                            debits_pending: 0n,
                        },
                    ]);
                });
            });

            describe('checkout.session.expired', () => {
                it('should update checkout session status', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.expired',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'unpaid',
                                status: 'expired',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await contractStore.createItem(recordName, {
                        id: 'contractId',
                        address: 'item1',
                        holdingUserId: userId,
                        issuingUserId: userId,
                        initialValue: 100,
                        rate: 1,
                        issuedAtMs: 100,
                        markers: [PUBLIC_READ_MARKER],
                        status: 'pending',
                    });

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'contract',
                                contractId: 'contractId',
                                recordName: 'studioId',
                                contractAddress: 'item1',
                                value: 100,
                            },
                        ],
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: false,
                            stripeStatus: 'expired',
                            stripePaymentStatus: 'unpaid',
                            invoiceId: null,
                            fulfilledAtMs: null,
                            items: [
                                {
                                    type: 'contract',
                                    contractId: 'contractId',
                                    recordName: 'studioId',
                                    contractAddress: 'item1',
                                    value: 100,
                                },
                            ],
                        },
                    ]);
                });

                it('should void any pending transfers', async () => {
                    stripeMock.constructWebhookEvent.mockReturnValueOnce({
                        id: 'event_id',
                        type: 'checkout.session.expired',
                        object: 'event',
                        account: 'account_id',
                        api_version: 'api_version',
                        created: 123,
                        data: {
                            object: {
                                id: 'checkout_id',
                                object: 'checkout.session',
                                client_reference_id: 'uuid',
                                payment_status: 'unpaid',
                                status: 'expired',
                            },
                        },
                        livemode: true,
                        pending_webhooks: 1,
                        request: {},
                    });

                    await contractStore.createItem(recordName, {
                        id: 'contractId',
                        address: 'item1',
                        holdingUserId: userId,
                        issuingUserId: userId,
                        initialValue: 100,
                        rate: 1,
                        issuedAtMs: 100,
                        markers: [PUBLIC_READ_MARKER],
                        status: 'pending',
                    });

                    unwrap(
                        await financialController.internalTransaction({
                            transfers: [
                                {
                                    transferId: '10',
                                    amount: 100,
                                    currency: CurrencyCodes.usd,
                                    code: TransferCodes.contract_payment,
                                    creditAccountId:
                                        ACCOUNT_IDS.revenue_xp_platform_fees,
                                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                                    pending: true,
                                },
                                {
                                    transferId: '11',
                                    amount: 999,
                                    currency: CurrencyCodes.usd,
                                    code: TransferCodes.contract_payment,
                                    creditAccountId:
                                        ACCOUNT_IDS.revenue_xp_platform_fees,
                                    debitAccountId: ACCOUNT_IDS.assets_stripe,
                                    pending: true,
                                },
                            ],
                            transactionId: '9',
                        })
                    );

                    await store.updateCheckoutSessionInfo({
                        id: 'uuid',
                        userId: userId,
                        stripeCheckoutSessionId: 'checkout_id',
                        paid: false,
                        status: 'open',
                        paymentStatus: 'unpaid',
                        invoice: null,
                        fulfilledAtMs: null,
                        items: [
                            {
                                type: 'contract',
                                contractId: 'contractId',
                                recordName: 'studioId',
                                contractAddress: 'item1',
                                value: 100,
                            },
                        ],
                        transferIds: ['10', '11'],
                        transfersPending: true,
                        transactionId: '9',
                    });

                    const result = await controller.handleStripeWebhook({
                        requestBody: 'request_body',
                        signature: 'request_signature',
                    });

                    expect(result).toEqual({
                        success: true,
                    });

                    expect(store.checkoutSessions).toEqual([
                        {
                            id: 'uuid',
                            userId,
                            stripeCheckoutSessionId: 'checkout_id',
                            paid: false,
                            stripeStatus: 'expired',
                            stripePaymentStatus: 'unpaid',
                            invoiceId: null,
                            fulfilledAtMs: null,
                            items: [
                                {
                                    type: 'contract',
                                    contractId: 'contractId',
                                    recordName: 'studioId',
                                    contractAddress: 'item1',
                                    value: 100,
                                },
                            ],
                            transferIds: ['10', '11'],
                            transfersPending: false,
                            transactionId: '9',
                        },
                    ]);

                    checkTransfers(
                        await financialInterface.lookupTransfers([
                            10n,
                            11n,
                            2n,
                            3n,
                        ]),
                        [
                            {
                                id: 10n,
                                amount: 100n,
                            },
                            {
                                id: 11n,
                                amount: 999n,
                            },
                            {
                                id: 2n,
                                flags:
                                    TransferFlags.linked |
                                    TransferFlags.void_pending_transfer,
                                pending_id: 10n,
                            },
                            {
                                id: 3n,
                                flags: TransferFlags.void_pending_transfer,
                                pending_id: 11n,
                            },
                        ]
                    );
                });
            });

            // describe('invoice.paid', () => {
            //     it('should update the invoice attached to a checkout session', async () => {
            //         stripeMock.constructWebhookEvent.mockReturnValueOnce({
            //             id: 'event_id',
            //             type: 'invoice.paid',
            //             object: 'event',
            //             account: 'account_id',
            //             api_version: 'api_version',
            //             created: 123,
            //             data: {
            //                 object: {
            //                     id: 'invoiceId',
            //                     customer: 'customer_id',
            //                     currency: 'usd',
            //                     total: 100,
            //                     subtotal: 100,
            //                     tax: 0,
            //                     description: 'description',
            //                     status: 'paid',
            //                     paid: true,
            //                     hosted_invoice_url: 'invoiceUrl',
            //                     invoice_pdf: 'pdfUrl',
            //                     lines: {
            //                         object: 'list',
            //                         data: [
            //                             {
            //                                 id: 'line_item_1_id',
            //                                 price: {
            //                                     id: 'price_1',
            //                                     product: 'product_1_id',
            //                                 },
            //                             },
            //                         ],
            //                     },
            //                 },
            //             },
            //             livemode: true,
            //             pending_webhooks: 1,
            //             request: {},
            //         });

            //         await store.updateCheckoutSessionInfo({
            //             id: 'uuid',
            //             userId: userId,
            //             stripeCheckoutSessionId: 'checkout_id',
            //             paid: false,
            //             status: 'open',
            //             paymentStatus: 'unpaid',
            //             invoice: {
            //                 stripeInvoiceId: 'invoiceId',
            //                 currency: 'usd',
            //                 description: 'description',
            //                 status: 'open',
            //                 paid: false,
            //                 tax: 0,
            //                 subtotal: 100,
            //                 total: 100,
            //                 stripeHostedInvoiceUrl: 'invoiceUrl',
            //                 stripeInvoicePdfUrl: 'pdfUrl',
            //             },
            //             fulfilledAtMs: null,
            //             items: [
            //                 {
            //                     type: 'role',
            //                     recordName: 'studioId',
            //                     purchasableItemAddress: 'item1',
            //                     role: 'myRole',
            //                     roleGrantTimeMs: null,
            //                 },
            //             ],
            //         });

            //         const result = await controller.handleStripeWebhook({
            //             requestBody: 'request_body',
            //             signature: 'request_signature',
            //         });

            //         expect(result).toEqual({
            //             success: true,
            //         });

            //         expect(
            //             await store.getInvoiceByStripeId('invoiceId')
            //         ).toEqual({
            //             id: expect.any(String),
            //             stripeInvoiceId: 'invoiceId',
            //             currency: 'usd',
            //             description: 'description',
            //             status: 'paid',
            //             paid: true,
            //             tax: 0,
            //             subtotal: 100,
            //             total: 100,
            //             stripeHostedInvoiceUrl: 'invoiceUrl',
            //             stripeInvoicePdfUrl: 'pdfUrl',
            //             subscriptionId: null,
            //             checkoutSessionId: 'uuid',
            //             periodId: null,
            //         });
            //     });
            // });
        });
    });
});

describe('getAccountStatus()', () => {
    const disabledReasonCases: [string, StripeAccountStatus][] = [
        ['action_required.requested_capabilities', 'disabled'],
        ['requirements.past_due', 'disabled'],
        ['requirements.pending_verification', 'pending'],
        ['listed', 'disabled'],
        ['platform_paused', 'disabled'],
        ['rejected.fraud', 'rejected'],
        ['rejected.incomplete_verification', 'rejected'],
        ['rejected.listed', 'rejected'],
        ['rejected.other', 'rejected'],
        ['rejected.terms_of_service', 'rejected'],
        ['under_review', 'pending'],
        ['other', 'disabled'],
    ];

    it.each(disabledReasonCases)(
        'should return %s for %s',
        (reason, expected) => {
            expect(
                getAccountStatus({
                    id: 'account_id',
                    charges_enabled: false,
                    requirements: {
                        currently_due: [],
                        current_deadline: null,
                        disabled_reason: reason,
                        errors: [],
                        eventually_due: [],
                        past_due: [],
                        pending_verification: [],
                    },
                })
            ).toBe(expected);
        }
    );

    it('should return pending if there is no disabled reason but charges are also not enabled', () => {
        expect(
            getAccountStatus({
                id: 'account_id',
                charges_enabled: false,
                requirements: {
                    currently_due: [],
                    current_deadline: null,
                    disabled_reason: null,
                    errors: [],
                    eventually_due: [],
                    past_due: [],
                    pending_verification: [],
                },
            })
        ).toBe('pending');
    });

    it('should return active if charges are enabled', () => {
        expect(
            getAccountStatus({
                id: 'account_id',
                charges_enabled: true,
                requirements: {
                    currently_due: [],
                    current_deadline: null,
                    disabled_reason: null,
                    errors: [],
                    eventually_due: [],
                    past_due: [],
                    pending_verification: [],
                },
            })
        ).toBe('active');
    });
});

describe('formatV1ActivationKey()', () => {
    it('should format an access key', () => {
        const result = formatV1ActivationKey('id', 'password');

        const [version, id, password] = result.split('.');

        expect(version).toBe('vAK1');
        expect(id).toBe(toBase64String('id'));
        expect(password).toBe(toBase64String('password'));
    });
});

describe('parseActivationKey()', () => {
    it('should be able to parse the given access key', () => {
        const result = formatV1ActivationKey('id', 'password');
        const parsed = parseActivationKey(result);
        expect(parsed).toEqual(['id', 'password']);
    });

    it('should return null if given null', () => {
        expect(parseActivationKey(null)).toBeNull();
    });

    it('should return null if given a string without a version', () => {
        expect(parseActivationKey('')).toBeNull();
    });

    it('should return null if given a string without an id', () => {
        expect(parseActivationKey('vAK1.')).toBeNull();
    });

    it('should return null if given a string without a password', () => {
        expect(parseActivationKey('vAK1.id')).toBeNull();
    });

    it('should return null if given a string with invalid base64', () => {
        expect(parseActivationKey('vAK1.id.password')).toBeNull();
    });
});
