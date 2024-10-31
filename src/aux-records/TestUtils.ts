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
import { parseSessionKey } from './AuthUtils';
import { PrivoConfiguration } from './PrivoConfiguration';
import {
    buildSubscriptionConfig,
    SubscriptionConfigBuilder,
} from './SubscriptionConfigBuilder';
import { XpController } from 'XpController';

export type TestServices = ReturnType<typeof createTestControllers>;

export function createTestSubConfiguration(
    build: (config: SubscriptionConfigBuilder) => SubscriptionConfigBuilder = (
        config
    ) => config
): SubscriptionConfiguration {
    return buildSubscriptionConfig((config) =>
        build(
            config
                .withCancelUrl('http://cancel-url')
                .withReturnUrl('http://return-url')
                .withSuccessUrl('http://success-url')
                .withWebhookSecret('webhook-secret')
        )
    );
}

export function createTestPrivoConfiguration(): PrivoConfiguration {
    return {
        gatewayEndpoint: 'endpoint',
        featureIds: {
            adultPrivoSSO: 'adultAccount',
            childPrivoSSO: 'childAccount',
            joinAndCollaborate: 'joinAndCollaborate',
            publishProjects: 'publish',
            projectDevelopment: 'dev',
            buildAIEggs: 'buildaieggs',
        },
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        publicEndpoint: 'publicEndpoint',
        roleIds: {
            child: 'childRole',
            adult: 'adultRole',
            parent: 'parentRole',
        },
        clientTokenScopes: 'scope1 scope2',
        userTokenScopes: 'scope1 scope2',
        // verificationIntegration: 'verificationIntegration',
        // verificationServiceId: 'verificationServiceId',
        // verificationSiteId: 'verificationSiteId',
        redirectUri: 'redirectUri',
        ageOfConsent: 18,
    };
}

export function createTestControllers(
    config?: SubscriptionConfiguration | null
) {
    const subConfig: SubscriptionConfiguration | null =
        typeof config === 'undefined' ? createTestSubConfiguration() : null;

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
        messenger: store,
    });
    const policies = new PolicyController(auth, records, store);
    const xpController = new XpController({
        authController: auth,
        authStore: store,
        xpStore: store,
    });

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
        xpController,
    };
}

export async function createTestUser(
    { auth, authMessenger }: Pick<TestServices, 'auth' | 'authMessenger'>,
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

    if (loginResult.success === false) {
        throw new Error('Unable to login: ' + loginResult.errorMessage);
    }

    const userId = loginResult.userId;
    const sessionKey = loginResult.sessionKey;
    const connectionKey = loginResult.connectionKey;

    const [_, sessionId] = parseSessionKey(sessionKey);

    return {
        emailAddress,
        userId,
        sessionKey,
        connectionKey,
        sessionId,
    };
}

export async function createTestXpUser(
    xpController: XpController,
    ...createTestUserParams: Parameters<typeof createTestUser>
) {
    const authUser = await createTestUser(...createTestUserParams);
    const xpUser = await xpController.getXpUser({ userId: authUser.userId });
    if (!xpUser.success) {
        throw new Error('Unable to create xp user!');
    }
    return xpUser.user;
}

export async function createTestRecordKey(
    { records }: Pick<TestServices, 'records'>,
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

/**
 * Unwinds the given async iterator and returns the resulting value from it.
 * @param iterator The iterator that should be unwound.
 */
export async function unwindAsync<T>(
    iterator: AsyncIterator<any, T, any>
): Promise<T> {
    while (true) {
        let { done, value } = await iterator.next();
        if (done) {
            return value;
        }
    }
}

/**
 * Unwinds the given async iterator and returns the resulting value from it.
 * @param iterator The iterator that should be unwound.
 */
export async function unwindAndCaptureAsync<T, TReturn>(
    iterator: AsyncIterator<T, TReturn, any>
): Promise<{
    result: TReturn;
    states: T[];
}> {
    let states = [] as T[];
    while (true) {
        let { done, value } = await iterator.next();
        if (done) {
            return {
                result: value as TReturn,
                states,
            };
        } else {
            states.push(value as T);
        }
    }
}

/**
 * Creates an async iterator that will return the given states in order.
 * @param states The states that should be returned.
 * @param ret The value that should be returned when the iterator is done.
 */
export function asyncIterator<T, TReturn = any>(
    states: Promise<T>[],
    ret?: TReturn
): AsyncIterator<T, TReturn, any> {
    let i = 0;
    return {
        next: async () => {
            if (i >= states.length) {
                return { done: true, value: ret };
            } else {
                return { done: false, value: await states[i++] };
            }
        },
    };
}

export async function* asyncIterable<T>(
    states: Promise<T>[]
): AsyncGenerator<T> {
    for (let state of states) {
        yield state;
    }
}

export function readableFromAsyncIterable<T>(
    iterator: AsyncIterable<T>
): ReadableStream {
    return new ReadableStream({
        async start(controller) {
            for await (let value of iterator) {
                controller.enqueue(value);
            }
            controller.close();
        },
    });
}
