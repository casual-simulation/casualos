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
import {
    hashHighEntropyPasswordWithSalt,
    hashPassword,
    hashPasswordWithSalt,
} from '@casual-simulation/crypto';
import { MemoryAuthStore } from './MemoryAuthStore';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { v4 as uuid } from 'uuid';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.error = jest.fn();
console.log = jest.fn();

describe('RecordsController', () => {
    let manager: RecordsController;
    let store: MemoryRecordsStore;
    let auth: MemoryAuthStore;

    beforeEach(() => {
        auth = new MemoryAuthStore();
        store = new MemoryRecordsStore(auth);
        manager = new RecordsController(store, auth);
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
                studioId: null,
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectfull',
                    creatorId: 'userId',
                },
            ]);

            // Should use v2 hashes for record key secrets
            const key = store.recordKeys[0];
            expect(key.secretHash.startsWith('vH2.')).toBe(true);
        });

        it('should be able to add a key to an existing record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
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
                studioId: null,
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectless',
                    creatorId: 'userId',
                },
            ]);

            // Should use v2 hashes for record key secrets
            const key = store.recordKeys[0];
            expect(key.secretHash.startsWith('vH2.')).toBe(true);
        });

        it('not issue a key if the record name matches a different user ID', async () => {
            await auth.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            const result = (await manager.createPublicRecordKey(
                'userId',
                'subjectfull',
                'otherUserId'
            )) as CreatePublicRecordKeyFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'unauthorized_to_create_record_key',
                errorMessage: 'Another user has already created this record.',
                errorReason: 'record_owned_by_different_user',
            });
        });

        it('should be able to issue a key if the record name matches the user ID but the record was created by a different user', async () => {
            await store.addRecord({
                name: 'otherUserId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: ['test'],
                secretSalt: 'salt',
            });

            const result = (await manager.createPublicRecordKey(
                'otherUserId',
                'subjectless',
                'otherUserId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            const record = await store.getRecordByName('otherUserId');
            expect(record).toEqual({
                name: 'otherUserId',
                ownerId: 'otherUserId',
                studioId: null,
                // It should erase existing secret hashes and issue a new salt
                // so that previous record keys are now invalid.
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(record.secretSalt).not.toBe('salt');
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'otherUserId',
                    secretHash: expect.any(String),
                    policy: 'subjectless',
                    creatorId: 'otherUserId',
                },
            ]);

            // Should use v2 hashes for record key secrets
            const key = store.recordKeys[0];
            expect(key.secretHash.startsWith('vH2.')).toBe(true);

            expect(
                await manager.validatePublicRecordKey(result.recordKey)
            ).toEqual({
                success: true,
                recordName: 'otherUserId',
                ownerId: 'otherUserId',
                keyCreatorId: 'otherUserId',
                policy: 'subjectless',
            });
        });

        it('should default to subjectfull records if a null policy is given', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
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
                studioId: null,
                secretHashes: ['test'],
                secretSalt: 'salt',
            });
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'name',
                    secretHash: expect.any(String),
                    policy: 'subjectfull',
                    creatorId: 'userId',
                },
            ]);
        });

        it('should return an error if the user id is different from the creator of the record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
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
            expect(result.errorMessage).toEqual('A server error occurred.');
        });

        it('should return an invalid_policy error if the given policy is not supported', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
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
            expect(result.errorMessage).toBe(
                'The record key policy must be either "subjectfull" or "subjectless".'
            );
            expect(await store.getRecordByName('name')).toEqual({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
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
            describe('v1 hashes', () => {
                it('should return true if the given key is valid and is contained in the secret hashes of the record', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashPasswordWithSalt('password1', salt);
                    const hash2 = hashPasswordWithSalt('password2', salt);
                    const hash3 = hashPasswordWithSalt('password3', salt);
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
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
                        studioId: null,
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
                        keyCreatorId: 'userId',
                        policy: 'subjectfull',
                    });
                });

                it('should return the ID of the user who created the key', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashPasswordWithSalt('password1', salt);
                    const hash2 = hashPasswordWithSalt('password2', salt);
                    const hash3 = hashPasswordWithSalt('password3', salt);
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'name',
                        secretHash: hash1,
                        policy: 'subjectfull',
                        creatorId: 'creatorId',
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
                        keyCreatorId: 'creatorId',
                        policy: 'subjectfull',
                    });
                });

                it('should return false if the given key has a different creator than the record owner and the record has the same name as the owner ID', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashPasswordWithSalt('password1', salt);
                    const hash2 = hashPasswordWithSalt('password2', salt);
                    const hash3 = hashPasswordWithSalt('password3', salt);
                    store.addRecord({
                        name: 'otherUserId',
                        ownerId: 'otherUserId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash1,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash2,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash3,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });

                    const result = (await manager.validatePublicRecordKey(
                        formatV1RecordKey('otherUserId', 'password1')
                    )) as ValidatePublicRecordKeyFailure;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage: 'Invalid record key.',
                    });
                });
            });

            describe('v2 hashes', () => {
                it('should return true if the given key is valid and is contained in the secret hashes of the record', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
                        policy: 'subjectfull',
                    });
                });

                it('should return true if the given key is valid and is contained in the key store', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
                        policy: 'subjectfull',
                    });
                });

                it('should return the ID of the user who created the key', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'name',
                        secretHash: hash1,
                        policy: 'subjectfull',
                        creatorId: 'creatorId',
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
                        keyCreatorId: 'creatorId',
                        policy: 'subjectfull',
                    });
                });

                it('should return false if the given key has a different creator than the record owner and the record has the same name as the owner ID', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'otherUserId',
                        ownerId: 'otherUserId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash1,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash2,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash3,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });

                    const result = (await manager.validatePublicRecordKey(
                        formatV1RecordKey('otherUserId', 'password1')
                    )) as ValidatePublicRecordKeyFailure;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage: 'Invalid record key.',
                    });
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
                expect(result.errorMessage).toEqual('A server error occurred.');
            });
        });

        describe('v2 keys', () => {
            describe('v1 hashes', () => {
                it('should return true if the given key is valid and is contained in the secret hashes of the record', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashPasswordWithSalt('password1', salt);
                    const hash2 = hashPasswordWithSalt('password2', salt);
                    const hash3 = hashPasswordWithSalt('password3', salt);
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
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
                        studioId: null,
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
                        studioId: null,
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
                        keyCreatorId: 'userId',
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
                        studioId: null,
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

                it('should return false if the given key has a different creator than the record owner and the record has the same name as the owner ID', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashPasswordWithSalt('password1', salt);
                    const hash2 = hashPasswordWithSalt('password2', salt);
                    const hash3 = hashPasswordWithSalt('password3', salt);
                    store.addRecord({
                        name: 'otherUserId',
                        ownerId: 'otherUserId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash1,
                        policy: 'subjectless',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash2,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash3,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });

                    const result = (await manager.validatePublicRecordKey(
                        formatV2RecordKey(
                            'otherUserId',
                            'password1',
                            'subjectless'
                        )
                    )) as ValidatePublicRecordKeyFailure;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage: 'Invalid record key.',
                    });
                });
            });

            describe('v2 hashes', () => {
                it('should return true if the given key is valid and is contained in the secret hashes of the record', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
                        policy: 'subjectfull',
                    });
                });

                it('should return false if the given key is valid but has a non-default policy when it is contained in the secret hashes of the record', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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
                        keyCreatorId: 'userId',
                        policy: 'subjectless',
                    });
                });

                it('should return false if the given key is valid but does not have the correct policy', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'name',
                        ownerId: 'userId',
                        studioId: null,
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

                it('should return false if the given key has a different creator than the record owner and the record has the same name as the owner ID', async () => {
                    const salt = fromByteArray(randomBytes(16));
                    const hash1 = hashHighEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashHighEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashHighEntropyPasswordWithSalt(
                        'password3',
                        salt
                    );
                    store.addRecord({
                        name: 'otherUserId',
                        ownerId: 'otherUserId',
                        studioId: null,
                        secretHashes: [],
                        secretSalt: salt,
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash1,
                        policy: 'subjectless',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash2,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });
                    store.addRecordKey({
                        recordName: 'otherUserId',
                        secretHash: hash3,
                        policy: 'subjectfull',
                        creatorId: 'userId',
                    });

                    const result = (await manager.validatePublicRecordKey(
                        formatV2RecordKey(
                            'otherUserId',
                            'password1',
                            'subjectless'
                        )
                    )) as ValidatePublicRecordKeyFailure;

                    expect(result).toEqual({
                        success: false,
                        errorCode: 'invalid_record_key',
                        errorMessage: 'Invalid record key.',
                    });
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
                expect(result.errorMessage).toEqual('A server error occurred.');
            });
        });
    });

    describe('validateRecordName()', () => {
        it('should return info about the given record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            const result = await manager.validateRecordName('name', 'userId');

            expect(result).toEqual({
                success: true,
                recordName: 'name',
                ownerId: 'userId',
            });
        });

        it('should return info about the given record even when given a null user ID', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
            const result = await manager.validateRecordName('name', null);

            expect(result).toEqual({
                success: true,
                recordName: 'name',
                ownerId: 'userId',
            });
        });

        it('should create the record if it doesnt exist and the name matches the given user ID', async () => {
            const result = await manager.validateRecordName('userId', 'userId');

            expect(result).toEqual({
                success: true,
                recordName: 'userId',
                ownerId: 'userId',
            });

            expect(await store.getRecordByName('userId')).toEqual({
                name: 'userId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: expect.any(String),
            });
        });

        it('should update the record if the name matches the given user ID but the owner is different', async () => {
            await store.addRecord({
                name: 'userId',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: 'salt',
            });
            const result = await manager.validateRecordName('userId', 'userId');

            expect(result).toEqual({
                success: true,
                recordName: 'userId',
                ownerId: 'userId',
            });

            const record = await store.getRecordByName('userId');
            expect(record).toEqual({
                name: 'userId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(record.secretSalt).not.toBe('salt');
        });

        it('should handle the case where the record does not exist', async () => {
            const result = await manager.validateRecordName('name', 'userId');

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
            });
        });
    });

    describe('listRecords()', () => {
        beforeEach(async () => {
            await store.addRecord({
                name: 'record1',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record2',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record3',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record4',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: '',
            });
        });

        it('should return all records owned by the given user', async () => {
            const result = await manager.listRecords('userId');

            expect(result).toEqual({
                success: true,
                records: [
                    {
                        name: 'record1',
                        ownerId: 'userId',
                        studioId: null,
                    },
                    {
                        name: 'record2',
                        ownerId: 'userId',
                        studioId: null,
                    },
                    {
                        name: 'record3',
                        ownerId: 'userId',
                        studioId: null,
                    },
                ],
            });
        });

        it('should return a not_supported error if the store does not support listing records', async () => {
            (store as any).listRecordsByOwnerId = null;

            const result = await manager.listRecords('userId');

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });
    });

    describe('listStudioRecords()', () => {
        beforeEach(async () => {
            await auth.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                name: 'test user',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: 'studioId',
                displayName: 'studio',
            });

            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                role: 'admin',
                isPrimaryContact: true,
            });

            await store.addRecord({
                name: 'record1',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record2',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record3',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: '',
            });

            await store.addRecord({
                name: 'record4',
                ownerId: null,
                studioId: 'otherStudioId',
                secretHashes: [],
                secretSalt: '',
            });
        });

        it('should return all records owned by the given studio', async () => {
            const result = await manager.listStudioRecords(
                'studioId',
                'userId'
            );

            expect(result).toEqual({
                success: true,
                records: [
                    {
                        name: 'record1',
                        ownerId: null,
                        studioId: 'studioId',
                    },
                    {
                        name: 'record2',
                        ownerId: null,
                        studioId: 'studioId',
                    },
                    {
                        name: 'record3',
                        ownerId: null,
                        studioId: 'studioId',
                    },
                ],
            });
        });
    });

    describe('createStudio()', () => {
        it('should create a new studio with a random UUID', async () => {
            uuidMock.mockReturnValueOnce('studioId1');
            const result = await manager.createStudio('my studio', 'userId');

            expect(result).toEqual({
                success: true,
                studioId: 'studioId1',
            });
        });

        it('should assign the given user as an owner', async () => {
            await auth.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                name: 'test user',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            uuidMock.mockReturnValueOnce('studioId1');
            await manager.createStudio('my studio', 'userId');

            const assignments = await store.listStudioAssignments('studioId1');

            expect(assignments).toEqual([
                {
                    studioId: 'studioId1',
                    userId: 'userId',
                    role: 'admin',
                    isPrimaryContact: true,
                    user: {
                        id: 'userId',
                        name: 'test user',
                        email: 'test@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });
    });

    describe('listStudios()', () => {
        beforeEach(async () => {
            await auth.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: 'studioId1',
                displayName: 'studio 1',
            });

            await store.addStudio({
                id: 'studioId2',
                displayName: 'studio 2',
            });

            await store.addStudio({
                id: 'studioId3',
                displayName: 'studio 3',
            });

            await store.addStudioAssignment({
                studioId: 'studioId2',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: 'studioId3',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'member',
            });
        });

        it('should list the studios that the user has access to', async () => {
            const result = await manager.listStudios('userId');

            expect(result).toEqual({
                success: true,
                studios: [
                    {
                        studioId: 'studioId2',
                        displayName: 'studio 2',
                        isPrimaryContact: true,
                        role: 'admin',
                    },
                    {
                        studioId: 'studioId3',
                        displayName: 'studio 3',
                        isPrimaryContact: true,
                        role: 'member',
                    },
                ],
            });
        });
    });

    describe('listStudioMembers()', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId';

            await auth.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId3',
                name: 'test user 3',
                email: null,
                phoneNumber: '555',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId2',
                isPrimaryContact: true,
                role: 'member',
            });
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId3',
                isPrimaryContact: false,
                role: 'member',
            });
        });

        it('should list the users in the studio that the user has access to', async () => {
            const result = await manager.listStudioMembers(studioId, 'userId');

            expect(result).toEqual({
                success: true,
                members: [
                    {
                        studioId,
                        userId: 'userId',
                        isPrimaryContact: true,
                        role: 'admin',
                        user: {
                            id: 'userId',
                            name: 'test user',
                            email: 'test@example.com',
                            phoneNumber: null,
                        },
                    },
                    {
                        studioId,
                        userId: 'userId2',
                        isPrimaryContact: true,
                        role: 'member',
                        user: {
                            id: 'userId2',
                            name: 'test user 2',
                            email: 'test2@example.com',
                            phoneNumber: null,
                        },
                    },
                    {
                        studioId,
                        userId: 'userId3',
                        isPrimaryContact: false,
                        role: 'member',
                        user: {
                            id: 'userId3',
                            name: 'test user 3',
                            email: null,
                            phoneNumber: '555',
                        },
                    },
                ],
            });
        });

        it('should list the users in the studio that the user has access to', async () => {
            const result = await manager.listStudioMembers(studioId, 'userId3');

            expect(result).toEqual({
                success: true,
                members: [
                    {
                        studioId,
                        userId: 'userId',
                        isPrimaryContact: true,
                        role: 'admin',
                        user: {
                            id: 'userId',
                            name: 'test user',
                        },
                    },
                    {
                        studioId,
                        userId: 'userId2',
                        isPrimaryContact: true,
                        role: 'member',
                        user: {
                            id: 'userId2',
                            name: 'test user 2',
                        },
                    },
                    {
                        studioId,
                        userId: 'userId3',
                        isPrimaryContact: false,
                        role: 'member',
                        user: {
                            id: 'userId3',
                            name: 'test user 3',
                        },
                    },
                ],
            });
        });

        it('should return a not_authorized error if the user is not authorized', async () => {
            const result = await manager.listStudioMembers(
                studioId,
                'wrong_user'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to access this studio.',
            });
        });
    });

    describe('addStudioMember()', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId';

            await auth.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId3',
                name: 'test user 3',
                email: null,
                phoneNumber: '555',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });
        });

        it('should add the user to the studio', async () => {
            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedUserId: 'userId2',
                role: 'member',
            });

            expect(result).toEqual({
                success: true,
            });

            const assignments = await store.listStudioAssignments(studioId);
            expect(assignments).toEqual([
                {
                    studioId: studioId,
                    userId: 'userId',
                    isPrimaryContact: true,
                    role: 'admin',
                    user: {
                        id: 'userId',
                        name: 'test user',
                        email: 'test@example.com',
                        phoneNumber: null,
                    },
                },
                {
                    studioId: studioId,
                    userId: 'userId2',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId2',
                        name: 'test user 2',
                        email: 'test2@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should be able to add a user by their email address', async () => {
            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedEmail: 'test2@example.com',
                role: 'member',
            });

            expect(result).toEqual({
                success: true,
            });

            const assignments = await store.listStudioAssignments(studioId);
            expect(assignments).toEqual([
                {
                    studioId: studioId,
                    userId: 'userId',
                    isPrimaryContact: true,
                    role: 'admin',
                    user: {
                        id: 'userId',
                        name: 'test user',
                        email: 'test@example.com',
                        phoneNumber: null,
                    },
                },
                {
                    studioId: studioId,
                    userId: 'userId2',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId2',
                        name: 'test user 2',
                        email: 'test2@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should be able to add a user by their phone number', async () => {
            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedPhoneNumber: '555',
                role: 'member',
            });

            expect(result).toEqual({
                success: true,
            });

            const assignments = await store.listStudioAssignments(studioId);
            expect(assignments).toEqual([
                {
                    studioId: studioId,
                    userId: 'userId',
                    isPrimaryContact: true,
                    role: 'admin',
                    user: {
                        id: 'userId',
                        name: 'test user',
                        email: 'test@example.com',
                        phoneNumber: null,
                    },
                },
                {
                    studioId: studioId,
                    userId: 'userId3',
                    role: 'member',
                    isPrimaryContact: false,
                    user: {
                        id: 'userId3',
                        name: 'test user 3',
                        email: null,
                        phoneNumber: '555',
                    },
                },
            ]);
        });

        it('should return a not_authorized error if the user is not authorized', async () => {
            await store.removeStudioAssignment(studioId, 'userId');
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId',
                isPrimaryContact: true,
                role: 'member',
            });

            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedUserId: 'userId2',
                role: 'member',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        });

        it('should return a not_authorized error if the studio does not exist', async () => {
            const result = await manager.addStudioMember({
                studioId: 'wrongStudioId',
                userId: 'userId',
                addedUserId: 'userId2',
                role: 'member',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        });

        it('should return a user_not_found error if the user with the given email does not exist', async () => {
            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedEmail: 'wrong email',
                role: 'member',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'user_not_found',
                errorMessage: 'The user was not able to be found.',
            });
        });

        it('should return a user_not_found error if the user with the given phone number does not exist', async () => {
            const result = await manager.addStudioMember({
                studioId: studioId,
                userId: 'userId',
                addedPhoneNumber: 'wrong phone number',
                role: 'member',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'user_not_found',
                errorMessage: 'The user was not able to be found.',
            });
        });
    });

    describe('removeStudioMember()', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId';

            await auth.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await auth.saveNewUser({
                id: 'userId3',
                name: 'test user 3',
                email: null,
                phoneNumber: '555',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: studioId,
                displayName: 'studio 1',
            });

            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId2',
                isPrimaryContact: true,
                role: 'member',
            });
        });

        it('should remove the user from the studio', async () => {
            const result = await manager.removeStudioMember({
                studioId: studioId,
                userId: 'userId',
                removedUserId: 'userId2',
            });

            expect(result).toEqual({
                success: true,
            });

            const assignments = await store.listStudioAssignments(studioId);
            expect(assignments).toEqual([
                {
                    studioId: studioId,
                    userId: 'userId',
                    isPrimaryContact: true,
                    role: 'admin',
                    user: {
                        id: 'userId',
                        name: 'test user',
                        email: 'test@example.com',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should return a not_authorized error if the user is not authorized', async () => {
            await store.removeStudioAssignment(studioId, 'userId');
            await store.addStudioAssignment({
                studioId: studioId,
                userId: 'userId',
                isPrimaryContact: true,
                role: 'member',
            });

            const result = await manager.removeStudioMember({
                studioId: studioId,
                userId: 'userId',
                removedUserId: 'userId2',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        });

        it('should return a not_authorized error if the user tries to remove themselves', async () => {
            const result = await manager.removeStudioMember({
                studioId: studioId,
                userId: 'userId',
                removedUserId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        });

        it('should return a not_authorized error if the studio does not exist', async () => {
            const result = await manager.removeStudioMember({
                studioId: 'wrongStudioId',
                userId: 'userId',
                removedUserId: 'userId2',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
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

        expect(split).toEqual([
            'vRK2',
            toBase64String('name'),
            toBase64String('password'),
            'subjectless',
        ]);
    });

    it('should default to subjectfull policies', () => {
        const result = formatV2RecordKey('name', 'password', null);

        const split = result.split('.');

        expect(split).toEqual([
            'vRK2',
            toBase64String('name'),
            toBase64String('password'),
            'subjectfull',
        ]);
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
            const result = parseRecordKey(
                `vRK2.${toBase64String('name')}.${toBase64String('password')}`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a string with an unknown policy', () => {
            const result = parseRecordKey(
                `vRK2.${toBase64String('name')}.${toBase64String(
                    'password'
                )}.wrong`
            );

            expect(result).toBe(null);
        });

        it('should return null if given a null key', () => {
            const result = parseRecordKey(null);

            expect(result).toBe(null);
        });
    });
});
