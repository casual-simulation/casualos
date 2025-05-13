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
import { AccountCodes, getFlagsForAccountCode } from './FinancialInterface';
import { AccountFlags } from './Types';

describe('getFlagsForAccountCode()', () => {
    it('should require that assets_cash cannot carry a credit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.assets_cash);
        expect(flags).toBe(AccountFlags.credits_must_not_exceed_debits);
    });

    it('should require that liabilities_user cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.liabilities_user);
        expect(flags).toBe(AccountFlags.debits_must_not_exceed_credits);
    });

    it('should require that liabilities_escrow cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(AccountCodes.liabilities_escrow);
        expect(flags).toBe(AccountFlags.debits_must_not_exceed_credits);
    });

    it('should require that revenue_platform_fees cannot carry a debit balance', () => {
        const flags = getFlagsForAccountCode(
            AccountCodes.revenue_platform_fees
        );
        expect(flags).toBe(AccountFlags.debits_must_not_exceed_credits);
    });
});
