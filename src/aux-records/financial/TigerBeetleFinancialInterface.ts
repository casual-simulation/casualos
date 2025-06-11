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
    Account,
    AccountBalance,
    AccountFilter,
    Client,
    CreateAccountsError,
    CreateTransfersError,
    QueryFilter,
    Transfer,
} from 'tigerbeetle-node';

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
    id: () => Account['id'];

    /**
     * The offset that should be added to the generated IDs.
     * This is useful for testing purposes to avoid ID collisions.
     */
    idOffset?: bigint;
}

/**
 * The TigerBeetleFinancialInterface class implements the FinancialInterface
 * using the TigerBeetle client.
 */
export class TigerBeetleFinancialInterface implements FinancialInterface {
    private _client: Client;
    private _id: () => Account['id'];
    private _idOffset: bigint = 0n;

    constructor(config: Config) {
        this._client = config.client;
        this._id = config.id;
    }

    private _mapAccountIds(accounts: Account[], offset: bigint) {
        if (offset === 0n) {
            return accounts;
        }

        return accounts.map((a) => ({
            ...a,
            id: a.id + offset,
        }));
    }

    private _mapTransferIds(transfers: Transfer[], offset: bigint) {
        if (offset === 0n) {
            return transfers;
        }

        return transfers.map((t) => ({
            ...t,
            id: t.id + offset,
            credit_account_id: t.credit_account_id + offset,
            debit_account_id: t.debit_account_id + offset,
            pending_id: t.pending_id ? t.pending_id + offset : undefined,
        }));
    }

    generateId(): Account['id'] {
        return this._id();
    }

    createAccount(account: Account): Promise<CreateAccountsError[]> {
        return this._client.createAccounts(
            this._mapAccountIds([account], this._idOffset)
        );
    }

    createAccounts(batch: Account[]): Promise<CreateAccountsError[]> {
        return this._client.createAccounts(
            this._mapAccountIds(batch, this._idOffset)
        );
    }

    createTransfers(batch: Transfer[]): Promise<CreateTransfersError[]> {
        return this._client.createTransfers(
            this._mapTransferIds(batch, this._idOffset)
        );
    }

    async lookupAccounts(batch: Account['id'][]): Promise<Account[]> {
        return this._mapAccountIds(
            await this._client.lookupAccounts(batch),
            -this._idOffset
        );
    }

    async lookupTransfers(batch: Transfer['id'][]): Promise<Transfer[]> {
        return this._mapTransferIds(
            await this._client.lookupTransfers(batch),
            -this._idOffset
        );
    }

    async getAccountTransfers(filter: AccountFilter): Promise<Transfer[]> {
        return this._mapTransferIds(
            await this._client.getAccountTransfers(filter),
            -this._idOffset
        );
    }

    getAccountBalances(filter: AccountFilter): Promise<AccountBalance[]> {
        return this._client.getAccountBalances(filter);
    }

    async queryAccounts(filter: QueryFilter): Promise<Account[]> {
        return this._mapAccountIds(
            await this._client.queryAccounts(filter),
            -this._idOffset
        );
    }

    async queryTransfers(filter: QueryFilter): Promise<Transfer[]> {
        return this._mapTransferIds(
            await this._client.queryTransfers(filter),
            -this._idOffset
        );
    }
}
