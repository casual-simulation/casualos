import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsManager } from './RecordsManager';
import {
    DataRecordsManager,
    GetDataFailure,
    GetDataResult,
    GetDataSuccess,
    RecordDataSuccess,
} from './DataRecordsMananger';
import { DataRecordsStore } from './DataRecordsStore';
import { MemoryDataRecordsStore } from './MemoryDataRecordsStore';

describe('DataRecordsManager', () => {
    let recordsStore: RecordsStore;
    let records: RecordsManager;
    let store: DataRecordsStore;
    let manager: DataRecordsManager;
    let key: string;

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsManager(recordsStore);
        store = new MemoryDataRecordsStore();
        manager = new DataRecordsManager(records, store);

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
});
