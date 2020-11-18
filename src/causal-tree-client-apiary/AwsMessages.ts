export type AwsMessage =
    | AwsMessageData
    | AwsUploadRequest
    | AwsDownloadRequest
    | AwsUploadResponse;

/**
 * The number of bytes that should be added as overhead for message data requests.
 */
export const AWS_MESSAGE_DATA_OVERHEAD = 30;

/**
 * Defines a message that sends some data over websockets.
 */
export interface AwsMessageData {
    type: 'message';
    data: string;
}

/**
 * Defines a message that requests an upload URL for sending some data that is over 128KB large.
 */
export interface AwsUploadRequest {
    type: 'upload_request';

    /**
     * The ID of the upload request.
     */
    id: string;
}

/**
 * Defines a message that indicates what URL should be used in response to an upload request.
 */
export interface AwsUploadResponse {
    type: 'upload_response';

    /**
     * The ID of the upload request.
     */
    id: string;

    /**
     * The URL that the file should be uploaded to.
     */
    uploadUrl: string;
}

/**
 * Defines a message that indicates the given URL should be downloaded to represent the actual message.
 */
export interface AwsDownloadRequest {
    type: 'download_request';
    url: string;
}
