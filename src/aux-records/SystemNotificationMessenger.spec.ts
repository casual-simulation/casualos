import { UserInstReport } from './ModerationStore';
import { formatNotificationAsString } from './SystemNotificationMessenger';
import { StudioComIdRequest } from './RecordsStore';

describe('formatNotificationAsString()', () => {
    it('should consistently format user inst report notifications', () => {
        const report: UserInstReport = {
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
            reportingUserId: 'userId',
            reportReasonText: 'test_reason',
        };

        const result = formatNotificationAsString({
            resource: 'user_inst_report',
            action: 'created',
            resourceId: 'test_id',
            timeMs: 123,
            report: report,
        });
        expect(result).toMatchSnapshot();
    });

    it('should consistently format studio comId request notifications', () => {
        const request: StudioComIdRequest = {
            id: 'test_id',
            createdAtMs: 123,
            updatedAtMs: 123,
            requestedComId: 'test_comId',
            requestingIpAddress: '127.0.0.1',
            studioId: 'test_studioId',
            userId: 'test_userId',
        };

        const result = formatNotificationAsString({
            resource: 'studio_com_id_request',
            action: 'created',
            resourceId: 'test_id',
            timeMs: 123,
            request: request,
        });
        expect(result).toMatchSnapshot();
    });

    it('should consistently format file scan notifications', () => {
        const result = formatNotificationAsString({
            resource: 'file',
            action: 'scanned',
            resourceId: 'fileName.txt',
            recordName: 'test_record',
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
            message: 'A file was scanned',
            resultId: 'test_result_id',
            timeMs: 123,
            bannedLabel: {
                name: 'label1',
                confidence: 0.5,
            },
        });
        expect(result).toMatchSnapshot();
    });

    it('should consistently format unknown notifications', () => {
        const result = formatNotificationAsString({
            resource: 'random_request',
            action: 'created',
            resourceId: 'test_id',
            timeMs: 123,
        } as any);
        expect(result).toMatchSnapshot();
    });
});
