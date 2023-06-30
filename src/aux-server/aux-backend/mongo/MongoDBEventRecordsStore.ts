import {
    AddEventCountStoreResult,
    EventRecordUpdate,
    EventRecordsStore,
    GetEventCountStoreResult,
    UpdateEventResult,
    cleanupObject,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';

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
}

export interface EventRecord {
    recordName: string;
    eventName: string;
    count: number;
    markers?: string[];
}
