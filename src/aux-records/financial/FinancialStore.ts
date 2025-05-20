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
