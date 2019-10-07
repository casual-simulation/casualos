import { BaseAuxChannel, filterAtom } from './BaseAuxChannel';
import {
    RealtimeCausalTree,
    LocalRealtimeCausalTree,
    storedTree,
    site,
    AuthorizationMessage,
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    DeviceAction,
    remote,
    DeviceInfo,
    ADMIN_ROLE,
    SERVER_ROLE,
    RealtimeCausalTreeOptions,
    atom,
    atomId,
} from '@casual-simulation/causal-trees';
import {
    AuxCausalTree,
    GLOBALS_BOT_ID,
    createBot,
    botAdded,
    botRemoved,
    sayHello,
    bot,
    del,
    tag,
    value,
} from '@casual-simulation/aux-common';
import { AuxUser } from '../AuxUser';
import { AuxConfig } from './AuxConfig';
import { AuxPartition } from '../partitions/AuxPartition';
import { PartitionConfig } from '../partitions/AuxPartitionConfig';
import { createAuxPartition, createLocalCausalTreePartitionFactory } from '..';

console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: AuxChannelImpl;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let tree: AuxCausalTree;

    beforeEach(async () => {
        user = {
            id: 'userId',
            username: 'username',
            isGuest: false,
            name: 'name',
            token: 'token',
        };
        device = {
            claims: {
                [USERNAME_CLAIM]: 'username',
                [DEVICE_ID_CLAIM]: 'deviceId',
                [SESSION_ID_CLAIM]: 'sessionId',
            },
            roles: [],
        };
        tree = new AuxCausalTree(storedTree(site(1)), {
            filter: (tree, atom) => {
                if (channel) {
                    return filterAtom(
                        <AuxCausalTree>tree,
                        atom,
                        () => channel.helper
                    );
                } else {
                    return true;
                }
            },
        });
        config = {
            config: { isBuilder: false, isPlayer: false },
            partitions: {
                '*': {
                    type: 'causal_tree',
                    id: 'auxId',
                    tree: tree,
                },
            },
        };
        await tree.root();

        channel = new AuxChannelImpl(user, device, config);
    });

    describe('init()', () => {
        it('should create a bot for the user', async () => {
            await channel.initAndWait();

            const userBot = channel.helper.userBot;
            expect(userBot).toBeTruthy();
            expect(userBot.tags).toMatchSnapshot();
        });

        it('should create the globals bot', async () => {
            await channel.initAndWait();

            const globals = channel.helper.globalsBot;
            expect(globals).toBeTruthy();
            expect(globals.tags).toMatchSnapshot();
        });

        it('should issue an authorization event if the user is not in the designers list in builder', async () => {
            config.config.isBuilder = true;
            await tree.addBot(
                createBot(GLOBALS_BOT_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
                {
                    type: 'authorization',
                    authorized: false,
                    reason: 'unauthorized',
                },
            ]);
        });

        it('should allow users with the admin role', async () => {
            config.config.isBuilder = true;
            await tree.addBot(
                createBot(GLOBALS_BOT_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            device.roles.push(ADMIN_ROLE);
            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
            ]);
        });

        it('should allow users with the server role', async () => {
            config.config.isBuilder = true;
            await tree.addBot(
                createBot(GLOBALS_BOT_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            device.roles.push(SERVER_ROLE);
            await channel.init();

            for (let i = 0; i < 100; i++) {
                await Promise.resolve();
            }

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
            ]);
        });

        it('should not error if the tree does not have a root atom', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            config = {
                config: { isBuilder: false, isPlayer: false },
                partitions: {
                    '*': {
                        type: 'causal_tree',
                        id: 'auxId',
                        tree: tree,
                    },
                },
            };
            channel = new AuxChannelImpl(user, device, config);

            await channel.initAndWait();
        });

        it('should error if unable to construct a partition', async () => {
            tree = new AuxCausalTree(storedTree(site(1)));
            config = {
                config: { isBuilder: false, isPlayer: false },
                partitions: {
                    '*': {
                        type: 'remote_causal_tree',
                        id: 'auxId',
                        host: 'host',
                        treeName: 'treeName',
                    },
                },
            };
            channel = new AuxChannelImpl(user, device, config);

            await expect(channel.initAndWait()).rejects.toEqual(
                new Error('[BaseAuxChannel] Unable to build partition: *')
            );
        });
    });

    describe('onAnyAction()', () => {
        it('should send new bot atoms through the onAnyAction() filter', async () => {
            await channel.initAndWait();
            await tree.updateBot(channel.helper.globalsBot, {
                tags: {
                    'onAnyAction()': `
                        if (that.action.type === 'add_bot') {
                            action.reject(that.action);
                        }
                    `,
                },
            });

            const a = atom(atomId(2, 100), tree.weave.atoms[0].id, bot('test'));
            const { rejected } = await tree.add(a);

            expect(rejected).toEqual({
                atom: a,
                reason: 'rejected_by_filter',
            });
        });

        it('should send delete bot atoms through the onAnyAction() filter', async () => {
            await channel.initAndWait();
            await tree.updateBot(channel.helper.globalsBot, {
                tags: {
                    'onAnyAction()': `
                        if (that.action.type === 'remove_bot') {
                            action.reject(that.action);
                        }
                    `,
                },
            });

            const { added } = await tree.addBot(createBot('test'));

            const a = atom(atomId(2, 100), added[0].id, del());
            const { rejected } = await tree.add(a);

            expect(rejected).toEqual({
                atom: a,
                reason: 'rejected_by_filter',
            });
        });

        it('should send update tag atoms through the onAnyAction() filter', async () => {
            await channel.initAndWait();
            await tree.updateBot(channel.helper.globalsBot, {
                tags: {
                    'onAnyAction()': `
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                    `,
                },
            });

            const { added } = await tree.addBot(createBot('test'));

            const a1 = atom(atomId(2, 100), added[0].id, tag('abc'));
            const { rejected: rejected1 } = await tree.add(a1);

            const a2 = atom(atomId(2, 101), a1.id, value(123));
            const { rejected: rejected2 } = await tree.add(a2);

            expect(rejected1).toBe(null);
            expect(rejected2).toEqual({
                atom: a2,
                reason: 'rejected_by_filter',
            });
        });

        it('should send delete tag atoms through the onAnyAction() filter', async () => {
            await channel.initAndWait();
            await tree.updateBot(channel.helper.globalsBot, {
                tags: {
                    'onAnyAction()': `
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                    `,
                },
            });

            const { added } = await tree.addBot(createBot('test'));

            const a1 = atom(atomId(2, 100), added[0].id, tag('abc'));
            const { rejected: rejected1 } = await tree.add(a1);

            const a2 = atom(atomId(2, 101), a1.id, del());
            const { rejected: rejected2 } = await tree.add(a2);

            expect(rejected1).toBe(null);
            expect(rejected2).toEqual({
                atom: a2,
                reason: 'rejected_by_filter',
            });
        });
    });

    describe('sendEvents()', () => {
        it('should send remote events to _sendRemoteEvents()', async () => {
            await channel.initAndWait();

            await channel.sendEvents([
                {
                    type: 'remote',
                    event: botAdded(createBot('def')),
                },
                botAdded(createBot('test')),
                {
                    type: 'remote',
                    event: botAdded(createBot('abc')),
                },
            ]);

            expect(channel.remoteEvents).toEqual([
                remote(botAdded(createBot('def'))),
                remote(botAdded(createBot('abc'))),
            ]);
        });

        it('should send device events to onDeviceEvents', async () => {
            await channel.initAndWait();

            let deviceEvents: DeviceAction[] = [];
            channel.onDeviceEvents.subscribe(e => deviceEvents.push(...e));

            await channel.sendEvents([
                {
                    type: 'device',
                    device: {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
                            [DEVICE_ID_CLAIM]: 'deviceId',
                            [SESSION_ID_CLAIM]: 'sessionId',
                        },
                        roles: ['role'],
                    },
                    event: botAdded(createBot('def')),
                },
                botAdded(createBot('test')),
                {
                    type: 'device',
                    device: null,
                    event: botAdded(createBot('abc')),
                },
            ]);

            expect(deviceEvents).toEqual([
                {
                    type: 'device',
                    device: {
                        claims: {
                            [USERNAME_CLAIM]: 'username',
                            [DEVICE_ID_CLAIM]: 'deviceId',
                            [SESSION_ID_CLAIM]: 'sessionId',
                        },
                        roles: ['role'],
                    },
                    event: botAdded(createBot('def')),
                },
                {
                    type: 'device',
                    device: null,
                    event: botAdded(createBot('abc')),
                },
            ]);
        });
    });

    describe('formulaBatch()', () => {
        it('should send remote events', async () => {
            await channel.initAndWait();

            await channel.formulaBatch(['server.sayHello()']);

            expect(channel.remoteEvents).toEqual([remote(sayHello())]);
        });
    });

    describe('search', () => {
        it('should convert errors to copiable values', async () => {
            await channel.initAndWait();

            const result = await channel.search('throw new Error("abc")');

            expect(result).toEqual({
                success: false,
                extras: expect.any(Object),
                error: 'Error: abc',
                logs: expect.any(Array),
            });
        });
    });

    // describe('forkAux()', () => {
    //     it('should call fork on the partitions', async () => {
    //         await channel.initAndWait();

    //         await channel.forkAux('test2');

    //     });
    // });
});

class AuxChannelImpl extends BaseAuxChannel {
    remoteEvents: RemoteAction[];

    private _device: DeviceInfo;
    constructor(user: AuxUser, device: DeviceInfo, config: AuxConfig) {
        super(user, config, {});
        this._device = device;
        this.remoteEvents = [];
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        this.remoteEvents.push(...events);
    }

    protected _createPartition(config: PartitionConfig): Promise<AuxPartition> {
        return createAuxPartition(
            config,
            createLocalCausalTreePartitionFactory({}, this.user, this._device)
        );
    }
}
