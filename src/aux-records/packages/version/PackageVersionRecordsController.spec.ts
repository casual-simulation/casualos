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

import type { TestControllers } from '../../crud/sub/SubCrudRecordsControllerTests';
import {
    setupTestContext,
    testCrudRecordsController,
} from '../../crud/sub/SubCrudRecordsControllerTests';
import {
    entitlementRequiresApproval,
    PackageVersionRecordsController,
} from './PackageVersionRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../../SubscriptionConfigBuilder';
import type { MemoryStore } from '../../MemoryStore';
import type { RecordsController } from '../../RecordsController';
import type { PolicyController } from '../../PolicyController';
import type { Entitlement, StoredAux } from '@casual-simulation/aux-common';
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import type {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionWithMetadata,
    PackageVersionRecordsStore,
} from './PackageVersionRecordsStore';
import { MemoryPackageVersionRecordsStore } from './MemoryPackageVersionRecordsStore';
import { MemoryPackageRecordsStore } from '../MemoryPackageRecordsStore';
import type { PackageRecordsStore } from '../PackageRecordsStore';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import { getHash } from '@casual-simulation/crypto/HashHelpers';
import { FileRecordsController } from '../../FileRecordsController';
import type { UserRole } from '../../AuthStore';
import { PackageRecordsController } from '../PackageRecordsController';

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
                packages: new PackageRecordsController({
                    config: services.configStore,
                    policies: services.policies,
                    store: config.recordItemStore,
                }),
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
            id: `${item.address}@${item.key.major}.${item.key.minor}.${item.key.patch}.${item.key.tag}`,
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
            description: '',
            sizeInBytes: 0,
            createdFile: true,
            requiresReview: false,
            markers: [PUBLIC_READ_MARKER],
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
                    packages: new PackageRecordsController({
                        config: services.configStore,
                        policies: services.policies,
                        store: config.recordItemStore,
                    }),
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
                    id: 'address',
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        markers: [PRIVATE_MARKER],
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
                    id,
                    markers,
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        markers: [PRIVATE_MARKER],
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
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should store whether the package version is uploading a new file', async () => {
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                    id,
                    markers,
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        markers: [PRIVATE_MARKER],
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
                    id,
                    markers,
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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

            it('should be able to upload the file as the system if the file hasnt been uploaded yet and the markers match the default system markers', async () => {
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

                // await store.assignPermissionToSubjectAndMarker(
                //     recordName,
                //     'user',
                //     otherUserId,
                //     'file',
                //     PUBLIC_READ_MARKER,
                //     'create',
                //     {},
                //     null
                // );

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

                // file is not uploaded yet

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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        markers: [PRIVATE_MARKER],
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
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should return not_authorized if the file hasnt been uploaded yet and the markers dont match the default system markers and the user doesnt have access', async () => {
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

                // await store.assignPermissionToSubjectAndMarker(
                //     recordName,
                //     'user',
                //     otherUserId,
                //     'file',
                //     PUBLIC_READ_MARKER,
                //     'create',
                //     {},
                //     null
                // );

                const fileName = `${getHash(aux)}.json`;
                await store.addFileRecord(
                    recordName,
                    fileName,
                    userId,
                    userId,
                    123,
                    'description',
                    ['custom']
                );

                // file is not uploaded yet

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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    userId: otherUserId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        resourceKind: 'file',
                        action: 'create',
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

            it.skip('should return data_not_found if the record item doesnt exist', async () => {
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                    parentMarkers: [PUBLIC_READ_MARKER],
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                    parentMarkers: [PUBLIC_READ_MARKER],
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                    parentMarkers: [PUBLIC_READ_MARKER],
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 0,
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        markers: [PRIVATE_MARKER],
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
                    id,
                    markers,
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
                        markers: [PUBLIC_READ_MARKER],
                        package: {
                            id: expect.any(String),
                            address: 'address',
                            key: {
                                major: 1,
                                minor: 0,
                                patch: 0,
                                tag: '',
                            },
                            entitlements: [],
                            description: 'def',
                            requiresReview: false,
                            sha256: expect.any(String),
                            auxFileName: expect.any(String),
                            auxSha256: expect.any(String),
                            createdAtMs: 123,
                            createdFile: true,
                            sizeInBytes: 123,
                            markers: [PUBLIC_READ_MARKER],
                        },
                    },
                ]);
            });

            it('should be able to upload a package version even if the package doesnt exist', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address2',
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
                        description: 'def',
                        markers: [PRIVATE_MARKER],
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address2',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                });

                const packageItem = await recordItemsStore.getItemByAddress(
                    recordName,
                    'address2'
                );

                expect(packageItem).toEqual({
                    id: expect.any(String),
                    address: 'address2',

                    // Should use the PRIVATE_MARKER when
                    // the package has to be created from a version.
                    markers: [PRIVATE_MARKER],
                });

                const item = await itemsStore.getItemByKey(
                    recordName,
                    'address2',
                    {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    }
                );

                expect(!!item.item).toBe(true);
                expect(item.parentMarkers).toEqual([PRIVATE_MARKER]);
                expect(item.item!.markers).toEqual([PRIVATE_MARKER]);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should be able to use separate markers for the package version', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address2',
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address2',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                });

                const packageItem = await recordItemsStore.getItemByAddress(
                    recordName,
                    'address2'
                );

                expect(packageItem).toEqual({
                    id: expect.any(String),
                    address: 'address2',

                    // Should use the PRIVATE_MARKER when
                    // the package has to be created from a version.
                    markers: [PRIVATE_MARKER],
                });

                const item = await itemsStore.getItemByKey(
                    recordName,
                    'address2',
                    {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    }
                );

                expect(!!item.item).toBe(true);
                expect(item.parentMarkers).toEqual([PRIVATE_MARKER]);
                expect(item.item!.markers).toEqual([PUBLIC_READ_MARKER]);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should use the private marker for files uploaded by the system', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address2',
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
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address2',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                });

                const packageItem = await recordItemsStore.getItemByAddress(
                    recordName,
                    'address2'
                );

                expect(packageItem).toEqual({
                    id: expect.any(String),
                    address: 'address2',

                    // Should use the PRIVATE_MARKER when
                    // the package has to be created from a version.
                    markers: [PRIVATE_MARKER],
                });

                const item = await itemsStore.getItemByKey(
                    recordName,
                    'address2',
                    {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    }
                );

                expect(!!item.item).toBe(true);
                expect(item.parentMarkers).toEqual([PRIVATE_MARKER]);
                expect(item.item!.markers).toEqual([PUBLIC_READ_MARKER]);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should use the same markers as the package if no markers are provided', async () => {
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
                        description: 'def',
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
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                });

                const packageItem = await recordItemsStore.getItemByAddress(
                    recordName,
                    'address'
                );

                expect(packageItem).toEqual({
                    id: expect.any(String),
                    address: 'address',

                    // Should use the PRIVATE_MARKER when
                    // the package has to be created from a version.
                    markers: [PUBLIC_READ_MARKER],
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
                expect(item.parentMarkers).toEqual([PUBLIC_READ_MARKER]);
                expect(item.item!.markers).toEqual([PUBLIC_READ_MARKER]);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });

            it('should use the default package markers when the package doesnt exist', async () => {
                dateNowMock.mockReturnValue(123);
                let aux: StoredAux = {
                    version: 1,
                    state: {},
                };

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'address2',
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
                        description: 'def',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address2',
                    auxFileResult: {
                        success: true,
                        fileName: `${getHash(aux)}.json`,
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
                });

                const packageItem = await recordItemsStore.getItemByAddress(
                    recordName,
                    'address2'
                );

                expect(packageItem).toEqual({
                    id: expect.any(String),
                    address: 'address2',

                    // Should use the PRIVATE_MARKER when
                    // the package has to be created from a version.
                    markers: [PRIVATE_MARKER],
                });

                const item = await itemsStore.getItemByKey(
                    recordName,
                    'address2',
                    {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    }
                );

                expect(!!item.item).toBe(true);
                expect(item.parentMarkers).toEqual([PRIVATE_MARKER]);
                expect(item.item!.markers).toEqual([PRIVATE_MARKER]);

                const {
                    sha256,
                    address,
                    key,
                    createdFile,
                    approved,
                    approvalType,
                    requiresReview,
                    id,
                    markers,
                    ...hashedProperties
                } = item.item as PackageRecordVersionWithMetadata;
                expect(hashedProperties.createdAtMs).toBe(123);
                expect(
                    getHash({
                        ...hashedProperties,
                    })
                ).toBe(sha256);
            });
        });

        describe('update()', () => {
            beforeEach(async () => {
                await recordItemsStore.createItem(recordName, {
                    id: 'address',
                    address: 'address',
                    markers: [PUBLIC_READ_MARKER],
                });
                await itemsStore.createItem(recordName, {
                    id: 'address@1.0.0',
                    address: 'address',
                    key: {
                        major: 1,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux.json',
                    auxSha256: getHash('aux'),
                    createdAtMs: 0,
                    entitlements: [],
                    description: '',
                    sha256: '',
                    sizeInBytes: 123,
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
                });
            });

            it('should return a successful result with another upload result if the file has not been uploaded and if the aux file matches the saved file', async () => {
                await recordItemsStore.createItem(recordName, {
                    id: 'address2',
                    address: 'address2',
                    markers: [PUBLIC_READ_MARKER],
                });
                const result1 = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId,
                    item: {
                        address: 'address2',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileByteLength: 123,
                            fileDescription: 'description',
                            fileMimeType: 'application/json',
                            fileSha256Hex: getHash('aux'),
                            headers: {},
                        },
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                });

                expect(result1.success).toBe(true);

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    userId: userId,
                    item: {
                        address: 'address2',
                        key: {
                            major: 1,
                            minor: 0,
                            patch: 0,
                            tag: '',
                        },
                        auxFileRequest: {
                            fileByteLength: 123,
                            fileDescription: 'description',
                            fileMimeType: 'application/json',
                            fileSha256Hex: getHash('aux'),
                            headers: {},
                        },
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER],
                    },
                    instances: [],
                });

                expect(result).toEqual({
                    success: true,
                    recordName,
                    address: 'address2',
                    auxFileResult: {
                        success: true,
                        fileName: expect.any(String),
                        markers: [PRIVATE_MARKER],
                        uploadHeaders: {
                            'content-type': 'application/json',
                            'record-name': recordName,
                        },
                        uploadMethod: 'POST',
                        uploadUrl: expect.any(String),
                    },
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
                            fileSha256Hex: getHash('aux'),
                            fileDescription: 'aux.json',
                            fileMimeType: 'application/json',
                            headers: {},
                        },
                        entitlements: [],
                        description: 'def',
                        markers: [PUBLIC_READ_MARKER],
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
                        auxSha256: getHash('aux'),
                        createdAtMs: 0,
                        entitlements: [],
                        description: '',
                        sha256: '',
                        sizeInBytes: 123,
                    },
                    parentMarkers: [PUBLIC_READ_MARKER],
                });
            });

            it('should return not_authorized if trying to assign markers that the user doesnt have ability to', async () => {
                await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'user',
                    otherUserId,
                    'package.version',
                    PUBLIC_READ_MARKER,
                    'update',
                    {},
                    null
                );

                await store.assignPermissionToSubjectAndMarker(
                    recordName,
                    'user',
                    otherUserId,
                    'package.version',
                    'other_marker',
                    'update',
                    {},
                    null
                );

                const result1 = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
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
                            fileByteLength: 123,
                            fileDescription: 'description',
                            fileMimeType: 'application/json',
                            fileSha256Hex: getHash('aux'),
                            headers: {},
                        },
                        entitlements: [],
                        description: '',
                        markers: [PUBLIC_READ_MARKER, 'other_marker'],
                    },
                    instances: [],
                });

                expect(result1).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this action.',
                    reason: {
                        type: 'missing_permission',
                        recordName,
                        action: 'assign',
                        resourceKind: 'marker',
                        resourceId: 'other_marker',
                        subjectType: 'user',
                        subjectId: otherUserId,
                    },
                });
            });
        });
    });

    describe('getItem()', () => {
        beforeEach(async () => {
            await recordItemsStore.createItem(recordName, {
                id: 'address',
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
                id: 'address@1.0.0',
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
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
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
                id: 'address@1.0.0',
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
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: false,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 123,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: false,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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
                id: 'address@1.0.0',
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
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 123,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 123,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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
                description: '',
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 0,
                    packageId: 'address',
                    approved: false,
                    approvalType: null,
                    createdFile: true,
                    requiresReview: true,
                    markers: [PUBLIC_READ_MARKER],
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
                description: '',
                sha256: '',
                sizeInBytes: 0,
                requiresReview: true,
            });

            await itemsStore.putReviewForVersion({
                id: 'reviewId',
                packageVersionId: 'address@1.0.0',
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
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: '',
                    sizeInBytes: 0,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: true,
                    markers: [PUBLIC_READ_MARKER],
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

        it('should be able to get the latest item by omitting the version numbers', async () => {
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
                id: 'address@1.0.0',
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
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
            });

            await store.addFileRecord(
                recordName,
                'aux3.json',
                null,
                null,
                123,
                'description',
                [PRIVATE_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'aux3.json');
            await itemsStore.createItem(recordName, {
                id: 'address@2.0.0',
                address: 'address',
                key: {
                    major: 2,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux3.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [],
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {},
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    id: 'address@2.0.0',
                    address: 'address',
                    key: {
                        major: 2,
                        minor: 0,
                        patch: 0,
                        tag: '',
                    },
                    auxFileName: 'aux3.json',
                    auxSha256: '',
                    createdAtMs: 0,
                    entitlements: [],
                    description: '',
                    sha256: '',
                    sizeInBytes: 123,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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

        it('should be able to get an item by its sha256 hash', async () => {
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
                id: 'address@1.0.0',
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
                description: '',
                sha256: 'hash',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
            });

            await store.addFileRecord(
                recordName,
                'aux3.json',
                null,
                null,
                123,
                'description',
                [PRIVATE_MARKER]
            );
            await store.setFileRecordAsUploaded(recordName, 'aux3.json');
            await itemsStore.createItem(recordName, {
                id: 'address@2.0.0',
                address: 'address',
                key: {
                    major: 2,
                    minor: 0,
                    patch: 0,
                    tag: '',
                },
                auxFileName: 'aux3.json',
                auxSha256: '',
                createdAtMs: 0,
                entitlements: [],
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: false,
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await manager.getItem({
                recordName,
                address: 'address',
                key: {
                    sha256: 'hash',
                },
                userId: otherUserId,
                instances: [],
            });

            expect(result).toEqual({
                success: true,
                item: {
                    id: 'address@1.0.0',
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
                    description: '',
                    sha256: 'hash',
                    sizeInBytes: 123,
                    packageId: 'address',
                    approved: true,
                    approvalType: 'normal',
                    createdFile: true,
                    requiresReview: false,
                    markers: [PUBLIC_READ_MARKER],
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
        beforeEach(async () => {
            await itemsStore.createItem(recordName, {
                id: 'address@1.0.0',
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
                description: '',
                sha256: '',
                sizeInBytes: 123,
                createdFile: true,
                requiresReview: true,
                markers: [PUBLIC_READ_MARKER],
            });
        });

        describe('create', () => {
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
                        packageVersionId: 'address@1.0.0',
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
                        reviewId: expect.any(String),
                    });

                    expect(
                        await itemsStore.getMostRecentPackageVersionReview(
                            'address@1.0.0'
                        )
                    ).toEqual({
                        id: expect.any(String),
                        packageVersionId: 'address@1.0.0',
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

            it('should return not_authorized when the user is a regular user', async () => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role: 'none',
                });

                const result = await manager.reviewItem({
                    packageVersionId: 'address@1.0.0',
                    review: {
                        approved: true,
                        approvalType: 'normal',
                        reviewComments: 'good',
                        reviewStatus: 'approved',
                    },
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                });

                expect(
                    await itemsStore.getMostRecentPackageVersionReview(
                        'address@1.0.0'
                    )
                ).toEqual(null);
            });
        });

        describe('update', () => {
            beforeEach(async () => {
                await itemsStore.putReviewForVersion({
                    id: 'reviewId',
                    packageVersionId: 'address@1.0.0',
                    approved: false,
                    approvalType: 'normal',
                    reviewStatus: 'pending',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    reviewComments: 'bad',
                    reviewingUserId: otherUserId,
                });
            });

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
                        packageVersionId: 'address@1.0.0',
                        review: {
                            id: 'reviewId',
                            approved: true,
                            approvalType: 'normal',
                            reviewComments: 'good',
                            reviewStatus: 'approved',
                        },
                        userId,
                    });

                    expect(result).toEqual({
                        success: true,
                        reviewId: 'reviewId',
                    });

                    expect(
                        await itemsStore.getMostRecentPackageVersionReview(
                            'address@1.0.0'
                        )
                    ).toEqual({
                        id: 'reviewId',
                        packageVersionId: 'address@1.0.0',
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

            it('should return not_authorized when the user is a regular user', async () => {
                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    role: 'none',
                });

                const result = await manager.reviewItem({
                    packageVersionId: 'address@1.0.0',
                    review: {
                        id: 'reviewId',
                        approved: true,
                        approvalType: 'normal',
                        reviewComments: 'good',
                        reviewStatus: 'approved',
                    },
                    userId,
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'not_authorized',
                    errorMessage: expect.any(String),
                });

                expect(
                    await itemsStore.getMostRecentPackageVersionReview(
                        'address@1.0.0'
                    )
                ).toEqual({
                    id: 'reviewId',
                    packageVersionId: 'address@1.0.0',
                    approved: false,
                    approvalType: 'normal',
                    reviewStatus: 'pending',
                    createdAtMs: 123,
                    updatedAtMs: 123,
                    reviewComments: 'bad',
                    reviewingUserId: otherUserId,
                });
            });
        });
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
        ['webhook'],
    ];

    describe.each(features)('%s', (feature) => {
        it.each(cases)('should return %s when given %s', (expected, scope) => {
            expect(
                entitlementRequiresApproval({
                    feature,
                    scope,
                })
            ).toBe(expected);
        });
    });
});

function getSizeInBytes(item: any): number {
    const json = stringify(item);
    return Buffer.byteLength(json as string, 'utf8');
}
