import {
    AddFileResult,
    GetFileRecordSuccess,
    MarkFileRecordAsUploadedFailure,
    MarkFileRecordAsUploadedSuccess,
    PresignFileUploadSuccess,
} from '../aux-records';
import { DynamoDBFileStore } from './DynamoDBFileStore';
import type AWS from 'aws-sdk';
import {
    awsResult,
    awsError,
    ConditionalCheckFailedException,
} from './AwsTestUtils';
import '../../jest/jest-matchers';

describe('DynamoDBFileStore', () => {
    let store: DynamoDBFileStore;
    let credentials: AWS.Credentials;
    let aws = {
        config: {
            getCredentials: jest.fn(),
            credentials,
        },
    };
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
    };

    beforeEach(() => {
        credentials = {
            accessKeyId: 'accessKeyId',
            secretAccessKey: 'secretAccessKey',
        } as any;
        aws = {
            config: {
                getCredentials: jest.fn((callback: Function) => {
                    callback.call(credentials, null, credentials);
                }),
                credentials: credentials,
            },
        };
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
            update: jest.fn(),
        };
        store = new DynamoDBFileStore(
            'us-east-1',
            'test-bucket',
            dynamodb as any,
            'test-table',
            'STANDARD',
            <typeof AWS>(<unknown>aws)
        );
    });

    describe('presignFileUpload()', () => {
        it('should return a S3 PutObject request', async () => {
            const result = (await store.presignFileUpload({
                recordName: 'test record',
                fileName: 'test file.xml',
                fileSha256Hex: 'test-sha256',
                fileMimeType: 'test-mime-type',
                fileByteLength: 100,
                headers: {},
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                'x-amz-tagging':
                    'RecordName=test%20record&FileName=test%20file.xml',
                Authorization: expect.any(String),
            });
        });

        it('should use the path URL syntax for custom S3 hosts', async () => {
            store = new DynamoDBFileStore(
                'us-east-1',
                'test-bucket',
                dynamodb as any,
                'test-table',
                'STANDARD',
                <typeof AWS>(<unknown>aws),
                'http://s3:4567'
            );
            const result = (await store.presignFileUpload({
                recordName: 'test record',
                fileName: 'test file.xml',
                fileSha256Hex: 'test-sha256',
                fileMimeType: 'test-mime-type',
                fileByteLength: 100,
                headers: {},
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'http://s3:4567/test-bucket/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                'x-amz-tagging':
                    'RecordName=test%20record&FileName=test%20file.xml',
                Authorization: expect.any(String),
            });
        });

        it('should include the provider headers in the signature', async () => {
            const result = (await store.presignFileUpload({
                recordName: 'test record',
                fileName: 'test file.xml',
                fileSha256Hex: 'test-sha256',
                fileMimeType: 'test-mime-type',
                fileByteLength: 100,
                headers: {
                    test: 'abc',
                },
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                'x-amz-tagging':
                    'RecordName=test%20record&FileName=test%20file.xml',
                test: 'abc',
                Authorization: expect.stringContaining('test'),
            });
        });
    });

    describe('addFileRecord()', () => {
        it('should put a file into the DynamoDB table', async () => {
            dynamodb.put.mockReturnValue(awsResult({}));
            const result = (await store.addFileRecord(
                'test-record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description'
            )) as AddFileResult;

            expect(result).toEqual({
                success: true,
            });
            expect(dynamodb.put).toBeCalledWith({
                TableName: 'test-table',
                Item: {
                    recordName: 'test-record',
                    fileName: 'test file.xml',
                    publisherId: 'publisherId',
                    subjectId: 'subjectId',
                    sizeInBytes: 256,
                    description: 'test description',
                    publishTime: expect.any(Number),
                    uploadTime: null,
                },
                ConditionExpression:
                    'attribute_not_exists(recordName) AND attribute_not_exists(fileName)',
            });
        });

        it('should return a file_already_exists error if the condition expression fails', async () => {
            dynamodb.put.mockReturnValue(
                awsError(new ConditionalCheckFailedException())
            );
            const result = (await store.addFileRecord(
                'test-record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description'
            )) as AddFileResult;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists.',
            });
        });
    });

    describe('getFileRecord()', () => {
        it('should get the file record from the DynamoDB table', async () => {
            dynamodb.get.mockReturnValue(
                awsResult({
                    Item: {
                        recordName: 'test record',
                        fileName: 'test file.xml',
                        publisherId: 'publisherId',
                        subjectId: 'subjectId',
                        sizeInBytes: 256,
                        description: 'test description',
                        publishTime: 123456789,
                        uploadTime: null,
                    },
                })
            );
            const result = (await store.getFileRecord(
                'test record',
                'test file.xml'
            )) as GetFileRecordSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
                url: 'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 256,
                description: 'test description',
                uploaded: false,
            });
            expect(dynamodb.get).toBeCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test record',
                    fileName: 'test file.xml',
                },
            });
        });

        it('should return a file_not_found result if the file does not exist', async () => {
            dynamodb.get.mockReturnValue(
                awsResult({
                    Item: null,
                })
            );
            const result = (await store.getFileRecord(
                'test record',
                'test file.xml'
            )) as GetFileRecordSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found.',
            });
            expect(dynamodb.get).toBeCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test record',
                    fileName: 'test file.xml',
                },
            });
        });
    });

    describe('setFileRecordAsUploaded()', () => {
        it('should update the given record with the upload time', async () => {
            dynamodb.update.mockReturnValue(awsResult({}));
            const result = (await store.setFileRecordAsUploaded(
                'test record',
                'test file.xml'
            )) as MarkFileRecordAsUploadedSuccess;

            expect(result).toEqual({
                success: true,
            });
            expect(dynamodb.update).toBeCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test record',
                    fileName: 'test file.xml',
                },
                ConditionExpression:
                    'attribute_exists(recordName) AND attribute_exists(fileName)',
                UpdateExpression: 'SET uploadTime = :uploadTime',
                ExpressionAttributeValues: {
                    ':uploadTime': expect.expect(
                        'toBeGreaterThan',
                        1640813000000
                    ),
                },
            });
        });

        it('should return a file_not_found error if the condition expression check fails', async () => {
            dynamodb.update.mockReturnValue(
                awsError(new ConditionalCheckFailedException())
            );
            const result = (await store.setFileRecordAsUploaded(
                'test record',
                'test file.xml'
            )) as MarkFileRecordAsUploadedFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found.',
            });
        });
    });
});
