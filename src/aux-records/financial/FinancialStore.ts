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

import type { PartialExcept } from '../crud';

export interface FinancialStore {
    /**
     * Gets the financial account with the given ID.
     * @param id The ID of the account to get.
     */
    getAccountById(id: string): Promise<FinancialAccount | null>;

    /**
     * Gets the financial account with the given filter.
     * @param filter The filter to use. Must specify one of userId, studioId, or contractId and also specify the ledger.
     */
    getAccountByFilter(
        filter: UniqueFinancialAccountFilter
    ): Promise<FinancialAccount | null>;

    /**
     * Gets a list of financial accounts by the given filter.
     * @param filter The filter to use.
     */
    listAccounts(filter: FinancialAccountFilter): Promise<FinancialAccount[]>;

    /**
     * Saves the given financial account in the store.
     * @param account The account to save.
     */
    createAccount(account: FinancialAccount): Promise<void>;

    /**
     * Creates a new external payout.
     * @param payout The payout to create.
     */
    createExternalPayout(payout: ExternalPayout): Promise<void>;

    /**
     * Marks a payout as posted.
     * @param payoutId The ID of the payout to mark as posted.
     * @param postedTransferId The ID of the transfer that posted the payout.
     * @param postedAtMs The time that the payout was posted at in milliseconds since epoch.
     */
    markPayoutAsPosted(
        payoutId: string,
        postedTransferId: string,
        postedAtMs: number
    ): Promise<void>;

    /**
     * Marks a payout as voided.
     * @param payoutId The ID of the payout to mark as voided.
     * @param voidedTransferId The ID of the transfer that voided the payout.
     * @param voidedAtMs The time that the payout was voided at in milliseconds since epoch.
     */
    markPayoutAsVoided(
        payoutId: string,
        voidedTransferId: string,
        voidedAtMs: number
    ): Promise<void>;

    /**
     * Updates the given external payout.
     * @param payout The payout to update.
     */
    updateExternalPayout(
        payout: PartialExcept<ExternalPayout, 'id'>
    ): Promise<void>;
}

export interface UniqueFinancialAccountFilter {
    /**
     * The user ID to filter by.
     */
    userId?: string;

    /**
     * The studio ID to filter by.
     */
    studioId?: string;

    /**
     * The contract ID to filter by.
     */
    contractId?: string;

    /**
     * The ledger to filter by.
     */
    ledger: number;
}

export interface FinancialAccountFilter {
    /**
     * The user ID to filter by.
     */
    userId?: string;

    /**
     * The studio ID to filter by.
     */
    studioId?: string;

    /**
     * The contract ID to filter by.
     */
    contractId?: string;

    /**
     * The ledger to filter by.
     */
    ledger?: number;
}

/**
 * Represents a financial account in the system.
 */
export interface FinancialAccount {
    /**
     * The ID of the account.
     */
    id: string;

    /**
     * The ID of the user that this account is held by.
     * If null, then this account is not held by a user.
     */
    userId?: string | null;

    /**
     * The ID of the studio that this account is held by.
     * If null, then this account is not held by a studio.
     */
    studioId?: string | null;

    /**
     * The ID of the contract that this account is held by.
     * If null, then this account is not held by a contract.
     */
    contractId?: string | null;

    /**
     * The ledger that this account is for.
     */
    ledger: number;

    /**
     * The currency that this account is tracked in.
     * Always matches the currency of the ledger.
     */
    currency: string;
}

export interface ExternalPayout {
    /**
     * The ID of the payout.
     */
    id: string;

    /**
     * The ID of the invoice that the payout is for.
     */
    invoiceId?: string;

    /**
     * The ID of the user that the payout is for.
     */
    userId?: string;

    /**
     * The ID of the studio that the payout is for.
     */
    studioId?: string;

    /**
     * The ID of the transfer that makes the payout.
     */
    tranferId: string;

    /**
     * The ID of the transaction that this payout is part of.
     */
    transactionId: string;

    /**
     * The ID of the stripe transfer that is associated with this payout.
     */
    stripeTransferId?: string;

    /**
     * The destionation that the payout is sent to.
     */
    externalDestination: PayoutDestination;

    /**
     * The amount of the payout.
     */
    amount: number;

    /**
     * The ID of the transfer that posts the payout.
     */
    postedTransferId?: string;

    /**
     * The ID of the transfer that voids the payout.
     */
    voidedTransferId?: string;

    /**
     * The time that the payout was initiated at in milliseconds since epoch.
     */
    initatedAtMs: number;

    /**
     * The time that the payout was posted at in milliseconds since epoch.
     */
    postedAtMs?: number;

    /**
     * The time that the payout was voided at in milliseconds since epoch.
     */
    voidedAtMs?: number;
}

/**
 * The list of possible payout destinations.
 *
 * - `stripe` indicates that the payout should be sent to the user's Stripe account.
 * - `cash` indicates that the payout was sent as cash (e.g. check, manual bank transfer, cash, etc.)
 */
export type PayoutDestination = 'stripe' | 'cash';
