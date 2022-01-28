import {
    AddEventCountStoreResult,
    EventRecordsStore,
    GetEventCountStoreResult,
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

        const count = record.has(eventName) ? record.get(eventName).count : 0;

        return {
            success: true,
            count: count,
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
}
