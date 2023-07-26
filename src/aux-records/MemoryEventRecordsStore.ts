import { sortBy } from 'lodash';
import {
    AddEventCountStoreResult,
    EventRecordsStore,
    EventRecordUpdate,
    GetEventCountStoreResult,
    ListEventsStoreResult,
    UpdateEventResult,
} from './EventRecordsStore';

export class MemoryEventRecordsStore implements EventRecordsStore {
    private _buckets: Map<string, Map<string, RecordData>> = new Map();

    async addEventCount(
        recordName: string,
        eventName: string,
        count: number
    ): Promise<AddEventCountStoreResult> {
        const record = this._getRecord(recordName);

        if (record.has(eventName)) {
            let data = record.get(eventName);
            data.count += count;
        } else {
            record.set(eventName, {
                count: count,
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
        const record = this._getRecord(recordName);

        const e = record.has(eventName)
            ? record.get(eventName)
            : {
                  count: 0,
              };

        return {
            success: true,
            count: e.count,
            markers: e.markers,
        };
    }

    async updateEvent(
        recordName: string,
        eventName: string,
        updates: EventRecordUpdate
    ): Promise<UpdateEventResult> {
        const record = this._getRecord(recordName);

        const e = record.has(eventName)
            ? record.get(eventName)
            : {
                  count: 0,
              };

        record.set(eventName, {
            ...e,
            ...updates,
        });

        return {
            success: true,
        };
    }

    async listEvents(
        recordName: string,
        eventName: string
    ): Promise<ListEventsStoreResult> {
        const record = this._getRecord(recordName);
        const totalCount = record.size;
        let events = sortBy([...record.entries()], ([name, data]) => name);

        if (eventName) {
            events = events.filter(([name, data]) => name > eventName);
        }

        return {
            success: true,
            events: events.slice(0, 10).map(([name, data]) => ({
                eventName: name,
                count: data.count,
                markers: data.markers,
            })),
            totalCount,
        };
    }

    private _getRecord(recordName: string) {
        let record = this._buckets.get(recordName);
        if (!record) {
            record = new Map();
            this._buckets.set(recordName, record);
        }
        return record;
    }
}

interface RecordData {
    count: number;
    markers?: string[];
}
