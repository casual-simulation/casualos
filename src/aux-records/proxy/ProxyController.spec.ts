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
import {
    PRIVATE_MARKER,
    PUBLIC_READ_MARKER,
    failure,
    success,
} from '@casual-simulation/aux-common';
import type { MemoryStore } from '../MemoryStore';
import type { PolicyController } from '../PolicyController';
import type { TestControllers } from '../crud/CrudRecordsControllerTests';
import {
    setupTestContext,
    testCrudRecordsController,
} from '../crud/CrudRecordsControllerTests';
import {
    buildSubscriptionConfig,
    subscriptionConfigBuilder,
} from '../SubscriptionConfigBuilder';
import { MemoryProxyRecordsStore } from './MemoryProxyRecordsStore';
import { ProxyController } from './ProxyController';
import type { ProxyRecord, ProxyRecordsStore } from './ProxyRecordsStore';
import type {
    ProxyInterface,
    ProxyInterfaceRequest,
    ProxyInterfaceResponse,
} from './ProxyInterface';

console.log = jest.fn();
console.error = jest.fn();

describe('ProxyController', () => {
    testCrudRecordsController<
        ProxyRecord,
        ProxyRecord,
        ProxyRecordsStore,
        ProxyController
    >(
        false,
        'proxy',
        (services) => new MemoryProxyRecordsStore(services.store),
        (config, services) =>
            new ProxyController({
                ...config,
                proxyInterface: {
                    sendRequest: jest.fn(),
                },
            }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            host: 'example.com',
            data: {},
        }),
        (item) => ({
            address: item.address,
            markers: item.markers,
            host: 'example.com',
            data: {},
        }),
        async (context) => {
            const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
                (features) => features.withAllDefaultFeatures().withProxies()
            );

            context.store.subscriptionConfiguration = builder.config;
        }
    );

    let store: MemoryStore;
    let itemsStore: MemoryProxyRecordsStore;
    let policies: PolicyController;
    let manager: ProxyController;
    let services: TestControllers;
    let proxyInterface: {
        sendRequest: jest.Mock<Promise<any>, [ProxyInterfaceRequest]>;
    };

    let userId: string;
    let otherUserId: string;
    let recordName: string;

    beforeEach(async () => {
        proxyInterface = {
            sendRequest: jest.fn(),
        };

        const context = await setupTestContext<
            ProxyRecord,
            ProxyRecord,
            ProxyRecordsStore,
            ProxyController
        >(
            (services) => new MemoryProxyRecordsStore(services.store),
            (config) =>
                new ProxyController({
                    ...config,
                    proxyInterface: proxyInterface as ProxyInterface,
                })
        );

        services = context.services;
        store = context.store;
        itemsStore = context.itemsStore as MemoryProxyRecordsStore;
        policies = context.services.policies;
        manager = context.manager;
        userId = context.userId;
        otherUserId = context.otherUserId;
        recordName = context.recordName;

        const builder = subscriptionConfigBuilder().withUserDefaultFeatures(
            (features) => features.withAllDefaultFeatures().withProxies()
        );

        store.subscriptionConfiguration = builder.config;
    });

    function setResponse(response: ProxyInterfaceResponse) {
        proxyInterface.sendRequest.mockResolvedValue(success(response));
    }

    describe('recordItem()', () => {
        it('should be able to record a proxy', async () => {
            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'example.com:8443',
                    data: {
                        'headers.authorization.bearer': 'my-key',
                    },
                    markers: [PRIVATE_MARKER],
                },
            });

            expect(result).toEqual({
                success: true,
                recordName,
                address: 'proxy1',
            });

            await expect(
                itemsStore.getItemByAddress(recordName, 'proxy1')
            ).resolves.toEqual({
                address: 'proxy1',
                host: 'example.com:8443',
                data: {
                    'headers.authorization.bearer': 'my-key',
                },
                markers: [PRIVATE_MARKER],
            });
        });

        it('should keep the existing data when it is omitted from an update', async () => {
            await itemsStore.createItem(recordName, {
                address: 'proxy1',
                host: 'example.com',
                data: {
                    'headers.authorization.bearer': 'my-key',
                },
                markers: [PRIVATE_MARKER],
            });

            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'other.example.com',
                    markers: [PRIVATE_MARKER],
                } as any,
            });

            expect(result.success).toBe(true);

            await expect(
                itemsStore.getItemByAddress(recordName, 'proxy1')
            ).resolves.toEqual({
                address: 'proxy1',
                host: 'other.example.com',
                data: {
                    'headers.authorization.bearer': 'my-key',
                },
                markers: [PRIVATE_MARKER],
            });
        });

        it('should default the data to an empty object when creating a proxy', async () => {
            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'example.com',
                    markers: [PRIVATE_MARKER],
                } as any,
            });

            expect(result.success).toBe(true);

            await expect(
                itemsStore.getItemByAddress(recordName, 'proxy1')
            ).resolves.toEqual({
                address: 'proxy1',
                host: 'example.com',
                data: {},
                markers: [PRIVATE_MARKER],
            });
        });

        it('should reject proxies that have an invalid host', async () => {
            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'https://example.com/path',
                    data: {},
                    markers: [PRIVATE_MARKER],
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_proxy_host',
                errorMessage: expect.any(String),
            });

            await expect(
                itemsStore.getItemByAddress(recordName, 'proxy1')
            ).resolves.toBe(null);
        });

        it('should reject proxies that have unsupported data properties', async () => {
            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'example.com',
                    data: {
                        'headers.cookie': 'abc',
                    },
                    markers: [PRIVATE_MARKER],
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: expect.any(String),
            });
        });

        it('should return subscription_limit_reached when the user has reached their limit', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withProxies()
                            .withProxiesMaxItems(1)
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            await itemsStore.createItem(recordName, {
                address: 'proxy1',
                host: 'example.com',
                data: {},
                markers: [PRIVATE_MARKER],
            });

            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy2',
                    host: 'example.com',
                    data: {},
                    markers: [PRIVATE_MARKER],
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: expect.any(String),
            });
        });

        it('should return not_authorized when proxies are not allowed', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub.withTier('tier1').withAllDefaultFeatures()
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.recordItem({
                recordKeyOrRecordName: recordName,
                userId,
                instances: [],
                item: {
                    address: 'proxy1',
                    host: 'example.com',
                    data: {},
                    markers: [PRIVATE_MARKER],
                },
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
            });
        });
    });

    describe('handleProxyRequest()', () => {
        beforeEach(async () => {
            await itemsStore.createItem(recordName, {
                address: 'proxy1',
                host: 'example.com:8443',
                data: {
                    'headers.authorization.bearer': 'my-key',
                    'body.apiKey': 'my-other-key',
                },
                markers: [PRIVATE_MARKER],
            });
        });

        it('should send the request to the host of the proxy', async () => {
            setResponse({
                statusCode: 200,
                headers: {
                    'content-type': 'application/json',
                },
                body: '{"hello":"world"}',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {
                    message: 'hello',
                },
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: '{"hello":"world"}',
                },
            });

            expect(proxyInterface.sendRequest).toHaveBeenCalledTimes(1);
            const request = proxyInterface.sendRequest.mock.calls[0][0];
            expect(request.host).toBe('example.com:8443');
            expect(request.path).toBe('/v1/chat');
            expect(request.method).toBe('POST');
            expect(request.headers['authorization']).toBe('Bearer my-key');
            expect(request.headers['content-type']).toBe('application/json');
            expect(JSON.parse(request.body!)).toEqual({
                message: 'hello',
                apiKey: 'my-other-key',
            });
        });

        it('should record that the proxy was called', async () => {
            setResponse({
                statusCode: 200,
                headers: {},
                body: null,
            });

            await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(itemsStore.proxyRequests).toEqual([
                {
                    recordName,
                    proxyAddress: 'proxy1',
                    requestTimeMs: expect.any(Number),
                },
            ]);
        });

        it('should support GET requests without a body', async () => {
            await itemsStore.putItem(recordName, {
                address: 'proxy2',
                host: 'example.com',
                data: {
                    'headers.authorization': 'my-key',
                },
                markers: [PRIVATE_MARKER],
            });

            setResponse({
                statusCode: 200,
                headers: {},
                body: '[]',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy2',
                userId,
                instances: [],
                path: '/v1/models',
                method: 'GET',
            });

            expect(result.success).toBe(true);

            const request = proxyInterface.sendRequest.mock.calls[0][0];
            expect(request.method).toBe('GET');
            expect(request.body).toBe(null);
            expect(request.headers['authorization']).toBe('my-key');
        });

        it('should remove headers that the server manages from the response', async () => {
            setResponse({
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': 'session=abc',
                    'content-length': '10',
                    'access-control-allow-origin': '*',
                },
                body: '{}',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: '{}',
                },
            });
        });

        it('should return not_found when the proxy does not exist', async () => {
            const result = await manager.handleProxyRequest({
                recordName,
                address: 'missing',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_found',
                errorMessage: 'Proxy not found.',
            });
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });

        it('should return not_authorized when the user is not allowed to run the proxy', async () => {
            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId: otherUserId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result.success).toBe(false);
            expect((result as any).errorCode).toBe('not_authorized');
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });

        it('should allow anyone to call proxies that have the publicRead marker', async () => {
            await itemsStore.putItem(recordName, {
                address: 'proxy1',
                host: 'example.com:8443',
                data: {},
                markers: [PUBLIC_READ_MARKER],
            });

            setResponse({
                statusCode: 200,
                headers: {},
                body: 'ok',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId: otherUserId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result.success).toBe(true);
        });

        it('should allow anonymous users to call proxies that have the publicRead marker', async () => {
            await itemsStore.putItem(recordName, {
                address: 'proxy1',
                host: 'example.com:8443',
                data: {},
                markers: [PUBLIC_READ_MARKER],
            });

            setResponse({
                statusCode: 200,
                headers: {},
                body: 'ok',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId: null,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result.success).toBe(true);
        });

        it('should reject paths that do not start with a slash', async () => {
            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: 'v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: expect.any(String),
            });
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });

        it('should reject protocol relative paths', async () => {
            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '//evil.example.com/v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: expect.any(String),
            });
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });

        it('should reject requests that do not contain JSON data when the proxy sets body properties', async () => {
            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: 'not json',
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'unacceptable_request',
                errorMessage: expect.any(String),
            });
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });

        it('should return the error from the proxy interface', async () => {
            proxyInterface.sendRequest.mockResolvedValue(
                failure({
                    errorCode: 'invalid_proxy_host',
                    errorMessage: 'The host is private.',
                })
            );

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'invalid_proxy_host',
                errorMessage: 'The host is private.',
            });
        });

        it('should return subscription_limit_reached when the hourly limit has been reached', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub
                            .withTier('tier1')
                            .withAllDefaultFeatures()
                            .withProxies()
                            .withProxiesMaxRequestsPerHour(1)
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            setResponse({
                statusCode: 200,
                headers: {},
                body: 'ok',
            });

            const first = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });
            expect(first.success).toBe(true);

            const second = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(second).toEqual({
                success: false,
                errorCode: 'subscription_limit_reached',
                errorMessage: expect.any(String),
            });
        });

        it('should return not_authorized when proxies are not allowed for the subscription', async () => {
            store.subscriptionConfiguration = buildSubscriptionConfig(
                (config) =>
                    config.addSubscription('sub1', (sub) =>
                        sub.withTier('tier1').withAllDefaultFeatures()
                    )
            );

            const user = await store.findUser(userId);
            await store.saveUser({
                ...user,
                subscriptionId: 'sub1',
                subscriptionStatus: 'active',
            });

            const result = await manager.handleProxyRequest({
                recordName,
                address: 'proxy1',
                userId,
                instances: [],
                path: '/v1/chat',
                body: {},
            });

            expect(result).toEqual({
                success: false,
                errorCode: 'not_authorized',
                errorMessage: expect.any(String),
            });
            expect(proxyInterface.sendRequest).not.toHaveBeenCalled();
        });
    });
});
