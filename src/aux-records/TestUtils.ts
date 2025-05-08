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
import { AuthController } from './AuthController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { PolicyController } from './PolicyController';
import { RecordsController } from './RecordsController';
import type { PublicRecordKeyPolicy } from './RecordsStore';
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';
import { parseSessionKey } from './AuthUtils';
import type { PrivoConfiguration } from './PrivoConfiguration';
import type { SubscriptionConfigBuilder } from './SubscriptionConfigBuilder';
import { buildSubscriptionConfig } from './SubscriptionConfigBuilder';
import {
    MemoryPackageRecordsStore,
    PackageRecordsController,
} from './packages';
import {
    MemoryPackageVersionRecordsStore,
    PackageVersionRecordsController,
} from './packages/version';
import { FileRecordsController } from './FileRecordsController';

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
        privo: null,
    });
    const packagesStore = new MemoryPackageRecordsStore(store);
    const packageVersionStore = new MemoryPackageVersionRecordsStore(
        store,
        packagesStore
    );
    const policies = new PolicyController(
        auth,
        records,
        store,
        store,
        packageVersionStore
    );
    const files = new FileRecordsController({
        config: store,
        metrics: store,
        store: store,
        policies,
    });

    const packages = new PackageRecordsController({
        config: store,
        policies,
        store: packagesStore,
    });
    const packageVersions = new PackageVersionRecordsController({
        config: store,
        policies,
        packages,
        files,
        systemNotifications: store,
        recordItemStore: packagesStore,
        store: packageVersionStore,
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
        files,
        packagesStore,
        packages,
        packageVersionStore,
        packageVersions,
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
