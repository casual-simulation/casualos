/**
 * Defines a class that is able to store moderation events.
 */
export interface ModerationStore {
    /**
     * Saves the given inst report.
     * @param report The report to save.
     */
    saveUserInstReport(report: UserInstReport): Promise<void>;
}

export interface UserInstReport {
    /**
     * The ID of the report.
     */
    id: string;

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
     * The permalink that was reported.
     */
    reportedPermalink: string;

    /**
     * The unix timestamp in milliseconds when the report was created.
     */
    createdAtMs: number;

    /**
     * The unix timestamp in milliseconds when the report was last updated.
     */
    updatedAtMs: number;
}

export type ReportReason =
    | 'poor-performance'
    | 'spam'
    | 'harassment'
    | 'copyright-infringement'
    | 'obscene'
    | 'illegal'
    | 'other';
