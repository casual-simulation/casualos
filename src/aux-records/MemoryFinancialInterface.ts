import { cloneDeep } from 'lodash';
import {
    FinancialInterface,
    AccountCodes,
} from './financial/FinancialInterface';
import {
    Account,
    AccountBalance,
    AccountFilter,
    AccountFlags,
    CreateAccountError,
    CreateAccountsError,
    CreateTransferError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
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
        /**
         * * Existential validation
         * 1. Credit account must exist
         * 2. Debit account must exist
         */
        const creditAccount = this._accounts.get(transfer.credit_account_id);
        const debitAccount = this._accounts.get(transfer.debit_account_id);
        if (!creditAccount) {
            return CreateTransferError.credit_account_not_found;
        }
        if (!debitAccount) {
            return CreateTransferError.debit_account_not_found;
        }

        //TODO: Add more validation
    }

    private _performTransfer(transfer: Transfer): CreateTransferError {
        const validation = this._validateTransfer(transfer);
        if (validation !== CreateTransferError.ok) return validation;
        const creditAccount = this._accounts.get(transfer.credit_account_id);
        const debitAccount = this._accounts.get(transfer.debit_account_id);
        // TODO: Continue transfer logic implementation
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
