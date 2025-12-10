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
    constructInitializationUpdate,
    createBot,
    createInitializationUpdate,
    getConnectionId,
} from '@casual-simulation/aux-common';
import { SimulationWebhookEnvironment } from './SimulationWebhookEnvironment';
import { AuxVMNode } from '@casual-simulation/aux-vm-node';
import { RemoteSimulationImpl } from '@casual-simulation/aux-vm-client';
import type { HandleHttpRequestSuccess } from '@casual-simulation/aux-records';
import { tryParseJson } from '@casual-simulation/aux-common';
import { v4 as uuid } from 'uuid';
import { RemoteAuxChannel } from '@casual-simulation/aux-vm-client/vm/RemoteAuxChannel';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('axios');
jest.mock('uuid');

console.log = jest.fn();
console.warn = jest.fn();

const originalFetch = globalThis.fetch;

describe('SimulationWebhookEnvironment', () => {
    let environment: SimulationWebhookEnvironment;
    let fetch: jest.Mock<
        Promise<{
            status: number;
            headers?: Headers;
            json?: () => Promise<any>;
            text?: () => Promise<string>;
            body?: ReadableStream;
        }>
    >;

    beforeEach(() => {
        fetch = globalThis.fetch = jest.fn();
        environment = new SimulationWebhookEnvironment(
            (simId, indicator, origin, config) => {
                const configBotId = getConnectionId(indicator);
                const vm = new AuxVMNode(
                    simId,
                    origin,
                    configBotId,
                    new RemoteAuxChannel(config, {})
                );
                const sim = new RemoteSimulationImpl(
                    simId,
                    {
                        recordName: null,
                        inst: null,
                    },
                    vm
                );

                return {
                    sim,
                    vm,
                };
            }
        );
    });

    afterEach(() => {
        uuidMock.mockClear();
        require('axios').__reset();
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    describe('handleHttpRequest()', () => {
        it('should shout into a new simulation using the given request options', async () => {
            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return that',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: {
                    data: 'Hello!',
                    headers: {},
                    method: 'POST',
                    url: '/api/v1/webhooks/test',
                    query: {},
                },
            });
        });

        it('should take the first result from the shout and return that as the response', async () => {
            const result = await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return "Second!"',
                            }),
                            abc: createBot('abc', {
                                onWebhook: '@return "First!"',
                            }),
                            other: createBot('other', {
                                onWebhook: '@return "Third!"',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify('First!'),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });
        });

        it('should support version 2 aux states', async () => {
            const result = await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 2,
                        updates: [
                            constructInitializationUpdate(
                                createInitializationUpdate([
                                    createBot('test', {
                                        onWebhook: '@return "Second!"',
                                    }),
                                    createBot('abc', {
                                        onWebhook: '@return "First!"',
                                    }),
                                    createBot('other', {
                                        onWebhook: '@return "Third!"',
                                    }),
                                ])
                            ),
                        ],
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            });

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify('First!'),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });
        });

        it('should be able to download the aux state from a URL', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    version: 1,
                    state: {
                        test: createBot('test', {
                            onWebhook: '@return that',
                        }),
                    },
                }),
            });

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'url',
                    requestUrl: 'http://example.com/test.json',
                    requestMethod: 'GET',
                    requestHeaders: {
                        Accept: 'application/json',
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: {
                    data: 'Hello!',
                    headers: {},
                    method: 'POST',
                    url: '/api/v1/webhooks/test',
                    query: {},
                },
            });

            expect(fetch).toHaveBeenCalledWith('http://example.com/test.json', {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
                credentials: 'omit',
                mode: 'no-cors',
                cache: 'no-store',
            });
        });

        it('should be able to download version 2 aux state from a URL', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    version: 2,
                    updates: [
                        constructInitializationUpdate(
                            createInitializationUpdate([
                                createBot('test', {
                                    onWebhook: '@return "Second!"',
                                }),
                                createBot('abc', {
                                    onWebhook: '@return "First!"',
                                }),
                                createBot('other', {
                                    onWebhook: '@return "Third!"',
                                }),
                            ])
                        ),
                    ],
                }),
            });

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'url',
                    requestUrl: 'http://example.com/test.json',
                    requestMethod: 'GET',
                    requestHeaders: {
                        Accept: 'application/json',
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify('First!'),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(fetch).toHaveBeenCalledWith('http://example.com/test.json', {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
                credentials: 'omit',
                mode: 'no-cors',
                cache: 'no-store',
            });
        });

        it('should be able to make records requests', async () => {
            environment = new SimulationWebhookEnvironment(
                (simId, indicator, origin, config) => {
                    const configBotId = getConnectionId(indicator);
                    const vm = new AuxVMNode(
                        simId,
                        origin,
                        configBotId,
                        new RemoteAuxChannel(config, {})
                    );
                    const sim = new RemoteSimulationImpl(
                        simId,
                        {
                            recordName: null,
                            inst: null,
                        },
                        vm
                    );

                    return {
                        sim,
                        vm,
                    };
                },
                {
                    configParameters: {
                        authOrigin: 'http://auth.example.com',
                        recordsOrigin: 'http://records.example.com',
                    },
                }
            );

            setResponse({
                data: {
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                },
            });

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook:
                                    '@await os.recordData("testRecord", "address", 123); return "Done!";',
                            }),
                        },
                    },
                },
                connectionKey: 'myConnection',
                sessionKey: 'mySession',
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify('Done!'),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(getLastPost()).toEqual([
                'http://records.example.com/api/v2/records/data',
                {
                    recordKey: 'testRecord',
                    address: 'address',
                    data: 123,
                },
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer mySession',
                        Origin: 'http://auth.example.com',
                    },
                }),
            ]);
        });

        it('should support web.get()', async () => {
            setResponse({
                data: {
                    success: true,
                    recordName: 'testRecord',
                    address: 'address',
                },
            });

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook:
                                    '@return await web.get("http://example.com/test");',
                            }),
                        },
                    },
                },
                connectionKey: 'myConnection',
                sessionKey: 'mySession',
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify({
                        data: {
                            success: true,
                            recordName: 'testRecord',
                            address: 'address',
                        },
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(getLastGet()).toEqual(['http://example.com/test']);
        });

        it('should specify the owner and inst on the config bot if the inst is specified in the request', async () => {
            uuidMock.mockReturnValueOnce('configBot');

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return configBot',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                inst: 'inst',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: createBot(
                    'configBot',
                    {
                        owner: 'testRecord',
                        inst: 'inst',
                    },
                    'tempLocal'
                ),
            });
        });

        it('should specify the owner and static inst if no inst was specified in the request', async () => {
            uuidMock
                .mockReturnValueOnce('configBot')
                .mockReturnValueOnce('instId');

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return configBot',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: createBot(
                    'configBot',
                    {
                        owner: 'testRecord',
                        inst: 'instId',
                        staticInst: 'instId',
                    },
                    'tempLocal'
                ),
            });
        });

        it('should add the request query to the config bot', async () => {
            uuidMock.mockReturnValueOnce('configBot');

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return configBot',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                inst: 'inst',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {
                        inst: 'wrong',
                        owner: 'wrong',
                        recordName: 'allowed',
                        test: 'test',
                        other: '123',
                        staticInst: 'wrong',
                    },
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: createBot(
                    'configBot',
                    {
                        owner: 'testRecord',
                        inst: 'inst',
                        recordName: 'allowed',
                        test: 'test',
                        other: '123',
                    },
                    'tempLocal'
                ),
            });
        });

        it('should specify the authBot for the session user', async () => {
            uuidMock.mockReturnValueOnce('configBot');

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return authBot;',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                inst: 'inst',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
                sessionUserId: 'authBotId',
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: createBot('authBotId', {}, 'tempLocal'),
            });
        });

        it('should specify include the ID of the requesting user', async () => {
            uuidMock.mockReturnValueOnce('configBot');

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: createBot('test', {
                                onWebhook: '@return that;',
                            }),
                        },
                    },
                },
                recordName: 'testRecord',
                inst: 'inst',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: 'requestUserId',
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            expect(tryParseJson(result.response.body as string)).toEqual({
                success: true,
                value: {
                    data: 'Hello!',
                    headers: {},
                    method: 'POST',
                    url: '/api/v1/webhooks/test',
                    userId: 'requestUserId',
                    query: {},
                },
            });
        });

        it('should specify the correct partitions', async () => {
            let counter = 1;
            uuidMock
                .mockReturnValueOnce('configBot')
                .mockReturnValueOnce('instId')
                .mockImplementation(() => `id${counter++}`);

            const testBot = createBot('test', {
                onWebhook:
                    '@create({ space: "tempLocal", test: 1 }); create({ space: "shared", test: 2 }); create({ space: "tempShared", test: 3 }); create({ space: "local", test: 4 }); return getBots();',
            });

            const result = (await environment.handleHttpRequest({
                state: {
                    type: 'aux',
                    state: {
                        version: 1,
                        state: {
                            test: testBot,
                        },
                    },
                },
                recordName: 'testRecord',
                request: {
                    body: 'Hello!',
                    headers: {},
                    ipAddress: '123.456.789',
                    method: 'POST',
                    path: '/api/v1/webhooks/test',
                    pathParams: {},
                    query: {},
                },
                requestUserId: null,
            })) as HandleHttpRequestSuccess;

            expect(result).toEqual({
                success: true,
                response: {
                    statusCode: 200,
                    body: expect.any(String),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs: [],
            });

            const value = JSON.parse(result.response.body as string);

            expect(value).toContainEqual(
                createBot(
                    expect.any(String),
                    {
                        test: 1,
                    },
                    'tempLocal'
                )
            );

            expect(value).toContainEqual(
                createBot(
                    expect.any(String),
                    {
                        creator: 'test',
                        test: 2,
                    },
                    'shared'
                )
            );

            expect(value).toContainEqual(
                createBot(
                    expect.any(String),
                    {
                        test: 3,
                    },
                    'tempShared'
                )
            );

            expect(value).toContainEqual(
                createBot(
                    expect.any(String),
                    {
                        test: 4,
                    },
                    'local'
                )
            );
        });
    });
});

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
