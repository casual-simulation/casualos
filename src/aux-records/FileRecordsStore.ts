import { ServerError } from './Errors';

/**
 * Defines an interface that provides a way to store file records.
 */
export interface FileRecordsStore {
    /**
     * Presigns a request to record a file.
     * Returns the URL that should be used to upload the file and the headers that should be included in the upload request.
     * @param request The request to create a signed request for.
     */
    presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult>;

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
     * Attempts to add a record for a file to the store.
     * @param recordName The name of the record that the file was recorded in.
     * @param fileName The name of the file that should be recorded.
     * @param publisherId The ID of the publisher that published the record.
     * @param subjectId The ID of the subject that was logged in when the record was published.
     * @param sizeInBytes The size of the file in bytes.
     * @param description The description of the file.
     */
    addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string
    ): Promise<AddFileResult>;

    /**
     * Marks the given file record as having been uploaded.
     * @param recordName The reocrd that the file was uploaded to.
     * @param fileName The name of the file that was uploaded.
     */
    setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult>;
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
