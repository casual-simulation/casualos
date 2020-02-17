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
                    onResponse: '@setTag(this, "data", that.response.data)',
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
                    onResponse: '@setTag(this, "data", that.response.data)',
                    data: {
                        test: true,
                    },
                });
            });

            it('should execute webhook events from remote devices that are allowed by onUniverseAction()', async () => {
                expect.assertions(1);

                require('axios').__setResponse({
                    data: {
                        test: true,
                    },
                });

                await channel.helper.createBot('test', {
                    onResponse: '@setTag(this, "data", that.response.data)',
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
                        event: webhook({
                            url: 'https://www.example.com',
                            method: 'GET',
                            responseShout: 'onResponse',
                        }),
                    },
                ]);

                await waitAsync();

                expect(channel.helper.botsState['test'].tags).toEqual({
                    onResponse: '@setTag(this, "data", that.response.data)',
                    data: {
                        test: true,
                    },
                });
            });
        });
    });
});
