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
import type { SubscriptionFilter } from '../MetricsStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type {
    ProxyRecord,
    ProxyRecordsStore,
    ProxyRequestInfo,
    ProxySubscriptionMetrics,
} from './ProxyRecordsStore';

export class MemoryProxyRecordsStore
    extends MemoryCrudRecordsStore<ProxyRecord, ProxySubscriptionMetrics>
    implements ProxyRecordsStore
{
    private _proxyRequests: ProxyRequestInfo[] = [];

    get proxyRequests(): ProxyRequestInfo[] {
        return this._proxyRequests;
    }

    async recordProxyRequest(request: ProxyRequestInfo): Promise<void> {
        this._proxyRequests.push(request);
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<ProxySubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;
        let totalRequestsInPeriod = 0;
        let totalRequestsInLastHour = 0;
        const oneHourAgoMs = Date.now() - 60 * 60 * 1000;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId!);

        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        for (let request of this._proxyRequests) {
            if (!records.some((r) => r.name === request.recordName)) {
                continue;
            }

            if (
                !info.currentPeriodStartMs ||
                !info.currentPeriodEndMs ||
                (request.requestTimeMs >= info.currentPeriodStartMs &&
                    request.requestTimeMs <= info.currentPeriodEndMs)
            ) {
                totalRequestsInPeriod++;
            }

            if (request.requestTimeMs >= oneHourAgoMs) {
                totalRequestsInLastHour++;
            }
        }

        return {
            ...info,
            totalItems,
            totalRequestsInPeriod,
            totalRequestsInLastHour,
        };
    }
}
