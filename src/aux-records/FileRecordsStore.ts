import {
    NotSupportedError,
    ServerError,
} from '@casual-simulation/aux-common/Errors';

/**
 * Defines an interface for systems that are able to store info about file records.
 */
export interface FileRecordsLookup {
    /**
     * Gets the file record for the file with the given name.
     * @param recordName The name of the record that the file is stored in.
     * @param fileName The name of the file.
     */
    getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<FileRecord | null>;

    /**
     * Attempts to list the files in the given record.
     * @param recordName The name of the record.
     * @param fileName The name of the file to start listing after.
     */
    listUploadedFiles?(
        recordName: string,
        fileName: string | null
    ): Promise<ListFilesLookupResult>;

    /**
     * Attempts to add a record for a file to the store.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file that should be recorded.
     * @param publisherId The ID of the publisher that published the record.
     * @param subjectId The ID of the subject that was logged in when the record was published.
     * @param sizeInBytes The size of the file in bytes.
     * @param description The description of the file.
     * @param bucket The bucket that the file is stored in.
     * @param markers The resource markers for the file.
     */
    addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        bucket: string | null,
        markers: string[]
    ): Promise<AddFileResult>;

    /**
     * Attempts to update the given file record.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file.
     * @param markers The markers that should be set on the file.
     */
    updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult>;

    /**
     * Marks the given file record as having been uploaded.
     * @param recordName The reocrd that the file was uploaded to.
     * @param fileName The name of the file that was uploaded.
     */
    setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult>;

    /**
     * Attempts to delete the given file from the given record.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file that should be deleted.
     */
    eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult>;
}

export interface FileRecordsVault {
    /**
     * Presigns a request to record a file.
     * Returns the URL that should be used to upload the file and the headers that should be included in the upload request.
     * @param request The request to create a signed request for.
     */
    presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult>;

    /**
     * Presigns a request to read a file.
     * Returns the URL that can be used to read the file.
     * @param request The request to create a signed request for.
     */
    presignFileRead(
        request: PresignFileReadRequest
    ): Promise<PresignFileReadResult>;

    /**
     * Attempts to get the record name and file name from the given URL.
     * @param fileUrl The URL.
     */
    getFileNameFromUrl(fileUrl: string): Promise<GetFileNameFromUrlResult>;

    /**
     * Gets the list of headers that should be allowed via CORS.
     */
    getAllowedUploadHeaders(): string[];
}

/**
 * Defines an interface that provides a way to store file records.
 */
export interface FileRecordsStore extends FileRecordsVault {
    /**
     * Initializes the store.
     */
    init?(): Promise<void>;

    /**
     * Gets the file record for the file with the given name.
     * @param recordName The name of the record that the file is stored in.
     * @param fileName The name of the file.
     */
    getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult>;

    /**
     * Attempts to list the files in the given record.
     * @param recordName The name of the record.
     * @param fileName The name of the file that the listing should start after.
     */
    listUploadedFiles?(
        recordName: string,
        fileName: string | null
    ): Promise<ListFilesStoreResult>;

    /**
     * Attempts to add a record for a file to the store.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file that should be recorded.
     * @param publisherId The ID of the publisher that published the record.
     * @param subjectId The ID of the subject that was logged in when the record was published.
     * @param sizeInBytes The size of the file in bytes.
     * @param description The description of the file.
     * @param markers The resource markers for the file.
     */
    addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        markers: string[]
    ): Promise<AddFileResult>;

    /**
     * Attempts to update the given file record.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file.
     * @param markers The markers that should be set on the file.
     */
    updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult>;

    /**
     * Marks the given file record as having been uploaded.
     * @param recordName The reocrd that the file was uploaded to.
     * @param fileName The name of the file that was uploaded.
     */
    setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult>;

    /**
     * Attempts to delete the given file from the given record.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file that should be deleted.
     */
    eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult>;
}

/**
 * Defines the structure of a file record.
 */
export interface FileRecord {
    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The description of the file.
     */
    description: string;

    /**
     * The name of the record that the file was recorded in.
     */
    recordName: string;

    /**
     * The ID of the publisher that published the record.
     */
    publisherId: string;

    /**
     * The ID of the subject that was logged in when the record was published.
     */
    subjectId: string;

    /**
     * The size of the record in bytes.
     */
    sizeInBytes: number;

    /**
     * Whether the record was uploaded to the server.
     */
    uploaded: boolean;

    /**
     * The resource markers for the file.
     * Null if the file was created without markers.
     */
    markers: string[] | null;

    /**
     * The bucket that the file is stored in.
     * If null, then the file is stored in the default bucket.
     */
    bucket: string | null;
}

export type GetFileRecordResult = GetFileRecordSuccess | GetFileRecordFailure;

export interface GetFileRecordSuccess {
    success: true;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The description of the file.
     */
    description: string;

    /**
     * The name of the record that the file was recorded in.
     */
    recordName: string;

    /**
     * The URL that the file can be downloaded from.
     */
    url: string;

    /**
     * The ID of the publisher that published the record.
     */
    publisherId: string;

    /**
     * The ID of the subject that was logged in when the record was published.
     */
    subjectId: string;

    /**
     * The size of the record in bytes.
     */
    sizeInBytes: number;

    /**
     * Whether the record was uploaded to the server.
     */
    uploaded: boolean;

    /**
     * The resource markers for the file.
     * Null if the file was created without markers.
     */
    markers: string[] | null;
}

export type MarkFileRecordAsUploadedResult =
    | MarkFileRecordAsUploadedSuccess
    | MarkFileRecordAsUploadedFailure;

export interface MarkFileRecordAsUploadedSuccess {
    success: true;
}

export interface MarkFileRecordAsUploadedFailure {
    success: false;
    errorCode: ServerError | 'file_not_found';
    errorMessage: string;
}

export interface GetFileRecordFailure {
    success: false;
    errorCode: ServerError | 'file_not_found';
    errorMessage: string;
}

export interface PresignFileUploadRequest {
    /**
     * The name of the record that the file will be stored in.
     */
    recordName: string;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The Hex encoded SHA-256 hash of the file that will be uploaded.
     */
    fileSha256Hex: string;

    /**
     * The MIME type of the file that will be uploaded.
     */
    fileMimeType: string;

    /**
     * The number of bytes in the file.
     */
    fileByteLength: number;

    /**
     * The headers that were included in the request.
     */
    headers: {
        [name: string]: string;
    };

    /**
     * The markers that should be associated with the file.
     */
    markers: string[];

    /**
     * The current date.
     */
    date?: Date;
}

export interface PresignFileReadRequest {
    /**
     * The name of the record that the file will be stored in.
     */
    recordName: string;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The headers that were included in the request.
     */
    headers: {
        [name: string]: string;
    };

    /**
     * The current date.
     */
    date?: Date;
}

export type PresignFileUploadResult =
    | PresignFileUploadSuccess
    | PresignFileUploadFailure;

export interface PresignFileUploadSuccess {
    success: true;

    /**
     * The URL that the upload should be sent to.
     */
    uploadUrl: string;

    /**
     * The HTTP method that should be used for the upload.
     */
    uploadMethod: string;

    /**
     * The HTTP headers that should be included in the upload.
     */
    uploadHeaders: {
        [name: string]: string;
    };
}

export interface PresignFileUploadFailure {
    success: false;
    errorCode: ServerError | NotSupportedError;
    errorMessage: string;
}

export type PresignFileReadResult =
    | PresignFileReadSuccess
    | PresignFileReadFailure;

export interface PresignFileReadSuccess {
    success: true;

    /**
     * The URL that the request should be sent to.
     */
    requestUrl: string;

    /**
     * The HTTP method that should be used for the request.
     */
    requestMethod: string;

    /**
     * The headers that should be included in the request.
     */
    requestHeaders: {
        [name: string]: string;
    };
}

export interface PresignFileReadFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type ListFilesLookupResult =
    | ListFilesLookupSuccess
    | ListFilesLookupFailure;

export interface ListFilesLookupSuccess {
    success: true;
    files: ListedLookupFile[];
    totalCount: number;
}

export interface ListedLookupFile {
    fileName: string;
    description: string;
    sizeInBytes: number;
    uploaded: boolean;

    /**
     * The bucket that the file is stored in.
     * Null if the file is stored in the default bucket.
     */
    bucket: string | null;
    markers: string[] | null;
}

export interface ListFilesLookupFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type ListFilesStoreResult =
    | ListFilesStoreSuccess
    | ListFilesStoreFailure;

export interface ListFilesStoreSuccess {
    success: true;
    files: ListedFileRecord[];
    totalCount: number;
}

export interface ListedFileRecord {
    fileName: string;
    description: string;
    sizeInBytes: number;
    uploaded: boolean;
    url: string;
    markers: string[] | null;
}

export interface ListFilesStoreFailure {
    success: false;
    errorCode: ServerError;
    errorMessage: string;
}

export type AddFileResult = AddFileSuccess | AddFileFailure;

export interface AddFileSuccess {
    success: true;
}

export interface AddFileFailure {
    success: false;
    errorCode: ServerError | 'file_already_exists';
    errorMessage: string;
}

export interface EraseFileStoreResult {
    success: boolean;

    errorCode?: ServerError | 'file_not_found';
    errorMessage?: string;
}

export type GetFileNameFromUrlResult =
    | GetFileNameFromUrlSuccess
    | GetFileNameFromUrlFailure;

export interface GetFileNameFromUrlSuccess {
    success: true;

    /**
     * The name of the record that the URL references.
     * Null if the URL contains no record name.
     */
    recordName: string | null;

    /**
     * The name of the file that the URL references.
     */
    fileName: string;
}

export interface GetFileNameFromUrlFailure {
    success: false;
    errorCode: ServerError | 'unacceptable_url';
    errorMessage: string;
}

export type UpdateFileResult = UpdateFileSuccess | UpdateFileFailure;

export interface UpdateFileSuccess {
    success: true;
}

export interface UpdateFileFailure {
    success: false;
    errorCode: ServerError | 'file_not_found';
    errorMessage: string;
}
