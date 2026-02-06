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
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    success,
    unwrap,
} from '@casual-simulation/aux-common';
import type { TestServices } from '../TestUtils';
import {
    checkAccounts,
    createTestControllers,
    createTestSubConfiguration,
} from '../TestUtils';
import type { FinancialPeriodicBillingJob } from './FinancialProcessor';
import { FinancialProcessor } from './FinancialProcessor';
import {
    ACCOUNT_IDS,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
} from './FinancialInterface';
import type { Account } from 'tigerbeetle-node';

console.log = jest.fn();

describe('FinancialProcessor', () => {
    let services: TestServices;
    let processor: FinancialProcessor;

    beforeEach(async () => {
        services = createTestControllers();
        processor = new FinancialProcessor({
            financial: services.financialController,
            configStore: services.configStore,
            metricsStore: services.store,
            financialStore: services.store,
        });

        unwrap(await services.financialController.init());
    });

    describe('financial-revenue-credit-sweep', () => {
        beforeEach(async () => {
            // Seed some revenue credit balance
            unwrap(
                await services.financialController.internalTransaction({
                    transfers: [
                        {
                            // 1USD = 1,000,000 credits
                            amount: 10n,
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: ACCOUNT_IDS.liquidity_usd,
                            code: TransferCodes.admin_credit,
                            currency: 'usd',
                        },
                        {
                            // 1USD = 1,000,000 credits
                            amount: 1_150_000n, // 1,150,000 credits
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            creditAccountId:
                                ACCOUNT_IDS.revenue_records_usage_credits,
                            code: TransferCodes.admin_credit,
                            currency: 'credits',
                        },
                    ],
                })
            );
        });

        it('should sweep revenue credits to USD and credits accounts', async () => {
            const job = { type: 'financial-revenue-credit-sweep' } as const;

            const result = await processor.process(job);
            expect(result).toEqual(success());

            checkAccounts(services.financialInterface, [
                {
                    id: ACCOUNT_IDS.revenue_records_usage_credits,
                    credits_posted: 1_150_000n,
                    credits_pending: 0n,
                    debits_posted: 1_000_000n, // 1,000,000 credits converted to USD
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.liquidity_credits,
                    credits_posted: 1_000_000n,
                    credits_pending: 0n,
                    debits_posted: 1_150_000n,
                    debits_pending: 0n,
                },
                {
                    id: ACCOUNT_IDS.revenue_records_usage_usd,
                    credits_posted: 1n, // 1 USD
                    credits_pending: 0n,
                    debits_pending: 0n,
                    debits_posted: 0n,
                },
                {
                    id: ACCOUNT_IDS.liquidity_usd,
                    credits_posted: 10n,
                    credits_pending: 0n,
                    debits_posted: 1n,
                    debits_pending: 0n,
                },
            ]);
        });
    });

    describe.only('financial-periodic-billing', () => {
        const day = 24 * 60 * 60 * 1000;
        const month = 30 * day;

        describe('insts', () => {
            describe('user', () => {
                const userId = 'user1';
                let account: Account;

                beforeEach(async () => {
                    await services.store.saveUser({
                        id: userId,
                        allSessionRevokeTimeMs: null,
                        email: 'user1@example.com',
                        phoneNumber: null,
                        currentLoginRequestId: null,
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                        subscriptionPeriodStartMs: month,
                        subscriptionPeriodEndMs: month * 2,
                    });

                    await services.store.addRecord({
                        ownerId: userId,
                        name: 'myRecord',
                        secretHashes: [],
                        secretSalt: '',
                        studioId: null,
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst1',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst2',
                        markers: ['customMarker'],
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst3',
                        markers: [PRIVATE_MARKER],
                    });

                    const userAccount = unwrap(
                        await services.financialController.getOrCreateFinancialAccount(
                            {
                                userId,
                                ledger: LEDGERS.credits,
                            }
                        )
                    );
                    account = userAccount.account;

                    unwrap(
                        await services.financialController.internalTransaction({
                            transfers: [
                                {
                                    // 1USD = 1,000,000 credits
                                    amount: 1_000_000n,
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account.id,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    services.store.subscriptionConfiguration =
                        createTestSubConfiguration((config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub.withTier('tier1').withInsts({
                                    allowed: true,
                                    creditFeePerInstPerPeriod: 10_000n,
                                })
                            )
                        );
                });

                it('should charge users for the number of insts that they have at the configured rate', async () => {
                    const job: FinancialPeriodicBillingJob = {
                        type: 'financial-periodic-billing',

                        // 4th day of subscription period
                        nowMs: month + day * 4,
                    };

                    const result = await processor.process(job);
                    expect(result).toEqual(success());

                    await checkAccounts(services.financialInterface, [
                        {
                            id: account.id,
                            credits_pending: 0n,
                            credits_posted: 1_000_000n,
                            debits_pending: 0n,

                            // 1 day of billing for 3 insts at 10,000 credits per 30 days
                            debits_posted: 333n * 3n,
                        },
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 333n * 3n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    expect(services.store.billingCycleHistory).toEqual([
                        {
                            id: expect.any(String),
                            timeMs: month + day * 4,
                        },
                    ]);
                });

                it('should charge users based on the time since the last billing period', async () => {
                    await services.store.saveBillingCycleHistory({
                        id: 'history1',
                        timeMs: month + day,
                    });

                    const job: FinancialPeriodicBillingJob = {
                        type: 'financial-periodic-billing',

                        // 4th day of subscription period
                        nowMs: month + day * 4,
                    };

                    const result = await processor.process(job);
                    expect(result).toEqual(success());

                    await checkAccounts(services.financialInterface, [
                        {
                            id: account.id,
                            credits_pending: 0n,
                            credits_posted: 1_000_000n,
                            debits_pending: 0n,

                            // 3 days of billing for 3 insts at 10,000 credits per 30 days
                            debits_posted: 3000n,
                        },
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 3000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    expect(services.store.billingCycleHistory).toEqual([
                        {
                            id: 'history1',
                            timeMs: month + day,
                        },
                        {
                            id: expect.any(String),
                            timeMs: month + day * 4,
                        },
                    ]);
                });
            });

            describe('studio', () => {
                const studioId = 'studio1';
                let account: Account;

                beforeEach(async () => {
                    await services.store.addStudio({
                        id: studioId,
                        displayName: 'Studio 1',
                        subscriptionId: 'sub1',
                        subscriptionStatus: 'active',
                        subscriptionPeriodStartMs: month,
                        subscriptionPeriodEndMs: month * 2,
                    });

                    await services.store.addRecord({
                        ownerId: null,
                        studioId,
                        name: 'myRecord',
                        secretHashes: [],
                        secretSalt: '',
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst1',
                        markers: [PUBLIC_READ_MARKER],
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst2',
                        markers: ['customMarker'],
                    });

                    await services.store.saveInst({
                        recordName: 'myRecord',
                        inst: 'inst3',
                        markers: [PRIVATE_MARKER],
                    });

                    const studioAccount = unwrap(
                        await services.financialController.getOrCreateFinancialAccount(
                            {
                                studioId,
                                ledger: LEDGERS.credits,
                            }
                        )
                    );
                    account = studioAccount.account;

                    unwrap(
                        await services.financialController.internalTransaction({
                            transfers: [
                                {
                                    // 1USD = 1,000,000 credits
                                    amount: 1_000_000n,
                                    debitAccountId:
                                        ACCOUNT_IDS.liquidity_credits,
                                    creditAccountId: account.id,
                                    code: TransferCodes.admin_credit,
                                    currency: CurrencyCodes.credits,
                                },
                            ],
                        })
                    );

                    services.store.subscriptionConfiguration =
                        createTestSubConfiguration((config) =>
                            config.addSubscription('sub1', (sub) =>
                                sub.withTier('tier1').withInsts({
                                    allowed: true,
                                    creditFeePerInstPerPeriod: 10_000n,
                                })
                            )
                        );
                });

                it('should charge studios for the number of insts that they have at the configured rate', async () => {
                    const job: FinancialPeriodicBillingJob = {
                        type: 'financial-periodic-billing',

                        // 4th day of subscription period
                        nowMs: month + day * 4,
                    };

                    const result = await processor.process(job);
                    expect(result).toEqual(success());

                    await checkAccounts(services.financialInterface, [
                        {
                            id: account.id,
                            credits_pending: 0n,
                            credits_posted: 1_000_000n,
                            debits_pending: 0n,

                            // 1 day of billing for 3 insts at 10,000 credits per 30 days
                            debits_posted: 333n * 3n,
                        },
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 333n * 3n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    expect(services.store.billingCycleHistory).toEqual([
                        {
                            id: expect.any(String),
                            timeMs: month + day * 4,
                        },
                    ]);
                });

                it('should charge studios based on the time since the last billing period', async () => {
                    await services.store.saveBillingCycleHistory({
                        id: 'history1',
                        timeMs: month + day,
                    });

                    const job: FinancialPeriodicBillingJob = {
                        type: 'financial-periodic-billing',

                        // 4th day of subscription period
                        nowMs: month + day * 4,
                    };

                    const result = await processor.process(job);
                    expect(result).toEqual(success());

                    await checkAccounts(services.financialInterface, [
                        {
                            id: account.id,
                            credits_pending: 0n,
                            credits_posted: 1_000_000n,
                            debits_pending: 0n,

                            // 3 days of billing for 3 insts at 10,000 credits per 30 days
                            debits_posted: 3000n,
                        },
                        {
                            id: ACCOUNT_IDS.revenue_records_usage_credits,
                            credits_posted: 3000n,
                            credits_pending: 0n,
                            debits_posted: 0n,
                            debits_pending: 0n,
                        },
                    ]);

                    expect(services.store.billingCycleHistory).toEqual([
                        {
                            id: 'history1',
                            timeMs: month + day,
                        },
                        {
                            id: expect.any(String),
                            timeMs: month + day * 4,
                        },
                    ]);
                });
            });
        });
    });
});
