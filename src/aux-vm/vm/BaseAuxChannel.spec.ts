import { BaseAuxChannel } from './BaseAuxChannel';
import {
    USERNAME_CLAIM,
    DEVICE_ID_CLAIM,
    SESSION_ID_CLAIM,
    RemoteAction,
    DeviceAction,
    remote,
    DeviceInfo,
} from '@casual-simulation/causal-trees';
import {
    createBot,
    botAdded,
    browseHistory,
} from '@casual-simulation/aux-common';
import { AuxUser } from '../AuxUser';
import { AuxConfig } from './AuxConfig';
import { AuxPartition, MemoryPartition } from '../partitions/AuxPartition';
import {
    PartitionConfig,
    MemoryPartitionConfig,
} from '../partitions/AuxPartitionConfig';
import { createAuxPartition } from '../partitions/AuxPartitionFactories';
import uuid from 'uuid/v4';
import { createMemoryPartition } from '../partitions';
import merge from 'lodash/merge';

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
        memory = createMemoryPartition({ type: 'memory', initialState: {} });
        config = {
            config: {
                isBuilder: false,
                isPlayer: false,
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

        it('should error if unable to construct a partition', async () => {
            config = {
                config: {
                    isBuilder: false,
                    isPlayer: false,
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
        });
    });

    describe('formulaBatch()', () => {
        it('should send remote events', async () => {
            await channel.initAndWait();

            await channel.formulaBatch(['server.browseHistory()']);

            expect(channel.remoteEvents).toEqual([remote(browseHistory())]);
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

    describe('export()', () => {
        beforeEach(async () => {
            config = {
                config: {
                    isBuilder: false,
                    isPlayer: false,
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
    constructor(user: AuxUser, device: DeviceInfo, config: AuxConfig) {
        super(user, config, {});
        this._device = device;
        this.remoteEvents = [];
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        this.remoteEvents.push(...events);
    }

    protected _createPartition(config: PartitionConfig): Promise<AuxPartition> {
        return createAuxPartition(config, cfg => createMemoryPartition(cfg));
    }
}
