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
    AccountCodes,
    convertBetweenLedgers,
    getExchangeRate,
    getFlagsForAccountCode,
    getFlagsForTransferCode,
    LEDGERS,
    TransferCodes,
} from './FinancialInterface';
import { AccountFlags, TransferFlags } from 'tigerbeetle-node';

describe('getFlagsForAccountCode()', () => {
    it('should require that assets_cash cannot carry a credit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.assets_cash);
        expect(flags).toBe(
            AccountFlags.credits_must_not_exceed_debits | AccountFlags.history
        );
    });

    it('should require that liabilities_user cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.liabilities_user);
        expect(flags).toBe(
            AccountFlags.debits_must_not_exceed_credits | AccountFlags.history
        );
    });

    it('should require that liabilities_escrow cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.liabilities_contract);
        expect(flags).toBe(
            AccountFlags.debits_must_not_exceed_credits | AccountFlags.history
        );
    });

    it('should require that revenue_platform_fees cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(
            AccountCodes.revenue_platform_fees
        );
        expect(flags).toBe(
            AccountFlags.debits_must_not_exceed_credits | AccountFlags.history
        );
    });

    it('should not require flags for liquidity pools', () => {
        const flags = getFlagsForAccountCode(AccountCodes.liquidity_pool);
        expect(flags).toBe(AccountFlags.none);
    });
});

describe('getFlagsForTransferCode()', () => {
    const noneCases = [
        ['system_cash_rebalance', TransferCodes.system_cash_rebalance] as const,
        ['reverse_transfer', TransferCodes.reverse_transfer] as const,
        ['admin_credit', TransferCodes.admin_credit] as const,
        ['admin_debit', TransferCodes.admin_debit] as const,
        ['purchase_credits', TransferCodes.purchase_credits] as const,
        ['user_payout', TransferCodes.user_payout] as const,
        ['contract_payment', TransferCodes.contract_payment] as const,
        ['invoice_payment', TransferCodes.invoice_payment] as const,
        ['xp_platform_fee', TransferCodes.xp_platform_fee] as const,
        ['item_payment', TransferCodes.item_payment] as const,
        ['store_platform_fee', TransferCodes.store_platform_fee] as const,
    ];

    it.each(noneCases)('should map %s to none', (desc, code) => {
        expect(getFlagsForTransferCode(code)).toEqual(TransferFlags.none);
    });
});

describe('getExchangeRate()', () => {
    const cases = [
        ['usd', 'usd', 1] as const,
        ['usd', 'credits', 1000000] as const,
    ];

    it.each(cases)('should convert %s to %s with rate %d', (from, to, rate) => {
        expect(Number(getExchangeRate(LEDGERS[from], LEDGERS[to]))).toBe(rate);
    });
});

describe('convertBetweenLedgers()', () => {
    const cases = [
        ['usd', 'usd', 100, 100, 0] as const,
        ['usd', 'credits', 100, 100000000, 0] as const,
        ['credits', 'usd', 100000000, 100, 0] as const,
        ['credits', 'usd', 10, 0, 10] as const,
        ['credits', 'credits', 100000000, 100000000, 0] as const,
    ];

    it.each(cases)(
        'should convert %s to %s with %d:%d(%d)',
        (from, to, amount, expected, remainder) => {
            const result = convertBetweenLedgers(
                LEDGERS[from],
                LEDGERS[to],
                BigInt(amount)
            );
            expect(Number(result?.value)).toBe(expected);
            expect(Number(result?.remainder)).toBe(remainder);
        }
    );
});
