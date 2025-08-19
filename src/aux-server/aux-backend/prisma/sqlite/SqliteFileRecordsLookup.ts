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
    AddFileResult,
    MarkFileRecordAsUploadedResult,
    EraseFileStoreResult,
} from '@casual-simulation/aux-records';

import type {
    FileRecord,
    FileRecordsLookup,
    ListAllFilesFilter,
    ListAllFilesResult,
    ListFilesLookupResult,
    UpdateFileResult,
} from '@casual-simulation/aux-records/FileRecordsStore';
import type { PrismaClient } from '../generated-sqlite';
import { Prisma } from '../generated-sqlite';
import { convertMarkers } from '../Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';

const TRACE_NAME = 'SqliteFileRecordsLookup';

/**
 * Defines a class that can manage file records in Prisma.
 */
export class SqliteFileRecordsLookup implements FileRecordsLookup {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
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
                markers: convertMarkers(result.markers as string[]),
                publisherId: result.publisherId,
                subjectId: result.subjectId,
                uploaded: !result.uploadedAt
                    ? false
                    : result.uploadedAt <= new Date(),
                bucket: result.bucket,
            };
        } else {
            return null;
        }
    }

    @traced(TRACE_NAME)
    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesLookupResult> {
        let query: Prisma.FileRecordWhereInput = {
            recordName: recordName,
            uploadedAt: { not: null },
        };
        if (!!fileName) {
            query.fileName = { gt: fileName };
        }
        const result = await this._client.fileRecord.findMany({
            where: query,
            orderBy: {
                fileName: 'asc',
            },
            select: {
                fileName: true,
                sizeInBytes: true,
                markers: true,
                description: true,
                uploadedAt: true,
                bucket: true,
            },
            take: 10,
        });

        const count = await this._client.fileRecord.count({
            where: {
                recordName: recordName,
                uploadedAt: { not: null },
            },
        });

        const now = new Date();
        return {
            success: true,
            files: result.map((r) => ({
                fileName: r.fileName,
                sizeInBytes: Number(r.sizeInBytes),
                markers: convertMarkers(r.markers as string[]),
                description: r.description,
                uploaded: r.uploadedAt < now,
                bucket: r.bucket,
            })),
            totalCount: count,
        };
    }

    @traced(TRACE_NAME)
    async listAllUploadedFilesMatching(
        filter: ListAllFilesFilter
    ): Promise<ListAllFilesResult> {
        let query: Prisma.FileRecordWhereInput = {
            uploadedAt: { not: null },
        };

        if (!!filter.uploadedAfterMs) {
            query.uploadedAt = { gt: new Date(filter.uploadedAfterMs) };
        }

        if (!!filter.fileExtensions) {
            query.OR = [];
            for (let ext of filter.fileExtensions) {
                query.OR.push({
                    fileName: {
                        endsWith: ext,
                    },
                });
            }
        }

        const result = await this._client.fileRecord.findMany({
            where: query,
            orderBy: {
                fileName: 'asc',
            },
            select: {
                recordName: true,
                fileName: true,
                bucket: true,
            },
            take: 10,
        });

        return {
            success: true,
            files: result,
        };
    }

    @traced(TRACE_NAME)
    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        bucket: string,
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
                    bucket,
                    uploadedAt: null,
                },
            });
            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
                '[SqliteFileRecordsLookup] An error occurred whild adding a file.',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
                    '[SqliteFileRecordsLookup] An error occurred while updating a file.',
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

    @traced(TRACE_NAME)
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
                    uploadedAt: { equals: null },
                },
                data: {
                    uploadedAt: new Date(),
                },
            });

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
                    '[SqliteFileRecordsLookup] An error occurred while marking a file as uploaded.',
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

    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

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
                    '[SqliteFileRecordsLookup] An error occurred while deleting a file.',
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
