import { NotLoggedInError, ServerError } from '@casual-simulation/aux-common';
import {
    ModerationStore,
    ReportReason,
    UserInstReport,
} from './ModerationStore';
import { ZodIssue } from 'zod';
import { v4 as uuid } from 'uuid';
import { NotificationMessenger } from './NotificationMessenger';
import { ConfigurationStore } from './ConfigurationStore';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'ModerationController';

/**
 * Defines a class that implements various moderation tasks.
 */
export class ModerationController {
    private _store: ModerationStore;
    private _config: ConfigurationStore;
    private _messenger: NotificationMessenger | null;

    constructor(
        store: ModerationStore,
        config: ConfigurationStore,
        messenger: NotificationMessenger | null
    ) {
        this._store = store;
        this._config = config;
        this._messenger = messenger;
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
