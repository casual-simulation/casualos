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

export interface ModerationStore {
    /**
     * Saves the given inst report.
     * @param report The report to save.
     */
    saveUserInstReport(report: UserInstReport): Promise<void>;

    /**
     * Inserts the given moderation job.
     * @param job The job that should be saved.
     */
    addModerationJob(job: ModerationJob): Promise<void>;

    /**
     * Attempts to find the most recent job of the given type.
     * If no job is found, returns null.
     * @param type The type of the job.
     */
    findMostRecentJobOfType(
        type: ModerationJob['type']
    ): Promise<ModerationJob | null>;

    /**
     * Inserts the result of a file moderation scan.
     * @param result The result to save.
     */
    addFileModerationResult(result: ModerationFileScanResult): Promise<void>;
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

export interface ModerationJob {
    /**
     * The ID of the moderation job.
     */
    id: string;

    /**
     * The type of the moderation job.
     */
    type: 'files';

    /**
     * The ID of the s3 batch job that is being used to scan the files.
     */
    s3Id?: string;

    /**
     * The unix time in milliseconds that the job was created.
     */
    createdAtMs: number;

    /**
     * The unix time in milliseconds that the job was last updated.
     */
    updatedAtMs: number;
}

export interface ModerationFileScanResult {
    /**
     * The ID of the scan.
     */
    id: string;

    /**
     * The ID of the job that the scan is associated with.
     */
    jobId: string | null;

    /**
     * The name of the record that the file was stored inside.
     */
    recordName: string;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * Whether the file has detected labels that are banned.
     */
    appearsToMatchBannedContent: boolean;

    /**
     * The labels that were detected in the file.
     */
    labels: ModerationFileScanResultLabel[];

    /**
     * The version of the model that was used to scan the file.
     */
    modelVersion: string;

    /**
     * The unix time in milliseconds that the scan was created.
     */
    createdAtMs: number;

    /**
     * The unix time in milliseconds that the scan was last updated.
     */
    updatedAtMs: number;
}

export interface ModerationFileScanResultLabel {
    /**
     * The name of the label.
     */
    name: string;

    /**
     * The category of the label.
     */
    category?: string;

    /**
     * The confidence of the label.
     */
    confidence: number;
}
