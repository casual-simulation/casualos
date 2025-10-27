/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    AIChatMetrics,
    AIChatSubscriptionMetrics,
    AIImageMetrics,
    AIImageSubscriptionMetrics,
    AIOpenAIRealtimeMetrics,
    AIOpenAIRealtimeSubscriptionMetrics,
    AISkyboxMetrics,
    AISkyboxSubscriptionMetrics,
    AISloydMetrics,
    AISloydSubscriptionMetrics,
    ConfigurationStore,
    DataSubscriptionMetrics,
    EventSubscriptionMetrics,
    FileSubscriptionMetrics,
    InstSubscriptionMetrics,
    MetricsStore,
    Record,
    RecordSubscriptionMetrics,
    SubscriptionFilter,
} from '@casual-simulation/aux-records';
import type { Collection, FilterQuery, Db } from 'mongodb';
import type { DataRecord } from './MongoDBDataRecordsStore';
import type { MongoFileRecord } from './MongoDBFileRecordsStore';
import type { MongoDBAuthUser, MongoDBStudio } from './MongoDBAuthStore';
import type { EventRecord } from './MongoDBEventRecordsStore';
import { DateTime } from 'luxon';

export const CHAT_METRICS_COLLECTION = 'chatMetrics';
export const IMAGE_METRICS_COLLECTION = 'imageMetrics';
export const SKYBOX_METRICS_COLLECTION = 'skyboxMetrics';

export class MongoDBMetricsStore implements MetricsStore {
    private _dataRecords: Collection<DataRecord>;
    private _fileRecords: Collection<MongoFileRecord>;
    private _eventRecords: Collection<EventRecord>;
    private _studios: Collection<MongoDBStudio>;
    private _users: Collection<MongoDBAuthUser>;
    private _records: Collection<Record>;
    private _chatMetrics: Collection<AIChatMetrics>;
    private _imageMetrics: Collection<AIImageMetrics>;
    private _skyboxMetrics: Collection<AISkyboxMetrics>;
    private _db: Db;
    private _config: ConfigurationStore;

    constructor(
        dataRecords: Collection<DataRecord>,
        fileRecords: Collection<MongoFileRecord>,
        eventRecords: Collection<EventRecord>,
        studios: Collection<MongoDBStudio>,
        records: Collection<Record>,
        users: Collection<MongoDBAuthUser>,
        db: Db,
        configStore: ConfigurationStore
    ) {
        this._dataRecords = dataRecords;
        this._fileRecords = fileRecords;
        this._eventRecords = eventRecords;
        this._studios = studios;
        this._records = records;
        this._users = users;
        this._db = db;

        this._chatMetrics = this._db.collection(CHAT_METRICS_COLLECTION);
        this._imageMetrics = this._db.collection(IMAGE_METRICS_COLLECTION);
        this._skyboxMetrics = this._db.collection(SKYBOX_METRICS_COLLECTION);
        this._config = configStore;
    }

    getSubscriptionAiOpenAIRealtimeMetrics(
        filter: SubscriptionFilter
    ): Promise<AIOpenAIRealtimeSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }
    recordOpenAIRealtimeMetrics(
        metrics: AIOpenAIRealtimeMetrics
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionAiSloydMetrics(
        filter: SubscriptionFilter
    ): Promise<AISloydSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionAiSloydMetricsByRecordName(
        recordName: string
    ): Promise<AISloydSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    recordSloydMetrics(metrics: AISloydMetrics): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionInstMetrics(
        filter: SubscriptionFilter
    ): Promise<InstSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    getSubscriptionInstMetricsByRecordName(
        recordName: string
    ): Promise<InstSubscriptionMetrics> {
        throw new Error('Method not implemented.');
    }

    async getSubscriptionAiImageMetrics(
        filter: SubscriptionFilter
    ): Promise<AIImageSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);
        const match: FilterQuery<AIImageMetrics> = {
            createdAtMs: {
                $gte: metrics.currentPeriodStartMs,
                $lt: metrics.currentPeriodEndMs,
            },
        };
        if (filter.ownerId) {
            match.userId = filter.ownerId;
        } else if (filter.studioId) {
            match.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }
        const imageMetrics = await this._imageMetrics
            .aggregate([
                { $match: match },
                { $group: { squarePixels: { $sum: '$squarePixels' } } },
            ])
            .toArray();

        let squarePixels = 0;
        if (imageMetrics.length > 0) {
            squarePixels += imageMetrics[0].squarePixels;
        }

        return {
            ...metrics,
            totalSquarePixelsInCurrentPeriod: squarePixels,
        };
    }

    async recordImageMetrics(metrics: AIImageMetrics): Promise<void> {
        await this._imageMetrics.insertOne({
            createdAtMs: metrics.createdAtMs,
            squarePixels: metrics.squarePixels,
            studioId: metrics.studioId,
            userId: metrics.userId,
        });
    }

    async getSubscriptionAiSkyboxMetrics(
        filter: SubscriptionFilter
    ): Promise<AISkyboxSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);
        const match: FilterQuery<AISkyboxMetrics> = {
            createdAtMs: {
                $gte: metrics.currentPeriodStartMs,
                $lt: metrics.currentPeriodEndMs,
            },
        };
        if (filter.ownerId) {
            match.userId = filter.ownerId;
        } else if (filter.studioId) {
            match.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }
        const skyboxMetrics = await this._skyboxMetrics
            .aggregate([
                { $match: match },
                { $group: { skyboxes: { $sum: '$skyboxes' } } },
            ])
            .toArray();

        let totalSkyboxes = 0;
        if (skyboxMetrics.length > 0) {
            totalSkyboxes += skyboxMetrics[0].skyboxes;
        }

        return {
            ...metrics,
            totalSkyboxesInCurrentPeriod: totalSkyboxes,
        };
    }

    async recordSkyboxMetrics(metrics: AISkyboxMetrics): Promise<void> {
        await this._skyboxMetrics.insertOne({
            studioId: metrics.studioId,
            userId: metrics.userId,
            createdAtMs: metrics.createdAtMs,
            skyboxes: metrics.skyboxes,
        });
    }

    async recordChatMetrics(metrics: AIChatMetrics): Promise<void> {
        await this._chatMetrics.insertOne({
            studioId: metrics.studioId,
            userId: metrics.userId,
            createdAtMs: metrics.createdAtMs,
            tokens: metrics.tokens,
        });
    }

    async getSubscriptionAiChatMetrics(
        filter: SubscriptionFilter
    ): Promise<AIChatSubscriptionMetrics> {
        const metrics = await this.getSubscriptionRecordMetrics(filter);
        const match: FilterQuery<AIChatMetrics> = {
            createdAtMs: {
                $gte: metrics.currentPeriodStartMs,
                $lt: metrics.currentPeriodEndMs,
            },
        };
        if (filter.ownerId) {
            match.userId = filter.ownerId;
        } else if (filter.studioId) {
            match.studioId = filter.studioId;
        } else {
            throw new Error('Invalid filter');
        }
        const chatMetrics = await this._chatMetrics
            .aggregate([
                { $match: match },
                { $group: { tokens: { $sum: '$tokens' } } },
            ])
            .toArray();

        let totalTokens = 0;
        if (chatMetrics.length > 0) {
            totalTokens += chatMetrics[0].tokens;
        }

        return {
            ...metrics,
            totalTokensInCurrentPeriod: totalTokens,
        };
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
            subscriptionType: record.ownerId ? 'user' : 'studio',
            recordName: record.name,
            totalItems: count,
            stripeAccountId: null,
            stripeAccountStatus: null,
            ...(await this._getSubscriptionPeriod(periodStart, periodEnd)),
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
            subscriptionType: record.ownerId ? 'user' : 'studio',
            recordName: record.name,
            totalFiles: count,
            totalFileBytesReserved: reservedSize,
            stripeAccountId: null,
            stripeAccountStatus: null,
            ...(await this._getSubscriptionPeriod(periodStart, periodEnd)),
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
            subscriptionType: record.ownerId ? 'user' : 'studio',
            recordName: record.name,
            totalEventNames: count,
            stripeAccountId: null,
            stripeAccountStatus: null,
            ...(await this._getSubscriptionPeriod(periodStart, periodEnd)),
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
                subscriptionType: 'user',
                totalRecords: count,
                stripeAccountId: null,
                stripeAccountStatus: null,
                ...(await this._getSubscriptionPeriod(
                    user.subscriptionPeriodStartMs,
                    user.subscriptionPeriodEndMs
                )),
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
                subscriptionType: 'studio',
                totalRecords: count,
                stripeAccountId: null,
                stripeAccountStatus: null,
                ...(await this._getSubscriptionPeriod(
                    studio.subscriptionPeriodStartMs,
                    studio.subscriptionPeriodEndMs
                )),
            };
        }
    }

    private async _getSubscriptionPeriod(startMs: number, endMs: number) {
        if (!startMs || !endMs) {
            return await this._getDefaultSubscriptionPeriod();
        }

        return {
            currentPeriodStartMs: startMs,
            currentPeriodEndMs: endMs,
        };
    }

    private async _getDefaultSubscriptionPeriod() {
        const config = await this._config.getSubscriptionConfiguration();
        let currentPeriodStartMs: number = null;
        let currentPeriodEndMs: number = null;

        if (config?.defaultFeatures?.defaultPeriodLength) {
            const now = DateTime.utc();
            const periodStart = now.minus(
                config.defaultFeatures.defaultPeriodLength
            );

            currentPeriodStartMs = periodStart.toMillis();
            currentPeriodEndMs = now.toMillis();
        }

        return {
            currentPeriodStartMs,
            currentPeriodEndMs,
        };
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
