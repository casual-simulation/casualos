import {
    setupTestContext,
    TestControllers,
    testCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsControllerTests';
import {
    PackageRecordVersionInput,
    PackageVersionRecordsController,
} from './PackageVersionRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../../SubscriptionConfigBuilder';
import { MemoryStore } from '../../MemoryStore';
import { RecordsController } from '../../RecordsController';
import { PolicyController } from '../../PolicyController';
import {
    action,
    BotsState,
    createBot,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    StoredAux,
} from '@casual-simulation/aux-common';
import { v5 as uuidv5 } from 'uuid';
import {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageVersionRecordsStore,
} from './PackageVersionRecordsStore';
import { MemoryPackageVersionRecordsStore } from './MemoryPackageVersionRecordsStore';
import { MemoryPackageRecordsStore } from '../MemoryPackageRecordsStore';
import { PackageRecordsStore } from '../PackageRecordsStore';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import { getHash } from '@casual-simulation/crypto/HashHelpers';

console.log = jest.fn();
console.error = jest.fn();

describe('PackageVersionRecordsController', () => {
    testCrudRecordsController<
        PackageRecordVersionKey,
        PackageRecordVersionInput,
        PackageVersionRecordsStore,
        PackageRecordsStore,
        PackageVersionRecordsController
    >(
        false,
        'package.version',
        (services) => new MemoryPackageRecordsStore(services.store),
        (services, packageStore) =>
            new MemoryPackageVersionRecordsStore(services.store, packageStore),
        (config, services) =>
            new PackageVersionRecordsController({
                ...config,
            }),
        (id) => ({
            // Lower IDs map to higher versions (up to 100)
            major: Math.abs(id - 100),
            minor: 0,
            patch: 0,
            tag: '',
        }),
        (item) => ({
            key: item.key,
            address: item.address,
            aux: {
                version: 1,
                state: {},
            },
            auxSha256: getHash({
                version: 1,
                state: {},
            }),
            createdAtMs: 0,
            entitlements: [],
            readme: '',
            sizeInBytes: 0,
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) =>
                    features.withAllDefaultFeatures().withNotifications()
            );

            context.store.subscriptionConfiguration = builder.config;
        },
        ['create', 'read', 'delete', 'list']
    );

    let store: MemoryStore;
    let itemsStore: MemoryPackageVersionRecordsStore;
    let recordItemsStore: MemoryPackageRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: PackageVersionRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;

    let userId: string;
    let sessionKey: string;
    let connectionKey: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        // require('axios').__reset();
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();

        dateNowMock.mockReturnValue(999);

        const context = await setupTestContext<
            PackageRecordVersionKey,
            PackageRecordVersionInput,
            PackageVersionRecordsStore,
            PackageRecordsStore,
            PackageVersionRecordsController
        >(
            (services) => new MemoryPackageRecordsStore(services.store),
            (services, packageStore) =>
                new MemoryPackageVersionRecordsStore(
                    services.store,
                    packageStore
                ),
            (config, services) => {
                return new PackageVersionRecordsController({
                    ...config,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryPackageVersionRecordsStore;
        recordItemsStore =
            context.recordItemsStore as MemoryPackageRecordsStore;
        records = context.services.records;
        policies = context.services.policies;
        manager = context.manager;
        key = context.key;
        subjectlessKey = context.subjectlessKey;
        userId = context.userId;
        otherUserId = context.otherUserId;
        sessionKey = context.sessionKey;
        connectionKey = context.connectionKey;
        recordName = context.recordName;

        const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
            (features) => features.withAllDefaultFeatures().withNotifications()
        );

        store.subscriptionConfiguration = builder.config;
    });

    afterEach(() => {
        Date.now = realDateNow;
    });

    // function setResponse(response: any) {
    //     require('axios').__setResponse(response);
    // }

    // function setNextResponse(response: any) {
    //     require('axios').__setNextResponse(response);
    // }

    // function getLastPost() {
    //     return require('axios').__getLastPost();
    // }

    // function getLastGet() {
    //     return require('axios').__getLastGet();
    // }

    // function getLastDelete() {
    //     return require('axios').__getLastDelete();
    // }

    // function getRequests() {
    //     return require('axios').__getRequests();
    // }

    // interface TestSubscription {
    //     id: string;
    //     userId: string | null;
    //     recordName: string;
    //     notificationAddress: string;
    //     pushSubscription: {
    //         endpoint: string;
    //         keys: any;
    //     };
    //     active?: boolean;
    // }

    // async function saveTestSubscription(sub: TestSubscription) {
    //     const pushSubId = uuidv5(
    //         sub.pushSubscription.endpoint,
    //         SUBSCRIPTION_ID_NAMESPACE
    //     );
    //     await itemsStore.savePushSubscription({
    //         id: pushSubId,
    //         active: sub.active ?? true,
    //         endpoint: sub.pushSubscription.endpoint,
    //         keys: sub.pushSubscription.keys,
    //     });
    //     if (sub.userId) {
    //         await itemsStore.savePushSubscriptionUser({
    //             userId: sub.userId,
    //             pushSubscriptionId: pushSubId,
    //         });
    //     }
    //     await itemsStore.saveSubscription({
    //         id: sub.id,
    //         recordName: sub.recordName,
    //         notificationAddress: sub.notificationAddress,
    //         userId: sub.userId,
    //         pushSubscriptionId: !sub.userId ? pushSubId : null,
    //     });
    // }

    describe('recordItem()', () => {
        describe('create', () => {
            it('should record the current time, and sha256 hash for the package', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                await recordItemsStore.createItem(recordName, {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        aux,
                        auxSha256: getHash(aux),
                        entitlements: [],
                        readme: 'def',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address',
                });

                const item = await itemsStore.getItemByKey(
                    recordName,
                    'address',
                    {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    }
                );

                expect(!!item.item).toBe(true);

                const {
                    sha256,
                    aux: a2,
                    address,
                    key,
                    ...hashedProperties
                } = item.item as PackageRecordVersion;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(getHash(hashedProperties)).toBe(sha256);
            });

            it('should return subscription_limit_reached when the user has reached limit of package versions', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withPackages()
                                .withPackagesMaxVersions(1)
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await recordItemsStore.createItem(recordName, {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
                await itemsStore.createItem(recordName, {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    aux: {
                        version: 1,
                        state: {},
                    },
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                });

                const aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address',
                        key: {
                            major: 2,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        aux,
                        auxSha256: getHash(aux),
                        entitlements: [],
                        readme: 'def',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of package versions has been reached for your subscription.',
                });
            });

            it('should return invalid_request when the aux hash doesnt match the state', async () => {
                dateNowMock.mockReturnValue(123);

                await recordItemsStore.createItem(recordName, {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });

                let aux: StoredAux = {
                    version: 1,
                    state: {
                        test: createBot('test', {
                            test: true,
                        }),
                    },
                };

                let data: PackageRecordVersionInput = {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    aux,
                    auxSha256: 'wrong',
                    entitlements: [],
                    readme: '',
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: data,
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'The aux hash does not match the aux.',
                });
            });
        });

        describe('update()', () => {
            beforeEach(async () => {
                await recordItemsStore.createItem(recordName, {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
                await itemsStore.createItem(recordName, {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    aux: {
                        version: 1,
                        state: {},
                    },
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                });
            });

            it('should return not_supported when trying to update a package version', async () => {
                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        aux: {
                            version: 1,
                            state: {},
                        },
                        auxSha256: 'abc',
                        entitlements: [],
                        readme: 'def',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_supported',
                    errorMessage: 'Updating package versions is not supported.',
                });
                expect(
                    await itemsStore.getItemByKey(recordName, 'address', {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    })
                ).toMatchObject({
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        aux: {
                            version: 1,
                            state: {},
                        },
                        auxSha256: '',
                        createdAtMs: 0,
                        entitlements: [],
                        readme: '',
                        sha256: '',
                        sizeInBytes: 0,
                    },
                    markers: [PUBLIC_READ_MARKER],
                });
            });
        });
    });

    describe('getItem()', () => {});
});

function getSizeInBytes(item: any): number {
    const json = stringify(item);
    return Buffer.byteLength(json as string, 'utf8');
}
