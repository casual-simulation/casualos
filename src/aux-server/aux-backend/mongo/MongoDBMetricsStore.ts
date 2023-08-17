import {
    AiChatSubscriptionMetrics,
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    MetricsStore,
    Record,
    RecordSubscriptionMetrics,
    SubscriptionFilter,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';
import { DataRecord } from './MongoDBDataRecordsStore';
import { MongoFileRecord } from './MongoDBFileRecordsStore';
import { MongoDBAuthUser, MongoDBStudio } from './MongoDBAuthStore';
import { EventRecord } from './MongoDBEventRecordsStore';

export class MongoDBMetricsStore implements MetricsStore {
    private _dataRecords: Collection<DataRecord>;
    private _fileRecords: Collection<MongoFileRecord>;
    private _eventRecords: Collection<EventRecord>;
    private _studios: Collection<MongoDBStudio>;
    private _users: Collection<MongoDBAuthUser>;
    private _records: Collection<Record>;

    constructor(
        dataRecords: Collection<DataRecord>,
        fileRecords: Collection<MongoFileRecord>,
        eventRecords: Collection<EventRecord>,
        studios: Collection<MongoDBStudio>,
        records: Collection<Record>,
        users: Collection<MongoDBAuthUser>
    ) {
        this._dataRecords = dataRecords;
        this._fileRecords = fileRecords;
        this._eventRecords = eventRecords;
        this._studios = studios;
        this._records = records;
        this._users = users;
    }
    getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AiChatSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    async getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics> {
        const {
            subscriptionId,
            subscriptionStatus,
            records,
            record,
            periodStart,
            periodEnd,
        } = await this._listRecords(recordName);

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
            currentPeriodEndMs: periodEnd,
            currentPeriodStartMs: periodStart,
        };
    }

    async getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        const {
            subscriptionId,
            subscriptionStatus,
            records,
            record,
            periodStart,
            periodEnd,
        } = await this._listRecords(recordName);

        let count = 0;
        let reservedSize = 0;
        for (let record of records) {
            count += await this._fileRecords.count({
                recordName: record.name,
            });
            const result = (await this._fileRecords
                .aggregate([
                    { $match: { recordName: record.name } },
                    {
                        $group: {
                            _id: '$recordName',
                            totalSizeInBytes: { $sum: '$sizeInBytes' },
                        },
                    },
                ])
                .toArray()) as any[];

            if (result.length > 0) {
                reservedSize += result[0].totalSizeInBytes;
            }
        }

        return {
            ownerId: record.ownerId,
            studioId: record.studioId,
            subscriptionId: subscriptionId,
            subscriptionStatus: subscriptionStatus,
            recordName: record.name,
            totalFiles: count,
            totalFileBytesReserved: reservedSize,
            currentPeriodEndMs: periodEnd,
            currentPeriodStartMs: periodStart,
        };
    }

    async getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        const {
            subscriptionId,
            subscriptionStatus,
            records,
            record,
            periodEnd,
            periodStart,
        } = await this._listRecords(recordName);

        let count = 0;
        for (let record of records) {
            count += await this._eventRecords.count({
                recordName: record.name,
            });
        }

        return {
            ownerId: record.ownerId,
            studioId: record.studioId,
            subscriptionId: subscriptionId,
            subscriptionStatus: subscriptionStatus,
            recordName: record.name,
            totalEventNames: count,
            currentPeriodEndMs: periodEnd,
            currentPeriodStartMs: periodStart,
        };
    }

    async getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics> {
        if (filter.ownerId) {
            const user = await this._users.findOne({
                _id: filter.ownerId,
            });

            const count = await this._records.count({
                ownerId: filter.ownerId,
            });

            return {
                userId: user._id,
                ownerId: user._id,
                studioId: null,
                subscriptionId: user.subscriptionId,
                subscriptionStatus: user.subscriptionStatus,
                totalRecords: count,
                currentPeriodEndMs: user.subscriptionPeriodEndMs,
                currentPeriodStartMs: user.subscriptionPeriodStartMs,
            };
        } else {
            const studio = await this._studios.findOne({
                _id: filter.studioId,
            });

            const count = await this._records.count({
                ownerId: filter.ownerId,
            });

            return {
                userId: studio._id,
                ownerId: null,
                studioId: studio._id,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                totalRecords: count,
                currentPeriodEndMs: studio.subscriptionPeriodEndMs,
                currentPeriodStartMs: studio.subscriptionPeriodStartMs,
            };
        }
    }

    private async _listRecords(recordName: string) {
        const record = await this._records.findOne({
            name: recordName,
        });

        let filter: FilterQuery<Record> = {};

        let subscriptionStatus: string;
        let subscriptionId: string;
        let periodStart: number;
        let periodEnd: number;
        if (record.ownerId) {
            filter.recordName = record.name;

            const user = await this._users.findOne({
                _id: record.ownerId,
            });

            subscriptionId = user.subscriptionId;
            subscriptionStatus = user.subscriptionStatus;
            periodStart = user.subscriptionPeriodStartMs;
            periodEnd = user.subscriptionPeriodEndMs;
        } else if (record.studioId) {
            filter.recordName = record.name;
            const studio = await this._studios.findOne({
                _id: record.studioId,
            });
            subscriptionId = studio.subscriptionId;
            subscriptionStatus = studio.subscriptionStatus;
            periodStart = studio.subscriptionPeriodStartMs;
            periodEnd = studio.subscriptionPeriodEndMs;
        }

        const records = await this._records.find(filter).toArray();

        return {
            record,
            records,
            subscriptionId,
            subscriptionStatus,
            periodStart,
            periodEnd,
        };
    }
}
