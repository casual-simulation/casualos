import { MemoryPartition, createMemoryPartition } from '../partitions';
import { AuxRuntime } from './AuxRuntime';
import {
    BotAction,
    createBot,
    createPrecalculatedBot,
    toast,
    botAdded,
    botRemoved,
} from '../bots';
import { botActionsTests } from '../bots/test/BotActionsTests';
import uuid from 'uuid/v4';
import { waitAsync } from '../test/TestHelpers';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AuxRuntime', () => {
    let memory: MemoryPartition;
    let runtime: AuxRuntime;
    let events: BotAction[][];

    beforeEach(() => {
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        runtime = new AuxRuntime();

        events = [];

        runtime.onActions.subscribe(a => events.push(a));
    });

    describe('botsAdded()', () => {
        it('should return a state update for the new bot', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
                createBot('test2', {
                    num: 123,
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 'def',
                    }),
                    test2: createPrecalculatedBot('test2', {
                        num: 123,
                    }),
                },
                addedBots: ['test', 'test2'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should return a state update that ignores bots added in a previous update', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
            ]);

            const update2 = runtime.botsAdded([
                createBot('test2', {
                    num: 123,
                }),
            ]);

            expect(update2).toEqual({
                state: {
                    test2: createPrecalculatedBot('test2', {
                        num: 123,
                    }),
                },
                addedBots: ['test2'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should overwrite bots with the same ID', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
            ]);

            const update2 = runtime.botsAdded([
                createBot('test', {
                    abc: 123,
                }),
            ]);

            expect(update2).toEqual({
                state: {
                    test: createPrecalculatedBot('test', {
                        abc: 123,
                    }),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should include the space the bot was in', () => {
            const update = runtime.botsAdded([
                createBot(
                    'test',
                    {
                        abc: 'def',
                    },
                    'history'
                ),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            abc: 'def',
                        },
                        undefined,
                        'history'
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        describe('numbers', () => {
            it('should calculate number values', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        num: '123.145',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                num: 123.145,
                            },
                            {
                                num: '123.145',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should handle numbers that start with a dot', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        num: '.145',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                num: 0.145,
                            },
                            {
                                num: '.145',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('booleans', () => {
            it('should calculate boolean values', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        value1: 'true',
                        value2: 'false',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                value1: true,
                                value2: false,
                            },
                            {
                                value1: 'true',
                                value2: 'false',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('arrays', () => {
            it('should calculate array values', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        value: '[true, false, hello, 1.23, .35]',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                value: [true, false, 'hello', 1.23, 0.35],
                            },
                            {
                                value: '[true, false, hello, 1.23, .35]',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should upgrade the tag to a formula if it contains a formula', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        value: '[true, false, ="hello", 1.23, .35]',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                value: [true, false, 'hello', 1.23, 0.35],
                            },
                            {
                                value: '[true, false, ="hello", 1.23, .35]',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('dependencies', () => {
            it('should support calculating tags that depend on all other bots', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots().length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                numBots: 2,
                            },
                            {
                                numBots: '=getBots().length',
                            }
                        ),
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                    },
                    addedBots: ['test', 'test2'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should support calculating tags that depend on the ID tag', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("id", "test2").length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                numBots: 1,
                            },
                            {
                                numBots: '=getBots("id", "test2").length',
                            }
                        ),
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                    },
                    addedBots: ['test', 'test2'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should automatically re-calculate tags that depend on all other bots', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots().length',
                    }),
                ]);

                const update = runtime.botsAdded([
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 2,
                            },
                        },
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                    },
                    addedBots: ['test2'],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });

            it('should automatically re-calculate tags that depend on the new bot', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("num").length',
                    }),
                ]);

                const update = runtime.botsAdded([
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 1,
                            },
                        },
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                    },
                    addedBots: ['test2'],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });
        });
    });

    describe('botsRemoved()', () => {
        it('should return a state update for the removed bots', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
                createBot('test2', {
                    num: 123,
                }),
                createBot('test3', {
                    value: true,
                }),
                createBot('test4', {
                    tag1: 'test',
                    tag2: 'other',
                }),
            ]);

            const update2 = runtime.botsRemoved(['test', 'test2']);

            expect(update2).toEqual({
                state: {
                    test: null,
                    test2: null,
                },
                addedBots: [],
                removedBots: ['test', 'test2'],
                updatedBots: [],
            });
        });

        describe('dependencies', () => {
            it('should support calculating tags that depend on all other bots', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots().length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                const update = runtime.botsRemoved(['test2']);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 1,
                            },
                        },
                        test2: null,
                    },
                    addedBots: [],
                    removedBots: ['test2'],
                    updatedBots: ['test'],
                });
            });

            it('should support calculating tags that depend on the ID tag', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("id", "test2").length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                const update = runtime.botsRemoved(['test2']);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 0,
                            },
                        },
                        test2: null,
                    },
                    addedBots: [],
                    removedBots: ['test2'],
                    updatedBots: ['test'],
                });
            });

            it('should automatically re-calculate tags when a dependent tag was added to a bot', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("num").length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                const update = runtime.botsRemoved(['test2']);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 0,
                            },
                        },
                        test2: null,
                    },
                    addedBots: [],
                    removedBots: ['test2'],
                    updatedBots: ['test'],
                });
            });
        });
    });

    describe('botsUpdated()', () => {
        it('should return a state update for the updated bot', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
                createBot('test2', {
                    num: 123,
                }),
                createBot('test3', {
                    value: true,
                }),
                createBot('test4', {
                    tag1: 'test',
                    tag2: 'other',
                }),
            ]);

            const update2 = runtime.botsUpdated([
                {
                    bot: createBot('test', {
                        abc: 'def',
                        other: true,
                    }),
                    tags: ['other'],
                },
                {
                    bot: createBot('test2', {
                        num: 456,
                    }),
                    tags: ['num'],
                },
            ]);

            expect(update2).toEqual({
                state: {
                    test: {
                        tags: {
                            other: true,
                        },
                        values: {
                            other: true,
                        },
                    },
                    test2: {
                        tags: {
                            num: 456,
                        },
                        values: {
                            num: 456,
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test', 'test2'],
            });
        });

        it('should re-compile changed formulas', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                }),
                createBot('test2', {
                    num: '=123',
                }),
            ]);

            const update2 = runtime.botsUpdated([
                {
                    bot: createBot('test2', {
                        num: '=456',
                    }),
                    tags: ['num'],
                },
            ]);

            expect(update2).toEqual({
                state: {
                    test2: {
                        tags: {
                            num: '=456',
                        },
                        values: {
                            num: 456,
                        },
                    },
                },
                addedBots: [],
                removedBots: [],
                updatedBots: ['test2'],
            });
        });

        describe('numbers', () => {
            it('should calculate number values', () => {
                runtime.botsAdded([
                    createBot('test', {
                        num: '123.145',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            num: '145.123',
                        }),
                        tags: ['num'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                num: '145.123',
                            },
                            values: {
                                num: 145.123,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });

            it('should handle numbers that start with a dot', () => {
                runtime.botsAdded([
                    createBot('test', {
                        num: '145',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            num: '.145',
                        }),
                        tags: ['num'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                num: '.145',
                            },
                            values: {
                                num: 0.145,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });
        });

        describe('booleans', () => {
            it('should calculate boolean values', () => {
                runtime.botsAdded([
                    createBot('test', {
                        value1: 'true',
                        value2: 'false',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            value1: 'false',
                            value2: 'true',
                        }),
                        tags: ['value1', 'value2'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                value1: 'false',
                                value2: 'true',
                            },
                            values: {
                                value1: false,
                                value2: true,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });
        });

        describe('arrays', () => {
            it('should calculate array values', () => {
                runtime.botsAdded([
                    createBot('test', {
                        value: '[true, false, hello, 1.23, .35]',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            value: '[false, true, 1.23, hello]',
                        }),
                        tags: ['value'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                value: '[false, true, 1.23, hello]',
                            },
                            values: {
                                value: [false, true, 1.23, 'hello'],
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });

            it('should recalculate the array when the formula changes', () => {
                runtime.botsAdded([
                    createBot('test', {
                        value: '[true, false, ="hello", 1.23, .35]',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            value: '[false, true, 1.23, ="hello1"]',
                        }),
                        tags: ['value'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                value: '[false, true, 1.23, ="hello1"]',
                            },
                            values: {
                                value: [false, true, 1.23, 'hello1'],
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });
        });

        describe('dependencies', () => {
            it('should support calculating tags that depend on all other bots', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots().length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            numBots: '=getBots().length + 1',
                        }),
                        tags: ['numBots'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                numBots: '=getBots().length + 1',
                            },
                            values: {
                                numBots: 3,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });

            it('should support calculating tags that depend on the ID tag', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("id", "test2").length',
                    }),
                    createBot('test2', {
                        num: 123,
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test', {
                            numBots: '=getBots("id", "test2").length + 1',
                        }),
                        tags: ['numBots'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            tags: {
                                numBots: '=getBots("id", "test2").length + 1',
                            },
                            values: {
                                numBots: 2,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test'],
                });
            });

            it('should automatically re-calculate tags when a dependent tag was added to a bot', () => {
                runtime.botsAdded([
                    createBot('test', {
                        numBots: '=getBots("num").length',
                    }),
                    createBot('test2', {}),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('test2', {
                            num: 123,
                        }),
                        tags: ['num'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        test: {
                            values: {
                                numBots: 1,
                            },
                        },
                        test2: {
                            tags: {
                                num: 123,
                            },
                            values: {
                                num: 123,
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['test2', 'test'],
                });
            });
        });
    });

    describe('shout()', () => {
        it('should execute all the listeners that match the given event name and produce the resulting actions', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast("hi1")',
                }),
                createBot('test2', {
                    hello: '@player.toast("hi2")',
                }),
                createBot('test3', {}),
            ]);
            runtime.shout('hello', null);

            await waitAsync();

            expect(events).toEqual([[toast('hi1'), toast('hi2')]]);
        });

        it('should execute all the listeners that match the given event name among the given IDs and produce the resulting actions', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast("hi1")',
                }),
                createBot('test2', {
                    hello: '@player.toast("hi2")',
                }),
                createBot('test3', {}),
            ]);
            runtime.shout('hello', ['test2', 'test3']);

            await waitAsync();

            expect(events).toEqual([[toast('hi2')]]);
        });

        describe('bot_added', () => {
            it('should produce an event when a bot is created', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        create: '@create({ abc: "def" })',
                    }),
                ]);
                runtime.shout('create');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botAdded(
                            createBot('uuid', {
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });

            it('should add the created bot to the runtime state', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        create: `@create({ "shout": "@player.toast('abc')" })`,
                    }),
                ]);
                runtime.shout('create');
                runtime.shout('shout');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botAdded(
                            createBot('uuid', {
                                shout: "@player.toast('abc')",
                            })
                        ),
                    ],
                    [toast('abc')],
                ]);
            });
        });

        describe('bot_removed', () => {
            it('should produce an event when a bot is deleted', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        delete: '@destroy(this)',
                    }),
                ]);
                runtime.shout('delete');

                await waitAsync();

                expect(events).toEqual([[botRemoved('test1')]]);
            });

            it('should remove the bot from the runtime state', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        delete: '@destroy(this)',
                        hello: '@player.toast("hi")',
                    }),
                ]);
                runtime.shout('delete');
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[botRemoved('test1')], []]);
            });
        });
    });

    describe('formulas', () => {
        it('should pre-calculate simple formulas', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    abc: '=123',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            abc: 123,
                        },
                        {
                            abc: '=123',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        describe('variables', () => {
            it('should define a bot variable which equals this', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        formula: '=bot === this',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                formula: true,
                            },
                            {
                                formula: '=bot === this',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should define a tagName variable which equals the name of the tag that the formula was defined in', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        formula: '=tagName',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                formula: 'formula',
                            },
                            {
                                formula: '=tagName',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should define a tags variable that equals this.tags', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        formula: '=tags === this.tags',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                formula: true,
                            },
                            {
                                formula: '=tags === this.tags',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should define a raw variable that equals this.raw', () => {
                const update = runtime.botsAdded([
                    createBot('test', {
                        formula: '=raw === this.raw',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                formula: true,
                            },
                            {
                                formula: '=raw === this.raw',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it.skip('should define a creator variable which is the bot that created this', () => {
                runtime.botsAdded([createBot('test', {})]);

                const update = runtime.botsAdded([
                    createBot('test2', {
                        auxCreator: 'test',
                        formula: '=creator.id',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test2',
                            {
                                formula: 'test',
                            },
                            {
                                formula: '=creator.id',
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            describe('tags', () => {
                it('should contain precalculated the tag values', () => {
                    const update = runtime.botsAdded([
                        createBot('test', {
                            formula: '=this.tags.num1 + this.tags.num2',
                            num1: '123',
                            num2: '456',
                        }),
                    ]);

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    formula: 123 + 456,
                                    num1: 123,
                                    num2: 456,
                                },
                                {
                                    formula: '=this.tags.num1 + this.tags.num2',
                                    num1: '123',
                                    num2: '456',
                                }
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                    });
                });
            });

            describe('raw', () => {
                it('should contain original tag values', () => {
                    const update = runtime.botsAdded([
                        createBot('test', {
                            formula: '=this.raw.num1 + this.raw.num2',
                            num1: '123',
                            num2: '456',
                        }),
                    ]);

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    formula: '123456',
                                    num1: 123,
                                    num2: 456,
                                },
                                {
                                    formula: '=this.raw.num1 + this.raw.num2',
                                    num1: '123',
                                    num2: '456',
                                }
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                    });
                });
            });

            describe('this', () => {
                it('should have an ID property', () => {
                    const update = runtime.botsAdded([
                        createBot('test', {
                            formula: '=this.id',
                        }),
                    ]);

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    formula: 'test',
                                },
                                {
                                    formula: '=this.id',
                                }
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                    });
                });

                it('should have a space property', () => {
                    const update = runtime.botsAdded([
                        createBot(
                            'test',
                            {
                                formula: '=this.space',
                            },
                            'history'
                        ),
                    ]);

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    formula: 'history',
                                },
                                {
                                    formula: '=this.space',
                                },
                                'history'
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                    });
                });
            });
        });

        const quoteCases = [['‘', '’'], ['“', '”']];

        it.each(quoteCases)(
            'should support curly quotes by converting them to normal quotes',
            (openQuote: string, closeQuote: string) => {
                const bot1 = createBot('test');
                bot1.tags.formula = `=${openQuote}Hello, World${closeQuote}`;

                const update = runtime.botsAdded([bot1]);

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                formula: 'Hello, World',
                            },
                            bot1.tags
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                });
            }
        );

        it('should unwrap bots to their original values', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=this',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: createBot('test', {
                                formula: '=this',
                            }),
                        },
                        {
                            formula: '=this',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should convert errors to copiable values', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=throw new Error("hello")',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: 'Error: hello',
                        },
                        {
                            formula: '=throw new Error("hello")',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should support using the original error in formula references', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=throw new Error("hello")',
                    formula2: '=tags.formula.message',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: 'Error: hello',
                            formula2: 'hello',
                        },
                        {
                            formula: '=throw new Error("hello")',
                            formula2: '=tags.formula.message',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should prevent editing the bot while in a formula', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=tags.abc = 123',
                    abc: 'def',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: 123,
                            abc: 'def',
                        },
                        {
                            formula: '=tags.abc = 123',
                            abc: 'def',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });

        describe('getBots()', () => {
            it('should get the list of bots in the runtime', () => {
                const update = runtime.botsAdded([
                    createBot('test3', {}),
                    createBot('test2', {}),
                    createBot('test1', {
                        formula: '=getBots()',
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test1: createPrecalculatedBot(
                            'test1',
                            {
                                formula: [
                                    createBot('test1', {
                                        formula: '=getBots()',
                                    }),
                                    createBot('test2'),
                                    createBot('test3'),
                                ],
                            },
                            {
                                formula: '=getBots()',
                            }
                        ),
                        test2: createPrecalculatedBot('test2'),
                        test3: createPrecalculatedBot('test3'),
                    },
                    addedBots: ['test3', 'test2', 'test1'],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should get the list of bots with the given tag', () => {
                const update = runtime.botsAdded([
                    createBot('test3', {
                        hello: true,
                    }),
                    createBot('test2', {
                        hello: true,
                    }),
                    createBot('test1', {
                        formula: `=getBots("#hello")`,
                    }),
                ]);

                expect(update).toEqual({
                    state: {
                        test1: createPrecalculatedBot(
                            'test1',
                            {
                                formula: [
                                    createBot('test2', { hello: true }),
                                    createBot('test3', { hello: true }),
                                ],
                            },
                            {
                                formula: `=getBots("#hello")`,
                            }
                        ),
                        test2: createPrecalculatedBot('test2', { hello: true }),
                        test3: createPrecalculatedBot('test3', { hello: true }),
                    },
                    addedBots: ['test3', 'test2', 'test1'],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });
    });

    describe('listeners', () => {
        it('should return the listener script for precalculated bots', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    onClick: '@123',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            onClick: '@123',
                        },
                        {
                            onClick: '@123',
                        }
                    ),
                },
                addedBots: ['test'],
                removedBots: [],
                updatedBots: [],
            });
        });
    });
});
