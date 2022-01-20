import {
    FileRecordsStore,
    AddFileFailure,
    MarkFileRecordAsUploadedFailure,
    EraseFileStoreResult,
} from './FileRecordsStore';
import { NotLoggedInError, ServerError } from './Errors';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';
import { getExtension } from 'mime';

/**
 * Defines a class that can manage file records.
 */
export class FileRecordsController {
    private _controller: RecordsController;
    private _store: FileRecordsStore;

    constructor(controller: RecordsController, store: FileRecordsStore) {
        this._controller = controller;
        this._store = store;
    }

    async recordFile(
        recordKey: string,
        userId: string,
        request: RecordFileRequest
    ): Promise<RecordFileResult> {
        try {
            const keyResult = await this._controller.validatePublicRecordKey(
                recordKey
            );

            if (keyResult.success === false) {
                return keyResult;
            }

            const publisherId = keyResult.ownerId;
            const recordName = keyResult.recordName;
            const subjectId = userId;

            const extension = getExtension(request.fileMimeType);
            const fileName = extension
                ? `${request.fileSha256Hex}.${extension}`
                : request.fileSha256Hex;

            const presignResult = await this._store.presignFileUpload({
                recordName,
                fileName: fileName,
                fileSha256Hex: request.fileSha256Hex,
                fileMimeType: request.fileMimeType,
                fileByteLength: request.fileByteLength,
                headers: request.headers,
            });

            if (presignResult.success === false) {
                return presignResult;
            }

            const addFileResult = await this._store.addFileRecord(
                recordName,
                fileName,
                publisherId,
                subjectId,
                request.fileByteLength,
                request.fileDescription
            );

            if (addFileResult.success === false) {
                if (addFileResult.errorCode === 'file_already_exists') {
                    const fileResult = await this._store.getFileRecord(
                        recordName,
                        fileName
                    );
                    if (fileResult.success === false) {
                        console.error(
                            '[FileRecordsController] Error getting file record even though it should exist:',
                            fileResult
                        );
                        return {
                            success: false,
                            errorCode: 'server_error',
                            errorMessage: fileResult.errorMessage,
                        };
                    }

                    if (!fileResult.uploaded) {
                        return {
                            success: true,
                            fileName,
                            uploadUrl: presignResult.uploadUrl,
                            uploadHeaders: presignResult.uploadHeaders,
                            uploadMethod: presignResult.uploadMethod,
                        };
                    } else {
                        return {
                            success: false,
                            errorCode: 'file_already_exists',
                            errorMessage:
                                'The file has already been uploaded to ' +
                                fileResult.url,
                            existingFileUrl: fileResult.url,
                        };
                    }
                }

                return addFileResult;
            }

            return {
                success: true,
                fileName,
                uploadUrl: presignResult.uploadUrl,
                uploadHeaders: presignResult.uploadHeaders,
                uploadMethod: presignResult.uploadMethod,
            };
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }

    async eraseFile(
        recordKey: string,
        fileName: string
    ): Promise<EraseFileResult> {
        try {
            const keyResult = await this._controller.validatePublicRecordKey(
                recordKey
            );

            if (keyResult.success === false) {
                return keyResult;
            }

            const publisherId = keyResult.ownerId;
            const recordName = keyResult.recordName;

            const eraseResult = await this._store.eraseFileRecord(
                recordName,
                fileName
            );

            if (eraseResult.success === false) {
                return {
                    success: false,
                    errorCode: eraseResult.errorCode,
                    errorMessage: eraseResult.errorMessage,
                };
            }

            return {
                success: true,
                recordName,
                fileName,
            };
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }

    async markFileAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<FileUploadedResult> {
        try {
            const result = await this._store.setFileRecordAsUploaded(
                recordName,
                fileName
            );

            if (result.success === false) {
                return result;
            }

            return {
                success: true,
            };
        } catch (err) {
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: err.toString(),
            };
        }
    }
}

/**
 * Defines an interface that is used for requests to record a file.
 */
export interface RecordFileRequest {
    /**
     * The hex encoded SHA256 hash of the file that will be uploaded.
     */
    fileSha256Hex: string;

    /**
     * The number of bytes in the file.
     */
    fileByteLength: number;

    /**
     * The MIME type of the file.
     */
    fileMimeType: string;

    /**
     * The description of the file.
     */
    fileDescription: string;

    /**
     * The headers that were included in the result.
     */
    headers: {
        [name: string]: string;
    };
}

export type RecordFileResult = RecordFileSuccess | RecordFileFailure;

export interface RecordFileSuccess {
    success: true;

    /**
     * The URL that the file should be uploaded to.
     */
    uploadUrl: string;

    /**
     * The HTTP Method that should be used for the upload.
     */
    uploadMethod: string;

    /**
     * The HTTP headers that should be included in the upload request.
     */
    uploadHeaders: {
        [name: string]: string;
    };

    /**
     * The name of the file that was recorded.
     */
    fileName: string;
}

export interface RecordFileFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddFileFailure['errorCode']
        | 'invalid_file_data'
        | 'not_supported';
    errorMessage: string;

    /**
     * The URL that the file is available at if it has already been uploaded.
     */
    existingFileUrl?: string;
}

export type EraseFileResult = EraseFileSuccess | EraseFileFailure;
export interface EraseFileSuccess {
    success: true;
    recordName: string;
    fileName: string;
}

export interface EraseFileFailure {
    success: false;
    errorCode:
        | ServerError
        | EraseFileStoreResult['errorCode']
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode'];
    errorMessage: string;
}

export type FileUploadedResult = FileUploadedSuccess | FileUploadedFailure;

export interface FileUploadedSuccess {
    success: true;
}

export interface FileUploadedFailure {
    success: false;
    errorCode: ServerError | MarkFileRecordAsUploadedFailure['errorCode'];
    errorMessage: string;
}
