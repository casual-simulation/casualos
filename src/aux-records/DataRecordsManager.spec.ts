import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsManager } from './RecordsManager';
import { DataRecordsManager, RecordDataSuccess } from './DataRecordsMananger';
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
                'data'
            )) as RecordDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');
        });
    });
});
