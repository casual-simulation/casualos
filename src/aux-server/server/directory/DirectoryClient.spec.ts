import { DirectoryClient } from './DirectoryClient';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DEFAULT_PING_INTERVAL } from './DirectoryClientSettings';

console.error = jest.fn();

jest.mock('axios');
jest.mock('os');
jest.useFakeTimers();

describe('DirectoryClient', () => {
    let client: DirectoryClient;
    let store: DirectoryStore;

    beforeEach(async () => {
        require('os').__setHostname('testHostname');
        require('os').__setInterfaces({});

        store = new MemoryDirectoryStore();

        await store.init();

        client = new DirectoryClient(store, {
            upstream: 'https://example.com',
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
});
