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
import type { FinancialInterface } from './FinancialInterface';
import type {
    Client,
    id,
    Account,
    CreateAccountsError,
    Transfer,
    CreateTransfersError,
    AccountFilter,
    AccountBalance,
    QueryFilter,
} from './Types';

/**
 * Configuration for the instantiation of the TigerBeetleFinancialInterface.
 */
export interface Config {
    /**
     * The TigerBeetle client to use for financial operations.
     */
    client: Client;
    /**
     * A function that generates a unique ID for accounts, transfers, etc.
     */
    id: typeof id;
}

/**
 * The TigerBeetleFinancialInterface class implements the FinancialInterface
 * using the TigerBeetle client.
 */
export class TigerBeetleFinancialInterface implements FinancialInterface {
    private _client: Client;
    private _id: () => Account['id'];
    constructor(config: Config) {
        this._client = config.client;
        this._id = config.id;
    }

    generateId(): Account['id'] {
        return this._id();
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
