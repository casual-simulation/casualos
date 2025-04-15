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
import { cloneDeep } from 'lodash';
import type { FinancialInterface } from './financial/FinancialInterface';
import { AccountCodes } from './financial/FinancialInterface';
import type {
    Account,
    AccountBalance,
    AccountFilter,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from './financial/Types';
import {
    AccountFlags,
    CreateAccountError,
    CreateTransferError,
    TransferFlags,
} from './financial/Types';

/**
 * The max bigint tigerbeetle can handle. 2^128 - 1 is reserved.
 */
const MAX_BIGINT_128 = BigInt('340282366920938463463374607431768211454');

export class MemoryFinancialInterface implements FinancialInterface {
    private _accounts: Map<Account['id'], Account> = new Map();
    private _transfers: Transfer[] = [];
    private _currentId = 0n;

    private _validateAccount(account: Account): CreateAccountError {
        if (this._accounts.has(account.id)) {
            return CreateAccountError.exists;
        } else if (account.id === 0n) {
            return CreateAccountError.id_must_not_be_zero;
        } else if (account.code > MAX_BIGINT_128) {
            return CreateAccountError.id_must_not_be_int_max;
        } else if (
            account.timestamp !== 0n &&
            account.flags & AccountFlags.imported
        ) {
            return CreateAccountError.timestamp_must_be_zero;
        } else {
            return CreateAccountError.ok;
        }

        // TODO: Add more validation
    }

    private _validateTransfer(transfer: Transfer): CreateTransferError {
        /**
         * * Format and convention validation
         */
        if (transfer.id === 0n) {
            return CreateTransferError.id_must_not_be_zero;
        }
        if (transfer.id > MAX_BIGINT_128) {
            return CreateTransferError.id_must_not_be_int_max;
        }
        const existingTransfer = this._transfers.find(
            (t) => t.id === transfer.id
        );
        if (existingTransfer) {
            if (existingTransfer.flags !== transfer.flags) {
                return CreateTransferError.exists_with_different_flags;
            }
            if (existingTransfer.pending_id !== transfer.pending_id) {
                return CreateTransferError.exists_with_different_pending_id;
            }
            if (existingTransfer.timeout !== transfer.timeout) {
                return CreateTransferError.exists_with_different_timeout;
            }
            if (
                existingTransfer.debit_account_id !== transfer.debit_account_id
            ) {
                return CreateTransferError.exists_with_different_debit_account_id;
            }
            if (
                existingTransfer.credit_account_id !==
                transfer.credit_account_id
            ) {
                return CreateTransferError.exists_with_different_credit_account_id;
            }
            if (existingTransfer.user_data_128 !== transfer.user_data_128) {
                return CreateTransferError.exists_with_different_user_data_128;
            }
            if (existingTransfer.user_data_64 !== transfer.user_data_64) {
                return CreateTransferError.exists_with_different_user_data_64;
            }
            if (existingTransfer.user_data_32 !== transfer.user_data_32) {
                return CreateTransferError.exists_with_different_user_data_32;
            }
            if (existingTransfer.ledger !== transfer.ledger) {
                return CreateTransferError.exists_with_different_ledger;
            }
            if (existingTransfer.code !== transfer.code) {
                return CreateTransferError.exists_with_different_code;
            }
            if (existingTransfer.amount !== transfer.amount) {
                if (existingTransfer.flags & TransferFlags.balancing_debit) {
                    // TODO: Implement balancing debit logic
                } else if (
                    existingTransfer.flags & TransferFlags.balancing_credit
                ) {
                    // TODO: Implement balancing credit logic
                } else if (
                    existingTransfer.flags & TransferFlags.post_pending_transfer
                ) {
                    // TODO: Implement post pending transfer logic
                } else {
                    return CreateTransferError.exists_with_different_amount;
                }
            }
        }

        /**
         * * Existential validation
         * 1. Credit account must exist
         * 2. Debit account must exist
         */
        let creditAccount = this._accounts.get(transfer.credit_account_id);
        let debitAccount = this._accounts.get(transfer.debit_account_id);
        if (
            transfer.flags & TransferFlags.void_pending_transfer ||
            transfer.flags & TransferFlags.post_pending_transfer
        ) {
            if (!transfer.pending_id || transfer.pending_id === 0n) {
                return CreateTransferError.pending_id_must_not_be_zero;
            }
            if (transfer.pending_id > MAX_BIGINT_128) {
                return CreateTransferError.pending_id_must_not_be_int_max;
            }
            const pendingTransfer =
                this._transfers[
                    this._transfers.findIndex(
                        (t) => t.id === transfer.pending_id
                    )
                ];
            if (!pendingTransfer) {
                return CreateTransferError.pending_transfer_not_found;
            }
            if (pendingTransfer.flags & TransferFlags.pending) {
                return CreateTransferError.pending_transfer_not_pending;
            }
            if (pendingTransfer.flags & TransferFlags.void_pending_transfer) {
                return CreateTransferError.pending_transfer_already_voided;
            }
            if (pendingTransfer.flags & TransferFlags.post_pending_transfer) {
                return CreateTransferError.pending_transfer_already_posted;
            }

            creditAccount = this._accounts.get(
                pendingTransfer.credit_account_id
            );
            debitAccount = this._accounts.get(pendingTransfer.debit_account_id);
        }
        if (!creditAccount) {
            return CreateTransferError.credit_account_not_found;
        }
        if (!debitAccount) {
            return CreateTransferError.debit_account_not_found;
        }

        /**
         * TODO: Add more validation
         * * Ensure the transfer satisfies the account codes
         * * Ensure the transfer satisfies the flags
         */
    }

    private _performTransfer(transfer: Transfer): CreateTransferError {
        const validation = this._validateTransfer(transfer);
        if (validation !== CreateTransferError.ok) return validation;
        let creditAccount = this._accounts.get(transfer.credit_account_id);
        let debitAccount = this._accounts.get(transfer.debit_account_id);
        if (transfer.flags & TransferFlags.pending) {
            creditAccount.credits_pending += transfer.amount;
            debitAccount.debits_pending += transfer.amount;
        } else if (transfer.flags & TransferFlags.void_pending_transfer) {
            if (!creditAccount || !debitAccount) {
                const voidTransfer =
                    this._transfers[
                        this._transfers.findIndex(
                            (t) => t.id === transfer.pending_id
                        )
                    ];
                creditAccount = this._accounts.get(
                    voidTransfer.credit_account_id
                );
                debitAccount = this._accounts.get(
                    voidTransfer.debit_account_id
                );
            }
            creditAccount.credits_pending -= transfer.amount;
            debitAccount.debits_pending -= transfer.amount;
        } else if (transfer.flags & TransferFlags.post_pending_transfer) {
            if (!creditAccount || !debitAccount) {
                const postTransfer =
                    this._transfers[
                        this._transfers.findIndex(
                            (t) => t.id === transfer.pending_id
                        )
                    ];
                creditAccount = this._accounts.get(
                    postTransfer.credit_account_id
                );
                debitAccount = this._accounts.get(
                    postTransfer.debit_account_id
                );
            }
            creditAccount.credits_pending -= transfer.amount;
            debitAccount.debits_pending -= transfer.amount;
            creditAccount.credits_posted += transfer.amount;
            debitAccount.debits_posted += transfer.amount;
        } else {
            creditAccount.credits_posted += transfer.amount;
            debitAccount.debits_posted += transfer.amount;
        }
        /**
         * TODO: Continue transfer logic implementation
         * * 1. Route based on if the credits and debits need to be pending or posted
         * * 2. Ensure the transfer satisfies the accounting equation
         */
    }

    generateId = () => {
        return this._currentId++;
    };

    async createAccount(account: Account): Promise<CreateAccountsError[]> {
        const errs = [{ index: 0, result: this._validateAccount(account) }];
        if (errs[0].result === CreateAccountError.ok)
            this._accounts.set(account.id, account);
        return errs;
    }

    async createAccounts(batch: Account[]): Promise<CreateAccountsError[]> {
        return batch.map((account, index) => {
            const error = this._validateAccount(account);
            if (error === CreateAccountError.ok) {
                this._accounts.set(account.id, account);
            }
            return { index, result: error };
        });
    }

    async createTransfers(batch: Transfer[]): Promise<CreateTransfersError[]> {
        const errs: CreateTransfersError[] = [];
        for (let i = 0; i < batch.length; i++) {
            errs.push({
                index: i,
                result: this._validateTransfer(batch[i]),
            });
            if (errs[i].result === CreateTransferError.ok) {
                this._transfers.push(batch[i]);
            }
        }
        return errs;
    }

    async lookupAccounts(batch: Account['id'][]): Promise<Account[]> {
        const accounts: Account[] = [];
        for (const id of batch) {
            const account = this._accounts.get(id);
            if (account) {
                accounts.push(cloneDeep(account));
            }
        }
        return accounts;
    }

    lookupTransfers(batch: Transfer['id'][]): Promise<Transfer[]> {
        throw new Error('Method not implemented.');
    }

    getAccountTransfers(filter: AccountFilter): Promise<Transfer[]> {
        throw new Error('Method not implemented.');
    }

    getAccountBalances(filter: AccountFilter): Promise<AccountBalance[]> {
        throw new Error('Method not implemented.');
    }

    queryAccounts(filter: QueryFilter): Promise<Account[]> {
        throw new Error('Method not implemented.');
    }

    queryTransfers(filter: QueryFilter): Promise<Transfer[]> {
        throw new Error('Method not implemented.');
    }
}
