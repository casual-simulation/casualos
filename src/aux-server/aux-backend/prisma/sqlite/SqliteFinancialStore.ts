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
import type { PrismaClient } from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type {
    ExternalPayout,
    FinancialAccount,
    FinancialAccountFilter,
    FinancialStore,
    UniqueFinancialAccountFilter,
} from '@casual-simulation/aux-records/financial';
import { cleanupObject } from '@casual-simulation/aux-records';
import type { PartialExcept } from '@casual-simulation/aux-records/crud';

const TRACE_NAME = 'SqliteFinancialStore';

export class SqliteFinancialStore implements FinancialStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async getAccountById(id: string): Promise<FinancialAccount | null> {
        return await this._client.financialAccount.findUnique({
            where: {
                id,
            },
        });
    }

    @traced(TRACE_NAME)
    async getAccountByFilter(
        filter: UniqueFinancialAccountFilter
    ): Promise<FinancialAccount | null> {
        return await this._client.financialAccount.findFirst({
            where: cleanupObject({
                ledger: filter.ledger,
                userId: filter.userId,
                contractId: filter.contractId,
                studioId: filter.studioId,
            }),
        });
    }

    @traced(TRACE_NAME)
    async listAccounts(
        filter: FinancialAccountFilter
    ): Promise<FinancialAccount[]> {
        return await this._client.financialAccount.findMany({
            where: cleanupObject({
                ledger: filter.ledger,
                userId: filter.userId,
                contractId: filter.contractId,
                studioId: filter.studioId,
            }),
        });
    }

    @traced(TRACE_NAME)
    async createAccount(account: FinancialAccount): Promise<void> {
        await this._client.financialAccount.create({
            data: {
                id: account.id,
                userId: account.userId,
                studioId: account.studioId,
                contractId: account.contractId,
                ledger: account.ledger,
                currency: account.currency,

                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async createExternalPayout(payout: ExternalPayout): Promise<void> {
        await this._client.externalPayout.create({
            data: {
                id: payout.id,
                invoiceId: payout.invoiceId,
                userId: payout.userId,
                transferId: payout.transferId,
                transactionId: payout.transactionId,
                stripeTransferId: payout.stripeTransferId,
                destinationStripeAccountId: payout.destinationStripeAccountId,
                externalDestination: payout.externalDestination,
                amount: payout.amount,
                initiatedAt: payout.initatedAtMs,
                postedTransferId: payout.postedTransferId,
                voidedTransferId: payout.voidedTransferId,
                postedAt: payout.postedAtMs,
                voidedAt: payout.voidedAtMs,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async markPayoutAsPosted(
        payoutId: string,
        postedTransferId: string,
        postedAtMs: number
    ): Promise<void> {
        await this._client.externalPayout.update({
            where: {
                id: payoutId,
            },
            data: {
                postedTransferId,
                postedAt: postedAtMs,
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async markPayoutAsVoided(
        payoutId: string,
        voidedTransferId: string,
        voidedAtMs: number
    ): Promise<void> {
        await this._client.externalPayout.update({
            where: {
                id: payoutId,
            },
            data: {
                voidedTransferId,
                voidedAt: voidedAtMs,
                updatedAt: Date.now(),
            },
        });
    }

    @traced(TRACE_NAME)
    async updateExternalPayout(
        payout: PartialExcept<ExternalPayout, 'id'>
    ): Promise<void> {
        await this._client.externalPayout.update({
            where: {
                id: payout.id,
            },
            data: cleanupObject({
                invoiceId: payout.invoiceId,
                userId: payout.userId,
                transferId: payout.transferId,
                transactionId: payout.transactionId,
                stripeTransferId: payout.stripeTransferId,
                destinationStripeAccountId: payout.destinationStripeAccountId,
                externalDestination: payout.externalDestination,
                amount: payout.amount,
                postedTransferId: payout.postedTransferId,
                voidedTransferId: payout.voidedTransferId,
                initiatedAt: payout.initatedAtMs,
                postedAt: payout.postedAtMs,
                voidedAt: payout.voidedAtMs,
                updatedAt: Date.now(),
            }),
        });
    }
}
