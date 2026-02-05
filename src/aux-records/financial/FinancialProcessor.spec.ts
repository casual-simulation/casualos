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

import { success, unwrap } from '@casual-simulation/aux-common';
import type { TestServices } from '../TestUtils';
import { checkAccounts, createTestControllers } from '../TestUtils';
import { FinancialProcessor } from './FinancialProcessor';
import { ACCOUNT_IDS, TransferCodes } from './FinancialInterface';

console.log = jest.fn();

describe('FinancialProcessor', () => {
    let services: TestServices;
    let processor: FinancialProcessor;

    beforeEach(async () => {
        services = createTestControllers();
        processor = new FinancialProcessor({
            financial: services.financialController,
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
});
