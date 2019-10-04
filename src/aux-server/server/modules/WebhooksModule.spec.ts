import {
    NodeAuxChannel,
    AuxLoadedChannel,
} from '@casual-simulation/aux-vm-node';
import {
    botAdded,
    createBot,
    AuxCausalTree,
    webhook,
} from '@casual-simulation/aux-common';
import {
    ADMIN_ROLE,
    DeviceInfo,
    RealtimeChannelInfo,
    storedTree,
    site,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    SERVER_ROLE,
} from '@casual-simulation/causal-trees';
import { WebhooksModule } from './WebhooksModule';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';
import { Subscription } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-vm/test/TestHelpers';
import { TestChannelManager, createChannel } from './test/TestChannelManager';

jest.mock('axios');

console.log = jest.fn();

describe('WebhooksModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
    let serverDevice: DeviceInfo;
    let config: AuxConfig;
    let subject: WebhooksModule;
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

        // channel = new NodeAuxChannel(tree, user, serverDevice, config);

        // await channel.initAndWait();

        // await channel.sendEvents([
        //     botAdded(
        //         createBot('userId', {
        //             'aux.account.username': 'username',
        //             'aux.account.roles': [ADMIN_ROLE],
        //         })
        //     ),
        //     botAdded(
        //         createBot('userTokenId', {
        //             'aux.token.username': 'username',
        //             'aux.token': 'adminToken',
        //         })
        //     ),
        // ]);

        auxChannel = await createChannel(info, user, device, config);

        channel = auxChannel.channel;

        manager = new TestChannelManager();
        manager.addChannel(info, auxChannel);

        subject = new WebhooksModule();
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
        describe('send_webhook', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should execute webhooks', async () => {
                expect.assertions(1);

                require('axios').__setResponse({
                    data: {
                        test: true,
                    },
                });

                await channel.helper.createBot('test', {
                    'onResponse()': 'setTag(this, "data", that.response.data)',
                });

                await channel.sendEvents([
                    webhook({
                        url: 'https://www.example.com',
                        method: 'GET',
                        responseShout: 'onResponse',
                    }),
                ]);

                await waitAsync();

                expect(channel.helper.botsState['test'].tags).toEqual({
                    'aux._lastEditedBy': expect.anything(),
                    'onResponse()': 'setTag(this, "data", that.response.data)',
                    data: {
                        test: true,
                    },
                });
            });

            it('should execute webhook events from remote devices', async () => {
                expect.assertions(1);

                require('axios').__setResponse({
                    data: {
                        test: true,
                    },
                });

                await channel.helper.createBot('test', {
                    'onResponse()': 'setTag(this, "data", that.response.data)',
                });

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: webhook({
                            url: 'https://www.example.com',
                            method: 'GET',
                            responseShout: 'onResponse',
                        }),
                    },
                ]);

                await waitAsync();

                expect(channel.helper.botsState['test'].tags).toEqual({
                    'aux._lastEditedBy': expect.anything(),
                    'onResponse()': 'setTag(this, "data", that.response.data)',
                    data: {
                        test: true,
                    },
                });
            });
        });
    });
});
