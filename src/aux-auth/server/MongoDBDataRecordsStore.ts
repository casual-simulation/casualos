import {
    Record,
    RecordsStore,
    DataRecordsStore,
    SetDataResult,
    GetDataStoreResult,
    EraseDataStoreResult,
    ListDataStoreResult,
    UserPolicy,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';

export class MongoDBDataRecordsStore implements DataRecordsStore {
    private _collection: Collection<DataRecord>;

    constructor(collection: Collection<DataRecord>) {
        this._collection = collection;
    }

    async setData(
        recordName: string,
        address: string,
        data: any,
        publisherId: string,
        subjectId: string,
        updatePolicy: UserPolicy,
        deletePolicy: UserPolicy
    ): Promise<SetDataResult> {
        await this._collection.updateOne(
            {
                recordName: recordName,
                address: address,
            },
            {
                $set: {
                    recordName: recordName,
                    address: address,
                    data: data,
                    publisherId: publisherId,
                    subjectId: subjectId,
                    updatePolicy: updatePolicy,
                    deletePolicy: deletePolicy,
                },
            },
            {
                upsert: true,
            }
        );

        return {
            success: true,
        };
    }

    async getData(
        recordName: string,
        address: string
    ): Promise<GetDataStoreResult> {
        const record = await this._collection.findOne({
            recordName: recordName,
            address: address,
        });

        if (record) {
            return {
                success: true,
                data: record.data,
                publisherId: record.publisherId,
                subjectId: record.subjectId,
                updatePolicy: record.updatePolicy,
                deletePolicy: record.deletePolicy,
            };
        }

        return {
            success: false,
            errorCode: 'data_not_found',
            errorMessage: 'The data was not found.',
        };
    }

    async listData(
        recordName: string,
        address: string
    ): Promise<ListDataStoreResult> {
        let query = {
            recordName: recordName,
        } as FilterQuery<DataRecord>;
        if (!!address) {
            query.address = { $gt: address };
        }
        const records = await this._collection
            .find(query)
            .map((r) => ({
                address: r.address,
                data: r.data,
            }))
            .toArray();

        return {
            success: true,
            items: records,
        };
    }

    async eraseData(
        recordName: string,
        address: string
    ): Promise<EraseDataStoreResult> {
        const result = await this._collection.deleteOne({
            recordName: recordName,
            address: address,
        });

        if (result.deletedCount <= 0) {
            return {
                success: false,
                errorCode: 'data_not_found',
                errorMessage: 'The data was not found.',
            };
        }
        return {
            success: true,
        };
    }
}

export interface DataRecord {
    recordName: string;
    address: string;
    data: any;
    publisherId: string;
    subjectId: string;
    updatePolicy: UserPolicy;
    deletePolicy: UserPolicy;
}
