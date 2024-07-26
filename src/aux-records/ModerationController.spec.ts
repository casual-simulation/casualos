import { PUBLIC_READ_MARKER } from '@casual-simulation/aux-common';
import { MemoryStore } from './MemoryStore';
import { ModerationController } from './ModerationController';
import { v4 as uuid } from 'uuid';
import { MemoryModerationJobProvider } from './MemoryModerationJobProvider';

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
                            keyNameConstraint: {
                                matchAnySuffix: [
                                    '.png',
                                    '.webp',
                                    '.jpg',
                                    '.jpeg',
                                    '.gif',
                                ],
                            },
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
                        keyNameConstraint: {
                            matchAnySuffix: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
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
                        keyNameConstraint: {
                            matchAnySuffix: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
                    },
                },
            ]);
        });

        it('should schedule a moderation scan for only files created after the last scan', async () => {
            uuidMock.mockReturnValue('uuid');
            nowMock.mockReturnValue(123);

            await store.saveModerationJob({
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
                            createdAfterMs: 5,
                            keyNameConstraint: {
                                matchAnySuffix: [
                                    '.png',
                                    '.webp',
                                    '.jpg',
                                    '.jpeg',
                                    '.gif',
                                ],
                            },
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
                        createdAfterMs: 5,
                        keyNameConstraint: {
                            matchAnySuffix: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
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
                        createdAfterMs: 5,
                        keyNameConstraint: {
                            matchAnySuffix: [
                                '.png',
                                '.webp',
                                '.jpg',
                                '.jpeg',
                                '.gif',
                            ],
                        },
                    },
                },
            ]);
        });
    });
});
