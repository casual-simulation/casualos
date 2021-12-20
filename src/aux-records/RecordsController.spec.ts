import { fromBase64String, toBase64String } from './Utils';
import {
    CreatePublicRecordKeyFailure,
    CreatePublicRecordKeySuccess,
    formatRecordKey,
    isRecordKey,
    parseRecordKey,
    RecordsController,
    ValidatePublicRecordKeyFailure,
    ValidatePublicRecordKeySuccess,
} from './RecordsController';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { hashPassword, hashPasswordWithSalt } from '@casual-simulation/crypto';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';

describe('RecordsController', () => {
    let manager: RecordsController;
    let store: MemoryRecordsStore;

    beforeEach(() => {
        store = new MemoryRecordsStore();
        manager = new RecordsController(store);
    });

    describe('createPublicRecordKey()', () => {
        it('should return a value that contains the formatted record name and a random password', async () => {
            const result = (await manager.createPublicRecordKey(
                'name',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: [expect.any(String)],
                secretSalt: expect.any(String),
            });
        });

        it('should be able to add a key to an existing record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test', expect.any(String)],
                secretSalt: 'salt',
            });
        });

        it('should return an error if the user id is different from the creator of the record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                'differentId'
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('unauthorized_to_create_record_key');
            expect(result.errorMessage).toBe(
                'Another user has already created this record.'
            );
        });

        it('should return a general error if the store throws while getting a record', async () => {
            store.getRecordByName = jest.fn(() => {
                throw new Error('Test Error');
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                'differentId'
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('server_error');
            expect(result.errorMessage).toEqual(
                expect.stringContaining('Test Error')
            );
        });
    });

    describe('validatePublicRecordKey()', () => {
        it('should return true if the given key is valid and is contained in the secret hashes of the record', async () => {
            const salt = fromByteArray(randomBytes(16));
            const hash1 = hashPasswordWithSalt('password1', salt);
            const hash2 = hashPasswordWithSalt('password2', salt);
            const hash3 = hashPasswordWithSalt('password3', salt);
            store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: [hash3, hash2, hash1],
                secretSalt: salt,
            });
            const result = (await manager.validatePublicRecordKey(
                formatRecordKey('name', 'password1')
            )) as ValidatePublicRecordKeySuccess;

            expect(result).toEqual({
                success: true,
                recordName: 'name',
                ownerId: 'userId',
            });
        });

        it('should return false if given null', async () => {
            const result = (await manager.validatePublicRecordKey(
                null
            )) as ValidatePublicRecordKeyFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_record_key',
                errorMessage: 'Invalid record key.',
            });
        });

        it('should return a general error if the store throws while getting a record', async () => {
            store.getRecordByName = jest.fn(() => {
                throw new Error('Test Error');
            });
            const result = (await manager.validatePublicRecordKey(
                formatRecordKey('name', 'password1')
            )) as ValidatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('server_error');
            expect(result.errorMessage).toEqual(
                expect.stringContaining('Test Error')
            );
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
