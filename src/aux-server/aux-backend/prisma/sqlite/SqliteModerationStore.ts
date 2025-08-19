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
    ModerationFileScanResult,
    ModerationJob,
    ModerationStore,
    UserInstReport,
} from '@casual-simulation/aux-records';
import type { PrismaClient } from '../generated-sqlite';
import { convertToDate, convertToMillis } from '../Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { v4 as uuid } from 'uuid';

const TRACE_NAME = 'SqliteModerationStore';

/**
 * Defines a class that implements a ModerationStore using Prisma.
 */
export class SqliteModerationStore implements ModerationStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async saveUserInstReport(report: UserInstReport): Promise<void> {
        await this._client.userInstReport.upsert({
            where: {
                id: report.id,
            },
            create: {
                id: report.id,
                reportingUserId: report.reportingUserId,
                reportingIpAddress: report.reportingIpAddress,
                recordName: report.recordName,
                inst: report.inst,
                automaticReport: report.automaticReport,
                reportedPermalink: report.reportedPermalink,
                reportedUrl: report.reportedUrl,
                reportReason: report.reportReason,
                reportReasonText: report.reportReasonText,
                createdAt: convertToDate(report.createdAtMs),
                updatedAt: convertToDate(report.updatedAtMs),
            },
            update: {
                reportingUserId: report.reportingUserId,
                reportingIpAddress: report.reportingIpAddress,
                recordName: report.recordName,
                inst: report.inst,
                automaticReport: report.automaticReport,
                reportedPermalink: report.reportedPermalink,
                reportedUrl: report.reportedUrl,
                reportReason: report.reportReason,
                reportReasonText: report.reportReasonText,
                createdAt: convertToDate(report.createdAtMs),
                updatedAt: convertToDate(report.updatedAtMs),
            },
        });
    }

    @traced(TRACE_NAME)
    async addModerationJob(job: ModerationJob): Promise<void> {
        await this._client.moderationJob.create({
            data: {
                id: job.id,
                type: job.type,
                createdAt: convertToDate(job.createdAtMs),
                updatedAt: convertToDate(job.updatedAtMs),
                s3Id: job.s3Id,
            },
        });
    }

    @traced(TRACE_NAME)
    async findMostRecentJobOfType(
        type: ModerationJob['type']
    ): Promise<ModerationJob | null> {
        const job = await this._client.moderationJob.findFirst({
            where: {
                type: type,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!job) {
            return null;
        }

        return {
            id: job.id,
            type: job.type as ModerationJob['type'],
            createdAtMs: convertToMillis(job.createdAt),
            updatedAtMs: convertToMillis(job.updatedAt),
            s3Id: job.s3Id,
        };
    }

    @traced(TRACE_NAME)
    async addFileModerationResult(
        result: ModerationFileScanResult
    ): Promise<void> {
        await this._client.fileModerationResult.create({
            data: {
                id: result.id,
                jobId: result.jobId,
                recordName: result.recordName,
                fileName: result.fileName,
                modelVersion: result.modelVersion,
                appearsToMatchBannedContent: result.appearsToMatchBannedContent,
                createdAt: convertToDate(result.createdAtMs),
                updatedAt: convertToDate(result.updatedAtMs),
                labels: {
                    createMany: {
                        data: result.labels.map((label) => {
                            return {
                                id: uuid(),
                                name: label.name,
                                confidence: label.confidence,
                            };
                        }),
                    },
                },
            },
        });
    }
}
