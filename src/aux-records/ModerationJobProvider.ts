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
import type { ModerationJob } from './ModerationStore';

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

    /**
     * Scans the given file for moderation labels.
     *
     * Returns a promise that resolves with the result of the scan.
     * Implementers should ensure that one label is returned per detected label and one per detected category.
     *
     * @param options the options for the scan.
     */
    scanFile(options: ScanFileOptions): Promise<ModerationFileScan>;
}

/**
 * Defines an interface that is able to filter files for a moderation job.
 */
export interface ModerationJobFilesFilter {
    /**
     * If provided, only files that were uploaded after this timestamp will be included.
     */
    uploadedAfterMs?: number;

    /**
     * If provided, only files that match one of the given extensions will be included.
     */
    fileExtensions?: string[];
}

export interface ScanFileOptions {
    /**
     * The name of the record that the file is in.
     */
    recordName: string;

    /**
     * The name of the file that should be scanned.
     */
    fileName: string;

    /**
     * The minimum confidence to consider a detected label.
     */
    minConfidence?: number;
}

/**
 * Defines an interface that represents the result of a file scan.
 */
export interface ModerationFileScan {
    /**
     * The name of the record that the file is associated with.
     */
    recordName: string;

    /**
     * The name of the file that was scanned.
     */
    fileName: string;

    /**
     * The labels that were detected in the file.
     * There should be one label per detected label and one per detected category.
     */
    labels: ModerationFileScanLabel[];

    /**
     * The version of the model that was used to scan the file.
     */
    modelVersion: string;
}

/**
 * Defines an interface that represents a label that was detected in a file scan.
 */
export interface ModerationFileScanLabel {
    /**
     * The name of the label.
     */
    name: string;

    /**
     * The category of the label.
     * Used to group similar labels together.
     */
    category?: string;

    /**
     * The confidence that the label is correct.
     * Should be a value between 0 and 1, where 0 is no confidence and 1 is full confidence.
     */
    confidence: number;
}
