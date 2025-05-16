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

import { success } from '@casual-simulation/aux-common';
import {
    FinancialController,
    getUserAccountBalance,
} from './FinancialController';
import { AccountCodes } from './FinancialInterface';
import { MemoryFinancialInterface } from './MemoryFinancialInterface';
import type { Account } from './Types';
import { AccountFlags } from './Types';

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
                    id: 1n,
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
                    id: 1n,
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
                    account: {
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
                })
            );
        });
    });
});

describe('getUserAccountBalance()', () => {
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

        const balance = getUserAccountBalance(account);

        expect(balance).toBe(105); // 155 - 50 = 105
    });
});
