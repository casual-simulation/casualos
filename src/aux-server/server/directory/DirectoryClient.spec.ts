import { DirectoryClient } from './DirectoryClient';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DEFAULT_PING_INTERVAL } from './DirectoryClientSettings';

jest.mock('axios');
jest.mock('os');
jest.useFakeTimers();

describe('DirectoryClient', () => {
    let client: DirectoryClient;
    let store: DirectoryStore;

    beforeEach(async () => {
        require('os').__setHostname('testHostname');

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
            });
        });

        it('should use the stored version of the settings', async () => {
            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
            });

            await client.init();

            const settings = await store.getClientSettings();

            expect(settings).toEqual({
                pingInterval: 100,
                token: null,
                password: 'def',
            });
        });
    });

    describe('upstream', () => {
        beforeEach(async () => {
            require('axios').__reset();
            await store.saveClientSettings({
                pingInterval: 100,
                token: null,
                password: 'def',
            });
            await client.init();
        });

        it('should send a PUT request to the upstread each time the ping interval is up', async () => {
            let request = require('axios').__getLastPut();
            expect(request).toMatchInlineSnapshot(`
                Array [
                  "https://example.com/api/directory",
                  Object {
                    "key": "8c1a3f6e96e480fd4a265e3aeeab162771ae584cfdc3c03449a37403a1352ac1",
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
                    "key": "8c1a3f6e96e480fd4a265e3aeeab162771ae584cfdc3c03449a37403a1352ac1",
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
                    "key": "8c1a3f6e96e480fd4a265e3aeeab162771ae584cfdc3c03449a37403a1352ac1",
                    "password": "def",
                    "privateIpAddress": "192.168.1.65",
                    "publicName": "testHostname",
                  },
                ]
            `);
        });
    });
});
