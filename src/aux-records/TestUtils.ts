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
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { MemoryStore } from './MemoryStore';
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
import type { PublicRecordKeyPolicy } from '@casual-simulation/aux-common';
import { mapValuesDeep, parseSessionKey } from '@casual-simulation/aux-common';
import { XpController } from './XpController';
import type { Account, FinancialInterface, Transfer } from './financial';
import { FinancialController, MemoryFinancialInterface } from './financial';

export type TestServices = ReturnType<typeof createTestControllers>;

export function createTestSubConfiguration(
    build: (config: SubscriptionConfigBuilder) => SubscriptionConfigBuilder = (
        config
    ) => config
): SubscriptionConfiguration {
    return buildSubscriptionConfig((config) =>
        build(
            config
                .withCancelUrl('https://cancel-url/')
                .withReturnUrl('https://return-url/')
                .withSuccessUrl('https://success-url/')
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
        typeof config === 'undefined' ? createTestSubConfiguration() : config;

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
    const financialInterface = new MemoryFinancialInterface();
    const financialController = new FinancialController(
        financialInterface,
        store
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
    const xpController = new XpController({
        authController: auth,
        authStore: store,
        xpStore: store,
        financialInterface,
        // financialController,
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
        xpController,
        financialController,
        financialInterface,
    };
}

export interface TestUser {
    emailAddress: string;
    userId: string;
    sessionKey: string;
    connectionKey: string;
    sessionId: string;
}

export async function createTestUser(
    { auth, authMessenger }: Pick<TestServices, 'auth' | 'authMessenger'>,
    emailAddress: string = 'test@example.com'
): Promise<TestUser> {
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

// export async function createTestXpUser(
//     xpController: XpController,
//     ...createTestUserParams: Parameters<typeof createTestUser>
// ) {
//     const authUser = await createTestUser(...createTestUserParams);
//     return await xpController.getXpUser({ userId: authUser.userId });
// }

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

export function mapBigInts(obj: Record<string, any>): Record<string, any> {
    return mapValuesDeep(obj, (value) => {
        if (typeof value === 'bigint') {
            if (value > Number.MAX_SAFE_INTEGER) {
                return Number.MAX_SAFE_INTEGER;
            } else {
                return Number(value);
            }
        }
        return value;
    });
}

export async function checkAccounts(
    financialInterface: FinancialInterface,
    accounts: Partial<Account>[]
) {
    const accountValues = await financialInterface.lookupAccounts(
        accounts.map((a) => a.id)
    );

    expect(mapBigInts(accountValues)).toEqual(
        accounts.map((a) => expect.objectContaining(mapBigInts(a)))
    );

    // for(let i = 0; i < accounts.length; i++) {
    //     const expected = accounts[i];
    //     const actual = accountValues[i];

    //     expect(mapBigInts(actual)).toMatchObject(mapBigInts(expected));
    // }
}

export function checkTransfers(
    actual: Transfer[],
    expected: Partial<Transfer>[]
) {
    expect(mapBigInts(actual)).toEqual(
        expected.map((t) => expect.objectContaining(mapBigInts(t)))
    );

    // for(let i = 0; i < accounts.length; i++) {
    //     const expected = accounts[i];
    //     const actual = accountValues[i];

    //     expect(mapBigInts(actual)).toMatchObject(mapBigInts(expected));
    // }
}
