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

    generateId = () => {
        return this._currentId++;
    };

    async createAccount(account: Account): Promise<CreateAccountsError[]> {
        return [{ index: 0, result: this._validateAccount(account) }];
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

    createTransfers(batch: Transfer[]): Promise<CreateTransfersError[]> {
        throw new Error('Method not implemented.');
    }

    lookupAccounts(batch: Account['id'][]): Promise<Account[]> {
        throw new Error('Method not implemented.');
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
