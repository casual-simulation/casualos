export type RecordVisibility = 'global' | 'restricted';

export interface ServerlessRecord {
    issuer: string;
    address: string;
    record: any;
    creationDate: number;
    visibility: RecordVisibility;
    authorizedUsers: string[];
}

export type SaveRecordResult = 'already_exists' | null;

export interface RecordsStore {
    /**
     * Saves the given record to the temporary record store.
     * @param appRecord The record to save.
     */
    saveTemporaryRecord(appRecord: ServerlessRecord): Promise<SaveRecordResult>;

    /**
     * Saves the given record to the permanent record store.
     * @param appRecord The record to save.
     */
    savePermanentRecord(appRecord: ServerlessRecord): Promise<SaveRecordResult>;
}

export class MemoryRecordsStore implements RecordsStore {
    tempRecords: ServerlessRecord[] = [];
    permanentRecords: ServerlessRecord[] = [];

    async saveTemporaryRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        return this._addRecord(this.tempRecords, appRecord);
    }

    async savePermanentRecord(
        appRecord: ServerlessRecord
    ): Promise<SaveRecordResult> {
        return this._addRecord(this.permanentRecords, appRecord);
    }

    private _addRecord(
        records: ServerlessRecord[],
        record: ServerlessRecord
    ): SaveRecordResult {
        if (
            records.find(
                (r) =>
                    r.issuer === record.issuer && r.address === record.address
            )
        ) {
            return 'already_exists';
        }
        records.push(record);
        return null;
    }
}
