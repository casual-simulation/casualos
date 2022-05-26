import { Record, RecordKey, RecordsStore } from './RecordsStore';

export class MemoryRecordsStore implements RecordsStore {
    private _records: Record[] = [];
    private _recordKeys: RecordKey[] = [];

    get recordKeys() {
        return this._recordKeys;
    }

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

    async addRecordKey(key: RecordKey): Promise<void> {
        const existingKeyIndex = this._recordKeys.findIndex(
            (k) => k.recordName === key.recordName && k.secretHash === key.secretHash
        );
        if (existingKeyIndex < 0) {
            this._recordKeys.push(key);
        }
    }

    async getRecordKeyByRecordAndHash(recordName: string, hash: string): Promise<RecordKey> {
        const key = this._recordKeys.find(k => k.recordName === recordName && k.secretHash == hash);
        return key;
    }
}
