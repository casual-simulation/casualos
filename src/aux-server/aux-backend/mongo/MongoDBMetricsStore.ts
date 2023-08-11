import {
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    MetricsStore,
    Record,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';
import { DataRecord } from './MongoDBDataRecordsStore';
import { MongoDBStudio } from './MongoDBRecordsStore';
import { MongoDBAuthUser } from './MongoDBAuthStore';

export class MongoDBMetricsStore implements MetricsStore {
    private _dataRecords: Collection<DataRecord>;
    private _studios: Collection<MongoDBStudio>;
    private _users: Collection<MongoDBAuthUser>;
    private _records: Collection<Record>;

    constructor(
        dataRecords: Collection<DataRecord>,
        studios: Collection<MongoDBStudio>,
        records: Collection<Record>,
        users: Collection<MongoDBAuthUser>
    ) {
        this._dataRecords = dataRecords;
        this._studios = studios;
        this._records = records;
        this._users = users;
    }

    async getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics> {
        const record = await this._records.findOne({
            name: recordName,
        });

        let filter: FilterQuery<Record> = {};

        let subscriptionStatus: string;
        let subscriptionId: string;
        if (record.ownerId) {
            filter.recordName = record.name;

            const user = await this._users.findOne({
                _id: record.ownerId,
            });

            subscriptionId = user.subscriptionId;
            subscriptionStatus = user.subscriptionStatus;
        } else if (record.studioId) {
            filter.recordName = record.name;
            const studio = await this._studios.findOne({
                _id: record.studioId,
            });
            subscriptionId = studio.subscriptionId;
            subscriptionStatus = studio.subscriptionStatus;
        }

        const records = await this._records.find(filter).toArray();

        let count = 0;
        for (let record of records) {
            count += await this._dataRecords.count({
                recordName: record.name,
            });
        }

        return {
            ownerId: record.ownerId,
            studioId: record.studioId,
            subscriptionId: subscriptionId,
            subscriptionStatus: subscriptionStatus,
            recordName: record.name,
            totalItems: count,
        };
    }

    getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }
}
