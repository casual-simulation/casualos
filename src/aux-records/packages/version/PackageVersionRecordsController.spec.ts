import {
    setupTestContext,
    TestControllers,
    testCrudRecordsController,
} from '../../crud/CrudRecordsControllerTests';
import { PackageVersionRecordsController } from './PackageVersionRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../../SubscriptionConfigBuilder';
import { MemoryStore } from '../../MemoryStore';
import { RecordsController } from '../../RecordsController';
import { PolicyController } from '../../PolicyController';
import {
    action,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { v5 as uuidv5 } from 'uuid';
import {
    PackageRecordVersion,
    PackageVersionRecordsStore,
} from './PackageVersionRecordsStore';
import { MemoryPackageVersionRecordsStore } from './MemoryPackageVersionRecordsStore';

console.log = jest.fn();
console.error = jest.fn();

describe('PackageVersionRecordsController', () => {
    testCrudRecordsController<
        PackageRecordVersion,
        PackageVersionRecordsStore,
        PackageVersionRecordsController
    >(
        false,
        'package',
        (services) => new MemoryPackageVersionRecordsStore(services.store),
        (config, services) =>
            new PackageVersionRecordsController({
                ...config,
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            version: {
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
            scriptSha256: '',
            sha256: '',
            sizeInBytes: 0,
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) =>
                    features.withAllDefaultFeatures().withNotifications()
            );

            context.store.subscriptionConfiguration = builder.config;
        }
    );

    let store: MemoryStore;
    let itemsStore: MemoryPackageVersionRecordsStore;
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
            PackageRecordVersion,
            PackageVersionRecordsStore,
            PackageVersionRecordsController
        >(
            (services) => new MemoryPackageVersionRecordsStore(services.store),
            (config, services) => {
                return new PackageVersionRecordsController({
                    ...config,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryPackageVersionRecordsStore;
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

    // describe('recordItem()', () => {
    //     describe('create', () => {
    //         it('should return subscription_limit_reached when the user has reached limit of packages', async () => {
    //             store.subscriptionConfiguration = buildSubscriptionConfig(
    //                 (config) =>
    //                     config.addSubscription('sub1', (sub) =>
    //                         sub
    //                             .withTier('tier1')
    //                             .withAllDefaultFeatures()
    //                             .withPackages()
    //                             .withPackagesMaxItems(1)
    //                     )
    //             );

    //             const user = await store.findUser(userId);
    //             await store.saveUser({
    //                 ...user,
    //                 subscriptionId: 'sub1',
    //                 subscriptionStatus: 'active',
    //             });

    //             await itemsStore.createItem(recordName, {
    //                 address: 'item1',
    //                 markers: [PUBLIC_READ_MARKER],
    //             });

    //             const result = await manager.recordItem({
    //                 recordKeyOrRecordName: recordName,
    //                 item: {
    //                     address: 'item2',
    //                     markers: [PUBLIC_READ_MARKER],
    //                 },
    //                 userId,
    //                 instances: [],
    //             });

    //             expect(result).toEqual({
    //                 success: false,
    //                 errorCode: 'subscription_limit_reached',
    //                 errorMessage:
    //                     'The maximum number of package items has been reached for your subscription.',
    //             });
    //         });
    //     });
    // });
});
