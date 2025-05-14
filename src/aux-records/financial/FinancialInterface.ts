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
import type { SimpleError, Result } from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';
import type {
    Account,
    AccountBalance,
    AccountFilter,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from './Types';
import { CreateTransferError, TransferFlags } from './Types';
import { AccountFlags, CreateAccountError } from './Types';

/**
 * The Ledgers that the system uses.
 */
export const LEDGERS = {
    /**
     * The ID of the ledger for transactions denominated in USD.
     */
    usd: 1,
};

/**
 * The map of ledger IDs to their currency codes.
 */
export const CURRENCIES = new Map<number, string>([[LEDGERS.usd, 'usd']]);

/**
 * Account IDs for built-in accounts.
 */
export const ACCOUNT_IDS = {
    /**
     * The ID of the stripe cash asset account.
     */
    stripe_assets: 1001n,
};

/**
 * Standards for account codes from the systems perspective.
 * * [1000] assets
 * * * [1001] cash
 * * [2000] liabilities
 * * * [2100] liabilities to users (e.g. deposit to system via stripe / balance reload)
 * * * * [2101] liabilities to users (e.g. money in a user account)
 * * * * [2102] liabilities to users held in escrow (e.g. money in a contract account)
 * * [3000] equity
 * * [4000] revenue
 * * * [4100] revenue from fees
 * * * * [4101] revenue from platform fees
 * * [5000] expenses
 */
export enum AccountCodes {
    /**
     * Cash accounts for the system
     */
    assets_cash = 1001, // flags.credits_must_not_exceed_debits

    /**
     * Liability accounts to users.
     */
    liabilities_user = 2101, // flags.debits_must_not_exceed_credits

    /**
     * Liability accounts to users held in escrow.
     */
    liabilities_escrow = 2102, // flags.debits_must_not_exceed_credits

    /**
     * Revenue accounts from platform fees.
     */
    revenue_platform_fees = 4101, // flags.debits_must_not_exceed_credits
}

/**
 * Standards for transfer codes from the systems perspective.
 * * [0000] <1000's class> Administrative transfers and reversals.
 * * [1000] <1000's class> Crediting the user (1000 is from the system if ever needed)
 * * [1100] <10's subclass> Crediting the user from external entities (e.g. deposit to system via stripe / balance reload)
 * * [1200] <200's subclass> Contract crediting
 * * [2000] <2000's class> Debiting the user (2000 is from the system if ever needed)
 * * [2100] <100's subclass> Debiting the user from external entities (e.g. withdrawal from system via stripe / payout)
 * * [2200] <200's subclass> Contract debiting
 *
 * ? The spacing levels future-proof the system for more codes.
 * ? Additional codes in this MLNC could be flags for nominally similar (to existing) multi-phase transactions.
 *
 */
export enum TransferCodes {
    /**
     * Administrative transfers to rebalance cash in the system.
     */
    system_cash_rebalance = 1,

    /**
     * Reversing a previous transfer.
     */
    reverse_transfer = 2,

    /**
     * A credit to a user from the system.
     */
    system_credits_user = 1000,

    /**
     * A credit to the user from external entities (e.g. deposit to system via stripe / balance reload)
     */
    external_credits_user = 1101,

    /**
     * A credit to a contract from a user
     */
    user_credits_contract = 1200,

    /**
     * A debit to the user from the system.
     */
    system_debits_user = 2000,

    /**
     * A debit to a user from external entities (e.g. withdrawal from system via stripe / payout)
     */
    external_debits_user = 2100,

    /**
     * A debit to a contract from a user
     */
    user_debits_contract = 2200,
}

/**
 * Interface follows Client practices in "tigerbeetle-node" as a base for account and transfer operations.
 * Revise as needed if more operations are needed.
 */
export interface FinancialInterface {
    generateId: () => Account['id'];
    createAccount: (account: Account) => Promise<CreateAccountsError[]>;
    createAccounts: (batch: Account[]) => Promise<CreateAccountsError[]>;
    createTransfers: (batch: Transfer[]) => Promise<CreateTransfersError[]>;
    lookupAccounts: (batch: Account['id'][]) => Promise<Account[]>;
    lookupTransfers: (batch: Transfer['id'][]) => Promise<Transfer[]>;
    getAccountTransfers: (filter: AccountFilter) => Promise<Transfer[]>;
    getAccountBalances: (filter: AccountFilter) => Promise<AccountBalance[]>;
    queryAccounts: (filter: QueryFilter) => Promise<Account[]>;
    queryTransfers: (filter: QueryFilter) => Promise<Transfer[]>;

    /**
     * Gets the current time in nanoseconds since the epoch.
     */
    // now: () => bigint;
}

/**
 * Gets the account flags for the given account code.
 * @param code The code of the account.
 */
export function getFlagsForAccountCode(code: AccountCodes): AccountFlags {
    switch (code) {
        case AccountCodes.assets_cash:
            return AccountFlags.credits_must_not_exceed_debits;
        case AccountCodes.liabilities_user:
            return AccountFlags.debits_must_not_exceed_credits;
        case AccountCodes.liabilities_escrow:
            return AccountFlags.debits_must_not_exceed_credits;
        case AccountCodes.revenue_platform_fees:
            return AccountFlags.debits_must_not_exceed_credits;
        default:
            throw new Error(`Unknown account code: ${code}`);
    }
}

export function getMessageForAccountError(error: CreateAccountError) {
    switch (error) {
        case CreateAccountError.code_must_not_be_zero:
            return 'The account code must not be zero.';
        case CreateAccountError.credits_pending_must_be_zero:
            return 'The account credits pending must be zero.';
        case CreateAccountError.debits_pending_must_be_zero:
            return 'The account debits pending must be zero.';
        case CreateAccountError.credits_posted_must_be_zero:
            return 'The account credits posted must be zero.';
        case CreateAccountError.debits_posted_must_be_zero:
            return 'The account debits posted must be zero.';
        case CreateAccountError.exists:
            return 'The account already exists.';
        case CreateAccountError.exists_with_different_code:
            return 'The account already exists with a different code.';
        case CreateAccountError.exists_with_different_flags:
            return 'The account already exists with different flags.';
        case CreateAccountError.exists_with_different_ledger:
            return 'The account already exists with a different ledger.';
        case CreateAccountError.exists_with_different_user_data_128:
        case CreateAccountError.exists_with_different_user_data_64:
        case CreateAccountError.exists_with_different_user_data_32:
            return 'The account already exists with different user data.';
        case CreateAccountError.flags_are_mutually_exclusive:
            return 'The account flags are mutually exclusive.';
        case CreateAccountError.timestamp_must_be_zero:
            return 'The account timestamp must be zero.';
        default:
            return 'An unknown error occurred.';
    }
}

export function getMessageForTransferError(error: CreateTransferError) {
    switch (error) {
        case CreateTransferError.code_must_not_be_zero:
            return 'The transfer code must not be zero.';
        case CreateTransferError.accounts_must_be_different:
            return 'The transfer accounts must be different.';
        case CreateTransferError.amount_must_not_be_zero:
            return 'The transfer amount must not be zero.';
        case CreateTransferError.accounts_must_have_the_same_ledger:
            return 'The transfer accounts must have the same ledger.';
        case CreateTransferError.closing_transfer_must_be_pending:
            return 'The closing transfer must be pending.';
        case CreateTransferError.credit_account_already_closed:
            return 'The credit account is already closed.';
        case CreateTransferError.debit_account_already_closed:
            return 'The debit account is already closed.';
        case CreateTransferError.credit_account_not_found:
            return 'The credit account was not found.';
        case CreateTransferError.debit_account_not_found:
            return 'The debit account was not found.';
        case CreateTransferError.exceeds_credits:
            return 'The transfer would cause the debits on the account to exceed its credits.';
        case CreateTransferError.exceeds_debits:
            return 'The transfer would cause the credits on the account to exceed its debits.';
        case CreateTransferError.exists:
            return 'The transfer already exists.';
        case CreateTransferError.exceeds_pending_transfer_amount:
            return 'The transfer would cause the pending transfer amount to exceed its limit.';
        case CreateTransferError.exists_with_different_amount:
            return 'The transfer already exists with a different amount.';
        case CreateTransferError.exists_with_different_code:
            return 'The transfer already exists with a different code.';
        case CreateTransferError.exists_with_different_flags:
            return 'The transfer already exists with different flags.';
        case CreateTransferError.exists_with_different_ledger:
            return 'The transfer already exists with a different ledger.';
        case CreateTransferError.exists_with_different_user_data_128:
        case CreateTransferError.exists_with_different_user_data_64:
        case CreateTransferError.exists_with_different_user_data_32:
            return 'The transfer already exists with different user data.';
        case CreateTransferError.flags_are_mutually_exclusive:
            return 'The transfer flags are mutually exclusive.';
        case CreateTransferError.timestamp_must_be_zero:
            return 'The transfer timestamp must be zero.';
        case CreateTransferError.id_already_failed:
            return 'A transfer with the same ID has already failed.';
        case CreateTransferError.overflows_credits:
            return 'The transfer would cause the credits on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_debits:
            return 'The transfer would cause the debits on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_credits_pending:
            return 'The transfer would cause the credits pending on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_debits_pending:
            return 'The transfer would cause the debits pending on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_credits_posted:
            return 'The transfer would cause the credits posted on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_debits_posted:
            return 'The transfer would cause the debits posted on the account to overflow a 128-bit unsigned int.';
        case CreateTransferError.overflows_timeout:
            return 'The transfer would cause the timeout on the account to overflow a 64-bit unsigned int.';
        default:
            return 'An unknown error occurred.';
    }
}

export function getFlagsForTransferCode(code: TransferCodes): TransferFlags {
    return TransferFlags.none;
}

export function processErrors<
    T extends CreateAccountsError | CreateTransfersError
>(
    results: T[],
    ignoreCodes: T['result'][],
    getMessage: (code: T['result']) => string
): Result<void, SimpleError> {
    let hasError = false;
    for (let result of results) {
        if (
            result.result !== CreateAccountError.ok &&
            ignoreCodes.indexOf(result.result) < 0
        ) {
            hasError = true;
            console.error(getMessage(result.result));
        }
    }

    if (hasError) {
        return failure({
            errorCode: 'server_error',
            errorMessage: 'A server error occurred.',
        });
    }

    return success();
}

export function processAccountErrors(
    results: CreateAccountsError[],
    getMessage: (code: CreateAccountError) => string = () => ''
): Result<void, SimpleError> {
    return processErrors(
        results,
        [CreateAccountError.exists],
        (err) =>
            `${getMessage(err)}: ${getMessageForAccountError(err)} (${err})`
    );
}

export function processTransferErrors(
    results: CreateTransfersError[],
    getMessage: (code: CreateTransferError) => string = () => ''
): Result<void, SimpleError> {
    return processErrors(
        results,
        [CreateTransferError.exists],
        (err) =>
            `${getMessage(err)}: ${getMessageForTransferError(err)} (${err})`
    );
}
