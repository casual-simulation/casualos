import { DirectoryClient } from './DirectoryClient';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DEFAULT_PING_INTERVAL } from './DirectoryClientSettings';
import { TestClient, TestRequest } from '@casual-simulation/tunnel';

console.error = jest.fn();
console.log = jest.fn();

jest.mock('axios');
jest.mock('os');
jest.useFakeTimers();

describe('DirectoryClient', () => {
    let tunnel: TestClient;
    let client: DirectoryClient;
    let store: DirectoryStore;

    beforeEach(async () => {
        require('os').__setHostname('testHostname');
        require('os').__setInterfaces({});

        store = new MemoryDirectoryStore();

        await store.init();

        tunnel = new TestClient();
        client = new DirectoryClient(store, tunnel, {
            upstream: 'https://example.com',
            tunnel: null,
        });
    });

    describe('init()', () => {
        it('should create an initial version of the settings', async () => {
            await client.init();

            const settings = await store.getClientSettings();

            expect(settings).toEqual({
                pingInterval: DEFAULT_PING_INTERVAL,
                token: null,
                password: expect.any(String),
                key: expect.any(String),
            });
        });

        it('should generate a key if the settings dont have a key', async () => {
            await store.saveClientSettings({
                pingInterval: DEFAULT_PING_INTERVAL,
                token: null,
                password: 'def',
                key: null,
            });

            await client.init();

            const settings = await store.getClientSettings();

            expect(settings).toEqual({
                pingInterval: DEFAULT_PING_INTERVAL,
                token: null,
                password: expect.any(String),
                key: expect.any(String),
            });
        });

        it('should use the stored version of the settings', async () => {
            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
                key: 'test',
            });

            await client.init();

            const settings = await store.getClientSettings();

            expect(settings).toEqual({
                pingInterval: 100,
                token: null,
                password: 'def',
                key: 'test',
            });
        });
    });

    describe('upstream', () => {
        beforeEach(async () => {
            require('axios').__reset();
            require('os').__setInterfaces({
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                eth0: [
                    {
                        address: '192.168.1.65',
                        family: 'IPv4',
                        internal: false,
                        max: 'ethernet:address',
                    },
                ],
                wlan0: [
                    {
                        address: '192.168.1.128',
                        family: 'IPv4',
                        internal: false,
                        max: 'wlan:address',
                    },
                ],
            });
            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
                key: 'test',
            });
            await client.init();
        });

        it('should send a PUT request to the upstread each time the ping interval is up', async () => {
            let request = require('axios').__getLastPut();
            expect(request).toMatchInlineSnapshot(`
                Array [
                  "https://example.com/api/directory",
                  Object {
                    "key": "test",
                    "password": "def",
                    "privateIpAddress": "192.168.1.65",
                    "publicName": "testHostname",
                  },
                ]
            `);

            // 100 minutes + 1ms
            jest.advanceTimersByTime(1000 * 60 * 100 + 1);

            request = require('axios').__getLastPut();
            expect(request).toMatchInlineSnapshot(`
                Array [
                  "https://example.com/api/directory",
                  Object {
                    "key": "test",
                    "password": "def",
                    "privateIpAddress": "192.168.1.65",
                    "publicName": "testHostname",
                  },
                ]
            `);

            require('axios').__reset();

            // 100 minutes + 1ms
            jest.advanceTimersByTime(1000 * 60 * 100 + 1);

            request = require('axios').__getLastPut();
            expect(request).toMatchInlineSnapshot(`
                Array [
                  "https://example.com/api/directory",
                  Object {
                    "key": "test",
                    "password": "def",
                    "privateIpAddress": "192.168.1.65",
                    "publicName": "testHostname",
                  },
                ]
            `);
        });
    });

    describe('response', () => {
        beforeEach(async () => {
            require('axios').__reset();
            require('os').__setInterfaces({
                eth0: [
                    {
                        address: '192.168.1.65',
                        family: 'IPv4',
                        internal: false,
                        max: 'ethernet:address',
                    },
                ],
            });
        });
        it('should save the token and private key to the store', async () => {
            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
                key: 'test',
            });
            require('axios').__setResponse({
                data: {
                    token: 'token',
                },
            });
            await client.init();

            const stored = await store.getClientSettings();
            expect(stored).toEqual({
                key: 'test',
                password: 'def',
                pingInterval: 100,
                token: 'token',
            });
        });
    });

    describe('network interfaces', () => {
        beforeEach(async () => {
            require('axios').__reset();

            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
                key: 'test',
            });
        });

        it('should choose eth interfaces first', async () => {
            require('os').__setInterfaces({
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                eth0: [
                    {
                        address: '192.168.1.65',
                        family: 'IPv4',
                        internal: false,
                        max: 'ethernet:address',
                    },
                ],
                wlan0: [
                    {
                        address: '192.168.1.128',
                        family: 'IPv4',
                        internal: false,
                        max: 'wlan:address',
                    },
                ],
            });
            await client.init();

            let [url, request] = require('axios').__getLastPut();
            expect(request.privateIpAddress).toEqual('192.168.1.65');
        });

        it('should choose en interfaces second', async () => {
            require('os').__setInterfaces({
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                en1: [
                    {
                        address: '192.168.1.65',
                        family: 'IPv4',
                        internal: false,
                        max: 'ethernet:address',
                    },
                ],
                wlan0: [
                    {
                        address: '192.168.1.128',
                        family: 'IPv4',
                        internal: false,
                        max: 'wlan:address',
                    },
                ],
            });
            await client.init();

            let [url, request] = require('axios').__getLastPut();
            expect(request.privateIpAddress).toEqual('192.168.1.65');
        });

        it('should choose wlan interfaces third', async () => {
            require('os').__setInterfaces({
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                wlan0: [
                    {
                        address: '192.168.1.128',
                        family: 'IPv4',
                        internal: false,
                        max: 'wlan:address',
                    },
                ],
            });
            await client.init();

            let [url, request] = require('axios').__getLastPut();
            expect(request.privateIpAddress).toEqual('192.168.1.128');
        });

        it('should choose wl interfaces fourth', async () => {
            require('os').__setInterfaces({
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                wlan0: [
                    {
                        address: '192.168.1.128',
                        family: 'IPv4',
                        internal: false,
                        max: 'wlan:address',
                    },
                ],
            });
            await client.init();

            let [url, request] = require('axios').__getLastPut();
            expect(request.privateIpAddress).toEqual('192.168.1.128');
        });

        it('should choose interfaces alphabetically last', async () => {
            require('os').__setInterfaces({
                zyd: [
                    {
                        address: '10.10.10.10',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
                abc: [
                    {
                        address: '172.16.99.1',
                        family: 'IPv4',
                        internal: false,
                        mac: 'wrong:address',
                    },
                ],
            });
            await client.init();

            let [url, request] = require('axios').__getLastPut();
            expect(request.privateIpAddress).toEqual('172.16.99.1');
        });
    });

    describe('tunnel', () => {
        beforeEach(async () => {
            require('axios').__reset();
            require('os').__setInterfaces({
                eth0: [
                    {
                        address: '192.168.1.65',
                        family: 'IPv4',
                        internal: false,
                        max: 'ethernet:address',
                    },
                ],
            });

            await store.saveClientSettings({
                pingInterval: 5,
                token: null,
                password: 'def',
                key: 'test',
            });
        });

        it('should open a tunnel after getting a token', async () => {
            require('axios').__setResponse({
                data: {
                    token: 'token',
                },
            });

            let requests: TestRequest[] = [];
            tunnel.requests.subscribe(r => requests.push(r));

            await client.init();

            expect(requests).toHaveLength(1);
            expect(requests[0].request).toEqual({
                direction: 'reverse',
                token: 'token',
                localHost: '127.0.0.1',
                localPort: 3000,
            });
        });

        it('should not open a tunnel if the token is null', async () => {
            require('axios').__setResponse({
                data: {
                    token: null,
                },
            });

            let requests: TestRequest[] = [];
            tunnel.requests.subscribe(r => requests.push(r));

            await client.init();

            expect(requests).toHaveLength(0);
        });

        it('should not open a tunnel if one is already open', async () => {
            require('axios').__setResponse({
                data: {
                    token: 'token',
                },
            });

            let requests: TestRequest[] = [];
            tunnel.requests.subscribe(r => requests.push(r));

            await client.init();

            expect(requests).toHaveLength(1);
            expect(requests[0].request).toEqual({
                direction: 'reverse',
                token: 'token',
                localHost: '127.0.0.1',
                localPort: 3000,
            });

            requests[0].accept();

            // 5 minutes + 100ms
            jest.advanceTimersByTime(5 * 60 * 1000 + 100);

            expect(requests).toHaveLength(1);
        });

        it('should open a new tunnel after 5 seconds if the last one failed', async () => {
            require('axios').__setResponse({
                data: {
                    token: 'token',
                },
            });

            let requests: TestRequest[] = [];
            tunnel.requests.subscribe(r => requests.push(r));

            await client.init();

            expect(requests).toHaveLength(1);
            expect(requests[0].request).toEqual({
                direction: 'reverse',
                token: 'token',
                localHost: '127.0.0.1',
                localPort: 3000,
            });

            requests[0].accept();

            jest.advanceTimersByTime(1000);

            requests[0].error(new Error('Tunnel failed.'));

            expect(requests).toHaveLength(1);

            jest.advanceTimersByTime(5000);

            expect(requests).toHaveLength(2);
            expect(requests[1].request).toEqual({
                direction: 'reverse',
                token: 'token',
                localHost: '127.0.0.1',
                localPort: 3000,
            });
        });

        it('should retry with the new token', async () => {
            require('axios').__setResponse({
                data: {
                    token: 'token',
                },
            });

            let requests: TestRequest[] = [];
            tunnel.requests.subscribe(r => requests.push(r));

            await client.init();

            expect(requests).toHaveLength(1);

            requests[0].accept();

            require('axios').__setResponse({
                data: {
                    token: 'token2',
                },
            });

            jest.advanceTimersByTime(5 * 60 * 1000 + 100);
            await client.pendingOperations;

            requests[0].error(new Error('Tunnel failed.'));

            expect(requests).toHaveLength(1);

            jest.advanceTimersByTime(5000);

            expect(requests).toHaveLength(2);
            expect(requests[1].request).toEqual({
                direction: 'reverse',
                token: 'token2',
                localHost: '127.0.0.1',
                localPort: 3000,
            });
        });
    });
});
