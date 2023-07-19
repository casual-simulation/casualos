import { sortBy } from 'lodash';
import {
    AddFileResult,
    EraseFileStoreResult,
    FileRecord,
    FileRecordsLookup,
    FileRecordsStore,
    GetFileNameFromUrlResult,
    GetFileRecordResult,
    ListFilesLookupResult,
    ListFilesStoreResult,
    MarkFileRecordAsUploadedResult,
    PresignFileReadRequest,
    PresignFileReadResult,
    PresignFileUploadRequest,
    PresignFileUploadResult,
    UpdateFileResult,
} from './FileRecordsStore';

export class MemoryFileRecordsStore implements FileRecordsStore {
    private _files: Map<string, StoredFile> = new Map();
    private _fileUploadUrl: string = 'http://localhost:9191';

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
            uploadUrl: `${this._fileUploadUrl}/${request.recordName}/${request.fileName}`,
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
            requestUrl: `${this._fileUploadUrl}/${request.recordName}/${request.fileName}`,
        };
    }

    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        if (fileUrl.startsWith(this._fileUploadUrl)) {
            let recordNameAndFileName = fileUrl.slice(
                this._fileUploadUrl.length + 1
            );
            let nextSlash = recordNameAndFileName.indexOf('/');
            if (nextSlash < 0) {
                return {
                    success: false,
                    errorCode: 'unacceptable_url',
                    errorMessage: 'The URL does not match an expected format.',
                };
            }
            let recordName = recordNameAndFileName.slice(0, nextSlash);
            let fileName = recordNameAndFileName.slice(nextSlash + 1);

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

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        let file = this._files.get(fileName);

        if (file) {
            return {
                success: true,
                fileName: file.fileName,
                recordName: file.recordName,
                publisherId: file.publisherId,
                subjectId: file.subjectId,
                sizeInBytes: file.sizeInBytes,
                uploaded: file.uploaded,
                description: file.description,
                url: `${this._fileUploadUrl}/${file.recordName}/${file.fileName}`,
                markers: file.markers,
            };
        } else {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }
    }

    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesStoreResult> {
        let files = sortBy(
            [...this._files.values()].filter(
                (f) => f.recordName === recordName && f.uploaded
            ),
            (f) => f.fileName
        );

        if (fileName) {
            files = files.filter((f) => f.fileName > fileName);
        }

        return {
            success: true,
            files: files.slice(0, 10).map((f) => ({
                fileName: f.fileName,
                uploaded: f.uploaded,
                markers: f.markers,
                description: f.description,
                sizeInBytes: f.sizeInBytes,
                url: `${this._fileUploadUrl}/${f.recordName}/${f.fileName}`,
            })),
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
        if (this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        let file: StoredFile = {
            fileName: fileName,
            recordName: recordName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            markers,
            uploaded: false,
        };

        this._files.set(fileName, file);

        return {
            success: true,
        };
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        if (!this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        let file = this._files.get(fileName);

        this._files.set(fileName, {
            ...file,
            markers: markers.slice(),
        });

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        let file = this._files.get(fileName);

        if (!file) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        file.uploaded = true;
        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const deleted = this._files.delete(fileName);
        if (!deleted) {
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

    getAllowedUploadHeaders(): string[] {
        return ['record-name', 'content-type'];
    }
}

export class MemoryFileRecordsLookup implements FileRecordsLookup {
    private _files: Map<string, StoredFile> = new Map();

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<FileRecord> {
        let file = this._files.get(fileName);

        if (file) {
            return {
                fileName: file.fileName,
                recordName: file.recordName,
                publisherId: file.publisherId,
                subjectId: file.subjectId,
                sizeInBytes: file.sizeInBytes,
                uploaded: file.uploaded,
                description: file.description,
                markers: file.markers,
            };
        } else {
            return null;
        }
    }

    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesLookupResult> {
        let files = sortBy(
            [...this._files.values()].filter(
                (f) => f.recordName === recordName && f.uploaded
            ),
            (f) => f.fileName
        );

        if (fileName) {
            files = files.filter((f) => f.fileName > fileName);
        }

        return {
            success: true,
            files: files.slice(0, 10).map((f) => ({
                fileName: f.fileName,
                sizeInBytes: f.sizeInBytes,
                uploaded: f.uploaded,
                markers: f.markers,
                description: f.description,
            })),
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
        if (this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        let file: StoredFile = {
            fileName: fileName,
            recordName: recordName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            markers,
            uploaded: false,
        };

        this._files.set(fileName, file);

        return {
            success: true,
        };
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        if (!this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        let file = this._files.get(fileName);

        this._files.set(fileName, {
            ...file,
            markers: markers.slice(),
        });

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        let file = this._files.get(fileName);

        if (!file) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        file.uploaded = true;
        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const deleted = this._files.delete(fileName);
        if (!deleted) {
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

interface StoredFile {
    fileName: string;
    recordName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    uploaded: boolean;
    description: string;
    markers: string[];
}
