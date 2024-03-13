import {
    FileRecordsStore,
    GetFileNameFromUrlResult,
    ListFilesLookupFailure,
    ListFilesStoreResult,
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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { S3, S3ClientConfig } from '@aws-sdk/client-s3';
import {
    AwsCredentialIdentityProvider,
    AwsCredentialIdentity,
} from '@aws-sdk/types';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export const EMPTY_STRING_SHA256_HASH_HEX =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Defines a class that can manage file records in S3.
 */
export class S3FileRecordsStore implements FileRecordsStore {
    private _region: string;
    private _bucket: string;
    private _defaultBucket: string;
    private _storageClass: string;
    private _s3Host: string;
    private _s3: S3;
    private _credentialProvider: AwsCredentialIdentityProvider;
    private _publicFilesUrl: string | null;

    private _lookup: FileRecordsLookup;

    constructor(
        region: string,
        bucket: string,
        defaultBucket: string,
        fileLookup: FileRecordsLookup,
        storageClass: string = 'STANDARD',
        s3: S3,
        s3Host: string = null,
        credentialProvider: AwsCredentialIdentityProvider = fromNodeProviderChain(),
        publicFilesUrl: string = null
    ) {
        this._region = region;
        this._bucket = bucket;
        this._defaultBucket = defaultBucket;
        this._lookup = fileLookup;
        this._storageClass = storageClass;
        this._s3 = s3;
        this._s3Host = s3Host;
        this._credentialProvider = credentialProvider;
        this._publicFilesUrl = publicFilesUrl;

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

    listUploadedFiles?(
        recordName: string,
        fileName: string
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
            if (this._s3Host) {
                if (fileUrl.startsWith(this._s3Host)) {
                    const recordNameAndFileName = fileUrl.slice(
                        this._s3Host.length + 1
                    );
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
                        errorMessage:
                            'The URL does not match an expected format.',
                    };
                }

                return {
                    success: false,
                    errorCode: 'unacceptable_url',
                    errorMessage: 'The URL does not match an expected format.',
                };
            }

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
                '[S3FileRecordsStore] An error occurred while getting file name from URL:',
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
                `[S3FileRecordsStore] A server error occurred while getting a file record:`,
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

            await this._s3.deleteObject({
                Bucket: this._bucket,
                Key: key,
            });

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                `[S3FileRecordsStore] A server error occurred while erasing a file record:`,
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
        return await this._credentialProvider();
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

        if (this._s3Host) {
            filePath = `${this._s3Host}/${bucket}/${filePath}`;
        }

        return new URL(filePath, `https://${bucket}.s3.amazonaws.com`);
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
