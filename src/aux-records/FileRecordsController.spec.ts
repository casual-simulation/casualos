import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    EraseFileFailure,
    EraseFileSuccess,
    FileRecordsController,
    ReadFileFailure,
    ReadFileSuccess,
    RecordFileFailure,
    RecordFileSuccess,
    UpdateFileRecordSuccess,
} from './FileRecordsController';
import { FileRecordsStore, UpdateFileFailure } from './FileRecordsStore';
import { MemoryFileRecordsStore } from './MemoryFileRecordsStore';
import { MemoryPolicyStore } from './MemoryPolicyStore';
import { PolicyController } from './PolicyController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from './TestUtils';
import { ADMIN_ROLE_NAME, PUBLIC_READ_MARKER } from './PolicyPermissions';

console.log = jest.fn();

describe('FileRecordsController', () => {
    let recordsStore: RecordsStore;
    let records: RecordsController;
    let policiesStore: MemoryPolicyStore;
    let policies: PolicyController;
    let store: FileRecordsStore;
    let presignUrlMock: jest.Mock;
    let presignReadMock: jest.Mock;
    let manager: FileRecordsController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    const recordName = 'testRecord';

    beforeEach(async () => {
        const services = createTestControllers();

        policiesStore = services.policyStore;
        policies = services.policies;
        recordsStore = services.recordsStore;
        records = services.records;

        store = new MemoryFileRecordsStore();
        manager = new FileRecordsController(policies, store);
        presignUrlMock = store.presignFileUpload = jest.fn();
        presignReadMock = store.presignFileRead = jest.fn();

        const user = await createTestUser(services, 'test@example.com');
        userId = user.userId;
        sessionKey = user.sessionKey;

        const testRecordKey = await createTestRecordKey(
            services,
            'testUser',
            recordName,
            'subjectfull'
        );
        key = testRecordKey.recordKey;

        const subjectlessRecordKey = await createTestRecordKey(
            services,
            'testUser',
            recordName,
            'subjectless'
        );
        subjectlessKey = subjectlessRecordKey.recordKey;
    });

    describe('recordFile()', () => {
        it('should store the file record in the store', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should include the given headers in the signature', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {
                    abc: 'test',
                },
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {
                    abc: 'test',
                },
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should return another signature if the file has not been uploaded yet', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should return file_already_exists if the file has been uploaded', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription',
                [PUBLIC_READ_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'testSha256.txt');

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_already_exists',
                errorMessage:
                    'The file has already been uploaded to ' +
                    (result as any).existingFileUrl,
                existingFileUrl: expect.any(String),
            });
        });

        it('should reject the request if using an invalid record key', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile('wrongkey', null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
            });
            expect(presignUrlMock).not.toHaveBeenCalled();
        });

        it('should reject the request if trying to upload a file without a subjectId', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in in order to record files.',
            });
            expect(presignUrlMock).not.toHaveBeenCalled();
        });

        it('should allow uploading files without a subjectId if the key is subjectless', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(subjectlessKey, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should clear the subjectId if using a subjectless key', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(
                subjectlessKey,
                'subjectId',
                {
                    fileSha256Hex: 'testSha256',
                    fileByteLength: 100,
                    fileMimeType: 'text/plain',
                    fileDescription: 'testDescription',
                    headers: {},
                }
            )) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file with a record name and user ID', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            policiesStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file with a custom marker', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            policiesStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret'],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: ['secret'],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: ['secret'],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });
    });

    describe('eraseFile()', () => {
        it('should erase the file record from the store', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                'userId'
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should reject the request if trying to erase files without a subjectId', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                null
            )) as EraseFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in in order to erase files.',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                description: 'description',
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                recordName: recordName,
                sizeInBytes: 100,
                subjectId: 'subjectId',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: 'testRecord/testFile.txt',
            });
        });

        it('should allow erasing files without a subjectId if the key is subjectless', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                subjectlessKey,
                'testFile.txt',
                null
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should be able to erase a file if the user has the correct permissions', async () => {
            policiesStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                recordName,
                'testFile.txt',
                userId
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });
    });

    describe('readFile()', () => {
        it('should get a URL that the file can be read from', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.readFile(
                key,
                'testFile.txt',
                userId
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should get a URL by record name if the user has the correct permissions', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            policiesStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                userId
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should deny requests if the user doesnt have permissions', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                userId
            )) as ReadFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'file.read',
                    kind: 'user',
                    id: userId,
                    marker: 'secret',
                    role: null,
                },
            });
            expect(presignReadMock).not.toHaveBeenCalled();
        });
    });

    describe('updateFile()', () => {
        it('should be able to update the markers on the file', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.updateFile(
                key,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to update the markers if the user has the admin role', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            policiesStore.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.updateFile(
                recordName,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject requests that are not authorized to change the markers', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            // policiesStore.roles[recordName] = {
            //     [userId]: new Set([ADMIN_ROLE_NAME])
            // };

            const result = (await manager.updateFile(
                recordName,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    permission: 'file.update',
                    kind: 'user',
                    id: userId,
                    marker: PUBLIC_READ_MARKER,
                    role: null,
                },
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject the request if trying to update files without a subjectId', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.updateFile(
                key,
                'testFile.txt',
                null,
                ['secret']
            )) as UpdateFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in in order to update files.',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                description: 'description',
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                recordName: recordName,
                sizeInBytes: 100,
                subjectId: 'subjectId',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: 'testRecord/testFile.txt',
            });
        });
    });

    describe('getFileNameFromUrl()', () => {
        it('should return the file name for the given file URL', async () => {
            const result = await manager.getFileNameFromUrl(
                'http://localhost:9191/record-name/file-name.aux'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'record-name',
                fileName: 'file-name.aux',
            });
        });
    });
});
