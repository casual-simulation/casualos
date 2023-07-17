import { AuthController } from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { MemoryAuthStore } from './MemoryAuthStore';
import { MemoryPolicyStore } from './MemoryPolicyStore';
import { MemoryRecordsStore } from './MemoryRecordsStore';
import { PolicyController } from './PolicyController';
import { RecordsController } from './RecordsController';
import { PublicRecordKeyPolicy } from './RecordsStore';
import { SubscriptionConfiguration } from './SubscriptionConfiguration';

export type TestServices = ReturnType<typeof createTestControllers>;

export function createTestControllers(config?: SubscriptionConfiguration) {
    const subConfig = config ?? {
        cancelUrl: 'cancel-url',
        returnUrl: 'return-url',
        successUrl: 'success-url',
        webhookSecret: 'webhook-secret',
        subscriptions: [],
    };

    const authStore = new MemoryAuthStore();
    const authMessenger = new MemoryAuthMessenger();
    const auth = new AuthController(authStore, authMessenger, subConfig, true);
    const recordsStore = new MemoryRecordsStore();
    const records = new RecordsController(recordsStore, authStore);
    const policyStore = new MemoryPolicyStore();
    const policies = new PolicyController(auth, records, policyStore);

    return {
        authStore,
        authMessenger,
        auth,
        recordsStore,
        records,
        policyStore,
        policies,
    };
}

export async function createTestUser(
    { auth, authMessenger, records }: TestServices,
    emailAddress: string = 'test@example.com'
) {
    const loginRequest = await auth.requestLogin({
        address: emailAddress,
        addressType: 'email',
        ipAddress: '123.456.789',
    });

    if (!loginRequest.success) {
        throw new Error('Unable to request login!');
    }

    const code = authMessenger.messages.find((m) => m.address === emailAddress);

    if (!code) {
        throw new Error('Message not found!');
    }

    const loginResult = await auth.completeLogin({
        code: code.code,
        requestId: loginRequest.requestId,
        userId: loginRequest.userId,
        ipAddress: '123.456.789',
    });

    if (!loginResult.success) {
        throw new Error('Unable to login!');
    }

    const userId = loginResult.userId;
    const sessionKey = loginResult.sessionKey;

    return {
        emailAddress,
        userId,
        sessionKey,
    };
}

export async function createTestRecordKey(
    { records }: TestServices,
    userId: string,
    recordName: string = 'testRecord',
    policy: PublicRecordKeyPolicy = 'subjectfull'
) {
    const createRecordKeyResult = await records.createPublicRecordKey(
        recordName,
        policy,
        userId
    );
    if (!createRecordKeyResult.success) {
        throw new Error('Unable to create record key!');
    }

    const recordKey = createRecordKeyResult.recordKey;

    return {
        recordName,
        recordKey,
    };
}
