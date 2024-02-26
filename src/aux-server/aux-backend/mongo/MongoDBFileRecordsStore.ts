import {
    FileRecordsStore,
    PresignFileUploadRequest,
    PresignFileUploadResult,
    GetFileRecordResult,
    AddFileResult,
    MarkFileRecordAsUploadedResult,
    EraseFileStoreResult,
    GetFileNameFromUrlResult,
    UpdateFileResult,
    PresignFileReadRequest,
    PresignFileReadResult,
    FileRecordsLookup,
    FileRecord,
    ListFilesLookupResult,
    ListFilesStoreResult,
    ListFilesStoreFailure,
} from '@casual-simulation/aux-records';
import { Collection, FilterQuery } from 'mongodb';

/**
 * Defines a file records store that can store data in MongoDB.
 */
export class MongoDBFileRecordsStore implements FileRecordsStore {
    private _lookup: FileRecordsLookup;
    private _fileUploadUrl: string;

    constructor(lookup: FileRecordsLookup, fileUploadUrl: string) {
        this._lookup = lookup;
        this._fileUploadUrl = fileUploadUrl;

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
                    return result as ListFilesStoreFailure;
                }
                return {
                    success: true,
                    files: result.files.map((f) => ({
                        ...f,
                        url: this._fileUrl(recordName, f.fileName),
                    })),
                    totalCount: result.totalCount,
                };
            };
        }
    }

    getAllowedUploadHeaders(): string[] {
        return ['record-name', 'content-type'];
    }

    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        if (fileUrl.startsWith(this._fileUploadUrl)) {
            let [recordName, fileName] = fileUrl
                .slice(this._fileUploadUrl.length + 1)
                .split('/');
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

    listUploadedFiles?(
        recordName: string,
        fileName: string
    ): Promise<ListFilesStoreResult>;

    async presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult> {
        return {
            success: true,
            uploadHeaders: {
                ...request.headers,
                'record-name': request.recordName,
                'content-type': request.fileMimeType,
            },
            uploadMethod: 'POST',
            uploadUrl: this._fileUrl(request.recordName, request.fileName),
        };
    }

    async presignFileRead(
        request: PresignFileReadRequest
    ): Promise<PresignFileReadResult> {
        return {
            success: true,
            requestHeaders: {
                ...request.headers,
                'record-name': request.recordName,
            },
            requestMethod: 'GET',
            requestUrl: this._fileUrl(request.recordName, request.fileName),
        };
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        const record = await this._lookup.getFileRecord(recordName, fileName);

        if (!record) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
            fileName: record.fileName,
            recordName: record.recordName,
            url: this._fileUrl(recordName, record.fileName),
            description: record.description,
            publisherId: record.publisherId,
            subjectId: record.subjectId,
            sizeInBytes: record.sizeInBytes,
            uploaded: record.uploaded,
            markers: record.markers,
        };
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
            null, // MongoDB does not have buckets
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

            return {
                success: true,
            };
        } catch (err) {
            console.error(
                `[MongoDBFileRecordsStore] A server error occurred while erasing a file record:`,
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
            };
        }
    }

    private _fileUrl(recordName: string, fileName: string): string {
        return `${this._fileUploadUrl}/${encodeURIComponent(
            recordName
        )}/${encodeURIComponent(fileName)}`;
    }
}

export class MongoDBFileRecordsLookup implements FileRecordsLookup {
    private _collection: Collection<MongoFileRecord>;

    constructor(collection: Collection<MongoFileRecord>) {
        this._collection = collection;
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<FileRecord> {
        const record = await this._collection.findOne({
            recordName,
            fileName,
        });

        if (!record) {
            return null;
        }

        return {
            fileName: record.fileName,
            recordName: record.recordName,
            description: record.description,
            publisherId: record.publisherId,
            subjectId: record.subjectId,
            sizeInBytes: record.sizeInBytes,
            uploaded: record.uploaded,
            bucket: record.bucket,
            markers: record.markers,
        };
    }

    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesLookupResult> {
        let query = {
            recordName: recordName,
            uploaded: true,
        } as FilterQuery<MongoFileRecord>;
        if (!!fileName) {
            query.fileName = { $gt: fileName };
        }

        const count = await this._collection.count({
            recordName: recordName,
            uploaded: true,
        });

        const files = await this._collection
            .find(query)
            .sort({ fileName: 1 })
            .limit(10)
            .toArray();

        return {
            success: true,
            files: files.map((f) => ({
                fileName: f.fileName,
                description: f.description,
                sizeInBytes: f.sizeInBytes,
                markers: f.markers,
                uploaded: f.uploaded,
                bucket: f.bucket,
            })),
            totalCount: count,
        };
    }

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
        const record = await this._collection.findOne({
            recordName,
            fileName,
        });

        if (record) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        await this._collection.insertOne({
            recordName,
            fileName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            uploaded: false,
            bucket,
            markers,
        });

        return {
            success: true,
        };
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        const result = await this._collection.updateOne(
            {
                recordName,
                fileName,
            },
            {
                $set: {
                    markers,
                },
            }
        );

        if (result.modifiedCount <= 0) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        const record = await this._collection.findOne({
            recordName,
            fileName,
        });

        if (!record) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        await this._collection.updateOne(
            {
                recordName,
                fileName,
            },
            {
                $set: {
                    uploaded: true,
                },
            }
        );

        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const result = await this._collection.deleteOne({
            recordName,
            fileName,
        });

        if (result.deletedCount <= 0) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
        };
    }
}

export interface MongoFileRecord {
    recordName: string;
    fileName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    description: string;
    uploaded: boolean;
    bucket: string;
    markers?: string[];
}
