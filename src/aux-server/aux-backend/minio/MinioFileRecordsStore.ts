import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import {
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
    signRequest,
    UpdateFileResult,
} from '@casual-simulation/aux-records';
import * as Minio from 'minio';
import { Subscription, SubscriptionLike } from 'rxjs';

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
            await this._onFileUploaded(record);

        notification.on('notification', listener);
        this._sub.add(() => {
            notification.off('notification', listener);
        });

        await this._trySetupBucket(this._bucket);
    }

    private async _onFileUploaded(record: Minio.NotificationRecord) {
        console.log('[MinioFileRecordsStore] Got file uploaded event:', record);
        const event = record as any;
        const key = event.key;

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
                const recordName = decodeURIComponent(
                    recordNameAndFileName.slice(0, firstSlash)
                );
                const fileName = decodeURIComponent(
                    recordNameAndFileName.slice(firstSlash + 1)
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
            'x-amz-acl': s3AclForMarkers(request.markers),
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
 * Gets the Access Control List (ACL) that should be used for files uploaded with the given markers.
 * @param markers The markers that are applied to the file.
 */
export function s3AclForMarkers(markers: readonly string[]): string {
    if (isPublicFile(markers)) {
        return 'public-read';
    }

    return 'private';
}

/**
 * Determines whether the given markers indicate that the file is public.
 * @param markers The markers that are applied to the file.
 */
export function isPublicFile(markers: readonly string[]): boolean {
    return markers.some((m) => m === PUBLIC_READ_MARKER);
}
