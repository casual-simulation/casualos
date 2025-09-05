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
import type { MemoryStore } from '../MemoryStore';
import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import type {
    WebhookRecord,
    WebhookRecordsStore,
    WebhookRunInfo,
    WebhookRunInfoWithWebhook,
    WebhookSubscriptionMetrics,
} from './WebhookRecordsStore';
import type { ListCrudStoreSuccess } from '../crud/CrudRecordsStore';
import { sortBy } from 'es-toolkit/compat';

export class MemoryWebhookRecordsStore
    extends MemoryCrudRecordsStore<WebhookRecord, WebhookSubscriptionMetrics>
    implements WebhookRecordsStore
{
    private _webhookRuns: Map<string, WebhookRunInfo> = new Map();

    constructor(store: MemoryStore) {
        super(store);
    }

    async recordWebhookRun(run: WebhookRunInfo): Promise<void> {
        this._webhookRuns.set(run.runId, run);
    }

    async listWebhookRunsForWebhook(
        recordName: string,
        webhookAddress: string,
        requestTimeMs?: number
    ): Promise<ListCrudStoreSuccess<WebhookRunInfo>> {
        const webhookRuns = Array.from(this._webhookRuns.values()).filter(
            (r) =>
                r.recordName === recordName &&
                r.webhookAddress === webhookAddress
        );

        const sorted = sortBy(webhookRuns, (r) => -r.requestTimeMs);
        const filtered = sorted.filter(
            (r) => !requestTimeMs || r.requestTimeMs < requestTimeMs
        );
        return {
            success: true,
            items: filtered,
            totalCount: webhookRuns.length,
            marker: null,
        };
    }

    async getSubscriptionMetrics(
        filter: SubscriptionFilter
    ): Promise<WebhookSubscriptionMetrics> {
        const info = await super.getSubscriptionMetrics(filter);

        let totalItems = 0;
        let totalRunsInPeriod = 0;
        let totalRunsInLastHour = 0;
        let oneHourAgoMs = Date.now() - 60 * 60 * 1000;

        const records = filter.ownerId
            ? await this.store.listRecordsByOwnerId(filter.ownerId)
            : await this.store.listRecordsByStudioId(filter.studioId!);
        for (let record of records) {
            totalItems += this.getItemRecord(record.name).size;
        }

        for (let run of this._webhookRuns.values()) {
            if (!records.some((r) => r.name === run.recordName)) {
                continue;
            }

            if (
                !info.currentPeriodStartMs ||
                !info.currentPeriodEndMs ||
                run.requestTimeMs >= info.currentPeriodStartMs ||
                run.requestTimeMs <= info.currentPeriodEndMs
            ) {
                totalRunsInPeriod++;
            }

            if (run.requestTimeMs >= oneHourAgoMs) {
                totalRunsInLastHour++;
            }
        }

        return {
            ...info,
            totalItems,
            totalRunsInPeriod,
            totalRunsInLastHour,
        };
    }

    async getWebhookRunInfo(
        runId: string
    ): Promise<WebhookRunInfoWithWebhook | null> {
        const run = this._webhookRuns.get(runId);

        if (!run) {
            return null;
        }

        const webhook = await this.getItemByAddress(
            run.recordName,
            run.webhookAddress
        );

        if (!webhook) {
            return null;
        }

        return {
            run,
            webhook,
        };
    }
}
