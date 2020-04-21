import { saveFile, loadFile } from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { nodeSimulationWithConfig } from '@casual-simulation/aux-vm-node';
import { Subscription } from 'rxjs';
import { AuxConfig, AuxUser, Simulation } from '@casual-simulation/aux-vm';
import fs from 'fs';
import { FilesModule2 } from './FilesModule2';
import mockFs from 'mock-fs';
import uuid from 'uuid/v4';
let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FilesModule2', () => {
    let simulation: Simulation;
    let user: AuxUser;
    let config: AuxConfig;
    let subject: FilesModule2;
    let sub: Subscription;

    beforeEach(async () => {
        mockFs({
            '/test/storage-dir': {
                '0': {
                    'file1.txt': 'abc',
                },
                '1': {
                    'file1.txt': 'def',
                },
            },
        });

        user = {
            id: 'userId',
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
                    type: 'memory',
                    initialState: {},
                },
            },
        };

        simulation = nodeSimulationWithConfig(user, 'admin', config);
        await simulation.init();

        subject = new FilesModule2('/test/storage-dir');
        sub = await subject.setup(simulation);
    });

    afterEach(() => {
        mockFs.restore();

        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    beforeAll(() => {
        dateNowMock.mockReturnValue(1);
    });

    describe('events', () => {
        describe('save_file', () => {
            it('should save a file with the given data to the file system in the first available directory', async () => {
                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                    })
                );

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should support saving a file without the /drives portion', async () => {
                await simulation.helper.transaction(
                    saveFile({
                        path: 'newFile.txt',
                        data: 'test',
                    })
                );

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should support saving a file in a specific directory', async () => {
                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/1/newFile.txt',
                        data: 'test',
                    })
                );

                await waitAsync();

                const path = '/test/storage-dir/1/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should send a callback shout when done', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "called", true)',
                });

                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                    })
                );

                await waitAsync();

                expect(
                    simulation.helper.botsState['callback'].tags['called']
                ).toBe(true);
            });

            it('should send a callback shout with an error if the file already exists', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                fs.writeFileSync('/test/storage-dir/0/newFile.txt', 'abc');

                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                        overwriteExistingFile: false,
                    })
                );

                await waitAsync();

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toEqual('file_already_exists');
            });

            it('should overwrite files if indicated', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                fs.writeFileSync('/test/storage-dir/0/newFile.txt', 'abc');

                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                        overwriteExistingFile: true,
                    })
                );

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toBeUndefined();
            });

            it('should make intermediate directories if unavailable', async () => {
                mockFs({
                    '/test/storage-dir/0': {},
                });

                await simulation.helper.transaction(
                    saveFile({
                        path: '/drives/haha/newFile.txt',
                        data: 'test',
                    })
                );

                await waitAsync();

                const path = '/test/storage-dir/0/haha/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);
            });
        });

        describe('load_file', () => {
            it('should load the first file that matches the given path in one of the directories', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await simulation.helper.transaction(
                    loadFile({
                        path: '/drives/file1.txt',
                        callbackShout: 'callback',
                    })
                );

                await waitAsync();

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('abc');
            });

            it('should load the files that matches the given path exactly', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await simulation.helper.transaction(
                    loadFile({
                        path: '/drives/1/file1.txt',
                        callbackShout: 'callback',
                    })
                );

                await waitAsync();

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('def');
            });

            it('should be able to load files without the /drives prefix', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await simulation.helper.transaction(
                    loadFile({
                        path: 'file1.txt',
                        callbackShout: 'callback',
                    })
                );

                await waitAsync();

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('abc');
            });

            it('should send a callback sound with an error if the file does not exist', async () => {
                await simulation.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                await simulation.helper.transaction(
                    loadFile({
                        path: 'not_exists.txt',
                        callbackShout: 'callback',
                    })
                );

                await waitAsync();

                const bot = simulation.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toBe('file_does_not_exist');
            });
        });
    });
});
