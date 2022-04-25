import { fromBase64String, toBase64String } from './Utils';
import {
    CreatePublicRecordKeyFailure,
    CreatePublicRecordKeySuccess,
    DEFAULT_RECORD_KEY_POLICY,
    formatV1RecordKey,
    formatV2RecordKey,
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

console.error = jest.fn();

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
                'subjectfull',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectfull',
                    creatorId: 'userId'
                }
            ]);
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
                'subjectless',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectless',
                    creatorId: 'userId'
                }
            ]);
        });

        it('should default to subjectfull records if a null policy is given', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                null,
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectfull',
                    creatorId: 'userId'
                }
            ]);
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
                'subjectfull',
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
                'subjectless',
                'differentId'
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('server_error');
            expect(result.errorMessage).toEqual(
                expect.stringContaining('Test Error')
            );
        });
        
        it('should return an invalid_policy error if the given policy is not supported', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                'wrongpolicy' as any,
                'userId'
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('invalid_policy');
            expect(result.errorMessage).toBe('The record key policy must be either "subjectfull" or "subjectless".');
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            expect(store.recordKeys).toEqual([]);
        });

        it('should return an not_logged_in error if the user id is null', async () => {
            const result = (await manager.createPublicRecordKey(
                'name',
                'subjectfull',
                null
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('not_logged_in');
            expect(result.errorMessage).toBe(
                'The user must be logged in in order to create a record key.'
            );
        });
    });

    describe('validatePublicRecordKey()', () => {
        describe('v1 keys', () => {
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
                    formatV1RecordKey('name', 'password1')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'name',
                    ownerId: 'userId',
                    policy: 'subjectfull',
                });
            });

            it('should return true if the given key is valid and is contained in the key store', async () => {
                const salt = fromByteArray(randomBytes(16));
                const hash1 = hashPasswordWithSalt('password1', salt);
                const hash2 = hashPasswordWithSalt('password2', salt);
                const hash3 = hashPasswordWithSalt('password3', salt);
                store.addRecord({
                    name: 'name',
                    ownerId: 'userId',
                    secretHashes: [],
                    secretSalt: salt,
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash1,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash2,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash3,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                
                const result = (await manager.validatePublicRecordKey(
                    formatV1RecordKey('name', 'password1')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'name',
                    ownerId: 'userId',
                    policy: 'subjectfull',
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
                    formatV1RecordKey('name', 'password1')
                )) as ValidatePublicRecordKeyFailure;

                expect(result.success).toBe(false);
                expect(result.errorCode).toBe('server_error');
                expect(result.errorMessage).toEqual(
                    expect.stringContaining('Test Error')
                );
            });
        });

        describe('v2 keys', () => {
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
                    formatV2RecordKey('name', 'password1', 'subjectfull')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'name',
                    ownerId: 'userId',
                    policy: 'subjectfull',
                });
            });

            it('should return false if the given key is valid but has a non-default policy when it is contained in the secret hashes of the record', async () => {
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
                    formatV2RecordKey('name', 'password1', 'subjectless')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
                });
            });

            it('should return true if the given key is valid and is contained in the key store', async () => {
                const salt = fromByteArray(randomBytes(16));
                const hash1 = hashPasswordWithSalt('password1', salt);
                const hash2 = hashPasswordWithSalt('password2', salt);
                const hash3 = hashPasswordWithSalt('password3', salt);
                store.addRecord({
                    name: 'name',
                    ownerId: 'userId',
                    secretHashes: [],
                    secretSalt: salt,
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash1,
                    policy: 'subjectless',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash2,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash3,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                
                const result = (await manager.validatePublicRecordKey(
                    formatV2RecordKey('name', 'password1', 'subjectless')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: true,
                    recordName: 'name',
                    ownerId: 'userId',
                    policy: 'subjectless',
                });
            });

            it('should return false if the given key is valid but does not have the correct policy', async () => {
                const salt = fromByteArray(randomBytes(16));
                const hash1 = hashPasswordWithSalt('password1', salt);
                const hash2 = hashPasswordWithSalt('password2', salt);
                const hash3 = hashPasswordWithSalt('password3', salt);
                store.addRecord({
                    name: 'name',
                    ownerId: 'userId',
                    secretHashes: [],
                    secretSalt: salt,
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash1,
                    policy: 'subjectless',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash2,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                store.addRecordKey({
                    recordName: 'name',
                    secretHash: hash3,
                    policy: 'subjectfull',
                    creatorId: 'userId',
                });
                
                const result = (await manager.validatePublicRecordKey(
                    formatV2RecordKey('name', 'password1', 'subjectfull')
                )) as ValidatePublicRecordKeySuccess;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_record_key',
                    errorMessage: 'Invalid record key.',
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
                    formatV2RecordKey('name', 'password1', 'subjectfull')
                )) as ValidatePublicRecordKeyFailure;

                expect(result.success).toBe(false);
                expect(result.errorCode).toBe('server_error');
                expect(result.errorMessage).toEqual(
                    expect.stringContaining('Test Error')
                );
            });
        });
    });
});

describe('formatV1RecordKey()', () => {
    it('should combine the given record name and password', () => {
        const result = formatV1RecordKey('name', 'password');

        const [version, name, password] = result.split('.');

        expect(version).toBe('vRK1');
        expect(name).toBe(toBase64String('name'));
        expect(password).toBe(toBase64String('password'));
    });
});

describe('formatV2RecordKey()', () => {
    it('should combine the given record name and password and policy', () => {
        const result = formatV2RecordKey('name', 'password', 'subjectless');

        const split = result.split('.');

        expect(split).toEqual(['vRK2', toBase64String('name'), toBase64String('password'), 'subjectless']);
    });

    it('should default to subjectfull policies', () => {
        const result = formatV2RecordKey('name', 'password', null);

        const split = result.split('.');

        expect(split).toEqual(['vRK2', toBase64String('name'), toBase64String('password'), 'subjectfull']);
    });
});

describe('parseRecordKey()', () => {

    describe('v1', () => {
        it('should parse the given key into the name and password', () => {
            const key = formatV1RecordKey('name', 'password');
            const [name, password, policy] = parseRecordKey(key);
    
            expect(name).toBe('name');
            expect(password).toBe('password');
            expect(policy).toBe(DEFAULT_RECORD_KEY_POLICY); // Should always be the default policy
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

    describe('v2', () => {
        it('should parse the given key into the name and password', () => {
            const key = formatV2RecordKey('name', 'password', 'subjectless');
            const [name, password, policy] = parseRecordKey(key);
    
            expect(name).toBe('name');
            expect(password).toBe('password');
            expect(policy).toBe('subjectless');
        });

        it('should return null if given an empty string', () => {
            const result = parseRecordKey('');
    
            expect(result).toBe(null);
        });
    
        it('should return null if given a string with the wrong version', () => {
            const result = parseRecordKey('vK2');
    
            expect(result).toBe(null);
        });
    
        it('should return null if given a string with no data', () => {
            const result = parseRecordKey('vRK2.');
    
            expect(result).toBe(null);
        });
    
        it('should return null if given a string with no password', () => {
            const result = parseRecordKey(`vRK2.${toBase64String('name')}`);
    
            expect(result).toBe(null);
        });

        it('should return null if given a string with no policy', () => {
            const result = parseRecordKey(`vRK2.${toBase64String('name')}.${toBase64String('password')}`);
    
            expect(result).toBe(null);
        });

        it('should return null if given a string with an unknown policy', () => {
            const result = parseRecordKey(`vRK2.${toBase64String('name')}.${toBase64String('password')}.wrong`);
    
            expect(result).toBe(null);
        });
    
        it('should return null if given a null key', () => {
            const result = parseRecordKey(null);
    
            expect(result).toBe(null);
        });
    });

    
});

