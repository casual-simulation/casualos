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
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type {
    ContractRecordsStore,
    ContractRecord,
    ContractSubscriptionMetrics,
    ContractInvoice,
} from './ContractRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';
import type { PartialExcept } from '../crud';

/**
 * A Memory-based implementation of the ContractRecordsStore.
 */
export class MemoryContractRecordsStore
    extends MemoryCrudRecordsStore<ContractRecord>
    implements ContractRecordsStore
{
    private _invoices: Map<string, ContractInvoice> = new Map();

    async createInvoice(invoice: ContractInvoice): Promise<void> {
        this._invoices.set(invoice.id, { ...invoice });
    }

    async getInvoiceById(id: string): Promise<{
        invoice: ContractInvoice;
        contract: ContractRecord;
    } | null> {
        const invoice = this._invoices.get(id) || null;

        if (!invoice) {
            return null;
        }

        const contract = await this.getItemById(invoice.contractId);

        if (!contract) {
            return null;
        }

        return {
            invoice,
            contract: contract.contract,
        };
    }

    async updateInvoice(
        invoice: PartialExcept<ContractInvoice, 'id'>
    ): Promise<void> {
        let existing = this._invoices.get(invoice.id);
        if (!existing) {
            throw new Error('Invoice not found: ' + invoice.id);
        }
        this._invoices.set(invoice.id, {
            ...existing,
            ...invoice,
        });
    }

    async deleteInvoice(id: string): Promise<void> {
        this._invoices.delete(id);
    }

    async listInvoicesForContract(
        contractId: string
    ): Promise<ContractInvoice[]> {
        return Array.from(this._invoices.values()).filter(
            (i) => i.contractId === contractId
        );
    }

    async markOpenInvoiceAs(
        invoiceId: string,
        status: 'paid' | 'void'
    ): Promise<void> {
        const invoice = this._invoices.get(invoiceId);
        if (invoice && invoice.status === 'open') {
            this._invoices.set(invoiceId, {
                ...invoice,
                status,
                voidedAtMs: status === 'void' ? Date.now() : invoice.voidedAtMs,
                paidAtMs: status === 'paid' ? Date.now() : invoice.paidAtMs,
            });
        }
    }

    async getItemById(
        id: string
    ): Promise<{ recordName: string; contract: ContractRecord } | null> {
        const records = this.getItemRecords();
        for (let [recordName, items] of records) {
            for (let item of items.values()) {
                if (item.id === id) {
                    return { recordName, contract: item };
                }
            }
        }

        return null;
    }

    async markPendingContractAsOpen(
        recordName: string,
        address: string
    ): Promise<void> {
        const record = this.getItemRecord(recordName);
        const item = record.get(address);
        if (item && item.status === 'pending') {
            record.set(address, {
                ...item,
                status: 'open',
            });
        }
    }

    async markContractAsClosed(
        recordName: string,
        address: string
    ): Promise<void> {
        const record = this.getItemRecord(recordName);
        const item = record.get(address);
        if (item && item.status !== 'closed') {
            record.set(address, {
                ...item,
                status: 'closed',
                closedAtMs: Date.now(),
            });

            const invoices = await this.listInvoicesForContract(item.id);

            for (let invoice of invoices) {
                if (invoice.status === 'open') {
                    await this.markOpenInvoiceAs(invoice.id, 'void');
                }
            }
        }
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ContractSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId!);
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        return {
            ...info,
            totalItems,
        };
    }
}
