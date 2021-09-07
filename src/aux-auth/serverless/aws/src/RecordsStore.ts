import {
    GetRecordsActionResult,
    hasValue,
    Record,
} from '@casual-simulation/aux-common';

export type RecordVisibility = 'global' | 'restricted';

export interface ServerlessRecord {
    issuer: string;
    address: string;
    record: any;
    creationDate: number;
    visibility: RecordVisibility;
    authorizedUsers: string[];
}

export interface RecordsQuery {
    issuer: string;
    cursor?: string;
    address?: string;
    prefix?: string;
    visibility: RecordVisibility;
    token?: string;
}

export interface DeletableRecord {
    issuer: string;
    address: string;
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

    /**
     * Gets the list of permanent records matching the given query.
     * @param query The query.
     */
    getPermanentRecords(query: RecordsQuery): Promise<GetRecordsActionResult>;

    /**
     * Gets the list of temporary records matching the given query.
     * @param query The query.
     */
    getTemporaryRecords(query: RecordsQuery): Promise<GetRecordsActionResult>;

    /**
     * Deletes the permanent record that matches the given definition.
     */
    deletePermanentRecord(record: DeletableRecord): Promise<void>;

    /**
     * Deletes the temporary record that matches the given definition.
     */
    deleteTemporaryRecord(record: DeletableRecord): Promise<void>;
}

export class MemoryRecordsStore implements RecordsStore {
    tempRecords: ServerlessRecord[] = [];
    permanentRecords: ServerlessRecord[] = [];

    pageSize: number = 2;

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

    async getPermanentRecords(
        query: RecordsQuery
    ): Promise<GetRecordsActionResult> {
        return this._queryRecords(this.permanentRecords, query, 'permanent');
    }

    async getTemporaryRecords(
        query: RecordsQuery
    ): Promise<GetRecordsActionResult> {
        return this._queryRecords(this.tempRecords, query, 'temp');
    }

    async deletePermanentRecord(record: DeletableRecord): Promise<void> {
        return this._deleteRecord(this.permanentRecords, record);
    }

    async deleteTemporaryRecord(record: DeletableRecord): Promise<void> {
        return this._deleteRecord(this.tempRecords, record);
    }

    private _deleteRecord(
        records: ServerlessRecord[],
        record: DeletableRecord
    ): void {
        const index = records.findIndex(
            (r) => r.issuer === record.issuer && r.address === record.address
        );
        if (index >= 0) {
            records.splice(index, 1);
        }
    }

    private _queryRecords(
        records: ServerlessRecord[],
        query: RecordsQuery,
        type: 'permanent' | 'temp'
    ): GetRecordsActionResult {
        const foundRecords = records
            .filter((r) => {
                return (
                    r.issuer === query.issuer &&
                    r.visibility === query.visibility &&
                    (hasValue(query.address)
                        ? r.address === query.address
                        : hasValue(query.prefix)
                        ? r.address.startsWith(query.prefix)
                        : true) &&
                    (query.visibility !== 'restricted' ||
                        r.authorizedUsers.includes(query.token))
                );
            })
            .map(
                (r) =>
                    ({
                        address: r.address,
                        authID: r.issuer,
                        data: r.record,
                        space:
                            type +
                            (r.visibility === 'global'
                                ? `Global`
                                : `Restricted`),
                    } as Record)
            );

        const cursor = query.cursor ? JSON.parse(query.cursor) : 0;
        const finalRecords = foundRecords.slice(cursor, cursor + this.pageSize);

        const hasMoreRecords =
            finalRecords.length + cursor < foundRecords.length;

        const nextCursor = hasMoreRecords
            ? JSON.stringify(
                  foundRecords.length > finalRecords.length
                      ? cursor + finalRecords.length
                      : finalRecords.length
              )
            : undefined;

        return {
            cursor: nextCursor,
            records: finalRecords,
            hasMoreRecords: hasMoreRecords,
            totalCount: foundRecords.length,
        };
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
