import {
    BotAction,
    botAdded,
    createBot,
    botUpdated,
    LocalActions,
    action,
    toast,
    addState,
    botRemoved,
    runScript,
    ON_RUN_ACTION_NAME,
    loadBots,
    MemoryPartition,
    createMemoryPartition,
    MemoryBotClient,
    createBotClientPartition,
    AuxRuntime,
    AuxPartitions,
    iteratePartitions,
    clearSpace,
    createCausalRepoClientPartition,
    unlockSpace,
    asyncError,
    createCertificate,
    signTag,
    revokeCertificate,
    setSpacePassword,
    updatedBot,
    Bot,
} from '@casual-simulation/aux-common';
import { bot, tag, value } from '@casual-simulation/aux-common/aux-format-2';
import { AuxHelper } from './AuxHelper';
import {
    DeviceAction,
    RemoteAction,
    remote,
    CausalRepoClient,
    deviceInfo,
    MemoryConnectionClient,
    WATCH_BRANCH,
    AddAtomsEvent,
    ADD_ATOMS,
    atom,
    atomId,
    remoteResult,
    RemoteActions,
    remoteError,
    AUTHENTICATE_BRANCH_WRITES,
    SET_BRANCH_PASSWORD,
} from '@casual-simulation/causal-trees';
import { v4 as uuid } from 'uuid';
import {
    waitAsync,
    wait,
} from '@casual-simulation/aux-common/test/TestHelpers';
import { SubscriptionLike, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MemoryConnection } from '../../causal-tree-server/MemoryConnectionServer';
import { TestScriptBotFactory } from '@casual-simulation/aux-common/runtime/test/TestScriptBotFactory';
import { keypair } from '../../aux-common/node_modules/@casual-simulation/crypto';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('AuxHelper', () => {
    let userId: string = 'user';
    let memory: MemoryPartition;
    let error: MemoryPartition;
    // let runtime: AuxRuntime;
    let helper: AuxHelper;
    let subs: SubscriptionLike[];

    beforeEach(async () => {
        subs = [];
        uuidMock.mockReset();
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        memory.space = 'shared';
        error = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        error.space = 'error';
        helper = createHelper({
            shared: memory,
            error: error,
        });
        helper.userId = userId;

        await memory.applyEvents([botAdded(createBot('user'))]);
    });

    afterEach(() => {
        for (let sub of subs) {
            sub.unsubscribe();
        }
    });

    function createHelper(partitions: AuxPartitions) {
        const runtime = new AuxRuntime(
            {
                hash: 'hash',
                major: 1,
                minor: 0,
                patch: 0,
                version: 'v1.0.0',
            },
            {
                supportsAR: false,
                supportsVR: false,
                isCollaborative: true,
                ab1BootstrapUrl: 'ab1Bootstrap',
            }
        );
        const helper = new AuxHelper(partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            subs.push(
                partition.onStateUpdated
                    .pipe(
                        tap((e) => {
                            runtime.stateUpdated(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e))
            );
        }

        runtime.userId = userId;

        return helper;
    }

    it('should not produce sandbox contexts', async () => {
        helper = createHelper({
            shared: memory,
        });
        helper.userId = userId;

        const context: any = helper.createContext();
        expect(context.sandbox).toBeUndefined();
    });

    describe('partitions', () => {
        it('should exclude partitions which dont have their bot from the bot state', () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
            });

            expect(helper.botsState).toEqual({
                test: createBot('test', {}, 'shared'),
            });
            expect(Object.keys(helper.botsState)).toEqual(['test']);
        });

        it('should send local events for the events that are returned from the partition', async () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', undefined, <any>'abc'),
                    },
                }),
            });
            helper.userId = 'test';

            let events: BotAction[] = [];
            helper.localEvents.subscribe((e) => events.push(...e));

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: 123,
                    },
                })
            );

            await waitAsync();

            expect(events).toEqual([
                botUpdated('test', {
                    tags: {
                        test: 123,
                    },
                }),
            ]);
        });

        it('should place bots in partitions based on the bot space', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
                TEST: mem,
            });

            await helper.createBot('abcdefghijklmnop', undefined, <any>'TEST');

            expect(Object.keys(helper.botsState)).toEqual(['abcdefghijklmnop']);
            expect(Object.keys(mem.state)).toEqual(['abcdefghijklmnop']);
        });

        it('should send create_certificate actions to the shared partition', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: shared,
                TEST: mem,
            });

            const sharedSpy = jest.spyOn(shared, 'applyEvents');
            const memSpy = jest.spyOn(mem, 'applyEvents');
            const keys = keypair('password');
            await helper.transaction(
                createCertificate(
                    {
                        keypair: keys,
                        signingPassword: 'password',
                    },
                    'test1'
                )
            );

            expect(sharedSpy).toBeCalledWith([
                createCertificate(
                    {
                        keypair: keys,
                        signingPassword: 'password',
                    },
                    'test1'
                ),
            ]);
            expect(memSpy).not.toBeCalledWith([
                createCertificate(
                    {
                        keypair: keys,
                        signingPassword: 'password',
                    },
                    'test1'
                ),
            ]);
        });

        it('should send sign_tag actions to the shared partition', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: shared,
                TEST: mem,
            });

            const sharedSpy = jest.spyOn(shared, 'applyEvents');
            const memSpy = jest.spyOn(mem, 'applyEvents');
            await helper.transaction(
                signTag('test1', 'password', 'test2', 'tag', 'value', 'task1')
            );

            expect(sharedSpy).toBeCalledWith([
                signTag('test1', 'password', 'test2', 'tag', 'value', 'task1'),
            ]);
            expect(memSpy).not.toBeCalledWith([
                signTag('test1', 'password', 'test2', 'tag', 'value', 'task1'),
            ]);
        });

        it('should send revoke_certificate actions to the shared partition', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: shared,
                TEST: mem,
            });

            const sharedSpy = jest.spyOn(shared, 'applyEvents');
            const memSpy = jest.spyOn(mem, 'applyEvents');
            await helper.transaction(
                revokeCertificate('test1', 'password', 'test2')
            );

            expect(sharedSpy).toBeCalledWith([
                revokeCertificate('test1', 'password', 'test2'),
            ]);
            expect(memSpy).not.toBeCalledWith([
                revokeCertificate('test1', 'password', 'test2'),
            ]);
        });

        it('should ignore bots going to partitions that dont exist', async () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
            });

            await helper.createBot('abcdefghijklmnop', undefined, <any>'TEST');
            expect(Object.keys(helper.botsState)).toEqual([]);
        });

        it('should prevent partitions from overriding other partitions', async () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    },
                }),
                TEST: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', {
                            bad: 'thing',
                        }),
                    },
                }),
            });

            expect(helper.botsState).toEqual({
                test: createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    'shared'
                ),
            });
        });

        it('should split add_state events into the correct partitions', async () => {
            let mem = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: shared,
                TEST: mem,
            });

            await helper.transaction(
                addState({
                    abc: createBot('abc', {}, <any>'TEST'),
                    normal: createBot('normal', {}),
                })
            );

            await waitAsync();

            expect(Object.keys(helper.botsState)).toEqual(['normal', 'abc']);
            expect(Object.keys(mem.state)).toEqual(['abc']);
            expect(Object.keys(shared.state)).toEqual(['normal']);
        });

        it('should split new bot tag masks into the correct partitions', async () => {
            let test = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            test.space = 'TEST';
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            shared.space = 'shared';
            helper = createHelper({
                shared: shared,
                TEST: test,
            });

            await helper.transaction(
                botAdded({
                    id: 'test',
                    tags: {},
                    masks: {
                        shared: {
                            abc: 'def',
                        },
                        TEST: {
                            num: 123,
                        },
                    },
                })
            );

            await waitAsync();

            expect(shared.state).toEqual({
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
            expect(test.state).toEqual({
                test: {
                    masks: {
                        TEST: {
                            num: 123,
                        },
                    },
                },
            });
        });

        it('should split updated tag masks into the correct partitions', async () => {
            let test = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            test.space = 'TEST';
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            shared.space = 'shared';
            helper = createHelper({
                shared: shared,
                TEST: test,
            });

            await helper.transaction(
                botAdded(createBot('test')),
                botUpdated('test', {
                    masks: {
                        shared: {
                            abc: 'def',
                        },
                        TEST: {
                            num: 123,
                        },
                    },
                })
            );

            await waitAsync();

            expect(shared.state).toEqual({
                test: {
                    id: 'test',
                    space: 'shared',
                    masks: {
                        shared: {
                            abc: 'def',
                        },
                    },
                },
            });
            expect(test.state).toEqual({
                test: {
                    masks: {
                        TEST: {
                            num: 123,
                        },
                    },
                },
            });
        });

        it('should be able to update normal tags that have tag masks', async () => {
            let test = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            test.space = 'TEST';
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            shared.space = 'shared';
            helper = createHelper({
                shared: shared,
                TEST: test,
            });

            await helper.transaction(
                botAdded({
                    id: 'test',
                    tags: {},
                    masks: {
                        TEST: {
                            abc: 'def',
                        },
                    },
                })
            );

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        abc: 123,
                    },
                })
            );

            await waitAsync();

            expect(shared.state).toEqual({
                test: {
                    id: 'test',
                    space: 'shared',
                    tags: {
                        abc: 123,
                    },
                },
            });
        });

        it('should be able to update tag masks without affecting the normal tags', async () => {
            let test = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            test.space = 'TEST';
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            shared.space = 'shared';
            helper = createHelper({
                shared: shared,
                TEST: test,
            });

            await helper.transaction(
                botAdded({
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        TEST: {
                            abc: 'def',
                        },
                    },
                })
            );

            await helper.transaction(
                botUpdated('test', {
                    masks: {
                        TEST: {
                            abc: 'de',
                        },
                    },
                })
            );

            await waitAsync();

            expect(shared.state).toEqual({
                test: {
                    id: 'test',
                    space: 'shared',
                    tags: {
                        abc: 123,
                    },
                },
            });

            expect(test.state).toEqual({
                test: {
                    masks: {
                        TEST: {
                            abc: 'de',
                        },
                    },
                },
            });
        });

        it('should set the correct space on bots from partitions', async () => {
            let TEST = createMemoryPartition({
                type: 'memory',
                initialState: {
                    abc: createBot('abc', {}),
                    def: createBot('def', {}, <any>'wrong'),
                },
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {
                    normal: createBot('normal', {}),
                },
            });
            helper = createHelper({
                shared: shared,
                TEST: TEST,
            });

            expect(helper.botsState).toEqual({
                abc: createBot('abc', {}, <any>'TEST'),
                def: createBot('def', {}, <any>'TEST'),
                normal: createBot('normal', {}, 'shared'),
            });
            expect(TEST.state).toEqual({
                abc: createBot('abc'),
                def: createBot('def', {}, <any>'wrong'),
            });
            expect(shared.state).toEqual({
                normal: createBot('normal'),
            });
        });

        it('should send updates that occur in the same batch as an added bot to the correct partition', async () => {
            let TEST = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            let shared = createMemoryPartition({
                type: 'memory',
                initialState: {
                    userId: createBot('userId'),
                },
            });
            shared.space = 'shared';
            TEST.space = 'TEST';
            helper = createHelper({
                shared: shared,
                TEST: TEST,
            });
            helper.userId = 'userId';

            await helper.transaction(
                botAdded(
                    createBot(
                        'bot1',
                        {
                            abc: 'def',
                        },
                        <any>'TEST'
                    )
                ),
                botUpdated('bot1', {
                    tags: {
                        newTag: 123,
                    },
                })
            );

            expect(TEST.state).toEqual({
                bot1: createBot(
                    'bot1',
                    {
                        abc: 'def',
                        newTag: 123,
                    },
                    <any>'TEST'
                ),
            });
            expect(shared.state).toEqual({
                userId: createBot('userId'),
            });
            expect(helper.botsState).toEqual({
                bot1: createBot(
                    'bot1',
                    {
                        abc: 'def',
                        newTag: 123,
                    },
                    <any>'TEST'
                ),
                userId: createBot('userId', undefined, 'shared'),
            });
        });

        it('should ignore bots in partitions that are just tag masks', () => {
            helper = createHelper({
                def: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: <any>{
                            masks: {
                                incorrect: 1,
                            },
                        },
                    },
                }),
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: <any>{
                            masks: {
                                incorrect: 2,
                            },
                        },
                    },
                }),
                xyz: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test', {
                            correct: true,
                        }),
                    },
                }),
            });

            expect(helper.botsState).toEqual({
                test: {
                    id: 'test',
                    space: <any>'xyz',
                    tags: {
                        correct: true,
                    },
                    masks: {},
                },
            });
            expect(Object.keys(helper.botsState)).toEqual(['test']);
        });

        it('should send update_bot events to the partition that stores the full bot', async () => {
            const abc = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: <any>{
                        masks: {
                            abc: {
                                other: true,
                            },
                        },
                    },
                },
            });
            const shared = createMemoryPartition({
                type: 'memory',
                initialState: {
                    test: createBot('test'),
                },
            });
            helper = createHelper({
                abc,
                shared,
            });
            helper.userId = 'test';

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: 123,
                    },
                })
            );

            await waitAsync();

            expect(abc.state).toEqual({
                test: <any>{
                    masks: {
                        abc: {
                            other: true,
                        },
                    },
                },
            });
            expect(shared.state).toEqual({
                test: {
                    id: 'test',
                    tags: {
                        test: 123,
                    },
                    masks: {
                        abc: {
                            other: true,
                        },
                    },
                },
            });
        });

        describe('addPartition()', () => {
            it('should add the bots from the partition to the helper', () => {
                helper = createHelper({
                    shared: createMemoryPartition({
                        type: 'memory',
                        initialState: {
                            abc: createBot('abc', {
                                num: 123,
                            }),
                        },
                    }),
                });

                expect(helper.botsState).toEqual({
                    abc: createBot(
                        'abc',
                        {
                            num: 123,
                        },
                        'shared'
                    ),
                });

                helper.addPartition(
                    'test',
                    createMemoryPartition({
                        type: 'memory',
                        initialState: {
                            def: createBot('def', {
                                other: 'thing',
                            }),
                        },
                    })
                );

                expect(helper.botsState).toEqual({
                    abc: createBot(
                        'abc',
                        {
                            num: 123,
                        },
                        'shared'
                    ),
                    def: createBot(
                        'def',
                        {
                            other: 'thing',
                        },
                        <any>'test'
                    ),
                });
            });
        });
    });

    describe('publicBotsState', () => {
        it('should return the bots state from all the public partitions', async () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                    },
                    private: false,
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        abc: createBot('abc'),
                    },
                    private: true,
                }),
            });

            expect(helper.publicBotsState).toEqual({
                test: createBot('test', {}, 'shared'),
            });
            expect(Object.keys(helper.publicBotsState)).toEqual(['test']);
        });
    });

    describe('userBot', () => {
        it('should return the bot that has the same ID as the user ID', async () => {
            const bot = memory.state['user'];
            const user = helper.userBot;

            expect(user).toEqual({
                ...bot,
                space: 'shared',
            });
        });
    });

    describe('objects', () => {
        it('should return active objects', async () => {
            const objs = helper.objects;

            expect(objs).toEqual([helper.userBot]);
        });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe((e) => events.push(...e));

            await helper.transaction(toast('test'));

            expect(events).toEqual([toast('test')]);
        });

        it('should run action events', async () => {
            await helper.createBot('test', {
                action: '@setTag(this, "#hit", true)',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.hit).toBe(true);
        });

        it('should run script events', async () => {
            await helper.createBot('test', {});

            await helper.transaction(
                runScript(`setTag(getBot("#id", "test"), "#hit", true)`)
            );

            expect(helper.botsState['test'].tags.hit).toBe(true);
        });

        it('should not issue a onRun() shout when a script is run', async () => {
            await helper.createBot('test', {
                [ON_RUN_ACTION_NAME]: '@tags.script = that;',
            });

            await helper.transaction(runScript(`let a = true;`));

            expect(helper.botsState['test'].tags.script).toBeUndefined();
        });

        it('should support os.inSheet() in actions', async () => {
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.updateBot(helper.userBot, {
                tags: {
                    sheetPortal: 'sheet',
                },
            });

            await helper.createBot('test', {
                action: '@setTag(this, "#value", os.inSheet())',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.value).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe((e) =>
                events.push(
                    ...e.filter(
                        (e) =>
                            e.type !== 'add_bot' &&
                            e.type !== 'update_bot' &&
                            e.type !== 'remove_bot'
                    )
                )
            );

            await helper.createBot('test', {
                action: '@os.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should not calculate assignment formulas', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe((e) => events.push(...e));

            await helper.createBot('test', {});

            await helper.transaction(
                botUpdated('test', {
                    tags: {
                        test: ':="abc"',
                    },
                })
            );

            expect(helper.botsState['test']).toMatchObject({
                id: 'test',
                tags: {
                    test: ':="abc"',
                },
            });
        });

        it('should emit remote events that are sent via transaction()', async () => {
            let events: RemoteActions[] = [];
            helper.remoteEvents.subscribe((e) => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });

        it('should emit remote_result events that are sent via transaction()', async () => {
            let events: RemoteActions[] = [];
            helper.remoteEvents.subscribe((e) => events.push(...e));

            await helper.transaction(remoteResult('test'));

            expect(events).toEqual([remoteResult('test')]);
        });

        it('should emit remote_error events that are sent via transaction()', async () => {
            let events: RemoteActions[] = [];
            helper.remoteEvents.subscribe((e) => events.push(...e));

            await helper.transaction(remoteError('test'));

            expect(events).toEqual([remoteError('test')]);
        });

        it('should not batch remote events that have allowBatching set to false', async () => {
            let events: RemoteActions[][] = [];
            helper.remoteEvents.subscribe((e) => events.push(e));

            await helper.transaction(
                remote(toast('test'), {}, false),
                remote(toast('batched1'), {}, true),
                remote(toast('abc'), {}, false),
                remote(toast('batched2'), {}, true)
            );

            expect(events).toEqual([
                [remote(toast('test'), {}, false)],
                [remote(toast('abc'), {}, false)],
                [
                    remote(toast('batched1'), {}, true),
                    remote(toast('batched2'), {}, true),
                ],
            ]);
        });

        it('should emit device events that are sent via transaction()', async () => {
            let events: DeviceAction[] = [];
            helper.deviceEvents.subscribe((e) => events.push(...e));

            await helper.transaction({
                type: 'device',
                device: null,
                event: toast('test'),
            });

            expect(events).toEqual([
                {
                    type: 'device',
                    device: null,
                    event: toast('test'),
                },
            ]);
        });

        describe('load_bots', () => {
            it('should be able to load bots from the error space', async () => {
                let searchClient = new MemoryBotClient();
                let error = createBotClientPartition({
                    type: 'bot_client',
                    server: 'server',
                    client: searchClient,
                });
                helper = createHelper({
                    shared: createMemoryPartition({
                        type: 'memory',
                        initialState: {},
                    }),
                    error: error,
                });
                helper.userId = userId;

                await searchClient.addBots('server', [
                    createBot('test1', {
                        abc: 'def',
                    }),
                ]);

                await helper.transaction(
                    loadBots('error', [
                        {
                            tag: 'abc',
                            value: 'def',
                        },
                    ])
                );

                await waitAsync();

                expect(helper.botsState).toEqual({
                    test1: createBot(
                        'test1',
                        {
                            abc: 'def',
                        },
                        'error' as any
                    ),
                });
            });
        });

        describe('clear_space', () => {
            it('should be able to clear a space', async () => {
                let searchClient = new MemoryBotClient();
                let error = createBotClientPartition({
                    type: 'bot_client',
                    server: 'server',
                    client: searchClient,
                });
                helper = createHelper({
                    shared: createMemoryPartition({
                        type: 'memory',
                        initialState: {},
                    }),
                    error: error,
                });
                helper.userId = userId;

                await searchClient.addBots('server', [
                    createBot('test1', {
                        abc: 'def',
                    }),
                ]);

                await helper.transaction(clearSpace('error'));

                await waitAsync();

                expect(searchClient.servers['server']).toEqual({});
            });
        });

        describe('unlock_space', () => {
            it('should be able to unlock a space', async () => {
                let connection = new MemoryConnectionClient();
                let client = new CausalRepoClient(connection);
                let addAtoms = new Subject<AddAtomsEvent>();
                connection.events.set(ADD_ATOMS, addAtoms);

                let admin = await createCausalRepoClientPartition(
                    {
                        type: 'causal_repo_client',
                        branch: 'server',
                        client: client,
                        static: true,
                    },
                    {
                        id: userId,
                        username: 'username',
                        name: 'name',
                        token: 'token',
                    }
                );

                helper = createHelper({
                    shared: createMemoryPartition({
                        type: 'memory',
                        initialState: {},
                    }),
                    admin: admin,
                });
                helper.userId = userId;

                connection.connect();
                admin.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                addAtoms.next({
                    branch: 'server',
                    atoms: [bot1, tag1, value1],
                });

                await waitAsync();

                await helper.transaction(unlockSpace('admin', '3342'));

                await waitAsync();

                expect(connection.sentMessages.slice(1)).toEqual([
                    {
                        name: AUTHENTICATE_BRANCH_WRITES,
                        data: {
                            branch: 'server',
                            password: '3342',
                        },
                    },
                ]);
            });

            it('should be rejected if sent to a non-existant space', async () => {
                let events = [] as BotAction[];

                helper.localEvents.subscribe((e) => events.push(...e));
                await helper.transaction(
                    unlockSpace(<any>'missing', 'passcode', 123)
                );

                await waitAsync();

                expect(events).toContainEqual(
                    asyncError(
                        123,
                        new Error(
                            `The action was sent to a space that was not found.`
                        )
                    )
                );
            });
        });

        describe('set_space_password', () => {
            it('should be able to set a space password', async () => {
                let connection = new MemoryConnectionClient();
                let client = new CausalRepoClient(connection);
                let addAtoms = new Subject<AddAtomsEvent>();
                connection.events.set(ADD_ATOMS, addAtoms);

                let admin = await createCausalRepoClientPartition(
                    {
                        type: 'causal_repo_client',
                        branch: 'server',
                        client: client,
                        static: true,
                    },
                    {
                        id: userId,
                        username: 'username',
                        name: 'name',
                        token: 'token',
                    }
                );

                helper = createHelper({
                    shared: createMemoryPartition({
                        type: 'memory',
                        initialState: {},
                    }),
                    admin: admin,
                });
                helper.userId = userId;

                connection.connect();
                admin.connect();

                const bot1 = atom(atomId('a', 1), null, bot('bot1'));
                const tag1 = atom(atomId('a', 2), bot1, tag('tag1'));
                const value1 = atom(atomId('a', 3), tag1, value('abc'));

                addAtoms.next({
                    branch: 'server',
                    atoms: [bot1, tag1, value1],
                });

                await waitAsync();

                await helper.transaction(
                    setSpacePassword('admin', '3342', 'password')
                );

                await waitAsync();

                expect(connection.sentMessages.slice(1)).toEqual([
                    {
                        name: SET_BRANCH_PASSWORD,
                        data: {
                            branch: 'server',
                            oldPassword: '3342',
                            newPassword: 'password',
                        },
                    },
                ]);
            });

            it('should be rejected if sent to a non-existant space', async () => {
                let events = [] as BotAction[];

                helper.localEvents.subscribe((e) => events.push(...e));
                await helper.transaction(
                    setSpacePassword(<any>'missing', 'passcode', 'new', 123)
                );

                await waitAsync();

                expect(events).toContainEqual(
                    asyncError(
                        123,
                        new Error(
                            `The action was sent to a space that was not found.`
                        )
                    )
                );
            });
        });

        describe('onServerAction()', () => {
            it('should shout an onServerAction() call', async () => {
                await helper.createBot('abc', {
                    onServerAction: '@setTag(this, "hit", true)',
                });

                await helper.transaction({
                    type: 'go_to_url',
                    url: 'test',
                });

                await waitAsync();

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: {
                        onServerAction: '@setTag(this, "hit", true)',
                        hit: true,
                    },
                });
            });

            it('should skip actions that onServerAction() rejects', async () => {
                await helper.createBot('abc', {
                    onServerAction: '@action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should allow rejecting rejections', async () => {
                await helper.createBot('abc', {
                    onServerAction: '@action.reject(that.action)',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            const falsyTests = [
                ['0'] as const,
                ['""'] as const,
                ['null'] as const,
                ['undefined'] as const,
                ['NaN'] as const,
            ];

            it.each(falsyTests)(
                'should allow actions that onServerAction() returns %s for',
                async (val) => {
                    await helper.createBot('abc', {
                        onServerAction: `@return ${val};`,
                    });

                    await helper.createBot('test', {});

                    await helper.transaction(
                        botUpdated('test', {
                            tags: {
                                updated: true,
                            },
                        })
                    );

                    expect(helper.botsState['test']).toMatchObject({
                        id: 'test',
                        tags: expect.objectContaining({
                            updated: true,
                        }),
                    });
                }
            );

            it('should allow actions that onServerAction() returns true for', async () => {
                await helper.createBot('abc', {
                    onServerAction: '@return true',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should allow actions when onServerAction() errors out', async () => {
                await helper.createBot('abc', {
                    onServerAction: '@throw new Error("Error")',
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: {
                        updated: true,
                    },
                });
            });

            it('should be able to filter based on action type', async () => {
                await helper.createBot('abc', {
                    onServerAction: `@
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('test', {
                        tags: {
                            updated: true,
                        },
                    })
                );

                expect(helper.botsState['test']).toMatchObject({
                    id: 'test',
                    tags: expect.not.objectContaining({
                        updated: true,
                    }),
                });
            });

            it('should filter actions from inside shouts', async () => {
                await helper.createBot('abc', {
                    onServerAction: `@
                        if (that.action.type === 'update_bot') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                    'test()': 'setTag(this, "abc", true)',
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: expect.not.objectContaining({
                        abc: true,
                    }),
                });
            });

            it('should be able to filter out actions before they are run', async () => {
                await helper.createBot('abc', {
                    onServerAction: `@
                        if (that.action.type === 'action') {
                            action.reject(that.action);
                        }
                        return true;
                    `,
                    'test()': 'setTag(this, "abc", true)',
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: expect.not.objectContaining({
                        abc: true,
                    }),
                });
            });

            it('should allow updates to the onServerAction() handler by default', async () => {
                await helper.createBot('abc', {});

                await helper.transaction(
                    botUpdated('abc', {
                        tags: {
                            onServerAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        },
                    })
                );

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: expect.objectContaining({
                        onServerAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                    }),
                });
            });

            it('should allow the entire update and not just the onServerAction() part', async () => {
                await helper.createBot('abc', {});

                await helper.transaction(
                    botUpdated('abc', {
                        tags: {
                            onServerAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                            test: true,
                        },
                    })
                );

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: expect.objectContaining({
                        onServerAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        test: true,
                    }),
                });
            });

            it('should run once per action event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot('abc', {
                    onServerAction: `@
                        if (that.action.type === 'action') {
                            create({
                                test: true
                            });
                        }
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                await waitAsync();

                const matching = helper.objects.filter((o) => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });

            it('should run once per update event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot('abc', {
                    onServerAction: `@
                        if (that.action.type === 'update_bot') {
                            create({
                                test: true
                            });
                        }
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(
                    botUpdated('abc', {
                        tags: {
                            update: 123,
                        },
                    })
                );

                const matching = helper.objects.filter((o) => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });
        });
    });

    describe('getTags()', () => {
        it('should return the full list of tags sorted alphabetically', async () => {
            await helper.createBot('test', {
                abc: 'test1',
                xyz: 'test2',
            });

            await helper.createBot('test2', {
                '123': 456,
                def: 'test1',
                xyz: 'test2',
            });

            const tags = helper.getTags();

            expect(tags).toEqual(['123', 'abc', 'def', 'xyz']);
        });
    });

    describe('formulaBatch()', () => {
        it('should support os.inSheet()', async () => {
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.updateBot(helper.userBot, {
                tags: {
                    sheetPortal: 'sheet',
                },
            });

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", os.inSheet())',
            });

            await helper.formulaBatch([
                'setTag(getBot("id", "test"), "value", os.inSheet())',
            ]);

            await waitAsync();

            expect(helper.botsState['test'].tags.value).toBe(true);
        });
    });

    describe('createOrUpdateUserBot()', () => {
        it('should create a bot for the user', async () => {
            memory = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.createOrUpdateUserBot(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toMatchObject({
                id: 'testUser',
                tags: {},
            });
        });

        it('should put the bot in the tempLocal partition if it is available', async () => {
            memory = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
                tempLocal: createMemoryPartition({
                    type: 'memory',
                    initialState: {},
                }),
            });
            helper.userId = userId;

            await helper.createOrUpdateUserBot(
                {
                    id: 'testUser',
                    username: 'username',
                    name: 'test',
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toEqual({
                id: 'testUser',
                space: 'tempLocal',
                tags: {},
            });
        });
    });

    describe('exportBots()', () => {
        it('should only export bots with the given IDs', () => {
            helper = createHelper({
                shared: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        test: createBot('test'),
                        test1: createBot('test1'),
                        test2: createBot('test2'),
                    },
                    private: false,
                }),
                abc: createMemoryPartition({
                    type: 'memory',
                    initialState: {
                        abc: createBot('abc'),
                    },
                    private: true,
                }),
            });

            const exported = helper.exportBots(['test', 'abc']);

            expect(exported).toEqual({
                version: 1,
                state: {
                    test: createBot('test', {}, 'shared'),
                    abc: createBot('abc', {}, <any>'abc'),
                },
            });
        });
    });
});
