/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    CreatePublicRecordKeyFailure,
    CreatePublicRecordKeySuccess,
    ValidatePublicRecordKeyFailure,
    ValidatePublicRecordKeySuccess,
} from './RecordsController';
import { RecordsController } from './RecordsController';
import {
    hashHighEntropyPasswordWithSalt,
    hashLowEntropyPasswordWithSalt,
} from '@casual-simulation/crypto';
import { randomBytes } from 'tweetnacl';
import { fromByteArray } from 'base64-js';
import { v4 as uuid } from 'uuid';
import {
    createTestSubConfiguration,
    createTestPrivoConfiguration,
} from './TestUtils';
import { MemoryStore } from './MemoryStore';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import type { PrivoClientInterface } from './PrivoClient';
import {
    formatV1RecordKey,
    formatV2RecordKey,
    isRecordKey,
} from '@casual-simulation/aux-common/records/RecordKeys';
import { success } from '@casual-simulation/aux-common';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.error = jest.fn();
console.log = jest.fn();

describe('RecordsController', () => {
    let manager: RecordsController;
    let store: MemoryStore;

    beforeEach(() => {
        store = new MemoryStore({
            subscriptions: createTestSubConfiguration(),
        });

        manager = new RecordsController({
            store,
            auth: store,
            metrics: store,
            config: store,
            messenger: store,
            privo: null,
        });
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

        it('should be able to add a key to an existing record if the user is an admin in the studio', async () => {
            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'Studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                role: 'admin',
                isPrimaryContact: true,
            });

            await store.addRecord({
                name: 'name',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
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
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
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

        it('should not be able to add a key to an existing record if the user is not an admin in the studio', async () => {
            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'Studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                role: 'member',
                isPrimaryContact: true,
            });

            await store.addRecord({
                name: 'name',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: 'salt',
            });
            const result = (await manager.createPublicRecordKey(
                'name',
                'subjectless',
                'userId'
            )) as CreatePublicRecordKeyFailure;

            expect(result.success).toBe(false);

            expect(store.recordKeys).toEqual([]);
        });

        it('not issue a key if the record name matches a different user ID', async () => {
            await store.saveUser({
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

        it('should be able to issue a key if the record name matches a studio ID but the record was created by a different user', async () => {
            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'my studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'admin',
            });

            await store.addRecord({
                name: 'studioId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: ['test'],
                secretSalt: 'salt',
            });

            const result = (await manager.createPublicRecordKey(
                'studioId',
                'subjectless',
                'userId'
            )) as CreatePublicRecordKeySuccess;

            expect(result.success).toBe(true);
            expect(isRecordKey(result.recordKey)).toBe(true);
            const record = await store.getRecordByName('studioId');
            expect(record).toEqual({
                name: 'studioId',
                ownerId: null,
                studioId: 'studioId',
                // It should erase existing secret hashes and issue a new salt
                // so that previous record keys are now invalid.
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(record.secretSalt).not.toBe('salt');
            expect(store.recordKeys).toEqual([
                {
                    recordName: 'studioId',
                    secretHash: expect.any(String),
                    policy: 'subjectless',
                    creatorId: 'userId',
                },
            ]);

            // Should use v2 hashes for record key secrets
            const key = store.recordKeys[0];
            expect(key.secretHash.startsWith('vH2.')).toBe(true);

            expect(
                await manager.validatePublicRecordKey(result.recordKey)
            ).toEqual({
                success: true,
                recordName: 'studioId',
                ownerId: null,
                keyCreatorId: 'userId',
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                    const hash1 = hashLowEntropyPasswordWithSalt(
                        'password1',
                        salt
                    );
                    const hash2 = hashLowEntropyPasswordWithSalt(
                        'password2',
                        salt
                    );
                    const hash3 = hashLowEntropyPasswordWithSalt(
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
                studioId: null,
            });
        });

        it('should include info about the record studio', async () => {
            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.saveUser({
                id: 'otherUserId',
                email: 'other@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'admin',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'otherUserId',
                isPrimaryContact: false,
                role: 'member',
            });
            await store.addRecord({
                name: 'name',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: '',
            });
            const result = await manager.validateRecordName('name', 'userId');

            expect(result).toEqual({
                success: true,
                recordName: 'name',
                ownerId: null,
                studioId: 'studioId',
                studioMembers: [
                    {
                        userId: 'userId',
                        studioId: 'studioId',
                        isPrimaryContact: false,
                        role: 'admin',
                        user: {
                            id: 'userId',
                            email: 'test@example.com',
                            phoneNumber: null,
                        },
                    },
                    {
                        userId: 'otherUserId',
                        studioId: 'studioId',
                        isPrimaryContact: false,
                        role: 'member',
                        user: {
                            id: 'otherUserId',
                            email: 'other@example.com',
                            phoneNumber: null,
                        },
                    },
                ],
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
                studioId: null,
            });
        });

        it('should create the record if it doesnt exist and the name matches the given user ID', async () => {
            const result = await manager.validateRecordName('userId', 'userId');

            expect(result).toEqual({
                success: true,
                recordName: 'userId',
                ownerId: 'userId',
                studioId: null,
            });

            expect(await store.getRecordByName('userId')).toEqual({
                name: 'userId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: expect.any(String),
            });
        });

        it('should create the record if it doesnt exist and the name matches a studio that the user is a member of', async () => {
            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'member',
            });

            const result = await manager.validateRecordName(
                'studioId',
                'userId'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'studioId',
                ownerId: null,
                studioId: 'studioId',
                studioMembers: [
                    {
                        userId: 'userId',
                        studioId: 'studioId',
                        isPrimaryContact: false,
                        role: 'member',
                        user: {
                            id: 'userId',
                            email: 'test@example.com',
                            phoneNumber: null,
                        },
                    },
                ],
            });

            expect(await store.getRecordByName('studioId')).toEqual({
                name: 'studioId',
                ownerId: null,
                studioId: 'studioId',
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
                studioId: null,
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

        it('should update the record if the name matches a studio ID but the owner is different', async () => {
            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'member',
            });

            await store.addRecord({
                name: 'studioId',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: 'salt',
            });
            const result = await manager.validateRecordName(
                'studioId',
                'userId'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'studioId',
                ownerId: null,
                studioId: 'studioId',
                studioMembers: [
                    {
                        userId: 'userId',
                        studioId: 'studioId',
                        isPrimaryContact: false,
                        role: 'member',
                        user: {
                            id: 'userId',
                            email: 'test@example.com',
                            phoneNumber: null,
                        },
                    },
                ],
            });

            const record = await store.getRecordByName('studioId');
            expect(record).toEqual({
                name: 'studioId',
                ownerId: null,
                studioId: 'studioId',
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

        it('should return an error if the record needs to be created and records are not allowed for the user', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.validateRecordName('userId', 'userId');

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const records = await store.listRecordsByOwnerId('userId');

            expect(records).toEqual([]);
        });

        it('should return an error if the record needs to be updated and records are not allowed for the user', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.addRecord({
                name: 'userId',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: 'salt',
            });

            const result = await manager.validateRecordName('userId', 'userId');

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const userRecords = await store.listRecordsByOwnerId('userId');
            expect(userRecords).toEqual([]);

            const otherUserRecords = await store.listRecordsByOwnerId(
                'otherUserId'
            );
            expect(otherUserRecords).toEqual([
                {
                    name: 'userId',
                    ownerId: 'otherUserId',
                    studioId: null,
                },
            ]);
        });

        it('should return an error if the record needs to be created and records are not allowed for the studio', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'member',
            });

            const result = await manager.validateRecordName(
                'studioId',
                'userId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const studioRecords = await store.listRecordsByStudioId('studioId');
            expect(studioRecords).toEqual([]);
        });

        it('should return an error if the record needs to be updated and records are not allowed for the studio', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'myStudio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'member',
            });

            await store.addRecord({
                name: 'studioId',
                ownerId: 'otherUserId',
                studioId: null,
                secretHashes: [],
                secretSalt: 'salt',
            });

            const result = await manager.validateRecordName(
                'studioId',
                'userId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const studioRecords = await store.listRecordsByStudioId('studioId');
            expect(studioRecords).toEqual([]);

            const userRecords = await store.listRecordsByOwnerId('otherUserId');
            expect(userRecords).toEqual([
                {
                    name: 'studioId',
                    ownerId: 'otherUserId',
                    studioId: null,
                },
            ]);
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
            await store.saveNewUser({
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

        it('should return all records owned by the studio if the user is a super user', async () => {
            await store.removeStudioAssignment('studioId', 'userId');

            const user = await store.findUser('userId');
            await store.saveUser({
                ...user,
                role: 'superUser',
            });

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
            await store.saveNewUser({
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

    describe('createStudioInComId()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withComId({
                                allowed: true,
                                maxStudios: 1,
                            })
                    )
            );

            await store.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                name: 'test user',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.createStudioForUser(
                {
                    id: 'studioId1',
                    displayName: 'studio 1',
                    comId: 'comId1',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                'userId'
            );
        });

        it('should be able to create a studio in a comId', async () => {
            uuidMock.mockReturnValueOnce('studioId2');
            const result = await manager.createStudioInComId(
                'my studio',
                'userId',
                'comId1'
            );

            expect(result).toEqual({
                success: true,
                studioId: 'studioId2',
            });

            const studio = await store.getStudioById('studioId2');

            expect(studio).toEqual({
                id: 'studioId2',
                displayName: 'my studio',
                ownerStudioComId: 'comId1',
            });
        });

        it('should return comId_not_found if the a studio does not exist for the given comId', async () => {
            uuidMock.mockReturnValueOnce('studioId2');
            const result = await manager.createStudioInComId(
                'my studio',
                'userId',
                'missingComId'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'comId_not_found',
                errorMessage: 'The given comId was not found.',
            });

            const studio = await store.getStudioById('studioId2');
            expect(studio).toBeFalsy();
        });

        it('should return not_authorized if the user is not a member of the comId studio', async () => {
            uuidMock.mockReturnValueOnce('studioId2');
            const result = await manager.createStudioInComId(
                'my studio',
                'otherUserId',
                'comId1'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to create a studio in this comId.',
            });

            const studio = await store.getStudioById('studioId2');
            expect(studio).toBeFalsy();
        });

        it('should allow non-members to create studios in a comId if configured to allow anyone', async () => {
            uuidMock.mockReturnValueOnce('studioId2');
            await store.saveNewUser({
                id: 'otherUser',
                email: 'test2@example.com',
                name: 'other user',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.updateStudio({
                id: 'studioId1',
                displayName: 'studio 1',
                comId: 'comId1',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                comIdConfig: {
                    allowedStudioCreators: 'anyone',
                },
            });

            const result = await manager.createStudioInComId(
                'my studio',
                'otherUser',
                'comId1'
            );

            expect(result).toEqual({
                success: true,
                studioId: 'studioId2',
            });

            const studio = await store.getStudioById('studioId2');
            expect(studio).toEqual({
                id: 'studioId2',
                displayName: 'my studio',
                ownerStudioComId: 'comId1',
            });

            const members = await store.listStudioAssignments('studioId2');
            expect(members).toEqual([
                {
                    studioId: 'studioId2',
                    userId: 'otherUser',
                    role: 'admin',
                    isPrimaryContact: true,
                    user: {
                        id: 'otherUser',
                        email: 'test2@example.com',
                        name: 'other user',
                        phoneNumber: null,
                    },
                },
            ]);
        });

        it('should return not_authorized if the subscription does not allow comId', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withComId({
                                allowed: false,
                            })
                    )
            );

            uuidMock.mockReturnValueOnce('studioId3');
            const result = await manager.createStudioInComId(
                'my studio',
                'userId',
                'comId1'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'comId features are not allowed for this comId. Make sure you have an active subscription that provides comId features.',
            });

            const studio = await store.getStudioById('studioId3');
            expect(studio).toBeFalsy();
        });

        it('should return subscription_limit_reached if creating the studio would exceed the maximum number of allowed studios', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withComId({
                                allowed: true,
                                maxStudios: 1,
                            })
                    )
            );

            await store.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                name: 'test user',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.createStudioForUser(
                {
                    id: 'studioId1',
                    displayName: 'studio 1',
                    comId: 'comId1',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                'userId'
            );

            await store.addStudio({
                id: 'studioId2',
                displayName: 'studio 2',
                ownerStudioComId: 'comId1',
            });

            uuidMock.mockReturnValueOnce('studioId3');
            const result = await manager.createStudioInComId(
                'my studio',
                'userId',
                'comId1'
            );

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of studios allowed for your comId subscription has been reached.',
            });

            const studio = await store.getStudioById('studioId3');
            expect(studio).toBeFalsy();
        });
    });

    describe('updateStudio()', () => {
        beforeEach(async () => {
            await store.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'studio',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                'userId'
            );
        });

        it('should be able to update the display name', async () => {
            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    displayName: 'new name',
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'new name',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
        });

        it('should be able to update the logo URL', async () => {
            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    logoUrl: 'https://example.com/logo.png',
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
        });

        it('should be able to update the player config', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
            });

            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    playerConfig: {
                        automaticBiosOption: 'free',
                    },
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                playerConfig: {
                    automaticBiosOption: 'free',
                },
            });
        });

        it('should be able to update the comId config', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                comIdConfig: {
                    allowedStudioCreators: 'anyone',
                },
            });

            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    comIdConfig: {
                        allowedStudioCreators: 'only-members',
                    },
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                comIdConfig: {
                    allowedStudioCreators: 'only-members',
                },
            });
        });

        it('should be able to update the loom config', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    loomConfig: {
                        appId: 'appId',
                        privateKey: 'privateKey',
                    },
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const loomConfig = await store.getStudioLoomConfig('studioId');
            expect(loomConfig).toEqual({
                appId: 'appId',
                privateKey: 'privateKey',
            });
        });

        it('should be able to update the hume config', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                    humeConfig: {
                        apiKey: 'apiKey',
                        secretKey: 'secretKey',
                    },
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const humeConfig = await store.getStudioHumeConfig('studioId');
            expect(humeConfig).toEqual({
                apiKey: 'apiKey',
                secretKey: 'secretKey',
            });
        });

        it('should do nothing if no updates are provided', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                comIdConfig: {
                    allowedStudioCreators: 'anyone',
                },
            });

            const result = await manager.updateStudio({
                userId: 'userId',
                studio: {
                    id: 'studioId',
                },
            });

            expect(result).toEqual({
                success: true,
            });

            const studio = await store.getStudioById('studioId');
            expect(studio).toEqual({
                id: 'studioId',
                displayName: 'studio',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                comIdConfig: {
                    allowedStudioCreators: 'anyone',
                },
            });
        });

        it('should return not_authorized if the user is not an admin of the studio', async () => {
            await store.addStudioAssignment({
                studioId: 'studioId',
                role: 'member',
                userId: 'otherUserId',
                isPrimaryContact: false,
            });

            const result = await manager.updateStudio({
                userId: 'otherUserId',
                studio: {
                    id: 'studioId',
                    displayName: 'new name',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to update this studio.',
            });
        });

        it('should return studio_not_found if the given studio was not found', async () => {
            const result = await manager.updateStudio({
                userId: 'otherUserId',
                studio: {
                    id: 'missingStudio',
                    displayName: 'new name',
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'studio_not_found',
                errorMessage: 'The given studio was not found.',
            });
        });
    });

    describe('getStudio()', () => {
        beforeEach(async () => {
            await store.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.createStudioForUser(
                {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                },
                'userId'
            );
        });

        it('should return the studio', async () => {
            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the configured comId features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withComId({
                                allowed: true,
                                maxStudios: 100,
                            })
                    )
            );

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: true,
                        maxStudios: 100,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the configured store features', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withStore()
                            .withStoreMaxItems(100)
                            .withStoreCurrencyLimit('usd', {
                                minCost: 10,
                                maxCost: 10000,
                            })
                    )
            );

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: true,
                        maxItems: 100,
                        currencyLimits: {
                            usd: {
                                maxCost: 10000,
                                minCost: 10,
                            },
                        },
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the configured loom features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withLoom({
                                allowed: true,
                            })
                    )
            );

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: true,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the loom config if loom features are allowed', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withLoom()
                    )
            );

            await store.updateStudioLoomConfig('studioId', {
                appId: 'appId',
                privateKey: 'privateKey',
            });
            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: true,
                    },
                    loomConfig: {
                        appId: 'appId',
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the studio stripe account status', async () => {
            await store.updateStudio({
                id: 'studioId',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                comId: 'comId1',
                comIdConfig: {
                    allowedStudioCreators: 'anyone',
                },
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                stripeAccountId: 'acct_123',
                stripeAccountRequirementsStatus: 'incomplete',
                stripeAccountStatus: 'pending',
            });

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: 'pending',
                    stripeRequirementsStatus: 'incomplete',
                },
            });
        });

        it('should include the configured hume features', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withAIHume()
                    )
            );

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should include the hume config if hume features are allowed', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withAIHume()
                    )
            );

            await store.updateStudioHumeConfig('studioId', {
                apiKey: 'apiKey',
                secretKey: 'secretKey',
            });

            const result = await manager.getStudio('studioId', 'userId');

            expect(result).toEqual({
                success: true,
                studio: {
                    id: 'studioId',
                    displayName: 'studio',
                    logoUrl: 'https://example.com/logo.png',
                    comId: 'comId1',
                    comIdConfig: {
                        allowedStudioCreators: 'anyone',
                    },
                    playerConfig: {
                        ab1BootstrapURL: 'https://example.com/ab1',
                    },
                    comIdFeatures: {
                        allowed: false,
                    },
                    loomFeatures: {
                        allowed: false,
                    },
                    humeFeatures: {
                        allowed: true,
                    },
                    humeConfig: {
                        apiKey: 'apiKey',
                    },
                    storeFeatures: {
                        allowed: false,
                    },
                    stripeAccountStatus: null,
                    stripeRequirementsStatus: null,
                },
            });
        });

        it('should return studio_not_found if the studio was not found', async () => {
            const result = await manager.getStudio('missingStudio', 'userId');

            expect(result).toEqual({
                success: false,
                errorCode: 'studio_not_found',
                errorMessage: 'The given studio was not found.',
            });
        });

        it('should return not_authorized if the user is not a member of the studio', async () => {
            const result = await manager.getStudio('studioId', 'otherUserId');

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to access this studio.',
            });
        });
    });

    describe('getPlayerConfig()', () => {
        it('should return the player config for the given comId', async () => {
            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
            });

            const result = await manager.getPlayerConfig('comId1');

            expect(result).toEqual({
                success: true,
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
            });
        });

        it('should comId_not_found if the comId does not exist', async () => {
            const result = await manager.getPlayerConfig('comId1');

            expect(result).toEqual({
                success: false,
                errorCode: 'comId_not_found',
                errorMessage: 'The given comId was not found.',
            });
        });
    });

    describe('requestComId()', () => {
        beforeEach(async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withComId({
                                allowed: true,
                                maxStudios: 100,
                            })
                    )
            );

            await store.saveNewUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.addStudio({
                id: 'studioId',
                comId: 'comId1',
                displayName: 'studio',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });
        });

        it('should send a request_com_id notification for the studio', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            const result = await manager.requestComId({
                studioId: 'studioId',
                userId: 'userId',
                requestedComId: 'myComId',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: true,
            });

            expect(store.recordsNotifications).toEqual([
                {
                    resource: 'studio_com_id_request',
                    action: 'created',
                    resourceId: 'studioId',
                    recordName: null,
                    timeMs: expect.any(Number),
                    request: {
                        id: 'requestId',
                        studioId: 'studioId',
                        userId: 'userId',
                        requestingIpAddress: '127.0.0.1',
                        requestedComId: 'myComId',
                        createdAtMs: expect.any(Number),
                        updatedAtMs: expect.any(Number),
                    },
                },
            ]);
        });

        it('should return not_authorized if the user is not a member of the studio', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            const result = await manager.requestComId({
                studioId: 'studioId',
                userId: 'wrongUser',
                requestedComId: 'myComId',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to perform this operation.',
            });
        });

        it('should return studio_not_found if the studio doesnt exist', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            const result = await manager.requestComId({
                studioId: 'wrongStudio',
                userId: 'userId',
                requestedComId: 'myComId',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'studio_not_found',
                errorMessage: 'The given studio was not found.',
            });
        });

        it('should return comId_already_taken if the comId aready exists in another studio', async () => {
            uuidMock.mockReturnValueOnce('requestId');
            await store.addStudio({
                id: 'studioId2',
                comId: 'comId2',
                displayName: 'studio2',
                logoUrl: 'https://example.com/logo.png',
                playerConfig: {
                    ab1BootstrapURL: 'https://example.com/ab1',
                },
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            const result = await manager.requestComId({
                studioId: 'studioId',
                userId: 'userId',
                requestedComId: 'comId2',
                ipAddress: '127.0.0.1',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'comId_already_taken',
                errorMessage: 'The given comID is already taken.',
            });
        });
    });

    describe('listStudios()', () => {
        beforeEach(async () => {
            await store.saveNewUser({
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
                        subscriptionTier: null,
                    },
                    {
                        studioId: 'studioId3',
                        displayName: 'studio 3',
                        isPrimaryContact: true,
                        role: 'member',
                        subscriptionTier: null,
                    },
                ],
            });
        });

        it('should include the subscription tier', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub.withTier('tier1').withAllDefaultFeatures()
                    )
            );

            await store.updateStudio({
                id: 'studioId3',
                displayName: 'studio 3',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.listStudios('userId');

            expect(result).toEqual({
                success: true,
                studios: [
                    {
                        studioId: 'studioId2',
                        displayName: 'studio 2',
                        isPrimaryContact: true,
                        role: 'admin',
                        subscriptionTier: null,
                    },
                    {
                        studioId: 'studioId3',
                        displayName: 'studio 3',
                        isPrimaryContact: true,
                        role: 'member',
                        subscriptionTier: 'tier1',
                    },
                ],
            });
        });
    });

    describe('listStudiosByComId()', () => {
        beforeEach(async () => {
            await store.saveNewUser({
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
                comId: 'comId1',
            });

            await store.addStudio({
                id: 'studioId2',
                displayName: 'studio 2',
                ownerStudioComId: 'comId1',
            });

            await store.addStudio({
                id: 'studioId3',
                displayName: 'studio 3',
                ownerStudioComId: 'comId1',
            });

            await store.addStudio({
                id: 'studioId4',
                displayName: 'studio 4',
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
            const result = await manager.listStudiosByComId('userId', 'comId1');

            expect(result).toEqual({
                success: true,
                studios: [
                    {
                        studioId: 'studioId2',
                        displayName: 'studio 2',
                        isPrimaryContact: true,
                        role: 'admin',
                        subscriptionTier: null,
                        ownerStudioComId: 'comId1',
                    },
                    {
                        studioId: 'studioId3',
                        displayName: 'studio 3',
                        isPrimaryContact: true,
                        role: 'member',
                        subscriptionTier: null,
                        ownerStudioComId: 'comId1',
                    },
                ],
            });
        });

        it('should include the subscription tier', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub.withTier('tier1').withAllDefaultFeatures()
                    )
            );

            await store.updateStudio({
                id: 'studioId3',
                displayName: 'studio 3',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
                ownerStudioComId: 'comId1',
            });

            const result = await manager.listStudiosByComId('userId', 'comId1');

            expect(result).toEqual({
                success: true,
                studios: [
                    {
                        studioId: 'studioId2',
                        displayName: 'studio 2',
                        isPrimaryContact: true,
                        role: 'admin',
                        subscriptionTier: null,
                        ownerStudioComId: 'comId1',
                    },
                    {
                        studioId: 'studioId3',
                        displayName: 'studio 3',
                        isPrimaryContact: true,
                        role: 'member',
                        subscriptionTier: 'tier1',
                        ownerStudioComId: 'comId1',
                    },
                ],
            });
        });
    });

    describe('listStudioMembers()', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId';

            await store.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
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

            await store.saveNewUser({
                id: 'superUserId',
                name: null,
                email: 'su@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                role: 'superUser',
            });
        });

        it('should list the users in the studio that the admin has access to', async () => {
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

        it('should list the users in the studio that the member has access to', async () => {
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

        it('should list the users in the studio if the user is a super user', async () => {
            const result = await manager.listStudioMembers(
                studioId,
                'superUserId'
            );

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

        describe('privo', () => {
            let studioId: string;
            let privo: PrivoClientInterface;
            let privoMock: jest.MockedObject<PrivoClientInterface>;

            beforeEach(async () => {
                studioId = 'privoStudioId';
                privo = privoMock = {
                    checkEmail: jest.fn(),
                    checkDisplayName: jest.fn(),
                    createAdultAccount: jest.fn(),
                    createChildAccount: jest.fn(),
                    generateAuthorizationUrl: jest.fn(),
                    generateLogoutUrl: jest.fn(),
                    getUserInfo: jest.fn(),
                    processAuthorizationCallback: jest.fn(),
                    resendConsentRequest: jest.fn(),
                    lookupServiceId: jest.fn(),
                };

                manager = new RecordsController({
                    store,
                    auth: store,
                    metrics: store,
                    config: store,
                    messenger: store,
                    privo,
                });

                await store.saveNewUser({
                    id: 'userId5',
                    name: null,
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId',
                });
                await store.saveNewUser({
                    id: 'userId6',
                    name: 'test name 6',
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                    privoServiceId: 'serviceId2',
                });

                await store.addStudio({
                    id: studioId,
                    displayName: 'privo studio',
                });

                await store.addStudioAssignment({
                    studioId: studioId,
                    userId: 'userId',
                    isPrimaryContact: true,
                    role: 'admin',
                });
                await store.addStudioAssignment({
                    studioId: studioId,
                    userId: 'userId5',
                    isPrimaryContact: false,
                    role: 'member',
                });
                await store.addStudioAssignment({
                    studioId: studioId,
                    userId: 'userId6',
                    isPrimaryContact: false,
                    role: 'member',
                });
            });

            it('should fill in privo information if available', async () => {
                privoMock.getUserInfo
                    .mockResolvedValueOnce({
                        email: 'test5@example.com',
                        displayName: 'testUser5',
                        emailVerified: true,
                        givenName: 'test',
                        locale: 'en',
                        serviceId: 'serviceId',
                        permissions: null,
                        roleIdentifier: 'roleIdentifier',
                    })
                    .mockResolvedValueOnce({
                        email: 'test6@example.com',
                        displayName: 'testUser6',
                        emailVerified: true,
                        givenName: 'test 6',
                        locale: 'en',
                        serviceId: 'serviceId',
                        permissions: null,
                        roleIdentifier: 'roleIdentifier',
                    });

                const result = await manager.listStudioMembers(
                    studioId,
                    'userId'
                );

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
                            userId: 'userId5',
                            isPrimaryContact: false,
                            role: 'member',
                            user: {
                                id: 'userId5',
                                name: 'test',
                                displayName: 'testUser5',
                            },
                        },
                        {
                            studioId,
                            userId: 'userId6',
                            isPrimaryContact: false,
                            role: 'member',
                            user: {
                                id: 'userId6',
                                name: 'test 6',
                                displayName: 'testUser6',
                            },
                        },
                    ],
                });

                expect(privoMock.getUserInfo).toHaveBeenCalledWith('serviceId');
                expect(privoMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId2'
                );
                expect(privoMock.getUserInfo).toHaveBeenCalledTimes(2);
            });

            it('should fill in public privo information for other members', async () => {
                privoMock.getUserInfo
                    .mockResolvedValueOnce({
                        email: 'test5@example.com',
                        displayName: 'testUser5',
                        emailVerified: true,
                        givenName: 'test',
                        locale: 'en',
                        serviceId: 'serviceId',
                        permissions: null,
                        roleIdentifier: 'roleIdentifier',
                    })
                    .mockResolvedValueOnce({
                        email: 'test6@example.com',
                        displayName: 'testUser6',
                        emailVerified: true,
                        givenName: 'test 6',
                        locale: 'en',
                        serviceId: 'serviceId',
                        permissions: null,
                        roleIdentifier: 'roleIdentifier',
                    });

                const result = await manager.listStudioMembers(
                    studioId,
                    'userId5'
                );

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
                            userId: 'userId5',
                            isPrimaryContact: false,
                            role: 'member',
                            user: {
                                id: 'userId5',
                                name: 'test',
                                displayName: 'testUser5',
                            },
                        },
                        {
                            studioId,
                            userId: 'userId6',
                            isPrimaryContact: false,
                            role: 'member',
                            user: {
                                id: 'userId6',
                                name: 'test 6',
                                displayName: 'testUser6',
                            },
                        },
                    ],
                });

                expect(privoMock.getUserInfo).toHaveBeenCalledWith('serviceId');
                expect(privoMock.getUserInfo).toHaveBeenCalledWith(
                    'serviceId2'
                );
                expect(privoMock.getUserInfo).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('addStudioMember()', () => {
        let studioId: string;
        beforeEach(async () => {
            studioId = 'studioId';

            await store.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
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

        describe('privo', () => {
            let privo: PrivoClientInterface;
            let privoMock: jest.MockedObject<PrivoClientInterface>;

            beforeEach(async () => {
                privo = privoMock = {
                    checkEmail: jest.fn(),
                    checkDisplayName: jest.fn(),
                    createAdultAccount: jest.fn(),
                    createChildAccount: jest.fn(),
                    generateAuthorizationUrl: jest.fn(),
                    generateLogoutUrl: jest.fn(),
                    getUserInfo: jest.fn(),
                    processAuthorizationCallback: jest.fn(),
                    resendConsentRequest: jest.fn(),
                    lookupServiceId: jest.fn(),
                };

                manager = new RecordsController({
                    store,
                    auth: store,
                    metrics: store,
                    config: store,
                    messenger: store,
                    privo,
                });
            });

            it('should be able to add a user by their display name', async () => {
                await store.saveNewUser({
                    id: 'userId4',
                    name: 'test user 4',
                    privoServiceId: 'serviceId',
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
                privoMock.lookupServiceId.mockResolvedValueOnce('serviceId');

                const result = await manager.addStudioMember({
                    studioId: studioId,
                    userId: 'userId',
                    addedDisplayName: 'testUser',
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
                        userId: 'userId4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'userId4',
                            name: 'test user 4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoMock.lookupServiceId).toHaveBeenCalledWith({
                    displayName: 'testUser',
                });
            });

            it('should be able to add a privo user by their email', async () => {
                await store.saveNewUser({
                    id: 'userId4',
                    name: 'test user 4',
                    privoServiceId: 'serviceId',
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
                privoMock.lookupServiceId.mockResolvedValueOnce('serviceId');

                const result = await manager.addStudioMember({
                    studioId: studioId,
                    userId: 'userId',
                    addedEmail: 'test4@example.com',
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
                        userId: 'userId4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'userId4',
                            name: 'test user 4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoMock.lookupServiceId).toHaveBeenCalledWith({
                    email: 'test4@example.com',
                });
            });

            it('should be able to add a privo user by their phone', async () => {
                await store.saveNewUser({
                    id: 'userId4',
                    name: 'test user 4',
                    privoServiceId: 'serviceId',
                    email: null,
                    phoneNumber: null,
                    allSessionRevokeTimeMs: null,
                    currentLoginRequestId: null,
                });
                privoMock.lookupServiceId.mockResolvedValueOnce('serviceId');

                const result = await manager.addStudioMember({
                    studioId: studioId,
                    userId: 'userId',
                    addedPhoneNumber: '+123456',
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
                        userId: 'userId4',
                        role: 'member',
                        isPrimaryContact: false,
                        user: {
                            id: 'userId4',
                            name: 'test user 4',
                            email: null,
                            phoneNumber: null,
                            privoServiceId: 'serviceId',
                        },
                    },
                ]);
                expect(privoMock.lookupServiceId).toHaveBeenCalledWith({
                    phoneNumber: '+123456',
                });
            });
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

            await store.saveNewUser({
                id: 'userId',
                name: 'test user',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
                id: 'userId2',
                name: 'test user 2',
                email: 'test2@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            await store.saveNewUser({
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

    describe('createRecord()', () => {
        beforeEach(async () => {
            await store.saveUser({
                id: 'userId',
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
        });

        it('should create the given record', async () => {
            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: true,
            });

            const records = await store.listRecordsByOwnerId('userId');

            expect(records).toEqual([
                {
                    name: 'myRecord',
                    ownerId: 'userId',
                    studioId: null,
                },
            ]);
        });

        it('should not create the record if it already exists', async () => {
            await store.addRecord({
                name: 'myRecord',
                ownerId: 'otherUserId',
                secretHashes: [],
                secretSalt: '',
                studioId: null,
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'record_already_exists',
                errorMessage: 'A record with that name already exists.',
            });
        });

        it('should not create the record the name matches another user ID', async () => {
            await store.saveUser({
                id: 'newUserId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'email@example.com',
                phoneNumber: null,
            });

            const result = await manager.createRecord({
                recordName: 'newUserId',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'record_already_exists',
                errorMessage: 'A record with that name already exists.',
            });
        });

        it('should return not_authorized if the ownerId is different from the userId', async () => {
            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                ownerId: 'otherUserId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to create a record for another user.',
            });
        });

        it('should be able to create a record for a studio', async () => {
            await store.addStudio({
                id: 'studioId',
                displayName: 'studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: true,
            });

            const records = await store.listRecordsByStudioId('studioId');

            expect(records).toEqual([
                {
                    name: 'myRecord',
                    ownerId: null,
                    studioId: 'studioId',
                },
            ]);
        });

        it('should return not_authorized if the user is not an admin in the studio', async () => {
            await store.addStudio({
                id: 'studioId',
                displayName: 'studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'member',
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage:
                    'You are not authorized to create a record for this studio.',
            });

            const records = await store.listRecordsByStudioId('studioId');

            expect(records).toEqual([]);
        });

        it('should fix records to be owned by the user if the record name is the same as the user ID', async () => {
            await store.addRecord({
                name: 'userId',
                ownerId: 'otherUserId',
                secretHashes: [],
                secretSalt: 'test',
                studioId: null,
            });

            const result = await manager.createRecord({
                recordName: 'userId',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: true,
            });

            const record = await store.getRecordByName('userId');
            expect(record).toEqual({
                name: 'userId',
                ownerId: 'userId',
                studioId: null,
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(record.secretSalt).not.toBe('test');
        });

        it('should fix records to be owned by the studio if the record name is the same as a studio ID', async () => {
            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });
            await store.addStudio({
                id: 'studioId',
                displayName: 'my studio',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: false,
                role: 'member',
            });
            await store.addRecord({
                name: 'studioId',
                ownerId: 'otherUserId',
                secretHashes: [],
                secretSalt: 'test',
                studioId: null,
            });

            const result = await manager.createRecord({
                recordName: 'studioId',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: true,
            });

            const record = await store.getRecordByName('studioId');
            expect(record).toEqual({
                name: 'studioId',
                ownerId: null,
                studioId: 'studioId',
                secretHashes: [],
                secretSalt: expect.any(String),
            });
            expect(record.secretSalt).not.toBe('test');
        });

        it('should return an error if records are not allowed for users', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const records = await store.listRecordsByOwnerId('userId');

            expect(records).toEqual([]);
        });

        it('should return an error if the user would exceed their record limit', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: true,
                                maxRecords: 1,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.addRecord({
                name: 'record1',
                ownerId: 'userId',
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: 'This subscription has hit its record limit.',
            });

            const records = await store.listRecordsByOwnerId('userId');

            expect(records).toEqual([
                {
                    name: 'record1',
                    ownerId: 'userId',
                    studioId: null,
                },
            ]);
        });

        it('should return an error if the user would exceed their record limit even when creating a record that matches its user ID', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: true,
                                maxRecords: 1,
                            })
                    )
            );

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await store.addRecord({
                name: 'record1',
                secretHashes: [],
                secretSalt: 'salt',
                ownerId: 'userId',
                studioId: null,
            });

            const result = await manager.createRecord({
                recordName: 'userId',
                userId: 'userId',
                ownerId: 'userId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: 'This subscription has hit its record limit.',
            });

            const records = await store.listRecordsByOwnerId('userId');

            expect(records).toEqual([
                {
                    name: 'record1',
                    ownerId: 'userId',
                    studioId: null,
                },
            ]);
        });

        it('should return an error if records are not allowed for studios', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: false,
                            })
                    )
            );

            await store.addStudio({
                id: 'studioId',
                displayName: 'name',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Records are not allowed for this subscription.',
            });

            const records = await store.listRecordsByStudioId('studioId');

            expect(records).toEqual([]);
        });

        it('should return an error if the studio would exceed their record limit', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: true,
                                maxRecords: 1,
                            })
                    )
            );

            await store.addStudio({
                id: 'studioId',
                displayName: 'name',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });

            await store.addRecord({
                name: 'record1',
                secretHashes: [],
                secretSalt: 'salt',
                ownerId: null,
                studioId: 'studioId',
            });

            const result = await manager.createRecord({
                recordName: 'myRecord',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: 'This subscription has hit its record limit.',
            });

            const records = await store.listRecordsByStudioId('studioId');

            expect(records).toEqual([
                {
                    name: 'record1',
                    ownerId: null,
                    studioId: 'studioId',
                },
            ]);
        });

        it('should return an error if the studio would exceed their record limit even when creating a record that matches its studioId', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withRecords({
                                allowed: true,
                                maxRecords: 1,
                            })
                    )
            );

            await store.addStudio({
                id: 'studioId',
                displayName: 'name',
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });
            await store.addStudioAssignment({
                studioId: 'studioId',
                userId: 'userId',
                isPrimaryContact: true,
                role: 'admin',
            });

            await store.saveUser({
                id: 'userId',
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
                email: 'test@example.com',
                phoneNumber: null,
            });

            await store.addRecord({
                name: 'record1',
                secretHashes: [],
                secretSalt: 'salt',
                ownerId: null,
                studioId: 'studioId',
            });

            const result = await manager.createRecord({
                recordName: 'studioId',
                userId: 'userId',
                studioId: 'studioId',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: 'This subscription has hit its record limit.',
            });

            const records = await store.listRecordsByStudioId('studioId');

            expect(records).toEqual([
                {
                    name: 'record1',
                    ownerId: null,
                    studioId: 'studioId',
                },
            ]);
        });
    });

    describe('getWebConfig()', () => {
        it('should return the web config with subscriptionsSupported and studiosSupported set to true when subscription configuration exists', async () => {
            store.subscriptionConfiguration = createTestSubConfiguration();

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    subscriptionsSupported: true,
                    studiosSupported: true,
                    requirePrivoLogin: false,
                })
            );
        });

        it('should return the web config with subscriptionsSupported and studiosSupported set to false when subscription configuration is null', async () => {
            store.subscriptionConfiguration = null;

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    subscriptionsSupported: false,
                    studiosSupported: false,
                    requirePrivoLogin: false,
                })
            );
        });

        it('should return the web config with requirePrivoLogin set to true when privo configuration exists', async () => {
            store.privoConfiguration = createTestPrivoConfiguration();

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    subscriptionsSupported: true,
                    studiosSupported: true,
                    requirePrivoLogin: true,
                })
            );
        });

        it('should return the web config with requirePrivoLogin set to false when privo configuration is null', async () => {
            store.privoConfiguration = null;

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    subscriptionsSupported: true,
                    studiosSupported: true,
                    requirePrivoLogin: false,
                })
            );
        });

        it('should merge the web config properties from the configuration store', async () => {
            store.webConfig = {
                version: 2,
                causalRepoConnectionProtocol: 'apiary-aws',
                vmOrigin: 'https://vm.example.com',
                authOrigin: 'https://auth.example.com',
            };

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'apiary-aws',
                    vmOrigin: 'https://vm.example.com',
                    authOrigin: 'https://auth.example.com',
                    subscriptionsSupported: true,
                    studiosSupported: true,
                    requirePrivoLogin: false,
                })
            );
        });

        it('should handle all configuration states correctly', async () => {
            store.subscriptionConfiguration = null;
            store.privoConfiguration = createTestPrivoConfiguration();
            store.webConfig = {
                version: 1,
                causalRepoConnectionProtocol: 'websocket',
                disableCollaboration: true,
                jitsiAppName: 'my-jitsi-app',
            };

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 1,
                    causalRepoConnectionProtocol: 'websocket',
                    disableCollaboration: true,
                    jitsiAppName: 'my-jitsi-app',
                    subscriptionsSupported: false,
                    studiosSupported: false,
                    requirePrivoLogin: true,
                })
            );
        });

        it('should return default config when webConfig is null', async () => {
            store.webConfig = null;
            store.subscriptionConfiguration = null;
            store.privoConfiguration = null;

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    subscriptionsSupported: false,
                    studiosSupported: false,
                    requirePrivoLogin: false,
                })
            );
        });

        it('should handle partial web config properties', async () => {
            store.webConfig = {
                version: 2,
                causalRepoConnectionProtocol: 'websocket',
                playerMode: 'builder',
                logoUrl: 'https://example.com/logo.png',
                logoTitle: 'My App',
            };

            const result = await manager.getWebConfig();

            expect(result).toEqual(
                success({
                    version: 2,
                    causalRepoConnectionProtocol: 'websocket',
                    playerMode: 'builder',
                    logoUrl: 'https://example.com/logo.png',
                    logoTitle: 'My App',
                    subscriptionsSupported: true,
                    studiosSupported: true,
                    requirePrivoLogin: false,
                })
            );
        });
    });
});
