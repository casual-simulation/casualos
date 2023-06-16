import {
    FileRecordsStore,
    GetFileNameFromUrlResult,
    PresignFileReadRequest,
    PresignFileReadResult,
    signRequest,
} from '@casual-simulation/aux-records';
import {
    PresignFileUploadRequest,
    PresignFileUploadResult,
    GetFileRecordResult,
    AddFileResult,
    MarkFileRecordAsUploadedResult,
    EraseFileStoreResult,
    FileRecordsLookup,
    UpdateFileResult,
} from '@casual-simulation/aux-records';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-records/PolicyPermissions';
import AWS from 'aws-sdk';
import dynamodb from 'aws-sdk/clients/dynamodb';

export const EMPTY_STRING_SHA256_HASH_HEX =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Defines a class that can manage file records in S3.
 */
export class S3FileRecordsStore implements FileRecordsStore {
    private _region: string;
    private _bucket: string;
    private _storageClass: string;
    private _aws: typeof AWS;
    private _s3Host: string;
    private _s3Options: AWS.S3.ClientConfiguration;
    private _s3: AWS.S3;

    private _lookup: FileRecordsLookup;

    constructor(
        region: string,
        bucket: string,
        fileLookup: FileRecordsLookup,
        storageClass: string = 'STANDARD',
        aws: typeof AWS = AWS,
        s3Host: string = null,
        s3Options: AWS.S3.ClientConfiguration = {}
    ) {
        this._region = region;
        this._bucket = bucket;
        this._lookup = fileLookup;
        this._storageClass = storageClass;
        this._aws = aws;
        this._s3Host = s3Host;
        this._s3Options = s3Options;
    }

    getAllowedUploadHeaders(): string[] {
        return [
            'content-type',
            'content-length',
            'cache-control',
            'x-amz-acl',
            'x-amz-storage-class',
            'x-amz-security-token',
        ];
    }

    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        const host = this._fileHost();
        if (fileUrl.startsWith(host)) {
            let recordNameAndFileName = fileUrl.slice(host.length + 1);
            let firstSlash = recordNameAndFileName.indexOf('/');
            if (firstSlash < 0) {
                return {
                    success: false,
                    errorCode: 'unacceptable_url',
                    errorMessage: 'The URL does not match an expected format.',
                };
            }
            let recordName = recordNameAndFileName.slice(0, firstSlash);
            let fileName = recordNameAndFileName.slice(firstSlash + 1);

            if (recordName && fileName) {
                return {
                    success: true,
                    recordName,
                    fileName,
                };
            }
            return {
                success: false,
                errorCode: 'unacceptable_url',
                errorMessage: 'The URL does not match an expected format.',
            };
        }

        return {
            success: false,
            errorCode: 'unacceptable_url',
            errorMessage: 'The URL does not match an expected format.',
        };
    }

    async presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult> {
        const credentials = await this._getCredentials();

        const secretAccessKey = credentials
            ? credentials.secretAccessKey
            : null;
        const accessKeyId = credentials ? credentials.accessKeyId : null;

        const now = request.date ?? new Date();
        const fileUrl = this._fileUrl(request.recordName, request.fileName);
        const requiredHeaders = {
            'content-type': request.fileMimeType,
            'content-length': request.fileByteLength.toString(),
            'cache-control': 'max-age=31536000',
            'x-amz-acl': s3AclForMarkers(request.markers),
            'x-amz-storage-class': this._storageClass,
            host: fileUrl.host,
        };

        if (credentials && credentials.sessionToken) {
            (requiredHeaders as any)['x-amz-security-token'] =
                credentials.sessionToken;
        }

        const result = signRequest(
            {
                method: 'PUT',
                payloadSha256Hex: request.fileSha256Hex,
                headers: {
                    ...request.headers,
                    ...requiredHeaders,
                },
                queryString: {},
                path: fileUrl.pathname,
            },
            secretAccessKey,
            accessKeyId,
            now,
            this._region,
            's3'
        );

        return {
            success: true,
            uploadUrl: fileUrl.href,
            uploadHeaders: result.headers,
            uploadMethod: result.method,
        };
    }

    async presignFileRead(
        request: PresignFileReadRequest
    ): Promise<PresignFileReadResult> {
        const credentials = await this._getCredentials();

        const secretAccessKey = credentials
            ? credentials.secretAccessKey
            : null;
        const accessKeyId = credentials ? credentials.accessKeyId : null;

        const now = request.date ?? new Date();
        const fileUrl = this._fileUrl(request.recordName, request.fileName);
        const requiredHeaders = {
            host: fileUrl.host,
        };

        if (credentials && credentials.sessionToken) {
            (requiredHeaders as any)['x-amz-security-token'] =
                credentials.sessionToken;
        }

        const result = signRequest(
            {
                method: 'GET',
                payloadSha256Hex: EMPTY_STRING_SHA256_HASH_HEX,
                headers: {
                    ...request.headers,
                    ...requiredHeaders,
                },
                queryString: {
                    'response-cache-control': 'max-age=31536000',
                },
                path: fileUrl.pathname,
            },
            secretAccessKey,
            accessKeyId,
            now,
            this._region,
            's3'
        );

        const url = new URL(fileUrl.href);
        for (let key in result.queryString) {
            url.searchParams.set(key, result.queryString[key]);
        }

        return {
            success: true,
            requestUrl: url.href,
            requestHeaders: result.headers,
            requestMethod: result.method,
        };
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        try {
            const result = await this._lookup.getFileRecord(
                recordName,
                fileName
            );

            if (result) {
                const url = this._fileUrl(result.recordName, result.fileName);
                return {
                    success: true,
                    recordName: result.recordName,
                    fileName: result.fileName,
                    description: result.description,
                    publisherId: result.publisherId,
                    subjectId: result.subjectId,
                    sizeInBytes: result.sizeInBytes,
                    uploaded: result.uploaded,
                    url: url.href,
                    markers: result.markers,
                };
            } else {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            }
        } catch (err) {
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        markers: string[]
    ): Promise<AddFileResult> {
        return await this._lookup.addFileRecord(
            recordName,
            fileName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            markers
        );
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        return await this._lookup.updateFileRecord(
            recordName,
            fileName,
            markers
        );
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        return await this._lookup.setFileRecordAsUploaded(recordName, fileName);
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        try {
            await this._lookup.eraseFileRecord(recordName, fileName);

            const s3 = this._getS3();
            const key = this._fileKey(recordName, fileName);

            await s3
                .deleteObject({
                    Bucket: this._bucket,
                    Key: key,
                })
                .promise();

            return {
                success: true,
            };
        } catch (err) {
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    private _getCredentials(): Promise<{
        secretAccessKey: string;
        accessKeyId: string;
        sessionToken?: string;
    }> {
        return new Promise((resolve, reject) => {
            this._aws.config.getCredentials(function (err, credentials) {
                if (err) {
                    reject(err);
                } else {
                    resolve(credentials);
                }
            });
        });
    }

    private _getS3() {
        if (!this._s3) {
            this._s3 = new this._aws.S3(this._s3Options);
        }

        return this._s3;
    }

    private _fileUrl(recordName: string, fileName: string): URL {
        let filePath = this._fileKey(recordName, fileName);

        if (this._s3Host) {
            filePath = `${this._s3Host}/${this._bucket}/${filePath}`;
        }

        return new URL(filePath, `https://${this._bucket}.s3.amazonaws.com`);
    }

    private _fileHost() {
        if (this._s3Host) {
            return this._s3Host;
        }

        return `https://${this._bucket}.s3.amazonaws.com`;
    }

    private _fileKey(recordName: string, fileName: string): string {
        return `${recordName}/${fileName}`;
    }
}

/**
 * Gets the Access Control List (ACL) that should be used for files uploaded with the given markers.
 * @param markers The markers that are applied to the file.
 */
export function s3AclForMarkers(markers: readonly string[]): string {
    if (markers.some((m) => m === PUBLIC_READ_MARKER)) {
        return 'public-read';
    }

    return 'private';
}

/**
 * Defines the interface that file records stored in DynamoDB adhere to.
 */
interface StoredFile {
    /**
     * The name of the record that the file is stored in.
     */
    recordName: string;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The ID of the publisher that uploaded the file.
     */
    publisherId: string;

    /**
     * The ID of the user that was logged in when the file was uploaded.
     */
    subjectId: string;

    /**
     * The size of the file in bytes.
     */
    sizeInBytes: number;

    /**
     * The time that the file was published in miliseconds since January 1 1970 00:00:00 UTC.
     */
    publishTime: number;

    /**
     * The description of the file.
     */
    description: string;

    /**
     * The time that the file was uploaded. Null if the file has not been uploaded.
     */
    uploadTime: number;

    /**
     * The markers that have been applied to the file.
     */
    markers?: string[] | null;
}
