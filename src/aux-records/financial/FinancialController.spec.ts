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
import {
    FinancialController,
    getAccountBalance,
    getAssetAccountBalance,
    getLiabilityAccountBalance,
} from './FinancialController';
import {
    ACCOUNT_IDS,
    AccountCodes,
    AMOUNT_MAX,
    LEDGERS,
    TransferCodes,
} from './FinancialInterface';
import { MemoryFinancialInterface } from './MemoryFinancialInterface';
import type { Account } from './Types';
import { AccountFlags, TransferFlags } from './Types';
import { MemoryStore } from '../MemoryStore';
import { checkAccounts, checkTransfers, mapBigInts } from '../TestUtils';

console.log = jest.fn();
console.error = jest.fn();

describe('FinancialController', () => {
    let financialInterface: MemoryFinancialInterface;
    let store: MemoryStore;
    let controller: FinancialController;
    let dateNowMock: jest.Mock<number>;

    const realDateNow = Date.now;

    beforeEach(() => {
        dateNowMock = Date.now = jest.fn(() => 123);
        financialInterface = new MemoryFinancialInterface();
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

            expect(
                mapBigInts([...financialInterface.accounts.values()])
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
                mapBigInts([...financialInterface.accounts.values()])
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
                    timestamp: 0,
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
                mapBigInts([...financialInterface.accounts.values()])
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                    timestamp: 0,
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
                            timestamp: 0,
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
                            timestamp: 0,
                        },
                    ],
                })
            );
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

        // it.skip('should be able to be idempotent', async () => {
        //     const result = await controller.internalTransaction({
        //         transfers: [
        //             {
        //                 debitAccountId: ACCOUNT_IDS.assets_stripe,
        //                 creditAccountId: account1Id,
        //                 currency: 'credits',
        //                 amount: 100n,
        //                 code: TransferCodes.admin_credit,
        //             },
        //         ],
        //         idempotencyKey: '1b671a64-40d5-491e-99b0-da01ff1f3341',
        //     });

        //     expect(mapBigInts(result)).toEqual(
        //         success({
        //             transactionId: '3',
        //             transferIds: ['4'],
        //         })
        //     );

        //     const result2 = await controller.internalTransaction({
        //         transfers: [
        //             {
        //                 debitAccountId: ACCOUNT_IDS.assets_stripe,
        //                 creditAccountId: account1Id,
        //                 currency: 'credits',
        //                 amount: 100n,
        //                 code: TransferCodes.admin_credit,
        //             },
        //         ],
        //         idempotencyKey: '1b671a64-40d5-491e-99b0-da01ff1f3341',
        //     });

        //     expect(mapBigInts(result2)).toEqual(
        //         success({
        //             transactionId: '3',
        //             transferIds: ['4'],
        //         })
        //     );

        //     expect(mapBigInts(financialInterface.transfers)).toEqual(
        //         mapBigInts([
        //             {
        //                 id: 4,
        //                 amount: 100,
        //                 code: TransferCodes.admin_credit,
        //                 credit_account_id: Number(account1Id),
        //                 debit_account_id: ACCOUNT_IDS.assets_stripe,
        //                 flags: TransferFlags.none,
        //                 ledger: LEDGERS.credits,
        //                 pending_id: 0,
        //                 timeout: 0,
        //                 timestamp: 0,
        //                 user_data_128: 3,
        //                 user_data_64: 0,
        //                 user_data_32: 0,
        //             },
        //         ])
        //     );
        // });

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
            expect(mapBigInts(financialInterface.transfers)).toEqual(
                mapBigInts([
                    {
                        id: 4,
                        amount: 100,
                        code: TransferCodes.admin_credit,
                        credit_account_id: Number(account1Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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
                    // accountBalances: [
                    //     {
                    //         accountId: account1Id,
                    //         balance: 900n,
                    //     },
                    //     {
                    //         accountId: account2Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );
            expect(mapBigInts(financialInterface.transfers.slice(1))).toEqual(
                mapBigInts([
                    {
                        id: 6,
                        amount: 100,
                        code: TransferCodes.admin_credit,
                        credit_account_id: Number(account2Id),
                        debit_account_id: Number(account1Id),
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,
                        user_data_128: 5,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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
                    // accountBalances: [
                    //     {
                    //         accountId: ACCOUNT_IDS.assets_stripe,
                    //         balance: -100n,
                    //     },
                    //     {
                    //         accountId: account1Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );
            expect(mapBigInts(financialInterface.transfers)).toEqual(
                mapBigInts([
                    {
                        id: 100,
                        amount: 100,
                        credit_account_id: Number(account1Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        code: TransferCodes.admin_credit,
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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
            expect(financialInterface.transfers).toEqual([]);
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
                    // accountBalances: [
                    //     {
                    //         accountId: ACCOUNT_IDS.assets_stripe,
                    //         balance: -100n,
                    //     },
                    //     {
                    //         accountId: account1Id,
                    //         balance: 0n,
                    //     },
                    //     {
                    //         accountId: account2Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );

            expect(mapBigInts(financialInterface.transfers)).toEqual(
                mapBigInts([
                    {
                        id: 100,
                        amount: 100,
                        credit_account_id: Number(account1Id),
                        debit_account_id: ACCOUNT_IDS.assets_stripe,
                        code: TransferCodes.admin_credit,
                        flags: TransferFlags.linked,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                    {
                        id: 101,
                        amount: 100,
                        credit_account_id: Number(account2Id),
                        debit_account_id: Number(account1Id),
                        code: TransferCodes.admin_credit,
                        flags: TransferFlags.none,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 3,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
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

            expect(mapBigInts(financialInterface.transfers)).toEqual(
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
                        timestamp: 0,

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
                        timestamp: 0,

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

            expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
                mapBigInts([
                    {
                        id: 102,
                        amount: 1000,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: Number(account1Id),
                        code: TransferCodes.admin_debit,
                        flags:
                            TransferFlags.none | TransferFlags.balancing_credit,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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

            expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
                mapBigInts([
                    {
                        id: 102,
                        amount: 1000,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: Number(account1Id),
                        code: TransferCodes.admin_debit,
                        flags:
                            TransferFlags.none | TransferFlags.balancing_debit,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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

            checkTransfers(financialInterface.transfers.slice(2), [
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
            ]);

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

            // expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
            //     mapBigInts([
            //         {
            //             id: 102,
            //             amount: 1000,
            //             credit_account_id: ACCOUNT_IDS.assets_stripe,
            //             debit_account_id: Number(account1Id),
            //             code: TransferCodes.admin_debit,
            //             flags: TransferFlags.linked | TransferFlags.balancing_debit | TransferFlags.balancing_credit,
            //             ledger: LEDGERS.usd,
            //             pending_id: 0,
            //             timeout: 0,
            //             timestamp: 0,

            //             // should put the transaction id in user_data_128
            //             user_data_128: 4,
            //             user_data_64: 0,
            //             user_data_32: 0,
            //         },
            //         {
            //             id: 103,
            //             amount: 1500,
            //             credit_account_id: ACCOUNT_IDS.assets_stripe,
            //             debit_account_id: Number(account2Id),
            //             code: TransferCodes.admin_debit,
            //             flags: TransferFlags.none | TransferFlags.balancing_debit | TransferFlags.balancing_credit,
            //             ledger: LEDGERS.usd,
            //             pending_id: 0,
            //             timeout: 0,
            //             timestamp: 0,

            //             // should put the transaction id in user_data_128
            //             user_data_128: 4,
            //             user_data_64: 0,
            //             user_data_32: 0,
            //         },
            //     ])
            // );
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

            expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
                mapBigInts([
                    {
                        id: 102,
                        amount: 1000,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: Number(account1Id),
                        code: TransferCodes.admin_debit,
                        flags:
                            TransferFlags.linked |
                            TransferFlags.balancing_debit,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                    {
                        id: 103,
                        amount: 0,
                        credit_account_id: ACCOUNT_IDS.assets_stripe,
                        debit_account_id: Number(account1Id),
                        code: TransferCodes.account_closing,
                        flags:
                            TransferFlags.none |
                            TransferFlags.closing_debit |
                            TransferFlags.pending,
                        ledger: LEDGERS.usd,
                        pending_id: 0,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
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

            expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
                mapBigInts([
                    {
                        id: 5,
                        amount: Number.MAX_SAFE_INTEGER,
                        credit_account_id: 0,
                        debit_account_id: 0,
                        code: 0,
                        flags:
                            TransferFlags.linked |
                            TransferFlags.post_pending_transfer,
                        ledger: 0,
                        pending_id: 100,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                    {
                        id: 6,
                        amount: Number.MAX_SAFE_INTEGER,
                        credit_account_id: 0,
                        debit_account_id: 0,
                        code: 0,
                        flags: TransferFlags.post_pending_transfer,
                        ledger: 0,
                        pending_id: 101,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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

            expect(mapBigInts(financialInterface.transfers.slice(2))).toEqual(
                mapBigInts([
                    {
                        id: 5,
                        amount: 0,
                        credit_account_id: 0,
                        debit_account_id: 0,
                        code: 0,
                        flags:
                            TransferFlags.linked |
                            TransferFlags.void_pending_transfer,
                        ledger: 0,
                        pending_id: 100,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                    {
                        id: 6,
                        amount: 0,
                        credit_account_id: 0,
                        debit_account_id: 0,
                        code: 0,
                        flags: TransferFlags.void_pending_transfer,
                        ledger: 0,
                        pending_id: 101,
                        timeout: 0,
                        timestamp: 0,

                        // should put the transaction id in user_data_128
                        user_data_128: 4,
                        user_data_64: 0,
                        user_data_32: 0,
                    },
                ])
            );
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
