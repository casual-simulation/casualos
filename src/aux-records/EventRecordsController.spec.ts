import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    AddCountSuccess,
    EventRecordsController,
    GetCountSuccess,
} from './EventRecordsController';
import { MemoryEventRecordsStore } from './MemoryEventRecordsStore';
import { EventRecordsStore } from './EventRecordsStore';

describe('EventRecordsController', () => {
    let recordsStore: RecordsStore;
    let records: RecordsController;
    let store: EventRecordsStore;
    let manager: EventRecordsController;
    let key: string;

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsController(recordsStore);
        store = new MemoryEventRecordsStore();
        manager = new EventRecordsController(records, store);

        const result = await records.createPublicRecordKey(
            'testRecord',
            'testUser'
        );
        if (result.success) {
            key = result.recordKey;
        }
    });

    describe('addCount()', () => {
        it('should add the given count to the records store', async () => {
            const result = (await manager.addCount(
                key,
                'address',
                5
            )) as AddCountSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.eventName).toBe('address');

            await expect(
                store.getEventCount('testRecord', 'address')
            ).resolves.toEqual({
                success: true,
                count: 5,
            });
        });
    });

    describe('getData()', () => {
        it('should retrieve records from the data store', async () => {
            await store.addEventCount('testRecord', 'address', 10);

            const result = (await manager.getCount(
                'testRecord',
                'address'
            )) as GetCountSuccess;

            expect(result).toEqual({
                success: true,
                count: 10,
                recordName: 'testRecord',
                eventName: 'address',
            });
        });
    });
});
