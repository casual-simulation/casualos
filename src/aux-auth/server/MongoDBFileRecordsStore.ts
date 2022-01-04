import {
    FileRecordsStore,
    PresignFileUploadRequest,
    PresignFileUploadResult,
    GetFileRecordResult,
    AddFileResult,
    MarkFileRecordAsUploadedResult,
} from '@casual-simulation/aux-records';
import { Collection } from 'mongodb';

/**
 * Defines a file records store that can store data in MongoDB.
 */
export class MongoDBFileRecordsStore implements FileRecordsStore {
    private _collection: Collection<FileRecord>;
    private _fileUploadUrl: string;

    constructor(collection: Collection<FileRecord>, fileUploadUrl: string) {
        this._collection = collection;
        this._fileUploadUrl = fileUploadUrl;
    }

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
            uploadUrl: `${this._fileUploadUrl}/${request.fileName}`,
        };
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
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

        return {
            success: true,
            fileName: record.fileName,
            recordName: record.recordName,
            url: `${this._fileUploadUrl}/${record.fileName}`,
            description: record.description,
            publisherId: record.publisherId,
            subjectId: record.subjectId,
            sizeInBytes: record.sizeInBytes,
            uploaded: record.uploaded,
        };
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string
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
        });

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
}

export interface FileRecord {
    recordName: string;
    fileName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    description: string;
    uploaded: boolean;
}
