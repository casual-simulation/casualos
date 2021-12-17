import {
    DataRecordsStore,
    GetDataStoreResult,
    SetDataResult,
} from './DataRecordsStore';

export class MemoryDataRecordsStore implements DataRecordsStore {
    private _buckets: Map<string, Map<string, RecordData>> = new Map();

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string
    ): Promise<SetDataResult> {
        let record = this._getRecord(recordName);
        record.set(address, {
            data: data,
            publisherId: publisherId,
            subjectId: subjectId,
        });
        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        let record = this._getRecord(recordName);
        let data = record.get(address);
        if (!data) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            };
        }

        return {
            success: true,
            data: data.data,
            publisherId: data.publisherId,
            subjectId: data.subjectId,
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
    data: any;
    publisherId: string;
    subjectId: string;
}
