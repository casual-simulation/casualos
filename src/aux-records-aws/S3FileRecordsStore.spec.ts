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
import {
    S3FileRecordsStore,
    EMPTY_STRING_SHA256_HASH_HEX,
    s3AclForMarkers,
    isPublicFile,
} from './S3FileRecordsStore';
import { awsResult } from './AwsTestUtils';
import type {
    EraseFileStoreResult,
    AddFileResult,
    GetFileRecordSuccess,
    MarkFileRecordAsUploadedSuccess,
    PresignFileUploadSuccess,
    PresignFileReadSuccess,
    UpdateFileResult,
} from '@casual-simulation/aux-records';
import {
    signRequest,
    MemoryFileRecordsLookup,
} from '@casual-simulation/aux-records';
import '../../jest/jest-matchers';
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import type {
    AwsCredentialIdentityProvider,
    AwsCredentialIdentity,
} from '@aws-sdk/types';

describe('S3FileRecordsStore', () => {
    let store: S3FileRecordsStore;
    let credentials: AwsCredentialIdentity;
    let credentialsProvider: AwsCredentialIdentityProvider;
    let s3 = {
        deleteObject: jest.fn(),
    };
    // class S3Test {
    //     get deleteObject() {
    //         return s3.deleteObject;
    //     }
    // }
    let lookup: MemoryFileRecordsLookup;

    beforeEach(() => {
        credentials = {
            accessKeyId: 'accessKeyId',
            secretAccessKey: 'secretAccessKey',
        } as any;
        credentialsProvider = async () => credentials;
        // aws = {
        //     config: {
        //         getCredentials: jest.fn((callback: Function) => {
        //             callback.call(credentials, null, credentials);
        //         }),
        //         credentials: credentials,
        //     },
        //     S3: S3Test,
        // };
        lookup = new MemoryFileRecordsLookup();
        s3 = {
            deleteObject: jest.fn(),
        };
        store = new S3FileRecordsStore(
            'us-east-1',
            'test-bucket',
            'default-bucket',
            lookup,
            'STANDARD',
            s3 as any,
            undefined,
            credentialsProvider
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
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                'http://s3:4567',
                credentialsProvider
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
            (credentials as any).sessionToken = 'mySessionToken';
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
            (credentials as any).sessionToken =
                'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==';
            store = new S3FileRecordsStore(
                'us-east-1',
                'ab1-link-filesbucket-404655125928',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                undefined,
                credentialsProvider
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

        it('should ignore the public files URL', async () => {
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                undefined,
                credentialsProvider,
                'https://public-files.com/path'
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
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                'http://s3:4567',
                credentialsProvider
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
            (credentials as any).sessionToken = 'mySessionToken';
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
            (credentials as any).sessionToken =
                'IQoJb3JpZ2luX2VjEGcaCXVzLWVhc3QtMSJHMEUCIFJ3clET9C/bkOLf+tWSfNEhIxD/+EOYwsxP+8WPHGcAAiEA1D1nzUusurkxhkrkKSXzHOqkRkduqGyBLUg7wKFKtPIqqgIIcBACGgw0MDQ2NTUxMjU5MjgiDBwrcBb3rmog77lyoSqHAmZpOVjZZ8X01rQAd2P8CK8+CHYU7xx9CGrTly5nzHi3n7LxXYkfUCoCFSOfhJiWNVLK3KPluj939Ku6kBOKQoYSfoteRBc5J+fcFTyEqlEv6Nu+yvmukFb5fnY5TQj5cD51meSGEKgesdA3FS6GEdyQvotDh+j+VX4PuE8sDWNNM59pahUvn5aevFFyUSSk2UEiM3vho9XLf+GHAB2IjkTswSoLJqKOyexfsnhBCy3G0W6RwBPiUczYANuzZCtEXeptuaxmhS1OkLfZ1azAK4epYVrU4CNwwR6cGsWSEo/UkrSdrSABWUMSY0qhbXTjHc5R8J3nblqNiwwdUqX7DPD5oW4F6tyzMNTiz44GOpoB+I8BuMHNEiaG6z/YwEZmquFv24ZTBZrDjPsrQYHN0Nh9kekm0oPzhNKorqp8+bPqEq7FJtNftN3rE/l/F/Gn4DRH5oekIi3MRdahG2GsB0w/kvTaq/pPTzQ8ykWLJPbjPMfHpRj6c/2EkyVNdHC7CdnpSt0IAZBycodwOVA8/aW8cryzSo7vCPdPyG7hgX8wpjHI2/GCWfAOYQ==';
            store = new S3FileRecordsStore(
                'us-east-1',
                'ab1-link-filesbucket-404655125928',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                undefined,
                credentialsProvider
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

        it('should ignore the public files URL', async () => {
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                undefined,
                credentialsProvider,
                'https://public-files.com/path'
            );

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
    });

    describe('addFileRecord()', () => {
        it('should put a file into the lookup store', async () => {
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
        });
    });

    describe('updateFileRecord()', () => {
        beforeEach(async () => {
            await lookup.addFileRecord(
                'test-record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                'test-bucket',
                [PUBLIC_READ_MARKER]
            );
        });

        it('should update a file in the lookup store', async () => {
            const result = (await store.updateFileRecord(
                'test-record',
                'test file.xml',
                [PUBLIC_READ_MARKER]
            )) as UpdateFileResult;

            expect(result).toEqual({
                success: true,
            });
        });
    });

    describe('getFileRecord()', () => {
        it('should get the file record', async () => {
            await lookup.addFileRecord(
                'test record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                'test-bucket',
                [PUBLIC_READ_MARKER]
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
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should use the default bucket if the file record does not have a bucket', async () => {
            await lookup.addFileRecord(
                'test record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                null,
                [PUBLIC_READ_MARKER]
            );

            const result = (await store.getFileRecord(
                'test record',
                'test file.xml'
            )) as GetFileRecordSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
                url: 'https://default-bucket.s3.amazonaws.com/test%20record/test%20file.xml',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 256,
                description: 'test description',
                uploaded: false,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should use the public files URL if the file record is public', async () => {
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                undefined,
                credentialsProvider,
                'https://public-files.com/path'
            );

            await lookup.addFileRecord(
                'test record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                null,
                [PUBLIC_READ_MARKER]
            );

            const result = (await store.getFileRecord(
                'test record',
                'test file.xml'
            )) as GetFileRecordSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
                url: 'https://public-files.com/path/test%20record/test%20file.xml',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 256,
                description: 'test description',
                uploaded: false,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        it('should return a file_not_found result if the file does not exist', async () => {
            const result = (await store.getFileRecord(
                'test record',
                'test file.xml'
            )) as GetFileRecordSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found.',
            });
        });
    });

    describe('eraseFileRecord()', () => {
        it('should delete the file from the DynamoDB table', async () => {
            await lookup.addFileRecord(
                'test record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                'test-bucket',
                [PUBLIC_READ_MARKER]
            );
            s3.deleteObject.mockReturnValue(awsResult({}));

            const result = (await store.eraseFileRecord(
                'test-record',
                'test file.xml'
            )) as EraseFileStoreResult;

            expect(result).toEqual({
                success: true,
            });
            expect(
                await lookup.getFileRecord('test-record', 'test file.xml')
            ).toBe(null);
            expect(s3.deleteObject).toBeCalledWith({
                Bucket: 'test-bucket',
                Key: 'test-record/test file.xml',
            });
        });
    });

    describe('setFileRecordAsUploaded()', () => {
        it('should update the given record as uploaded', async () => {
            await lookup.addFileRecord(
                'test record',
                'test file.xml',
                'publisherId',
                'subjectId',
                256,
                'test description',
                'test-bucket',
                [PUBLIC_READ_MARKER]
            );

            const result = (await store.setFileRecordAsUploaded(
                'test record',
                'test file.xml'
            )) as MarkFileRecordAsUploadedSuccess;

            expect(result).toEqual({
                success: true,
            });
            const record = await lookup.getFileRecord(
                'test record',
                'test file.xml'
            );
            expect(record?.uploaded).toBe(true);
        });
    });

    describe('getFileNameFromUrl()', () => {
        it('should work if given a custom S3 host', async () => {
            store = new S3FileRecordsStore(
                'us-east-1',
                'test-bucket',
                'default-bucket',
                lookup,
                'STANDARD',
                s3 as any,
                'http://s3:4567/path',
                credentialsProvider
            );

            const result = await store.getFileNameFromUrl(
                'http://s3:4567/path/test%20record/test%20file.xml'
            );
            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
            });
        });

        it('should return the file name from the given URL', async () => {
            const result = await store.getFileNameFromUrl(
                'https://test-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
            });
        });

        it('should support bucket names that dont match the configured bucket', async () => {
            const result = await store.getFileNameFromUrl(
                'https://different-bucket.s3.amazonaws.com/test%20record/test%20file.xml'
            );
            expect(result).toEqual({
                success: true,
                recordName: 'test record',
                fileName: 'test file.xml',
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

describe('isPublicFile()', () => {
    const cases = [
        ['public', [PUBLIC_READ_MARKER], true] as const,
        ['private', ['secret'], false] as const,
    ];

    it.each(cases)('%s', (name, markers, expected) => {
        expect(isPublicFile(markers)).toBe(expected);
    });
});
