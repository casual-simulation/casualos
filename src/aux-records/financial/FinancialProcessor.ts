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

import { traced } from '../tracing/TracingDecorators';
import z from 'zod';
import type { FinancialController } from './FinancialController';
import {
    ACCOUNT_IDS,
    convertBetweenLedgers,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
} from './FinancialInterface';
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    logError,
    success,
} from '@casual-simulation/aux-common';

const TRACE_NAME = 'FinancialProcessor';

export const FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA = z.object({
    type: z.literal('financial-revenue-credit-sweep'),
});

// export const FINANCIAL_JOB_PROCESS_FEES_PER_PERIOD = z.object({
//     type: z.literal('financial-process-fees-for-day'),
// });

export const FINANCIAL_JOB_SCHEMA = z.discriminatedUnion('type', [
    FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA,
    // FINANCIAL_JOB_PROCESS_FEES_PER_PERIOD,
]);

export type FinancialJob = z.infer<typeof FINANCIAL_JOB_SCHEMA>;
export type FinancialRevenueCreditSweepJob = z.infer<
    typeof FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA
>;

export interface FinancialProcessorConfig {
    financial: FinancialController;
}

/**
 * Defines a processor that can handle financial related background jobs.
 */
export class FinancialProcessor {
    private _financial: FinancialController;

    constructor(config: FinancialProcessorConfig) {
        this._financial = config.financial;
    }

    @traced(TRACE_NAME)
    async process(job: FinancialJob): Promise<Result<void, SimpleError>> {
        console.log(`[${TRACE_NAME}] Processing job:`, job);
        if (job.type === 'financial-revenue-credit-sweep') {
            return await this._sweepRevenueCredits(job);
        }
    }

    @traced(TRACE_NAME)
    private async _sweepRevenueCredits(
        job: FinancialRevenueCreditSweepJob
    ): Promise<Result<void, SimpleError>> {
        const revenueCreditsAccount = await this._financial.getAccount(
            ACCOUNT_IDS.revenue_records_usage_credits
        );

        if (isFailure(revenueCreditsAccount)) {
            logError(
                revenueCreditsAccount.error,
                `[${TRACE_NAME}] [_sweepRevenueCredits] Failed to get revenue credits account:`
            );
            return revenueCreditsAccount;
        }

        const currentBalance =
            revenueCreditsAccount.value.credits_posted -
            revenueCreditsAccount.value.debits_posted;

        if (currentBalance <= 0n) {
            console.log(
                `[${TRACE_NAME}] [_sweepRevenueCredits] No revenue credits to sweep.`
            );
            return success();
        }

        const usd = convertBetweenLedgers(
            LEDGERS.credits,
            LEDGERS.usd,
            currentBalance
        );
        let credits: bigint;

        if (usd.remainder > 0n) {
            credits = convertBetweenLedgers(
                LEDGERS.usd,
                LEDGERS.credits,
                usd.value
            ).value;
        } else {
            credits = currentBalance;
        }

        const result = await this._financial.internalTransaction({
            transfers: [
                {
                    amount: credits,
                    debitAccountId: ACCOUNT_IDS.revenue_records_usage_credits,
                    creditAccountId: ACCOUNT_IDS.liquidity_credits,
                    code: TransferCodes.revenue_credit_sweep,
                    currency: CurrencyCodes.credits,
                },
                {
                    amount: usd.value,
                    debitAccountId: ACCOUNT_IDS.liquidity_usd,
                    creditAccountId: ACCOUNT_IDS.revenue_records_usage_usd,
                    code: TransferCodes.revenue_credit_sweep,
                    currency: CurrencyCodes.usd,
                },
            ],
        });

        if (isFailure(result)) {
            logError(
                result.error,
                `[${TRACE_NAME}] [_sweepRevenueCredits] Failed to sweep revenue credits:`
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            });
        }

        console.log(
            `[${TRACE_NAME}] [_sweepRevenueCredits] Swept ${credits} credits (${usd.value} USD) from revenue_records_usage_credits.`
        );

        return success();
    }
}
