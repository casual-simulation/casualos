import {
    FileRecordsStore,
    AddFileFailure,
    MarkFileRecordAsUploadedFailure,
    EraseFileStoreResult,
    GetFileNameFromUrlResult,
    PresignFileReadFailure,
    GetFileRecordFailure,
} from './FileRecordsStore';
import { NotLoggedInError, ServerError } from './Errors';
import {
    RecordsController,
    ValidatePublicRecordKeyFailure,
} from './RecordsController';
import { getExtension, getType } from 'mime';
import {
    AuthorizeDenied,
    PolicyController,
    returnAuthorizationResult,
} from './PolicyController';
import { PUBLIC_READ_MARKER } from './PolicyPermissions';
import { getMarkersOrDefault } from './Utils';

/**
 * Defines a class that can manage file records.
 */
export class FileRecordsController {
    private _policies: PolicyController;
    private _store: FileRecordsStore;

    constructor(policies: PolicyController, store: FileRecordsStore) {
        this._policies = policies;
        this._store = store;
    }

    /**
     * Attempts to record a file.
     * @param recordNameOrKey The name of the record or the record key of the record.
     * @param userId The ID of the user that is logged in. Should be null if the user is not logged in.
     * @param request The request.
     * @returns
     */
    async recordFile(
        recordKeyOrRecordName: string,
        userId: string,
        request: RecordFileRequest
    ): Promise<RecordFileResult> {
        try {
            const markers = getMarkersOrDefault(request.markers);

            const result = await this._policies.authorizeRequest({
                action: 'file.create',
                recordKeyOrRecordName: recordKeyOrRecordName,
                userId,
                resourceMarkers: markers,
                fileSizeInBytes: request.fileByteLength,
                fileMimeType: request.fileMimeType,
            });

            if (result.allowed === false) {
                return returnAuthorizationResult(result);
            }

            // const keyResult = await this._controller.validatePublicRecordKey(
            //     recordNameOrKey
            // );

            // if (keyResult.success === false) {
            //     return keyResult;
            // }

            const policy = result.subject.subjectPolicy;
            userId = result.subject.userId;

            if (!result.subject.userId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to record files.',
                };
            }

            if (policy === 'subjectless') {
                userId = null;
            }

            const publisherId = result.authorizerId;
            const recordName = result.recordName;
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
                markers,
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
                request.fileDescription,
                markers
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
                            markers,
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
                markers,
            };
        } catch (err) {
            console.error(
                '[FileRecordsController] An error occurred while recording a file:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to erase the given file using the given record key and subject.
     * @param recordKey The key that should be used to erase the file.
     * @param fileName The name of the file.
     * @param subjectId The ID of the user that is making this request. Null if the user is not logged in.
     */
    async eraseFile(
        recordKeyOrRecordName: string,
        fileName: string,
        subjectId: string
    ): Promise<EraseFileResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName,
                userId: subjectId,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const fileResult = await this._store.getFileRecord(
                context.context.recordName,
                fileName
            );

            if (fileResult.success === false) {
                return fileResult;
            }

            const markers = getMarkersOrDefault(fileResult.markers);

            const result = await this._policies.authorizeRequest({
                action: 'file.delete',
                ...baseRequest,
                fileSizeInBytes: fileResult.sizeInBytes,
                fileMimeType: getType(fileResult.fileName),
                resourceMarkers: markers,
            });

            if (result.allowed === false) {
                return returnAuthorizationResult(result);
            }

            const policy = result.subject.subjectPolicy;
            subjectId = result.subject.userId;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to erase files.',
                };
            }

            const publisherId = result.authorizerId;
            const recordName = result.recordName;

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
            console.error(
                '[FileRecordsController] An error occurred while erasing a file:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    /**
     * Attempts to retrieve a URL that allows the client to read the given file.
     * @param recordKeyOrRecordName The name of the record or the record key of the record.
     * @param fileName THe name of the file.
     * @param subjectId The ID of the user that is making this request. Null if the user is not logged in.
     */
    async readFile(
        recordKeyOrRecordName: string,
        fileName: string,
        subjectId: string
    ): Promise<ReadFileResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName,
                userId: subjectId,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const fileResult = await this._store.getFileRecord(
                context.context.recordName,
                fileName
            );

            if (fileResult.success === false) {
                return fileResult;
            }

            const markers = getMarkersOrDefault(fileResult.markers);

            const result = await this._policies.authorizeRequest({
                action: 'file.read',
                ...baseRequest,
                fileSizeInBytes: fileResult.sizeInBytes,
                fileMimeType: getType(fileResult.fileName),
                resourceMarkers: markers,
            });

            if (result.allowed === false) {
                return returnAuthorizationResult(result);
            }

            const policy = result.subject.subjectPolicy;
            subjectId = result.subject.userId;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to erase files.',
                };
            }

            const recordName = result.recordName;

            const readResult = await this._store.presignFileRead({
                recordName,
                fileName,
                headers: {},
            });

            if (readResult.success === false) {
                return {
                    success: false,
                    errorCode: readResult.errorCode,
                    errorMessage: readResult.errorMessage,
                };
            }

            return {
                success: true,
                requestUrl: readResult.requestUrl,
                requestMethod: readResult.requestMethod,
                requestHeaders: readResult.requestHeaders,
            };
        } catch (err) {
            console.error(
                '[FileRecordsController] An error occurred while reading a file:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
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
            console.error(
                '[FileRecordsController] An error occurred while marking a file as uploaded:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        try {
            return await this._store.getFileNameFromUrl(fileUrl);
        } catch (err) {
            console.error(
                '[FileRecordsController] An error occurred while getting a file name:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    getAllowedUploadHeaders() {
        return this._store.getAllowedUploadHeaders();
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

    /**
     * The markers that should be applied to the file.
     */
    markers?: string[];
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

    /**
     * The markers that were applied to the file.
     */
    markers: string[];
}

export interface RecordFileFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddFileFailure['errorCode']
        | AuthorizeDenied['errorCode']
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
        | AuthorizeDenied['errorCode']
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

export type ReadFileResult = ReadFileSuccess | ReadFileFailure;

export interface ReadFileSuccess {
    success: true;
    /**
     * The URL that the request to get the file should be made to.
     */
    requestUrl: string;

    /**
     * The HTTP method that should be used to make the request.
     */
    requestMethod: string;

    /**
     * The HTTP headers that should be included in the request.
     */
    requestHeaders: {
        [name: string]: string;
    };
}

export interface ReadFileFailure {
    success: false;
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | PresignFileReadFailure['errorCode']
        | GetFileRecordFailure['errorCode']
        | AuthorizeDenied['errorCode'];
    errorMessage: string;
}
