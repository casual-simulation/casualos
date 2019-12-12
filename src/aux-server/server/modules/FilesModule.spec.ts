import {
    botAdded,
    AuxCausalTree,
    createBot,
    backupToGithub,
    backupAsDownload,
    download,
    checkoutSubmitted,
    LocalActions,
    toast,
    finishCheckout,
    calculateBooleanTagValue,
    saveFile,
    loadFile,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    AuxChannelManager,
    AuxLoadedChannel,
    NodeSimulation,
} from '@casual-simulation/aux-vm-node';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    storedTree,
    site,
    RealtimeChannelInfo,
    DeviceInfo,
    ADMIN_ROLE,
    RemoteAction,
    remote,
} from '@casual-simulation/causal-trees';
import { Subscription, Subject } from 'rxjs';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { BackupModule } from './BackupModule';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { take, flatMap } from 'rxjs/operators';
import uuid from 'uuid/v4';
import fs from 'fs';
import { FilesModule } from './FilesModule';
import { TestChannelManager, createChannel } from './test/TestChannelManager';
import mockFs from 'mock-fs';

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FilesModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let subject: FilesModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;
    let manager: TestChannelManager;

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

        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        user = {
            id: 'userId',
            isGuest: false,
            name: 'User Name',
            username: 'username',
            token: 'token',
        };
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            partitions: {
                '*': {
                    type: 'causal_tree',
                    tree: tree,
                    id: 'id',
                },
            },
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        info = {
            id: 'aux-admin',
            type: 'aux',
        };

        channel = new NodeAuxChannel(tree, user, device, config);

        await channel.initAndWait();

        manager = new TestChannelManager();

        subject = new FilesModule('/test/storage-dir');
        sub = await subject.setup(info, channel);
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
                await channel.sendEvents([
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                    }),
                ]);

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should support saving a file without the /drives portion', async () => {
                await channel.sendEvents([
                    saveFile({
                        path: 'newFile.txt',
                        data: 'test',
                    }),
                ]);

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should support saving a file in a specific directory', async () => {
                await channel.sendEvents([
                    saveFile({
                        path: '/drives/1/newFile.txt',
                        data: 'test',
                    }),
                ]);

                await waitAsync();

                const path = '/test/storage-dir/1/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');
            });

            it('should send a callback shout when done', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "called", true)',
                });

                await channel.sendEvents([
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                    }),
                ]);

                await waitAsync();

                expect(
                    channel.helper.botsState['callback'].tags['called']
                ).toBe(true);
            });

            it('should send a callback shout with an error if the file already exists', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                fs.writeFileSync('/test/storage-dir/0/newFile.txt', 'abc');

                await channel.sendEvents([
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                        overwriteExistingFile: false,
                    }),
                ]);

                await waitAsync();

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toEqual('file_already_exists');
            });

            it('should overwrite files if indicated', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                fs.writeFileSync('/test/storage-dir/0/newFile.txt', 'abc');

                await channel.sendEvents([
                    saveFile({
                        path: '/drives/newFile.txt',
                        data: 'test',
                        callbackShout: 'callback',
                        overwriteExistingFile: true,
                    }),
                ]);

                await waitAsync();

                const path = '/test/storage-dir/0/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);

                const content = fs.readFileSync(path);
                expect(content.toString('utf8')).toBe('test');

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toBeUndefined();
            });

            it('should make intermediate directories if unavailable', async () => {
                mockFs({
                    '/test/storage-dir/0': {},
                });

                await channel.sendEvents([
                    saveFile({
                        path: '/drives/haha/newFile.txt',
                        data: 'test',
                    }),
                ]);

                await waitAsync();

                const path = '/test/storage-dir/0/haha/newFile.txt';
                const exists = fs.existsSync(path);

                expect(exists).toBe(true);
            });
        });

        describe('load_file', () => {
            it('should load the first file that matches the given path in one of the directories', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await channel.sendEvents([
                    loadFile({
                        path: '/drives/file1.txt',
                        callbackShout: 'callback',
                    }),
                ]);

                await waitAsync();

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('abc');
            });

            it('should load the files that matches the given path exactly', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await channel.sendEvents([
                    loadFile({
                        path: '/drives/1/file1.txt',
                        callbackShout: 'callback',
                    }),
                ]);

                await waitAsync();

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('def');
            });

            it('should be able to load files without the /drives prefix', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "data", that.data)',
                });

                await channel.sendEvents([
                    loadFile({
                        path: 'file1.txt',
                        callbackShout: 'callback',
                    }),
                ]);

                await waitAsync();

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['data']).toBe('abc');
            });

            it('should send a callback sound with an error if the file does not exist', async () => {
                await channel.helper.createBot('callback', {
                    callback: '@setTag(this, "err", that.error)',
                });

                await channel.sendEvents([
                    loadFile({
                        path: 'not_exists.txt',
                        callbackShout: 'callback',
                    }),
                ]);

                await waitAsync();

                const bot = channel.helper.botsState['callback'];
                const tags = bot.tags;
                expect(tags['err']).toBe('file_does_not_exist');
            });
        });
    });
});
