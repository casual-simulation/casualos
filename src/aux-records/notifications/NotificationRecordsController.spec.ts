import {
    setupTestContext,
    TestControllers,
    testCrudRecordsController,
} from '../crud/CrudRecordsControllerTests';
import { MemoryNotificationRecordsStore } from './MemoryNotificationRecordsStore';
import {
    NotificationRecord,
    NotificationRecordsStore,
} from './NotificationRecordsStore';
import { NotificationRecordsController } from './NotificationRecordsController';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import { MemoryStore } from '../MemoryStore';
import { RecordsController } from '../RecordsController';
import { PolicyController } from '../PolicyController';
import {
    action,
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
} from '@casual-simulation/aux-common';
import { WebPushInterface } from './WebPushInterface';

console.log = jest.fn();
console.error = jest.fn();

describe('NotificationRecordsController', () => {
    testCrudRecordsController<
        NotificationRecord,
        NotificationRecordsStore,
        NotificationRecordsController
    >(
        false,
        'notification',
        (services) => new MemoryNotificationRecordsStore(services.store),
        (config, services) =>
            new NotificationRecordsController({
                ...config,
                pushInterface: {
                    getServerApplicationKey: jest.fn(),
                    sendNotification: jest.fn(),
                },
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            description: 'notification description',
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
    let itemsStore: MemoryNotificationRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: NotificationRecordsController;
    let key: string;
    let subjectlessKey: string;
    let realDateNow: any;
    let dateNowMock: jest.Mock<number>;
    let services: TestControllers;
    let pushInterface: jest.Mocked<WebPushInterface>;

    let userId: string;
    let sessionKey: string;
    let connectionKey: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        require('axios').__reset();
        realDateNow = Date.now;
        dateNowMock = Date.now = jest.fn();

        dateNowMock.mockReturnValue(999);

        // environment = {
        //     handleHttpRequest: jest.fn(),
        // };

        const context = await setupTestContext<
            NotificationRecord,
            NotificationRecordsStore,
            NotificationRecordsController
        >(
            (services) => new MemoryNotificationRecordsStore(services.store),
            (config, services) => {
                pushInterface = {
                    getServerApplicationKey: jest.fn(),
                    sendNotification: jest.fn(),
                };
                return new NotificationRecordsController({
                    ...config,
                    pushInterface,
                });
            }
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryNotificationRecordsStore;
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

    // afterEach(() => {
    //     Date.now = realDateNow;
    // });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getLastDelete() {
        return require('axios').__getLastDelete();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('recordItem()', () => {
        describe('create', () => {
            it('should return subscription_limit_reached when the user has reached limit of notifications', async () => {
                store.subscriptionConfiguration = buildSubscriptionConfig(
                    (config) =>
                        config.addSubscription('sub1', (sub) =>
                            sub
                                .withTier('tier1')
                                .withAllDefaultFeatures()
                                .withNotifications()
                                .withNotificationsMaxItems(1)
                        )
                );

                const user = await store.findUser(userId);
                await store.saveUser({
                    ...user,
                    subscriptionId: 'sub1',
                    subscriptionStatus: 'active',
                });

                await itemsStore.createItem(recordName, {
                    address: 'item1',
                    markers: [PUBLIC_READ_MARKER],
                    description: 'item1',
                });

                const result = await manager.recordItem({
                    recordKeyOrRecordName: recordName,
                    item: {
                        address: 'item2',
                        markers: [PUBLIC_READ_MARKER],
                        description: 'item2',
                    },
                    userId,
                    instances: [],
                });

                expect(result).toEqual({
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of notification items has been reached for your subscription.',
                });
            });
        });
    });

    describe('subscribeToNotification()', () => {
        beforeEach(async () => {
            await itemsStore.createItem(recordName, {
                address: 'public',
                markers: [PUBLIC_READ_MARKER],
                description: 'public',
            });

            await itemsStore.createItem(recordName, {
                address: 'private',
                markers: [PRIVATE_MARKER],
                description: 'private',
            });
        });

        it('should allow anyone to subscribe to a public record', async () => {
            const result = await manager.subscribeToNotification({
                userId: otherUserId,
                recordName,
                address: 'public',
                instances: [],
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            expect(result).toEqual({
                success: true,
                subscriptionId: expect.any(String),
            });

            expect(itemsStore.subscriptions).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'public',
                    userId: otherUserId,
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should allow users who arent logged in to subscribe to a public record', async () => {
            const result = await manager.subscribeToNotification({
                userId: null,
                recordName,
                address: 'public',
                instances: [],
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            expect(result).toEqual({
                success: true,
                subscriptionId: expect.any(String),
            });

            expect(itemsStore.subscriptions).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'public',
                    userId: null,
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should return not_authorized when trying to subscribe to a private record', async () => {
            const result = await manager.subscribeToNotification({
                userId: otherUserId,
                recordName,
                address: 'private',
                instances: [],
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    action: 'subscribe',
                    recordName,
                    resourceKind: 'notification',
                    resourceId: 'private',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });

            expect(itemsStore.subscriptions).toEqual([]);
        });

        it('should return subscription_limit_reached when the maximum number of subscriptions has been reached', async () => {
            await itemsStore.saveSubscription({
                id: 'sub1',
                userId: otherUserId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withNotifications()
                            .withNotificationsMaxSubscribersPerItem(1)
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.subscribeToNotification({
                userId: otherUserId,
                recordName,
                address: 'public',
                instances: [],
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of subscriptions has been reached for this notification.',
            });
        });
    });

    describe('unsubscribeFromNotification()', () => {
        beforeEach(async () => {
            await itemsStore.createItem(recordName, {
                address: 'public',
                markers: [PUBLIC_READ_MARKER],
                description: 'public',
            });

            await itemsStore.saveSubscription({
                id: 'sub1',
                userId: otherUserId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            await itemsStore.createItem(recordName, {
                address: 'private',
                markers: [PRIVATE_MARKER],
                description: 'private',
            });

            await itemsStore.saveSubscription({
                id: 'sub2',
                userId: otherUserId,
                recordName,
                notificationAddress: 'private',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });
        });

        it('should allow a user to unsubscribe a public subscription', async () => {
            const result = await manager.unsubscribeFromNotification({
                userId: otherUserId,
                subscriptionId: 'sub1',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(itemsStore.subscriptions).toEqual([
                {
                    id: 'sub1',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'public',
                    active: false,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
                {
                    id: 'sub2',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'private',
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should allow a user to unsubscribe a private subscription', async () => {
            const result = await manager.unsubscribeFromNotification({
                userId: otherUserId,
                subscriptionId: 'sub2',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(itemsStore.subscriptions).toEqual([
                {
                    id: 'sub1',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'public',
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
                {
                    id: 'sub2',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'private',
                    active: false,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should allow the record owner to unsubscribe any subscription', async () => {
            const result = await manager.unsubscribeFromNotification({
                userId: userId,
                subscriptionId: 'sub1',
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(itemsStore.subscriptions).toEqual([
                {
                    id: 'sub1',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'public',
                    active: false,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
                {
                    id: 'sub2',
                    userId: otherUserId,
                    recordName,
                    notificationAddress: 'private',
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should not allow random users to unsubscribe anyonymous subscriptions', async () => {
            await itemsStore.saveSubscription({
                id: 'sub3',
                userId: null,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            const result = await manager.unsubscribeFromNotification({
                userId: null,
                subscriptionId: 'sub3',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_logged_in',
                errorMessage:
                    'The user must be logged in. Please provide a sessionKey or a recordKey.',
            });

            expect(
                itemsStore.subscriptions.filter((s) => s.id === 'sub3')
            ).toEqual([
                {
                    id: 'sub3',
                    userId: null,
                    recordName,
                    notificationAddress: 'public',
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });

        it('should not allow random users to unsubscribe subscriptions', async () => {
            await itemsStore.saveSubscription({
                id: 'sub3',
                userId: userId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint',
                    keys: {},
                },
            });

            const result = await manager.unsubscribeFromNotification({
                userId: otherUserId,
                subscriptionId: 'sub3',
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    action: 'unsubscribe',
                    recordName,
                    resourceKind: 'notification',
                    resourceId: 'public',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });

            expect(
                itemsStore.subscriptions.filter((s) => s.id === 'sub3')
            ).toEqual([
                {
                    id: 'sub3',
                    userId: userId,
                    recordName,
                    notificationAddress: 'public',
                    active: true,
                    pushSubscription: {
                        endpoint: 'endpoint',
                        keys: {},
                    },
                },
            ]);
        });
    });

    describe('getApplicationServerKey()', () => {
        it('should return the server application key from the push interface', async () => {
            pushInterface.getServerApplicationKey.mockReturnValue('key');

            const result = await manager.getApplicationServerKey();

            expect(result).toEqual({
                success: true,
                key: 'key',
            });
        });
    });

    describe('sendNotification()', () => {
        beforeEach(async () => {
            await itemsStore.createItem(recordName, {
                address: 'public',
                markers: [PUBLIC_READ_MARKER],
                description: 'public',
            });

            await itemsStore.saveSubscription({
                id: 'sub1',
                userId: otherUserId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint1',
                    keys: {},
                },
            });

            await itemsStore.saveSubscription({
                id: 'sub2',
                userId: otherUserId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint2',
                    keys: {},
                },
            });
        });

        it('should send a notification to all subscriptions', async () => {
            pushInterface.sendNotification.mockResolvedValue({
                success: true,
            });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(2);

            const expectedPayload = {
                title: 'title',
                body: 'description',
                icon: 'icon',
                badge: 'badge',
                silent: true,
                tag: 'tag',
                timestamp: 123,
                action: {
                    type: 'open_url',
                    url: 'url',
                },
                actions: [
                    {
                        action: {
                            type: 'webhook',
                            url: 'url_to_call',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        },
                        title: 'action1',
                        icon: 'icon1',
                    },
                ],
            };

            expect(pushInterface.sendNotification).toHaveBeenCalledWith(
                {
                    endpoint: 'endpoint1',
                    keys: {},
                },
                expectedPayload
            );
            expect(pushInterface.sendNotification).toHaveBeenCalledWith(
                {
                    endpoint: 'endpoint2',
                    keys: {},
                },
                expectedPayload
            );

            expect(itemsStore.sentNotifications).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'public',
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    defaultAction: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                    sentTimeMs: expect.any(Number),
                },
            ]);
            expect(itemsStore.sentNotificationUsers).toEqual([
                {
                    sentNotificationId: expect.any(String),
                    subscriptionId: 'sub1',
                    userId: otherUserId,
                    success: true,
                    errorCode: null,
                },
                {
                    sentNotificationId: expect.any(String),
                    subscriptionId: 'sub2',
                    userId: otherUserId,
                    success: true,
                    errorCode: null,
                },
            ]);
        });

        it('should only send notifications to active subscriptions', async () => {
            pushInterface.sendNotification.mockResolvedValue({
                success: true,
            });

            await itemsStore.saveSubscription({
                id: 'sub1',
                userId: otherUserId,
                recordName,
                notificationAddress: 'public',
                active: false,
                pushSubscription: {
                    endpoint: 'endpoint1',
                    keys: {},
                },
            });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(1);

            const expectedPayload = {
                title: 'title',
                body: 'description',
                icon: 'icon',
                badge: 'badge',
                silent: true,
                tag: 'tag',
                timestamp: 123,
                action: {
                    type: 'open_url',
                    url: 'url',
                },
                actions: [
                    {
                        action: {
                            type: 'webhook',
                            url: 'url_to_call',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        },
                        title: 'action1',
                        icon: 'icon1',
                    },
                ],
            };

            expect(pushInterface.sendNotification).toHaveBeenCalledWith(
                {
                    endpoint: 'endpoint2',
                    keys: {},
                },
                expectedPayload
            );

            expect(itemsStore.sentNotifications).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'public',
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    defaultAction: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                    sentTimeMs: expect.any(Number),
                },
            ]);
            expect(itemsStore.sentNotificationUsers).toEqual([
                {
                    sentNotificationId: expect.any(String),
                    subscriptionId: 'sub2',
                    userId: otherUserId,
                    success: true,
                    errorCode: null,
                },
            ]);
        });

        it('should inactivate all subscriptions that fail to send a notification', async () => {
            pushInterface.sendNotification
                .mockResolvedValueOnce({
                    success: false,
                    errorCode: 'subscription_gone',
                })
                .mockResolvedValueOnce({
                    success: false,
                    errorCode: 'subscription_not_found',
                });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: true,
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(2);

            const expectedPayload = {
                title: 'title',
                body: 'description',
                icon: 'icon',
                badge: 'badge',
                silent: true,
                tag: 'tag',
                timestamp: 123,
                action: {
                    type: 'open_url',
                    url: 'url',
                },
                actions: [
                    {
                        action: {
                            type: 'webhook',
                            url: 'url_to_call',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        },
                        title: 'action1',
                        icon: 'icon1',
                    },
                ],
            };

            expect(pushInterface.sendNotification).toHaveBeenCalledWith(
                {
                    endpoint: 'endpoint1',
                    keys: {},
                },
                expectedPayload
            );
            expect(pushInterface.sendNotification).toHaveBeenCalledWith(
                {
                    endpoint: 'endpoint2',
                    keys: {},
                },
                expectedPayload
            );

            expect(itemsStore.sentNotifications).toEqual([
                {
                    id: expect.any(String),
                    recordName,
                    notificationAddress: 'public',
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    defaultAction: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                    sentTimeMs: expect.any(Number),
                },
            ]);
            expect(itemsStore.sentNotificationUsers).toEqual([
                {
                    sentNotificationId: expect.any(String),
                    subscriptionId: 'sub1',
                    userId: otherUserId,
                    success: false,
                    errorCode: 'subscription_gone',
                },
                {
                    sentNotificationId: expect.any(String),
                    subscriptionId: 'sub2',
                    userId: otherUserId,
                    success: false,
                    errorCode: 'subscription_not_found',
                },
            ]);

            expect(await itemsStore.getSubscriptionById('sub1')).toMatchObject({
                active: false,
            });

            expect(await itemsStore.getSubscriptionById('sub2')).toMatchObject({
                active: false,
            });
        });

        it('should return not_authorized if the user isnt authorized', async () => {
            pushInterface.sendNotification.mockResolvedValue({
                success: true,
            });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId: otherUserId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'You are not authorized to perform this action.',
                reason: {
                    type: 'missing_permission',
                    action: 'send',
                    recordName,
                    resourceKind: 'notification',
                    resourceId: 'public',
                    subjectType: 'user',
                    subjectId: otherUserId,
                },
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(0);

            expect(itemsStore.sentNotifications).toEqual([]);
            expect(itemsStore.sentNotificationUsers).toEqual([]);
        });

        it('should return subscription_limit_reached if sending a notification would exceed the limit', async () => {
            pushInterface.sendNotification.mockResolvedValue({
                success: true,
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withNotifications()
                            .withNotificationsMaxSentNotificationsPerPeriod(1)
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await itemsStore.saveSentNotification({
                id: 'sent1',
                recordName,
                notificationAddress: 'public',
                title: 'title1',
                body: 'description1',
                badge: null,
                icon: 'icon1',
                actions: [],
                sentTimeMs: 123,
            });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId: userId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of sent notifications has been reached for this period.',
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(0);

            expect(itemsStore.sentNotifications.slice(1)).toEqual([]);
            expect(itemsStore.sentNotificationUsers).toEqual([]);
        });

        it('should return subscription_limit_reached if sending two messages would exceed the limit', async () => {
            pushInterface.sendNotification.mockResolvedValue({
                success: true,
            });

            await itemsStore.saveSubscription({
                id: 'sub1',
                userId: userId,
                recordName,
                notificationAddress: 'public',
                active: true,
                pushSubscription: {
                    endpoint: 'endpoint1',
                    keys: {},
                },
            });

            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withNotifications()
                            .withNotificationsMaxSentPushNotificationsPerPeriod(
                                2
                            )
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.sendNotification({
                recordName,
                address: 'public',
                userId: userId,
                payload: {
                    title: 'title',
                    body: 'description',
                    icon: 'icon',
                    badge: 'badge',
                    silent: true,
                    tag: 'tag',
                    timestamp: 123,
                    action: {
                        type: 'open_url',
                        url: 'url',
                    },
                    actions: [
                        {
                            action: {
                                type: 'webhook',
                                url: 'url_to_call',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                            },
                            title: 'action1',
                            icon: 'icon1',
                        },
                    ],
                },
                instances: [],
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage:
                    'The maximum number of sent push notifications has been reached for this period.',
            });

            expect(pushInterface.sendNotification).toHaveBeenCalledTimes(0);

            expect(itemsStore.sentNotifications.slice(1)).toEqual([]);
            expect(itemsStore.sentNotificationUsers).toEqual([]);
        });
    });
});
