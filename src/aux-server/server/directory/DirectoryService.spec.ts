import {
    DirectoryService,
    isInternal,
    getSubHost,
    DEFAULT_TOKEN_EXPIRATION_TIME,
} from './DirectoryService';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';
import { DirectoryUpdate } from './DirectoryUpdate';
import { compareSync } from 'bcryptjs';
import { decode, verify } from 'jsonwebtoken';
import { EntryUpdatedResult } from './DirectoryResult';

jest.mock('axios');

console.error = jest.fn();
const dateNowMock = (Date.now = jest.fn());

describe('DirectoryService', () => {
    let service: DirectoryService;
    let store: DirectoryStore;

    beforeEach(async () => {
        store = new MemoryDirectoryStore();

        await store.init();

        service = new DirectoryService(store, {
            secret: 'secret',
            webhook: null,
        });

        require('axios').__reset();
    });

    describe('update()', () => {
        it('should add the entry to the store', async () => {
            const entry: DirectoryUpdate = {
                key: 'abc',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '1.1.1.1',
                publicName: 'Test',
                password: 'password',
            };

            // Date.now() is in miliseconds
            dateNowMock.mockReturnValue(1500_000);
            const result = await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored).toEqual({
                key: 'abc',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '1.1.1.1',
                publicName: 'Test',
                lastUpdateTime: 1500, // Unix Time is in seconds
                passwordHash: expect.any(String),
            });
            expect(compareSync('password', stored.passwordHash)).toBe(true);

            expect(result).toEqual({
                type: 'entry_updated',
                token: expect.any(String),
            });

            const token = verify(
                (result as EntryUpdatedResult).token,
                'secret'
            );
            expect(token).toEqual({
                key: 'abc',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '1.1.1.1',
                exp: 1500 + DEFAULT_TOKEN_EXPIRATION_TIME,
                iat: 1500,
            });
        });

        it('should update the last update time', async () => {
            const entry: DirectoryUpdate = {
                key: 'abc',
                password: 'test',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test',
            };

            dateNowMock.mockReturnValue(999_000);
            await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored.lastUpdateTime).toBe(999);
        });

        it('should return a not authorized result if the password is wrong', async () => {
            dateNowMock.mockReturnValue(999_000);

            await service.update({
                key: 'abc',
                password: 'test',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test',
            });

            const entry: DirectoryUpdate = {
                key: 'abc',
                password: 'wrong',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test 2',
            };

            expect(await service.update(entry)).toEqual({
                type: 'not_authorized',
            });
        });

        it('should return a bad request if given invalid data', async () => {
            dateNowMock.mockReturnValue(999_000);
            const entry: DirectoryUpdate = {
                key: '',
                password: 'wrong',
                privateIpAddress: '192.168.1.1',
                publicIpAddress: '87.54.145.1',
                publicName: 'Test 2',
            };

            expect(await service.update(entry)).toEqual({
                type: 'bad_request',
                errors: [
                    {
                        path: ['key'],
                        message: expect.any(String),
                    },
                ],
            });
        });

        describe('webhook', () => {
            it('should send a post request to the webhook URL', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: 'http://www.example.com/test',
                });
                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                };

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toEqual([
                    'http://www.example.com/test',
                    {
                        key: 'abc',
                        externalIpAddress: '192.168.1.1',
                        internalIpAddress: '1.1.1.1',
                    },
                ]);
            });

            it('should not send a post when no webhook is configured', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: null,
                });
                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                };

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toBeUndefined();
            });

            it('should not send a post when neither IP address is updated', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: 'http://www.example.com/test',
                });
                await service.update({
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                });

                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Different',
                    password: 'password',
                };

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                require('axios').__reset();
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toBeUndefined();
            });

            it('should send a post when the public IP address is updated', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: 'http://www.example.com/test',
                });
                await service.update({
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                });

                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.2',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Different',
                    password: 'password',
                };

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                require('axios').__reset();
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toEqual([
                    'http://www.example.com/test',
                    {
                        key: 'abc',
                        externalIpAddress: '192.168.1.2',
                        internalIpAddress: '1.1.1.1',
                    },
                ]);
            });

            it('should send a post when the private IP address is updated', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: 'http://www.example.com/test',
                });
                await service.update({
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                });

                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.2',
                    publicName: 'Different',
                    password: 'password',
                };

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                require('axios').__reset();
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toEqual([
                    'http://www.example.com/test',
                    {
                        key: 'abc',
                        externalIpAddress: '192.168.1.1',
                        internalIpAddress: '1.1.1.2',
                    },
                ]);
            });

            it('should remember that the hook failed and send it again upon next update', async () => {
                service = new DirectoryService(store, {
                    secret: 'secret',
                    webhook: 'http://www.example.com/test',
                });

                const entry: DirectoryUpdate = {
                    key: 'abc',
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                    publicName: 'Test',
                    password: 'password',
                };

                require('axios').__setFail(true);
                await service.update(entry);

                // Date.now() is in miliseconds
                dateNowMock.mockReturnValue(1500_000);
                require('axios').__reset();
                await service.update(entry);

                const lastPost = require('axios').__getLastPost();
                expect(lastPost).toEqual([
                    'http://www.example.com/test',
                    {
                        key: 'abc',
                        externalIpAddress: '192.168.1.1',
                        internalIpAddress: '1.1.1.1',
                    },
                ]);
            });
        });
    });

    describe('findEntries()', () => {
        beforeEach(async () => {
            await store.update({
                key: 'abc 1',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Z Test',
            });
            await store.update({
                key: 'abc 2',
                publicIpAddress: '192.168.1.2',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 2',
            });
            await store.update({
                key: 'abc 3',
                publicIpAddress: '10.0.0.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 3',
            });
            await store.update({
                key: 'abc 4',
                publicIpAddress: '192.168.1.1',
                privateIpAddress: '87.54.145.1',
                passwordHash: '',
                lastUpdateTime: 123,
                publicName: 'Test 4',
            });
        });

        it('should return all the entries that match the given IP Address ordered by name', async () => {
            const result = await service.findEntries('192.168.1.1');

            expect(result).toEqual({
                type: 'query_results',
                entries: [
                    {
                        publicName: 'Test 4',
                        subhost: 'internal-abc 4',
                    },
                    {
                        publicName: 'Z Test',
                        subhost: 'internal-abc 1',
                    },
                ],
            });
        });
    });

    describe('isInternal()', () => {
        const cases = [
            [
                true,
                'IP address matches the entry IP',
                '192.168.1.1',
                '192.168.1.1',
            ] as const,
            [
                false,
                'IP address does not match the entry IP',
                '192.168.1.1',
                '192.168.1.2',
            ] as const,
        ];

        it.each(cases)(
            'should return %s if the given %s',
            (expected, desc, entryIp, givenIp) => {
                const result = isInternal(
                    {
                        key: 'abc',
                        publicName: 'Test',
                        passwordHash: '',
                        lastUpdateTime: 456,
                        privateIpAddress: '192.168.1.1',
                        publicIpAddress: entryIp,
                    },
                    givenIp
                );

                expect(result).toBe(expected);
            }
        );
    });

    describe('getSubHost()', () => {
        it('should prefix "internal" to the hash if the IP is internal', () => {
            const result = getSubHost(
                {
                    key: 'abc',
                    publicName: 'Test',
                    passwordHash: '',
                    lastUpdateTime: 456,
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                },
                '192.168.1.1'
            );

            expect(result).toBe('internal-abc');
        });

        it('should prefix "external" to the hash if the IP is not internal', () => {
            const result = getSubHost(
                {
                    key: 'abc',
                    publicName: 'Test',
                    passwordHash: '',
                    lastUpdateTime: 456,
                    publicIpAddress: '192.168.1.1',
                    privateIpAddress: '1.1.1.1',
                },
                '192.168.1.2'
            );

            expect(result).toBe('external-abc');
        });
    });
});
