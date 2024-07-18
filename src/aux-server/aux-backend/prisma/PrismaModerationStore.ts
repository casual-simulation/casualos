import {
    ModerationStore,
    UserInstReport,
} from '@casual-simulation/aux-records';
import { PrismaClient } from './generated';
import { convertToDate } from './Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'PrismaModerationStore';

/**
 * Defines a class that implements a ModerationStore using Prisma.
 */
export class PrismaModerationStore implements ModerationStore {
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
}
