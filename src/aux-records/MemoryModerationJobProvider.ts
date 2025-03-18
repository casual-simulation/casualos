import { injectable } from 'inversify';
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
@injectable()
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
