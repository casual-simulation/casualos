import {
    ModerationFileScan,
    ModerationJob,
    ModerationJobFilesFilter,
    ModerationJobProvider,
    ScanFileOptions,
} from '@casual-simulation/aux-records';
import { S3FileRecordsStore } from './S3FileRecordsStore';
import {
    DetectModerationLabelsCommandInput,
    Rekognition,
} from '@aws-sdk/client-rekognition';
import {
    JobManifestGeneratorFilter,
    S3Control,
} from '@aws-sdk/client-s3-control';
import { v4 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'RekognitionModerationJobProvider';

export interface RekognitionModerationJobProviderOptions {
    /**
     * The store that should be used to store and lookup file records.
     */
    filesStore: S3FileRecordsStore;

    /**
     * The Rekognition client that should be used to scan files.
     */
    rekognition: Rekognition;

    /**
     * The S3 client that should be used to create jobs.
     */
    s3Control: S3Control;

    /**
     * Options specific to the files job.
     */
    filesJob: RekognitionModerationFileJobOptions;
}

export interface RekognitionModerationFileJobOptions {
    /**
     * The ARN lambda function that should be invoked to process the files.
     */
    lambdaFunctionArn: string;

    /**
     * The bucket that should be scanned.
     */
    sourceBucket: string;

    /**
     * The bucket that reports should be placed in.
     */
    reportBucket: string;

    /**
     * The priority of jobs that are created.
     */
    priority: number;

    /**
     * The ARN of the role that should be used to run the job.
     */
    roleArn: string;

    /**
     * The ARN of the custom moderation model that should be used.
     */
    projectVersionArn?: string;

    /**
     * The tags that should be applied to the job.
     */
    tags?: {
        key: string;
        value: string;
    }[];
}

/**
 * Defines a class that implements ModerationJobProvider using AWS Rekognition.
 */
export class RekognitionModerationJobProvider implements ModerationJobProvider {
    private _filesStore: S3FileRecordsStore;
    private _rekognition: Rekognition;
    private _s3: S3Control;
    private _filesOptions: RekognitionModerationFileJobOptions;

    constructor(options: RekognitionModerationJobProviderOptions) {
        this._filesStore = options.filesStore;
        this._rekognition = options.rekognition;
        this._s3 = options.s3Control;
        this._filesOptions = options.filesJob;
    }

    @traced(TRACE_NAME)
    async startFilesJob(
        filter: ModerationJobFilesFilter
    ): Promise<ModerationJob> {
        const jobId = uuid();

        const manifestFilter: JobManifestGeneratorFilter = {};

        if (typeof filter.createdAfterMs === 'number') {
            manifestFilter.CreatedAfter = new Date(filter.createdAfterMs);
        }
        if (typeof filter.createdBeforeMs === 'number') {
            manifestFilter.CreatedBefore = new Date(filter.createdBeforeMs);
        }
        if (typeof filter.keyNameConstraint === 'object') {
            manifestFilter.KeyNameConstraint = {};
            if (filter.keyNameConstraint.matchAnyPrefix) {
                manifestFilter.KeyNameConstraint.MatchAnyPrefix =
                    filter.keyNameConstraint.matchAnyPrefix;
            }
            if (filter.keyNameConstraint.matchAnySubstring) {
                manifestFilter.KeyNameConstraint.MatchAnySubstring =
                    filter.keyNameConstraint.matchAnySubstring;
            }
            if (filter.keyNameConstraint.matchAnySuffix) {
                manifestFilter.KeyNameConstraint.MatchAnySuffix =
                    filter.keyNameConstraint.matchAnySuffix;
            }
        }

        const job = await this._s3.createJob({
            Priority: this._filesOptions.priority,
            Tags: this._filesOptions.tags?.map((t) => ({
                Key: t.key,
                Value: t.value,
            })),
            Operation: {
                LambdaInvoke: {
                    FunctionArn: this._filesOptions.lambdaFunctionArn,
                    InvocationSchemaVersion: '2.0',
                    UserArguments: {
                        jobId: jobId,
                    },
                },
            },
            ManifestGenerator: {
                S3JobManifestGenerator: {
                    EnableManifestOutput: false,
                    SourceBucket: this._filesOptions.sourceBucket,
                    Filter: manifestFilter,
                },
            },
            Report: {
                Enabled: true,
                Bucket: this._filesOptions.reportBucket,
            },
            RoleArn: this._filesOptions.roleArn,
        });

        return {
            id: jobId,
            type: 'files',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            s3Id: job.JobId,
        };
    }

    @traced(TRACE_NAME)
    async scanFile(options: ScanFileOptions): Promise<ModerationFileScan> {
        const file = await this._filesStore.getS3ObjectInfo(
            options.recordName,
            options.fileName
        );
        const args: DetectModerationLabelsCommandInput = {
            Image: {
                S3Object: {
                    Bucket: file.bucket,
                    Name: file.name,
                },
            },
        };

        if (typeof this._filesOptions.projectVersionArn === 'string') {
            args.ProjectVersion = this._filesOptions.projectVersionArn;
        }

        if (typeof options.minConfidence === 'number') {
            args.MinConfidence = options.minConfidence;
        }

        const result = await this._rekognition.detectModerationLabels(args);

        return {
            fileName: options.fileName,
            recordName: options.recordName,
            labels: (result.ModerationLabels ?? []).map((l) => ({
                name: l.Name,
                category: l.ParentName || undefined,
                confidence: l.Confidence,
            })),
            modelVersion: result.ModerationModelVersion,
        };
    }
}
