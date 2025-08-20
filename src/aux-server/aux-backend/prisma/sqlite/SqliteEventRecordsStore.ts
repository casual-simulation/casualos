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
    AddEventCountStoreResult,
    EventRecordUpdate,
    EventRecordsStore,
    GetEventCountStoreResult,
    ListEventsStoreResult,
    UpdateEventResult,
} from '@casual-simulation/aux-records';
import { cleanupObject } from '@casual-simulation/aux-records';
import type { PrismaClient, Prisma } from '../generated-sqlite';
import { convertMarkers } from '../Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'SqliteEventRecordsStore';

export class SqliteEventRecordsStore implements EventRecordsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult> {
        await this._client.eventRecord.upsert({
            where: {
                recordName_name: {
                    recordName,
                    name: eventName,
                },
            },
            create: {
                name: eventName,
                recordName: recordName,
                count: count,
                markers: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: {
                count: {
                    increment: count,
                },
                updatedAt: Date.now(),
            },
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult> {
        const result = await this._client.eventRecord.findUnique({
            where: {
                recordName_name: {
                    recordName,
                    name: eventName,
                },
            },
        });

        if (result) {
            return {
                success: true,
                count: Number(result.count),
            };
        } else {
            return {
                success: true,
                count: 0,
            };
        }
    }

    @traced(TRACE_NAME)
    async updateEvent(
        recordName: string,
        eventName: string,
        updates: EventRecordUpdate
    ): Promise<UpdateEventResult> {
        await this._client.eventRecord.upsert({
            where: {
                recordName_name: {
                    recordName,
                    name: eventName,
                },
            },
            create: {
                recordName: recordName,
                name: eventName,
                count: updates.count ?? 0,
                markers: updates.markers,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            update: cleanupObject({
                recordName: recordName,
                name: eventName,
                count: updates.count,
                markers: updates.markers,
                updatedAt: Date.now(),
            }),
        });

        return {
            success: true,
        };
    }

    @traced(TRACE_NAME)
    async listEvents(
        recordName: string,
        eventName: string
    ): Promise<ListEventsStoreResult> {
        let query: Prisma.EventRecordWhereInput = {
            recordName: recordName,
        };
        if (!!eventName) {
            query.name = { gt: eventName };
        }

        const totalCount = await this._client.eventRecord.count({
            where: {
                recordName: recordName,
            },
        });
        const events = await this._client.eventRecord.findMany({
            where: query,
            select: {
                recordName: true,
                count: true,
                markers: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
            take: 10,
        });

        return {
            success: true,
            events: events.map((e) => ({
                eventName: e.name,
                count: Number(e.count),
                markers: convertMarkers(e.markers as string[]),
            })),
            totalCount: totalCount,
        };
    }
}

export interface EventRecord {
    recordName: string;
    eventName: string;
    count: number;
    markers?: string[];
}
