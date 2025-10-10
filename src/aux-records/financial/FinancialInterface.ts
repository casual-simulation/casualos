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
import type {
    Result,
    ServerError,
    MultiError,
} from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';
import type {
    Account,
    AccountBalance,
    AccountFilter,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from 'tigerbeetle-node';
import { CreateTransferError, TransferFlags } from 'tigerbeetle-node';
import { AccountFlags, CreateAccountError } from 'tigerbeetle-node';

export type Ledgers = (typeof LEDGERS)[keyof typeof LEDGERS];

export const AMOUNT_MAX: bigint = 340282366920938463463374607431768211455n; // 2^128 - 1

/**
 * The map of currencies to ledger IDs that the system uses.
 */
export const LEDGERS = {
    /**
     * The ID of the ledger for transactions denominated in USD.
     * The big difference between this and credits is we allow payouts in USD to external services (e.g. Stripe, PayPal, etc.).
     */
    usd: 1,

    /**
     * The ID of the ledger for transactions denominated in credits (internal-use currency for in-store-credit - has a 1,000,000:1 mapping with USD).
     */
    credits: 2,
};

export const CurrencyCodes = {
    /**
     * The currency code for USD.
     */
    usd: 'usd',

    /**
     * The currency code for USD.
     */
    credits: 'credits',
};

/**
 * The map of ledger IDs to their currency codes.
 */
export const CURRENCIES = new Map<LedgersType, CurrencyCodesType>([
    [LEDGERS.credits, 'credits'],
    [LEDGERS.usd, 'usd'],
]);

export type LedgersType = (typeof LEDGERS)[keyof typeof LEDGERS];
export type CurrencyCodesType = keyof typeof CurrencyCodes;

/**
 * The conversion rate from USD to credits.
 * 1 USD = 1,000,000 credits.
 */
export const USD_TO_CREDITS = 1000000n; // 1 USD = 1,000,000 credits

/**
 * The factor for displaying credits to users.
 *
 * This is the number of credits that make up one credit to be displayed to users.
 *
 * For example, if the factor is 1,000,000, then 1 display credit = 1,000,000 credits.
 */
export const CREDITS_DISPLAY_FACTOR = USD_TO_CREDITS * 100n; // 1 display credit = 1,000,000,000 credits

/**
 * The factor for displaying USD to users.
 */
export const USD_DISPLAY_FACTOR = 100; // 1 display USD = 100 cents

/**
 * The exchange rates between ledgers.
 */
export const LEDGER_EXCHANGE_RATES = new Map<
    LedgersType,
    Map<LedgersType, bigint>
>([
    [
        LEDGERS.usd,
        new Map([
            [LEDGERS.credits, USD_TO_CREDITS], // 1 Credits = 1,000,000 USD
        ]),
    ],
]);
// export const CURRENCY_EXCHANGE_RATES = new Map<CurrencyCodesType, Map<CurrencyCodesType, bigint>>();

// for(const [fromLedger, rates] of LEDGER_EXCHANGE_RATES.entries()) {
//     const fromCurrency = CURRENCIES.get(fromLedger);
//     if (fromCurrency) {
//         const toRates = new Map<CurrencyCodesType, bigint>();
//         for (const [toLedger, rate] of rates.entries()) {
//             const toCurrency = CURRENCIES.get(toLedger);
//             if (toCurrency) {
//                 toRates.set(toCurrency, rate);
//             }
//         }
//         CURRENCY_EXCHANGE_RATES.set(fromCurrency, toRates);
//     }
// }

/**
 * Gets the currency code for the given account.
 * @param account The account to get the currency code for.
 */
export function getAccountCurrency(account: Account): CurrencyCodesType {
    return CURRENCIES.get(account.ledger);
}

/**
 * Defines the structure of a converted currency value.
 */
export interface ConvertedCurrency {
    /**
     * The value in the target currency.
     */
    value: bigint;

    /**
     * The remainder of the conversion.
     * This is the amount that could not be converted due to the conversion rate.
     */
    remainder: bigint;

    /**
     * The rate that was used for the conversion.
     *
     * value = from / rate;
     */
    rate: bigint;
}

/**
 * Converts a value between two ledgers.
 * @param from The ledger to convert from.
 * @param to The ledger to convert to.
 * @param value The value to convert.
 */
export function convertBetweenLedgers(
    from: LedgersType,
    to: LedgersType,
    value: bigint
): ConvertedCurrency | null {
    let rate = getExchangeRate(from, to);
    if (rate) {
        return {
            value: value * rate,
            remainder: 0n,
            rate,
        };
    } else {
        rate = getExchangeRate(to, from);
        return {
            value: value / rate,
            remainder: value % rate,
            rate,
        };
    }
}

/**
 * Gets the exchange rate between two ledgers.
 * Returns null if the exchange rate is not defined.
 * @param fromLedger The ledger to convert from.
 * @param toLedger The ledger to convert to.
 */
export function getExchangeRate(
    fromLedger: LedgersType,
    toLedger: LedgersType
): bigint | null {
    if (fromLedger === toLedger) {
        return 1n;
    }
    const rates = LEDGER_EXCHANGE_RATES.get(fromLedger);
    if (!rates) {
        return null;
    }

    const rate = rates.get(toLedger);
    if (!rate) {
        return null;
    }

    return rate;
}

/**
 * Account IDs for built-in accounts.
 */
export const ACCOUNT_IDS = {
    /**
     * The ID of the USD SETUP control account.
     *
     * Used for implementing some transaction patterns like (multiple debits, single credit, balancing debits).
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    USD_SETUP: 9999n,

    /**
     * The ID of the USD debit LIMIT control account.
     *
     * Helper account for setting custom limits on the number of debits that can be proceessed in a transaction.
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    USD_LIMIT_DEBITS: 9998n,

    /**
     * The ID of the USD credit LIMIT control account.
     *
     * Helper account for setting custom limits on the number of credits that can be proceessed in a transaction.
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    USD_LIMIT_CREDITS: 9997n,

    /**
     * The ID of the Credits SETUP control account.
     *
     * Used for implementing some transaction patterns like (multiple debits, single credit, balancing debits).
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    CREDITS_SETUP: 9996n,

    /**
     * The ID of the Credits debit LIMIT control account.
     *
     * Helper account for setting custom limits on the number of debits that can be proceessed in a transaction.
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    CREDITS_LIMIT_DEBITS: 9995n,

    /**
     * The ID of the Credits credit LIMIT control account.
     *
     * Helper account for setting custom limits on the number of credits that can be proceessed in a transaction.
     *
     * See https://docs.tigerbeetle.com/coding/recipes/multi-debit-credit-transfers/
     */
    CREDITS_LIMIT_CREDITS: 9994n,

    /**
     * The ID of the cash assets account.
     *
     * Used for tracking cash in the system (e.g. manual payments/transfers).
     * Compare this to other accounts which track automatic payments (e.g. Stripe).
     */
    assets_cash: 1001n,

    /**
     * The ID of the stripe asset account.
     *
     * Used for tracking money that was transferred to the system via Stripe.
     */
    assets_stripe: 1002n,

    /**
     * The ID of the platform fees revenue account.
     */
    revenue_xp_platform_fees: 4101n,

    /**
     * The ID of the store platform fees revenue account.
     */
    revenue_store_platform_fees: 4102n,

    /**
     * The ID of the USD liquidity account.
     */
    liquidity_usd: 6001n,

    /**
     * The ID of the credits liquidity account.
     */
    liquidity_credits: 6002n,
};

/**
 * A map of built-in account IDs to their names.
 */
export const ACCOUNT_NAMES = new Map<bigint, string>([
    [ACCOUNT_IDS.assets_cash, 'Cash'],
    [ACCOUNT_IDS.assets_stripe, 'Stripe'],
    [ACCOUNT_IDS.revenue_xp_platform_fees, 'XP Platform Fees'],
    [ACCOUNT_IDS.revenue_store_platform_fees, 'Store Platform Fees'],
    [ACCOUNT_IDS.liquidity_credits, 'Credits'],
    [ACCOUNT_IDS.liquidity_usd, 'USD'],
]);

export function getLiquidityAccountByLedger(
    ledger: (typeof LEDGERS)[keyof typeof LEDGERS]
) {
    switch (ledger) {
        case LEDGERS.usd:
            return ACCOUNT_IDS.liquidity_usd;
        case LEDGERS.credits:
            return ACCOUNT_IDS.liquidity_credits;
        default:
            throw new Error(`Unknown ledger: ${ledger}`);
    }
}

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
 * * * * [4101] revenue from xp platform fees
 * * [5000] expenses
 * * [6000] Liquidity
 */
export enum AccountCodes {
    /**
     * Accounts for helping control transactions and transfers.
     */
    control = 1,

    /**
     * Cash accounts for the system
     */
    assets_cash = 1001, // flags.credits_must_not_exceed_debits

    /**
     * liabilities held by users.
     */
    liabilities_user = 2101, // flags.debits_must_not_exceed_credits

    /**
     * liabilities held by studios.
     */
    liabilities_studio = 2102, // flags.debits_must_not_exceed_credits

    /**
     * liabilities held by contracts.
     */
    liabilities_contract = 2103, // flags.debits_must_not_exceed_credits

    /**
     * Revenue accounts from platform fees.
     */
    revenue_platform_fees = 4101, // flags.debits_must_not_exceed_credits

    /**
     * Liquidity pool account for currency exchanges.
     */
    liquidity_pool = 6001,
}

/**
 * Standards for transfer codes from the systems perspective.
 * * [0000] <1000's class> Administrative transfers and reversals.
 * * [1000] <1000's class> General transfers
 * * [2000] <1000's class> XP exchange activities
 * * [3000] <1000's class> Store activities
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
     * A administrative credit to an account from the system.
     */
    admin_credit = 3,

    /**
     * A administrative debit to an account from the system.
     */
    admin_debit = 4,

    /**
     * A currency exchange transfer.
     */
    exchange = 5,

    /**
     * A transfer to help control transactions and transfers.
     */
    control = 6,

    /**
     * A transfer that closes an account.
     */
    account_closing = 7,

    /**
     * A credit to a user's account based on the purchase of credits.
     * This generally functions as a top-up of the user's account and corresponds to a debit from an assets account.
     */
    purchase_credits = 1000,

    /**
     * A debit from a user's account to redeem credits to an external payment source.
     * This generally functions as a payout to the user and corresponds to a credit to an assets account.
     */
    user_payout = 1001,

    /**
     * A credit to a contract account from a user and a corresponding debit from the corresponding payment source.
     * This is used to fund a contract.
     */
    contract_payment = 2000,

    /**
     * A credit to a users account and a corresponding debit from the contract account.
     * This is used to pay out a contract.
     */
    invoice_payment = 2001,

    /**
     * A credit to the equity account and a debit from the corresponding payment source.
     * In the XP Exchange, sponsors always pay platform fees.
     */
    xp_platform_fee = 2002,

    /**
     * A credit to a user account and a corresponding closing debit from the contract account.
     */
    contract_refund = 2003,

    /**
     * A credit to the seller's account and a corresponding debit from the payment source.
     * This is used when a user purchases an item from a store.
     */
    item_payment = 3000,

    /**
     * A credit to the equity account and a debit from the corresponding payment source.
     * This is used when a user purchases an item from the store and the platform takes a fee.
     */
    store_platform_fee = 3003,

    // /**
    //  * A credit to the user from external entities (e.g. deposit to system via stripe / balance reload)
    //  */
    // external_credits_user = 1101,

    // /**
    //  * A credit to a contract from a user
    //  */
    // user_credits_contract = 1200,

    // /**
    //  * A debit to the user from the system.
    //  */
    // system_debits_user = 2000,

    // /**
    //  * A debit to a user from external entities (e.g. withdrawal from system via stripe / payout)
    //  */
    // external_debits_user = 2100,

    // /**
    //  * A debit to a contract from a user
    //  */
    // user_debits_contract = 2200,
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
            return (
                AccountFlags.credits_must_not_exceed_debits |
                AccountFlags.history
            );
        case AccountCodes.liabilities_user:
        case AccountCodes.liabilities_studio:
        case AccountCodes.liabilities_contract:
        case AccountCodes.revenue_platform_fees:
            return (
                AccountFlags.debits_must_not_exceed_credits |
                AccountFlags.history
            );
        case AccountCodes.liquidity_pool:
            return AccountFlags.none;
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

export function getCodeForAccountError(
    error: CreateAccountError
): AccountError['errorCode'] {
    switch (error) {
        case CreateAccountError.code_must_not_be_zero:
            return 'code_must_not_be_zero';
        case CreateAccountError.credits_pending_must_be_zero:
            return 'credits_pending_must_be_zero';
        case CreateAccountError.debits_pending_must_be_zero:
            return 'debits_pending_must_be_zero';
        case CreateAccountError.credits_posted_must_be_zero:
            return 'credits_posted_must_be_zero';
        case CreateAccountError.debits_posted_must_be_zero:
            return 'debits_posted_must_be_zero';
        case CreateAccountError.exists:
            return 'exists';
        case CreateAccountError.exists_with_different_code:
            return 'exists_with_different_code';
        case CreateAccountError.exists_with_different_flags:
            return 'exists_with_different_flags';
        case CreateAccountError.exists_with_different_ledger:
            return 'exists_with_different_ledger';
        case CreateAccountError.exists_with_different_user_data_128:
        case CreateAccountError.exists_with_different_user_data_64:
        case CreateAccountError.exists_with_different_user_data_32:
            return 'exists_with_different_user_data';
        case CreateAccountError.flags_are_mutually_exclusive:
            return 'flags_are_mutually_exclusive';
        case CreateAccountError.timestamp_must_be_zero:
            return 'timestamp_must_be_zero';
        default:
            return 'server_error';
    }
}

export function getMessageForTransferError(error: CreateTransferError) {
    switch (error) {
        case CreateTransferError.code_must_not_be_zero:
            return 'The transfer code must not be zero.';
        case CreateTransferError.accounts_must_be_different:
            return 'The transfer accounts must be different.';
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
        case CreateTransferError.transfer_must_have_the_same_ledger_as_accounts:
            return 'The transfer must have the same ledger as the accounts.';
        case CreateTransferError.linked_event_failed:
            return 'The linked event for the transfer failed.';
        case CreateTransferError.pending_transfer_not_pending:
            return 'The pending transfer was not pending.';
        default:
            return `An unknown error occurred (${error}).`;
    }
}

export function getCodeForTransferError(
    error: CreateTransferError
): InterfaceTransferError['errorCode'] {
    switch (error) {
        case CreateTransferError.code_must_not_be_zero:
            return 'code_must_not_be_zero';
        case CreateTransferError.accounts_must_be_different:
            return 'accounts_must_be_different';
        case CreateTransferError.accounts_must_have_the_same_ledger:
            return 'accounts_must_have_the_same_ledger';
        case CreateTransferError.closing_transfer_must_be_pending:
            return 'closing_transfer_must_be_pending';
        case CreateTransferError.credit_account_already_closed:
            return 'credit_account_already_closed';
        case CreateTransferError.debit_account_already_closed:
            return 'debit_account_already_closed';
        case CreateTransferError.credit_account_not_found:
            return 'credit_account_not_found';
        case CreateTransferError.debit_account_not_found:
            return 'debit_account_not_found';
        case CreateTransferError.exceeds_credits:
            return 'exceeds_credits';
        case CreateTransferError.exceeds_debits:
            return 'exceeds_debits';
        case CreateTransferError.exists:
        case CreateTransferError.exceeds_pending_transfer_amount:
        case CreateTransferError.exists_with_different_amount:
        case CreateTransferError.exists_with_different_code:
        case CreateTransferError.exists_with_different_flags:
        case CreateTransferError.exists_with_different_ledger:
        case CreateTransferError.exists_with_different_user_data_128:
        case CreateTransferError.exists_with_different_user_data_64:
        case CreateTransferError.exists_with_different_user_data_32:
            return 'exists';
        case CreateTransferError.flags_are_mutually_exclusive:
            return 'flags_are_mutually_exclusive';
        case CreateTransferError.timestamp_must_be_zero:
            return 'timestamp_must_be_zero';
        case CreateTransferError.id_already_failed:
            return 'id_already_failed';
        case CreateTransferError.overflows_credits:
            return 'overflows_credits';
        case CreateTransferError.overflows_debits:
            return 'overflows_debits';
        case CreateTransferError.overflows_credits_pending:
            return 'overflows_credits_pending';
        case CreateTransferError.overflows_debits_pending:
            return 'overflows_debits_pending';
        case CreateTransferError.overflows_credits_posted:
            return 'overflows_credits_posted';
        case CreateTransferError.overflows_debits_posted:
            return 'overflows_debits_posted';
        case CreateTransferError.overflows_timeout:
            return 'overflows_timeout';
        case CreateTransferError.pending_transfer_already_posted:
            return 'already_posted';
        case CreateTransferError.pending_transfer_already_voided:
            return 'already_voided';
        default:
            return 'server_error';
    }
}

export function getFlagsForTransferCode(code: TransferCodes): TransferFlags {
    return TransferFlags.none;
}

export type AccountError = {
    errorCode:
        | ServerError
        | 'code_must_not_be_zero'
        | 'credits_pending_must_be_zero'
        | 'debits_pending_must_be_zero'
        | 'credits_posted_must_be_zero'
        | 'debits_posted_must_be_zero'
        | 'exists'
        | 'exists_with_different_code'
        | 'exists_with_different_flags'
        | 'exists_with_different_ledger'
        | 'exists_with_different_user_data'
        | 'flags_are_mutually_exclusive'
        | 'timestamp_must_be_zero';
    errorMessage: string;
    error: CreateAccountError;
};

export interface InterfaceTransferError {
    errorCode:
        | ServerError
        | 'code_must_not_be_zero'
        | 'accounts_must_be_different'
        | 'amount_must_not_be_zero'
        | 'accounts_must_have_the_same_ledger'
        | 'closing_transfer_must_be_pending'
        | 'credit_account_already_closed'
        | 'debit_account_already_closed'
        | 'already_posted'
        | 'already_voided'
        | 'credit_account_not_found'
        | 'debit_account_not_found'
        | 'exceeds_credits'
        | 'exceeds_debits'
        | 'exceeds_pending_transfer_amount'
        | 'exists'
        | 'flags_are_mutually_exclusive'
        | 'timestamp_must_be_zero'
        | 'id_already_failed'
        | 'overflows_credits'
        | 'overflows_debits'
        | 'overflows_credits_pending'
        | 'overflows_debits_pending'
        | 'overflows_credits_posted'
        | 'overflows_debits_posted'
        | 'overflows_timeout';

    errorMessage: string;
    error: CreateTransferError;
    transfer: Transfer;
}

export function processAccountErrors(
    results: CreateAccountsError[]
): Result<void, MultiError<AccountError>> {
    let errors: AccountError[] = [];
    for (let result of results) {
        if (result.result !== CreateAccountError.ok) {
            errors.push({
                errorCode: getCodeForAccountError(result.result),
                errorMessage: getMessageForAccountError(result.result),
                error: result.result,
            });
        }
    }

    if (errors.length > 0) {
        return failure({
            errorCode: 'multi_error',
            errorMessage: 'Multiple errors occurred.',
            errors,
        });
    }

    return success();
}

export function processTransferErrors(
    results: CreateTransfersError[],
    transfers: Transfer[]
): Result<void, MultiError<InterfaceTransferError>> {
    let errors: InterfaceTransferError[] = [];
    for (let result of results) {
        if (result.result !== CreateTransferError.ok) {
            const transfer = transfers[result.index];
            errors.push({
                errorCode: getCodeForTransferError(result.result),
                errorMessage: `[transferId: ${transfer.id}, debitAccountId: ${
                    transfer.debit_account_id
                }, creditAccountId: ${transfer.credit_account_id}, code: ${
                    transfer.code
                }] ${getMessageForTransferError(result.result)}`,
                error: result.result,
                transfer: transfer,
            });
        }
    }

    if (errors.length > 0) {
        return failure({
            errorCode: 'multi_error',
            errorMessage: 'Multiple errors occurred.',
            errors,
        });
    }

    return success();
}
