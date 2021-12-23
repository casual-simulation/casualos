import { FileRecordsStore, AddFileFailure } from './FileRecordsStore';
import { ServerError } from './Errors';
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
                fileName: fileName,
                fileSha256Hex: request.fileSha256Hex,
                fileMimeType: request.fileMimeType,
                fileByteLength: request.fileByteLength,
            });

            if (presignResult.success === false) {
                return presignResult;
            }

            const addFileResult = await this._store.addFileRecord(
                fileName,
                recordName,
                publisherId,
                subjectId,
                request.fileByteLength,
                request.fileDescription
            );

            if (addFileResult.success === false) {
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
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddFileFailure['errorCode'];
    errorMessage: string;
}
