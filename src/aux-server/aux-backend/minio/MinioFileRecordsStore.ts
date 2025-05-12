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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import type {
    AddFileResult,
    EraseFileStoreResult,
    FileRecordsLookup,
    FileRecordsStore,
    GetFileNameFromUrlResult,
    GetFileRecordResult,
    ListFilesLookupFailure,
    ListFilesStoreResult,
    MarkFileRecordAsUploadedResult,
    PresignFileReadRequest,
    PresignFileReadResult,
    PresignFileUploadRequest,
    PresignFileUploadResult,
    UpdateFileResult,
} from '@casual-simulation/aux-records';
import { signRequest } from '@casual-simulation/aux-records';
import * as Minio from 'minio';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import { z } from 'zod';

export const EMPTY_STRING_SHA256_HASH_HEX =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * A FileRecordsStore that uses Minio to store files.
 * Works almost exactly like the S3FileRecordsStore, but uses Minio instead.
 */
export class MinioFileRecordsStore
    implements FileRecordsStore, SubscriptionLike
{
    private _bucket: string;
    private _defaultBucket: string;
    private _lookup: FileRecordsLookup;
    private _client: Minio.Client;
    private _publicFilesUrl: string;
    private _clientOptions: Minio.ClientOptions;
    private _sub: Subscription;
    private _initPromise: Promise<void>;

    constructor(
        options: Minio.ClientOptions,
        bucket: string,
        defaultBucket: string,
        fileLookup: FileRecordsLookup,
        publicFilesUrl: string = null
    ) {
        this._bucket = bucket;
        this._defaultBucket = defaultBucket;
        this._lookup = fileLookup;
        this._clientOptions = options;
        this._publicFilesUrl = publicFilesUrl;
        this._sub = new Subscription();
        this._client = new Minio.Client(options);

        if (this._lookup.listUploadedFiles) {
            this.listUploadedFiles = async (
                recordName: string,
                fileName: string
            ) => {
                const result = await this._lookup.listUploadedFiles(
                    recordName,
                    fileName
                );

                if (!result.success) {
                    return result as ListFilesLookupFailure;
                } else {
                    const files = result.files.map(({ bucket, ...f }) => ({
                        ...f,
                        url: this._fileUrl(
                            recordName,
                            f.fileName,
                            bucket ?? this._bucket,
                            isPublicFile(f.markers)
                        ).href,
                    }));

                    return {
                        success: true,
                        files,
                    } as ListFilesStoreResult;
                }
            };
        }
    }

    init() {
        if (!this._initPromise) {
            this._initPromise = this._init();
        }
        return this._initPromise;
    }

    private async _init() {
        const notification = this._client.listenBucketNotification(
            this._bucket,
            '',
            '',
            ['s3:ObjectCreated:Put']
        );

        const listener = async (record: Minio.NotificationRecord) =>
            await this._onFileUploaded(record as MinioNotification);

        notification.on('notification', listener);
        this._sub.add(() => {
            notification.off('notification', listener);
        });

        await this._trySetupBucket(this._bucket);
    }

    private async _onFileUploaded(record: MinioNotification) {
        console.log('[MinioFileRecordsStore] Got file uploaded event:', record);
        const event = record;
        const key = event.s3.object.key;

        const firstSlash = key.indexOf('/');

        if (firstSlash < 0) {
            console.warn('[MinioFileRecordsStore] Unable to process key:', key);
            return;
        }

        const recordName = key.substring(0, firstSlash);
        const fileName = key.substring(firstSlash + 1);

        const result = await this.setFileRecordAsUploaded(recordName, fileName);

        if (result.success === false) {
            if (result.errorCode === 'file_not_found') {
                console.error('[MinioFileRecordsStore] File not found:', key);
            }
        } else {
            console.log(
                '[MinioFileRecordsStore] File marked as uploaded:',
                key
            );
        }
    }

    private async _trySetupBucket(bucketName: string): Promise<void> {
        const exists = await this._client.bucketExists(bucketName);
        if (!exists) {
            console.log(
                `[MinioFileRecordsStore] Bucket does not exist. Trying to create: ${bucketName}`
            );
            await this._client.makeBucket(bucketName);
        }

        let policy = await this._tryGetBucketPolicy(bucketName);

        const PublicReadGetObjectStatement = {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: `arn:aws:s3:::${bucketName}/*`,
            Condition: {
                StringEquals: {
                    's3:ExistingObjectTag/marker': 'publicRead',
                },
            },
        };

        let updatedPolicy = false;
        if (!policy) {
            policy = {
                Version: '2012-10-17',
                Statement: [PublicReadGetObjectStatement],
            };
            updatedPolicy = true;
        } else {
            if (
                !policy.Statement.some(
                    (s) => s.Sid === PublicReadGetObjectStatement.Sid
                )
            ) {
                policy.Statement.push(PublicReadGetObjectStatement);
                updatedPolicy = true;
            }
        }

        if (updatedPolicy) {
            console.log(
                `[MinioFileRecordsStore] Updating bucket policy for ${bucketName}:`,
                policy
            );
            await this._client.setBucketPolicy(
                bucketName,
                JSON.stringify(policy)
            );
        }
    }

    private async _tryGetBucketPolicy(
        bucketName: string
    ): Promise<MinioPolicy> {
        try {
            const p = await this._client.getBucketPolicy(bucketName);
            return minioPolicySchema.parse(JSON.parse(p));
        } catch (err) {
            if (err instanceof Minio.S3Error) {
                if (err.code === 'NoSuchBucketPolicy') {
                    return null;
                }
            }
            throw err;
        }
    }

    unsubscribe(): void {
        this._sub?.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    private get _host() {
        let scheme = this._clientOptions.useSSL ? 'https' : 'http';
        let port = this._clientOptions.port
            ? `:${this._clientOptions.port}`
            : '';
        return `${scheme}://${this._clientOptions.endPoint}${port}`;
    }

    private get _region() {
        return this._clientOptions.region;
    }

    listUploadedFiles?(
        recordName: string,
        fileName: string | null
    ): Promise<ListFilesStoreResult>;
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
        try {
            const url = new URL(fileUrl);
            if (url.pathname) {
                const recordNameAndFileName = url.pathname.slice(1);
                const firstSlash = recordNameAndFileName.indexOf('/');
                if (firstSlash < 0) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_url',
                        errorMessage:
                            'The URL does not match an expected format.',
                    };
                }
                const bucketName = decodeURIComponent(
                    recordNameAndFileName.slice(0, firstSlash)
                );
                const afterBucketName = recordNameAndFileName.slice(
                    firstSlash + 1
                );

                const secondSlash = afterBucketName.indexOf('/');
                if (secondSlash < 0) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_url',
                        errorMessage:
                            'The URL does not match an expected format.',
                    };
                }
                const recordName = decodeURIComponent(
                    afterBucketName.slice(0, secondSlash)
                );
                const fileName = decodeURIComponent(
                    afterBucketName.slice(secondSlash + 1)
                );

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
        } catch (err) {
            console.error(
                '[MinioFileRecordsStore] An error occurred while getting file name from URL:',
                err
            );
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
        const fileUrl = this._fileUrl(
            request.recordName,
            request.fileName,
            this._bucket,

            // Presigned file uploads always have to use an S3 URL
            false
        );
        const requiredHeaders = {
            'content-type': request.fileMimeType,
            'content-length': request.fileByteLength.toString(),
            'cache-control': 'max-age=31536000',
            'x-amz-tagging': s3TagForMarkers(request.markers),
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
                path: decodeURI(fileUrl.pathname),
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
        const fileUrl = this._fileUrl(
            request.recordName,
            request.fileName,
            this._bucket,

            // Presigned file reads always have to use an S3 URL
            false
        );
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
                path: decodeURI(fileUrl.pathname),
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
                const url = this._fileUrl(
                    result.recordName,
                    result.fileName,
                    result.bucket ?? this._defaultBucket,
                    isPublicFile(result.markers)
                );
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
            console.error(
                `[MinioFileRecordsStore] A server error occurred while getting a file record:`,
                err
            );
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
            this._bucket,
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

            const key = this._fileKey(recordName, fileName);

            await this._client.removeObject(this._bucket, key);

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                `[MinioFileRecordsStore] A server error occurred while erasing a file record:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    private async _getCredentials(): Promise<{
        secretAccessKey: string;
        accessKeyId: string;
        sessionToken?: string;
    }> {
        return {
            accessKeyId: this._clientOptions.accessKey,
            secretAccessKey: this._clientOptions.secretKey,
        };
    }

    private _fileUrl(
        recordName: string,
        fileName: string,
        bucket: string,
        isPublic: boolean
    ): URL {
        let filePath = this._fileKey(recordName, fileName);

        if (isPublic && this._publicFilesUrl) {
            return new URL(`${this._publicFilesUrl}/${filePath}`);
        }

        return new URL(`${bucket}/${filePath}`, this._host);
    }

    private _fileKey(recordName: string, fileName: string): string {
        return `${recordName}/${fileName}`;
    }
}

/**
 * Gets the tags that should be used for files uploaded with the given markers.
 * @param markers The markers that are applied to the file.
 */
export function s3TagForMarkers(markers: readonly string[]): string {
    const marker = isPublicFile(markers) ? 'publicRead' : 'private';
    return `marker=${marker}`;
}

/**
 * Determines whether the given markers indicate that the file is public.
 * @param markers The markers that are applied to the file.
 */
export function isPublicFile(markers: readonly string[]): boolean {
    return markers.some((m) => m === PUBLIC_READ_MARKER);
}

export interface MinioNotification {
    eventVersion: string;
    eventSource: string;
    awsRegion: string;
    eventTime: string;
    eventName: string;
    userIdentity: {
        principalId: string;
    };
    requestParameters: {
        principalId: string;
        region: string;
        sourceIPAddress: string;
    };
    responseElements: Record<string, string>;
    s3: {
        s3SchemaVersion: string;
        configurationId: string;
        bucket: {
            name: string;
            ownerIdentity: any;
            arn: string;
        };
        object: {
            key: string;
            size: number;
            eTag: string;
            contentType: string;
            userMetadata: Record<string, string>;
            sequencer: string;
        };
    };
    source: {
        host: string;
        port: string;
        userAgent: string;
    };
}

const minioPolicySchema = z.object({
    Version: z.string(),
    Statement: z.array(
        z.object({
            Sid: z.string().optional(),
            Effect: z.string(),
            Action: z.array(z.string()),
            Resource: z.union([z.string(), z.array(z.string())]),
            Condition: z.any().optional(),
        })
    ),
});

/**
 * A policy that can be used with Minio.
 * See https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html
 */
export type MinioPolicy = z.infer<typeof minioPolicySchema>;

// eventVersion: '2.0',
// [Server] [Backend] [Run]   eventSource: 'minio:s3',
// [Server] [Backend] [Run]   awsRegion: '',
// [Server] [Backend] [Run]   eventTime: '2024-07-23T21:44:42.847Z',
// [Server] [Backend] [Run]   eventName: 's3:ObjectCreated:Put',
// [Server] [Backend] [Run]   userIdentity: { principalId: 'minioadmin' },
// [Server] [Backend] [Run]   requestParameters: {
// [Server] [Backend] [Run]     principalId: 'minioadmin',
// [Server] [Backend] [Run]     region: '',
// [Server] [Backend] [Run]     sourceIPAddress: '172.26.176.1'
// [Server] [Backend] [Run]   },
// [Server] [Backend] [Run]   responseElements: {
// [Server] [Backend] [Run]     'x-amz-id-2': 'dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8',
// [Server] [Backend] [Run]     'x-amz-request-id': '17E4F5AD6FB91D9A',
// [Server] [Backend] [Run]     'x-minio-deployment-id': '1fbfa9d5-2278-4d2f-8153-be2d44856442',
// [Server] [Backend] [Run]     'x-minio-origin-endpoint': 'http://10.4.1.60:9000'
// [Server] [Backend] [Run]   },
// [Server] [Backend] [Run]   s3: {
// [Server] [Backend] [Run]     s3SchemaVersion: '1.0',
// [Server] [Backend] [Run]     configurationId: 'Config',
// [Server] [Backend] [Run]     bucket: {
// [Server] [Backend] [Run]       name: 'files',
// [Server] [Backend] [Run]       ownerIdentity: [Object],
// [Server] [Backend] [Run]       arn: 'arn:aws:s3:::files'
// [Server] [Backend] [Run]     },
// [Server] [Backend] [Run]     object: {
// [Server] [Backend] [Run]       key: '0296afb8-6082-4130-9941-9e503060a8f9/590044b30f770994d14a73a591995273a2ecb3f7e3fdc8a9e598a9dea422c934.txt',
// [Server] [Backend] [Run]       size: 16,
// [Server] [Backend] [Run]       eTag: '03fe5be4bc50f5e9a6cfd8d7f4a2d658',
// [Server] [Backend] [Run]       contentType: 'text/plain',
// [Server] [Backend] [Run]       userMetadata: [Object],
// [Server] [Backend] [Run]       sequencer: '17E4F5AD6FDC24FA'
// [Server] [Backend] [Run]     }
// [Server] [Backend] [Run]   },
// [Server] [Backend] [Run]   source: {
// [Server] [Backend] [Run]     host: '172.26.176.1',
// [Server] [Backend] [Run]     port: '',
// [Server] [Backend] [Run]     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
// [Server] [Backend] [Run]   }
