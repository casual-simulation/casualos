import { ModerationJob } from './ModerationStore';

/**
 * Defines a class that is able to start moderation jobs.
 * This can include scanning files, messages, etc.
 */
export interface ModerationJobProvider {
    /**
     * Starts a moderation scan for files with the given filter.
     * Returns the ID of the job.
     * @param filter The filter to use.
     */
    startFilesJob(filter: ModerationJobFilesFilter): Promise<ModerationJob>;
}

/**
 * Defines an interface that is able to filter files for a moderation job.
 */
export interface ModerationJobFilesFilter {
    /**
     * If provided, only files that were created after this timestamp will be included.
     * Time is in unix time in milliseconds.
     */
    createdAfterMs?: number;

    /**
     * If provided, only files that were created before this timestamp will be included.
     * Time is in unix time in milliseconds.
     */
    createdBeforeMs?: number;

    /**
     * Constraints on the name of files that should be included in the job.
     */
    keyNameConstraint?: {
        /**
         * Includes files that match any of the given substrings.
         */
        matchAnySubstring?: string[];

        /**
         * Includes files that match any of the given prefixes.
         */
        matchAnyPrefix?: string[];

        /**
         * Includes files that match any of the given suffixes.
         */
        matchAnySuffix?: string[];
    };
}
