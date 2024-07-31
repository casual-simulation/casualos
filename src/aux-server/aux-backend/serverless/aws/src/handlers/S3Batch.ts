// invocation schema version = 2.0

export interface S3BatchEvent {
    invocationSchemaVersion: string;
    invocationId: string;
    job: S3BatchEventJob;
    tasks: S3BatchEventTask[];
}

export interface S3BatchEventJob {
    id: string;
    userArguments: Record<string, string>;
}

export interface S3BatchEventTask {
    taskId: string;
    s3Key: string;
    s3VersionId: string | null;
    s3Bucket: string;
}

export interface S3BatchResult {
    invocationSchemaVersion: string;
    treatMissingKeysAs: S3BatchResultResultCode;
    invocationId: string;
    results: S3BatchResultResult[];
}

export type S3BatchResultResultCode =
    | 'Succeeded'
    | 'TemporaryFailure'
    | 'PermanentFailure';

export interface S3BatchResultResult {
    taskId: string;
    resultCode: S3BatchResultResultCode;
    resultString: string;
}
