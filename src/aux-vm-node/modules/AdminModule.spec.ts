import {
    AuxCausalTree,
    sayHello,
    grantRole,
    fileAdded,
    createFile,
} from '@casual-simulation/aux-common';
import {
    storedTree,
    site,
    DeviceInfo,
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { AuxUser, AuxConfig } from '@casual-simulation/aux-vm';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';
import { AdminModule } from './AdminModule';
import { Subscription } from 'rxjs';

let logMock = (console.log = jest.fn());

describe('AdminModule', () => {
    let tree: AuxCausalTree;
    let channel: NodeAuxChannel;
    let user: AuxUser;
    let device: DeviceInfo;
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
            },
            roles: [],
        };
        info = {
            id: 'aux-admin',
            type: 'aux',
        };

        channel = new NodeAuxChannel(tree, user, config);

        await channel.initAndWait();

        subject = new AdminModule();
        sub = await subject.setup(info, channel);
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

        describe('grant_role', () => {
            it('should not work in non-admin channels', async () => {
                info = {
                    id: 'aux-test',
                    type: 'aux',
                };
                subject = new AdminModule();
                sub = await subject.setup(info, channel);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.username': 'otheruser',
                            'aux.roles': [],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole(ADMIN_ROLE, 'otheruser'),
                    },
                ]);

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.username': 'otheruser',
                        'aux.roles': [],
                    },
                });
            });

            it('should grant the role to the given user if sent on the admin channel and by an admin', async () => {
                device.roles.push(ADMIN_ROLE);

                await channel.sendEvents([
                    fileAdded(
                        createFile('testOtherUser', {
                            'aux.username': 'otheruser',
                            'aux.roles': [],
                        })
                    ),
                ]);

                await channel.sendEvents([
                    {
                        type: 'device',
                        device: device,
                        event: grantRole(ADMIN_ROLE, 'otheruser'),
                    },
                ]);

                // Wait for the async operations to finish
                await Promise.resolve();
                await Promise.resolve();

                expect(
                    channel.helper.filesState['testOtherUser']
                ).toMatchObject({
                    id: 'testOtherUser',
                    tags: {
                        'aux.username': 'otheruser',
                        'aux.roles': [ADMIN_ROLE],
                    },
                });
            });
        });
    });
});
