import { MemoryDataRecordsStore } from './MemoryDataRecordsStore';
import {
    DataSubscriptionMetrics,
    MetricsStore,
    SubscriptionMetrics,
    FileSubscriptionMetrics,
    EventSubscriptionMetrics,
    RecordSubscriptionMetrics,
    SubscriptionFilter,
} from './MetricsStore';
import { MemoryFileRecordsStore } from './MemoryFileRecordsStore';
import { MemoryEventRecordsStore } from './MemoryEventRecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { MemoryAuthStore } from './MemoryAuthStore';

export class MemoryMetricsStore implements MetricsStore {
    private _dataStore: MemoryDataRecordsStore;
    private _fileStore: MemoryFileRecordsStore;
    private _eventStore: MemoryEventRecordsStore;
    private _recordsStore: MemoryRecordsStore;
    private _authStore: MemoryAuthStore;

    constructor(
        dataStore: MemoryDataRecordsStore,
        fileStore: MemoryFileRecordsStore,
        eventStore: MemoryEventRecordsStore,
        recordsStore: MemoryRecordsStore,
        authStore: MemoryAuthStore
    ) {
        this._dataStore = dataStore;
        this._fileStore = fileStore;
        this._eventStore = eventStore;
        this._recordsStore = recordsStore;
        this._authStore = authStore;
    }

    async getSubscriptionDataMetricsByRecordName(
        recordName: string
    ): Promise<DataSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalItems = 0;

        for (let record of records) {
            let bucket = this._dataStore.buckets.get(record.name);
            if (!bucket) {
                continue;
            }
            totalItems += bucket.size;
        }

        return {
            ...info,
            totalItems,
        };
    }

    async getSubscriptionFileMetricsByRecordName(
        recordName: string
    ): Promise<FileSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalFiles = 0;
        let totalBytesStored = 0;
        let totalBytesReserved = 0;
        for (let record of records) {
            let files = [...this._fileStore.files.values()].filter(
                (f) => f.recordName === record.name
            );

            for (let file of files) {
                totalFiles++;
                totalBytesReserved += file.sizeInBytes;
                if (file.uploaded) {
                    totalBytesStored += file.sizeInBytes;
                }
            }
        }

        return {
            ...info,
            totalFiles,
            totalFileBytesReserved: totalBytesReserved,
        };
    }

    async getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalEventNames = 0;
        for (let record of records) {
            let bucket = this._eventStore.buckets.get(record.name);
            if (!bucket) {
                continue;
            }
            totalEventNames += bucket.size;
        }

        return {
            ...info,
            totalEventNames,
        };
    }

    async getSubscriptionRecordMetrics(
        filter: SubscriptionFilter
    ): Promise<RecordSubscriptionMetrics> {
        const metrics = await this._getSubscriptionMetrics(filter);
        const totalRecords = await this._recordsStore.countRecords(filter);

        return {
            ...metrics,
            totalRecords,
        };
    }

    private async _getSubscriptionInfo(
        recordName: string
    ): Promise<SubscriptionMetrics> {
        const record = await this._recordsStore.getRecordByName(recordName);

        const metrics = await this._getSubscriptionMetrics(record);
        return {
            ...metrics,
            recordName: record.name,
        };
    }

    private async _getSubscriptionMetrics(filter: SubscriptionFilter) {
        let metrics: SubscriptionMetrics = {
            ownerId: filter.ownerId,
            studioId: filter.studioId,
            subscriptionId: null,
            subscriptionStatus: null,
        };

        if (filter.ownerId) {
            const user = await this._authStore.findUser(filter.ownerId);

            if (user) {
                metrics.subscriptionStatus = user.subscriptionStatus;
                metrics.subscriptionId = user.subscriptionId;
            }
        } else if (filter.studioId) {
            const studio = await this._recordsStore.getStudioById(
                filter.studioId
            );

            if (studio) {
                metrics.subscriptionId = studio.subscriptionId;
                metrics.subscriptionStatus = studio.subscriptionStatus;
            }
        }

        return metrics;
    }

    private async _listRecordsForSubscription(recordName: string) {
        const record = await this._recordsStore.getRecordByName(recordName);

        if (record.ownerId) {
            return this._recordsStore.listRecordsByOwnerId(record.ownerId);
        } else {
            return this._recordsStore.listRecordsByStudioId(record.studioId);
        }
    }
}
