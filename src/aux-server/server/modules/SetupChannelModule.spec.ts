import {
    NodeAuxChannel,
    AuxLoadedChannel,
} from '@casual-simulation/aux-vm-node';
import {
    botAdded,
    createBot,
    AuxCausalTree,
    webhook,
    setupChannel,
    createPrecalculatedBot,
} from '@casual-simulation/aux-common';
import {
    DeviceInfo,
    RealtimeChannelInfo,
    storedTree,
    site,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { SetupChannelModule } from './SetupChannelModule';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { TestChannelManager, createChannel } from './test/TestChannelManager';
import uuid from 'uuid/v4';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');
console.log = jest.fn();

describe('SetupChannelModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let serverDevice: DeviceInfo;
    let config: AuxConfig;
    let subject: SetupChannelModule;
    let sub: Subscription;
    let info: RealtimeChannelInfo;
    let manager: TestChannelManager;
    let auxChannel: AuxLoadedChannel;

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

        auxChannel = await createChannel(info, user, device, config);

        channel = auxChannel.channel;

        manager = new TestChannelManager();
        manager.setChannelFactory(async info => {
            return await createChannel(info, user, device, config);
        });
        manager.addChannel(info, auxChannel);

        subject = new SetupChannelModule();
        subject.setChannelManager(<any>manager);
        sub = await subject.setup(info, channel);
    });

    afterEach(() => {
        if (sub) {
            sub.unsubscribe();
            sub = null;
        }
    });

    describe('events', () => {
        describe('setup_channel', () => {
            it('should create non-existant channels', async () => {
                expect.assertions(1);

                await channel.sendEvents([setupChannel('newChannel')]);

                await waitAsync();

                await expect(
                    manager.hasChannel({
                        id: 'aux-newChannel',
                        type: 'aux',
                    })
                ).resolves.toBe(true);
            });

            it('should clone the given bot into the new channel', async () => {
                expect.assertions(2);

                uuidMock.mockReturnValueOnce('newBot');

                await channel.sendEvents([
                    setupChannel(
                        'newChannel',
                        createBot('test', {
                            abc: 'def',
                        })
                    ),
                ]);

                await waitAsync();

                await expect(
                    manager.hasChannel({
                        id: 'aux-newChannel',
                        type: 'aux',
                    })
                ).resolves.toBe(true);

                const newChannel = await manager.loadChannel({
                    id: 'aux-newChannel',
                    type: 'aux',
                });

                const newBot = newChannel.simulation.helper.botsState['newBot'];
                expect(newBot).toEqual(
                    createPrecalculatedBot('newBot', {
                        abc: 'def',
                    })
                );
            });

            it('should clone the given mod into the new channel', async () => {
                expect.assertions(2);

                uuidMock.mockReturnValueOnce('newBot');

                await channel.sendEvents([
                    setupChannel('newChannel', {
                        abc: 'def',
                    }),
                ]);

                await waitAsync();

                await expect(
                    manager.hasChannel({
                        id: 'aux-newChannel',
                        type: 'aux',
                    })
                ).resolves.toBe(true);

                const newChannel = await manager.loadChannel({
                    id: 'aux-newChannel',
                    type: 'aux',
                });

                const newBot = newChannel.simulation.helper.botsState['newBot'];
                expect(newBot).toEqual(
                    createPrecalculatedBot('newBot', {
                        abc: 'def',
                    })
                );
            });

            it('should call onCreate() on the new bot', async () => {
                expect.assertions(2);

                uuidMock.mockReturnValueOnce('newBot');

                await channel.sendEvents([
                    setupChannel('newChannel', {
                        onCreate: '@setTag(this, "created", true)',
                    }),
                ]);

                await waitAsync();

                await expect(
                    manager.hasChannel({
                        id: 'aux-newChannel',
                        type: 'aux',
                    })
                ).resolves.toBe(true);

                const newChannel = await manager.loadChannel({
                    id: 'aux-newChannel',
                    type: 'aux',
                });

                const newBot = newChannel.simulation.helper.botsState['newBot'];
                expect(newBot).toEqual(
                    createPrecalculatedBot('newBot', {
                        onCreate: '@setTag(this, "created", true)',
                        created: true,
                    })
                );
            });

            it('should not add the new bot if the channel already exists', async () => {
                expect.assertions(1);

                // Creates the new channel
                await manager.loadChannel({
                    id: 'aux-newChannel',
                    type: 'aux',
                });

                uuidMock.mockReturnValueOnce('newBot');
                await channel.sendEvents([
                    setupChannel('newChannel', {
                        test: 'abc',
                    }),
                ]);

                await waitAsync();

                const newChannel = await manager.loadChannel({
                    id: 'aux-newChannel',
                    type: 'aux',
                });

                const newBot = newChannel.simulation.helper.botsState['newBot'];
                expect(newBot).toBeUndefined();
            });
        });
    });
});
