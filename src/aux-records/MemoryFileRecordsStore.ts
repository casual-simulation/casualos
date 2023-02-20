import {
    AddFileResult,
    EraseFileStoreResult,
    FileRecordsStore,
    GetFileNameFromUrlResult,
    GetFileRecordResult,
    MarkFileRecordAsUploadedResult,
    PresignFileUploadRequest,
    PresignFileUploadResult,
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
                url: `${file.recordName}/${file.fileName}`,
            };
        } else {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string
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
            uploaded: false,
        };

        this._files.set(fileName, file);

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

interface StoredFile {
    fileName: string;
    recordName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    uploaded: boolean;
    description: string;
}
