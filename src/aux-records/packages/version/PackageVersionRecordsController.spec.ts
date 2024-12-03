import {
    setupTestContext,
    TestControllers,
    testCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsControllerTests';
import {
    entitlementRequiresApproval,
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
    Entitlement,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    StoredAux,
} from '@casual-simulation/aux-common';
import { v5 as uuidv5 } from 'uuid';
import {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionWithMetadata,
    PackageVersionRecordsStore,
} from './PackageVersionRecordsStore';
import { MemoryPackageVersionRecordsStore } from './MemoryPackageVersionRecordsStore';
import { MemoryPackageRecordsStore } from '../MemoryPackageRecordsStore';
import { PackageRecordsStore } from '../PackageRecordsStore';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import { getHash } from '@casual-simulation/crypto/HashHelpers';
import { FileRecordsController } from '../../FileRecordsController';
import { v4 as uuid } from 'uuid';
import { UserRole } from '../../AuthStore';

console.log = jest.fn();
console.error = jest.fn();

describe('PackageVersionRecordsController', () => {
    testCrudRecordsController<
        PackageRecordVersionKey,
        PackageRecordVersion,
        PackageVersionRecordsStore,
        PackageRecordsStore,
        any
    >(
        false,
        'package.version',
        (services) => new MemoryPackageRecordsStore(services.store),
        (services, packageStore) =>
            new MemoryPackageVersionRecordsStore(services.store, packageStore),
        (config, services) =>
            new PackageVersionRecordsController({
                ...config,
                files: new FileRecordsController({
                    config: services.configStore,
                    metrics: services.store,
                    policies: services.policies,
                    store: services.store,
                }),
                systemNotifications: services.store,
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
            auxFileName: 'aux.json',
            sha256: '',
            auxSha256: getHash({
                version: 1,
                state: {},
            }),
            createdAtMs: 0,
            entitlements: [],
            readme: '',
            sizeInBytes: 0,
            createdFile: true,
            requiresReview: false,
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) => features.withAllDefaultFeatures().withPackages()
            );

            context.store.subscriptionConfiguration = builder.config;

            await context.store.addFileRecord(
                recordName,
                'aux.json',
                null,
                null,
                123,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await context.store.setFileRecordAsUploaded(recordName, 'aux.json');
        },
        ['read', 'delete', 'list']
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
            PackageRecordVersion,
            PackageVersionRecordsStore,
            PackageRecordsStore,
            any
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
                    files: new FileRecordsController({
                        config: services.configStore,
                        metrics: services.store,
                        policies: services.policies,
                        store: services.store,
                    }),
                    systemNotifications: services.store,
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
            beforeEach(async () => {
                await recordItemsStore.createItem(recordName, {
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should record the current time, and sha256 hash for the package', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
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
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PUBLIC_READ_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
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
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should require review on items that have special entitlements', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [
                            {
                                feature: 'data',
                                scope: 'shared',
                            },
                        ],
                        readme: 'def',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PUBLIC_READ_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
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
                expect(item.item?.requiresReview).toBe(true);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should store if the package version is uploading a new file', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };
                const fileName = `${getHash(aux)}.json`;
                await store.addFileRecord(
                    recordName,
                    fileName,
                    null,
                    null,
                    123,
                    'description',
                    [PUBLIC_READ_MARKER]
                );

                await store.setFileRecordAsUploaded(recordName, fileName);

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
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
                    auxFileResult: {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: expect.any(String),
                        existingFileName: fileName,
                        existingFileUrl: expect.any(String),
                    },
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

                expect(item.item!.createdFile).toBe(false);
                expect(!!item.item).toBe(true);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should be able to upload files even if the user doesnt have access to upload files', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'user',
                    otherUserId,
                    'package.version',
                    PUBLIC_READ_MARKER,
                    'create',
                    {},
                    null
                );

                // const fileName = `${getHash(aux)}.json`;
                // await store.addFileRecord(recordName, fileName, null, null, 123, 'description', [PUBLIC_READ_MARKER]);

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    userId: otherUserId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PUBLIC_READ_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
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

                expect(item.item!.createdFile).toBe(true);
                expect(!!item.item).toBe(true);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approvalType,
                    approved,
                    requiresReview,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should reject the request if the file already exists and the user doesnt have the ability to upload it', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'user',
                    otherUserId,
                    'package.version',
                    PUBLIC_READ_MARKER,
                    'create',
                    {},
                    null
                );

                const fileName = `${getHash(aux)}.json`;
                await store.addFileRecord(
                    recordName,
                    fileName,
                    userId,
                    userId,
                    123,
                    'description',
                    [PRIVATE_MARKER]
                );

                await store.setFileRecordAsUploaded(recordName, fileName);

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    userId: otherUserId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'create',
                        resourceKind: 'file',
                        resourceId: fileName,
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
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

                expect(item.item).toBe(null);
            });

            it('should return data_not_found if the record item doesnt exist', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };
                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId,
                    item: {
                        address: 'missing',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'data_not_found',
                    errorMessage: expect.any(String),
                });
            });

            it('should reject the request if given an invalid key', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };
                const result = await manager.recordItem({
                    recordKeyOrRecordName: 'not_a_key',
                    userId,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'record_not_found',
                    errorMessage: expect.any(String),
                });

                await expect(
                    itemsStore.getItemByKey(recordName, 'address', {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    })
                ).resolves.toMatchObject({
                    item: null,
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if record keys are not allowed', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };
                const result = await manager.recordItem({
                    recordKeyOrRecordName: key,
                    userId: otherUserId,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'create',
                        resourceKind: 'package.version',
                        resourceId: 'address',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });

                await expect(
                    itemsStore.getItemByKey(recordName, 'address', {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    })
                ).resolves.toMatchObject({
                    item: null,
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should reject the request if subjectless keys are not allowed', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };
                const result = await manager.recordItem({
                    recordKeyOrRecordName: subjectlessKey,
                    userId: otherUserId,
                    item: {
                        address: 'address',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        readme: 'def',
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'create',
                        resourceKind: 'package.version',
                        resourceId: 'address',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });

                await expect(
                    itemsStore.getItemByKey(recordName, 'address', {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    })
                ).resolves.toMatchObject({
                    item: null,
                    markers: [PUBLIC_READ_MARKER],
                });
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

                await itemsStore.createItem(recordName, {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                    createdFile: true,
                    requiresReview: false,
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
                        auxFileRequest: {
                            fileByteLength: 123,
                            fileSha256Hex: getHash(aux),
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
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

            it('should send a system notification when a record version is published', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

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
                        auxFileRequest: {
                            fileSha256Hex: getHash(aux),
                            fileByteLength: 123,
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
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
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PUBLIC_READ_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
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
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);

                expect(store.recordsNotifications).toEqual([
                    {
                        resource: 'package_version_publish',
                        action: 'created',
                        recordName,
                        resourceId: 'address',
                        timeMs: 123,
                        package: {
                            address: 'address',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            readme: 'def',
                            requiresReview: false,
                            sha256: expect.any(String),
                            auxFileName: expect.any(String),
                            auxSha256: expect.any(String),
                            createdAtMs: 123,
                            createdFile: true,
                            sizeInBytes: 123,
                        },
                    },
                ]);
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
                    auxFileName: 'aux.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                    createdFile: true,
                    requiresReview: false,
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
                        auxFileRequest: {
                            fileByteLength: 123,
                            fileSha256Hex: getHash(''),
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
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
                        auxFileName: 'aux.json',
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

    describe('getItem()', () => {
        beforeEach(async () => {
            await recordItemsStore.createItem(recordName, {
                address: 'address',
                markers: [PUBLIC_READ_MARKER],
            });
            await store.addFileRecord(
                recordName,
                'aux.json',
                null,
                null,
                123,
                'description',
                [PUBLIC_READ_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'aux.json');
            await itemsStore.createItem(recordName, {
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [],
                readme: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
            });
        });

        it('should return not_authorized if the file was not created by the package version and the user is not authorized to read the file', async () => {
            await store.addFileRecord(
                recordName,
                'aux2.json',
                null,
                null,
                123,
                'description',
                [PRIVATE_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'aux2.json');
            await itemsStore.createItem(recordName, {
                address: 'address',
                key: {
                    major: 1,
                    minor: 1,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux2.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [],
                readme: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: false,
                requiresReview: false,
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 1,
                    patch: 0,
                    tag: '',
                },
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 1,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux2.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 123,
                    approved: true,
                    approvalType: 'normal',
                    createdFile: false,
                    requiresReview: false,
                },
                auxFile: {
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'read',
                        resourceKind: 'file',
                        resourceId: 'aux2.json',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                },
            });
        });

        it('should return a link to the file if it was created by the package version', async () => {
            await store.addFileRecord(
                recordName,
                'aux2.json',
                null,
                null,
                123,
                'description',
                [PRIVATE_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'aux2.json');
            await itemsStore.createItem(recordName, {
                address: 'address',
                key: {
                    major: 1,
                    minor: 1,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux2.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [],
                readme: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 1,
                    patch: 0,
                    tag: '',
                },
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 1,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux2.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 123,
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                },
                auxFile: {
                    success: true,
                    requestHeaders: {
                        'record-name': recordName,
                    },
                    requestMethod: 'GET',
                    requestUrl: expect.any(String),
                },
            });
        });

        it('should mark the item as approved if it has no entitlements', async () => {
            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 123,
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                },
                auxFile: {
                    success: true,
                    requestHeaders: {
                        'record-name': recordName,
                    },
                    requestMethod: 'GET',
                    requestUrl: expect.any(String),
                },
            });
        });

        it('should mark the item as not approved if it has a shared entitlement', async () => {
            await itemsStore.putItem(recordName, {
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [
                    {
                        feature: 'data',
                        scope: 'shared',
                    },
                ],
                readme: '',
                sha256: '',
                sizeInBytes: 0,
                requiresReview: true,
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [
                        {
                            feature: 'data',
                            scope: 'shared',
                        },
                    ],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                    approved: false,
                    approvalType: null,
                    createdFile: true,
                    requiresReview: true,
                },
                auxFile: {
                    success: true,
                    requestHeaders: {
                        'record-name': recordName,
                    },
                    requestMethod: 'GET',
                    requestUrl: expect.any(String),
                },
            });
        });

        it('should mark the item as approved if it has an approved review', async () => {
            await itemsStore.putItem(recordName, {
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [
                    {
                        feature: 'data',
                        scope: 'shared',
                    },
                ],
                readme: '',
                sha256: '',
                sizeInBytes: 0,
                requiresReview: true,
            });

            await itemsStore.putReviewForVersion({
                id: 'reviewId',
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                approved: true,
                approvalType: 'normal',
                reviewComments: '',
                reviewStatus: 'approved',
                reviewingUserId: otherUserId,
                updatedAtMs: 0,
                createdAtMs: 0,
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    major: 1,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                userId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [
                        {
                            feature: 'data',
                            scope: 'shared',
                        },
                    ],
                    readme: '',
                    sha256: '',
                    sizeInBytes: 0,
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: true,
                },
                auxFile: {
                    success: true,
                    requestHeaders: {
                        'record-name': recordName,
                    },
                    requestMethod: 'GET',
                    requestUrl: expect.any(String),
                },
            });
        });
    });

    describe('reviewItem()', () => {
        const roleCases: [UserRole][] = [
            ['moderator'],
            ['superUser'],
            ['system'],
        ];

        it.each(roleCases)(
            'should save the given review if the user is a %s',
            async (role) => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role,
                });

                const result = await manager.reviewItem({
                    recordName,
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    review: {
                        approved: true,
                        approvalType: 'normal',
                        reviewComments: 'good',
                        reviewStatus: 'approved',
                    },
                    userId,
                });

                expect(result).toEqual({
                    success: true,
                });

                expect(
                    await itemsStore.getMostRecentPackageVersionReview(
                        recordName,
                        'address',
                        {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        }
                    )
                ).toEqual({
                    id: expect.any(String),
                    recordName,
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    approved: true,
                    approvalType: 'normal',
                    reviewComments: 'good',
                    reviewStatus: 'approved',
                    reviewingUserId: userId,
                    createdAtMs: 999,
                    updatedAtMs: 999,
                });
            }
        );
    });
});

describe('entitlementRequiresApproval()', () => {
    const cases: [boolean, Entitlement['scope']][] = [
        [false, 'personal'],
        [false, 'owned'],
        [false, 'studio'],
        [true, 'designated'],
        [true, 'shared'],
    ];

    const features: [Entitlement['feature']][] = [
        ['data'],
        ['event'],
        ['file'],
        ['inst'],
        ['notification'],
        ['package'],
        ['permissions'],
        ['webhooks'],
    ];

    describe.each(features)('%s', (feature) => {
        it.each(cases)('should return %s when given %s', (expected, scope) => {
            expect(
                entitlementRequiresApproval({
                    feature,
                    scope,
                })
            ).toBe;
        });
    });
});

function getSizeInBytes(item: any): number {
    const json = stringify(item);
    return Buffer.byteLength(json as string, 'utf8');
}
