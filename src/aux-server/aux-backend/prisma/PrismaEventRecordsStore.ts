import {
    AddEventCountStoreResult,
    EventRecordUpdate,
    EventRecordsStore,
    GetEventCountStoreResult,
    ListEventsStoreResult,
    UpdateEventResult,
    cleanupObject,
} from '@casual-simulation/aux-records';
import { PrismaClient, Prisma } from './generated';
import { convertMarkers } from './Utils';

export class PrismaEventRecordsStore implements EventRecordsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

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
            },
            update: {
                count: {
                    increment: count,
                },
            },
        });

        return {
            success: true,
        };
    }

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
            },
            update: cleanupObject({
                recordName: recordName,
                name: eventName,
                count: updates.count,
                markers: updates.markers,
            }),
        });

        return {
            success: true,
        };
    }

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
                markers: convertMarkers(e.markers),
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
