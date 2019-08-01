import {
    fileAdded,
    AuxCausalTree,
    createFile,
    backupToGithub,
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
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { AuxConfig, AuxUser } from '@casual-simulation/aux-vm';
import { GithubModule } from './GithubModule';
import { TestCausalTreeStore } from '@casual-simulation/causal-trees/test/TestCausalTreeStore';
import { wait } from '@casual-simulation/aux-vm/test/TestHelpers';
import uuid from 'uuid/v4';

let dateNowMock = (Date.now = jest.fn());
console.log = jest.fn();
console.error = jest.fn();

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('GithubModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let api: any;
    let create: jest.Mock<any>;
    let config: AuxConfig;
    let subject: GithubModule;
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
            host: 'host',
            config: {
                isBuilder: false,
                isPlayer: false,
            },
            id: 'id',
            treeName: 'treeName',
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

        channel = new NodeAuxChannel(tree, user, config);

        await channel.initAndWait();

        await channel.sendEvents([
            fileAdded(
                createFile('userId', {
                    'aux.account.username': 'username',
                    'aux.account.roles': [ADMIN_ROLE],
                })
            ),
            fileAdded(
                createFile('userTokenId', {
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
        subject = new GithubModule(store, auth => api);
        sub = await subject.setup(info, channel);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
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
                    fileAdded(
                        createFile('testChannelId', {
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

                dateNowMock.mockReturnValue(1);
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

                expect(channel.helper.filesState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.github': true,
                        'aux.task.github.url': 'testUrl',
                        'aux.task.output': 'Uploaded 2 channels.',
                    },
                });
            });

            it('should handle exceptions from the Github API', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testChannelId', {
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

                dateNowMock.mockReturnValue(1);
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

                expect(channel.helper.filesState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.github': true,
                        'aux.task.output': 'The task failed.',
                        'aux.task.error': 'Error: abc',
                    },
                });
            });
        });
    });
});
