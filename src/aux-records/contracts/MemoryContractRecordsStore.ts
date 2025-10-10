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
} from './ContractRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';

/**
 * A Memory-based implementation of the ContractRecordsStore.
 */
export class MemoryContractRecordsStore
    extends MemoryCrudRecordsStore<ContractRecord>
    implements ContractRecordsStore
{
    async getItemById(
        id: string
    ): Promise<{ recordName: string; contract: ContractRecord } | null> {
        const records = await this.getItemRecords();
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
