import { FileRecordsStore, signRequest } from '@casual-simulation/aux-records';
import {
    PresignFileUploadRequest,
    PresignFileUploadResult,
    GetFileRecordResult,
    AddFileResult,
    MarkFileRecordAsUploadedResult,
} from '@casual-simulation/aux-records';
import AWS from 'aws-sdk';
import dynamodb from 'aws-sdk/clients/dynamodb';

/**
 * Defines a class that can manage file records in DynamoDB and S3.
 */
export class DynamoDBFileStore implements FileRecordsStore {
    private _region: string;
    private _bucket: string;
    private _storageClass: string;
    private _aws: typeof AWS;
    private _dynamo: dynamodb.DocumentClient;
    private _tableName: string;
    private _s3Host: string;

    constructor(
        region: string,
        bucket: string,
        documentClient: dynamodb.DocumentClient,
        tableName: string,
        storageClass: string = 'STANDARD',
        aws: typeof AWS = AWS,
        s3Host: string = null
    ) {
        this._region = region;
        this._bucket = bucket;
        this._dynamo = documentClient;
        this._tableName = tableName;
        this._storageClass = storageClass;
        this._aws = aws;
        this._s3Host = s3Host;
    }

    async presignFileUpload(
        request: PresignFileUploadRequest
    ): Promise<PresignFileUploadResult> {
        const credentials = await this._getCredentials();

        const secretAccessKey = credentials
            ? credentials.secretAccessKey
            : null;
        const accessKeyId = credentials ? credentials.accessKeyId : null;

        const now = new Date();
        const result = signRequest(
            {
                method: 'PUT',
                payloadSha256Hex: request.fileSha256Hex,
                headers: {
                    'content-type': request.fileMimeType,
                    'content-length': request.fileByteLength.toString(),
                    'cache-control': 'max-age=31536000',
                    'x-amz-acl': 'public-read',
                    'x-amz-storage-class': this._storageClass,
                    'x-amz-tagging': `RecordName=${encodeURIComponent(
                        request.recordName
                    )}&FileName=${encodeURIComponent(request.fileName)}`,
                },
                queryString: {},
                uri: this._fileUrl(request.recordName, request.fileName),
            },
            secretAccessKey,
            accessKeyId,
            now,
            this._region,
            's3'
        );

        return {
            success: true,
            uploadUrl: result.uri,
            uploadHeaders: result.headers,
            uploadMethod: result.method,
        };
    }

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<GetFileRecordResult> {
        try {
            const result = await this._dynamo
                .get({
                    TableName: this._tableName,
                    Key: {
                        recordName: recordName,
                        fileName: fileName,
                    },
                })
                .promise();

            if (result.Item) {
                const file = result.Item as StoredFile;
                return {
                    success: true,
                    recordName: file.recordName,
                    fileName: file.fileName,
                    description: file.description,
                    publisherId: file.publisherId,
                    subjectId: file.subjectId,
                    sizeInBytes: file.sizeInBytes,
                    uploaded: file.uploadTime !== null,
                    url: this._fileUrl(file.recordName, file.fileName),
                };
            } else {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            }
        } catch (err) {
            console.error(err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'An unexpected error occurred.',
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
        try {
            const publishTime = Date.now();
            const file: StoredFile = {
                recordName,
                fileName,
                publisherId,
                subjectId,
                sizeInBytes,
                description,
                publishTime,
                uploadTime: null,
            };

            await this._dynamo
                .put({
                    TableName: this._tableName,
                    Item: file,
                    ConditionExpression:
                        'attribute_not_exists(recordName) AND attribute_not_exists(fileName)',
                })
                .promise();

            return {
                success: true,
            };
        } catch (err) {
            if (
                err instanceof Error &&
                err.name === 'ConditionalCheckFailedException'
            ) {
                return {
                    success: false,
                    errorCode: 'file_already_exists',
                    errorMessage: 'The file already exists.',
                };
            } else {
                console.error(err);
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An unexpected error occurred.',
                };
            }
        }
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        try {
            await this._dynamo
                .update({
                    TableName: this._tableName,
                    Key: {
                        recordName: recordName,
                        fileName: fileName,
                    },
                    ConditionExpression:
                        'attribute_exists(recordName) AND attribute_exists(fileName)',
                    UpdateExpression: 'SET uploadTime = :uploadTime',
                    ExpressionAttributeValues: {
                        ':uploadTime': Date.now(),
                    },
                })
                .promise();

            return {
                success: true,
            };
        } catch (err) {
            if (
                err instanceof Error &&
                err.name === 'ConditionalCheckFailedException'
            ) {
                return {
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: 'The file was not found.',
                };
            } else {
                console.error(err);
                return {
                    success: false,
                    errorCode: 'server_error',
                    errorMessage: 'An unexpected error occurred.',
                };
            }
        }
    }

    private _getCredentials(): Promise<AWS.Credentials> {
        return new Promise((resolve, reject) => {
            this._aws.config.getCredentials(function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    private _fileUrl(recordName: string, fileName: string): string {
        let filePath = `${recordName}/${fileName}`;

        if (this._s3Host) {
            filePath = `${this._s3Host}/${this._bucket}/${filePath}`;
        }

        return new URL(filePath, `https://${this._bucket}.s3.amazonaws.com`)
            .href;
    }
}

/**
 * Defines the interface that file records stored in DynamoDB adhere to.
 */
interface StoredFile {
    /**
     * The name of the record that the file is stored in.
     */
    recordName: string;

    /**
     * The name of the file.
     */
    fileName: string;

    /**
     * The ID of the publisher that uploaded the file.
     */
    publisherId: string;

    /**
     * The ID of the user that was logged in when the file was uploaded.
     */
    subjectId: string;

    /**
     * The size of the file in bytes.
     */
    sizeInBytes: number;

    /**
     * The time that the file was published in miliseconds since January 1 1970 00:00:00 UTC.
     */
    publishTime: number;

    /**
     * The description of the file.
     */
    description: string;

    /**
     * The time that the file was uploaded. Null if the file has not been uploaded.
     */
    uploadTime: number;
}
