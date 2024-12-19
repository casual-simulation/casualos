import {
    FinancialInterface,
} from '@casual-simulation/aux-records';
import type {
    Client,
    Account,
    CreateAccountsError,
    Transfer,
    CreateTransfersError,
    AccountFilter,
    AccountBalance,
    QueryFilter,
} from 'tigerbeetle-node';
import { id } from 'tigerbeetle-node';

export interface Config {
    client: Client;
}

export class TigerBeetleFinancialInterface implements FinancialInterface {
    private _client: Client;

    constructor(config: Config) {
        this._client = config.client;
    }

    generateId(): Account['id'] {
        return id();
    }

    createAccount(account: Account): Promise<CreateAccountsError[]> {
        return this._client.createAccounts([account]);
    }

    createAccounts(batch: Account[]): Promise<CreateAccountsError[]> {
        return this._client.createAccounts(batch);
    }
    createTransfers(batch: Transfer[]): Promise<CreateTransfersError[]> {
        return this._client.createTransfers(batch);
    }
    lookupAccounts(batch: Account['id'][]): Promise<Account[]> {
        return this._client.lookupAccounts(batch);
    }
    lookupTransfers(batch: Transfer['id'][]): Promise<Transfer[]> {
        return this._client.lookupTransfers(batch);
    }
    getAccountTransfers(filter: AccountFilter): Promise<Transfer[]> {
        return this._client.getAccountTransfers(filter);
    }
    getAccountBalances(filter: AccountFilter): Promise<AccountBalance[]> {
        return this._client.getAccountBalances(filter);
    }
    queryAccounts(filter: QueryFilter): Promise<Account[]> {
        return this._client.queryAccounts(filter);
    }
    queryTransfers(filter: QueryFilter): Promise<Transfer[]> {
        return this._client.queryTransfers(filter);
    }
}
