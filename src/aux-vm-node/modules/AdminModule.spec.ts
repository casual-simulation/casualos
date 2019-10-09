import {
    AuxCausalTree,
    sayHello,
    botAdded,
    createBot,
    shell,
    GLOBALS_BOT_ID,
    echo,
    action,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    remote,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AdminModule } from './AdminModule';
import { Subscription } from 'rxjs';
import { wait, waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import uuid from 'uuid/v4';

console.error = jest.fn();
let logMock = (console.log = jest.fn());

jest.mock('child_process');

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AdminModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let serverDevice: DeviceInfo;
    let config: AuxConfig;
    let subject: AdminModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;

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
        serverDevice = {
            claims: {
                [USERNAME_CLAIM]: 'server',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [SERVER_ROLE],
        };
        info = {
            id: 'aux-admin',
            type: 'aux',
        };

        channel = new NodeAuxChannel(tree, user, serverDevice, config);

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

        subject = new AdminModule();
        sub = await subject.setup(info, channel);

        logMock.mockClear();
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('say_hello', () => {
            it('should print a hello message to the console', async () => {
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: sayHello(),
                    },
                ]);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('Hello!')
                );
            });
        });

        describe('echo', () => {
            it('should send a shout to the session that the echo came from', async () => {
                let events: RemoteAction[] = [];
                channel.remoteEvents.subscribe(e => events.push(...e));

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: echo('test'),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(events).toEqual([
                    remote(action('test'), {
                        sessionId: device.claims[SESSION_ID_CLAIM],
                    }),
                ]);
            });
        });

        describe('shell', () => {
            it('should run the given shell command and output the results to the console', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                device.roles.push(ADMIN_ROLE);
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: shell('echo "Hello, World!"'),
                    },
                ]);

                await wait(20);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });

            it('should run the given shell command and output the results to the aux.finishedTasks context', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                device.roles.push(ADMIN_ROLE);

                uuidMock.mockReturnValue('testId');
                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: shell('echo "Hello, World!"'),
                    },
                ]);

                await wait(20);

                expect(channel.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        'aux.finishedTasks': true,
                        'aux.task.shell': 'echo "Hello, World!"',
                        'aux.task.output': 'Hello, World!',
                    },
                });
            });

            it('should not run the given shell command if the user is not an admin', async () => {
                expect.assertions(1);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: shell('echo "Hello, World!"'),
                    },
                ]);

                await wait(20);

                expect(logMock).not.toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });
        });
    });

    describe('deviceConnected()', () => {
        it('should set the number of connected devices on the channel in the admin channel', async () => {
            let testChannelInfo: RealtimeChannelInfo = {
                id: 'aux-test',
                type: 'aux',
            };
            let testUser = {
                id: 'testUserId',
                isGuest: false,
                name: 'Test User Name',
                username: 'testUserId',
                token: 'token',
            };
            let testDevice: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUserId',
                    [DEVICE_ID_CLAIM]: 'testDeviceId',
                    [SESSION_ID_CLAIM]: 'testSessionId',
                },
                roles: [],
            };
            let testTree = new AuxCausalTree(storedTree(site(1)));
            await testTree.root();
            let testConfig: AuxConfig = {
                config: {
                    isBuilder: false,
                    isPlayer: false,
                },
                partitions: {
                    '*': {
                        type: 'causal_tree',
                        tree: testTree,
                        id: 'id',
                    },
                },
            };

            let testChannel = new NodeAuxChannel(
                testTree,
                testUser,
                testDevice,
                testConfig
            );
            await testChannel.initAndWait();

            await channel.sendEvents([
                botAdded(
                    createBot('channelBotId', {
                        'aux.channels': true,
                        'aux.channel': 'test',
                    })
                ),
            ]);

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(
                testChannelInfo,
                testChannel,
                testDevice1
            );

            let testDevice2: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername2',
                    [DEVICE_ID_CLAIM]: 'deviceId2',
                    [SESSION_ID_CLAIM]: 'sessionId2',
                },
                roles: [],
            };
            await subject.deviceConnected(
                testChannelInfo,
                testChannel,
                testDevice2
            );

            expect(channel.helper.botsState['channelBotId']).toMatchObject({
                id: 'channelBotId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedSessions': 2,
                },
            });

            await subject.deviceDisconnected(
                testChannelInfo,
                testChannel,
                testDevice1
            );

            expect(channel.helper.botsState['channelBotId']).toMatchObject({
                id: 'channelBotId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedSessions': 1,
                },
            });

            await subject.deviceDisconnected(
                testChannelInfo,
                testChannel,
                testDevice2
            );

            // Wait for the async operations to finish
            await waitAsync();

            expect(channel.helper.botsState['channelBotId']).toMatchObject({
                id: 'channelBotId',
                tags: {
                    'aux.channels': true,
                    'aux.channel': 'test',
                    'aux.channel.connectedSessions': 0,
                },
            });
        });

        it('should set the total number of connected devices on the config in the admin channel', async () => {
            await channel.sendEvents([botAdded(createBot(GLOBALS_BOT_ID, {}))]);

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(info, channel, testDevice1);

            // Wait for the async operations to finish
            await waitAsync();

            let testDevice2: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername2',
                    [DEVICE_ID_CLAIM]: 'deviceId2',
                    [SESSION_ID_CLAIM]: 'sessionId2',
                },
                roles: [],
            };
            await subject.deviceConnected(info, channel, testDevice2);

            expect(channel.helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    'aux.connectedSessions': 2,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice1);

            expect(channel.helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    'aux.connectedSessions': 1,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice2);

            expect(channel.helper.botsState[GLOBALS_BOT_ID]).toMatchObject({
                id: GLOBALS_BOT_ID,
                tags: {
                    'aux.connectedSessions': 0,
                },
            });
        });

        it('should set the aux.user.active tag based on the session ID', async () => {
            await channel.sendEvents([botAdded(createBot(GLOBALS_BOT_ID, {}))]);

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    'aux.user.active': true,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    'aux.user.active': false,
                },
            });

            await subject.deviceConnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    'aux.user.active': true,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    'aux.user.active': false,
                },
            });
        });

        it('should not error if the channel is not setup', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            channel = new NodeAuxChannel(tree, user, serverDevice, config);

            await channel.initAndWait();

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceConnected(info, channel, testDevice1);
        });
    });

    describe('deviceDisconnected()', () => {
        it('should not error if the channel is not setup', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            channel = new NodeAuxChannel(tree, user, serverDevice, config);

            await channel.initAndWait();

            let testDevice1: DeviceInfo = {
                claims: {
                    [USERNAME_CLAIM]: 'testUsername',
                    [DEVICE_ID_CLAIM]: 'deviceId',
                    [SESSION_ID_CLAIM]: 'sessionId',
                },
                roles: [],
            };
            await subject.deviceDisconnected(info, channel, testDevice1);
        });
    });
});
