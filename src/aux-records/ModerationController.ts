import { ReportReason } from './ModerationStore';

/**
 * Defines a class that implements various moderation tasks.
 */
export class ModerationController {
    async reportInst(request: ReportInstRequest): Promise<ReportInstResult> {
        return null;
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
     * The session key of the user that reported the inst.
     */
    sessionKey: string | null;

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
