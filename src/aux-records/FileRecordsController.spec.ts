import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    EraseFileFailure,
    EraseFileSuccess,
    FileRecordsController,
    RecordFileFailure,
    RecordFileSuccess,
} from './FileRecordsController';
import { FileRecordsStore } from './FileRecordsStore';
import { MemoryFileRecordsStore } from './MemoryFileRecordsStore';

describe('FileRecordsController', () => {
    let recordsStore: RecordsStore;
    let records: RecordsController;
    let store: FileRecordsStore;
    let presignUrlMock: jest.Mock;
    let manager: FileRecordsController;
    let key: string;
    let subjectlessKey: string;

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsController(recordsStore);
        store = new MemoryFileRecordsStore();
        manager = new FileRecordsController(records, store);
        presignUrlMock = store.presignFileUpload = jest.fn();

        const result = await records.createPublicRecordKey(
            'testRecord',
            'subjectfull',
            'testUser'
        );
        if (result.success) {
            key = result.recordKey;
        }

        const result2 = await records.createPublicRecordKey(
            'testRecord',
            'subjectless',
            'testUser'
        );
        if (result2.success) {
            subjectlessKey = result2.recordKey;
        }
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
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: 'testRecord',
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
            });

            await expect(
                store.getFileRecord('testRecord', 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: 'testRecord',
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
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
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: 'testRecord',
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {
                    abc: 'test',
                },
            });

            await expect(
                store.getFileRecord('testRecord', 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: 'testRecord',
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
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
                'testRecord',
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription'
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
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: 'testRecord',
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
            });

            await expect(
                store.getFileRecord('testRecord', 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: 'testRecord',
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
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
                'testRecord',
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription'
            );
            await store.setFileRecordAsUploaded('testRecord', 'testSha256.txt');

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
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
                errorCode: 'invalid_record_key',
                errorMessage: 'Invalid record key.'
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
                errorMessage: 'The user must be logged in in order to record files.'
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
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: 'testRecord',
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
            });

            await expect(
                store.getFileRecord('testRecord', 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: 'testRecord',
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
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

            const result = (await manager.recordFile(subjectlessKey, 'subjectId', {
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
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: 'testRecord',
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
            });

            await expect(
                store.getFileRecord('testRecord', 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: 'testRecord',
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
                uploaded: false,
                url: expect.any(String),
            });
        });
    });

    describe('eraseFile()', () => {
        it('should erase the file record from the store', async () => {
            await store.addFileRecord(
                'testRecord',
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description'
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                'userId'
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord('testRecord', 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should reject the request if trying to erase files without a subjectId', async () => {
            await store.addFileRecord(
                'testRecord',
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description'
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                null
            )) as EraseFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'The user must be logged in in order to erase files.'
            });

            await expect(
                store.getFileRecord('testRecord', 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                "description": "description",
               "fileName": "testFile.txt",
               "publisherId": "publisherId",
               "recordName": "testRecord",
               "sizeInBytes": 100,
               "subjectId": "subjectId",
               "uploaded": false,
               "url": "testRecord/testFile.txt",
            });
        });

        it('should allow erasing files without a subjectId if the key is subjectless', async () => {
            await store.addFileRecord(
                'testRecord',
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description'
            );

            const result = (await manager.eraseFile(
                subjectlessKey,
                'testFile.txt',
                null
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord('testRecord', 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });
    });
});
