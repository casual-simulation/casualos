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
import { failure, success, unwrap } from '@casual-simulation/aux-common';
import type { AccountWithDetails } from './FinancialController';
import {
    AccountBalance,
    FinancialController,
    getAccountBalance,
    getAssetAccountBalance,
    getLiabilityAccountBalance,
} from './FinancialController';
import {
    ACCOUNT_IDS,
    AccountCodes,
    AMOUNT_MAX,
    CREDITS_DISPLAY_FACTOR,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
    USD_DISPLAY_FACTOR,
} from './FinancialInterface';
import type { Account } from 'tigerbeetle-node';
import { AccountFlags, TransferFlags } from 'tigerbeetle-node';
import { MemoryStore } from '../MemoryStore';
import {
    checkAccounts,
    checkTransfers,
    mapBigInts,
    randomBigInt,
} from '../TestUtils';
import { runTigerBeetle } from './TigerBeetleTestUtils';
import { TigerBeetleFinancialInterface } from './TigerBeetleFinancialInterface';
import type { Client } from 'tigerbeetle-node';
import { createClient } from 'tigerbeetle-node';
import type { ChildProcess } from 'child_process';

console.log = jest.fn();
console.error = jest.fn();

describe('FinancialController', () => {
    let financialInterface: TigerBeetleFinancialInterface;
    let store: MemoryStore;
    let controller: FinancialController;
    let dateNowMock: jest.Mock<number>;
    let currentId = 1n;

    const realDateNow = Date.now;

    let tbClient: Client;
    let tbProcess: ChildProcess;

    beforeAll(async () => {
        const { port, process } = await runTigerBeetle('financial-controller');

        tbProcess = process;
        if (!port) {
            throw new Error('Failed to start TigerBeetle!');
        }

        tbClient = createClient({
            replica_addresses: [port],
            cluster_id: 0n,
        });
    });

    afterAll(async () => {
        if (tbClient) {
            const client = tbClient;
            tbClient = null!;
            client.destroy();
        }
        if (tbProcess) {
            tbProcess.kill();
        }
    });

    beforeEach(async () => {
        currentId = 1n;
        dateNowMock = Date.now = jest.fn(() => 123);

        const idOffset = randomBigInt();
        financialInterface = new TigerBeetleFinancialInterface({
            client: tbClient,
            id: () => currentId++,
            idOffset: idOffset,
        });
        store = new MemoryStore({
            subscriptions: null,
        });
        controller = new FinancialController(financialInterface, store);
    });

    afterEach(() => {
        Date.now = realDateNow;
    });

    describe('init()', () => {
        it('should create all the default accounts', async () => {
            await controller.init();

            const accounts = await financialInterface.lookupAccounts([
                ACCOUNT_IDS.assets_cash,
                ACCOUNT_IDS.assets_stripe,
                ACCOUNT_IDS.revenue_xp_platform_fees,
                ACCOUNT_IDS.revenue_store_platform_fees,
                ACCOUNT_IDS.liquidity_usd,
                ACCOUNT_IDS.liquidity_credits,
                ACCOUNT_IDS.USD_SETUP,
                ACCOUNT_IDS.USD_LIMIT_CREDITS,
                ACCOUNT_IDS.USD_LIMIT_DEBITS,
                ACCOUNT_IDS.CREDITS_SETUP,
                ACCOUNT_IDS.CREDITS_LIMIT_CREDITS,
                ACCOUNT_IDS.CREDITS_LIMIT_DEBITS,
            ]);
            expect(
                mapBigInts(
                    accounts.map((a) => {
                        const { timestamp, ...account } = a;
                        return account;
                    })
                )
            ).toMatchSnapshot();
        });
    });

    describe('createAccount()', () => {
        it('should create a new account with the specified code', async () => {
            const account = await controller.createAccount(
                AccountCodes.assets_cash,
                LEDGERS.usd
            );
            expect(account).toEqual(
                success({
                    id: '1',
                })
            );

            expect(
                mapBigInts(await financialInterface.lookupAccounts([1n]))
            ).toEqual([
                {
                    id: 1,
                    debits_pending: 0,
                    debits_posted: 0,
                    credits_pending: 0,
                    credits_posted: 0,
                    user_data_128: 0,
                    user_data_64: 0,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: LEDGERS.usd,
                    flags:
                        AccountFlags.credits_must_not_exceed_debits |
                        AccountFlags.history,
                    code: AccountCodes.assets_cash,
                    timestamp: expect.any(Number),
                },
            ]);
        });

        it('should be able to create a user account', async () => {
            const account = await controller.createAccount(
                AccountCodes.liabilities_user,
                LEDGERS.credits
            );
            expect(account).toEqual(
                success({
                    id: '1',
                })
            );

            expect(
                mapBigInts(await financialInterface.lookupAccounts([1n]))
            ).toEqual([
                {
                    id: 1,
                    debits_pending: 0,
                    debits_posted: 0,
                    credits_pending: 0,
                    credits_posted: 0,
                    user_data_128: 0,
                    user_data_64: 0,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: LEDGERS.credits,
                    flags:
                        AccountFlags.debits_must_not_exceed_credits |
                        AccountFlags.history,
                    code: AccountCodes.liabilities_user,
                    timestamp: expect.any(Number),
                },
            ]);
        });
    });

    describe('getAccount()', () => {
        beforeEach(async () => {
            await controller.init();
            await controller.createAccount(
                AccountCodes.assets_cash,
                LEDGERS.usd
            );
            await controller.createAccount(
                AccountCodes.liabilities_user,
                LEDGERS.usd
            );
        });

        it('should return the account with the specified ID', async () => {
            const account = await controller.getAccount(1n);
            expect(mapBigInts(account)).toEqual(
                success({
                    id: 1,
                    debits_pending: 0,
                    debits_posted: 0,
                    credits_pending: 0,
                    credits_posted: 0,
                    user_data_128: 0,
                    user_data_64: 0,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: 1,
                    flags:
                        AccountFlags.credits_must_not_exceed_debits |
                        AccountFlags.history,
                    code: AccountCodes.assets_cash,
                    timestamp: expect.any(Number),
                })
            );
        });
    });

    describe('getOrCreateFinancialAccount()', () => {
        it('should create a financial account for the given user', async () => {
            const account = await controller.getOrCreateFinancialAccount({
                userId: 'user1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: 1,
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_user,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        userId: 'user1',
                        currency: CurrencyCodes.credits,
                        id: '1',
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: '1',
                    userId: 'user1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });

        it('should use the existing financial account for the user', async () => {
            const result = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.credits
                )
            );
            await store.createAccount({
                id: result.id,
                userId: 'user1',
                ledger: LEDGERS.credits,
                currency: 'credits',
            });

            const account = await controller.getOrCreateFinancialAccount({
                userId: 'user1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: Number(result.id),
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_user,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        userId: 'user1',
                        currency: CurrencyCodes.credits,
                        id: String(result.id),
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: result.id,
                    userId: 'user1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });

        it('should create a financial account for the given studio', async () => {
            const account = await controller.getOrCreateFinancialAccount({
                studioId: 'studio1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: 1,
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_studio,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        studioId: 'studio1',
                        currency: CurrencyCodes.credits,
                        id: '1',
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: '1',
                    studioId: 'studio1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });

        it('should use the existing financial account for the studio', async () => {
            const result = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_studio,
                    LEDGERS.credits
                )
            );
            await store.createAccount({
                id: result.id,
                studioId: 'studio1',
                ledger: LEDGERS.credits,
                currency: 'credits',
            });

            const account = await controller.getOrCreateFinancialAccount({
                studioId: 'studio1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: Number(result.id),
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_studio,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        studioId: 'studio1',
                        currency: CurrencyCodes.credits,
                        id: String(result.id),
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: result.id,
                    studioId: 'studio1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });

        it('should create a financial account for the given contract', async () => {
            const account = await controller.getOrCreateFinancialAccount({
                contractId: 'contract1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: 1,
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_contract,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        contractId: 'contract1',
                        currency: CurrencyCodes.credits,
                        id: '1',
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: '1',
                    contractId: 'contract1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });

        it('should use the existing financial account for the contract', async () => {
            const result = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_contract,
                    LEDGERS.credits
                )
            );
            await store.createAccount({
                id: result.id,
                contractId: 'contract1',
                ledger: LEDGERS.credits,
                currency: 'credits',
            });

            const account = await controller.getOrCreateFinancialAccount({
                contractId: 'contract1',
                ledger: LEDGERS.credits,
            });
            expect(mapBigInts(account)).toEqual(
                success({
                    account: {
                        id: Number(result.id),
                        debits_pending: 0,
                        debits_posted: 0,
                        credits_pending: 0,
                        credits_posted: 0,
                        user_data_128: 0,
                        user_data_64: 0,
                        user_data_32: 0,
                        reserved: 0,
                        ledger: LEDGERS.credits,
                        flags:
                            AccountFlags.debits_must_not_exceed_credits |
                            AccountFlags.history,
                        code: AccountCodes.liabilities_contract,
                        timestamp: expect.any(Number),
                    },
                    financialAccount: {
                        contractId: 'contract1',
                        currency: CurrencyCodes.credits,
                        id: String(result.id),
                        ledger: LEDGERS.credits,
                    },
                })
            );

            expect(store.financialAccounts).toEqual([
                {
                    id: result.id,
                    contractId: 'contract1',
                    ledger: LEDGERS.credits,
                    currency: 'credits',
                },
            ]);
        });
    });

    describe('getAccountBalances()', () => {
        let account1: AccountWithDetails;
        let account2: AccountWithDetails;

        beforeEach(async () => {
            await controller.init();
            account1 = unwrap(
                await controller.getOrCreateFinancialAccount({
                    userId: 'user1',
                    ledger: LEDGERS.credits,
                })
            );
            account2 = unwrap(
                await controller.getOrCreateFinancialAccount({
                    userId: 'user1',
                    ledger: LEDGERS.usd,
                })
            );
        });

        it('should return the balances for the users accounts', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: account1.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 1000,
                            currency: 'credits',
                        },
                        {
                            creditAccountId: account1.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 123,
                            currency: 'credits',
                        },
                        {
                            creditAccountId: account2.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 456,
                            currency: 'usd',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalances({
                userId: 'user1',
            });

            expect(balanceResult).toEqual(
                success({
                    credits: new AccountBalance({
                        accountId: account1.account.id.toString(),
                        credits: 1123n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    }),
                    usd: new AccountBalance({
                        accountId: account2.account.id.toString(),
                        credits: 456n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    }),
                })
            );
        });

        it('should return the balances for studio accounts', async () => {
            await controller.init();
            const studioUsdAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    studioId: 'studio1',
                    ledger: LEDGERS.usd,
                })
            );
            const studioCreditsAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    studioId: 'studio1',
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: studioUsdAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 5000,
                            currency: 'usd',
                        },
                        {
                            creditAccountId: studioCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 2000,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalances({
                studioId: 'studio1',
            });

            expect(balanceResult).toEqual(
                success({
                    usd: new AccountBalance({
                        accountId: studioUsdAccount.account.id.toString(),
                        credits: 5000n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    }),
                    credits: new AccountBalance({
                        accountId: studioCreditsAccount.account.id.toString(),
                        credits: 2000n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    }),
                })
            );
        });

        it('should return the balances for contract accounts', async () => {
            await controller.init();
            const contractUsdAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    contractId: 'contract1',
                    ledger: LEDGERS.usd,
                })
            );
            const contractCreditsAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    contractId: 'contract1',
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: contractUsdAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 1500,
                            currency: 'usd',
                        },
                        {
                            creditAccountId: contractCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 750,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalances({
                contractId: 'contract1',
            });

            expect(balanceResult).toEqual(
                success({
                    usd: new AccountBalance({
                        accountId: contractUsdAccount.account.id.toString(),
                        credits: 1500n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    }),
                    credits: new AccountBalance({
                        accountId: contractCreditsAccount.account.id.toString(),
                        credits: 750n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    }),
                })
            );
        });

        it('should return undefined when no accounts exist for the given studio', async () => {
            await controller.init();
            const balanceResult = await controller.getAccountBalances({
                studioId: 'nonexistent-studio',
            });

            expect(balanceResult).toEqual(success(undefined));
        });

        it('should return undefined when no accounts exist for the given contract', async () => {
            await controller.init();
            const balanceResult = await controller.getAccountBalances({
                contractId: 'nonexistent-contract',
            });

            expect(balanceResult).toEqual(success(undefined));
        });

        it('should return only usd balance when credits account does not exist', async () => {
            await controller.init();
            const studioUsdAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    studioId: 'studio2',
                    ledger: LEDGERS.usd,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: studioUsdAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 3000,
                            currency: 'usd',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalances({
                studioId: 'studio2',
            });

            expect(balanceResult).toEqual(
                success({
                    usd: new AccountBalance({
                        accountId: studioUsdAccount.account.id.toString(),
                        credits: 3000n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    }),
                })
            );
        });

        it('should return only credits balance when usd account does not exist', async () => {
            await controller.init();
            const contractCreditsAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    contractId: 'contract2',
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: contractCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 1000,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalances({
                contractId: 'contract2',
            });

            expect(balanceResult).toEqual(
                success({
                    credits: new AccountBalance({
                        accountId: contractCreditsAccount.account.id.toString(),
                        credits: 1000n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    }),
                })
            );
        });
    });

    describe('getAccountBalance()', () => {
        let account1: AccountWithDetails;
        let account2: AccountWithDetails;

        beforeEach(async () => {
            await controller.init();
            account1 = unwrap(
                await controller.getOrCreateFinancialAccount({
                    userId: 'user1',
                    ledger: LEDGERS.credits,
                })
            );
            account2 = unwrap(
                await controller.getOrCreateFinancialAccount({
                    userId: 'user2',
                    ledger: LEDGERS.credits,
                })
            );
        });

        it('should return the balance for the given user account', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: account1.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 1000,
                            currency: 'credits',
                        },
                        {
                            creditAccountId: account1.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 123,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalance({
                userId: 'user1',
                ledger: LEDGERS.credits,
            });

            expect(balanceResult).toEqual(
                success(
                    new AccountBalance({
                        accountId: account1.account.id.toString(),
                        credits: 1123n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    })
                )
            );
        });

        it('should return the balance for a studio account in usd', async () => {
            await controller.init();
            const studioUsdAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    studioId: 'studio1',
                    ledger: LEDGERS.usd,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: studioUsdAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 2500,
                            currency: 'usd',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalance({
                studioId: 'studio1',
                ledger: LEDGERS.usd,
            });

            expect(balanceResult).toEqual(
                success(
                    new AccountBalance({
                        accountId: studioUsdAccount.account.id.toString(),
                        credits: 2500n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    })
                )
            );
        });

        it('should return the balance for a studio account in credits', async () => {
            await controller.init();
            const studioCreditsAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    studioId: 'studio2',
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: studioCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 5000,
                            currency: 'credits',
                        },
                        {
                            creditAccountId: studioCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 500,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalance({
                studioId: 'studio2',
                ledger: LEDGERS.credits,
            });

            expect(balanceResult).toEqual(
                success(
                    new AccountBalance({
                        accountId: studioCreditsAccount.account.id.toString(),
                        credits: 5500n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    })
                )
            );
        });

        it('should return the balance for a contract account in usd', async () => {
            await controller.init();
            const contractUsdAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    contractId: 'contract1',
                    ledger: LEDGERS.usd,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: contractUsdAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            code: TransferCodes.admin_credit,
                            amount: 1000,
                            currency: 'usd',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalance({
                contractId: 'contract1',
                ledger: LEDGERS.usd,
            });

            expect(balanceResult).toEqual(
                success(
                    new AccountBalance({
                        accountId: contractUsdAccount.account.id.toString(),
                        credits: 1000n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: USD_DISPLAY_FACTOR,
                        currency: 'usd',
                    })
                )
            );
        });

        it('should return the balance for a contract account in credits', async () => {
            await controller.init();
            const contractCreditsAccount = unwrap(
                await controller.getOrCreateFinancialAccount({
                    contractId: 'contract2',
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            creditAccountId: contractCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 3000,
                            currency: 'credits',
                        },
                        {
                            creditAccountId: contractCreditsAccount.account.id,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            code: TransferCodes.admin_credit,
                            amount: 200,
                            currency: 'credits',
                        },
                    ],
                })
            );

            const balanceResult = await controller.getAccountBalance({
                contractId: 'contract2',
                ledger: LEDGERS.credits,
            });

            expect(balanceResult).toEqual(
                success(
                    new AccountBalance({
                        accountId: contractCreditsAccount.account.id.toString(),
                        credits: 3200n,
                        debits: 0n,
                        pendingCredits: 0n,
                        pendingDebits: 0n,
                        displayFactor: CREDITS_DISPLAY_FACTOR,
                        currency: 'credits',
                    })
                )
            );
        });

        it('should return undefined when studio account does not exist', async () => {
            await controller.init();
            const balanceResult = await controller.getAccountBalance({
                studioId: 'nonexistent-studio',
                ledger: LEDGERS.usd,
            });

            expect(balanceResult).toEqual(success(undefined));
        });

        it('should return undefined when contract account does not exist', async () => {
            await controller.init();
            const balanceResult = await controller.getAccountBalance({
                contractId: 'nonexistent-contract',
                ledger: LEDGERS.credits,
            });

            expect(balanceResult).toEqual(success(undefined));
        });
    });

    describe('listAccounts()', () => {
        it('should return the list of accounts for the user', async () => {
            const result = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.credits
                )
            );
            const result2 = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            );
            await store.createAccount({
                id: result.id,
                userId: 'user1',
                ledger: LEDGERS.credits,
                currency: 'credits',
            });
            await store.createAccount({
                id: result2.id,
                userId: 'user1',
                ledger: LEDGERS.usd,
                currency: 'usd',
            });

            const accounts = await controller.listAccounts({
                userId: 'user1',
            });
            expect(mapBigInts(accounts)).toEqual(
                success({
                    accounts: [
                        {
                            id: Number(result.id),
                            debits_pending: 0,
                            debits_posted: 0,
                            credits_pending: 0,
                            credits_posted: 0,
                            user_data_128: 0,
                            user_data_64: 0,
                            user_data_32: 0,
                            reserved: 0,
                            ledger: LEDGERS.credits,
                            flags:
                                AccountFlags.debits_must_not_exceed_credits |
                                AccountFlags.history,
                            code: AccountCodes.liabilities_user,
                            timestamp: expect.any(Number),
                        },
                        {
                            id: Number(result2.id),
                            debits_pending: 0,
                            debits_posted: 0,
                            credits_pending: 0,
                            credits_posted: 0,
                            user_data_128: 0,
                            user_data_64: 0,
                            user_data_32: 0,
                            reserved: 0,
                            ledger: LEDGERS.usd,
                            flags:
                                AccountFlags.debits_must_not_exceed_credits |
                                AccountFlags.history,
                            code: AccountCodes.liabilities_user,
                            timestamp: expect.any(Number),
                        },
                    ],
                })
            );
        });
    });

    describe('listTransfers()', () => {
        let account1Id: string;
        let account2Id: string;

        beforeEach(async () => {
            unwrap(await controller.init());

            ({ id: account1Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));
            ({ id: account2Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));
        });

        it('should return the list of transfers for the account', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 100n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const list = unwrap(await controller.listTransfers(account1Id));

            checkTransfers(list, [
                {
                    id: 4n,
                    amount: 100n,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    code: TransferCodes.admin_credit,
                },
            ]);
        });
    });

    describe('internalTransaction()', () => {
        let account1Id: string;
        let account2Id: string;

        beforeEach(async () => {
            unwrap(await controller.init());

            ({ id: account1Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));
            ({ id: account2Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));
        });

        it('should be able to transfer money from the assets_cash account to a user account', async () => {
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        debitAccountId: ACCOUNT_IDS.assets_stripe,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: '3',
                    transferIds: ['4'],
                })
            );
            checkTransfers(await financialInterface.lookupTransfers([4n]), [
                {
                    id: 4n,
                    amount: 100n,
                    code: TransferCodes.admin_credit,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    user_data_128: 3n,
                },
            ]);
        });

        it('should be able to transfer money from one user account to another', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const result = await controller.internalTransaction({
                transfers: [
                    {
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: '5',
                    transferIds: ['6'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([6n]), [
                {
                    id: 6n,
                    amount: 100n,
                    code: TransferCodes.admin_credit,
                    credit_account_id: BigInt(account2Id),
                    debit_account_id: BigInt(account1Id),
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    user_data_128: 5n,
                },
            ]);
        });

        it('should use the given transfer Id', async () => {
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.assets_stripe,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: '3',
                    transferIds: ['100'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([100n]), [
                {
                    id: 100n,
                    amount: 100n,
                    code: TransferCodes.admin_credit,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    user_data_128: 3n,
                },
            ]);
        });

        it('should reject the transfer if it would cause a user account to go negative', async () => {
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(mapBigInts(result)).toMatchObject(
                failure({
                    errorCode: 'debits_exceed_credits',
                    errorMessage:
                        'The transfer would cause the account debits to exceed its credits.',
                    accountId: account1Id,
                })
            );
            expect(await financialInterface.lookupTransfers([100n])).toEqual(
                []
            );
        });

        it('should be able to perform transfers in a transaction', async () => {
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.assets_stripe,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                    {
                        transferId: 101n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '3',
                    transferIds: ['100', '101'],
                })
            );

            checkTransfers(
                await financialInterface.lookupTransfers([100n, 101n]),
                [
                    {
                        id: 100n,
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                        credit_account_id: BigInt(account1Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        flags: TransferFlags.linked,
                        ledger: LEDGERS.usd,
                        user_data_128: 3n,
                    },
                    {
                        id: 101n,
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                        credit_account_id: BigInt(account2Id),
                        debit_account_id: BigInt(account1Id),
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,
                        user_data_128: 3n,
                    },
                ]
            );
        });

        it.skip('should be able to perform pending transfers in a transaction', async () => {
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.assets_stripe,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                        pending: true,
                    },
                    {
                        transferId: 101n,
                        debitAccountId: ACCOUNT_IDS.assets_stripe,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                        pending: true,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '3',
                    transferIds: ['100', '101'],
                })
            );

            expect(
                mapBigInts(
                    await financialInterface.lookupTransfers([100n, 101n])
                )
            ).toEqual(
                mapBigInts([
                    {
                        id: 100,
                        amount: 100,
                        credit_account_id: Number(account1Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        code: TransferCodes.admin_credit,
                        flags: TransferFlags.linked | TransferFlags.pending,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: expect.any(Number),

                        // should put the transaction id in user_data_128
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                    {
                        id: 101,
                        amount: 100,
                        credit_account_id: Number(account2Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        code: TransferCodes.admin_credit,
                        flags: TransferFlags.none | TransferFlags.pending,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: expect.any(Number),

                        // should put the transaction id in user_data_128
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
        });

        it('should be able to perform balancing credits in a transaction', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            transferId: 100n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                        {
                            transferId: 101n,
                            debitAccountId: ACCOUNT_IDS.assets_cash,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const result = await controller.internalTransaction({
                transfers: [
                    {
                        // Credit assets_stripe more than is allowed
                        // to test that it is balanced to the stripe account's current balance
                        transferId: 102n,
                        debitAccountId: account1Id,
                        creditAccountId: ACCOUNT_IDS.assets_stripe,
                        currency: 'usd',
                        amount: 2000n,
                        code: TransferCodes.admin_debit,
                        balancingCredit: true,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['102'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([102n]), [
                {
                    id: 102n,
                    amount: 1000n,
                    code: TransferCodes.admin_debit,
                    credit_account_id: ACCOUNT_IDS.assets_stripe,
                    debit_account_id: BigInt(account1Id),
                    flags: TransferFlags.none | TransferFlags.balancing_credit,
                    ledger: LEDGERS.usd,
                    user_data_128: 4n,
                },
            ]);
        });

        it('should be able to perform balancing debits in a transaction', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            transferId: 100n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                        {
                            transferId: 101n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account2Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 102n,
                        debitAccountId: account1Id,
                        creditAccountId: ACCOUNT_IDS.assets_stripe,
                        currency: 'usd',

                        // debit account1 more than is allowed
                        // to test that it is balanced to the account's current balance
                        amount: 2000n,
                        code: TransferCodes.admin_debit,
                        balancingDebit: true,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['102'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([102n]), [
                {
                    id: 102n,
                    amount: 1000n,
                    code: TransferCodes.admin_debit,
                    credit_account_id: ACCOUNT_IDS.assets_stripe,
                    debit_account_id: BigInt(account1Id),
                    flags: TransferFlags.none | TransferFlags.balancing_debit,
                    ledger: LEDGERS.usd,
                    user_data_128: 4n,
                },
            ]);
        });

        it('should be able to perform balancing credits and debits in a transaction', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            transferId: 100n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                        {
                            transferId: 101n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account2Id,
                            currency: 'usd',
                            amount: 1500n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            // Multiple debits, single credit, balancing debits
            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 998n,
                        debitAccountId: ACCOUNT_IDS.USD_SETUP,
                        creditAccountId: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                        currency: 'usd',
                        amount: 2000n,
                        code: TransferCodes.control,
                    },
                    {
                        transferId: 102n,
                        debitAccountId: account1Id,
                        creditAccountId: ACCOUNT_IDS.USD_SETUP,
                        currency: 'usd',
                        amount: 2000n,
                        code: TransferCodes.admin_debit,
                        balancingDebit: true,
                        balancingCredit: true,
                    },
                    {
                        transferId: 103n,
                        debitAccountId: account2Id,
                        creditAccountId: ACCOUNT_IDS.USD_SETUP,
                        currency: 'usd',

                        amount: 2000n,
                        code: TransferCodes.admin_debit,
                        balancingDebit: true,
                        balancingCredit: true,
                    },
                    {
                        transferId: 104n,
                        debitAccountId: ACCOUNT_IDS.USD_SETUP,
                        creditAccountId: ACCOUNT_IDS.assets_stripe,
                        currency: 'usd',

                        amount: 2000n,
                        code: TransferCodes.admin_debit,
                    },
                    {
                        transferId: 999n,
                        debitAccountId: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                        creditAccountId: ACCOUNT_IDS.USD_SETUP,
                        currency: 'usd',

                        amount: 2000n,
                        code: TransferCodes.control,
                        balancingCredit: true,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['998', '102', '103', '104', '999'],
                })
            );

            checkTransfers(
                await financialInterface.lookupTransfers([
                    998n,
                    102n,
                    103n,
                    104n,
                    999n,
                ]),
                [
                    {
                        id: 998n,
                        amount: 2000n,
                        credit_account_id: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                        debit_account_id: ACCOUNT_IDS.USD_SETUP,
                        code: TransferCodes.control,
                        flags: TransferFlags.linked,
                        user_data_128: 4n,
                    },
                    {
                        id: 102n,
                        amount: 1000n,
                        credit_account_id: ACCOUNT_IDS.USD_SETUP,
                        debit_account_id: BigInt(account1Id),
                        code: TransferCodes.admin_debit,
                        flags:
                            TransferFlags.linked |
                            TransferFlags.balancing_debit |
                            TransferFlags.balancing_credit,
                        user_data_128: 4n,
                    },
                    {
                        id: 103n,
                        credit_account_id: ACCOUNT_IDS.USD_SETUP,
                        debit_account_id: BigInt(account2Id),

                        amount: 1000n,
                        code: TransferCodes.admin_debit,
                        flags:
                            TransferFlags.linked |
                            TransferFlags.balancing_debit |
                            TransferFlags.balancing_credit,
                        user_data_128: 4n,
                    },
                    {
                        id: 104n,
                        amount: 2000n,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: ACCOUNT_IDS.USD_SETUP,
                        code: TransferCodes.admin_debit,
                        flags: TransferFlags.linked,
                        user_data_128: 4n,
                    },
                    {
                        id: 999n,
                        amount: 2000n,
                        credit_account_id: ACCOUNT_IDS.USD_SETUP,
                        debit_account_id: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                        code: TransferCodes.control,
                        flags: TransferFlags.balancing_credit,
                        user_data_128: 4n,
                    },
                ]
            );

            checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.USD_LIMIT_DEBITS,
                    credits_pending: 0n,
                    credits_posted: 2000n,
                    debits_pending: 0n,
                    debits_posted: 2000n,
                },
                {
                    id: ACCOUNT_IDS.USD_SETUP,
                    credits_pending: 0n,
                    credits_posted: 4000n,
                    debits_pending: 0n,
                    debits_posted: 4000n,
                },
                {
                    id: ACCOUNT_IDS.assets_stripe,
                    credits_pending: 0n,
                    credits_posted: 2000n,
                    debits_pending: 0n,
                    debits_posted: 2500n,
                },
                {
                    id: BigInt(account1Id),
                    credits_pending: 0n,
                    credits_posted: 1000n,
                    debits_pending: 0n,
                    debits_posted: 1000n,
                },
                {
                    id: BigInt(account2Id),
                    credits_pending: 0n,
                    credits_posted: 1500n,
                    debits_pending: 0n,
                    debits_posted: 1000n,
                },
            ]);
        });

        it('should be able to perform closing debits in a transaction', async () => {
            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            transferId: 100n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                        {
                            transferId: 101n,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account2Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const result = await controller.internalTransaction({
                transfers: [
                    {
                        transferId: 102n,
                        debitAccountId: account1Id,
                        creditAccountId: ACCOUNT_IDS.assets_stripe,
                        currency: 'usd',

                        // debit account1 more than is allowed
                        // to test that it is balanced to the account's current balance
                        amount: AMOUNT_MAX,
                        code: TransferCodes.admin_debit,
                        balancingDebit: true,
                    },
                    {
                        transferId: 103n,
                        debitAccountId: account1Id,
                        creditAccountId: ACCOUNT_IDS.assets_stripe,
                        currency: 'usd',
                        amount: 0,
                        code: TransferCodes.account_closing,
                        closingDebit: true,
                    },
                ],
            });

            expect(mapBigInts(result)).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['102', '103'],
                })
            );

            checkTransfers(
                await financialInterface.lookupTransfers([102n, 103n]),
                [
                    {
                        id: 102n,
                        amount: 1000n,
                        code: TransferCodes.admin_debit,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: BigInt(account1Id),
                        flags:
                            TransferFlags.linked |
                            TransferFlags.balancing_debit,
                        ledger: LEDGERS.usd,
                        user_data_128: 4n,
                    },
                    {
                        id: 103n,
                        amount: 0n,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: BigInt(account1Id),
                        code: TransferCodes.account_closing,
                        flags:
                            TransferFlags.none |
                            TransferFlags.closing_debit |
                            TransferFlags.pending,
                        ledger: LEDGERS.usd,

                        // should put the transaction id in user_data_128
                        user_data_128: 4n,
                    },
                ]
            );

            const account = unwrap(await controller.getAccount(account1Id));

            expect(
                (account.flags & AccountFlags.closed) === AccountFlags.closed
            ).toBe(true);
        });
    });

    describe('completePendingTransfers()', () => {
        let account1Id: string;
        let account2Id: string;

        const transfer1: string = '100';
        const transfer2: string = '101';

        beforeEach(async () => {
            unwrap(await controller.init());

            ({ id: account1Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));
            ({ id: account2Id } = unwrap(
                await controller.createAccount(
                    AccountCodes.liabilities_user,
                    LEDGERS.usd
                )
            ));

            unwrap(
                await controller.internalTransaction({
                    transfers: [
                        {
                            transferId: transfer1,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 100n,
                            code: TransferCodes.admin_credit,
                            pending: true,
                        },
                        {
                            transferId: transfer2,
                            debitAccountId: ACCOUNT_IDS.assets_stripe,
                            creditAccountId: account2Id,
                            currency: 'usd',
                            amount: 100n,
                            code: TransferCodes.admin_credit,
                            pending: true,
                        },
                    ],
                })
            );
        });

        it('should post the given transfers', async () => {
            const result = await controller.completePendingTransfers({
                transfers: [transfer1, transfer2],
            });

            expect(result).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['5', '6'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([5n, 6n]), [
                {
                    id: 5n,
                    amount: 100n,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags:
                        TransferFlags.linked |
                        TransferFlags.post_pending_transfer,
                    pending_id: 100n,
                    user_data_128: 4n,
                },
                {
                    id: 6n,
                    amount: 100n,
                    credit_account_id: BigInt(account2Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.post_pending_transfer,
                    pending_id: 101n,
                    user_data_128: 4n,
                },
            ]);
        });

        it('should return a specific error code if the transfers have already been completed', async () => {
            const result = await controller.completePendingTransfers({
                transfers: [transfer1, transfer2],
            });

            expect(result).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['5', '6'],
                })
            );

            const result2 = await controller.completePendingTransfers({
                transfers: [transfer1, transfer2],
            });

            expect(mapBigInts(result2)).toMatchObject(
                failure({
                    errorCode: 'transfer_already_completed',
                    errorMessage: `The transfer (${transfer1}) has already been posted/voided.`,
                })
            );
        });

        it('should void the given transfers', async () => {
            const result = await controller.completePendingTransfers({
                transfers: [transfer1, transfer2],
                flags: TransferFlags.void_pending_transfer,
            });

            expect(result).toEqual(
                success({
                    transactionId: '4',
                    transferIds: ['5', '6'],
                })
            );

            checkTransfers(await financialInterface.lookupTransfers([5n, 6n]), [
                {
                    id: 5n,
                    amount: 100n,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags:
                        TransferFlags.linked |
                        TransferFlags.void_pending_transfer,
                    pending_id: 100n,
                    user_data_128: 4n,
                },
                {
                    id: 6n,
                    amount: 100n,
                    credit_account_id: BigInt(account2Id),
                    debit_account_id: ACCOUNT_IDS.assets_stripe,
                    flags: TransferFlags.void_pending_transfer,
                    pending_id: 101n,
                    user_data_128: 4n,
                },
            ]);
        });
    });
});

describe('getAccountBalance()', () => {
    it('should return the user balance for liabilities_user accounts', async () => {
        const account: Account = {
            id: 1n,
            debits_pending: 100n,
            debits_posted: 50n,
            credits_pending: 200n,
            credits_posted: 155n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 1,
            flags: AccountFlags.debits_must_not_exceed_credits,
            code: AccountCodes.liabilities_user,
            timestamp: 0n,
        };

        const balance = getAccountBalance(account);

        expect(balance).toBe(5); // (155 - 50) - (200 - 100) = 5
    });

    it('should return the assets balance for assets_cash accounts', async () => {
        const account: Account = {
            id: 1n,
            debits_pending: 200n,
            debits_posted: 155n,
            credits_pending: 100n,
            credits_posted: 50n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 1,
            flags: AccountFlags.debits_must_not_exceed_credits,
            code: AccountCodes.assets_cash,
            timestamp: 0n,
        };

        const balance = getAccountBalance(account);

        expect(balance).toBe(5); // (155 - 50) - (200 - 100) = 5
    });
});

describe('getLiabilityAccountBalance()', () => {
    it('should return the posted credits minus the debits', async () => {
        const account: Account = {
            id: 1n,
            debits_pending: 100n,
            debits_posted: 50n,
            credits_pending: 200n,
            credits_posted: 155n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 1,
            flags: AccountFlags.debits_must_not_exceed_credits,
            code: AccountCodes.liabilities_user,
            timestamp: 0n,
        };

        const balance = getLiabilityAccountBalance(account);

        expect(balance).toBe(5); // (155 - 50) - (200 - 100) = 5
    });
});

describe('getAssetAccountBalance()', () => {
    it('should return the posted debits minus the credits', async () => {
        const account: Account = {
            id: 1n,
            debits_pending: 200n,
            debits_posted: 155n,
            credits_pending: 100n,
            credits_posted: 50n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 1,
            flags: AccountFlags.credits_must_not_exceed_debits,
            code: AccountCodes.assets_cash,
            timestamp: 0n,
        };

        const balance = getAssetAccountBalance(account);

        expect(balance).toBe(5); // (155 - 50) - (200n - 100n) = 5
    });
});
