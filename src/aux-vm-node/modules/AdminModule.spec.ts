import {
    AuxCausalTree,
    botAdded,
    createBot,
    shell,
    GLOBALS_BOT_ID,
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
                versionHash: 'abc',
                version: 'v1.0.0',
            },
            partitions: {
                shared: {
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
            id: 'aux-test',
            type: 'aux',
        };

        channel = new NodeAuxChannel(tree, user, serverDevice, config);

        await channel.initAndWait();

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
        describe('shell', () => {
            it('should run the given shell command and output the results to the console', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                await channel.sendEvents([shell('echo "Hello, World!"')]);

                await wait(20);

                expect(logMock).toBeCalledWith(
                    expect.stringContaining('[Shell] Hello, World!')
                );
            });

            it('should run the given shell command and output the results to the auxFinishedTasks dimension', async () => {
                expect.assertions(1);

                require('child_process').__setMockOutput(
                    'echo "Hello, World!"',
                    'Hello, World!'
                );

                uuidMock.mockReturnValue('testId');
                await channel.sendEvents([shell('echo "Hello, World!"')]);

                await wait(20);

                expect(channel.helper.botsState['testId']).toMatchObject({
                    id: 'testId',
                    tags: {
                        auxFinishedTasks: true,
                        auxTaskShell: 'echo "Hello, World!"',
                        auxTaskOutput: 'Hello, World!',
                    },
                });
            });
        });

        describe('device', () => {
            it('should pipe device events through onUniverseAction()', async () => {
                await channel.helper.createBot('test', {
                    testShout: '@setTag(this, "abc", true)',
                });

                await channel.helper.createBot('filter', {
                    onUniverseAction: `@
                            if (that.action.type === 'device') {
                                action.perform(that.action.event);
                            }
                        `,
                });

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: action('testShout'),
                    },
                ]);

                await waitAsync();

                expect(channel.helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        abc: true,
                    },
                });
            });
        });
    });

    describe('deviceConnected()', () => {
        it('should set the auxPlayerActive tag based on the session ID', async () => {
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
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
                },
            });

            await subject.deviceConnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: true,
                },
            });

            await subject.deviceDisconnected(info, channel, testDevice1);

            expect(channel.helper.botsState['sessionId']).toMatchObject({
                id: 'sessionId',
                tags: {
                    auxPlayerActive: false,
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
