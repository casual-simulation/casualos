import { ServerError } from '@casual-simulation/aux-common';
import {
    ModerationStore,
    ReportReason,
    UserInstReport,
} from './ModerationStore';
import { ZodIssue } from 'zod';
import { v4 as uuid } from 'uuid';
import { NotificationMessenger } from './NotificationMessenger';

/**
 * Defines a class that implements various moderation tasks.
 */
export class ModerationController {
    private _store: ModerationStore;
    private _messenger: NotificationMessenger;

    constructor(store: ModerationStore, messenger: NotificationMessenger) {
        this._store = store;
        this._messenger = messenger;
    }

    /**
     * Reports the given inst for a terms of service violation.
     * @param request The request.
     */
    async reportInst(request: ReportInstRequest): Promise<ReportInstResult> {
        try {
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

            await this._messenger.sendRecordNotification({
                timeMs: now,
                resource: 'user_inst_report',
                action: 'created',
                resourceId: id,
                recordName: request.recordName,
                inst: request.inst,
                report: userInstReport,
            });

            return {
                success: true,
                id: id,
            };
        } catch (err) {
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
    errorCode: ServerError | 'unacceptable_request';

    /**
     * The error message for the failure.
     */
    errorMessage: string;

    /**
     * The issues with parsing the request.
     */
    issues?: ZodIssue[];
}
