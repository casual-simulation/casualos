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

console.error = jest.fn();
console.log = jest.fn();

describe('RecordsController', () => {
    let manager: RecordsController;
    let store: MemoryRecordsStore;
    let auth: MemoryAuthStore;

    beforeEach(() => {
        auth = new MemoryAuthStore();
        store = new MemoryRecordsStore();
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
                    creatorId: 'userId',
                },
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
            expect(result.errorMessage).toBe(
                'The record key policy must be either "subjectfull" or "subjectless".'
            );
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
            describe('v1 hashes', () => {
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
                expect(result.errorMessage).toEqual(
                    expect.stringContaining('Test Error')
                );
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
                expect(result.errorMessage).toEqual(
                    expect.stringContaining('Test Error')
                );
            });
        });
    });

    describe('validateRecordName()', () => {
        it('should return info about the given record', async () => {
            await store.addRecord({
                name: 'name',
                ownerId: 'userId',
                secretHashes: [],
                secretSalt: '',
            });
            const result = await manager.validateRecordName('name');

            expect(result).toEqual({
                success: true,
                recordName: 'name',
                ownerId: 'userId',
            });
        });

        it('should handle the case where the record does not exist', async () => {
            const result = await manager.validateRecordName('name');

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
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
