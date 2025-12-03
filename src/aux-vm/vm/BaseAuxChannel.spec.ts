/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { BaseAuxChannel } from './BaseAuxChannel';
import type {
    RemoteAction,
    DeviceAction,
    ConnectionInfo,
    Action,
    CurrentVersion,
    StatusUpdate,
    ConnectionIndicator,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    remote,
    ON_ALLOW_COLLABORATION_UPGRADE,
    ON_DISALLOW_COLLABORATION_UPGRADE,
} from '@casual-simulation/aux-common';
import type {
    MemoryPartition,
    MemoryPartitionConfig,
    PartitionConfig,
    AuxPartition,
    StateUpdatedEvent,
    AuxPartitions,
    MemoryPartitionStateConfig,
} from '@casual-simulation/aux-common';
import {
    createBot,
    botAdded,
    createMemoryPartition,
    createAuxPartition,
    toast,
    action,
    stateUpdatedEvent,
    MemoryPartitionImpl,
    asyncResult,
    botUpdated,
} from '@casual-simulation/aux-common';
import type {
    RuntimeActions,
    RuntimeStateVersion,
} from '@casual-simulation/aux-runtime';
import {
    AuxRuntime,
    attachRuntime,
    detachRuntime,
} from '@casual-simulation/aux-runtime';
import type { AuxConfig } from './AuxConfig';
import { v4 as uuid } from 'uuid';
import { merge, cloneDeep } from 'es-toolkit/compat';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { skip, Subject, Subscription } from 'rxjs';
import type { TimeSample } from '@casual-simulation/timesync';
import { TimeSyncController } from '@casual-simulation/timesync';
import type { AsyncResultAction } from '@casual-simulation/aux-common/bots';
import {
    ON_COLLABORATION_ENABLED,
    TEMPORARY_BOT_PARTITION_ID,
    enableCollaboration,
} from '@casual-simulation/aux-common/bots';
import type { AuxSubChannel } from './AuxChannel';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import type { SharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import { createSharedDocument } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';
import {
    createYjsSharedDocument,
    YjsSharedDocument,
} from '@casual-simulation/aux-common/documents/YjsSharedDocument';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: AuxChannelImpl;
    let indicator: ConnectionIndicator;
    let device: ConnectionInfo;
    let config: AuxConfig;
    let memory: MemoryPartition;

    beforeEach(async () => {
        indicator = {
            connectionId: 'userId',
        };
        device = {
            userId: null,
            sessionId: null,
            connectionId: 'userId',
        };
        memory = createMemoryPartition({ type: 'memory', initialState: {} });
        config = {
            configBotId: 'userId',
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

        channel = new AuxChannelImpl(device, config);
    });

    afterEach(() => {
        uuidMock.mockReset();
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

        it('should load the builder aux file', async () => {
            channel = new AuxChannelImpl(
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
                configBotId: 'userId',
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
            channel = new AuxChannelImpl(device, config);

            await expect(channel.initAndWait()).rejects.toEqual(
                new Error('[BaseAuxChannel] Unable to build partition: shared')
            );
        });

        it('should ensure that bots are created for builtin portals', async () => {
            const tempLocal = new MemoryPartitionImpl({
                type: 'memory',
                initialState: {},
            });
            config = {
                configBotId: 'userId',
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                    builtinPortals: ['gridPortal', 'sheetPortal'],
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        partition: memory,
                    },
                    tempLocal: {
                        type: 'memory',
                        partition: tempLocal,
                    },
                },
            };
            channel = new AuxChannelImpl(device, config);

            uuidMock
                .mockReturnValueOnce('authBot')
                .mockReturnValueOnce('uuid1')
                .mockReturnValueOnce('uuid2');

            await channel.initAndWait();

            const gridPortal = channel.helper.botsState['uuid1'];
            const sheetPortal = channel.helper.botsState['uuid2'];
            expect(gridPortal).toEqual(createBot('uuid1', {}, 'tempLocal'));
            expect(sheetPortal).toEqual(createBot('uuid2', {}, 'tempLocal'));

            expect(tempLocal.state['uuid1']).toEqual(gridPortal);
            expect(tempLocal.state['uuid2']).toEqual(sheetPortal);
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

        it('should merge version vectors from different partitions', async () => {
            let shared = new TestPartition({
                type: 'memory',
                initialState: {},
            });
            let other = new TestPartition({
                type: 'memory',
                initialState: {},
            });
            config = {
                configBotId: 'userId',
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                },
                partitions: {
                    shared: <any>{
                        type: 'test',
                        partition: shared,
                    },
                    other: <any>{
                        type: 'test',
                        partition: other,
                    },
                },
            };
            channel = new AuxChannelImpl(device, config);

            let versions = [] as RuntimeStateVersion[];

            await channel.initAndWait();

            channel.onVersionUpdated.subscribe((v) => {
                versions.push(cloneDeep(v));
            });

            shared.onVersionUpdated.next({
                currentSite: 'a',
                remoteSite: 'c',
                vector: {
                    a: 10,
                },
            });

            other.onVersionUpdated.next({
                currentSite: 'b',
                remoteSite: 'd',
                vector: {
                    b: 11,
                },
            });

            shared.onVersionUpdated.next({
                currentSite: 'a',
                remoteSite: 'c',
                vector: {
                    a: 10,
                    c: 20,
                },
            });

            await waitAsync();

            expect(versions).toEqual([
                {
                    localSites: {
                        a: true,
                    },
                    vector: { a: 10 },
                },
                {
                    localSites: {
                        a: true,
                        b: true,
                    },
                    vector: { a: 10, b: 11 },
                },
                {
                    localSites: {
                        a: true,
                        b: true,
                    },
                    vector: { a: 10, b: 11, c: 20 },
                },
            ]);
        });

        it('should use the channel user for the authentication event if the partition does not include a user in the authentication event', async () => {
            const tempLocal = new MemoryPartitionImpl({
                type: 'memory',
                initialState: {},
            });
            config = {
                configBotId: 'userId',
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
            channel = new AuxChannelImpl(device, config);

            let statuses = [] as StatusUpdate[];
            channel.onConnectionStateChanged.subscribe((a) => statuses.push(a));

            uuidMock
                .mockReturnValueOnce('uuid0')
                .mockReturnValueOnce('uuid1')
                .mockReturnValueOnce('uuid2');

            await channel.initAndWait();

            expect(statuses.filter((s) => s.type === 'authentication')).toEqual(
                [
                    {
                        type: 'authentication',
                        authenticated: true,
                    },
                ]
            );
        });

        it('should create a sync controller if a sync configuration is provided', async () => {
            config = {
                configBotId: 'userId',
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                    forceSignedScripts: true,
                    timesync: {},
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        initialState: {},
                    },
                },
            };
            channel = new AuxChannelImpl(device, config);

            await channel.initAndWait();

            expect(!!channel.timesync).toBe(true);
            expect(channel.timesync.initialized).toBe(true);

            channel.unsubscribe();

            expect(channel.timesync.closed).toBe(true);
        });

        it('should update the instLatency and instTimeOffset values in the runtime when the sync controller updates', async () => {
            try {
                jest.useFakeTimers({});
                config = {
                    configBotId: 'userId',
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                        forceSignedScripts: true,
                        timesync: {},
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            initialState: {},
                        },
                    },
                };
                channel = new AuxChannelImpl(device, config);

                await channel.initAndWait();

                expect(!!channel.timesync).toBe(true);
                expect(channel.timesync.initialized).toBe(true);

                jest.advanceTimersByTime(1000);
                await waitAsync();

                expect(channel.timesync.sync.calculatedTimeLatencyMS).toBe(150);
                expect(channel.runtime.context.instLatency).toBe(150);

                expect(channel.timesync.sync.offsetMS).toBe(49);
                expect(channel.timesync.sync.offsetSpreadMS).toBe(0);
                expect(channel.runtime.context.instTimeOffset).toBe(49);
                expect(channel.runtime.context.instTimeOffsetSpread).toBe(0);
            } finally {
                jest.useRealTimers();
            }
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
                    connection: {
                        connectionId: 'deviceId',
                        sessionId: 'sessionId',
                        userId: 'username',
                    },
                    event: botAdded(createBot('def')),
                },
                botAdded(createBot('test')),
                {
                    type: 'device',
                    connection: null,
                    event: botAdded(createBot('abc')),
                },
            ]);

            expect(deviceEvents).toEqual([
                {
                    type: 'device',
                    connection: {
                        connectionId: 'deviceId',
                        sessionId: 'sessionId',
                        userId: 'username',
                    },
                    event: botAdded(createBot('def')),
                },
                {
                    type: 'device',
                    connection: null,
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

        it('should not send events that are uncopiable', async () => {
            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            let toasted = toast('abc');
            toasted.uncopiable = true;

            await channel.initAndWait();

            await channel.sendEvents([toasted]);

            await waitAsync();

            expect(localEvents).toEqual([]);
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
                configBotId: 'userId',
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

            channel = new AuxChannelImpl(device, config);

            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            await memory.applyEvents([
                botAdded(
                    createBot('test1', {
                        test: '@os.toast("abc");',
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
                        test: '@os.toast("abc");',
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
                configBotId: 'userId',
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

            channel = new AuxChannelImpl(device, config);

            let localEvents = [] as Action[];
            channel.onLocalEvents.subscribe((e) => localEvents.push(...e));

            await memory.applyEvents([
                botAdded(
                    createBot('test1', {
                        test: '@os.toast("abc");',
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
                        test: '@os.toast("abc");',
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

            const result = await channel.runtime.execute(
                `return getBot("abc", "def").tags.abc`
            );

            expect(memory.state.test).toEqual({
                id: 'test',
                space: 'shared',
                tags: {},
                masks: {
                    shared: {
                        abc: 'def',
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

        describe('load_shared_document', () => {
            let events: RuntimeActions[];
            let sub: Subscription;

            beforeEach(() => {
                events = [];

                sub = new Subscription();
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should handle load_shared_document events', async () => {
                await channel.initAndWait();

                sub.add(
                    channel.helper.localEvents.subscribe((e) =>
                        events.push(...e)
                    )
                );

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: null,
                        inst: null,
                        branch: null,
                        taskId: 'task1',
                    },
                ]);

                await waitAsync();

                const results = events.filter(
                    (e) => e.type === 'async_result'
                ) as AsyncResultAction[];

                expect(results).toHaveLength(1);

                const result = results[0];
                expect(result.taskId).toBe('task1');
                expect(result.uncopiable).toBe(true);
                expect(result.result).toBeInstanceOf(YjsSharedDocument);
            });

            it('should reuse documents when they target the same location', async () => {
                await channel.initAndWait();

                sub.add(
                    channel.helper.localEvents.subscribe((e) =>
                        events.push(...e)
                    )
                );

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'myBranch',
                        taskId: 'task1',
                    },
                ]);

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'myBranch',
                        taskId: 'task2',
                    },
                ]);

                await waitAsync();

                const results = events.filter(
                    (e) => e.type === 'async_result'
                ) as AsyncResultAction[];

                expect(results).toHaveLength(2);

                const result1 = results[0];
                expect(result1.taskId).toBe('task1');
                expect(result1.uncopiable).toBe(true);
                expect(result1.result).toBeInstanceOf(YjsSharedDocument);

                const result2 = results[1];
                expect(result2.taskId).toBe('task2');
                expect(result2.uncopiable).toBe(true);
                expect(result2.result).toBeInstanceOf(YjsSharedDocument);

                expect(result1.result === result2.result).toBe(true);
            });

            it('should not reuse a document that has been disposed', async () => {
                await channel.initAndWait();

                sub.add(
                    channel.helper.localEvents.subscribe((e) =>
                        events.push(...e)
                    )
                );

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'myBranch',
                        taskId: 'task1',
                    },
                ]);

                await waitAsync();

                let results = events.filter(
                    (e) => e.type === 'async_result'
                ) as AsyncResultAction[];

                expect(results).toHaveLength(1);

                const result1 = results[0];
                expect(result1.taskId).toBe('task1');
                expect(result1.uncopiable).toBe(true);
                expect(result1.result).toBeInstanceOf(YjsSharedDocument);

                result1.result.unsubscribe();

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: 'myRecord',
                        inst: 'myInst',
                        branch: 'myBranch',
                        taskId: 'task2',
                    },
                ]);

                await waitAsync();

                results = events.filter(
                    (e) => e.type === 'async_result'
                ) as AsyncResultAction[];

                expect(results).toHaveLength(2);

                const result2 = results[1];
                expect(result2.taskId).toBe('task2');
                expect(result2.uncopiable).toBe(true);
                expect(result2.result).toBeInstanceOf(YjsSharedDocument);

                expect(result1.result === result2.result).toBe(false);
                expect(result2.result.closed).toBe(false);
            });

            it('should not reuse documents when it doesnt have a location', async () => {
                await channel.initAndWait();

                sub.add(
                    channel.helper.localEvents.subscribe((e) =>
                        events.push(...e)
                    )
                );

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: null,
                        inst: null,
                        branch: null,
                        taskId: 'task1',
                    },
                ]);

                await channel.sendEvents([
                    {
                        type: 'load_shared_document',
                        recordName: null,
                        inst: null,
                        branch: null,
                        taskId: 'task2',
                    },
                ]);

                await waitAsync();

                const results = events.filter(
                    (e) => e.type === 'async_result'
                ) as AsyncResultAction[];

                expect(results).toHaveLength(2);

                const result1 = results[0];
                expect(result1.taskId).toBe('task1');
                expect(result1.uncopiable).toBe(true);
                expect(result1.result).toBeInstanceOf(YjsSharedDocument);

                const result2 = results[1];
                expect(result2.taskId).toBe('task2');
                expect(result2.uncopiable).toBe(true);
                expect(result2.result).toBeInstanceOf(YjsSharedDocument);

                expect(result1.result === result2.result).toBe(false);
            });
        });

        describe('attach_runtime', () => {
            let events: RuntimeActions[];
            let subChannels: AuxSubChannel[];
            let stateUpdates: StateUpdatedEvent[];
            let sub: Subscription;

            beforeEach(() => {
                events = [];
                subChannels = [];
                stateUpdates = [];

                sub = channel.onLocalEvents.subscribe((e) => events.push(...e));
                sub.add(
                    channel.onStateUpdated
                        .pipe(skip(1))
                        .subscribe((u) => stateUpdates.push(u))
                );
                sub.add(
                    channel.onSubChannelAdded.subscribe((s) =>
                        subChannels.push(s)
                    )
                );
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should emit a new sub channel', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                await channel.sendEvents([
                    attachRuntime(runtime, undefined, 'task1'),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);

                const subChannel = subChannels[0];

                expect(await subChannel.getInfo()).toEqual({
                    id: 'runtime1',
                    configBotId: 'newUserId',
                    indicator: {
                        connectionId: 'newUserId',
                    },
                });
                expect(await subChannel.getChannel()).toBeInstanceOf(
                    AuxChannelImpl
                );
            });

            it('new sub channels should be uninitialized', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                await channel.sendEvents([
                    attachRuntime(runtime, undefined, 'task1'),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);

                const subChannel = subChannels[0];
                const c = await subChannel.getChannel();

                expect(await subChannel.getInfo()).toEqual({
                    id: 'runtime1',
                    configBotId: 'newUserId',
                    indicator: {
                        connectionId: 'newUserId',
                    },
                });
                expect(c).toBeInstanceOf(AuxChannelImpl);
                expect(runtime.userId).toBe('newUserId');

                let updates = [] as StateUpdatedEvent[];
                c.onStateUpdated.subscribe((state) => {
                    updates.push(state);
                });

                await c.initAndWait();

                await waitAsync();

                expect(updates.length).toBe(1);
                expect(updates[0]).toMatchObject({
                    state: {
                        test1: {
                            id: 'test1',
                            tags: {
                                abc: 'def',
                                ghi: 'jfk',
                            },
                            values: {
                                abc: 'def',
                                ghi: 'jfk',
                            },
                        },
                    },
                    addedBots: expect.arrayContaining(['test1']),
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should be able to map tags in sub channels', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                await channel.sendEvents([
                    attachRuntime(
                        runtime,
                        {
                            forward: (tag) => {
                                return `test${tag}`;
                            },
                            reverse: (tag) => {
                                return tag.substring('test'.length);
                            },
                        },
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);

                const subChannel = subChannels[0];
                const c = await subChannel.getChannel();

                expect(await subChannel.getInfo()).toEqual({
                    id: 'runtime1',
                    configBotId: 'newUserId',
                    indicator: {
                        connectionId: 'newUserId',
                    },
                });
                expect(c).toBeInstanceOf(AuxChannelImpl);
                expect(runtime.userId).toBe('newUserId');

                let updates = [] as StateUpdatedEvent[];
                c.onStateUpdated.subscribe((state) => {
                    updates.push(state);
                });

                await c.initAndWait();

                await waitAsync();

                expect(updates.length).toBe(1);
                expect(updates[0]).toMatchObject({
                    state: {
                        test1: {
                            id: 'test1',
                            tags: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                            values: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                        },
                    },
                    addedBots: expect.arrayContaining(['test1']),
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should always map tags the same way', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                let mapCount = 0;
                await channel.sendEvents([
                    attachRuntime(
                        runtime,
                        {
                            forward: (tag) => {
                                mapCount += 1;
                                return `test${mapCount}${tag}`;
                            },
                            reverse: (tag) => {
                                return tag.substring('test'.length);
                            },
                        },
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);

                const subChannel = subChannels[0];
                const c = await subChannel.getChannel();

                expect(await subChannel.getInfo()).toEqual({
                    id: 'runtime1',
                    configBotId: 'newUserId',
                    indicator: {
                        connectionId: 'newUserId',
                    },
                });
                expect(c).toBeInstanceOf(AuxChannelImpl);
                expect(runtime.userId).toBe('newUserId');

                let updates = [] as StateUpdatedEvent[];
                c.onStateUpdated.subscribe((state) => {
                    updates.push(state);
                });

                await c.initAndWait();

                await waitAsync();

                expect(updates.length).toBe(1);
                expect(updates[0]).toMatchObject({
                    state: {
                        test1: {
                            id: 'test1',
                            tags: {
                                test1abc: 'def',
                                test2ghi: 'jfk',
                            },
                            values: {
                                test1abc: 'def',
                                test2ghi: 'jfk',
                            },
                        },
                        test2: {
                            id: 'test2',
                            tags: {
                                test1abc: 'def',
                                test2ghi: 'jfk',
                            },
                            values: {
                                test1abc: 'def',
                                test2ghi: 'jfk',
                            },
                        },
                    },
                    addedBots: expect.arrayContaining(['test1', 'test2']),
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should be able to update mapped tags', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                await channel.sendEvents([
                    attachRuntime(
                        runtime,
                        {
                            forward: (tag) => {
                                return `test${tag}`;
                            },
                            reverse: (tag) => {
                                return tag.substring('test'.length);
                            },
                        },
                        'task1'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);

                const subChannel = subChannels[0];
                const c = await subChannel.getChannel();

                expect(await subChannel.getInfo()).toEqual({
                    id: 'runtime1',
                    configBotId: 'newUserId',
                    indicator: {
                        connectionId: 'newUserId',
                    },
                });
                expect(c).toBeInstanceOf(AuxChannelImpl);
                expect(runtime.userId).toBe('newUserId');

                let updates = [] as StateUpdatedEvent[];
                c.onStateUpdated.subscribe((state) => {
                    updates.push(state);
                });

                await c.initAndWait();

                c.sendEvents([
                    botUpdated('test1', {
                        tags: {
                            testabc: 111,
                        },
                    }),
                ]);

                await waitAsync();

                expect(runtime.currentState['test1'].tags.abc).toEqual(111);

                expect(updates.length).toBe(2);
                expect(updates[0]).toMatchObject({
                    state: {
                        test1: {
                            id: 'test1',
                            tags: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                            values: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                        },
                        test2: {
                            id: 'test2',
                            tags: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                            values: {
                                testabc: 'def',
                                testghi: 'jfk',
                            },
                        },
                    },
                    addedBots: expect.arrayContaining(['test1', 'test2']),
                    removedBots: [],
                    updatedBots: [],
                });
                expect(updates[1]).toMatchObject({
                    state: {
                        test1: {
                            tags: {
                                testabc: 111,
                            },
                            values: {
                                testabc: 111,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test1'],
                });
            });
        });

        describe('detach_runtime', () => {
            let events: RuntimeActions[];
            let subChannels: AuxSubChannel[];
            let removedChannels: string[];
            let stateUpdates: StateUpdatedEvent[];
            let sub: Subscription;

            beforeEach(() => {
                events = [];
                subChannels = [];
                removedChannels = [];
                stateUpdates = [];

                sub = channel.onLocalEvents.subscribe((e) => events.push(...e));
                sub.add(
                    channel.onStateUpdated
                        .pipe(skip(1))
                        .subscribe((u) => stateUpdates.push(u))
                );
                sub.add(
                    channel.onSubChannelAdded.subscribe((s) =>
                        subChannels.push(s)
                    )
                );
                sub.add(
                    channel.onSubChannelRemoved.subscribe((s) => {
                        removedChannels.push(s);
                    })
                );
            });

            afterEach(() => {
                sub.unsubscribe();
            });

            it('should emit the ID of the removed channel', async () => {
                const runtime = new AuxRuntime(
                    {
                        alpha: true,
                        hash: 'hash',
                        major: 9,
                        minor: 9,
                        patch: 9,
                        playerMode: 'player',
                        version: 'v9.9.9-alpha',
                    },
                    {
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        isCollaborative: false,
                        allowCollaborationUpgrade: false,
                        ab1BootstrapUrl: 'bootstrap',
                        comID: null,
                    }
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                            ghi: 'jfk',
                        }),
                    })
                );

                await channel.initAndWait();

                uuidMock
                    .mockReturnValueOnce('newUserId')
                    .mockReturnValueOnce('runtime1');

                await channel.sendEvents([
                    attachRuntime(runtime, undefined, 'task1'),
                ]);

                await waitAsync();

                expect(events).toEqual([asyncResult('task1', null)]);

                expect(subChannels.length).toBe(1);
                expect(removedChannels).toEqual([]);

                await channel.sendEvents([detachRuntime(runtime, 'task2')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([asyncResult('task2', null)]);
                expect(removedChannels).toEqual(['runtime1']);
            });
        });

        describe('enable_collaboration', () => {
            let tempPartition: MemoryPartition;
            let memoryEnableCollaboration: jest.Mock<any>;
            let tempEnableCollaboration: jest.Mock<any>;

            beforeEach(() => {
                tempPartition = new MemoryPartitionImpl({
                    type: 'memory',
                    initialState: {},
                });
                memoryEnableCollaboration = memory.enableCollaboration =
                    jest.fn();
                tempEnableCollaboration = tempPartition.enableCollaboration =
                    jest.fn();
                config = {
                    configBotId: 'userId',
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                        device: {
                            isCollaborative: false,
                            allowCollaborationUpgrade: true,
                            ab1BootstrapUrl: 'url',
                            supportsAR: false,
                            supportsVR: false,
                            supportsDOM: false,
                            comID: null,
                        },
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            partition: memory,
                        },
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            type: 'memory',
                            partition: tempPartition,
                        },
                    },
                };

                channel = new AuxChannelImpl(device, config);
            });

            it('should enable collaboration on each partition', async () => {
                await channel.initAndWait();

                await channel.sendEvents([enableCollaboration()]);

                await waitAsync();

                expect(memoryEnableCollaboration).toHaveBeenCalled();
                expect(tempEnableCollaboration).toHaveBeenCalled();
            });

            it('should resolve the task once every partition resolves', async () => {
                await channel.initAndWait();

                let resolve1: () => void;
                let promise1 = new Promise<void>((r) => (resolve1 = r));

                let resolve2: () => void;
                let promise2 = new Promise<void>((r) => (resolve2 = r));

                const task = channel.runtime.context.createTask();
                let resolved = false;
                task.promise.then((val) => {
                    resolved = true;
                });

                memoryEnableCollaboration.mockReturnValueOnce(promise1);
                tempEnableCollaboration.mockReturnValueOnce(promise2);

                await memory.applyEvents([
                    botAdded(
                        createBot('test', {
                            onCollaborationEnabled: `@os.toast("enabled");`,
                        })
                    ),
                ]);

                await waitAsync();

                await channel.sendEvents([enableCollaboration(task.taskId)]);

                await waitAsync();

                let actions: Action[] = [];
                channel.onLocalEvents.subscribe((e) => actions.push(...e));

                expect(memoryEnableCollaboration).toHaveBeenCalled();
                expect(tempEnableCollaboration).toHaveBeenCalled();

                expect(resolved).toBe(false);

                resolve1();
                resolve2();

                await waitAsync();

                expect(resolved).toBe(true);
                expect(
                    channel.runtime.context.device.allowCollaborationUpgrade
                ).toBe(false);
                expect(channel.runtime.context.device.isCollaborative).toBe(
                    true
                );

                expect(actions).toEqual([toast('enabled')]);
            });

            it('should do nothing if collaboration is already enabled', async () => {
                config = {
                    configBotId: 'userId',
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                        device: {
                            isCollaborative: true,
                            allowCollaborationUpgrade: false,
                            ab1BootstrapUrl: 'url',
                            supportsAR: false,
                            supportsVR: false,
                            supportsDOM: false,
                            comID: null,
                        },
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            partition: memory,
                        },
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            type: 'memory',
                            partition: tempPartition,
                        },
                    },
                };

                channel = new AuxChannelImpl(device, config);

                await channel.initAndWait();

                const task = channel.runtime.context.createTask();
                let resolved = false;
                task.promise.then((val) => {
                    resolved = true;
                });

                await channel.sendEvents([enableCollaboration(task.taskId)]);

                await waitAsync();

                expect(memoryEnableCollaboration).not.toHaveBeenCalled();
                expect(tempEnableCollaboration).not.toHaveBeenCalled();

                expect(resolved).toBe(true);
            });

            it('should do nothing if no configuration device info is present', async () => {
                config = {
                    configBotId: 'userId',
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            partition: memory,
                        },
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            type: 'memory',
                            partition: tempPartition,
                        },
                    },
                };

                channel = new AuxChannelImpl(device, config);

                await channel.initAndWait();

                const task = channel.runtime.context.createTask();
                let resolved = false;
                task.promise.then((val) => {
                    resolved = true;
                });

                await channel.sendEvents([enableCollaboration(task.taskId)]);

                await waitAsync();

                expect(memoryEnableCollaboration).not.toHaveBeenCalled();
                expect(tempEnableCollaboration).not.toHaveBeenCalled();

                expect(resolved).toBe(true);
            });

            it('should reject with an error if collaboration is disabled and not able to be enabled', async () => {
                config = {
                    configBotId: 'userId',
                    config: {
                        version: 'v1.0.0',
                        versionHash: 'hash',
                        device: {
                            isCollaborative: false,
                            allowCollaborationUpgrade: false,
                            ab1BootstrapUrl: 'url',
                            supportsAR: false,
                            supportsVR: false,
                            supportsDOM: false,
                            comID: null,
                        },
                    },
                    partitions: {
                        shared: {
                            type: 'memory',
                            partition: memory,
                        },
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            type: 'memory',
                            partition: tempPartition,
                        },
                    },
                };

                channel = new AuxChannelImpl(device, config);

                await channel.initAndWait();

                const task = channel.runtime.context.createTask();
                let rejectedErr: any;
                task.promise.catch((val) => {
                    rejectedErr = val;
                });

                await channel.sendEvents([enableCollaboration(task.taskId)]);

                await waitAsync();

                expect(memoryEnableCollaboration).not.toHaveBeenCalled();
                expect(tempEnableCollaboration).not.toHaveBeenCalled();

                expect(rejectedErr).toEqual(
                    new Error('Collaboration upgrades are not allowed.')
                );
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
                        getValue: `@os.toast("abc");`,
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
                        getValue: `@os.toast("abc");`,
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

            await channel.formulaBatch(['remote(os.toast("abc"))']);

            expect(channel.remoteEvents).toEqual([remote(toast('abc'))]);
        });
    });

    describe('export()', () => {
        beforeEach(async () => {
            config = {
                configBotId: 'userId',
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

            channel = new AuxChannelImpl(device, config);
        });

        it('should only export public bots', async () => {
            uuidMock.mockReturnValue('dimensionBot');
            await channel.initAndWait();

            await channel.sendEvents([botAdded(createBot('test'))]);

            const exported = await channel.export();

            expect(exported).toEqual({
                version: 1,
                state: {
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
                    userId: expect.any(Object),
                    test: createBot('test', {}, 'shared'),
                    def: createBot('def', {}, 'tempLocal'),
                },
            });
        });
    });

    describe('updateDevice()', () => {
        let memoryEnableCollaboration: jest.Mock<any>;
        beforeEach(async () => {
            indicator = {
                connectionId: 'userId',
            };
            device = {
                userId: null,
                sessionId: null,
                connectionId: 'userId',
            };
            memory = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            memoryEnableCollaboration = memory.enableCollaboration = jest.fn();
            config = {
                configBotId: 'userId',
                config: {
                    version: 'v1.0.0',
                    versionHash: 'hash',
                    device: {
                        ab1BootstrapUrl: 'url',
                        supportsAR: false,
                        supportsVR: false,
                        supportsDOM: false,
                        allowCollaborationUpgrade: false,
                        isCollaborative: false,
                        comID: null,
                    },
                },
                partitions: {
                    shared: {
                        type: 'memory',
                        partition: memory,
                    },
                },
            };

            channel = new AuxChannelImpl(device, config);
        });

        it('should update the device info', async () => {
            await channel.initAndWait();

            const { result: device } = await channel.runtime.execute(
                'return os.device()'
            );

            expect(device).toEqual({
                ab1BootstrapUrl: 'url',
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                allowCollaborationUpgrade: false,
                isCollaborative: false,
                comID: null,
            });

            await channel.updateDevice({
                ab1BootstrapUrl: 'other',
                supportsAR: true,
                supportsVR: true,
                supportsDOM: true,
                allowCollaborationUpgrade: true,
                isCollaborative: true,
                comID: null,
            });

            const { result: device2 } = await channel.runtime.execute(
                'return os.device()'
            );

            expect(device2).toEqual({
                ab1BootstrapUrl: 'other',
                supportsAR: true,
                supportsVR: true,
                supportsDOM: true,
                allowCollaborationUpgrade: true,
                isCollaborative: true,
                comID: null,
            });
        });

        it('should emit a onCollaborationEnabled shout when isCollaborative is set to true', async () => {
            await channel.initAndWait();

            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        [ON_COLLABORATION_ENABLED]: '@os.toast("abc");',
                    })
                ),
            ]);

            await waitAsync();

            let actions: Action[] = [];
            channel.onLocalEvents.subscribe((e) => actions.push(...e));

            await channel.updateDevice({
                ab1BootstrapUrl: 'other',
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                allowCollaborationUpgrade: true,
                isCollaborative: true,
                comID: null,
            });

            await waitAsync();

            expect(actions).toEqual([toast('abc')]);
        });

        it('should emit a onAllowCollaborationUpgrade shout when allowCollaborationUpgrade is set to true', async () => {
            await channel.initAndWait();

            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        [ON_ALLOW_COLLABORATION_UPGRADE]: '@os.toast("abc");',
                    })
                ),
            ]);

            await waitAsync();

            let actions: Action[] = [];
            channel.onLocalEvents.subscribe((e) => actions.push(...e));

            await channel.updateDevice({
                ab1BootstrapUrl: 'other',
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                allowCollaborationUpgrade: true,
                isCollaborative: false,
                comID: null,
            });

            await waitAsync();

            expect(actions).toEqual([toast('abc')]);
        });

        it('should emit a onDisallowCollaborationUpgrade shout when allowCollaborationUpgrade is set to false', async () => {
            config.config.device.allowCollaborationUpgrade = true;
            await channel.initAndWait();

            await memory.applyEvents([
                botAdded(
                    createBot('test', {
                        [ON_DISALLOW_COLLABORATION_UPGRADE]:
                            '@os.toast("abc");',
                    })
                ),
            ]);

            await waitAsync();

            let actions: Action[] = [];
            channel.onLocalEvents.subscribe((e) => actions.push(...e));

            await channel.updateDevice({
                ab1BootstrapUrl: 'other',
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                allowCollaborationUpgrade: false,
                isCollaborative: false,
                comID: null,
            });

            await waitAsync();

            expect(actions).toEqual([toast('abc')]);
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

    private _device: ConnectionInfo;

    get runtime() {
        return this._runtime;
    }

    constructor(device: ConnectionInfo, config: AuxConfig) {
        super(config, {});
        this._device = device;
        this.remoteEvents = [];
    }

    protected async _sendRemoteEvents(events: RemoteAction[]): Promise<void> {
        this.remoteEvents.push(...events);
    }

    protected _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition> {
        return createAuxPartition(
            config,
            services,
            (cfg) => createMemoryPartition(cfg),
            (config) => createTestPartition(config)
        );
    }

    protected _createSharedDocument(
        config: SharedDocumentConfig,
        services: AuxPartitionServices
    ): Promise<SharedDocument> {
        return createSharedDocument(config, services, createYjsSharedDocument);
    }

    protected _createTimeSyncController() {
        if (this._config.config.timesync) {
            return new TimeSyncController({
                closed: false,
                sampleServerTime() {
                    return Promise.resolve({
                        clientRequestTime: 800,
                        currentTime: 1100,
                        serverReceiveTime: 999,
                        serverTransmitTime: 999,
                    } as TimeSample);
                },
                unsubscribe: jest.fn(),
            });
        }
        return super._createTimeSyncController();
    }

    protected _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new AuxChannelImpl(this._device, config);
        channel._runtime = runtime;
        return channel;
    }
}

/**
 * Attempts to create a MemoryPartition from the given config.
 * @param config The config.
 */
export function createTestPartition(config: any): any {
    if (config.type === 'test') {
        return config.partition;
    }
    return undefined;
}

class TestPartition extends MemoryPartitionImpl {
    get onVersionUpdated(): Subject<CurrentVersion> {
        return super.onVersionUpdated as Subject<CurrentVersion>;
    }

    constructor(config: MemoryPartitionStateConfig) {
        super(config);
    }
}
