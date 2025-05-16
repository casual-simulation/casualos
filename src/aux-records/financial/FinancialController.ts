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
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import {
    failure,
    isFailure,
    logErrors,
    success,
} from '@casual-simulation/aux-common';
import {
    ACCOUNT_IDS,
    AccountCodes,
    getFlagsForAccountCode,
    getMessageForAccountError,
    LEDGERS,
    processAccountErrors,
    type FinancialInterface,
} from './FinancialInterface';
import type { Account, CreateTransferError } from './Types';
import { CreateAccountError } from './Types';

export class FinancialController {
    private _financialInterface: FinancialInterface;
    private _idempotentKeyMaxAgeMS = 3600000; // 1 hour

    constructor(financialInterface: FinancialInterface) {
        this._financialInterface = financialInterface;
    }

    async init(): Promise<Result<void, SimpleError>> {
        // Ensure that the financial interface has the correct accounts
        const results = await this._financialInterface.createAccounts([
            {
                id: ACCOUNT_IDS.stripe_assets,
                code: AccountCodes.assets_cash,
                flags: getFlagsForAccountCode(AccountCodes.assets_cash),
                credits_pending: 0n,
                credits_posted: 0n,
                debits_pending: 0n,
                debits_posted: 0n,
                user_data_128: 0n,
                user_data_64: 0n,
                user_data_32: 0,
                timestamp: 0n,
                ledger: LEDGERS.usd,
                reserved: 0,
            },
        ]);

        let failed = false;
        for (let result of results) {
            if (result.result !== CreateAccountError.ok) {
                console.error(
                    `[FinancialController] Failed to create default accounts (${result.index},${result.result})`,
                    getMessageForAccountError(result.result)
                );
                failed = true;
            }
        }

        if (failed) {
            return failure({
                errorCode: 'server_error',
                errorMessage: 'Failed to create default accounts.',
            });
        } else {
            return success();
        }
    }

    /**
     * Creates a new account with the given code.
     * For internal use only.
     * @param code The code for the new account.
     */
    async createAccount(
        code: AccountCodes
    ): Promise<CreateFinancialAccountResult> {
        const id = this._financialInterface.generateId();
        const results = await this._financialInterface.createAccount({
            id: id,
            code: code,
            flags: getFlagsForAccountCode(code),
            credits_pending: 0n,
            credits_posted: 0n,
            debits_pending: 0n,
            debits_posted: 0n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            timestamp: 0n,
            ledger: LEDGERS.usd,
            reserved: 0,
        });

        const accountErrors = processAccountErrors(results);

        if (isFailure(accountErrors)) {
            logErrors(
                accountErrors.error,
                '[FinancialController] [createAccount]'
            );
            return failure({
                errorCode: 'server_error',
                errorMessage: 'Failed to create account.',
            });
        }

        return success({
            id,
        });
    }

    async getAccount(
        accountId: bigint | string
    ): Promise<GetFinancialAccountResult> {
        if (typeof accountId === 'string') {
            accountId = BigInt(accountId);
        }
        const [account] = await this._financialInterface.lookupAccounts([
            accountId,
        ]);

        if (!account) {
            return failure({
                errorCode: 'not_found',
                errorMessage: `Account with id ${accountId} not found.`,
            });
        }

        return success({
            account,
        });
    }

    // /**
    //  * Filters errors in the list returning all errors that are not ok
    //  * @param errors The list of create transfer errors to filter
    //  */
    // private _filterOkCreateTransfersError(
    //     errors: CreateTransfersError[]
    // ): GenuineCreateTransfersError[] {
    //     const filteredErrors: GenuineCreateTransfersError[] = [];
    //     for (const error of errors) {
    //         if (error.result !== CreateTransferError.ok) {
    //             filteredErrors.push(error);
    //         }
    //     }
    //     return filteredErrors;
    // }

    // /**
    //  * Check if the idempotency key is valid (as it is typically provided by the client)
    //  * @param idempotencyKey The idempotency key to validate.
    //  */
    // private _validateIdempotencyKey(
    //     idempotencyKey: bigint
    // ): SuccessResult | FailedResult {
    //     //? Max idempotencyKey >= 2n ** 128n - 2n (reserve - 1n for tigerbeetle)
    //     if (
    //         idempotencyKey === null ||
    //         idempotencyKey <= 0n ||
    //         idempotencyKey >= 340282366920938463463374607431768211455n
    //     ) {
    //         return {
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage:
    //                 'Idempotency key must be a positive integer which is less than 2^128 - 1',
    //         };
    //     }

    //     /**
    //      * ? In the future we may enforce tigerbeetle's recommended 128-bit idempotency key?
    //      * * See https://docs.tigerbeetle.com/coding/data-modeling/#tigerbeetle-time-based-identifiers-recommended
    //      */

    //     return {
    //         success: true,
    //     };
    // }

    // /**
    //  * Generate an account (user or contract) configured for the given currency
    //  * * Will link all accounts in their creation to provide atomicity
    //  * @param accountConf The configuration for the account
    //  */
    // public async generateAccounts(accounts: GenAccountConfig[]): Promise<{
    //     ids: Account['id'][][];
    //     /**
    //      * Any genuine errors that occurred during account generation
    //      * * The financial interface will return ok as an error if the account was created successfully
    //      * * This implementation aims to remove the default ok error from the list as it is not a genuine error
    //      */
    //     errors: CreateAccountsError[];
    // }> {
    //     const _accounts: Account[] = [];
    //     const idArray = accounts.map((account) => {
    //         const subIdArray = [];
    //         const flags = (account.flags ?? 0) | AccountFlags.linked;
    //         for (let i = 0; i < account.quantity; i++) {
    //             const id = this._financialInterface.generateId();
    //             _accounts.push({
    //                 id,
    //                 debits_pending: 0n,
    //                 debits_posted: 0n,
    //                 credits_pending: 0n,
    //                 credits_posted: 0n,
    //                 user_data_128: 0n,
    //                 user_data_64: 0n,
    //                 user_data_32: 0,
    //                 reserved: 0,
    //                 ledger: 1,
    //                 code: account.accountCode,
    //                 flags: flags,
    //                 timestamp: 0n,
    //             });
    //             subIdArray.push(id);
    //         }
    //         return subIdArray;
    //     });
    //     _accounts[_accounts.length - 1].flags &= ~AccountFlags.linked;
    //     const interfaceErrors = await this._financialInterface.createAccounts(
    //         _accounts
    //     );
    //     const errors = [];
    //     for (let i = 0; i < interfaceErrors.length; i++) {
    //         if (interfaceErrors[i].result !== CreateAccountError.ok) {
    //             errors.push(interfaceErrors[i]);
    //         }
    //     }
    //     return {
    //         ids: idArray,
    //         errors,
    //     };
    // }

    // /**
    //  * Niche account generation process
    //  * * Useful for generating accounts (multiple of any type) in a batch where some may fail.
    //  * @param config The configuration for the accounts to generate
    //  * @returns The ids of the accounts generated or the result of the onFail callback
    //  */
    // public async nicheAccountGen(config: {
    //     /** The configuration for each type of account to generate (quantity inclusive) */
    //     accounts: GenAccountConfig[];
    //     /** The callback to run if errors occur in account generation */
    //     onFail: (errors: CreateAccountsError[]) => any;
    // }) {
    //     const { ids, errors } = await this.generateAccounts(config.accounts);
    //     if (errors.length) {
    //         return config.onFail(errors);
    //     }
    //     return ids;
    // }

    // /**
    //  * Gets the account with the given id
    //  * @param accountId The id of the account to get
    //  */
    // public async getAccount(accountId: Account['id']): Promise<Account> {
    //     return (await this._financialInterface.lookupAccounts([accountId]))[0];
    // }

    // public async createIdempotentTransfer(
    //     transfer: {
    //         debit: Account['id'];
    //         credit: Account['id'];
    //         amount: bigint;
    //         code: TransferCodes;
    //     },
    //     idempotencyKey: bigint
    // ): Promise<
    //     | SuccessResult
    //     | ActionResult_T<
    //           false,
    //           { createTransfersErrors: GenuineCreateTransfersError[] }
    //       >
    //     | FailedResult
    // > {
    //     const idempotencyKeyResult =
    //         this._validateIdempotencyKey(idempotencyKey);
    //     if (idempotencyKeyResult.success === false) {
    //         return idempotencyKeyResult;
    //     }
    //     const createTransfersErrors = this._filterOkCreateTransfersError(
    //         await this._financialInterface.createTransfers([
    //             {
    //                 id: idempotencyKey,
    //                 debit_account_id: transfer.debit,
    //                 credit_account_id: transfer.credit,
    //                 amount: transfer.amount,
    //                 pending_id: 0n,
    //                 user_data_128: 0n,
    //                 user_data_64: 0n,
    //                 user_data_32: 0,
    //                 timeout: 0,
    //                 ledger: 1,
    //                 code: transfer.code,
    //                 timestamp: 0n,
    //                 flags: 0,
    //             },
    //         ])
    //     );

    //     if (createTransfersErrors.length === 0) {
    //         return {
    //             success: true,
    //         };
    //     }

    //     return {
    //         success: false,
    //         createTransfersErrors,
    //     };
    // }
}

/**
 * Gets the balance of the given user account.
 * @param account The account to get the balance of.
 */
export function getUserAccountBalance(account: Account): number {
    return Number(account.credits_posted - account.debits_posted);
}

interface GenAccountConfig {
    /**
     * The code associated with the type of account(s) to generate.
     */
    accountCode: AccountCodes;
    /**
     * The number of accounts of this configuration to generate.
     * * Useful when creating user and contract accounts in one go.
     */
    quantity: number;
    /**
     * The flags to set on the account(s).
     * * Defaults to 0.
     */
    flags?: number;
}

type AccountType = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

/**
 * Errors that are both nominally and logically errors
 * * * These errors are those which aren't false assertions / paradoxical (like ok as an error)
 */
type GenuineCreateTransferError = Omit<
    CreateTransferError,
    CreateTransferError.ok
>;
type GenuineCreateTransfersError = {
    index: number;
    result: GenuineCreateTransferError;
};

export type CreateFinancialAccountResult = Result<
    {
        /**
         * The ID of the account that was created.
         */
        id: bigint;
    },
    SimpleError
>;

export type GetFinancialAccountResult = Result<
    {
        account: Account;
    },
    SimpleError
>;
