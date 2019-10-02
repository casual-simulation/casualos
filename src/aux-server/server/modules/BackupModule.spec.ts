import {
    botAdded,
    AuxCausalTree,
    createBot,
    backupToGithub,
    backupAsDownload,
    download,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '@casual-simulation/aux-vm-node';
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
import { Subscription } from 'rxjs';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { BackupModule } from './BackupModule';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { take, flatMap } from 'rxjs/operators';
import uuid from 'uuid/v4';

let dateNowMock = (Date.now = jest.fn());

console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('BackupModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let api: any;
    let create: jest.Mock<any>;
    let config: AuxConfig;
    let subject: BackupModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;
    let store: TestCausalTreeStore;

    beforeEach(async () => {
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
                    host: 'host',
                    id: 'id',
                    treeName: 'treeName',
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
        store = new TestCausalTreeStore();

        channel = new NodeAuxChannel(tree, user, device, config);

        await channel.initAndWait();

        await channel.sendEvents([
            botAdded(
                createBot('userId', {
                    'aux.account.username': 'username',
                    'aux.account.roles': [ADMIN_ROLE],
                })
            ),
            botAdded(
                createBot('userTokenId', {
                    'aux.token.username': 'username',
                    'aux.token': 'adminToken',
                })
            ),
        ]);

        create = jest.fn();
        api = {
            gists: {
                create: create,
            },
        };
        subject = new BackupModule(store, auth => api);
        sub = await subject.setup(info, channel);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    beforeAll(() => {
        dateNowMock.mockReturnValue(1);
    });

    describe('events', () => {
        describe('backup_to_github', () => {
            it('should not run if the user is not an admin', async () => {
                expect.assertions(1);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupToGithub('auth'),
                    },
                ]);

                await wait(20);

                expect(create).not.toBeCalled();
            });

            it('should create a gist with the contents of all the channels', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    botAdded(
                        createBot('testChannelId', {
                            'aux.channels': true,
                            'aux.channel': 'test',
                        })
                    ),
                ]);

                const testTree = storedTree(site(1), [site(2)]);
                const adminTree = storedTree(site(1), [
                    site(1),
                    site(2),
                    site(3),
                    site(4),
                ]);
                await store.put('aux-test', testTree);
                await store.put('aux-admin', adminTree);

                uuidMock.mockReturnValue('testId');
                create.mockResolvedValue({
                    data: {
                        html_url: 'testUrl',
                    },
                });
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupToGithub('auth'),
                    },
                ]);

                await wait(20);

                expect(create).toBeCalledWith({
                    files: {
                        'aux-admin.aux': {
                            content: expect.any(String),
                        },
                        'aux-test.aux': {
                            content: expect.any(String),
                        },
                    },
                    description: expect.any(String),
                });

                expect(channel.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'github',
                        'aux.task.backup.url': 'testUrl',
                        'aux.task.output': 'Uploaded 2 channels.',
                    },
                });
            });

            it('should handle exceptions from the Github API', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    botAdded(
                        createBot('testChannelId', {
                            'aux.channels': true,
                            'aux.channel': 'test',
                        })
                    ),
                ]);

                const testTree = storedTree(site(1), [site(2)]);
                const adminTree = storedTree(site(1), [
                    site(1),
                    site(2),
                    site(3),
                    site(4),
                ]);
                await store.put('aux-test', testTree);
                await store.put('aux-admin', adminTree);

                uuidMock.mockReturnValue('testId');
                create.mockRejectedValue(new Error('abc'));
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupToGithub('auth'),
                    },
                ]);

                await wait(20);

                expect(create).toBeCalledWith({
                    files: {
                        'aux-admin.aux': {
                            content: expect.any(String),
                        },
                        'aux-test.aux': {
                            content: expect.any(String),
                        },
                    },
                    description: expect.any(String),
                });

                expect(channel.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'github',
                        'aux.task.output': 'The task failed.',
                        'aux.task.error': 'Error: abc',
                    },
                });
            });

            it('should request archived atoms by default', async () => {
                device.roles.push(ADMIN_ROLE);

                const getMock = (store.get = jest.fn(store.get.bind(store)));

                create.mockResolvedValue({
                    data: {
                        html_url: 'testUrl',
                    },
                });
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupToGithub('auth'),
                    },
                ]);

                await wait(20);

                expect(getMock).toBeCalledWith('aux-admin', undefined);
            });

            it('should not request archived atoms if specified', async () => {
                device.roles.push(ADMIN_ROLE);

                const getMock = (store.get = jest.fn(store.get.bind(store)));

                create.mockResolvedValue({
                    data: {
                        html_url: 'testUrl',
                    },
                });
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupToGithub('auth', {
                            includeArchived: false,
                        }),
                    },
                ]);

                await wait(20);

                expect(getMock).toBeCalledWith('aux-admin', false);
            });
        });

        describe('backup_as_download', () => {
            it('should not run if the user is not an admin', async () => {
                expect.assertions(1);

                let remoteEvents: RemoteAction[] = [];
                channel.remoteEvents.subscribe(e => remoteEvents.push(...e));

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupAsDownload(),
                    },
                ]);

                await wait(20);

                expect(remoteEvents).toEqual([]);
            });

            it('should create a zip with the contents of all the channels', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    botAdded(
                        createBot('testChannelId', {
                            'aux.channels': true,
                            'aux.channel': 'test',
                        })
                    ),
                ]);

                const testTree = storedTree(site(1), [site(2)]);
                const adminTree = storedTree(site(1), [
                    site(1),
                    site(2),
                    site(3),
                    site(4),
                ]);
                await store.put('aux-test', testTree);
                await store.put('aux-admin', adminTree);

                uuidMock.mockReturnValue('testId');
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupAsDownload(),
                    },
                ]);

                const remoteEvents = await channel.remoteEvents
                    .pipe(take(1))
                    .toPromise();

                expect(remoteEvents).toEqual([
                    remote(
                        download(
                            expect.anything(),
                            'backup.zip',
                            'application/zip'
                        ),
                        { sessionId: 'sessionId' }
                    ),
                ]);

                expect(channel.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.backup': true,
                        'aux.task.backup.type': 'download',
                        'aux.task.output': 'Downloaded 2 channels.',
                    },
                });
            });

            it('should request archived atoms by default', async () => {
                device.roles.push(ADMIN_ROLE);

                const getMock = (store.get = jest.fn(store.get.bind(store)));

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupAsDownload(),
                    },
                ]);

                await wait(20);

                expect(getMock).toBeCalledWith('aux-admin', undefined);
            });

            it('should not request archived atoms if specified', async () => {
                device.roles.push(ADMIN_ROLE);

                const getMock = (store.get = jest.fn(store.get.bind(store)));

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: backupAsDownload({ includeArchived: false }),
                    },
                ]);

                await wait(20);

                expect(getMock).toBeCalledWith('aux-admin', false);
            });
        });
    });
});
