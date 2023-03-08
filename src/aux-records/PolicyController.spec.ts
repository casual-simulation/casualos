import { AuthController } from './AuthController';
import { AuthMessenger } from './AuthMessenger';
import { AuthStore } from './AuthStore';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { PolicyController } from './PolicyController';
import { DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT } from './PolicyPermissions';
import { RecordsController } from './RecordsController';

describe('PolicyController', () => {
    let authStore: MemoryAuthStore;
    let authMessenger: MemoryAuthMessenger;
    let authController: AuthController;

    let recordsStore: MemoryRecordsStore;
    let recordsController: RecordsController;

    let controller: PolicyController;

    let userId: string;
    let sessionKey: string;
    let recordKey: string;
    let recordName: string;

    beforeEach(async () => {
        authStore = new MemoryAuthStore();
        authMessenger = new MemoryAuthMessenger();
        authController = new AuthController(authStore, authMessenger, true);
        recordsStore = new MemoryRecordsStore();
        recordsController = new RecordsController(recordsStore);

        controller = new PolicyController();

        const loginRequest = await authController.requestLogin({
            address: 'test@example.com',
            addressType: 'email',
            ipAddress: '123.456.789',
        });

        if (!loginRequest.success) {
            throw new Error('Unable to request login!');
        }

        const code = authMessenger.messages.find(
            (m) => m.address === 'test@example.com'
        );

        const loginResult = await authController.completeLogin({
            code: code.code,
            requestId: loginRequest.requestId,
            userId: loginRequest.userId,
            ipAddress: '123.456.789',
        });

        if (!loginResult.success) {
            throw new Error('Unable to login!');
        }

        userId = loginResult.userId;
        sessionKey = loginResult.sessionKey;

        const createRecordKeyResult =
            await recordsController.createPublicRecordKey(
                'testRecord',
                'subjectfull',
                userId
            );
        if (!createRecordKeyResult.success) {
            throw new Error('Unable to create record key!');
        }

        recordName = createRecordKeyResult.recordName;
        recordKey = createRecordKeyResult.recordKey;
    });

    describe('authorizeRequest()', () => {
        describe('data.create', () => {
            it('should allow the request if given a record key', async () => {
                const result = await controller.authorizeRequest({
                    action: 'data.create',
                    address: 'myAddress',
                    recordKey: '',
                    existingResourceMarkers: ['publicRead'],
                });

                expect(result).toEqual({
                    allowed: true,
                    selectedRole: 'admin',
                    selectedPolicy: DEFAULT_ANY_RESOURCE_POLICY_DOCUMENT,
                    subjectPolicy: 'subjectfull',
                });
            });

            // it('should return a result indicating whether the request is allowed or not', async () => {

            // });
        });

        it('should deny the request if given an unrecognized action', async () => {
            const result = await controller.authorizeRequest({
                action: 'missing',
            } as any);

            expect(result).toEqual({
                allowed: false,
                errorCode: 'action_not_supported',
                errorMessage: 'The given action is not supported.',
            });
        });
    });
});
