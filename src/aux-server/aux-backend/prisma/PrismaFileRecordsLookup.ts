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
} from '@casual-simulation/aux-records';
import {
    FileRecord,
    FileRecordsLookup,
    UpdateFileResult,
} from '@casual-simulation/aux-records/FileRecordsStore';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-records/PolicyPermissions';
import { Prisma, PrismaClient } from '@prisma/client';
import { convertMarkers } from './Utils';

/**
 * Defines a class that can manage file records in Prisma.
 */
export class PrismaFileRecordsLookup implements FileRecordsLookup {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<FileRecord | null> {
        const result = await this._client.fileRecord.findUnique({
            where: {
                recordName_fileName: {
                    recordName: recordName,
                    fileName: fileName,
                },
            },
        });

        if (result) {
            return {
                recordName: result.recordName,
                fileName: result.fileName,
                description: result.description,
                sizeInBytes: Number(result.sizeInBytes),
                markers: convertMarkers(result.markers),
                publisherId: result.publisherId,
                subjectId: result.subjectId,
                uploaded: !result.uploadedAt
                    ? false
                    : result.uploadedAt <= new Date(),
            };
        } else {
            return null;
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
        try {
            await this._client.fileRecord.create({
                data: {
                    recordName,
                    fileName,
                    publisherId,
                    subjectId,
                    sizeInBytes,
                    description,
                    markers,
                    uploadedAt: null,
                },
            });
            return {
                success: true,
            };
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2002') {
                    return {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: 'The file already exists.',
                    };
                }
            }
            console.error(
                '[PrismaFileRecordsLookup] An error occurred whild adding a file.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        try {
            await this._client.fileRecord.update({
                where: {
                    recordName_fileName: {
                        recordName,
                        fileName,
                    },
                },
                data: {
                    markers,
                },
            });

            return {
                success: true,
            };
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2025'
            ) {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            } else {
                console.error(
                    '[PrismaFileRecordsLookup] An error occurred while updating a file.',
                    err
                );
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An unexpected error occurred.',
                };
            }
        }
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        try {
            await this._client.fileRecord.update({
                where: {
                    recordName_fileName: {
                        recordName,
                        fileName,
                    },
                },
                data: {
                    uploadedAt: new Date(),
                },
            });

            return {
                success: true,
            };
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2025'
            ) {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            } else {
                console.error(
                    '[PrismaFileRecordsLookup] An error occurred while marking a file as uploaded.',
                    err
                );
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An unexpected error occurred.',
                };
            }
        }
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        try {
            await this._client.fileRecord.delete({
                where: {
                    recordName_fileName: {
                        recordName,
                        fileName,
                    },
                },
            });

            return {
                success: true,
            };
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2025'
            ) {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            } else {
                console.error(
                    '[PrismaFileRecordsLookup] An error occurred while deleting a file.',
                    err
                );
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An unexpected error occurred.',
                };
            }
        }
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
