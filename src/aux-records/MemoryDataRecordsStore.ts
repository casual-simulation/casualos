import { DataRecordsStore, SetDataResult } from './DataRecordsStore';

export class MemoryDataRecordsStore implements DataRecordsStore {
    private _buckets: Map<string, Map<string, any>> = new Map();

    async setData(
        recordName: string,
        address: string,
        data: any
    ): Promise<SetDataResult> {
        let record = this._getRecord(recordName);
        record.set(address, data);
        return {
            success: true,
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
