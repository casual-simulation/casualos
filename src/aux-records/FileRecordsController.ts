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
    FileRecordsStore,
    AddFileFailure,
    MarkFileRecordAsUploadedFailure,
    EraseFileStoreResult,
    GetFileNameFromUrlResult,
    PresignFileReadFailure,
    GetFileRecordFailure,
} from './FileRecordsStore';
import type {
    NotLoggedInError,
    NotSupportedError,
    ServerError,
    SubscriptionLimitReached,
} from '@casual-simulation/aux-common/Errors';
import type { ValidatePublicRecordKeyFailure } from './RecordsController';
import { getExtension } from 'mime';
import type {
    AuthorizeSubjectFailure,
    PolicyController,
} from './PolicyController';
import {
    getMarkerResourcesForCreation,
    getMarkerResourcesForUpdate,
} from './PolicyController';
import { ACCOUNT_MARKER } from '@casual-simulation/aux-common';
import { getMarkersOrDefault, getRootMarkersOrDefault } from './Utils';
import type { MetricsStore } from './MetricsStore';
import type { ConfigurationStore } from './ConfigurationStore';
import { getSubscriptionFeatures } from './SubscriptionConfiguration';
import { traced } from './tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { UserRole } from './AuthStore';

const TRACE_NAME = 'FileRecordsController';

export interface FileRecordsConfiguration {
    policies: PolicyController;
    store: FileRecordsStore;
    metrics: MetricsStore;
    config: ConfigurationStore;
}

/**
 * Defines a class that can manage file records.
 */
export class FileRecordsController {
    private _policies: PolicyController;
    private _store: FileRecordsStore;
    private _metrics: MetricsStore;
    private _config: ConfigurationStore;

    constructor(config: FileRecordsConfiguration) {
        this._policies = config.policies;
        this._store = config.store;
        this._metrics = config.metrics;
        this._config = config.config;
    }

    /**
     * Attempts to record a file.
     * @param recordNameOrKey The name of the record or the record key of the record.
     * @param userId The ID of the user that is logged in. Should be null if the user is not logged in.
     * @param request The request.
     * @param userRole the role of the user that is requesting the file.
     * @returns
     */
    @traced(TRACE_NAME)
    async recordFile(
        recordKeyOrRecordName: string,
        userId: string | null,
        request: RecordFileRequest
    ): Promise<RecordFileResult> {
        try {
            let markers = getMarkersOrDefault(request.markers);
            let rootMarkers = getRootMarkersOrDefault(markers);

            const contextResult =
                await this._policies.constructAuthorizationContext({
                    recordKeyOrRecordName,
                    userId,
                    userRole: request.userRole,
                });

            if (contextResult.success === false) {
                return contextResult;
            }

            const extension = getExtension(request.fileMimeType);
            const fileName = extension
                ? `${request.fileSha256Hex}.${extension}`
                : request.fileSha256Hex;

            const authorization =
                await this._policies.authorizeUserAndInstancesForResources(
                    contextResult.context,
                    {
                        userId,
                        instances: request.instances,
                        resources: [
                            {
                                resourceKind: 'file',
                                resourceId: fileName,
                                action: 'create',
                                markers: rootMarkers,
                            },
                            ...getMarkerResourcesForCreation(rootMarkers),
                        ],
                    }
                );

            // const result = await this._policies.authorizeRequest({
            //     action: 'file.create',
            //     recordKeyOrRecordName: recordKeyOrRecordName,
            //     userId,
            //     resourceMarkers: markers,
            //     fileSizeInBytes: request.fileByteLength,
            //     fileMimeType: request.fileMimeType,
            //     instances: request.instances,
            // });

            if (authorization.success === false) {
                return authorization;
            }

            const createAuthorization = authorization.results[0];

            for (let result of createAuthorization.results) {
                const options = result.permission.options;

                if (
                    'maxFileSizeInBytes' in options &&
                    options.maxFileSizeInBytes > 0
                ) {
                    if (request.fileByteLength > options.maxFileSizeInBytes) {
                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage: 'The file is too large.',
                        };
                    }
                } else if (
                    'allowedMimeTypes' in options &&
                    Array.isArray(options.allowedMimeTypes)
                ) {
                    if (
                        !options.allowedMimeTypes.includes(request.fileMimeType)
                    ) {
                        return {
                            success: false,
                            errorCode: 'unacceptable_request',
                            errorMessage: 'The file type is not allowed.',
                        };
                    }
                }
            }

            const policy = contextResult.context.subjectPolicy;
            userId = contextResult.context.userId;
            const userRole = contextResult.context.userRole;

            if (!userId && userRole === 'none' && policy !== 'subjectless') {
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

            const publisherId =
                contextResult.context.recordKeyCreatorId ??
                userId ??
                contextResult.context.recordOwnerId;
            const recordName = authorization.recordName;
            const subjectId = userId;

            const metricsResult =
                await this._metrics.getSubscriptionFileMetricsByRecordName(
                    recordName
                );
            const config = await this._config.getSubscriptionConfiguration();
            const features = getSubscriptionFeatures(
                config,
                metricsResult.subscriptionStatus,
                metricsResult.subscriptionId,
                metricsResult.ownerId ? 'user' : 'studio'
            );

            if (!features.files.allowed) {
                return {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'The subscription does not permit the recording of files.',
                };
            }

            if (features.files.maxBytesPerFile > 0) {
                if (request.fileByteLength > features.files.maxBytesPerFile) {
                    return {
                        success: false,
                        errorCode: 'unacceptable_request',
                        errorMessage: 'The file is too large.',
                    };
                }
            }
            if (features.files.maxBytesTotal > 0) {
                const newSize =
                    metricsResult.totalFileBytesReserved +
                    request.fileByteLength;
                if (newSize > features.files.maxBytesTotal) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The file storage limit has been reached for the subscription.',
                    };
                }
            }
            if (features.files.maxFiles > 0) {
                const newCount = metricsResult.totalFiles + 1;
                if (newCount > features.files.maxFiles) {
                    return {
                        success: false,
                        errorCode: 'subscription_limit_reached',
                        errorMessage:
                            'The file count limit has been reached for the subscription.',
                    };
                }
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
                        if (
                            !fileResult.markers.some((m) => markers.includes(m))
                        ) {
                            // re-check permissions because none of the markers match up
                            // with the markers that the file actually has
                            markers = fileResult.markers;
                            rootMarkers = getRootMarkersOrDefault(markers);

                            const authorization =
                                await this._policies.authorizeUserAndInstancesForResources(
                                    contextResult.context,
                                    {
                                        userId: subjectId,
                                        instances: request.instances,
                                        resources: [
                                            {
                                                resourceKind: 'file',
                                                resourceId: fileName,
                                                action: 'create',
                                                markers: markers,
                                            },
                                            ...getMarkerResourcesForCreation(
                                                markers
                                            ),
                                        ],
                                    }
                                );

                            if (authorization.success === false) {
                                return authorization;
                            }
                        } else {
                            // allow the request to be successful
                            // because at least one of the markers is the same
                            // we just need to grab the real markers from the file
                            markers = fileResult.markers;
                            rootMarkers = getRootMarkersOrDefault(markers);
                        }
                    } else {
                        return {
                            success: false,
                            errorCode: 'file_already_exists',
                            errorMessage:
                                'The file has already been uploaded to ' +
                                fileResult.url,
                            existingFileUrl: fileResult.url,
                            existingFileName: fileResult.fileName,
                        };
                    }
                } else {
                    return addFileResult;
                }
            }

            const presignResult = await this._store.presignFileUpload({
                recordName,
                fileName: fileName,
                fileSha256Hex: request.fileSha256Hex,
                fileMimeType: request.fileMimeType,
                fileByteLength: request.fileByteLength,
                markers: rootMarkers,
                headers: request.headers,
            });

            if (presignResult.success === false) {
                return presignResult;
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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
     * @param instances The instances that are loaded.
     */
    @traced(TRACE_NAME)
    async eraseFile(
        recordKeyOrRecordName: string,
        fileName: string,
        subjectId: string,
        instances?: string[]
    ): Promise<EraseFileResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName,
                userId: subjectId,
                instances,
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

            const markers = getRootMarkersOrDefault(fileResult.markers);

            const authorization =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: subjectId,
                        instances: instances,
                        resourceKind: 'file',
                        resourceId: fileName,
                        action: 'delete',
                        markers: markers,
                    }
                );

            // const result = await this._policies.authorizeRequestUsingContext(
            //     context.context,
            //     {
            //         action: 'file.delete',
            //         ...baseRequest,
            //         fileSizeInBytes: fileResult.sizeInBytes,
            //         fileMimeType: getType(fileResult.fileName),
            //         resourceMarkers: markers,
            //     }
            // );

            if (authorization.success === false) {
                return authorization;
            }

            const policy = context.context.subjectPolicy;
            subjectId = authorization.user.subjectId;

            if (!subjectId && policy !== 'subjectless') {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to erase files.',
                };
            }

            const recordName = authorization.recordName;

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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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
     * @param fileName The name of the file.
     * @param subjectId The ID of the user that is making this request. Null if the user is not logged in.
     * @param instances The instances that are loaded.
     * @param userRole The role of the user that is making the request.
     */
    @traced(TRACE_NAME)
    async readFile(
        recordKeyOrRecordName: string,
        fileName: string,
        subjectId: string | null,
        instances?: string[],
        userRole?: UserRole
    ): Promise<ReadFileResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName,
                userId: subjectId,
                instances,
                userRole,
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

            const markers = getRootMarkersOrDefault(fileResult.markers);

            const result = await this._policies.authorizeUserAndInstances(
                context.context,
                {
                    userId: subjectId,
                    instances: instances,
                    resourceKind: 'file',
                    resourceId: fileName,
                    action: 'read',
                    markers: markers,
                }
            );

            // const result = await this._policies.authorizeRequestUsingContext(
            //     context.context,
            //     {
            //         action: 'file.read',
            //         ...baseRequest,
            //         fileSizeInBytes: fileResult.sizeInBytes,
            //         fileMimeType: getType(fileResult.fileName),
            //         resourceMarkers: markers,
            //     }
            // );

            if (result.success === false) {
                return result;
            }

            const policy = context.context.subjectPolicy;
            subjectId = result.user.subjectId;

            if (
                !subjectId &&
                context.context.userRole === 'none' &&
                policy !== 'subjectless'
            ) {
                return {
                    success: false,
                    errorCode: 'not_logged_in',
                    errorMessage:
                        'The user must be logged in in order to read files.',
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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

    /**
     * Attempts to list the files that are available in the given record.
     * @param recordKeyOrRecordName The name of the record or the record key of the record.
     * @param fileName The file name that the listing should start at. If null, then the listing will start with the first file in the record.
     * @param userId The ID of the user who is retrieving the data. If null, then it is assumed that the user is not logged in.
     * @param instances The instances that are loaded.
     */
    @traced(TRACE_NAME)
    async listFiles(
        recordKeyOrRecordName: string,
        fileName: string | null,
        userId?: string,
        instances?: string[]
    ): Promise<ListFilesResult> {
        try {
            if (!this._store.listUploadedFiles) {
                return {
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'This operation is not supported.',
                };
            }

            const baseRequest = {
                recordKeyOrRecordName,
                userId: userId,
                instances,
            };
            const context = await this._policies.constructAuthorizationContext(
                baseRequest
            );

            if (context.success === false) {
                return context;
            }

            const authorizeResult =
                await this._policies.authorizeUserAndInstances(
                    context.context,
                    {
                        userId: userId,
                        instances,
                        resourceKind: 'file',
                        action: 'list',
                        markers: [ACCOUNT_MARKER],
                    }
                );

            if (authorizeResult.success === false) {
                return authorizeResult;
            }

            const result2 = await this._store.listUploadedFiles(
                context.context.recordName,
                fileName
            );

            if (result2.success === false) {
                return {
                    success: false,
                    errorCode: result2.errorCode,
                    errorMessage: result2.errorMessage,
                };
            }

            return {
                success: true,
                recordName: context.context.recordName,
                files: result2.files,
                totalCount: result2.totalCount,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
            console.error(
                '[FileRecordsController] An error occurred while listing files:',
                err
            );
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    @traced(TRACE_NAME)
    async updateFile(
        recordKeyOrRecordName: string,
        fileName: string,
        subjectId: string,
        markers: string[],
        instances?: string[]
    ): Promise<UpdateFileRecordResult> {
        try {
            const baseRequest = {
                recordKeyOrRecordName,
                userId: subjectId,
                instances,
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

            const existingMarkers = getRootMarkersOrDefault(fileResult.markers);
            const resourceMarkers = markers ?? existingMarkers;

            const result =
                await this._policies.authorizeUserAndInstancesForResources(
                    context.context,
                    {
                        userId: subjectId,
                        instances: instances,
                        resources: [
                            {
                                resourceKind: 'file',
                                resourceId: fileName,
                                action: 'update',
                                markers: resourceMarkers,
                            },
                            ...getMarkerResourcesForUpdate(
                                existingMarkers,
                                markers
                            ),
                        ],
                    }
                );

            if (result.success === false) {
                return result;
            }

            subjectId = context.context.userId;

            const updateResult = await this._store.updateFileRecord(
                result.recordName,
                fileName,
                resourceMarkers
            );

            if (updateResult.success === false) {
                return updateResult;
            }

            return {
                success: true,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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

    @traced(TRACE_NAME)
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
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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

    @traced(TRACE_NAME)
    async getFileNameFromUrl(
        fileUrl: string
    ): Promise<GetFileNameFromUrlResult> {
        try {
            return await this._store.getFileNameFromUrl(fileUrl);
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });
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

    @traced(TRACE_NAME)
    getAllowedUploadHeaders() {
        return this._store.getAllowedUploadHeaders();
    }
}

/**
 * Defines an interface that is used for requests to record a file.
 *
 * @dochash types/records/files
 * @doctitle File Types
 * @docsidebar Files
 * @docdescription File records are used to store large blobs of data.
 * @docgroup 01-create
 * @docorder 0
 * @docname RecordFileRequest
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

    /**
     * The instances that are currently loaded.
     */
    instances?: string[];

    /**
     * The role of the user that is making the request.
     */
    userRole?: UserRole | null;
}

/**
 * Defines the possible results of a request to record a file.
 */
export type RecordFileResult = RecordFileSuccess | RecordFileFailure;

/**
 * Defines an interface that represents a successful request to record a file.
 */
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

/**
 * Defines an interface that represents a failed request to record a file.
 */
export interface RecordFileFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | ValidatePublicRecordKeyFailure['errorCode']
        | AddFileFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | SubscriptionLimitReached
        | 'invalid_file_data'
        | 'not_supported';

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;

    /**
     * The URL that the file is available at if it has already been uploaded.
     */
    existingFileUrl?: string;

    /**
     * The name of the file that was attempted to be recorded.
     */
    existingFileName?: string;
}

/**
 * Defines the possible results of a request to erase a file record.
 *
 * @dochash types/records/files
 * @docgroup 02-erase
 * @docorder 0
 * @docname EraseFileResult
 */
export type EraseFileResult = EraseFileSuccess | EraseFileFailure;

/**
 * Defines an interface that represents a successful request to erase a file record.
 *
 * @dochash types/records/files
 * @docgroup 02-erase
 * @docorder 1
 * @docname EraseFileSuccess
 */
export interface EraseFileSuccess {
    success: true;
    /**
     * The name of the record that the file was erased from.
     */
    recordName: string;

    /**
     * The name of the file that was erased.
     */
    fileName: string;
}

/**
 * Defines an interface that represents a failed request to erase a file record.
 *
 * @dochash types/records/files
 * @docgroup 02-erase
 * @docorder 2
 * @docname EraseFileFailure
 */
export interface EraseFileFailure {
    success: false;
    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | EraseFileStoreResult['errorCode']
        | NotLoggedInError
        | AuthorizeSubjectFailure['errorCode']
        | ValidatePublicRecordKeyFailure['errorCode'];

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

/**
 * Defines the possible results of a request to mark a file record as uploaded.
 */
export type FileUploadedResult = FileUploadedSuccess | FileUploadedFailure;

export interface FileUploadedSuccess {
    success: true;
}

export interface FileUploadedFailure {
    success: false;
    errorCode: ServerError | MarkFileRecordAsUploadedFailure['errorCode'];
    errorMessage: string;
}

/**
 * Defines the possible results of a request to read a file record.
 */
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
        | AuthorizeSubjectFailure['errorCode'];
    errorMessage: string;
}

export type ListFilesResult = ListFilesSuccess | ListFilesFailure;

export interface ListFilesSuccess {
    success: true;
    recordName: string;
    files: ListedFile[];

    /**
     * The total number of files in the record.
     */
    totalCount: number;
}

export interface ListedFile {
    fileName: string;
    url: string;
    sizeInBytes: number;
    description: string;
    markers: string[];
    uploaded: boolean;
}

export interface ListFilesFailure {
    success: false;
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | PresignFileReadFailure['errorCode']
        | GetFileRecordFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode']
        | NotSupportedError;
    errorMessage: string;
}

export type UpdateFileRecordResult =
    | UpdateFileRecordSuccess
    | UpdateFileRecordFailure;

export interface UpdateFileRecordSuccess {
    success: true;
}

export interface UpdateFileRecordFailure {
    success: false;
    errorCode:
        | ServerError
        | ValidatePublicRecordKeyFailure['errorCode']
        | PresignFileReadFailure['errorCode']
        | GetFileRecordFailure['errorCode']
        | AuthorizeSubjectFailure['errorCode'];
    errorMessage: string;
}
