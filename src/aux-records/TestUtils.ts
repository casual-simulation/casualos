import { AuthController } from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { PolicyController } from './PolicyController';
import { RecordsController } from './RecordsController';
import { PublicRecordKeyPolicy } from './RecordsStore';
import {
    SubscriptionConfiguration,
    allowAllFeatures,
} from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';

export type TestServices = ReturnType<typeof createTestControllers>;

export function createTestSubConfiguration(): SubscriptionConfiguration {
    return {
        cancelUrl: 'cancel-url',
        returnUrl: 'return-url',
        successUrl: 'success-url',
        webhookSecret: 'webhook-secret',
        subscriptions: [],
        tiers: {},
        defaultFeatures: {
            studio: allowAllFeatures(),
            user: allowAllFeatures(),
        },
    };
}

export function createTestControllers(config?: SubscriptionConfiguration) {
    const subConfig: SubscriptionConfiguration =
        config ?? createTestSubConfiguration();

    const store = new MemoryStore({
        subscriptions: subConfig,
    });
    const authMessenger = new MemoryAuthMessenger();
    const auth = new AuthController(store, authMessenger, store, true);
    const records = new RecordsController({
        store: store,
        auth: store,
        config: store,
        metrics: store,
    });
    const policies = new PolicyController(auth, records, store);

    return {
        store,
        authStore: store,
        authMessenger,
        auth,
        recordsStore: store,
        records,
        policyStore: store,
        policies,
        configStore: store,
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
