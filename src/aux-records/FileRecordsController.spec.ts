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
import type { RecordsController } from './RecordsController';
import type {
    EraseFileFailure,
    EraseFileSuccess,
    ListedFile,
    ReadFileFailure,
    ReadFileSuccess,
    RecordFileFailure,
    RecordFileSuccess,
    UpdateFileRecordSuccess,
} from './FileRecordsController';
import { FileRecordsController } from './FileRecordsController';
import type {
    GetFileRecordSuccess,
    UpdateFileFailure,
} from './FileRecordsStore';
import type { PolicyController } from './PolicyController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
    checkAccounts,
    checkBillingTotals,
} from './TestUtils';
import {
    ACCOUNT_MARKER,
    ADMIN_ROLE_NAME,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    unwrap,
} from '@casual-simulation/aux-common';
import { sortBy } from 'es-toolkit/compat';
import type { MemoryStore } from './MemoryStore';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import { MemoryFinancialInterface } from './financial/MemoryFinancialInterface';
import { FinancialController } from './financial/FinancialController';
import {
    ACCOUNT_IDS,
    BillingCodes,
    CurrencyCodes,
    LEDGERS,
    TransferCodes,
} from './financial';

console.log = jest.fn();
console.warn = jest.fn();

describe('FileRecordsController', () => {
    let store: MemoryStore;
    let records: RecordsController;
    let policies: PolicyController;
    let presignUrlMock: jest.Mock;
    let presignReadMock: jest.Mock;
    let manager: FileRecordsController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    const recordName = 'testRecord';

    let ownerId: string;

    beforeEach(async () => {
        const services = createTestControllers();

        store = services.store;
        policies = services.policies;
        records = services.records;

        manager = new FileRecordsController({
            policies,
            store,
            metrics: store,
            config: store,
        });
        presignUrlMock = store.presignFileUpload = jest.fn();
        presignReadMock = store.presignFileRead = jest.fn();

        ownerId = 'testUser';
        await store.saveUser({
            id: ownerId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'other@example.com',
            phoneNumber: null,
        });

        const user = await createTestUser(services, 'test@example.com');
        userId = user.userId;
        sessionKey = user.sessionKey;

        const testRecordKey = await createTestRecordKey(
            services,
            ownerId,
            recordName,
            'subjectfull'
        );
        key = testRecordKey.recordKey;

        const subjectlessRecordKey = await createTestRecordKey(
            services,
            ownerId,
            recordName,
            'subjectless'
        );
        subjectlessKey = subjectlessRecordKey.recordKey;
    });

    describe('recordFile()', () => {
        it('should store the file record in the store', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should set publisher to null if the system is publishing to a studio', async () => {
            await store.addStudio({
                id: 'studio1',
                displayName: 'My Studio',
            });
            await store.addStudioAssignment({
                isPrimaryContact: true,
                role: 'admin',
                studioId: 'studio1',
                userId: ownerId,
            });

            const recordName = 'studioRecord';
            await store.addRecord({
                name: recordName,
                ownerId: null,
                studioId: 'studio1',
                secretHashes: [],
                secretSalt: 'salt',
            });

            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(recordName, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                userRole: 'system',
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: null,
                subjectId: null,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should include the given headers in the signature', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {
                    abc: 'test',
                },
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {
                    abc: 'test',
                },
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should return another signature if the file has not been uploaded yet', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject the request if the file hasnt been uploaded and the user doesnt have access to the markers that are already on the file', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'user',
                userId,
                'file',
                PRIVATE_MARKER,
                'create',
                {},
                null
            );

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'user',
                userId,
                'marker',
                ACCOUNT_MARKER,
                'assign',
                {},
                null
            );

            await store.addFileRecord(
                recordName,
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription',
                ['custom']
            );

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: [PRIVATE_MARKER],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceKind: 'file',
                    action: 'create',
                    resourceId: 'testSha256.txt',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
            expect(presignUrlMock).not.toHaveBeenCalled();

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                markers: ['custom'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should return file_already_exists if the file has been uploaded', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testSha256.txt',
                'testUser',
                'subjectId',
                100,
                'testDescription',
                [PUBLIC_READ_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'testSha256.txt');

            const result = (await manager.recordFile(key, 'subjectId', {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'file_already_exists',
                errorMessage:
                    'The file has already been uploaded to ' +
                    (result as any).existingFileUrl,
                existingFileUrl: expect.any(String),
                existingFileName: 'testSha256.txt',
            });
        });

        it('should reject the request if using an invalid record key', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile('wrongkey', null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'record_not_found',
                errorMessage: 'Record not found.',
            });
            expect(presignUrlMock).not.toHaveBeenCalled();
        });

        it('should reject the request if trying to upload a file without a subjectId', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(key, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'You must be logged in in order to use this record key.',
            });
            expect(presignUrlMock).not.toHaveBeenCalled();
        });

        it('should allow uploading files without a subjectId if the key is subjectless', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(subjectlessKey, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should clear the subjectId if using a subjectless key', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(
                subjectlessKey,
                'subjectId',
                {
                    fileSha256Hex: 'testSha256',
                    fileByteLength: 100,
                    fileMimeType: 'text/plain',
                    fileDescription: 'testDescription',
                    headers: {},
                }
            )) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: 'testUser',
                subjectId: null,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file with a record name and user ID', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file if the record name matches the user ID', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            const result = (await manager.recordFile(userId, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: [PUBLIC_READ_MARKER],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: userId,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            await expect(
                store.getFileRecord(userId, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: userId,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file with a custom marker', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret'],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: ['secret'],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: ['secret'],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to record a file with a custom marker path', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret:myMarker'],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: ['secret:myMarker'],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: ['secret'], // should only pass root markers
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: userId,
                subjectId: userId,
                sizeInBytes: 100,
                markers: ['secret:myMarker'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject the request if the inst is not authorized', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret'],
                instances: ['inst'],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testSha256.txt',
                    resourceKind: 'file',
                    action: 'create',
                    subjectType: 'inst',
                    subjectId: '/inst',

                    // type: 'missing_permission',
                    // permission: 'file.create',
                    // kind: 'inst',
                    // id: 'inst',
                    // marker: 'secret',
                    // role: null,
                },
            });
            expect(presignUrlMock).not.toHaveBeenCalled();

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should reject the request if the user is not authorized', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            // store.roles[recordName] = {
            //     [userId]: new Set([ADMIN_ROLE_NAME]),
            // };

            const result = (await manager.recordFile(recordName, userId, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret'],
                instances: ['inst'],
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testSha256.txt',
                    resourceKind: 'file',
                    action: 'create',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });
            expect(presignUrlMock).not.toHaveBeenCalled();

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should allow the request if the user is not logged in but the system user role was provided', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            // store.roles[recordName] = {
            //     [userId]: new Set([ADMIN_ROLE_NAME]),
            // };

            const result = (await manager.recordFile(recordName, null, {
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'testDescription',
                headers: {},
                markers: ['secret'],
                instances: ['inst'],
                userRole: 'system',
            })) as RecordFileSuccess;

            expect(result).toEqual({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
                fileName: 'testSha256.txt',
                markers: ['secret'],
            });
            expect(presignUrlMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testSha256.txt',
                fileSha256Hex: 'testSha256',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                headers: {},
                markers: ['secret'],
            });

            await expect(
                store.getFileRecord(recordName, 'testSha256.txt')
            ).resolves.toEqual({
                success: true,
                fileName: 'testSha256.txt',
                description: 'testDescription',
                recordName: recordName,
                publisherId: ownerId,
                subjectId: null,
                sizeInBytes: 100,
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject the request if the file is larger than the configured maximum file size', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withFiles()
                            .withMaxBytesPerFile(10)
                    )
            );

            const user = await store.findUser(ownerId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.recordFile(recordName, ownerId, {
                fileByteLength: 11,
                fileDescription: 'description',
                fileMimeType: 'text/plain',
                fileSha256Hex: 'hex',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: 'The file is too large.',
            });
        });

        it('should reject the request if the file would put the total size of files stored above the limit', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withFiles()
                            .withFilesMaxBytesTotal(10)
                    )
            );

            await store.addFileRecord(
                recordName,
                'myFile.txt',
                ownerId,
                'subjectId',
                5,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const user = await store.findUser(ownerId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.recordFile(recordName, ownerId, {
                fileByteLength: 6,
                fileDescription: 'description',
                fileMimeType: 'text/plain',
                fileSha256Hex: 'hex',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The file storage limit has been reached for the subscription.',
            });
        });

        it('should reject the request if the file would put the total number of files above the allowed limit', async () => {
            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withFiles()
                            .withMaxFiles(1)
                    )
            );

            await store.addFileRecord(
                recordName,
                'myFile.txt',
                ownerId,
                'subjectId',
                5,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const user = await store.findUser(ownerId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.recordFile(recordName, ownerId, {
                fileByteLength: 6,
                fileDescription: 'description',
                fileMimeType: 'text/plain',
                fileSha256Hex: 'hex',
                headers: {},
                markers: [PUBLIC_READ_MARKER],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The file count limit has been reached for the subscription.',
            });
        });
    });

    describe('eraseFile()', () => {
        it('should erase the file record from the store', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                'userId'
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should reject the request if trying to erase files without a subjectId', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                key,
                'testFile.txt',
                null
            )) as EraseFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'You must be logged in in order to use this record key.',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                description: 'description',
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                recordName: recordName,
                sizeInBytes: 100,
                subjectId: 'subjectId',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: 'http://localhost:9191/testRecord/testFile.txt',
            });
        });

        it('should allow erasing files without a subjectId if the key is subjectless', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                subjectlessKey,
                'testFile.txt',
                null
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should be able to erase a file if the user has the correct permissions', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                recordName,
                'testFile.txt',
                userId
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should be able to erase a file if the record name matches the user ID', async () => {
            await store.addFileRecord(
                userId,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                userId,
                'testFile.txt',
                userId
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: true,
                recordName: userId,
                fileName: 'testFile.txt',
            });

            await expect(
                store.getFileRecord(userId, 'testFile.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            });
        });

        it('should reject the request if the user does not have the correct permissions', async () => {
            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                recordName,
                'testFile.txt',
                userId
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testFile.txt',
                    resourceKind: 'file',
                    action: 'delete',
                    subjectType: 'user',
                    subjectId: userId,

                    // type: 'missing_permission',
                    // permission: 'file.delete',
                    // kind: 'user',
                    // id: userId,
                    // marker: PUBLIC_READ_MARKER,
                    // role: null,
                },
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toMatchObject({
                success: true,
            });
        });

        it('should reject the request if the inst does not have the correct permissions', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.eraseFile(
                recordName,
                'testFile.txt',
                userId,
                ['inst']
            )) as EraseFileSuccess;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testFile.txt',
                    resourceKind: 'file',
                    action: 'delete',
                    subjectType: 'inst',
                    subjectId: '/inst',

                    // type: 'missing_permission',
                    // permission: 'file.delete',
                    // kind: 'inst',
                    // id: 'inst',
                    // marker: PUBLIC_READ_MARKER,
                    // role: null,
                },
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toMatchObject({
                success: true,
            });
        });
    });

    describe('readFile()', () => {
        it('should get a URL that the file can be read from', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.readFile(
                key,
                'testFile.txt',
                userId
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should get a URL by record name if the user has the correct permissions', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                userId
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should get a URL by record name if it matches the user ID', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                userId,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            const result = (await manager.readFile(
                userId,
                'testFile.txt',
                userId
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: userId,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should get a URL by record name if the user role is system', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                null,
                undefined,
                'system'
            )) as ReadFileSuccess;

            expect(result).toEqual({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });
            expect(presignReadMock).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'testFile.txt',
                headers: {},
            });
        });

        it('should deny requests if the user doesnt have permissions', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                userId
            )) as ReadFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testFile.txt',
                    resourceKind: 'file',
                    action: 'read',
                    subjectType: 'user',
                    subjectId: userId,

                    // type: 'missing_permission',
                    // permission: 'file.read',
                    // kind: 'user',
                    // id: userId,
                    // marker: 'secret',
                    // role: null,
                },
            });
            expect(presignReadMock).not.toHaveBeenCalled();
        });

        it('should deny requests if the inst doesnt have permissions', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );

            const result = (await manager.readFile(
                recordName,
                'testFile.txt',
                userId,
                ['inst']
            )) as ReadFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: recordName,
                    resourceId: 'testFile.txt',
                    resourceKind: 'file',
                    action: 'read',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });
            expect(presignReadMock).not.toHaveBeenCalled();
        });
    });

    describe('listFiles()', () => {
        let files: ListedFile[];

        beforeEach(async () => {
            files = [];
            for (let i = 0; i < 20; i++) {
                const fileName = `abc${i}.json`;
                await store.addFileRecord(
                    recordName,
                    fileName,
                    'publisherId',
                    'subjectId',
                    100,
                    'description',
                    [PUBLIC_READ_MARKER]
                );
                await store.setFileRecordAsUploaded(recordName, fileName);
                const file = (await store.getFileRecord(
                    recordName,
                    fileName
                )) as GetFileRecordSuccess;
                files.push({
                    fileName: file.fileName,
                    url: file.url,
                    sizeInBytes: file.sizeInBytes,
                    description: file.description,
                    uploaded: true,
                    markers: file.markers ?? [PUBLIC_READ_MARKER],
                });
            }

            for (let i = 0; i < 20; i++) {
                const fileName = `abc${i}.txt`;
                await store.addFileRecord(
                    recordName,
                    fileName,
                    'publisherId',
                    'subjectId',
                    100,
                    'description',
                    ['secret']
                );
                await store.setFileRecordAsUploaded(recordName, fileName);
                const file = (await store.getFileRecord(
                    recordName,
                    fileName
                )) as GetFileRecordSuccess;
                files.push({
                    fileName: file.fileName,
                    url: file.url,
                    sizeInBytes: file.sizeInBytes,
                    description: file.description,
                    uploaded: true,
                    markers: file.markers ?? [PUBLIC_READ_MARKER],
                });
            }

            files = sortBy(files, (f) => f.fileName);

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };
        });

        it('should return a list of files', async () => {
            const result = await manager.listFiles(recordName, null, userId);

            expect(result).toEqual({
                success: true,
                recordName,
                files: files.slice(0, 10),
                totalCount: files.length,
            });
        });

        it('should work if the user has the ability to list the account marker', async () => {
            await store.addFileRecord(
                recordName,
                'test1.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );
            await store.addFileRecord(
                recordName,
                'test2.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName,
                'test3.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                ['secret']
            );
            await store.setFileRecordAsUploaded(recordName, 'test1.txt');
            await store.setFileRecordAsUploaded(recordName, 'test2.txt');
            await store.setFileRecordAsUploaded(recordName, 'test3.txt');

            store.roles[recordName] = {
                [userId]: new Set(['developer']),
            };

            await store.assignPermissionToSubjectAndMarker(
                recordName,
                'role',
                'developer',
                'file',
                ACCOUNT_MARKER,
                'list',
                {},
                null
            );

            const result = await manager.listFiles(recordName, 'test1', userId);

            expect(result).toEqual({
                success: true,
                recordName,
                files: [
                    {
                        fileName: 'test1.txt',
                        url: 'http://localhost:9191/testRecord/test1.txt',
                        sizeInBytes: 100,
                        description: 'description',
                        uploaded: true,
                        markers: ['secret'],
                    },
                    {
                        description: 'description',
                        fileName: 'test2.txt',
                        markers: ['publicRead'],
                        sizeInBytes: 100,
                        uploaded: true,
                        url: 'http://localhost:9191/testRecord/test2.txt',
                    },
                    {
                        fileName: 'test3.txt',
                        url: 'http://localhost:9191/testRecord/test3.txt',
                        sizeInBytes: 100,
                        description: 'description',
                        uploaded: true,
                        markers: ['secret'],
                    },
                ],
                totalCount: 43,
            });
        });

        it('should list only files that are after the given file name', async () => {
            const result = await manager.listFiles(
                recordName,
                'abc3.json',
                userId
            );

            expect(result).toEqual({
                success: true,
                recordName,
                files: files.slice(27, 37),
                totalCount: 40,
            });
        });

        it('should return an empty list if there are no files', async () => {
            const result = await manager.listFiles(recordName, 'zzzz', userId);

            expect(result).toEqual({
                success: true,
                recordName,
                files: [],
                totalCount: 40,
            });
        });

        it('should return a not_authorized error if the user does not have permission', async () => {
            const result = await manager.listFiles(recordName, null, userId, [
                'inst',
            ]);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName: 'testRecord',
                    action: 'list',
                    resourceId: undefined,
                    resourceKind: 'file',
                    subjectId: '/inst',
                    subjectType: 'inst',
                },
            });
        });

        it('should return a not supported error if the store does not have the ability to list files', async () => {
            (store as any).listUploadedFiles = null;

            const result = await manager.listFiles(recordName, 'zzzz', userId);

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });
    });

    describe('updateFile()', () => {
        it('should be able to update the markers on the file', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.updateFile(
                key,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to update the markers if the user has the admin role', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            const result = (await manager.updateFile(
                recordName,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should be able to update the markers if the record name matches the user ID', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                userId,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.updateFile(
                userId,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileRecordSuccess;

            expect(result).toEqual({
                success: true,
            });

            await expect(
                store.getFileRecord(userId, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: userId,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: ['secret'],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject requests that are not authorized to change the markers', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            // store.roles[recordName] = {
            //     [userId]: new Set([ADMIN_ROLE_NAME])
            // };

            const result = (await manager.updateFile(
                recordName,
                'testFile.txt',
                userId,
                ['secret']
            )) as UpdateFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'file',
                    resourceId: 'testFile.txt',
                    action: 'update',
                    subjectType: 'user',
                    subjectId: userId,
                },
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });

        it('should reject the request if trying to update files without a subjectId', async () => {
            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.updateFile(
                key,
                'testFile.txt',
                null,
                ['secret']
            )) as UpdateFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                description: 'description',
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                recordName: recordName,
                sizeInBytes: 100,
                subjectId: 'subjectId',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: 'http://localhost:9191/testRecord/testFile.txt',
            });
        });

        it('should deny the request if the inst does not have permission', async () => {
            store.roles[recordName] = {
                [userId]: new Set([ADMIN_ROLE_NAME]),
            };

            presignReadMock.mockResolvedValueOnce({
                success: true,
                requestUrl: 'testUrl',
                requestMethod: 'GET',
                requestHeaders: {
                    myHeader: 'myValue',
                },
            });

            await store.addFileRecord(
                recordName,
                'testFile.txt',
                'publisherId',
                'subjectId',
                100,
                'description',
                [PUBLIC_READ_MARKER]
            );

            const result = (await manager.updateFile(
                recordName,
                'testFile.txt',
                userId,
                ['secret'],
                ['inst']
            )) as UpdateFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    recordName,
                    resourceKind: 'file',
                    resourceId: 'testFile.txt',
                    action: 'update',
                    subjectType: 'inst',
                    subjectId: '/inst',
                },
            });

            await expect(
                store.getFileRecord(recordName, 'testFile.txt')
            ).resolves.toEqual({
                success: true,
                recordName: recordName,
                fileName: 'testFile.txt',
                publisherId: 'publisherId',
                subjectId: 'subjectId',
                sizeInBytes: 100,
                description: 'description',
                markers: [PUBLIC_READ_MARKER],
                uploaded: false,
                url: expect.any(String),
            });
        });
    });

    describe('getFileNameFromUrl()', () => {
        it('should return the file name for the given file URL', async () => {
            const result = await manager.getFileNameFromUrl(
                'http://localhost:9191/record-name/file-name.aux'
            );

            expect(result).toEqual({
                success: true,
                recordName: 'record-name',
                fileName: 'file-name.aux',
            });
        });
    });

    describe('credits', () => {
        let financialInterface: MemoryFinancialInterface;
        let financialController: FinancialController;

        beforeEach(async () => {
            financialInterface = new MemoryFinancialInterface();
            financialController = new FinancialController(
                financialInterface,
                store
            );
            manager = new FileRecordsController({
                policies,
                store,
                metrics: store,
                config: store,
                financialController,
            });

            unwrap(await financialController.init());

            const account = unwrap(
                await financialController.getOrCreateFinancialAccount({
                    userId: ownerId,
                    ledger: LEDGERS.credits,
                })
            );

            unwrap(
                await financialController.internalTransaction({
                    transfers: [
                        {
                            amount: 1000n,
                            debitAccountId: ACCOUNT_IDS.liquidity_credits,
                            creditAccountId: account.account.id,
                            code: TransferCodes.admin_credit,
                            currency: CurrencyCodes.credits,
                        },
                    ],
                })
            );

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withFiles({
                                allowed: true,
                                creditFeePerFileWrite: 50, // 50 credits per file write
                            })
                    )
            );

            const user = await store.findUser(ownerId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            presignUrlMock.mockResolvedValueOnce({
                success: true,
                uploadUrl: 'testUrl',
                uploadMethod: 'POST',
                uploadHeaders: {
                    myHeader: 'myValue',
                },
            });
        });

        it('should try to debit the users credit account for file upload', async () => {
            const result = (await manager.recordFile(key, userId, {
                fileSha256Hex: 'hash',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'description',
                headers: {},
            })) as RecordFileSuccess;

            expect(result.success).toBe(true);
            expect(result.fileName).toBe('hash.txt');

            const userAccount = unwrap(
                await financialController.getAccountBalance({
                    userId: ownerId,
                    ledger: LEDGERS.credits,
                })
            );

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.revenue_records_usage_credits,
                    credits_posted: 50n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: BigInt(userAccount!.accountId),
                    credits_posted: 1000n,
                    debits_posted: 50n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
            ]);

            await checkBillingTotals(
                financialController,
                userAccount!.accountId,
                {
                    [BillingCodes.file_write]: 50n,
                }
            );

            await expect(
                store.getFileRecord(recordName, 'hash.txt')
            ).resolves.toMatchObject({
                success: true,
                fileName: 'hash.txt',
                recordName: recordName,
            });
        });

        it('should fail to write the file if the user doesnt have enough credits', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withFiles({
                                allowed: true,
                                creditFeePerFileWrite: 100_000, // 100,000 credits per file write
                            })
                    )
            );

            const result = (await manager.recordFile(key, userId, {
                fileSha256Hex: 'hash',
                fileByteLength: 100,
                fileMimeType: 'text/plain',
                fileDescription: 'description',
                headers: {},
            })) as RecordFileFailure;

            expect(result).toEqual({
                success: false,
                errorCode: 'insufficient_funds',
                errorMessage: 'Insufficient funds to cover usage.',
            });

            const userAccount = unwrap(
                await financialController.getAccountBalance({
                    userId: ownerId,
                    ledger: LEDGERS.credits,
                })
            );

            await checkAccounts(financialInterface, [
                {
                    id: ACCOUNT_IDS.revenue_records_usage_credits,
                    credits_posted: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
                {
                    id: BigInt(userAccount!.accountId),
                    credits_posted: 1000n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    debits_pending: 0n,
                },
            ]);

            await expect(
                store.getFileRecord(recordName, 'hash.txt')
            ).resolves.toEqual({
                success: false,
                errorCode: 'file_not_found',
                errorMessage: expect.any(String),
            });
        });

        describe('studio', () => {
            const studioId = 'studio1';
            const studioRecordName = 'studioRecord';

            beforeEach(async () => {
                await store.addStudio({
                    id: studioId,
                    displayName: 'My Studio!',
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await store.addStudioAssignment({
                    studioId,
                    userId: ownerId,
                    role: 'admin',
                    isPrimaryContact: true,
                });

                await store.addRecord({
                    name: studioRecordName,
                    studioId: studioId,
                    ownerId: null,
                    secretHashes: [],
                    secretSalt: '',
                });

                // Set up roles so the owner has admin permissions
                store.roles[studioRecordName] = {
                    [ownerId]: new Set([ADMIN_ROLE_NAME]),
                };

                const account = unwrap(
                    await financialController.getOrCreateFinancialAccount({
                        studioId: studioId,
                        ledger: LEDGERS.credits,
                    })
                );

                unwrap(
                    await financialController.internalTransaction({
                        transfers: [
                            {
                                amount: 1000n,
                                debitAccountId: ACCOUNT_IDS.liquidity_credits,
                                creditAccountId: account.account.id,
                                code: TransferCodes.admin_credit,
                                currency: CurrencyCodes.credits,
                            },
                        ],
                    })
                );

                presignUrlMock.mockResolvedValueOnce({
                    success: true,
                    uploadUrl: 'testUrl',
                    uploadMethod: 'POST',
                    uploadHeaders: {
                        myHeader: 'myValue',
                    },
                });
            });

            it('should try to debit the studio credit account for file upload', async () => {
                const result = (await manager.recordFile(
                    studioRecordName,
                    ownerId,
                    {
                        fileSha256Hex: 'hash',
                        fileByteLength: 100,
                        fileMimeType: 'text/plain',
                        fileDescription: 'description',
                        headers: {},
                    }
                )) as RecordFileSuccess;

                expect(result.success).toBe(true);
                expect(result.fileName).toBe('hash.txt');

                const studioAccount = unwrap(
                    await financialController.getAccountBalance({
                        studioId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 50n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(studioAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 50n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);

                await checkBillingTotals(
                    financialController,
                    studioAccount!.accountId,
                    {
                        [BillingCodes.file_write]: 50n,
                    }
                );

                await expect(
                    store.getFileRecord(studioRecordName, 'hash.txt')
                ).resolves.toMatchObject({
                    success: true,
                    fileName: 'hash.txt',
                    recordName: studioRecordName,
                });
            });

            it('should fail to write the file if the studio doesnt have enough credits', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withFiles({
                                    allowed: true,
                                    creditFeePerFileWrite: 100_000, // 100,000 credits per file write
                                })
                        )
                );

                const result = (await manager.recordFile(
                    studioRecordName,
                    ownerId,
                    {
                        fileSha256Hex: 'hash',
                        fileByteLength: 100,
                        fileMimeType: 'text/plain',
                        fileDescription: 'description',
                        headers: {},
                    }
                )) as RecordFileFailure;

                expect(result).toEqual({
                    success: false,
                    errorCode: 'insufficient_funds',
                    errorMessage: 'Insufficient funds to cover usage.',
                });

                const studioAccount = unwrap(
                    await financialController.getAccountBalance({
                        studioId,
                        ledger: LEDGERS.credits,
                    })
                );

                await checkAccounts(financialInterface, [
                    {
                        id: ACCOUNT_IDS.revenue_records_usage_credits,
                        credits_posted: 0n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                    {
                        id: BigInt(studioAccount!.accountId),
                        credits_posted: 1000n,
                        debits_posted: 0n,
                        credits_pending: 0n,
                        debits_pending: 0n,
                    },
                ]);

                await expect(
                    store.getFileRecord(studioRecordName, 'hash.txt')
                ).resolves.toEqual({
                    success: false,
                    errorCode: 'file_not_found',
                    errorMessage: expect.any(String),
                });
            });
        });
    });
});
