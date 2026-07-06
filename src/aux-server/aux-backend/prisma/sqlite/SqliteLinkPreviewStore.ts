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
import type {
    LinkPreviewData,
    LinkPreviewStore,
    StoredLinkPreview,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { PrismaClient } from '../generated-sqlite';

const TRACE_NAME = 'SqliteLinkPreviewStore';

export class SqliteLinkPreviewStore implements LinkPreviewStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async getLinkPreview(cacheKey: string): Promise<StoredLinkPreview | null> {
        const result = await this._client.linkPreviewCache.findUnique({
            where: { cacheKey },
        });

        if (!result) {
            return null;
        }

        const expireTimeMs = Number(result.expireAtMs);
        if (expireTimeMs < Date.now()) {
            return null;
        }

        return {
            cacheKey: result.cacheKey,
            data: result.data as unknown as LinkPreviewData,
            expireTimeMs,
        };
    }

    @traced(TRACE_NAME)
    async saveLinkPreview(entry: StoredLinkPreview): Promise<void> {
        const expireAtMs = BigInt(Math.trunc(entry.expireTimeMs));
        const now = Date.now();
        await this._client.linkPreviewCache.upsert({
            where: { cacheKey: entry.cacheKey },
            create: {
                cacheKey: entry.cacheKey,
                data: entry.data as any,
                expireAtMs,
                createdAt: now,
                updatedAt: now,
            },
            update: {
                data: entry.data as any,
                expireAtMs,
                updatedAt: now,
            },
        });
    }
}
