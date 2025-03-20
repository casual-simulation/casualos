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
    ModerationFileScan,
    ModerationJobFilesFilter,
    ModerationJobProvider,
    ScanFileOptions,
} from './ModerationJobProvider';
import type { ModerationJob } from './ModerationStore';
import { v4 as uuid } from 'uuid';

/**
 * Defines a class that implements ModerationJobProvider for testing.
 */
export class MemoryModerationJobProvider implements ModerationJobProvider {
    private _jobs: MemoryModerationJob[] = [];

    get jobs() {
        return this._jobs;
    }

    async startFilesJob(
        filter: ModerationJobFilesFilter
    ): Promise<ModerationJob> {
        const job: MemoryModerationJob = {
            id: uuid(),
            type: 'files',
            filter,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
        };
        this._jobs.push(job);
        return job;
    }

    async scanFile(options: ScanFileOptions): Promise<ModerationFileScan> {
        return {
            recordName: options.recordName,
            fileName: options.fileName,
            labels: [],
            modelVersion: 'memory',
        };
    }
}

export interface MemoryModerationJob extends ModerationJob {
    filter: ModerationJobFilesFilter;
}
