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
    LEDGERS,
    TransferCodes,
} from './FinancialInterface';
import { MemoryFinancialInterface } from './MemoryFinancialInterface';
import type { Account } from './Types';
import { AccountFlags, TransferFlags } from './Types';

console.error = jest.fn();

describe('FinancialController', () => {
    let financialInterface: MemoryFinancialInterface;
    let controller: FinancialController;
    let dateNowMock: jest.Mock<number>;

    const realDateNow = Date.now;

    beforeEach(() => {
        dateNowMock = Date.now = jest.fn(() => 123);
        financialInterface = new MemoryFinancialInterface();
        controller = new FinancialController(financialInterface);
    });

    afterEach(() => {
        Date.now = realDateNow;
    });

    describe('init()', () => {
        it('should create a stripe assets account', async () => {
            await controller.init();

            expect([...financialInterface.accounts.values()]).toEqual([
                {
                    id: 1001n,
                    debits_pending: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    credits_posted: 0n,
                    user_data_128: 0n,
                    user_data_64: 0n,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: 1,
                    flags: AccountFlags.credits_must_not_exceed_debits,
                    code: AccountCodes.assets_cash,
                    timestamp: 0n,
                },
            ]);
        });
    });

    describe('createAccount()', () => {
        it('should create a new account with the specified code', async () => {
            const account = await controller.createAccount(
                AccountCodes.assets_cash
            );
            expect(account).toEqual(
                success({
                    id: '1',
                })
            );

            expect([...financialInterface.accounts.values()]).toEqual([
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
                    flags: AccountFlags.credits_must_not_exceed_debits,
                    code: AccountCodes.assets_cash,
                    timestamp: 0n,
                },
            ]);
        });

        it('should be able to create a user account', async () => {
            const account = await controller.createAccount(
                AccountCodes.liabilities_user
            );
            expect(account).toEqual(
                success({
                    id: '1',
                })
            );

            expect([...financialInterface.accounts.values()]).toEqual([
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
                    flags: AccountFlags.debits_must_not_exceed_credits,
                    code: AccountCodes.liabilities_user,
                    timestamp: 0n,
                },
            ]);
        });
    });

    describe('getAccount()', () => {
        beforeEach(async () => {
            await controller.init();
            await controller.createAccount(AccountCodes.assets_cash);
            await controller.createAccount(AccountCodes.liabilities_user);
        });

        it('should return the account with the specified ID', async () => {
            const account = await controller.getAccount(1n);
            expect(account).toEqual(
                success({
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
                    flags: AccountFlags.credits_must_not_exceed_debits,
                    code: AccountCodes.assets_cash,
                    timestamp: 0n,
                })
            );
        });
    });

    describe('internalTransfer()', () => {
        let account1Id: string;
        let account2Id: string;

        beforeEach(async () => {
            unwrap(await controller.init());

            ({ id: account1Id } = unwrap(
                await controller.createAccount(AccountCodes.liabilities_user)
            ));
            ({ id: account2Id } = unwrap(
                await controller.createAccount(AccountCodes.liabilities_user)
            ));
        });

        it('should be able to transfer money from the assets_cash account to a user account', async () => {
            const result = await controller.internalTransfer({
                transfers: [
                    {
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'credits',
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
            expect(financialInterface.transfers).toEqual([
                {
                    id: 4n,
                    amount: 100n,
                    code: TransferCodes.admin_credit,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.credits,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 3n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should be able to transfer money from one user account to another', async () => {
            unwrap(
                await controller.internalTransfer({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.stripe_assets,
                            creditAccountId: account1Id,
                            currency: 'credits',
                            amount: 1000n,
                            code: TransferCodes.admin_credit,
                        },
                    ],
                })
            );

            const result = await controller.internalTransfer({
                transfers: [
                    {
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'credits',
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
            expect(financialInterface.transfers.slice(1)).toEqual([
                {
                    id: 6n,
                    amount: 100n,
                    code: TransferCodes.admin_credit,
                    credit_account_id: BigInt(account2Id),
                    debit_account_id: BigInt(account1Id),
                    flags: TransferFlags.none,
                    ledger: LEDGERS.credits,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 5n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should use the given transfer Id', async () => {
            const result = await controller.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'credits',
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
                    //         accountId: ACCOUNT_IDS.stripe_assets,
                    //         balance: -100n,
                    //     },
                    //     {
                    //         accountId: account1Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );
            expect(financialInterface.transfers).toEqual([
                {
                    id: 100n,
                    amount: 100n,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    code: TransferCodes.admin_credit,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.credits,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 3n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should reject the transfer if it would cause a user account to go negative', async () => {
            const result = await controller.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'credits',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(result).toEqual(
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
            const result = await controller.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'credits',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                    {
                        transferId: 101n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'credits',
                        amount: 100n,
                        code: TransferCodes.admin_credit,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: '3',
                    transferIds: ['100', '101'],
                    // accountBalances: [
                    //     {
                    //         accountId: ACCOUNT_IDS.stripe_assets,
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

            expect(financialInterface.transfers).toEqual([
                {
                    id: 100n,
                    amount: 100n,
                    credit_account_id: BigInt(account1Id),
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    code: TransferCodes.admin_credit,
                    flags: TransferFlags.linked,
                    ledger: LEDGERS.credits,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,

                    // should put the transaction id in user_data_128
                    user_data_128: 3n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
                {
                    id: 101n,
                    amount: 100n,
                    credit_account_id: BigInt(account2Id),
                    debit_account_id: BigInt(account1Id),
                    code: TransferCodes.admin_credit,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.credits,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,

                    // should put the transaction id in user_data_128
                    user_data_128: 3n,
                    user_data_64: 0n,
                    user_data_32: 0,
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

        expect(balance).toBe(105); // 155 - 50 = 105
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

        expect(balance).toBe(105); // 155 - 50 = 105
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

        expect(balance).toBe(105); // 155 - 50 = 105
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

        expect(balance).toBe(105); // 155 - 50 = 105
    });
});
