export type AwsMessage =
    | AwsMessageData
    | AwsUploadRequest
    | AwsDownloadRequest
    | AwsUploadResponse;

/**
 * The number of bytes that should be added as overhead for message data requests.
 */
export const AWS_MESSAGE_DATA_OVERHEAD = 30;

export enum AwsMessageTypes {
    Message = 1,
    UploadRequest = 2,
    UploadResponse = 3,
    DownloadRequest = 4,
}

export type AwsMessageData = [type: AwsMessageTypes.Message, data: string];
export type AwsUploadRequest = [
    type: AwsMessageTypes.UploadRequest,
    id: string
];
export type AwsUploadResponse = [
    type: AwsMessageTypes.UploadResponse,
    id: string,
    uploadUrl: string
];
export type AwsDownloadRequest = [
    type: AwsMessageTypes.DownloadRequest,
    url: string
];
