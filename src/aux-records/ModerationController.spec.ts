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
import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { MemoryStore } from './MemoryStore';
import { ModerationController } from './ModerationController';
import { v4 as uuid } from 'uuid';
import { MemoryModerationJobProvider } from './MemoryModerationJobProvider';
import type { ModerationFileScan } from './ModerationJobProvider';

const originalDateNow = Date.now;

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.warn = jest.fn();

describe('ModerationController', () => {
    let controller: ModerationController;
    let store: MemoryStore;
    let jobProvider: MemoryModerationJobProvider;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        nowMock = Date.now = jest.fn();
        store = new MemoryStore({
            subscriptions: null,
            moderation: {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                        bannedLabels: [],
                    },
                },
            },
        });
        jobProvider = new MemoryModerationJobProvider();
        controller = new ModerationController(store, store, store, jobProvider);
    });

    afterEach(() => {
        Date.now = originalDateNow;
        uuidMock.mockReset();
    });

    describe('reportInst()', () => {
        it('should record the report in the store', async () => {
            uuidMock.mockReturnValueOnce('test_id');
            nowMock.mockReturnValueOnce(123);

            const response = await controller.reportInst({
                recordName: 'test_record',
                inst: 'test_inst',
                reportedPermalink: 'test_permalink',
                reportedUrl: 'test_url',
                reportReason: 'harassment',
                reportingIpAddress: '127.0.0.1',
                automaticReport: false,
                reportingUserId: null,
                reportReasonText: 'test_reason',
            });

            expect(response).toEqual({
                success: true,
                id: 'test_id',
            });

            expect(store.userInstReports).toEqual([
                {
                    id: 'test_id',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    recordName: 'test_record',
                    inst: 'test_inst',
                    reportedPermalink: 'test_permalink',
                    reportedUrl: 'test_url',
                    reportReason: 'harassment',
                    reportingIpAddress: '127.0.0.1',
                    automaticReport: false,
                    reportingUserId: null,
                    reportReasonText: 'test_reason',
                },
            ]);
        });

        it('should send a notification for the user inst report', async () => {
            uuidMock.mockReturnValueOnce('test_id');
            nowMock.mockReturnValueOnce(123);

            const response = await controller.reportInst({
                recordName: 'test_record',
                inst: 'test_inst',
                reportedPermalink: 'test_permalink',
                reportedUrl: 'test_url',
                reportReason: 'harassment',
                reportingIpAddress: '127.0.0.1',
                automaticReport: false,
                reportingUserId: null,
                reportReasonText: 'test_reason',
            });

            expect(response).toEqual({
                success: true,
                id: 'test_id',
            });

            expect(store.recordsNotifications).toEqual([
                {
                    resource: 'user_inst_report',
                    action: 'created',
                    resourceId: 'test_inst',
                    recordName: 'test_record',
                    timeMs: 123,
                    report: {
                        id: 'test_id',
                        createdAtMs: 123,
                        updatedAtMs: 123,
                        recordName: 'test_record',
                        inst: 'test_inst',
                        reportedPermalink: 'test_permalink',
                        reportedUrl: 'test_url',
                        reportReason: 'harassment',
                        reportingIpAddress: '127.0.0.1',
                        automaticReport: false,
                        reportingUserId: null,
                        reportReasonText: 'test_reason',
                    },
                },
            ]);
        });

        it('should return a not_supported error if moderation is not configured', async () => {
            store.moderationConfiguration = null;
            uuidMock.mockReturnValueOnce('test_id');
            nowMock.mockReturnValueOnce(123);

            const response = await controller.reportInst({
                recordName: 'test_record',
                inst: 'test_inst',
                reportedPermalink: 'test_permalink',
                reportedUrl: 'test_url',
                reportReason: 'harassment',
                reportingIpAddress: '127.0.0.1',
                automaticReport: false,
                reportingUserId: null,
                reportReasonText: 'test_reason',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should return a not_logged_in error if unauthenticated reports are not supported', async () => {
            store.moderationConfiguration = {
                allowUnauthenticatedReports: false,
            };
            uuidMock.mockReturnValueOnce('test_id');
            nowMock.mockReturnValueOnce(123);

            const response = await controller.reportInst({
                recordName: 'test_record',
                inst: 'test_inst',
                reportedPermalink: 'test_permalink',
                reportedUrl: 'test_url',
                reportReason: 'harassment',
                reportingIpAddress: '127.0.0.1',
                automaticReport: false,
                reportingUserId: null,
                reportReasonText: 'test_reason',
            });

            expect(response).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'The user must be logged in to report an inst.',
            });
        });
    });

    describe('scheduleModerationScans()', () => {
        const recordName = 'test_record';
        const recordName2 = 'test_record';
        const userId = 'userId';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addRecord({
                name: recordName,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });
            await store.addRecord({
                name: recordName2,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            await store.addFileRecord(
                recordName,
                'file1.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName,
                'file2.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName,
                'file3.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName2,
                'file1.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName2,
                'file2.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.addFileRecord(
                recordName2,
                'file3.txt',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
        });

        it('should return not_supported if the job provider is null', async () => {
            controller = new ModerationController(store, store, store, null);

            const result = await controller.scheduleModerationScans();

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should schedule a moderation scan for unscaned files', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);
            const result = await controller.scheduleModerationScans();
            expect(result).toEqual({
                success: true,
                jobs: [
                    {
                        id: 'uuid',
                        type: 'files',
                        createdAtMs: 123,
                        updatedAtMs: 123,
                        filter: {
                            fileExtensions: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
                    },
                ],
            });

            expect(jobProvider.jobs).toEqual([
                {
                    id: 'uuid',
                    type: 'files',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    filter: {
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            ]);

            expect(store.moderationJobs).toEqual([
                {
                    id: 'uuid',
                    type: 'files',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    filter: {
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            ]);
        });

        it('should schedule a moderation scan for only files created after the last scan', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            await store.addModerationJob({
                id: 'old',
                createdAtMs: 5,
                type: 'files',
                updatedAtMs: 5,
            });

            const result = await controller.scheduleModerationScans();

            expect(result).toEqual({
                success: true,
                jobs: [
                    {
                        id: 'uuid',
                        type: 'files',
                        createdAtMs: 123,
                        updatedAtMs: 123,
                        filter: {
                            uploadedAfterMs: 5,
                            fileExtensions: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
                    },
                ],
            });

            expect(jobProvider.jobs).toEqual([
                {
                    id: 'uuid',
                    type: 'files',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    filter: {
                        uploadedAfterMs: 5,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            ]);

            expect(store.moderationJobs.slice(1)).toEqual([
                {
                    id: 'uuid',
                    type: 'files',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    filter: {
                        uploadedAfterMs: 5,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                    },
                },
            ]);
        });
    });

    describe('scanFile()', () => {
        const recordName = 'test_record';
        const recordName2 = 'test_record';
        const userId = 'userId';

        beforeEach(async () => {
            await store.saveUser({
                id: userId,
                email: 'test@example.com',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });
            await store.addRecord({
                name: recordName,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });
            await store.addRecord({
                name: recordName2,
                ownerId: userId,
                secretHashes: [],
                secretSalt: 'salt',
                studioId: null,
            });

            await store.addFileRecord(
                recordName,
                'file1.png',
                null,
                userId,
                128,
                'description',
                [PUBLIC_READ_MARKER]
            );
        });

        it('should return not_supported if the job provider is null', async () => {
            controller = new ModerationController(store, store, store, null);

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'This operation is not supported.',
            });
        });

        it('should scan the given file and return the result', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: true,
                result: {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            });

            expect(store.moderationFileResults).toEqual([
                {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            ]);
        });

        it('should save the detected labels', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            const scanFile = (jobProvider.scanFile = jest.fn<
                Promise<ModerationFileScan>,
                any[]
            >());
            scanFile.mockResolvedValue({
                recordName,
                fileName: 'file1.png',
                labels: [
                    {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    {
                        name: 'label2',
                        confidence: 0.6,
                    },
                ],
                modelVersion: 'memory',
            });

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: true,
                result: {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            });

            expect(store.moderationFileResults).toEqual([
                {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            ]);
        });

        it('should include the configured min confidence', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            const scanFile = (jobProvider.scanFile = jest.fn<
                Promise<ModerationFileScan>,
                any[]
            >());
            scanFile.mockResolvedValue({
                recordName,
                fileName: 'file1.png',
                labels: [
                    {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    {
                        name: 'label2',
                        confidence: 0.6,
                    },
                ],
                modelVersion: 'memory',
            });

            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                        bannedLabels: [],
                        minConfidence: 0.6,
                    },
                },
            };

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: true,
                result: {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            });

            expect(store.moderationFileResults).toEqual([
                {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: false,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            ]);

            expect(scanFile).toHaveBeenCalledWith({
                recordName: recordName,
                fileName: 'file1.png',
                minConfidence: 0.6,
            });
        });

        it('should send notifications for banned labels', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                        bannedLabels: [
                            {
                                label: 'label1',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                        ],
                    },
                },
            };

            const scanFile = (jobProvider.scanFile = jest.fn<
                Promise<ModerationFileScan>,
                any[]
            >());
            scanFile.mockResolvedValue({
                recordName,
                fileName: 'file1.png',
                labels: [
                    {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    {
                        name: 'label2',
                        confidence: 0.6,
                    },
                ],
                modelVersion: 'memory',
            });

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: true,
                result: {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: true,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            });

            expect(store.moderationFileResults).toEqual([
                {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: true,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            ]);

            expect(store.recordsNotifications).toEqual([
                {
                    resource: 'moderation_scan',
                    resourceKind: 'file',
                    action: 'scanned',
                    recordName: recordName,
                    resourceId: 'file1.png',
                    resultId: 'uuid',
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    timeMs: 123,
                    bannedLabel: {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    message: `Banned label (label1) detected in file (${recordName}/file1.png).`,
                },
            ]);
        });

        it('should ignore case with labels', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            store.moderationConfiguration = {
                allowUnauthenticatedReports: true,
                jobs: {
                    files: {
                        enabled: true,
                        fileExtensions: [
                            '.png',
                            '.webp',
                            '.jpg',
                            '.jpeg',
                            '.gif',
                        ],
                        bannedLabels: [
                            {
                                label: 'Label1',
                                threshold: 0.5,
                                actions: ['notify'],
                            },
                        ],
                    },
                },
            };

            const scanFile = (jobProvider.scanFile = jest.fn<
                Promise<ModerationFileScan>,
                any[]
            >());
            scanFile.mockResolvedValue({
                recordName,
                fileName: 'file1.png',
                labels: [
                    {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    {
                        name: 'label2',
                        confidence: 0.6,
                    },
                ],
                modelVersion: 'memory',
            });

            const result = await controller.scanFile({
                recordName: recordName,
                fileName: 'file1.png',
            });

            expect(result).toEqual({
                success: true,
                result: {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: true,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            });

            expect(store.moderationFileResults).toEqual([
                {
                    id: 'uuid',
                    recordName: recordName,
                    fileName: 'file1.png',
                    appearsToMatchBannedContent: true,
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    modelVersion: 'memory',
                },
            ]);

            expect(store.recordsNotifications).toEqual([
                {
                    resource: 'moderation_scan',
                    resourceKind: 'file',
                    action: 'scanned',
                    recordName: recordName,
                    resourceId: 'file1.png',
                    resultId: 'uuid',
                    labels: [
                        {
                            name: 'label1',
                            confidence: 0.5,
                        },
                        {
                            name: 'label2',
                            confidence: 0.6,
                        },
                    ],
                    timeMs: 123,
                    bannedLabel: {
                        name: 'label1',
                        confidence: 0.5,
                    },
                    message: `Banned label (label1) detected in file (${recordName}/file1.png).`,
                },
            ]);
        });
    });
});
