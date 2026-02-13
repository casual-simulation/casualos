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

import { orderBy } from 'es-toolkit/compat';
import type { FinancialInterface } from './FinancialInterface';
import type {
    Account,
    AccountBalance,
    AccountFilter,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from 'tigerbeetle-node';
import { CreateAccountError } from 'tigerbeetle-node';
import {
    AccountFilterFlags,
    AccountFlags,
    CreateTransferError,
    TransferFlags,
} from 'tigerbeetle-node';
import { cloneDeep } from 'es-toolkit';

/**
 * The max bigint tigerbeetle can handle. 2^128 - 1 is reserved.
 */
const MAX_BIGINT_128 = BigInt('340282366920938463463374607431768211454');

interface MemoryFinancialInterfaceCheckpoint {
    accounts: Map<Account['id'], Account>;
    balances: Map<Account['id'], AccountBalance[]>;
    transfers: Transfer[];
}

export class MemoryFinancialInterface implements FinancialInterface {
    private _accounts: Map<Account['id'], Account> = new Map();
    private _balances: Map<Account['id'], AccountBalance[]> = new Map();
    private _transfers: Transfer[] = [];
    private _currentId = 1n;

    get accounts() {
        return this._accounts;
    }

    get transfers() {
        return this._transfers;
    }

    getCheckpoint(): MemoryFinancialInterfaceCheckpoint {
        return {
            accounts: cloneDeep(this._accounts),
            balances: cloneDeep(this._balances),
            transfers: cloneDeep(this._transfers),
        };
    }

    restoreCheckpoint(checkpoint: MemoryFinancialInterfaceCheckpoint) {
        this._accounts = cloneDeep(checkpoint.accounts);
        this._balances = cloneDeep(checkpoint.balances);
        this._transfers = cloneDeep(checkpoint.transfers);
    }

    now() {
        // now() returns the current time in nanoseconds since the epoch.
        return BigInt(Date.now()) * 1000n;
    }

    // private _validateAccount(account: Account): CreateAccountError {
    //     if (this._accounts.has(account.id)) {
    //         return CreateAccountError.exists;
    //     } else if (account.id === 0n) {
    //         return CreateAccountError.id_must_not_be_zero;
    //     } else if (account.code > MAX_BIGINT_128) {
    //         return CreateAccountError.id_must_not_be_int_max;
    //     } else if (
    //         account.timestamp !== 0n &&
    //         account.flags & AccountFlags.imported
    //     ) {
    //         return CreateAccountError.timestamp_must_be_zero;
    //     } else {
    //         return CreateAccountError.ok;
    //     }

    //     //? Possibly add more validation
    // }

    // private _validateTransfer(transfer: Transfer): CreateTransferError {
    //     /**
    //      * * Format and convention validation
    //      */
    //     if (transfer.id === 0n) {
    //         return CreateTransferError.id_must_not_be_zero;
    //     }
    //     if (transfer.id > MAX_BIGINT_128) {
    //         return CreateTransferError.id_must_not_be_int_max;
    //     }
    //     const existingTransfer = this._transfers.find(
    //         (t) => t.id === transfer.id
    //     );
    //     if (existingTransfer) {
    //         if (existingTransfer.flags !== transfer.flags) {
    //             return CreateTransferError.exists_with_different_flags;
    //         }
    //         if (existingTransfer.pending_id !== transfer.pending_id) {
    //             return CreateTransferError.exists_with_different_pending_id;
    //         }
    //         if (existingTransfer.timeout !== transfer.timeout) {
    //             return CreateTransferError.exists_with_different_timeout;
    //         }
    //         if (
    //             existingTransfer.debit_account_id !== transfer.debit_account_id
    //         ) {
    //             return CreateTransferError.exists_with_different_debit_account_id;
    //         }
    //         if (
    //             existingTransfer.credit_account_id !==
    //             transfer.credit_account_id
    //         ) {
    //             return CreateTransferError.exists_with_different_credit_account_id;
    //         }
    //         if (existingTransfer.user_data_128 !== transfer.user_data_128) {
    //             return CreateTransferError.exists_with_different_user_data_128;
    //         }
    //         if (existingTransfer.user_data_64 !== transfer.user_data_64) {
    //             return CreateTransferError.exists_with_different_user_data_64;
    //         }
    //         if (existingTransfer.user_data_32 !== transfer.user_data_32) {
    //             return CreateTransferError.exists_with_different_user_data_32;
    //         }
    //         if (existingTransfer.ledger !== transfer.ledger) {
    //             return CreateTransferError.exists_with_different_ledger;
    //         }
    //         if (existingTransfer.code !== transfer.code) {
    //             return CreateTransferError.exists_with_different_code;
    //         }
    //     }

    //     /**
    //      * * Existential validation
    //      * 1. Credit account must exist
    //      * 2. Debit account must exist
    //      */
    //     let creditAccount = this._accounts.get(transfer.credit_account_id);
    //     let debitAccount = this._accounts.get(transfer.debit_account_id);
    //     if (
    //         transfer.flags & TransferFlags.void_pending_transfer ||
    //         transfer.flags & TransferFlags.post_pending_transfer
    //     ) {
    //         if (!transfer.pending_id || transfer.pending_id === 0n) {
    //             return CreateTransferError.pending_id_must_not_be_zero;
    //         }
    //         if (transfer.pending_id > MAX_BIGINT_128) {
    //             return CreateTransferError.pending_id_must_not_be_int_max;
    //         }
    //         const pendingTransfer =
    //             this._transfers[
    //                 this._transfers.findIndex(
    //                     (t) => t.id === transfer.pending_id
    //                 )
    //             ];
    //         if (!pendingTransfer) {
    //             return CreateTransferError.pending_transfer_not_found;
    //         }
    //         if (pendingTransfer.flags & TransferFlags.pending) {
    //             return CreateTransferError.pending_transfer_not_pending;
    //         }
    //         if (pendingTransfer.flags & TransferFlags.void_pending_transfer) {
    //             return CreateTransferError.pending_transfer_already_voided;
    //         }
    //         if (pendingTransfer.flags & TransferFlags.post_pending_transfer) {
    //             return CreateTransferError.pending_transfer_already_posted;
    //         }
    //         /**
    //          * TODO: Expired pending transfer logic.
    //          * * There doesn't appear to be a way to mark whether an expired transfer has previously been handled.
    //          */
    //         creditAccount = this._accounts.get(
    //             pendingTransfer.credit_account_id
    //         );
    //         debitAccount = this._accounts.get(pendingTransfer.debit_account_id);
    //     }
    //     if (!creditAccount) {
    //         return CreateTransferError.credit_account_not_found;
    //     }
    //     if (!debitAccount) {
    //         return CreateTransferError.debit_account_not_found;
    //     }

    //     /**
    //      *? Possibly add more validation
    //      */
    //     return CreateTransferError.ok;
    // }

    // private _performTransfer(transfer: Transfer): CreateTransferError {
    //     const validation = this._validateTransfer(transfer);
    //     if (validation !== CreateTransferError.ok) return validation;
    //     // Gather the accounts
    //     let creditAccount = this._accounts.get(transfer.credit_account_id);
    //     let debitAccount = this._accounts.get(transfer.debit_account_id);
    //     // If pending, contribute to the pending accounts respective balances
    //     if (transfer.flags & TransferFlags.pending) {
    //         creditAccount.credits_pending += transfer.amount;
    //         debitAccount.debits_pending += transfer.amount;
    //     }
    //     // If voiding a pending transfer, remove the pending amount from the accounts
    //     else if (transfer.flags & TransferFlags.void_pending_transfer) {
    //         if (!creditAccount || !debitAccount) {
    //             const voidTransfer =
    //                 this._transfers[
    //                     this._transfers.findIndex(
    //                         (t) => t.id === transfer.pending_id
    //                     )
    //                 ];
    //             creditAccount = this._accounts.get(
    //                 voidTransfer.credit_account_id
    //             );
    //             debitAccount = this._accounts.get(
    //                 voidTransfer.debit_account_id
    //             );
    //         }
    //         creditAccount.credits_pending -= transfer.amount;
    //         debitAccount.debits_pending -= transfer.amount;
    //     }
    //     // If posting a pending transfer, remove the pending amount from the accounts and add to the posted amounts
    //     else if (transfer.flags & TransferFlags.post_pending_transfer) {
    //         if (!creditAccount || !debitAccount) {
    //             const postTransfer =
    //                 this._transfers[
    //                     this._transfers.findIndex(
    //                         (t) => t.id === transfer.pending_id
    //                     )
    //                 ];
    //             creditAccount = this._accounts.get(
    //                 postTransfer.credit_account_id
    //             );
    //             debitAccount = this._accounts.get(
    //                 postTransfer.debit_account_id
    //             );
    //         }
    //         creditAccount.credits_pending -= transfer.amount;
    //         debitAccount.debits_pending -= transfer.amount;
    //         creditAccount.credits_posted += transfer.amount;
    //         debitAccount.debits_posted += transfer.amount;
    //     }
    //     // Otherwise, add the amount to the posted amounts
    //     else {
    //         creditAccount.credits_posted += transfer.amount;
    //         debitAccount.debits_posted += transfer.amount;
    //     }
    //     return CreateTransferError.ok;
    // }

    generateId() {
        return this._currentId++;
    }

    async createAccount(account: Account): Promise<CreateAccountsError[]> {
        this._accounts.set(account.id, account);
        return [{ index: 0, result: CreateAccountError.ok }];
    }

    async createAccounts(batch: Account[]): Promise<CreateAccountsError[]> {
        return batch.map((account, index) => {
            this._accounts.set(account.id, account);
            return { index, result: CreateAccountError.ok };
        });
    }

    async createTransfers(batch: Transfer[]): Promise<CreateTransfersError[]> {
        const errs: CreateTransfersError[] = [];
        let linkedTransfers: Transfer[] = [];
        let checkpoint = this.getCheckpoint();
        for (let i = 0; i < batch.length; i++) {
            const transfer = {
                ...batch[i],
            };
            let pendingTransfer: Transfer | undefined;
            let valid = true;

            let creditAccountId = transfer.credit_account_id;
            let debitAccountId = transfer.debit_account_id;

            if (
                transfer.flags & TransferFlags.post_pending_transfer ||
                transfer.flags & TransferFlags.void_pending_transfer
            ) {
                pendingTransfer = this._transfers.find(
                    (t) => t.id === transfer.pending_id
                );

                if (!pendingTransfer) {
                    valid = false;
                    errs.push({
                        index: i,
                        result: CreateTransferError.pending_transfer_not_found,
                    });
                } else {
                    const closingTransfer = this._transfers.find(
                        (t) => t.pending_id === transfer.pending_id
                    );

                    if (closingTransfer) {
                        valid = false;
                        errs.push({
                            index: i,
                            result:
                                closingTransfer.flags &
                                TransferFlags.post_pending_transfer
                                    ? CreateTransferError.pending_transfer_already_posted
                                    : CreateTransferError.pending_transfer_already_voided,
                        });
                    } else {
                        transfer.credit_account_id = creditAccountId =
                            pendingTransfer.credit_account_id;
                        transfer.debit_account_id = debitAccountId =
                            pendingTransfer.debit_account_id;
                        transfer.code = transfer.code || pendingTransfer.code;
                        transfer.user_data_32 =
                            transfer.user_data_32 ||
                            pendingTransfer.user_data_32;
                        transfer.user_data_64 =
                            transfer.user_data_64 ||
                            pendingTransfer.user_data_64;
                        transfer.user_data_128 =
                            transfer.user_data_128 ||
                            pendingTransfer.user_data_128;
                    }
                }
            }

            if (!pendingTransfer && creditAccountId === debitAccountId) {
                errs.push({
                    index: i,
                    result: CreateTransferError.accounts_must_be_different,
                });
                valid = false;
            }

            const creditAccount = this._accounts.get(creditAccountId);
            if (!pendingTransfer && !creditAccount) {
                errs.push({
                    index: i,
                    result: CreateTransferError.credit_account_not_found,
                });
                valid = false;
            }

            const debitAccount = this._accounts.get(debitAccountId);
            if (!pendingTransfer && !debitAccount) {
                errs.push({
                    index: i,
                    result: CreateTransferError.debit_account_not_found,
                });
                valid = false;
            }

            if (creditAccount && debitAccount) {
                if (
                    transfer.ledger &&
                    (creditAccount.ledger !== transfer.ledger ||
                        debitAccount.ledger !== transfer.ledger)
                ) {
                    errs.push({
                        index: i,
                        result: CreateTransferError.transfer_must_have_the_same_ledger_as_accounts,
                    });
                    valid = false;
                    return errs;
                } else if (creditAccount.ledger !== debitAccount.ledger) {
                    errs.push({
                        index: i,
                        result: CreateTransferError.accounts_must_have_the_same_ledger,
                    });
                    valid = false;
                    return errs;
                }

                if (transfer.flags & TransferFlags.balancing_credit) {
                    const balancingAmount =
                        creditAccount.debits_posted -
                        (creditAccount.credits_posted +
                            creditAccount.credits_pending);
                    if (
                        balancingAmount >= 0 &&
                        balancingAmount < transfer.amount
                    ) {
                        transfer.amount = balancingAmount;
                    }
                }

                if (transfer.flags & TransferFlags.balancing_debit) {
                    const balancingAmount =
                        debitAccount.credits_posted -
                        (debitAccount.debits_posted +
                            debitAccount.debits_pending);
                    if (
                        balancingAmount >= 0 &&
                        balancingAmount < transfer.amount
                    ) {
                        transfer.amount = balancingAmount;
                    }
                }

                if (
                    creditAccount.flags &
                    AccountFlags.credits_must_not_exceed_debits
                ) {
                    if (
                        creditAccount.credits_pending +
                            creditAccount.credits_posted +
                            transfer.amount >
                        creditAccount.debits_posted
                    ) {
                        valid = false;
                        errs.push({
                            index: i,
                            result: CreateTransferError.exceeds_debits,
                        });
                    }
                }

                if (
                    debitAccount.flags &
                    AccountFlags.debits_must_not_exceed_credits
                ) {
                    if (
                        debitAccount.debits_pending +
                            debitAccount.debits_posted +
                            transfer.amount >
                        debitAccount.credits_posted
                    ) {
                        valid = false;
                        errs.push({
                            index: i,
                            result: CreateTransferError.exceeds_credits,
                        });
                    }
                }

                if (valid) {
                    if (transfer.flags & TransferFlags.pending) {
                        creditAccount.credits_pending += transfer.amount;
                        debitAccount.debits_pending += transfer.amount;
                    } else if (
                        transfer.flags & TransferFlags.post_pending_transfer
                    ) {
                        const finalAmount =
                            transfer.amount === 0n ||
                            transfer.amount > pendingTransfer.amount
                                ? pendingTransfer.amount
                                : transfer.amount;

                        creditAccount.credits_pending -= pendingTransfer.amount;
                        debitAccount.debits_pending -= pendingTransfer.amount;
                        creditAccount.credits_posted += finalAmount;
                        debitAccount.debits_posted += finalAmount;

                        transfer.amount = pendingTransfer.amount = finalAmount;
                    } else if (
                        transfer.flags & TransferFlags.void_pending_transfer
                    ) {
                        creditAccount.credits_pending -= pendingTransfer.amount;
                        debitAccount.debits_pending -= pendingTransfer.amount;

                        if (
                            pendingTransfer.flags & TransferFlags.closing_credit
                        ) {
                            creditAccount.flags &= ~AccountFlags.closed;
                        }
                        if (
                            pendingTransfer.flags & TransferFlags.closing_debit
                        ) {
                            debitAccount.flags &= ~AccountFlags.closed;
                        }
                    } else {
                        creditAccount.credits_posted += transfer.amount;
                        debitAccount.debits_posted += transfer.amount;
                    }

                    if (transfer.flags & TransferFlags.closing_credit) {
                        creditAccount.flags |= AccountFlags.closed;
                    }
                    if (transfer.flags & TransferFlags.closing_debit) {
                        debitAccount.flags |= AccountFlags.closed;
                    }

                    this._recordBalance(creditAccount, transfer.timestamp);
                    this._recordBalance(debitAccount, transfer.timestamp);
                }
            }

            if (valid) {
                if (transfer.flags & TransferFlags.linked) {
                    linkedTransfers.push(transfer);
                } else {
                    if (linkedTransfers.length > 0) {
                        this._transfers.push(...linkedTransfers);
                        linkedTransfers = [];
                    }
                    this._transfers.push(transfer);
                }
            } else {
                this.restoreCheckpoint(checkpoint);
                linkedTransfers = [];
            }
        }

        if (linkedTransfers.length > 0) {
            this._transfers.push(...linkedTransfers);
        }
        return errs;
    }

    private _recordBalance(account: Account, timestamp: bigint) {
        if ((account.flags & AccountFlags.history) !== AccountFlags.history) {
            return;
        }
        let accountBalances = this._balances.get(account.id);
        if (!accountBalances) {
            accountBalances = [];
            this._balances.set(account.id, accountBalances);
        }

        accountBalances.push({
            debits_pending: account.debits_pending,
            credits_pending: account.credits_pending,
            credits_posted: account.credits_posted,
            debits_posted: account.debits_posted,
            timestamp: timestamp,
        });
    }

    async lookupAccounts(batch: Account['id'][]): Promise<Account[]> {
        const accounts: Account[] = [];
        for (const id of batch) {
            const account = this._accounts.get(id);
            if (account) {
                accounts.push({
                    ...account,
                });
            }
        }
        return accounts;
    }

    async lookupTransfers(batch: Transfer['id'][]): Promise<Transfer[]> {
        const transfers: Transfer[] = [];
        for (const id of batch) {
            const transfer = this._transfers.find((t) => t.id === id);
            if (transfer) {
                transfers.push({
                    ...transfer,
                });
            }
        }
        return transfers;
    }

    async getAccountTransfers(filter: AccountFilter): Promise<Transfer[]> {
        let transfers = this._transfers.filter((t) => {
            if (
                t.credit_account_id !== filter.account_id &&
                t.debit_account_id !== filter.account_id
            ) {
                return false;
            }

            if (filter.timestamp_min && t.timestamp < filter.timestamp_min) {
                return false;
            }
            if (filter.timestamp_max && t.timestamp > filter.timestamp_max) {
                return false;
            }
            if (
                filter.user_data_128 &&
                t.user_data_128 !== filter.user_data_128
            ) {
                return false;
            }
            if (filter.user_data_64 && t.user_data_64 !== filter.user_data_64) {
                return false;
            }
            if (filter.user_data_32 && t.user_data_32 !== filter.user_data_32) {
                return false;
            }
            if (filter.code && t.code !== filter.code) {
                return false;
            }
            if (filter.flags) {
                if (
                    filter.flags & AccountFilterFlags.credits &&
                    filter.flags & AccountFilterFlags.debits
                ) {
                    if (
                        t.credit_account_id !== filter.account_id &&
                        t.debit_account_id !== filter.account_id
                    ) {
                        return false;
                    }
                } else if (filter.flags & AccountFilterFlags.debits) {
                    if (t.debit_account_id !== filter.account_id) {
                        return false;
                    }
                } else if (filter.flags & AccountFilterFlags.credits) {
                    if (t.credit_account_id !== filter.account_id) {
                        return false;
                    }
                }
            }

            return true;
        });

        if (filter.flags & AccountFilterFlags.reversed) {
            transfers = orderBy(transfers, ['timestamp'], ['desc']);
        } else {
            transfers = orderBy(transfers, ['timestamp'], ['asc']);
        }

        if (filter.limit) {
            transfers = transfers.slice(0, filter.limit);
        }

        return transfers;
    }

    async getAccountBalances(filter: AccountFilter): Promise<AccountBalance[]> {
        return this._balances.get(filter.account_id) || [];
    }

    async queryAccounts(filter: QueryFilter): Promise<Account[]> {
        let accounts: Account[] = [];
        for (let account of this._accounts.values()) {
            if (
                filter.user_data_128 &&
                account.user_data_128 !== filter.user_data_128
            ) {
                continue;
            }
            if (
                filter.user_data_64 &&
                account.user_data_64 !== filter.user_data_64
            ) {
                continue;
            }
            if (
                filter.user_data_32 &&
                account.user_data_32 !== filter.user_data_32
            ) {
                continue;
            }

            if (filter.ledger && account.ledger !== filter.ledger) {
                continue;
            }
            if (filter.code && account.code !== filter.code) {
                continue;
            }
            if (
                filter.timestamp_max &&
                account.timestamp > filter.timestamp_max
            ) {
                continue;
            }
            if (
                filter.timestamp_min &&
                account.timestamp < filter.timestamp_min
            ) {
                continue;
            }

            accounts.push({
                ...account,
            });
        }

        if (filter.flags & AccountFilterFlags.reversed) {
            accounts = orderBy(accounts, ['timestamp'], ['desc']);
        } else {
            accounts = orderBy(accounts, ['timestamp'], ['asc']);
        }

        if (filter.limit) {
            accounts = accounts.slice(0, filter.limit);
        }

        return accounts;
    }

    async queryTransfers(filter: QueryFilter): Promise<Transfer[]> {
        let transfers: Transfer[] = [];
        for (let transfer of this._transfers) {
            if (
                filter.user_data_128 &&
                transfer.user_data_128 !== filter.user_data_128
            ) {
                continue;
            }
            if (
                filter.user_data_64 &&
                transfer.user_data_64 !== filter.user_data_64
            ) {
                continue;
            }
            if (
                filter.user_data_32 &&
                transfer.user_data_32 !== filter.user_data_32
            ) {
                continue;
            }

            if (filter.ledger && transfer.ledger !== filter.ledger) {
                continue;
            }
            if (filter.code && transfer.code !== filter.code) {
                continue;
            }
            if (
                filter.timestamp_max &&
                transfer.timestamp > filter.timestamp_max
            ) {
                continue;
            }
            if (
                filter.timestamp_min &&
                transfer.timestamp < filter.timestamp_min
            ) {
                continue;
            }
        }

        if (filter.flags & AccountFilterFlags.reversed) {
            transfers = orderBy(transfers, ['timestamp'], ['desc']);
        } else {
            transfers = orderBy(transfers, ['timestamp'], ['asc']);
        }

        if (filter.limit) {
            transfers = transfers.slice(0, filter.limit);
        }

        return transfers;
    }
}
