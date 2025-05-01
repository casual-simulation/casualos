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
    NotLoggedInError,
    ServerError,
} from '@casual-simulation/aux-common';
import type {
    ModerationFileScanResultLabel,
    ModerationFileScanResult,
    ModerationJob,
    ModerationStore,
    ReportReason,
    UserInstReport,
} from './ModerationStore';
import type { ZodIssue } from 'zod';
import { v4 as uuid } from 'uuid';
import type { SystemNotificationMessenger } from './SystemNotificationMessenger';
import { RecordsNotification } from './SystemNotificationMessenger';
import type { ConfigurationStore } from './ConfigurationStore';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
    ModerationJobFilesFilter,
    ModerationJobProvider,
} from './ModerationJobProvider';

const TRACE_NAME = 'ModerationController';

/**
 * Defines a class that implements various moderation tasks.
 */
export class ModerationController {
    private _store: ModerationStore;
    private _config: ConfigurationStore;
    private _messenger: SystemNotificationMessenger | null;
    private _jobProvider: ModerationJobProvider;

    constructor(
        store: ModerationStore,
        config: ConfigurationStore,
        messenger: SystemNotificationMessenger | null,
        jobProvider: ModerationJobProvider | null
    ) {
        this._store = store;
        this._config = config;
        this._messenger = messenger;
        this._jobProvider = jobProvider;
    }

    /**
     * Reports the given inst for a terms of service violation.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async reportInst(request: ReportInstRequest): Promise<ReportInstResult> {
        try {
            const config = await this._config.getModerationConfig();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            if (
                !config.allowUnauthenticatedReports &&
                !request.reportingUserId
            ) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in to report an inst.',
                };
            }

            const id = uuid();
            const now = Date.now();

            const userInstReport: UserInstReport = {
                id: id,
                createdAtMs: now,
                updatedAtMs: now,
                recordName: request.recordName,
                inst: request.inst,
                reportingUserId: request.reportingUserId,
                reportingIpAddress: request.reportingIpAddress,
                automaticReport: request.automaticReport,
                reportReasonText: request.reportReasonText,
                reportReason: request.reportReason,
                reportedUrl: request.reportedUrl,
                reportedPermalink: request.reportedPermalink,
            };
            await this._store.saveUserInstReport(userInstReport);

            if (this._messenger) {
                await this._messenger.sendRecordNotification({
                    timeMs: now,
                    resource: 'user_inst_report',
                    action: 'created',
                    recordName: request.recordName,
                    resourceId: request.inst,
                    report: userInstReport,
                });
            }

            return {
                success: true,
                id: id,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error('[ModerationController] Failed to report inst:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Schedules a job to scan for moderation issues.
     */
    @traced(TRACE_NAME)
    async scheduleModerationScans(): Promise<ScheduleModerationScansResult> {
        try {
            if (!this._jobProvider) {
                console.warn(
                    '[ModerationController] No job provider available to schedule moderation scans.'
                );
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const config = await this._config.getModerationConfig();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const jobs: ModerationJob[] = [];

            if (config.jobs?.files?.enabled) {
                console.log(
                    '[ModerationController] Starting file moderation job...'
                );

                let filter: ModerationJobFilesFilter = {};

                if (config.jobs.files.fileExtensions) {
                    filter.fileExtensions =
                        config.jobs.files.fileExtensions.slice();
                }

                const lastFileJob = await this._store.findMostRecentJobOfType(
                    'files'
                );
                if (lastFileJob) {
                    filter.uploadedAfterMs = lastFileJob.createdAtMs;
                }

                const job = await this._jobProvider.startFilesJob(filter);

                await this._store.addModerationJob(job);

                jobs.push(job);

                console.log(
                    '[ModerationController] File moderation job started:',
                    job
                );
            }

            return {
                success: true,
                jobs,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(
                '[ModerationController] Failed to start moderation jobs:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Scans the given file for moderation labels.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async scanFile(request: ScanFileRequest): Promise<ScanFileResult> {
        try {
            if (!this._jobProvider) {
                console.warn(
                    '[ModerationController] No job provider available to scan files.'
                );
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const config = await this._config.getModerationConfig();

            if (!config) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            if (!config.jobs?.files?.enabled) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            if (config.jobs.files.fileExtensions) {
                if (
                    config.jobs.files.fileExtensions.every(
                        (ext) => !request.fileName.endsWith(ext)
                    )
                ) {
                    return {
                        success: false,
                        errorCode: 'not_supported',
                        errorMessage: 'The file extension is not supported.',
                    };
                }
            }

            const createdAtMs = Date.now();
            const scan = await this._jobProvider.scanFile({
                recordName: request.recordName,
                fileName: request.fileName,
                minConfidence: config.jobs.files.minConfidence,
            });

            const resultId = uuid();
            let bannedLabel: ModerationFileScanResultLabel = null;
            for (let label of config.jobs.files.bannedLabels) {
                if (label.label) {
                    bannedLabel = scan.labels.find(
                        (l) =>
                            l.name.localeCompare(label.label, undefined, {
                                sensitivity: 'base',
                            }) === 0 && l.confidence >= label.threshold
                    );
                }

                if (bannedLabel) {
                    console.log(
                        `[ModerationController] Banned label (${bannedLabel.name}) detected in file: ${request.fileName}`
                    );

                    if (label.actions.includes('notify') && this._messenger) {
                        await this._messenger.sendRecordNotification({
                            resource: 'moderation_scan',
                            resourceKind: 'file',
                            action: 'scanned',
                            recordName: request.recordName,
                            resourceId: request.fileName,
                            resultId,
                            labels: scan.labels,
                            timeMs: createdAtMs,
                            bannedLabel,
                            message: `Banned label (${
                                bannedLabel.category
                                    ? bannedLabel.category + ':'
                                    : ''
                            }${bannedLabel.name ?? ''}) detected in file (${
                                request.recordName
                            }/${request.fileName}).`,
                        });
                    }

                    break;
                }
            }

            const result: ModerationFileScanResult = {
                id: resultId,
                recordName: request.recordName,
                fileName: request.fileName,
                jobId: request.jobId,
                labels: scan.labels,
                modelVersion: scan.modelVersion,
                createdAtMs,
                updatedAtMs: Date.now(),
                appearsToMatchBannedContent: !!bannedLabel,
            };
            this._store.addFileModerationResult(result);

            return {
                success: true,
                result,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error('[ModerationController] Failed to scan file:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }
}

export interface ReportInstRequest {
    /**
     * The name of the record that the inst exists in.
     * Null if the inst is public.
     */
    recordName: string | null;

    /**
     * The name of the inst.
     */
    inst: string;

    /**
     * The ID of the user that reported the inst.
     * Null if the user was not logged in when reporting the inst.
     */
    reportingUserId: string | null;

    /**
     * The IP address that the report came from.
     * Null if the IP address could not be determined (i.e. in the case that the report was automatically generated).
     */
    reportingIpAddress: string | null;

    /**
     * Whether the report was automatically generated.
     */
    automaticReport: boolean;

    /**
     * The user-provided explaination that the inst was reported for.
     */
    reportReasonText: string;

    /**
     * The user-provided reason category that the inst was reported for.
     */
    reportReason: ReportReason;

    /**
     * The URL that was reported.
     */
    reportedUrl: string;

    /**
     * The permalink of the inst that was reported.
     */
    reportedPermalink: string;
}

export type ReportInstResult = ReportInstSuccess | ReportInstFailure;

export interface ReportInstSuccess {
    success: true;

    /**
     * The ID of the report.
     */
    id: string;
}

export interface ReportInstFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | 'unacceptable_request'
        | 'not_supported';

    /**
     * The error message for the failure.
     */
    errorMessage: string;

    /**
     * The issues with parsing the request.
     */
    issues?: ZodIssue[];
}

export type ScheduleModerationScansResult =
    | ScheduleModerationScansSuccess
    | ScheduleModerationScansFailure;

export interface ScheduleModerationScansSuccess {
    success: true;

    /**
     * The jobs that were started.
     */
    jobs: ModerationJob[];
}

export interface ScheduleModerationScansFailure {
    success: false;

    /**
     * The error code for the failure.
     */
    errorCode: ServerError | 'not_supported';

    /**
     * The error message for the failure.
     */
    errorMessage: string;
}

export interface ScanFileRequest {
    /**
     * The name of the record that the file is in.
     */
    recordName: string;

    /**
     * The file that should be scanned.
     */
    fileName: string;

    /**
     * The ID of the job that the scan is associated with.
     */
    jobId?: string;
}

export type ScanFileResult = ScanFileSuccess | ScanFileFailure;

export interface ScanFileSuccess {
    success: true;

    /**
     * The result of the file scan.
     */
    result: ModerationFileScanResult;
}

export interface ScanFileFailure {
    success: false;
    errorCode: ServerError | 'not_supported';
    errorMessage: string;
}
