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
    ModerationJob,
    ModerationJobFilesFilter,
    ModerationJobProvider,
    ScanFileOptions,
} from '@casual-simulation/aux-records';
import type { S3FileRecordsStore } from './S3FileRecordsStore';
import type {
    DetectModerationLabelsCommandInput,
    Rekognition,
} from '@aws-sdk/client-rekognition';
import type {
    CreateJobCommandInput,
    S3ControlClient,
} from '@aws-sdk/client-s3-control';
import { CreateJobCommand } from '@aws-sdk/client-s3-control';
import { v4 as uuid } from 'uuid';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { S3 } from '@aws-sdk/client-s3';

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
    s3Control: S3ControlClient;

    /**
     * The S3 client that should be used to store manifest files.
     */
    s3: S3;

    /**
     * Options specific to the files job.
     */
    filesJob: RekognitionModerationFileJobOptions;
}

export interface RekognitionModerationFileJobOptions {
    /**
     * The AWS Account ID that should be used to create the job.
     */
    accountId: string;

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
    private _s3Control: S3ControlClient;
    private _s3: S3;
    private _filesOptions: RekognitionModerationFileJobOptions;

    constructor(options: RekognitionModerationJobProviderOptions) {
        this._filesStore = options.filesStore;
        this._rekognition = options.rekognition;
        this._s3Control = options.s3Control;
        this._s3 = options.s3;
        this._filesOptions = options.filesJob;
    }

    @traced(TRACE_NAME)
    async startFilesJob(
        filter: ModerationJobFilesFilter
    ): Promise<ModerationJob> {
        const jobId = uuid();

        const files = await this._filesStore.listAllUploadedFilesMatching(
            filter
        );

        if (files.success === false) {
            console.error('Error listing files:', files);
            throw new Error('Error listing files');
        }

        console.log(
            `[RekognitionModerationJobProvider] Generating manifest for ${files.files.length} files.`
        );

        let manifest = '';
        for (let file of files.files) {
            const key = this._filesStore.getFileKey(
                file.recordName,
                file.fileName
            );
            manifest += `${
                file.bucket ?? this._filesOptions.sourceBucket
            },${key}\n`;
        }

        const manifestKey = `${jobId}.manifest.csv`;

        const manifestResult = await this._s3.putObject({
            Bucket: this._filesOptions.reportBucket,
            Key: manifestKey,
            Body: manifest,
        });

        console.log(
            `[RekognitionModerationJobProvider] Manifest uploaded to ${this._filesOptions.reportBucket}/${manifestKey}.`
        );

        const input: CreateJobCommandInput = {
            ClientRequestToken: jobId,
            AccountId: this._filesOptions.accountId,
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
            Manifest: {
                Location: {
                    ObjectArn: `arn:aws:s3:::${this._filesOptions.reportBucket}/${manifestKey}`,
                    ETag: manifestResult.ETag,
                },
                Spec: {
                    Format: 'S3BatchOperations_CSV_20180820',
                    Fields: ['Bucket', 'Key'],
                },
            },
            Report: {
                Enabled: true,
                Bucket: `arn:aws:s3:::${this._filesOptions.reportBucket}`,
                Format: 'Report_CSV_20180820',
                ReportScope: 'AllTasks',
                Prefix: 'reports',
            },
            RoleArn: this._filesOptions.roleArn,
        };

        const job = await this._s3Control.send(new CreateJobCommand(input));
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
