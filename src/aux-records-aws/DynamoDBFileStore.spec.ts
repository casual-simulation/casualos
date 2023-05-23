import {
    DynamoDBFileStore,
    EMPTY_STRING_SHA256_HASH_HEX,
    s3AclForMarkers,
} from './DynamoDBFileStore';
import type AWS from 'aws-sdk';
import {
    awsResult,
    awsError,
    ConditionalCheckFailedException,
} from './AwsTestUtils';
import {
    FileRecordsStore,
    signRequest,
    EraseFileStoreResult,
    AddFileResult,
    GetFileRecordSuccess,
    MarkFileRecordAsUploadedFailure,
    MarkFileRecordAsUploadedSuccess,
    PresignFileUploadSuccess,
    PresignFileReadSuccess,
    UpdateFileResult,
} from '@casual-simulation/aux-records';
import '../../jest/jest-matchers';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-records/PolicyPermissions';

describe('DynamoDBFileStore', () => {
    let store: DynamoDBFileStore;
    let credentials: AWS.Credentials;
    let s3 = {
        deleteObject: jest.fn(),
    };
    class S3Test {
        get deleteObject() {
            return s3.deleteObject;
        }
    }
    let aws = {
        config: {
            getCredentials: jest.fn(),
            credentials,
        },
        S3: S3Test,
    };
    let dynamodb = {
        put: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
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
            S3: S3Test,
        };
        dynamodb = {
            put: jest.fn(),
            get: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        s3 = {
            deleteObject: jest.fn(),
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
                markers: [PUBLIC_READ_MARKER],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
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
                markers: [PUBLIC_READ_MARKER],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'http://s3:4567/test-bucket/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                host: 's3:4567',
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
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
                markers: [PUBLIC_READ_MARKER],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                test: 'abc',
                Authorization: expect.stringContaining('test'),
            });
        });

        it('should include the x-amz-security-token header if the credentials have a session token', async () => {
            credentials.sessionToken = 'mySessionToken';
            const result = (await store.presignFileUpload({
                recordName: 'test record',
                fileName: 'test file.xml',
                fileSha256Hex: 'test-sha256',
                fileMimeType: 'test-mime-type',
                fileByteLength: 100,
                headers: {
                    test: 'abc',
                },
                markers: [PUBLIC_READ_MARKER],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'public-read',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                'x-amz-security-token': 'mySessionToken',
                test: 'abc',
                Authorization: expect.stringContaining('test'),
            });
        });

        it('should match the AWS signed request', async () => {
            credentials.sessionToken =
                'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==';
            store = new DynamoDBFileStore(
                'us-east-1',
                'ab1-link-filesbucket-404655125928',
                dynamodb as any,
                'test-table',
                'STANDARD',
                <typeof AWS>(<unknown>aws)
            );

            const now = new Date(2022, 0, 4, 7, 3, 51);
            const signature = signRequest(
                {
                    method: 'PUT',
                    headers: {
                        'cache-control': 'max-age=31536000',
                        'content-length': '4',
                        'content-type': 'text/plain',
                        host: 'ab1-link-filesbucket-404655125928.s3.amazonaws.com',
                        'x-amz-acl': 'public-read',
                        'x-amz-content-sha256':
                            '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                        'x-amz-date': '20220104T070351Z',
                        'x-amz-security-token':
                            'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==',
                        'x-amz-storage-class': 'STANDARD',
                    },
                    queryString: {},
                    payloadSha256Hex:
                        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                    path: '/testRecord01/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt',
                },
                credentials.secretAccessKey,
                credentials.accessKeyId,
                now,
                'us-east-1',
                's3'
            );

            const result = (await store.presignFileUpload({
                recordName: 'testRecord01',
                fileName:
                    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt',
                fileSha256Hex:
                    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                fileMimeType: 'text/plain',
                fileByteLength: 4,
                headers: {},
                date: now,
                markers: [PUBLIC_READ_MARKER],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://ab1-link-filesbucket-404655125928.s3.amazonaws.com/testRecord01/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual(signature.headers);
        });

        it('should use the private ACL if not given the publicRead marker', async () => {
            const result = (await store.presignFileUpload({
                recordName: 'test record',
                fileName: 'test file.xml',
                fileSha256Hex: 'test-sha256',
                fileMimeType: 'test-mime-type',
                fileByteLength: 100,
                headers: {},
                markers: ['secret'],
            })) as PresignFileUploadSuccess;

            expect(result.success).toBe(true);
            expect(result.uploadUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result.uploadMethod).toBe('PUT');
            expect(result.uploadHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'content-type': 'test-mime-type',
                'content-length': '100',
                'cache-control': 'max-age=31536000',
                'x-amz-acl': 'private',
                'x-amz-content-sha256': 'test-sha256',
                'x-amz-storage-class': 'STANDARD',
                'x-amz-date': expect.any(String),
                Authorization: expect.any(String),
            });
        });
    });

    describe('presignFileRead()', () => {
        it('should return a S3 GetObject request', async () => {
            const result = (await store.presignFileRead({
                recordName: 'test record',
                fileName: 'test file.xml',
                headers: {},
            })) as PresignFileReadSuccess;

            expect(result.success).toBe(true);
            expect(result.requestUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml?response-cache-control=max-age%3D31536000'
            );
            expect(result.requestMethod).toBe('GET');
            expect(result.requestHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'x-amz-content-sha256': EMPTY_STRING_SHA256_HASH_HEX,
                'x-amz-date': expect.any(String),
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
            const result = (await store.presignFileRead({
                recordName: 'test record',
                fileName: 'test file.xml',
                headers: {},
            })) as PresignFileReadSuccess;

            expect(result.success).toBe(true);
            expect(result.requestUrl).toBe(
                'http://s3:4567/test-bucket/test%20record/test%20file.xml?response-cache-control=max-age%3D31536000'
            );
            expect(result.requestMethod).toBe('GET');
            expect(result.requestHeaders).toEqual({
                host: 's3:4567',
                'x-amz-content-sha256': EMPTY_STRING_SHA256_HASH_HEX,
                'x-amz-date': expect.any(String),
                Authorization: expect.any(String),
            });
        });

        it('should include the provider headers in the signature', async () => {
            const result = (await store.presignFileRead({
                recordName: 'test record',
                fileName: 'test file.xml',
                headers: {
                    test: 'abc',
                },
            })) as PresignFileReadSuccess;

            expect(result.success).toBe(true);
            expect(result.requestUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml?response-cache-control=max-age%3D31536000'
            );
            expect(result.requestMethod).toBe('GET');
            expect(result.requestHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'x-amz-content-sha256': EMPTY_STRING_SHA256_HASH_HEX,
                'x-amz-date': expect.any(String),
                test: 'abc',
                Authorization: expect.stringContaining('test'),
            });
        });

        it('should include the x-amz-security-token header if the credentials have a session token', async () => {
            credentials.sessionToken = 'mySessionToken';
            const result = (await store.presignFileRead({
                recordName: 'test record',
                fileName: 'test file.xml',
                headers: {
                    test: 'abc',
                },
            })) as PresignFileReadSuccess;

            expect(result.success).toBe(true);
            expect(result.requestUrl).toBe(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml?response-cache-control=max-age%3D31536000'
            );
            expect(result.requestMethod).toBe('GET');
            expect(result.requestHeaders).toEqual({
                host: 'test-bucket.s3.amazonaws.com',
                'x-amz-content-sha256': EMPTY_STRING_SHA256_HASH_HEX,
                'x-amz-date': expect.any(String),
                'x-amz-security-token': 'mySessionToken',
                test: 'abc',
                Authorization: expect.stringContaining('test'),
            });
        });

        it('should match the AWS signed request', async () => {
            credentials.sessionToken =
                'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==';
            store = new DynamoDBFileStore(
                'us-east-1',
                'ab1-link-filesbucket-404655125928',
                dynamodb as any,
                'test-table',
                'STANDARD',
                <typeof AWS>(<unknown>aws)
            );

            const now = new Date(2022, 0, 4, 7, 3, 51);
            const signature = signRequest(
                {
                    method: 'GET',
                    headers: {
                        host: 'ab1-link-filesbucket-404655125928.s3.amazonaws.com',
                        'x-amz-content-sha256': EMPTY_STRING_SHA256_HASH_HEX,
                        'x-amz-date': '20220104T070351Z',
                        'x-amz-security-token':
                            'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==',
                    },
                    queryString: {
                        'response-cache-control': 'max-age=31536000',
                    },
                    payloadSha256Hex: EMPTY_STRING_SHA256_HASH_HEX,
                    path: '/testRecord01/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt',
                },
                credentials.secretAccessKey,
                credentials.accessKeyId,
                now,
                'us-east-1',
                's3'
            );

            const result = (await store.presignFileRead({
                recordName: 'testRecord01',
                fileName:
                    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt',
                headers: {},
                date: now,
            })) as PresignFileReadSuccess;

            expect(result.success).toBe(true);
            expect(result.requestUrl).toBe(
                'https://ab1-link-filesbucket-404655125928.s3.amazonaws.com/testRecord01/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08.txt?response-cache-control=max-age%3D31536000'
            );
            expect(result.requestMethod).toBe('GET');
            expect(result.requestHeaders).toEqual(signature.headers);
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
                'test description',
                [PUBLIC_READ_MARKER]
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
                    markers: [PUBLIC_READ_MARKER],
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
                'test description',
                [PUBLIC_READ_MARKER]
            )) as AddFileResult;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists.',
            });
        });
    });

    describe('updateFileRecord()', () => {
        it('should update a file in the DynamoDB table', async () => {
            dynamodb.update.mockReturnValue(awsResult({}));
            const result = (await store.updateFileRecord(
                'test-record',
                'test file.xml',
                [PUBLIC_READ_MARKER]
            )) as UpdateFileResult;

            expect(result).toEqual({
                success: true,
            });
            expect(dynamodb.update).toBeCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record',
                    fileName: 'test file.xml',
                },
                ExpressionAttributeValues: {
                    ':markers': [PUBLIC_READ_MARKER],
                },
                UpdateExpression: 'SET markers = :markers',
                ConditionExpression:
                    'attribute_exists(recordName) AND attribute_exists(fileName)',
            });
        });

        it('should return a file_not_found error if the condition expression fails', async () => {
            dynamodb.update.mockReturnValue(
                awsError(new ConditionalCheckFailedException())
            );
            const result = (await store.updateFileRecord(
                'test-record',
                'test file.xml',
                [PUBLIC_READ_MARKER]
            )) as UpdateFileResult;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found.',
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

    describe('eraseFileRecord()', () => {
        it('should delete the file from the DynamoDB table', async () => {
            dynamodb.delete.mockReturnValue(awsResult({}));
            s3.deleteObject.mockReturnValue(awsResult({}));

            const result = (await store.eraseFileRecord(
                'test-record',
                'test file.xml'
            )) as EraseFileStoreResult;

            expect(result).toEqual({
                success: true,
            });
            expect(dynamodb.delete).toBeCalledWith({
                TableName: 'test-table',
                Key: {
                    recordName: 'test-record',
                    fileName: 'test file.xml',
                },
            });
            expect(s3.deleteObject).toBeCalledWith({
                Bucket: 'test-bucket',
                Key: 'test-record/test file.xml',
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

    describe('getFileNameFromUrl()', () => {
        it('should be able to parse the record name and file name from a standard S3 URL', async () => {
            const result = await store.getFileNameFromUrl(
                'https://test-bucket.s3.amazonaws.com/record-name/file-name.aux'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'record-name',
                fileName: 'file-name.aux',
            });
        });

        it('should be able to parse file names with slashes in them', async () => {
            const result = await store.getFileNameFromUrl(
                'https://test-bucket.s3.amazonaws.com/record-name/file-name/other-name.aux'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'record-name',
                fileName: 'file-name/other-name.aux',
            });
        });
    });
});

describe('s3AclForMarkers()', () => {
    const cases = [
        ['public', [PUBLIC_READ_MARKER], 'public-read'] as const,
        ['private', ['secret'], 'private'] as const,
    ];

    it.each(cases)('%s', (name, markers, expected) => {
        expect(s3AclForMarkers(markers)).toBe(expected);
    });
});
