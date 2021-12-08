import { fromBase64String, toBase64String } from './Utils';
import {
    CreatePublicRecordKeySuccess,
    formatRecordKey,
    isRecordKey,
    parseRecordKey,
    RecordsManager,
} from './RecordsManager';
import { MemoryRecordsStore } from './MemoryRecordsStore';

describe('RecordsManager', () => {
    let manager: RecordsManager;
    let store: MemoryRecordsStore;

    beforeEach(() => {
        store = new MemoryRecordsStore();
        manager = new RecordsManager(store);
    });

    describe('createPublicRecordKey()', () => {
        it('should return a value that contains the formatted record name and a random password', async () => {
            const result = (await manager.createPublicRecordKey(
                'name',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
        });
    });
});

describe('formatRecordKey()', () => {
    it('should combine the given record name and password', () => {
        const result = formatRecordKey('name', 'password');

        const [version, name, password] = result.split('.');

        expect(version).toBe('vRK1');
        expect(name).toBe(toBase64String('name'));
        expect(password).toBe(toBase64String('password'));
    });
});

describe('parseRecordKey()', () => {
    it('should parse the given key into the name and password', () => {
        const key = formatRecordKey('name', 'password');
        const [name, password] = parseRecordKey(key);

        expect(name).toBe('name');
        expect(password).toBe('password');
    });

    it('should return null if given an empty string', () => {
        const result = parseRecordKey('');

        expect(result).toBe(null);
    });

    it('should return null if given a string with the wrong version', () => {
        const result = parseRecordKey('vK1');

        expect(result).toBe(null);
    });

    it('should return null if given a string with no data', () => {
        const result = parseRecordKey('vRK1.');

        expect(result).toBe(null);
    });

    it('should return null if given a string with no password', () => {
        const result = parseRecordKey(`vRK1.${toBase64String('name')}`);

        expect(result).toBe(null);
    });

    it('should return null if given a null key', () => {
        const result = parseRecordKey(null);

        expect(result).toBe(null);
    });
});

// describe('isRecordKey()', () => {
//     it('should return true if ')
// });
