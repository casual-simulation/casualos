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
import { v7 as uuidv7 } from 'uuid';
import type { FinancialController } from './FinancialController';
import {
    ACCOUNT_IDS,
    BillingCodes,
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
import type { MetricsStore, SubscriptionMetrics } from '../MetricsStore';
import type { ConfigurationStore } from '../ConfigurationStore';
import type { SubscriptionConfiguration } from '../SubscriptionConfiguration';
import { getSubscriptionFeatures } from '../SubscriptionConfiguration';
import type { BillingCycleHistory, FinancialStore } from './FinancialStore';

const TRACE_NAME = 'FinancialProcessor';

export const FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA = z.object({
    type: z.literal('financial-revenue-credit-sweep'),
});

export const FINANCIAL_JOB_PERIODIC_BILLING_SCHEMA = z.object({
    type: z.literal('financial-periodic-billing'),
    nowMs: z.number().optional(),
});

export const FINANCIAL_JOB_SCHEMA = z.discriminatedUnion('type', [
    FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA,
    FINANCIAL_JOB_PERIODIC_BILLING_SCHEMA,
]);

export type FinancialJob = z.infer<typeof FINANCIAL_JOB_SCHEMA>;
export type FinancialRevenueCreditSweepJob = z.infer<
    typeof FINANCIAL_JOB_REVENUE_CREDIT_SWEEP_SCHEMA
>;
export type FinancialPeriodicBillingJob = z.infer<
    typeof FINANCIAL_JOB_PERIODIC_BILLING_SCHEMA
>;

export interface FinancialProcessorConfig {
    financial: FinancialController;
    financialStore: FinancialStore;
    metricsStore: MetricsStore;
    configStore: ConfigurationStore;
}

/**
 * Defines a processor that can handle financial related background jobs.
 */
export class FinancialProcessor {
    private _financial: FinancialController;
    private _financialStore: FinancialStore;
    private _metricsStore: MetricsStore;
    private _configStore: ConfigurationStore;

    constructor(config: FinancialProcessorConfig) {
        this._financial = config.financial;
        this._financialStore = config.financialStore;
        this._metricsStore = config.metricsStore;
        this._configStore = config.configStore;
    }

    @traced(TRACE_NAME)
    async process(job: FinancialJob): Promise<Result<void, SimpleError>> {
        console.log(`[${TRACE_NAME}] Processing job:`, job);
        if (job.type === 'financial-revenue-credit-sweep') {
            return await this._sweepRevenueCredits(job);
        } else if (job.type === 'financial-periodic-billing') {
            return await this._periodicBilling(job);
        }
    }

    @traced(TRACE_NAME)
    private async _periodicBilling(
        job: FinancialPeriodicBillingJob
    ): Promise<Result<void, SimpleError>> {
        const currentTime = job.nowMs ?? Date.now();
        const lastBillingCycle =
            await this._financialStore.getLastBillingCycleHistory();

        const config = await this._configStore.getSubscriptionConfiguration();
        if (!config) {
            console.warn(
                `[${TRACE_NAME}] [_periodicBilling] No subscription configuration found. Skipping periodic billing.`
            );
            return success();
        }

        await Promise.all([
            this._instPeriodicBilling(currentTime, lastBillingCycle, config),
            this._filePeriodicBilling(currentTime, lastBillingCycle, config),
        ]);

        await this._financialStore.saveBillingCycleHistory({
            id: uuidv7(),
            timeMs: currentTime,
        });

        return success();
    }

    private async _instPeriodicBilling(
        currentTime: number,
        lastBillingCycle: BillingCycleHistory | null | undefined,
        config: SubscriptionConfiguration
    ): Promise<Result<void, SimpleError>> {
        const instSubscribers =
            await this._metricsStore.getAllSubscriptionInstMetrics();

        console.log(
            `[${TRACE_NAME}] [_instPeriodicBilling] Found ${instSubscribers.length} total subscription inst metrics.`
        );

        for (const subscriber of instSubscribers) {
            if (subscriber.totalInsts <= 0 && subscriber.totalInstBytes <= 0) {
                console.log(
                    `[${TRACE_NAME}] [_instPeriodicBilling userId: ${subscriber.ownerId} subscriptionId: ${subscriber.subscriptionId}] No inst usage.`
                );
                continue;
            }

            if (subscriber.ownerId) {
                console.log(
                    `[${TRACE_NAME}] [_instPeriodicBilling userId: ${subscriber.ownerId} subscriptionId: ${subscriber.subscriptionId}] Processing user billing.`
                );
            } else if (subscriber.studioId) {
                console.log(
                    `[${TRACE_NAME}] [_instPeriodicBilling studioId: ${subscriber.studioId} subscriptionId: ${subscriber.subscriptionId}] Processing studio billing.`
                );
            } else {
                console.warn(
                    `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber has no ownerId or studioId. Skipping.`
                );
                continue;
            }

            if (
                !subscriber.currentPeriodEndMs ||
                !subscriber.currentPeriodStartMs
            ) {
                console.warn(
                    `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber is missing current period start or end. Skipping.`
                );
                continue;
            }

            const fractionOfCurrentPeriod =
                this._calculateFractionOfCurrentPeriod(
                    subscriber,
                    lastBillingCycle,
                    currentTime
                );

            const features = getSubscriptionFeatures(
                config,
                'active',
                subscriber.subscriptionId,
                subscriber.subscriptionType
            );

            const account = await this._financial.getFinancialAccount({
                studioId: subscriber.studioId,
                userId: subscriber.ownerId,
                ledger: LEDGERS.credits,
            });

            if (isFailure(account)) {
                logError(
                    account.error,
                    `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to get financial account for subscriber.`
                );
                continue;
            }

            if (!features) {
                console.warn(
                    `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] No subscription features found for subscriber. Skipping.`
                );
                continue;
            }

            if (!features.insts.allowed) {
                console.log(
                    `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber does not have insts allowed. Skipping.`
                );
                continue;
            }

            if (
                features.insts.creditFeePerKilobytePerPeriod ||
                features.insts.creditFeePerInstPerPeriod
            ) {
                if (
                    subscriber.totalInsts > 0 &&
                    features.insts.creditFeePerInstPerPeriod
                ) {
                    const perFractionFee =
                        features.insts.creditFeePerInstPerPeriod /
                        BigInt(fractionOfCurrentPeriod);

                    if (perFractionFee > 0n) {
                        const total =
                            BigInt(subscriber.totalInsts) * perFractionFee;

                        console.log(
                            `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Charging inst count fee. totalInsts: ${subscriber.totalInsts} fractionOfCurrentPeriod: ${fractionOfCurrentPeriod} perFractionFee: ${perFractionFee} total: ${total}`
                        );

                        const feeResult =
                            await this._financial.internalTransaction({
                                transfers: [
                                    {
                                        amount: total,
                                        debitAccountId:
                                            account.value.account.id,
                                        creditAccountId:
                                            ACCOUNT_IDS.revenue_records_usage_credits,
                                        code: TransferCodes.records_usage_fee,
                                        currency: CurrencyCodes.credits,
                                        billingCode: BillingCodes.inst_count,
                                        balancingDebit: true,
                                    },
                                ],
                            });

                        if (isFailure(feeResult)) {
                            logError(
                                feeResult.error,
                                `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to charge inst count fee.`
                            );
                        }
                    }
                }

                if (
                    subscriber.totalInstBytes > 0 &&
                    features.insts.creditFeePerKilobytePerPeriod
                ) {
                    const totalKilobytes = Math.ceil(
                        subscriber.totalInstBytes / 1000
                    );
                    const perFractionFee =
                        features.insts.creditFeePerKilobytePerPeriod /
                        BigInt(fractionOfCurrentPeriod);

                    if (perFractionFee > 0n) {
                        const total = BigInt(totalKilobytes) * perFractionFee;

                        console.log(
                            `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Charging inst byte fee. totalInstBytes: ${subscriber.totalInstBytes} fractionOfCurrentPeriod: ${fractionOfCurrentPeriod} perFractionFee: ${perFractionFee} total: ${total}`
                        );

                        const feeResult =
                            await this._financial.internalTransaction({
                                transfers: [
                                    {
                                        amount: total,
                                        debitAccountId:
                                            account.value.account.id,
                                        creditAccountId:
                                            ACCOUNT_IDS.revenue_records_usage_credits,
                                        code: TransferCodes.records_usage_fee,
                                        currency: CurrencyCodes.credits,
                                        billingCode:
                                            BillingCodes.inst_byte_storage,
                                        balancingDebit: true,
                                    },
                                ],
                            });

                        if (isFailure(feeResult)) {
                            logError(
                                feeResult.error,
                                `[${TRACE_NAME}] [_instPeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to charge inst byte fee.`
                            );
                        }
                    }
                }
            }
        }

        return success();
    }

    /**
     * Calculates the fraction of the current billing period that has passed since the last billing cycle. This is used to determine how much to charge for the current period based on how much of the period has passed since the last billing.
     *
     * @param subscriber The subscriber for which to calculate the fraction of the current period. This should contain the current period start and end times.
     * @param lastBillingCycle The last billing cycle history, which contains the time of the last billing. This is used to calculate how much time has passed since the last billing.
     * @param currentTime The current time in milliseconds. This is used to calculate how much time has passed since the last billing.
     * @returns A bigint that should be used to divide the full period fee to get the prorated fee for the billing cycle under evaluation.
     */
    private _calculateFractionOfCurrentPeriod(
        subscriber: SubscriptionMetrics,
        lastBillingCycle: BillingCycleHistory,
        currentTime: number
    ) {
        const periodLength =
            subscriber.currentPeriodEndMs - subscriber.currentPeriodStartMs;
        const day = 24 * 60 * 60 * 1000;

        // The last billing time is either the last recorded billing cycle time or one day ago
        const lastBillingTimeMs = lastBillingCycle?.timeMs ?? currentTime - day;
        const timeSinceLastBilling = currentTime - lastBillingTimeMs;

        // The fraction of the current period that has passed since the last billing
        // We round up to ensure we don't undercharge
        // e.g. if this job is run every 24 hours, and the period is 30 days, then we want to charge for 1/30th of the period
        const fractionOfCurrentPeriod = BigInt(
            Math.ceil(periodLength / timeSinceLastBilling)
        );
        return fractionOfCurrentPeriod;
    }

    private async _filePeriodicBilling(
        currentTime: number,
        lastBillingCycle: BillingCycleHistory | null | undefined,
        config: SubscriptionConfiguration
    ): Promise<Result<void, SimpleError>> {
        const fileSubscribers =
            await this._metricsStore.getAllFileSubscriptionMetrics();

        console.log(
            `[${TRACE_NAME}] [_filePeriodicBilling] Found ${fileSubscribers.length} total subscription file metrics.`
        );

        for (const subscriber of fileSubscribers) {
            if (
                subscriber.totalFiles <= 0 &&
                subscriber.totalFileBytesReserved <= 0
            ) {
                console.log(
                    `[${TRACE_NAME}] [_filePeriodicBilling userId: ${subscriber.ownerId} subscriptionId: ${subscriber.subscriptionId}] No file usage.`
                );
                continue;
            }

            if (subscriber.ownerId) {
                console.log(
                    `[${TRACE_NAME}] [_filePeriodicBilling userId: ${subscriber.ownerId} subscriptionId: ${subscriber.subscriptionId}] Processing user billing.`
                );
            } else if (subscriber.studioId) {
                console.log(
                    `[${TRACE_NAME}] [_filePeriodicBilling studioId: ${subscriber.studioId} subscriptionId: ${subscriber.subscriptionId}] Processing studio billing.`
                );
            } else {
                console.warn(
                    `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber has no ownerId or studioId. Skipping.`
                );
                continue;
            }

            if (
                !subscriber.currentPeriodEndMs ||
                !subscriber.currentPeriodStartMs
            ) {
                console.warn(
                    `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber is missing current period start or end. Skipping.`
                );
                continue;
            }

            const fractionOfCurrentPeriod =
                this._calculateFractionOfCurrentPeriod(
                    subscriber,
                    lastBillingCycle,
                    currentTime
                );

            const features = getSubscriptionFeatures(
                config,
                'active',
                subscriber.subscriptionId,
                subscriber.subscriptionType
            );

            const account = await this._financial.getFinancialAccount({
                studioId: subscriber.studioId,
                userId: subscriber.ownerId,
                ledger: LEDGERS.credits,
            });

            if (isFailure(account)) {
                logError(
                    account.error,
                    `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to get financial account for subscriber.`
                );
                continue;
            }

            if (!features) {
                console.warn(
                    `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] No subscription features found for subscriber. Skipping.`
                );
                continue;
            }

            if (!features.files.allowed) {
                console.log(
                    `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Subscriber does not have files allowed. Skipping.`
                );
                continue;
            }

            if (
                features.files.creditFeePerFilePerPeriod ||
                features.files.creditFeePerKilobytePerPeriod
            ) {
                if (
                    subscriber.totalFiles > 0 &&
                    features.files.creditFeePerFilePerPeriod
                ) {
                    const perFractionFee =
                        features.files.creditFeePerFilePerPeriod /
                        BigInt(fractionOfCurrentPeriod);

                    if (perFractionFee > 0n) {
                        const total =
                            BigInt(subscriber.totalFiles) * perFractionFee;

                        console.log(
                            `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Charging file count fee. totalFiles: ${subscriber.totalFiles} fractionOfCurrentPeriod: ${fractionOfCurrentPeriod} perFractionFee: ${perFractionFee} total: ${total}`
                        );

                        const feeResult =
                            await this._financial.internalTransaction({
                                transfers: [
                                    {
                                        amount: total,
                                        debitAccountId:
                                            account.value.account.id,
                                        creditAccountId:
                                            ACCOUNT_IDS.revenue_records_usage_credits,
                                        code: TransferCodes.records_usage_fee,
                                        currency: CurrencyCodes.credits,
                                        billingCode: BillingCodes.file_count,
                                        balancingDebit: true,
                                    },
                                ],
                            });

                        if (isFailure(feeResult)) {
                            logError(
                                feeResult.error,
                                `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to charge file count fee.`
                            );
                        }
                    }
                }

                if (
                    subscriber.totalFileBytesReserved > 0 &&
                    features.files.creditFeePerKilobytePerPeriod
                ) {
                    const totalKilobytes = Math.ceil(
                        subscriber.totalFileBytesReserved / 1000
                    );
                    const perFractionFee =
                        features.files.creditFeePerKilobytePerPeriod /
                        BigInt(fractionOfCurrentPeriod);

                    if (perFractionFee > 0n) {
                        const total = BigInt(totalKilobytes) * perFractionFee;

                        console.log(
                            `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Charging file byte fee. totalFileBytesReserved: ${subscriber.totalFileBytesReserved} fractionOfCurrentPeriod: ${fractionOfCurrentPeriod} perFractionFee: ${perFractionFee} total: ${total}`
                        );

                        const feeResult =
                            await this._financial.internalTransaction({
                                transfers: [
                                    {
                                        amount: total,
                                        debitAccountId:
                                            account.value.account.id,
                                        creditAccountId:
                                            ACCOUNT_IDS.revenue_records_usage_credits,
                                        code: TransferCodes.records_usage_fee,
                                        currency: CurrencyCodes.credits,
                                        billingCode:
                                            BillingCodes.file_byte_storage,
                                        balancingDebit: true,
                                    },
                                ],
                            });

                        if (isFailure(feeResult)) {
                            logError(
                                feeResult.error,
                                `[${TRACE_NAME}] [_filePeriodicBilling subscriptionId: ${subscriber.subscriptionId}] Failed to charge file byte fee.`
                            );
                        }
                    }
                }
            }
        }

        return success();
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
