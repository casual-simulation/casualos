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
    GetSearchRecordSyncByTargetResult,
    SearchRecord,
    SearchRecordsStore,
    SearchRecordSync,
    SearchRecordSyncHistory,
    SearchSubscriptionMetrics,
} from './SearchRecordsStore';
import type { SubscriptionFilter } from '../MetricsStore';
import type { ResourceKinds } from '@casual-simulation/aux-common';

/**
 * A Memory-based implementation of the SearchRecordsStore.
 */
export class MemorySearchRecordsStore
    extends MemoryCrudRecordsStore<SearchRecord>
    implements SearchRecordsStore
{
    private _syncs: Map<string, SearchRecordSync> = new Map();
    private _syncHistory: Map<string, SearchRecordSyncHistory> = new Map();

    get syncs() {
        return [...this._syncs.values()];
    }

    get syncHistory() {
        return [...this._syncHistory.values()];
    }

    async saveSync(sync: SearchRecordSync): Promise<void> {
        this._syncs.set(sync.id, sync);
    }

    async deleteSync(syncId: string): Promise<void> {
        this._syncs.delete(syncId);
    }

    async getSync(syncId: string): Promise<SearchRecordSync | null> {
        return this._syncs.get(syncId) || null;
    }

    async getSyncsByTarget(
        targetRecordName: string,
        targetResourceKind: ResourceKinds,
        markers: string[]
    ): Promise<GetSearchRecordSyncByTargetResult[]> {
        const syncs =
            this.syncs.filter(
                (sync) =>
                    sync.targetRecordName === targetRecordName &&
                    sync.targetResourceKind === targetResourceKind &&
                    markers.includes(sync.targetMarker)
            ) || null;

        return await Promise.all(
            syncs.map(async (s) => ({
                sync: s,
                searchRecord: await this.getItemByAddress(
                    s.searchRecordName,
                    s.searchRecordAddress
                ),
            }))
        );
    }

    async listSyncsBySearchRecord(
        recordName: string,
        address: string
    ): Promise<SearchRecordSync[]> {
        let syncs: SearchRecordSync[] = [];
        for (let sync of this._syncs.values()) {
            if (
                sync.searchRecordName === recordName &&
                sync.searchRecordAddress === address
            ) {
                syncs.push(sync);
            }
        }
        return syncs;
    }

    async createSyncHistory(history: SearchRecordSyncHistory): Promise<void> {
        this._syncHistory.set(history.id, history);
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<SearchSubscriptionMetrics> {
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
