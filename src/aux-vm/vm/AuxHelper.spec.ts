import {
    BotAction,
    botAdded,
    createBot,
    botUpdated,
    GLOBALS_BOT_ID,
    LocalActions,
    action,
    toast,
    Sandbox,
    addState,
    botRemoved,
    USERS_DIMENSION,
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
} from '@casual-simulation/aux-common';
import { AuxHelper } from './AuxHelper';
import {
    DeviceAction,
    RemoteAction,
    remote,
} from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';
import { buildFormulaLibraryOptions } from './AuxConfig';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { SubscriptionLike } from 'rxjs';
import { tap } from 'rxjs/operators';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

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
        error = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
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
            }
        );
        const helper = new AuxHelper(partitions, runtime);

        for (let [, partition] of iteratePartitions(partitions)) {
            subs.push(
                partition.onBotsAdded
                    .pipe(
                        tap(e => {
                            if (e.length === 0) {
                                return;
                            }
                            runtime.botsAdded(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e)),
                partition.onBotsRemoved
                    .pipe(
                        tap(e => {
                            if (e.length === 0) {
                                return;
                            }
                            runtime.botsRemoved(e);
                        })
                    )
                    .subscribe(null, (e: any) => console.error(e)),
                partition.onBotsUpdated
                    .pipe(
                        tap(e => {
                            if (e.length === 0) {
                                return;
                            }
                            runtime.botsUpdated(e);
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
            helper.localEvents.subscribe(e => events.push(...e));

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

            expect(Object.keys(helper.botsState)).toEqual(['normal', 'abc']);
            expect(Object.keys(mem.state)).toEqual(['abc']);
            expect(Object.keys(shared.state)).toEqual(['normal']);
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

    describe('createContext()', () => {
        // describe('player.inSheet()', () => {
        //     it('should return true when in builder', async () => {
        //         helper = createHelper(
        //             {
        //                 shared: memory,
        //             },
        //             runtime
        //         );
        //         helper.userId = userId;
        //         const context = helper.createContext();
        //         expect(context.sandbox.library.player.inSheet()).toBe(true);
        //     });
        //     it('should return false when not in builder', async () => {
        //         helper = createHelper(
        //             {
        //                 shared: memory,
        //             },
        //             runtime
        //         );
        //         helper.userId = userId;
        //         const context = helper.createContext();
        //         expect(context.sandbox.library.player.inSheet()).toBe(false);
        //     });
        //     it('should default to not in aux builder or player', async () => {
        //         helper = createHelper({
        //             shared: memory,
        //         });
        //         helper.userId = userId;
        //         const context = helper.createContext();
        //         expect(context.sandbox.library.player.inSheet()).toBe(false);
        //     });
        // });
    });

    describe('transaction()', () => {
        it('should emit local events that are sent via transaction()', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

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

        it('should support player.inSheet() in actions', async () => {
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.updateBot(helper.userBot, {
                tags: {
                    auxSheetPortal: 'sheet',
                },
            });

            await helper.createBot('test', {
                action: '@setTag(this, "#value", player.inSheet())',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(helper.botsState['test'].tags.value).toBe(true);
        });

        it('should emit local events from actions', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e =>
                events.push(
                    ...e.filter(
                        e =>
                            e.type !== 'add_bot' &&
                            e.type !== 'update_bot' &&
                            e.type !== 'remove_bot'
                    )
                )
            );

            await helper.createBot('test', {
                action: '@player.toast("test")',
            });

            await helper.transaction(action('action', ['test'], 'user'));

            expect(events).toEqual([toast('test')]);
        });

        it('should not calculate assignment formulas', async () => {
            let events: LocalActions[] = [];
            helper.localEvents.subscribe(e => events.push(...e));

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
            let events: RemoteAction[] = [];
            helper.remoteEvents.subscribe(e => events.push(...e));

            await helper.transaction(remote(toast('test')));

            expect(events).toEqual([remote(toast('test'))]);
        });

        it('should not batch remote events that have allowBatching set to false', async () => {
            let events: RemoteAction[][] = [];
            helper.remoteEvents.subscribe(e => events.push(e));

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
            helper.deviceEvents.subscribe(e => events.push(...e));

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

        it('should store errors in the error space', async () => {
            await helper.createBot('test', {
                action: '@throw new Error("abc")',
            });

            uuidMock.mockReturnValue('error');
            await helper.transaction(action('action', ['test'], 'user'));

            expect(error.state).toEqual({
                error: {
                    id: 'error',
                    space: 'error',
                    tags: {
                        auxError: true,
                        auxErrorName: 'Error',
                        auxErrorMessage: 'abc',
                        auxErrorStack: expect.any(String),
                        auxErrorBot: 'test',
                        auxErrorTag: 'action',
                    },
                },
            });
        });

        describe('load_bots', () => {
            it('should be able to load bots from the error space', async () => {
                let searchClient = new MemoryBotClient();
                let error = createBotClientPartition({
                    type: 'bot_client',
                    universe: 'universe',
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

                await searchClient.addBots('universe', [
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
                        'error'
                    ),
                });
            });
        });

        describe('paste_state', () => {
            it('should add the given bots to a new dimension', async () => {
                uuidMock
                    .mockReturnValueOnce('gen')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        auxDimensionConfig: 'gen',
                        auxDimensionVisualize: 'surface',
                        auxDimensionX: 0,
                        auxDimensionY: 1,
                        auxDimensionZ: 2,
                    }),
                    bot2: createBot('bot2', {
                        gen: true,
                        genX: 0,
                        genY: 0,
                        test: 'abc',
                    }),
                });
            });

            it('should preserve X and Y positions if a dimension bot is included', async () => {
                uuidMock
                    .mockReturnValueOnce('gen')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                            oldX: 3,
                            oldY: 2,
                            oldZ: 1,
                        }),
                        dimensionBot: createBot('dimensionBot', {
                            auxDimensionConfig: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot1: createBot('bot1', {
                        auxDimensionConfig: 'gen',
                        auxDimensionVisualize: true,
                        auxDimensionX: -1,
                        auxDimensionY: 1,
                        auxDimensionZ: 2,
                        other: 'def',
                    }),
                    bot2: createBot('bot2', {
                        gen: true,
                        genX: 3,
                        genY: 2,
                        genZ: 1,
                        test: 'abc',
                    }),
                });
            });

            it('should check the current state for dimensions if they are not included in the copied state', async () => {
                uuidMock
                    .mockReturnValueOnce('gen')
                    .mockReturnValueOnce('bot1')
                    .mockReturnValueOnce('bot2')
                    .mockReturnValueOnce('bot3');

                await helper.transaction(
                    addState({
                        dimensionBot: createBot('dimensionBot', {
                            auxDimensionConfig: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            oldX: 3,
                            oldY: 2,
                            oldZ: 1,
                        }),
                    },
                    options: {
                        x: -1,
                        y: 1,
                        z: 2,
                    },
                });

                expect(helper.botsState).toEqual({
                    dimensionBot: expect.any(Object),
                    user: expect.any(Object),
                    bot1: expect.objectContaining(
                        createBot('bot1', {
                            auxDimensionConfig: 'gen',
                            auxDimensionVisualize: 'surface',
                            auxDimensionX: -1,
                            auxDimensionY: 1,
                            auxDimensionZ: 2,
                        })
                    ),
                    bot2: expect.objectContaining(
                        createBot('bot2', {
                            gen: true,
                            genX: 0,
                            genY: 0,
                            genSortOrder: 0,
                            test: 'abc',
                        })
                    ),
                });
            });

            it('should add the given bots to the given dimension at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');

                await helper.transaction(
                    addState({
                        dimensionBot: createBot('dimensionBot', {
                            auxDimensionConfig: 'old',
                            auxDimensionVisualize: true,
                            other: 'def',
                        }),
                    })
                );
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                            old: true,
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        dimension: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: {
                        tags: expect.not.objectContaining({
                            old: true,
                        }),
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        funX: 0,
                        funY: 1,
                        funZ: 2,
                        test: 'abc',
                    }),
                });
            });

            it('should add the given bots the given dimension at the given grid position', async () => {
                uuidMock.mockReturnValueOnce('bot2');
                await helper.transaction({
                    type: 'paste_state',
                    state: {
                        botId: createBot('botId', {
                            test: 'abc',
                        }),
                    },
                    options: {
                        x: 0,
                        y: 1,
                        z: 2,
                        dimension: 'fun',
                    },
                });

                expect(helper.botsState).toMatchObject({
                    bot2: createBot('bot2', {
                        fun: true,
                        funX: 0,
                        funY: 1,
                        funZ: 2,
                        test: 'abc',
                    }),
                });
            });
        });

        describe('onUniverseAction()', () => {
            it('should shout an onUniverseAction() call', async () => {
                await helper.createBot('abc', {
                    onUniverseAction: '@setTag(this, "hit", true)',
                });

                await helper.transaction({
                    type: 'go_to_url',
                    url: 'test',
                });

                expect(helper.botsState['abc']).toMatchObject({
                    id: 'abc',
                    tags: {
                        onUniverseAction: '@setTag(this, "hit", true)',
                        hit: true,
                    },
                });
            });

            it('should skip actions that onUniverseAction() rejects', async () => {
                await helper.createBot('abc', {
                    onUniverseAction: '@action.reject(that.action)',
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
                    onUniverseAction: '@action.reject(that.action)',
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
                ['0'],
                ['""'],
                ['null'],
                ['undefined'],
                ['NaN'],
            ];

            it.each(falsyTests)(
                'should allow actions that onUniverseAction() returns %s for',
                async val => {
                    await helper.createBot('abc', {
                        onUniverseAction: `@return ${val};`,
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

            it('should allow actions that onUniverseAction() returns true for', async () => {
                await helper.createBot('abc', {
                    onUniverseAction: '@return true',
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

            it('should allow actions when onUniverseAction() errors out', async () => {
                await helper.createBot('abc', {
                    onUniverseAction: '@throw new Error("Error")',
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
                    onUniverseAction: `@
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
                    onUniverseAction: `@
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
                    onUniverseAction: `@
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

            it('should allow updates to the onUniverseAction() handler by default', async () => {
                await helper.createBot('abc', {});

                await helper.transaction(
                    botUpdated('abc', {
                        tags: {
                            onUniverseAction: `@
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
                        onUniverseAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                    }),
                });
            });

            it('should allow the entire update and not just the onUniverseAction() part', async () => {
                await helper.createBot('abc', {});

                await helper.transaction(
                    botUpdated('abc', {
                        tags: {
                            onUniverseAction: `@
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
                        onUniverseAction: `@
                                if (that.action.type === 'update_bot') {
                                    action.reject(that.action);
                                }
                                return true;
                            `,
                        test: true,
                    }),
                });
            });

            it('should not prevent deleting the globals bot by default', async () => {
                await helper.createBot(GLOBALS_BOT_ID, {});

                await helper.transaction(botRemoved(GLOBALS_BOT_ID));

                expect(helper.botsState[GLOBALS_BOT_ID]).toBeFalsy();
            });

            it('should run once per action event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot('abc', {
                    onUniverseAction: `@
                        if (that.action.type === 'action') {
                            create(null, {
                                test: true
                            });
                        }
                    `,
                });

                await helper.createBot('test', {});

                await helper.transaction(action('test'));

                const matching = helper.objects.filter(o => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });

            it('should run once per update event', async () => {
                uuidMock
                    .mockReturnValueOnce('test1')
                    .mockReturnValueOnce('test2');

                await helper.createBot('abc', {
                    onUniverseAction: `@
                        if (that.action.type === 'update_bot') {
                            create(null, {
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

                const matching = helper.objects.filter(o => 'test' in o.tags);
                expect(matching.length).toBe(1);
            });
        });
    });

    describe('search()', () => {
        // TODO:
        // it.skip('should support player.inSheet()', async () => {
        //     helper = createHelper(
        //         {
        //             shared: memory,
        //         },
        //         runtime
        //     );
        //     helper.userId = userId;
        //     await helper.createBot('test', {
        //         'action()': 'setTag(this, "#value", player.inSheet())',
        //     });
        //     const result = await helper.search('player.inSheet()');
        //     expect(result.result).toBe(true);
        // });
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
        it('should support player.inSheet()', async () => {
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.updateBot(helper.userBot, {
                tags: {
                    auxSheetPortal: 'sheet',
                },
            });

            await helper.createBot('test', {
                'action()': 'setTag(this, "#value", player.inSheet())',
            });

            await helper.formulaBatch([
                'setTag(getBot("id", "test"), "value", player.inSheet())',
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
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toMatchObject({
                id: 'testUser',
                tags: {
                    [USERS_DIMENSION]: true,
                },
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
                    isGuest: false,
                    token: 'abc',
                },
                null
            );

            expect(helper.botsState['testUser']).toEqual({
                id: 'testUser',
                space: 'tempLocal',
                tags: {
                    [USERS_DIMENSION]: true,
                },
            });
        });
    });

    describe('createOrUpdateUserDimensionBot()', () => {
        it('should create a dimension bot for all the users', async () => {
            memory = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            uuidMock.mockReturnValueOnce('dimension');
            await helper.createOrUpdateUserDimensionBot();

            expect(helper.botsState['dimension']).toMatchObject({
                id: 'dimension',
                tags: {
                    ['auxDimensionConfig']: USERS_DIMENSION,
                    ['auxDimensionVisualize']: true,
                },
            });
        });

        it('should not create a dimension bot for all the users if one already exists', async () => {
            memory = createMemoryPartition({
                type: 'memory',
                initialState: {},
            });
            helper = createHelper({
                shared: memory,
            });
            helper.userId = userId;

            await helper.createBot('userDimension', {
                auxDimensionConfig: USERS_DIMENSION,
            });

            uuidMock.mockReturnValueOnce('dimension');
            await helper.createOrUpdateUserDimensionBot();

            expect(helper.botsState['dimension']).toBeUndefined();
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
