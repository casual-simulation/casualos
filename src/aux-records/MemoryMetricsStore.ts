import { MemoryDataRecordsStore } from './MemoryDataRecordsStore';
import {
    DataSubscriptionMetrics,
    MetricsStore,
    SubscriptionMetrics,
    FileSubscriptionMetrics,
    EventSubscriptionMetrics,
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
        let totalBytes = 0;
        for (let record of records) {
            let files = [...this._fileStore.files.values()].filter(
                (f) => f.recordName === record.name
            );

            for (let file of files) {
                totalFiles++;
                if (file.uploaded) {
                    totalBytes += file.sizeInBytes;
                }
            }
        }

        return {
            ...info,
            totalFiles,
            totalFileBytesStored: totalBytes,
        };
    }

    async getSubscriptionEventMetricsByRecordName(
        recordName: string
    ): Promise<EventSubscriptionMetrics> {
        const info = await this._getSubscriptionInfo(recordName);
        const records = await this._listRecordsForSubscription(recordName);

        let totalEvents = 0;
        for (let record of records) {
            let bucket = this._eventStore.buckets.get(record.name);
            if (!bucket) {
                continue;
            }
            totalEvents += bucket.size();
        }

        return {
            ...info,
            totalEvents,
        };
    }

    private async _getSubscriptionInfo(
        recordName: string
    ): Promise<SubscriptionMetrics> {
        const record = await this._recordsStore.getRecordByName(recordName);

        let metrics: SubscriptionMetrics = {
            recordName,
            ownerId: record.ownerId,
            studioId: record.studioId,
            subscriptionId: null,
            subscriptionStatus: null,
        };

        if (record.ownerId) {
            const user = await this._authStore.findUser(record.ownerId);

            metrics.subscriptionStatus = user.subscriptionStatus;
            metrics.subscriptionId = user.subscriptionId;
        } else if (record.studioId) {
            const studio = await this._recordsStore.getStudioById(
                record.studioId
            );

            metrics.subscriptionId = studio.subscriptionId;
            metrics.subscriptionStatus = studio.subscriptionStatus;
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
