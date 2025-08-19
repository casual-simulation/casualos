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
    PrivoClientCredentials,
    PrivoStore,
} from '@casual-simulation/aux-records/PrivoStore';
import type { PrismaClient } from '../generated-sqlite';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqlitePrivoStore';

export class SqlitePrivoStore implements PrivoStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async getStoredCredentials(): Promise<PrivoClientCredentials> {
        const credentials = await this._client.privoClientCredentials.findFirst(
            {
                where: {
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    expiresAt: 'desc',
                },
            }
        );

        return credentials;
    }

    @traced(TRACE_NAME)
    async saveCredentials(credentials: PrivoClientCredentials): Promise<void> {
        await this._client.privoClientCredentials.create({
            data: {
                id: credentials.id,
                accessToken: credentials.accessToken,
                refreshToken: credentials.refreshToken,
                expiresAt: new Date(credentials.expiresAtSeconds * 1000),
                expiresAtSeconds: credentials.expiresAtSeconds,
                scope: credentials.scope,
            },
        });
    }
}
