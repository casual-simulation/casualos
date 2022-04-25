import { RecordsStore } from './RecordsStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { RecordsController } from './RecordsController';
import {
    DataRecordsController,
    EraseDataFailure,
    EraseDataSuccess,
    GetDataFailure,
    GetDataResult,
    GetDataSuccess,
    RecordDataFailure,
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
    let subjectlessKey: string;

    beforeEach(async () => {
        recordsStore = new MemoryRecordsStore();
        records = new RecordsController(recordsStore);
        store = new MemoryDataRecordsStore();
        manager = new DataRecordsController(records, store);

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

        it('should reject the request if given an invalid key', async () => {
            const result = (await manager.recordData(
                'not_a_key',
                'address',
                'data',
                'subjectId'
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_record_key');
        });

        it('should reject the request if given a null subject ID', async () => {
            const result = (await manager.recordData(
                key,
                'address',
                'data',
                null
            )) as RecordDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');
        });

        it('should allow the request if given a null subject ID with a subjectless key', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
                'address',
                'data',
                null
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
                subjectId: null,
            });
        });

        it('should clear the subject if using a subjectless key', async () => {
            const result = (await manager.recordData(
                subjectlessKey,
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
                subjectId: null,
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

    describe('listData()', () => {
        it('should retrieve multiple records from the data store', async () => {
            for (let i = 0; i < 5; i++) {
                await store.setData(
                    'testRecord',
                    'address/' + i,
                    'data' + i,
                    'testUser',
                    'subjectId'
                );
            }

            const result = await manager.listData('testRecord', 'address/2');

            expect(result).toEqual({
                success: true,
                recordName: 'testRecord',
                items: [
                    {
                        address: 'address/3',
                        data: 'data3',
                    },
                    {
                        address: 'address/4',
                        data: 'data4',
                    },
                ],
            });
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
                'address',
                'userId'
            )) as EraseDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should reject the request if given an invalid key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.eraseData(
                'wrongkey',
                'address',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_record_key');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
            expect(storeResult.publisherId).toBe('testUser');
            expect(storeResult.subjectId).toBe('subjectId');
        });

        it('should reject the request if given a null subjectId', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.eraseData(
                key,
                'address',
                null
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(true);
            expect(storeResult.data).toBe('data');
        });

        it('should be able to delete items with a subjectless key', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.eraseData(
                subjectlessKey,
                'address',
                null
            )) as EraseDataSuccess;

            expect(result.success).toBe(true);
            expect(result.recordName).toBe('testRecord');
            expect(result.address).toBe('address');

            const storeResult = await store.getData('testRecord', 'address');

            expect(storeResult.success).toBe(false);
            expect(storeResult.errorCode).toBe('data_not_found');
        });

        it('should do nothing if trying to delete some data that doesnt exist', async () => {
            await store.setData(
                'testRecord',
                'address',
                'data',
                'testUser',
                'subjectId'
            );

            const result = (await manager.eraseData(
                subjectlessKey,
                'missing',
                'userId'
            )) as EraseDataFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('data_not_found');
        });
        
    });
});
