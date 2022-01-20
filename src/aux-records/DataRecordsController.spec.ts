import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    DataRecordsController,
    EraseDataSuccess,
    GetDataFailure,
    GetDataResult,
    GetDataSuccess,
    RecordDataSuccess,
} from './DataRecordsController';
import { DataRecordsStore } from './DataRecordsStore';
import { MemoryDataRecordsStore } from './MemoryDataRecordsStore';

describe('DataRecordsController', () => {
    let recordsStore: RecordsStore;
    let records: RecordsController;
    let store: DataRecordsStore;
    let manager: DataRecordsController;
    let key: string;

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsController(recordsStore);
        store = new MemoryDataRecordsStore();
        manager = new DataRecordsController(records, store);

        const result = await records.createPublicRecordKey(
            'testRecord',
            'testUser'
        );
        if (result.success) {
            key = result.recordKey;
        }
    });

    describe('recordData()', () => {
        it('should store records in the data store', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                'subjectId'
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            await expect(
                store.getData('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                data: 'data',
                publisherId: 'testUser',
                subjectId: 'subjectId',
            });
        });
    });

    describe('getData()', () => {
        it('should retrieve records from the data store', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataSuccess;

            expect(result.success).toBe(true);
            expect(result.data).toBe('data');
            expect(result.publisherId).toBe('testUser');
            expect(result.subjectId).toBe('subjectId');
        });

        it('should return a data_not_found error if the data is not in the store', async () => {
            const result = (await manager.getData(
                'testRecord',
                'address'
            )) as GetDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('data_not_found');
            expect(result.errorMessage).toBe('The data was not found.');
        });
    });

    describe('eraseData()', () => {
        it('should delete the record from the data store', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.eraseData(
                key,
                'address'
            )) as EraseDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });
    });
});
