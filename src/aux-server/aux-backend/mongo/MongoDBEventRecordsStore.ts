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
import type { Collection, FilterQuery } from 'mongodb';

export class MongoDBEventRecordsStore implements EventRecordsStore {
    private _collection: Collection<EventRecord>;

    constructor(collection: Collection<EventRecord>) {
        this._collection = collection;
    }

    async addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult> {
        const result = await this._collection.updateOne(
            {
                recordName: recordName,
                eventName: eventName,
            },
            {
                $inc: { count: count },
            }
        );

        if (result.modifiedCount <= 0) {
            await this._collection.insertOne({
                recordName,
                eventName,
                count,
            });
        }

        return {
            success: true,
        };
    }

    async getEventCount(
        recordName: string,
        eventName: string
    ): Promise<GetEventCountStoreResult> {
        const result = await this._collection.findOne({
            recordName,
            eventName,
        });

        if (result) {
            return {
                success: true,
                count: result.count,
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
        await this._collection.updateOne(
            {
                recordName: { $eq: recordName },
                eventName: { $eq: eventName },
            },
            {
                $set: cleanupObject({
                    recordName: recordName,
                    eventName: eventName,
                    count: updates.count,
                    markers: updates.markers,
                }),
            },
            { upsert: true }
        );

        return {
            success: true,
        };
    }

    async listEvents(
        recordName: string,
        eventName: string
    ): Promise<ListEventsStoreResult> {
        let query: FilterQuery<EventRecord> = {
            recordName: recordName,
        };

        if (!!eventName) {
            query.eventName = { $gt: eventName };
        }

        const count = await this._collection.count({
            recordName: recordName,
        });

        const events = await this._collection.find(query).limit(10).toArray();

        return {
            success: true,
            events: events.map((e) => ({
                eventName: e.eventName,
                count: e.count,
                markers: e.markers,
            })),
            totalCount: count,
        };
    }
}

export interface EventRecord {
    recordName: string;
    eventName: string;
    count: number;
    markers?: string[];
}
