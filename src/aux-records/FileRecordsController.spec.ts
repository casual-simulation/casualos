import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    FileRecordsController,
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

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsController(recordsStore);
        store = new MemoryFileRecordsStore();
        manager = new FileRecordsController(records, store);
        presignUrlMock = store.presignFileUpload = jest.fn();

        const result = await records.createPublicRecordKey(
            'testRecord',
            'testUser'
        );
        if (result.success) {
            key = result.recordKey;
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
    });

    // describe('getFile()', () => {
    //     it('should retrieve records from the data store', async () => {
    //         await store.setData(
    //             'testRecord',
    //             'address',
    //             'data',
    //             'testUser',
    //             'subjectId'
    //         );

    //         const result = (await manager.getData(
    //             'testRecord',
    //             'address'
    //         )) as GetDataSuccess;

    //         expect(result.success).toBe(true);
    //         expect(result.data).toBe('data');
    //         expect(result.publisherId).toBe('testUser');
    //         expect(result.subjectId).toBe('subjectId');
    //     });

    //     it('should return a data_not_found error if the data is not in the store', async () => {
    //         const result = (await manager.getData(
    //             'testRecord',
    //             'address'
    //         )) as GetDataFailure;

    //         expect(result.success).toBe(false);
    //         expect(result.errorCode).toBe('data_not_found');
    //         expect(result.errorMessage).toBe('The data was not found.');
    //     });
    // });
});
