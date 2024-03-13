import { MemoryStore } from './MemoryStore';
import { ModerationController } from './ModerationController';
import { v4 as uuid } from 'uuid';

const originalDateNow = Date.now;

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

describe('ModerationController', () => {
    let controller: ModerationController;
    let store: MemoryStore;
    let nowMock: jest.Mock<number>;

    beforeEach(() => {
        nowMock = Date.now = jest.fn();
        store = new MemoryStore({
            subscriptions: null,
            moderation: {
                allowUnauthenticatedReports: true,
            },
        });
        controller = new ModerationController(store, store, store);
    });

    afterEach(() => {
        Date.now = originalDateNow;
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
});
