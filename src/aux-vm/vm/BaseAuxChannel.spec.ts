import { BaseAuxChannel } from './BaseAuxChannel';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    DeviceAction,
    remote,
    DeviceInfo,
    Action,
} from '@casual-simulation/causal-trees';
import {
    createBot,
    botAdded,
    browseHistory,
    MemoryPartition,
    createMemoryPartition,
    MemoryPartitionConfig,
    PartitionConfig,
    AuxPartition,
    createAuxPartition,
    SearchPartitionClientConfig,
    MemoryBotClient,
    StateUpdatedEvent,
    createPrecalculatedBot,
    BotAction,
    toast,
    createBotClientPartition,
    AuxPartitions,
    action,
    Bot,
    runScript,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { AuxUser } from '../AuxUser';
import { AuxConfig } from './AuxConfig';
import uuid from 'uuid/v4';
import merge from 'lodash/merge';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subject } from 'rxjs';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: AuxChannelImpl;
    let user: AuxUser;
    let device: DeviceInfo;
    let config: AuxConfig;
    let memory: MemoryPartition;

    beforeEach(async () => {
        user = {
            id: 'userId',
            username: 'username',
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
        memory = createMemoryPartition({ type: 'memory', initialState: {} });
        config = {
            config: {
                version: 'v1.0.0',
                versionHash: 'hash',
            },
            partitions: {
                shared: {
                    type: 'memory',
                    partition: memory,
                },
            },
        };

        channel = new AuxChannelImpl(user, device, config);
    });

    describe('init()', () => {
        it('should create a bot for the user', async () => {
            await channel.initAndWait();

            const userBot = channel.helper.userBot;
            expect(userBot).toBeTruthy();
            expect(userBot.tags).toMatchSnapshot();
        });

        it('should set the space on the partitions', async () => {
            await channel.initAndWait();

            const partitions = (<any>channel)._partitions as AuxPartitions;

            expect(partitions.shared.space).toEqual('shared');
        });

        it('should create a user dimension bot', async () => {
            uuidMock.mockReturnValue('dimensionBot');
            await channel.initAndWait();

            const dimensionBot = channel.helper.botsState['dimensionBot'];
            expect(dimensionBot).toBeTruthy();
            expect(dimensionBot.tags).toMatchSnapshot();
        });

        it('should load the builder aux file', async () => {
            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 0,
                            }),
                        }),
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toMatchObject({
                id: 'builder',
                tags: {
                    abc: 'def',
                    builderVersion: 0,
                    builderState: 'Enabled',
                },
            });
        });

        it('should not load builder if bootstrap state was included', async () => {
            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 0,
                            }),
                        }),
                        bootstrapState: {},
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toBeUndefined();
        });

        it('should not overwrite changes to builder from the aux file if the version is not newer', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('builder', {
                        different: true,
                        builderVersion: 2,
                    })
                ),
            ]);

            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 2,
                            }),
                        }),
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toMatchObject({
                id: 'builder',
                tags: {
                    different: true,
                    builderVersion: 2,
                },
            });
        });

        it('should overwrite changes to builder from the aux file if the version is newer', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('builder', {
                        different: true,
                        builderVersion: 2,
                        builderState: 'Disabled',
                    })
                ),
            ]);

            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 3,
                            }),
                        }),
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toMatchObject({
                id: 'builder',
                tags: {
                    different: true,
                    abc: 'def',
                    builderVersion: 3,
                    builderState: 'Disabled',
                },
            });
        });

        it('should enable builder if the builderState tag is not specified on the existing builder', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('builder', {
                        different: true,
                        builderVersion: 2,
                    })
                ),
            ]);

            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 3,
                            }),
                        }),
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toMatchObject({
                id: 'builder',
                tags: {
                    different: true,
                    abc: 'def',
                    builderVersion: 3,
                    builderState: 'Enabled',
                },
            });
        });

        it('should destroy builder if the bootstrap state is included', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('builder', {
                        abc: 'def',
                        builderVersion: 0,
                    })
                ),
            ]);

            channel = new AuxChannelImpl(
                user,
                device,
                merge({}, config, {
                    config: {
                        builder: JSON.stringify({
                            builder: createBot('builder', {
                                abc: 'def',
                                builderVersion: 0,
                            }),
                        }),
                        bootstrapState: {},
                    },
                })
            );
            await channel.initAndWait();

            const builderBot = channel.helper.botsState['builder'];
            expect(builderBot).toBeUndefined();
        });

        it('should error if unable to construct a partition', async () => {
            config = {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: <any>{
                        type: 'remote_causal_tree',
                        id: 'auxId',
                        host: 'host',
                        treeName: 'treeName',
                    },
                },
            };
            channel = new AuxChannelImpl(user, device, config);

            await expect(channel.initAndWait()).rejects.toEqual(
                new Error('[BaseAuxChannel] Unable to build partition: shared')
            );
        });

        it('should keep dimensions in users that define a dimension', async () => {
            await memory.applyEvents([
                botAdded(
                    createBot('user1', {
                        auxPlayerName: 'user',
                        auxDimensionConfig: `_user_user_1`,
                    })
                ),
            ]);

            await channel.initAndWait();

            const userBot = channel.helper.botsState['user1'];
            expect(userBot).toBeTruthy();
            expect(userBot.tags).toEqual({
                auxPlayerName: 'user',
                auxDimensionConfig: '_user_user_1',
            });
        });

        it('should pass the forceSignedScripts config option to the runtime', async () => {
            config = {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                    forceSignedScripts: true,
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        initialState: {},
                    },
                },
            };
            channel = new AuxChannelImpl(user, device, config);

            await channel.initAndWait();

            expect(channel.runtime.forceSignedScripts).toBe(true);
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
            channel.onDeviceEvents.subscribe((e) => deviceEvents.push(...e));

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

        it('should buffer events that are sent before the channel is initialized', async () => {
            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            await channel.sendEvents([toast('abc')]);

            expect(localEvents).toEqual([]);

            await channel.initAndWait();

            let deviceEvents: DeviceAction[] = [];
            channel.onDeviceEvents.subscribe((e) => deviceEvents.push(...e));

            expect(localEvents).toEqual([toast('abc')]);
        });

        it('should wait for the initial state before running actions', async () => {
            // Setup a custom subject for all the onBotsAdded events
            // this lets us control when the memory partition first sends a state
            // update to the channel.
            const _memory = <any>memory;
            const subject = new Subject<StateUpdatedEvent>();
            Object.defineProperty(_memory, 'onStateUpdated', {
                get() {
                    return subject;
                },
            });
            // _memory.onBotsAdded = subject;
            config = {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        partition: memory,
                    },
                },
            };

            channel = new AuxChannelImpl(user, device, config);

            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            await memory.applyEvents([
                botAdded(
                    createBot('test1', {
                        test: '@player.toast("abc");',
                    })
                ),
            ]);

            await channel.sendEvents([action('test')]);

            expect(localEvents).toEqual([]);

            await channel.initAndWait();

            expect(localEvents).toEqual([]);

            subject.next(
                stateUpdatedEvent({
                    test1: createBot('test1', {
                        test: '@player.toast("abc");',
                    }),
                })
            );
            await waitAsync();

            expect(localEvents).toEqual([toast('abc')]);
        });

        it('should wait for the initial state even if the helper is initialized', async () => {
            // Setup a custom subject for all the onBotsAdded events
            // this lets us control when the memory partition first sends a state
            // update to the channel.
            const _memory = <any>memory;
            const subject = new Subject<StateUpdatedEvent>();
            Object.defineProperty(_memory, 'onStateUpdated', {
                get() {
                    return subject;
                },
            });
            config = {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        partition: memory,
                    },
                },
            };

            channel = new AuxChannelImpl(user, device, config);

            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            await memory.applyEvents([
                botAdded(
                    createBot('test1', {
                        test: '@player.toast("abc");',
                    })
                ),
            ]);

            expect(localEvents).toEqual([]);

            await channel.initAndWait();

            await channel.sendEvents([action('test')]);
            expect(localEvents).toEqual([]);

            subject.next(
                stateUpdatedEvent({
                    test1: createBot('test1', {
                        test: '@player.toast("abc");',
                    }),
                })
            );
            await waitAsync();

            expect(localEvents).toEqual([toast('abc')]);
        });

        it('should support tag masks', async () => {
            await channel.initAndWait();

            await channel.sendEvents([
                botAdded({
                    id: 'test',
                    tags: {},
                    masks: {
                        shared: {
                            abc: 'def',
                        },
                    },
                }),
            ]);

            const result = channel.runtime.execute(
                `return getBot("abc", "def").tags.abc`
            );

            expect(memory.state).toEqual({
                userId: expect.anything(),
                dimensionBot: expect.anything(),
                test: {
                    id: 'test',
                    space: 'shared',
                    tags: {},
                    masks: {
                        shared: {
                            abc: 'def',
                        },
                    },
                },
            });
            expect(result.result).toEqual('def');
        });

        describe('load_space', () => {
            it('should handle load_space events', async () => {
                await channel.initAndWait();

                await channel.sendEvents([
                    {
                        type: 'load_space',
                        space: 'tempLocal',
                        config: <MemoryPartitionConfig>{
                            type: 'memory',
                            initialState: {
                                abc: createBot('abc'),
                            },
                        },
                    },
                ]);

                await waitAsync();

                const { abc } = channel.helper.botsState;
                expect(abc).toEqual(createBot('abc', {}, 'tempLocal'));
            });

            it('should not overwrite existing spaces', async () => {
                await channel.initAndWait();

                await channel.sendEvents([
                    {
                        type: 'load_space',
                        space: 'shared',
                        config: <MemoryPartitionConfig>{
                            type: 'memory',
                            initialState: {
                                abc: createBot('abc'),
                            },
                        },
                    },
                ]);

                const { abc } = channel.helper.botsState;
                expect(abc).toBeUndefined();
            });

            it('should handle adding spaces with delayed edit modes', async () => {
                await channel.initAndWait();
                let client = new MemoryBotClient();

                await channel.sendEvents([
                    {
                        type: 'load_space',
                        space: <any>'random',
                        config: <SearchPartitionClientConfig>{
                            type: 'bot_client',
                            client: client,
                            story: 'story',
                        },
                    },
                ]);

                await waitAsync();

                let updates = [] as StateUpdatedEvent[];
                channel.onStateUpdated.subscribe((update) =>
                    updates.push(update)
                );

                let actions = [] as BotAction[];
                channel.onLocalEvents.subscribe((events) =>
                    actions.push(...events)
                );

                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');
                await channel.sendEvents([
                    {
                        type: 'run_script',
                        script:
                            'create({ value: "fun" }); let bot = create({ space: "random", value: 123 }); player.toast(bot)',
                        taskId: null,
                    },
                ]);

                await waitAsync();

                // test2 is not included because the bot space doesn't
                // automatically add all new bots.
                expect(updates).toEqual([
                    {
                        addedBots: ['test1'],
                        removedBots: [],
                        updatedBots: [],
                        state: {
                            test1: createPrecalculatedBot(
                                'test1',
                                {
                                    value: 'fun',
                                },
                                undefined,
                                'shared'
                            ),
                        },
                    },
                ]);

                // the toasted value should be null because the runtime
                // should know that the new partition is delayed instead of immediate
                expect(actions).toContainEqual(toast(null));
            });

            it('should resolve load_space events that have a task id', async () => {
                await channel.initAndWait();

                const task = channel.runtime.context.createTask();
                let resolved = false;
                task.promise.then((val) => {
                    resolved = true;
                });

                await channel.sendEvents([
                    {
                        type: 'load_space',
                        space: 'tempLocal',
                        config: <MemoryPartitionConfig>{
                            type: 'memory',
                            initialState: {
                                abc: createBot('abc'),
                            },
                        },
                        taskId: task.taskId,
                    },
                ]);

                await waitAsync();

                expect(resolved).toBe(true);
            });

            it('should resolve if the space is already loaded', async () => {
                await channel.initAndWait();

                const task = channel.runtime.context.createTask();
                let resolved = false;
                task.promise.then((val) => {
                    resolved = true;
                });

                await channel.sendEvents([
                    {
                        type: 'load_space',
                        space: 'shared',
                        config: <MemoryPartitionConfig>{
                            type: 'memory',
                            initialState: {
                                abc: createBot('abc'),
                            },
                        },
                        taskId: task.taskId,
                    },
                ]);

                await waitAsync();

                expect(resolved).toBe(true);
            });
        });
    });

    describe('shout()', () => {
        it('should execute the given shout and return the results', async () => {
            await channel.initAndWait();

            await channel.sendEvents([
                botAdded(
                    createBot('test1', {
                        getValue: `@return 99;`,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        getValue: `@player.toast("abc");`,
                    })
                ),
            ]);

            const result = await channel.shout('getValue');

            expect(result).toEqual({
                results: [99, undefined],
                actions: [toast('abc')],
            });
        });

        it('should unwrap all promises', async () => {
            await channel.initAndWait();

            await channel.sendEvents([
                botAdded(
                    createBot('test1', {
                        getValue: `@return 99;`,
                    })
                ),
                botAdded(
                    createBot('test2', {
                        getValue: `@player.toast("abc");`,
                    })
                ),
                botAdded(
                    createBot('test3', {
                        getValue: `@await Promise.resolve(); return 'fun';`,
                    })
                ),
            ]);

            const result = await channel.shout('getValue');

            expect(result).toEqual({
                results: [99, undefined, 'fun'],
                actions: [toast('abc')],
            });
        });

        it('should fail when not initialized', async () => {
            expect(channel.shout('getValue')).rejects.toEqual(
                new Error(
                    'Unable to execute a shout without being initialized.'
                )
            );
        });
    });

    describe('formulaBatch()', () => {
        it('should send remote events', async () => {
            await channel.initAndWait();

            await channel.formulaBatch(['remote(player.toast("abc"))']);

            expect(channel.remoteEvents).toEqual([remote(toast('abc'))]);
        });
    });

    describe('export()', () => {
        beforeEach(async () => {
            config = {
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        partition: memory,
                    },
                    tempLocal: {
                        type: 'memory',
                        initialState: {
                            def: createBot('def'),
                        },
                    },
                    private: {
                        type: 'memory',
                        initialState: {
                            private: createBot('private'),
                        },
                        private: true,
                    },
                },
            };

            channel = new AuxChannelImpl(user, device, config);
        });

        it('should only export public bots', async () => {
            uuidMock.mockReturnValue('dimensionBot');
            await channel.initAndWait();

            await channel.sendEvents([botAdded(createBot('test'))]);

            const exported = await channel.export();

            expect(exported).toEqual({
                version: 1,
                state: {
                    dimensionBot: expect.any(Object),
                    userId: expect.any(Object),
                    test: createBot('test', {}, 'shared'),
                    def: createBot('def', {}, 'tempLocal'),
                },
            });
        });

        it('should include the ID, tags, and space properties', async () => {
            uuidMock.mockReturnValue('dimensionBot');
            await channel.initAndWait();

            await channel.sendEvents([botAdded(createBot('test'))]);

            const exported = await channel.export();

            expect(exported).toEqual({
                version: 1,
                state: {
                    dimensionBot: expect.any(Object),
                    userId: expect.any(Object),
                    test: createBot('test', {}, 'shared'),
                    def: createBot('def', {}, 'tempLocal'),
                },
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

    get runtime() {
        return this._runtime;
    }

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
            (cfg) => createMemoryPartition(cfg),
            (config) => createBotClientPartition(config)
        );
    }
}
