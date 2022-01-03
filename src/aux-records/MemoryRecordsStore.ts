import { Record, RecordsStore } from './RecordsStore';

export class MemoryRecordsStore implements RecordsStore {
    private _records: Record[] = [];

    async getRecordByName(name: string): Promise<Record> {
        const record = this._records.find((r) => r.name === name);
        return record;
    }

    async updateRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex >= 0) {
            this._records[existingRecordIndex] = record;
        }
    }

    async addRecord(record: Record): Promise<void> {
        const existingRecordIndex = this._records.findIndex(
            (r) => r.name === record.name
        );
        if (existingRecordIndex < 0) {
            this._records.push(record);
        }
    }
}
