jest.useFakeTimers();

import { MemoryPartition, createMemoryPartition } from '../partitions';
import { AuxRuntime } from './AuxRuntime';
import {
    BotAction,
    createBot,
    createPrecalculatedBot,
    toast,
    botAdded,
    botRemoved,
    BotsState,
    ShoutAction,
    action,
    botUpdated,
    reject,
    superShout,
    ORIGINAL_OBJECT,
    RejectAction,
    webhook,
    KNOWN_PORTALS,
    replaceDragBot,
    ReplaceDragBotAction,
    loadFile,
    showJoinCode,
    requestFullscreen,
    exitFullscreen,
    html,
    hideHtml,
    setClipboard,
    tweenTo,
    showChat,
    hideChat,
    runScript,
    enableAR,
    disableAR,
    enableVR,
    disableVR,
    download,
    showUploadAuxFile,
    openQRCodeScanner,
    showQRCode,
    openBarcodeScanner,
    showBarcode,
    importAUX,
    addState,
    hasValue,
    showInputForTag,
    goToDimension,
    goToURL,
    openURL,
    openConsole,
    setupStory,
    shell,
    backupToGithub,
    backupAsDownload,
    checkout,
    finishCheckout,
    markHistory,
    browseHistory,
    restoreHistoryMark,
    RestoreHistoryMarkAction,
    loadSimulation,
    unloadSimulation,
    BotSpace,
    StateUpdatedEvent,
    showInput,
    asyncResult,
    asyncError,
    getPlayerCount,
} from '../bots';
import uuid from 'uuid/v4';
import { waitAsync } from '../test/TestHelpers';
import { types } from 'util';
import {
    remote,
    device,
    deviceResult,
    deviceError,
} from '@casual-simulation/causal-trees';
import { possibleTagValueCases } from '../bots/test/BotTestHelpers';
import values from 'lodash/values';
import { RealtimeEditMode } from './RuntimeBot';
import { skip } from 'rxjs/operators';
import { createDefaultLibrary } from './AuxLibrary';
import { ActionResult, ScriptError } from './AuxResults';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { DefaultRealtimeEditModeProvider } from './AuxRealtimeEditModeProvider';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.warn = jest.fn();

describe('AuxRuntime', () => {
    let memory: MemoryPartition;
    let runtime: AuxRuntime;
    let events: BotAction[][];
    let errors: ScriptError[][];
    let version: AuxVersion;
    let auxDevice: AuxDevice;

    beforeEach(() => {
        uuidMock.mockReset();
        memory = createMemoryPartition({
            type: 'memory',
            initialState: {},
        });
        version = {
            hash: 'hash',
            major: 1,
            minor: 0,
            patch: 0,
            version: 'v1.0.0',
        };
        auxDevice = {
            supportsAR: false,
            supportsVR: false,
        };
        runtime = new AuxRuntime(
            version,
            auxDevice,
            undefined,
            new DefaultRealtimeEditModeProvider(
                new Map<BotSpace, RealtimeEditMode>([
                    ['shared', RealtimeEditMode.Immediate],
                    [<any>'delayed', RealtimeEditMode.Delayed],
                ])
            )
        );

        events = [];
        errors = [];

        runtime.onActions.subscribe(a => events.push(a));
        runtime.onErrors.subscribe(e => errors.push(e));
    });

    afterEach(() => {
        runtime.unsubscribe();
    });

    async function captureUpdates(fn: () => void) {
        let updates = [] as StateUpdatedEvent[];

        let subs = [
            memory.onBotsAdded
                .pipe(skip(1))
                .subscribe(added => updates.push(runtime.botsAdded(added))),
            memory.onBotsRemoved.subscribe(removed =>
                updates.push(runtime.botsRemoved(removed))
            ),
            memory.onBotsUpdated.subscribe(updated =>
                updates.push(runtime.botsUpdated(updated))
            ),
        ];

        try {
            await fn();
            return updates;
        } finally {
            for (let s of subs) {
                s.unsubscribe();
            }
        }
    }

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

        it('should not modify the given bot in scripts', async () => {
            const bot = createBot('test1', {
                update: `@tags.abc = "def"`,
            });
            runtime.botsAdded([bot]);
            runtime.shout('update');
            await waitAsync();
            expect(bot).toEqual(
                createBot('test1', {
                    update: `@tags.abc = "def"`,
                })
            );
        });

        it('should overwrite the existing bot with the new bot', () => {
            const update1 = runtime.botsAdded([
                createBot('test1', {
                    abc: 'def',
                }),
            ]);

            const update2 = runtime.botsAdded([
                createBot('test1', {
                    abc: 'ghi',
                }),
            ]);

            expect(update1).toEqual({
                state: {
                    test1: createPrecalculatedBot('test1', {
                        abc: 'def',
                    }),
                },
                addedBots: ['test1'],
                removedBots: [],
                updatedBots: [],
            });

            expect(update2).toEqual({
                state: {
                    test1: createPrecalculatedBot('test1', {
                        abc: 'ghi',
                    }),
                },
                addedBots: ['test1'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should not add the bot to the runtime twice', () => {
            const update1 = runtime.botsAdded([
                createBot('test1', {
                    abc: 'def',
                }),
                createBot('test1', {
                    abc: 'def',
                }),
                createBot('test2', {
                    value: '=getBots("abc","def").length',
                }),
            ]);

            expect(update1).toEqual({
                state: {
                    test1: createPrecalculatedBot('test1', {
                        abc: 'def',
                    }),
                    test2: createPrecalculatedBot(
                        'test2',
                        {
                            value: 1,
                        },
                        {
                            value: '=getBots("abc","def").length',
                        }
                    ),
                },
                addedBots: ['test1', 'test2'],
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

        it('should support deletes for bots that dont exist', () => {
            const update1 = runtime.botsRemoved(['test1']);

            expect(update1).toEqual({
                state: {
                    test1: null,
                },
                addedBots: [],
                removedBots: ['test1'],
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

        it('should ignore updates for bots that dont exist', () => {
            const update1 = runtime.botsUpdated([
                {
                    bot: createBot('test2', {
                        num: '=456',
                    }),
                    tags: ['num'],
                },
            ]);

            expect(update1).toEqual({
                state: {},
                addedBots: [],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should update raw tags', () => {
            const update1 = runtime.botsAdded([
                createBot('test', {
                    abc: 'def',
                    script: '@create(bot)',
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
            ]);

            uuidMock.mockReturnValueOnce('test2');
            const result = runtime.shout('script');

            expect(result.actions).toEqual([
                botAdded(
                    createBot('test2', {
                        abc: 'def',
                        script: '@create(bot)',
                        creator: 'test',
                        other: true,
                    })
                ),
            ]);
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

            it('should recalculate formulas that depend on configTag', () => {
                runtime.botsAdded([
                    createBot('thisBot', {
                        configBot: 'thatBot',
                        test: `=configTag`,
                    }),
                    createBot('thatBot', {
                        test: '@player.toast("hello")',
                    }),
                ]);

                const update = runtime.botsUpdated([
                    {
                        bot: createBot('thatBot', {
                            test: '@player.toast("different")',
                        }),
                        tags: ['test'],
                    },
                ]);

                expect(update).toEqual({
                    state: {
                        thisBot: {
                            values: {
                                test: '@player.toast("different")',
                            },
                        },
                        thatBot: {
                            tags: {
                                test: '@player.toast("different")',
                            },
                            values: {
                                test: '@player.toast("different")',
                            },
                        },
                    },
                    addedBots: [],
                    removedBots: [],
                    updatedBots: ['thatBot', 'thisBot'],
                });
            });

            it('should recompile functions that depend on configTag', () => {
                runtime.botsAdded([
                    createBot('thisBot', {
                        configBot: 'thatBot',
                        test: `=configTag`,
                    }),
                    createBot('thatBot', {
                        test: '@player.toast("hello")',
                    }),
                ]);

                runtime.botsUpdated([
                    {
                        bot: createBot('thatBot', {
                            test: '@player.toast("different")',
                        }),
                        tags: ['test'],
                    },
                ]);

                const result = runtime.shout('test', ['thisBot']);
                expect(result.actions).toEqual([toast('different')]);
            });

            it('should recompile functions that depend on a tag', () => {
                runtime.botsAdded([
                    createBot('thisBot', {
                        test: `="@" + tags.script`,
                        script: `player.toast("hello");`,
                    }),
                ]);

                runtime.botsUpdated([
                    {
                        bot: createBot('thisBot', {
                            test: `="@" + tags.script`,
                            script: `player.toast("different");`,
                        }),
                        tags: ['script'],
                    },
                ]);

                const result = runtime.shout('test', ['thisBot']);
                expect(result.actions).toEqual([toast('different')]);
            });
        });
    });

    describe('process()', () => {
        it('should execute shouts', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast("hi1")',
                }),
                createBot('test2', {
                    hello: '@player.toast("hi2")',
                }),
                createBot('test3', {}),
            ]);
            runtime.process([action('hello')]);

            await waitAsync();

            expect(events).toEqual([[toast('hi1'), toast('hi2')]]);
        });

        it('should flatten shout events into the given batch', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast("hi1")',
                }),
                createBot('test2', {
                    hello: '@player.toast("hi2")',
                }),
                createBot('test3', {}),
            ]);
            runtime.process([toast('hi0'), action('hello'), toast('hi3')]);

            await waitAsync();

            expect(events).toEqual([
                [toast('hi0'), toast('hi1'), toast('hi2'), toast('hi3')],
            ]);
        });

        it('should flatten run script events into the given batch', async () => {
            runtime.process([
                toast('hi0'),
                runScript('player.toast("hi1")'),
                toast('hi2'),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [toast('hi0'), toast('hi1'), toast('hi2')],
            ]);
        });

        it('should send onStoryAction() shouts for each event', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: '@player.toast(that.action.message)',
                }),
            ]);
            runtime.process([
                toast('hi0'),
                runScript('player.toast("hi1")'),
                toast('hi2'),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [
                    toast('hi0'),
                    toast('hi0'),
                    toast(undefined),
                    toast('hi1'),
                    toast('hi1'),
                    toast('hi2'),
                    toast('hi2'),
                ],
            ]);
        });

        it('should resolve rejected events', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: '@action.reject(that.action)',
                }),
            ]);
            runtime.process([
                toast('hi0'),
                runScript('player.toast("hi1")'),
                toast('hi2'),
            ]);

            await waitAsync();

            expect(events).toEqual([[]]);
        });

        it('should call onStoryAction() once per action in a batch', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: '@tags.count += 1',
                    wow: '@player.toast("hi")',
                    count: 0,
                }),
            ]);
            runtime.process([
                toast('hi0'),
                action('wow'),
                runScript('player.toast("hi1")'),
                toast('hi2'),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [
                    botUpdated('test1', {
                        tags: {
                            count: 1,
                        },
                    }),
                    toast('hi0'),

                    // action
                    botUpdated('test1', {
                        tags: {
                            count: 2,
                        },
                    }),
                    botUpdated('test1', {
                        tags: {
                            count: 3,
                        },
                    }),
                    toast('hi'),

                    // runScript
                    botUpdated('test1', {
                        tags: {
                            count: 4,
                        },
                    }),
                    botUpdated('test1', {
                        tags: {
                            count: 5,
                        },
                    }),
                    toast('hi1'),

                    botUpdated('test1', {
                        tags: {
                            count: 6,
                        },
                    }),
                    toast('hi2'),
                ],
            ]);
        });

        it('should be able to filter actions before they are executed', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: `@if(that.action.type === "action") action.reject(that.action);`,
                    test: '@player.toast("hi")',
                }),
            ]);
            runtime.process([action('test')]);

            await waitAsync();

            expect(events).toEqual([[]]);
        });

        it('should be able to filter runScript actions before they are executed', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: `@if(that.action.type === "run_script") action.reject(that.action);`,
                }),
            ]);
            runtime.process([runScript('player.toast("hi")')]);

            await waitAsync();

            expect(events).toEqual([[]]);
        });

        it('should split add_state events into individual bot updates', async () => {
            runtime.process([
                addState({
                    abc: createBot('abc', {}, <any>'TEST'),
                    normal: createBot('normal', {}),
                }),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [
                    botAdded(createBot('abc', {}, <any>'TEST')),
                    botAdded(createBot('normal', {})),
                ],
            ]);
        });

        it('should support dispatching a new shout from inside onStoryAction()', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: `@if(that.action.type === "device") action.perform(that.action.event);`,
                    test: '@tags.hit = true',
                }),
            ]);
            runtime.process([device(<any>{}, action('test'))]);

            await waitAsync();

            expect(events).toEqual([
                [
                    // onStoryAction is executed before
                    // the device action is executed
                    botUpdated('test1', {
                        tags: {
                            hit: true,
                        },
                    }),
                    device(<any>{}, action('test')),
                ],
            ]);
        });

        it('should support dispatching a new script from inside onStoryAction()', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    onStoryAction: `@if(that.action.type === "device") action.perform(that.action.event);`,
                }),
            ]);
            runtime.process([device(<any>{}, runScript('player.toast("hi")'))]);

            await waitAsync();

            expect(events).toEqual([
                [
                    // onStoryAction is executed before
                    // the device action is executed
                    toast('hi'),
                    device(<any>{}, runScript('player.toast("hi")')),
                ],
            ]);
        });

        it('should support resolving async actions', async () => {
            runtime.process([
                runScript(
                    'player.showInput().then(result => player.toast(result))'
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [showInput(undefined, undefined, expect.any(Number))],
            ]);

            const taskId = (<any>events[0][0]).taskId as number;

            runtime.process([asyncResult(taskId, 'abc')]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast('abc')]]);
        });

        it('should support mapping bots in async actions results', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    abc: 'def',
                }),
            ]);

            runtime.process([
                runScript(
                    'player.showInput().then(result => player.toast(result.tags.abc))'
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [showInput(undefined, undefined, expect.any(Number))],
            ]);

            const taskId = (<any>events[0][0]).taskId as number;

            runtime.process([
                asyncResult(
                    taskId,
                    {
                        id: 'test1',
                        tags: {},
                    },
                    true
                ),
            ]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast('def')]]);
        });

        it('should support rejecting async actions', async () => {
            runtime.process([
                runScript(
                    'player.showInput().catch(result => player.toast(result))'
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [showInput(undefined, undefined, expect.any(Number))],
            ]);

            const taskId = (<any>events[0][0]).taskId as number;

            runtime.process([asyncError(taskId, 'abc')]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast('abc')]]);
        });

        it('should support resolving device async actions', async () => {
            uuidMock.mockReturnValueOnce('task1');
            runtime.process([
                runScript(
                    'server.storyPlayerCount("test").then(result => player.toast(result))'
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [remote(getPlayerCount('test'), undefined, undefined, 'task1')],
            ]);

            runtime.process([deviceResult(null, 123, 'task1')]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast(123)]]);
        });

        it('should support rejecting device async actions', async () => {
            uuidMock.mockReturnValueOnce('task1');
            runtime.process([
                runScript(
                    'server.storyPlayerCount("test").catch(err => player.toast(err))'
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [remote(getPlayerCount('test'), undefined, undefined, 'task1')],
            ]);

            runtime.process([deviceError(null, 'bad', 'task1')]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast('bad')]]);
        });

        it('should support using await for async actions', async () => {
            runtime.process([
                runScript(
                    `const result = await player.showInput();
                     player.toast(result);`
                ),
            ]);

            await waitAsync();

            expect(events).toEqual([
                [showInput(undefined, undefined, expect.any(Number))],
            ]);

            const taskId = (<any>events[0][0]).taskId as number;

            runtime.process([asyncResult(taskId, 'abc')]);

            await waitAsync();

            expect(events.slice(1)).toEqual([[], [toast('abc')]]);
        });

        it('should not crash if given a run_script that doesnt compile', async () => {
            runtime.process([runScript('player.toast('), toast('abc')]);

            await waitAsync();

            expect(events).toEqual([[toast('abc')]]);
        });

        it('should resolve run_script tasks', async () => {
            const result = runtime.execute(
                'return await player.run("return 123");'
            );

            runtime.process(result.actions);

            expect(await result.result).toBe(123);
        });

        it('should unwrap async run_script tasks', async () => {
            const result = runtime.execute(
                'return await player.run("return Promise.resolve(123);");'
            );

            runtime.process(result.actions);

            expect(await result.result).toBe(123);
        });
    });

    describe('execute()', () => {
        it('should compile and run the given script', async () => {
            runtime.execute('player.toast("hello")');

            await waitAsync();

            expect(events).toEqual([[toast('hello')]]);
        });

        it('should emit an error if the script has a syntax error', async () => {
            runtime.execute('player.toast(');

            await waitAsync();

            expect(errors).toEqual([
                [
                    {
                        error: expect.any(SyntaxError),
                        script: 'player.toast(',
                        bot: null,
                        tag: null,
                    },
                ],
            ]);
        });

        it('should return the compiler error if the script was unable to be compiled', async () => {
            const result = runtime.execute('player.toast(');

            await waitAsync();

            expect(result).toEqual({
                result: undefined,
                actions: [],
                errors: [
                    {
                        error: expect.any(SyntaxError),
                        script: 'player.toast(',
                        bot: null,
                        tag: null,
                    },
                ],
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

        it('should not map argument objects that have a custom prototype', async () => {
            class MyClass {}

            const obj = new MyClass();

            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast(that)',
                }),
            ]);
            runtime.shout('hello', null, {
                value: obj,
            });

            await waitAsync();

            expect(events.length).toBe(1);
            expect(events[0].length).toBe(1);
            expect(events[0][0].type).toBe('show_toast');
            expect((<any>events[0][0]).message.value).toEqual(obj);
        });

        it('should not map argument bots that are not in the current state', async () => {
            const obj = {
                id: 'test2',
                tags: {},
            };
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast(that)',
                }),
            ]);
            runtime.shout('hello', null, {
                value: obj,
            });

            await waitAsync();

            expect(events.length).toBe(1);
            expect(events[0].length).toBe(1);
            expect(events[0][0].type).toBe('show_toast');
            expect((<any>events[0][0]).message.value).toEqual(obj);
        });

        it('should not map argument bots in arrays that are not in the current state', async () => {
            const obj = {
                id: 'test2',
                tags: {},
            };
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@player.toast(that)',
                }),
            ]);
            runtime.shout('hello', null, {
                value: [obj],
            });

            await waitAsync();

            expect(events.length).toBe(1);
            expect(events[0].length).toBe(1);
            expect(events[0][0].type).toBe('show_toast');
            expect((<any>events[0][0]).message.value[0]).toEqual(obj);
        });

        it('should dispatch events from setInterval() callbacks', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@setInterval(() => player.toast("abc"), 100)',
                }),
            ]);
            runtime.shout('hello');

            await waitAsync();

            expect(events).toEqual([[]]);

            jest.advanceTimersByTime(200);

            await waitAsync();

            expect(events).toEqual([[], [toast('abc')], [toast('abc')]]);
        });

        it('should dispatch events from setTimeout() callbacks', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@setTimeout(() => player.toast("abc"), 100)',
                }),
            ]);
            runtime.shout('hello');

            await waitAsync();

            expect(events).toEqual([[]]);

            jest.advanceTimersByTime(200);

            await waitAsync();

            expect(events).toEqual([[], [toast('abc')]]);
        });

        it('should dispatch events from promise callbacks', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello:
                        '@Promise.resolve(0).then(() => player.toast("abc")).then(() => player.toast("abc2"))',
                }),
            ]);
            runtime.shout('hello');

            await waitAsync();

            expect(events).toEqual([[], [toast('abc')], [toast('abc2')]]);
        });

        it('should handle a bot getting destroyed twice due to a setTimeout() callback', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    hello: '@setTimeout(() => destroy(this), 100)',
                    destroy: '@destroy(this)',
                }),
            ]);
            runtime.shout('hello');
            runtime.shout('destroy');

            await waitAsync();

            expect(events).toEqual([[], [botRemoved('test1')]]);

            jest.advanceTimersByTime(200);

            await waitAsync();

            expect(events).toEqual([[], [botRemoved('test1')], []]);
        });

        it('should handle a bot getting destroyed twice', async () => {
            runtime.botsAdded([
                createBot('test1', {}),
                createBot('test2', {
                    destroyBot1: '@destroy("test1")',
                }),
            ]);
            runtime.shout('destroyBot1');
            runtime.shout('destroyBot1');

            await waitAsync();

            expect(events).toEqual([[botRemoved('test1')], []]);
        });

        it('should handle a bot destroying itself twice', async () => {
            runtime.botsAdded([
                createBot('test1', {
                    destroy: '@destroy(this);destroy(this)',
                }),
            ]);
            runtime.shout('destroy');

            await waitAsync();

            expect(events).toEqual([[botRemoved('test1')]]);
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
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });

            it('should add the created bot to the runtime state', async () => {
                uuidMock.mockReturnValue('uuid');
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
                                creator: 'test1',
                                shout: "@player.toast('abc')",
                            })
                        ),
                    ],
                    [toast('abc')],
                ]);
            });

            it('should be able to integrate new bots which get accepted to the partition', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        create: `@create({ abc: "def", "shout": "@player.toast('abc')" })`,
                    }),
                ]);
                runtime.shout('create');

                await waitAsync();

                const updates = await captureUpdates(async () => {
                    for (let e of events) {
                        await memory.applyEvents(e);
                    }
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            uuid: createPrecalculatedBot('uuid', {
                                creator: 'test1',
                                shout: "@player.toast('abc')",
                                abc: 'def',
                            }),
                        },
                        addedBots: ['uuid'],
                        removedBots: [],
                        updatedBots: [],
                    },
                ]);
            });

            it('should preserve the current bot in callbacks', async () => {
                uuidMock.mockReturnValueOnce('uuid1');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setTimeout(() => create({ abc: "def" }), 100)',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(100);

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botAdded(
                            createBot('uuid1', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });

            it('should produce an event from setInterval() callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello:
                            '@setInterval(() => create({ abc: "def" }), 100)',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botAdded(
                            createBot('uuid1', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                    [
                        botAdded(
                            createBot('uuid2', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });

            it('should produce an event from setTimeout() callbacks', async () => {
                uuidMock.mockReturnValueOnce('uuid1');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setTimeout(() => create({ abc: "def" }), 100)',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botAdded(
                            createBot('uuid1', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });

            it('should produce an event from promise callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello:
                            '@Promise.resolve(0).then(() => create({ abc: "def" })).then(() => create({ abc: "def" }))',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botAdded(
                            createBot('uuid1', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                    [
                        botAdded(
                            createBot('uuid2', {
                                creator: 'test1',
                                abc: 'def',
                            })
                        ),
                    ],
                ]);
            });
        });

        describe('bot_removed', () => {
            it('should produce an event when a bot is deleted', async () => {
                uuidMock.mockReturnValue('uuid');
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
                uuidMock.mockReturnValue('uuid');
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

            it('should be able to delete bots which get accepted to the partition', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        delete: `@destroy(this)`,
                        abc: 'def',
                    }),
                ]);
                runtime.shout('delete');

                await waitAsync();

                const updates = await captureUpdates(async () => {
                    for (let e of events) {
                        await memory.applyEvents(e);
                    }
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            test1: null,
                        },
                        addedBots: [],
                        removedBots: ['test1'],
                        updatedBots: [],
                    },
                ]);
            });

            it('should delete bots from setInterval() callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setInterval(() => destroy("test2"), 100)',
                    }),
                    createBot('test2'),
                    createBot('test3'),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([[], [botRemoved('test2')], []]);
            });

            it('should delete bots from setTimeout() callbacks', async () => {
                uuidMock.mockReturnValueOnce('uuid1');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setTimeout(() => destroy("test2"), 100)',
                    }),
                    createBot('test2'),
                    createBot('test3'),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([[], [botRemoved('test2')]]);
            });

            it('should delete bots from from promise callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello:
                            '@Promise.resolve(0).then(() => destroy("test2")).then(() => destroy("test3"))',
                    }),
                    createBot('test2'),
                    createBot('test3'),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [botRemoved('test2')],
                    [botRemoved('test3')],
                ]);
            });
        });

        describe('bot_updated', () => {
            it('should produce an event when a bot is modified', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        update: '@tags.value = 123',
                    }),
                ]);
                runtime.shout('update');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                value: 123,
                            },
                        }),
                    ],
                ]);
            });

            it('should be able to update bots which get accepted to the partition', async () => {
                uuidMock.mockReturnValue('uuid');
                const bot = createBot('test1', {
                    update: `@tags.abc = "def"`,
                });
                runtime.botsAdded([bot]);
                await memory.applyEvents([botAdded(bot)]);
                runtime.shout('update');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ],
                ]);

                const updates = await captureUpdates(async () => {
                    for (let e of events) {
                        await memory.applyEvents(e);
                    }
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            test1: {
                                tags: {
                                    abc: 'def',
                                },
                                values: {
                                    abc: 'def',
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1'],
                    },
                ]);
            });

            it('should be able to update formulas which get accepted to the partition', async () => {
                uuidMock.mockReturnValue('uuid');
                const bot = createBot('test1', {
                    update: `@tags.formula = "=456"`,
                    formula: '=1',
                });
                runtime.botsAdded([bot]);
                await memory.applyEvents([botAdded(bot)]);
                runtime.shout('update');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                formula: '=456',
                            },
                        }),
                    ],
                ]);

                const updates = await captureUpdates(async () => {
                    for (let e of events) {
                        await memory.applyEvents(e);
                    }
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            test1: {
                                tags: {
                                    formula: '=456',
                                },
                                values: {
                                    formula: 456,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1'],
                    },
                ]);
            });

            it('should handle updates in separate shouts', async () => {
                uuidMock.mockReturnValue('uuid');
                const bot = createBot('test1', {
                    update1: `@tags.abc = 123`,
                    update2: `@tags.abc = 456`,
                });
                runtime.botsAdded([bot]);
                await memory.applyEvents([botAdded(bot)]);

                runtime.shout('update1');
                await waitAsync();

                runtime.shout('update2');
                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 123,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 456,
                            },
                        }),
                    ],
                ]);

                const updates = await captureUpdates(async () => {
                    for (let e of events) {
                        await memory.applyEvents(e);
                    }
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            test1: {
                                tags: {
                                    abc: 123,
                                },
                                values: {
                                    abc: 123,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1'],
                    },
                    {
                        state: {
                            test1: {
                                tags: {
                                    abc: 456,
                                },
                                values: {
                                    abc: 456,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1'],
                    },
                ]);
            });

            it('should update bots from setInterval() callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setInterval(() => tags.count += 1, 100)',
                        count: 0,
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botUpdated('test1', {
                            tags: {
                                count: 1,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                count: 2,
                            },
                        }),
                    ],
                ]);
            });

            it('should update bots from setTimeout() callbacks', async () => {
                uuidMock.mockReturnValueOnce('uuid1');
                runtime.botsAdded([
                    createBot('test1', {
                        hello: '@setTimeout(() => tags.hit = true, 100)',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[]]);

                jest.advanceTimersByTime(200);

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botUpdated('test1', {
                            tags: {
                                hit: true,
                            },
                        }),
                    ],
                ]);
            });

            it('should update bots from from promise callbacks', async () => {
                uuidMock
                    .mockReturnValueOnce('uuid1')
                    .mockReturnValueOnce('uuid2');
                runtime.botsAdded([
                    createBot('test1', {
                        hello:
                            '@Promise.resolve(0).then(() => tags.hit = 1).then(() => tags.hit = 2)',
                    }),
                ]);
                runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([
                    [],
                    [
                        botUpdated('test1', {
                            tags: {
                                hit: 1,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                hit: 2,
                            },
                        }),
                    ],
                ]);
            });

            // TODO: Improve the concurrency handling of the runtime
            //       to fix this issue
            it.skip('should not overwrite the current state when a race condition occurs', async () => {
                uuidMock.mockReturnValue('uuid');
                const bot = createBot('test1', {
                    update1: `@tags.abc = 123`,
                    update2: `@tags.abc = 456`,
                    update3: `@tags.fun = tags.abc`,
                });
                runtime.botsAdded([bot]);
                await memory.applyEvents([botAdded(bot)]);

                runtime.shout('update1');
                await waitAsync();

                runtime.shout('update2');
                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 123,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 456,
                            },
                        }),
                    ],
                ]);

                const updates = await captureUpdates(async () => {
                    // Apply only the first update
                    await memory.applyEvents(events[0]);
                    await waitAsync();
                });

                expect(updates).toEqual([
                    {
                        state: {
                            test1: {
                                tags: {
                                    abc: 123,
                                },
                                values: {
                                    abc: 123,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test1'],
                    },
                ]);

                runtime.shout('update3');

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 123,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: 456,
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                fun: 456,
                            },
                        }),
                    ],
                ]);
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
                        creator: 'test',
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

        it('should convert script bots into normal bots', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=getBot("id", "other")',
                }),
                createBot('other', {
                    color: 'red',
                }),
            ]);

            expect(update).toEqual({
                state: {
                    test: createPrecalculatedBot(
                        'test',
                        {
                            formula: createBot('other', {
                                color: 'red',
                            }),
                        },
                        {
                            formula: '=getBot("id", "other")',
                        }
                    ),
                    other: createPrecalculatedBot('other', {
                        color: 'red',
                    }),
                },
                addedBots: ['test', 'other'],
                removedBots: [],
                updatedBots: [],
            });
        });

        it('should return an object that is structure clonable', () => {
            const update = runtime.botsAdded([
                createBot('test', {
                    formula: '=getBot("id", "other")',
                }),
                createBot('other', {
                    color: 'red',
                }),
            ]);

            expect(
                types.isProxy(update.state['test'].values['formula'].tags)
            ).toBe(false);
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

        it('should prevent scheduling tasks while in a formula', async () => {
            const test = jest.fn();
            runtime = new AuxRuntime(version, auxDevice, ctx => ({
                api: {
                    ...createDefaultLibrary(ctx).api,
                    test,
                },
            }));
            const update = runtime.botsAdded([
                createBot('test', {
                    formula:
                        '=const obj = setTimeout(() => test(), 100); 1 + 2',
                    abc: 'def',
                }),
            ]);

            await waitAsync();

            jest.advanceTimersByTime(100);

            expect(test).not.toBeCalled();
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

    describe('edit modes', () => {
        // The delayed realtime edit mode disallows
        // edits from being immediately observed in the realtime space.
        describe('delayed', () => {
            it('should delay updates for bots that are in a space that is delayed', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot(
                        'test1',
                        {
                            update: `@
                            tags.value = 123;
                            // value is not updated to 123 because
                            // the update is delayed
                            player.toast(tags.value);
                        `,
                        },
                        <any>'delayed'
                    ),
                ]);
                runtime.shout('update');

                await waitAsync();

                expect(events).toEqual([
                    [
                        // value should not have been updated
                        toast(undefined),

                        // but it should emit a bot update
                        // so the partition can choose to propagate it.
                        botUpdated('test1', {
                            tags: {
                                value: 123,
                            },
                        }),
                    ],
                ]);
            });

            it('should delay creation of bots that are in a space that is delayed', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        create: `@
                            let b = create({ space: 'delayed', value: 123 });
                            expect(b).toBe(null);
                        `,
                    }),
                ]);
                const result = runtime.shout('create');

                await waitAsync();

                expect(result.errors).toEqual([]);
                expect(events).toEqual([
                    [
                        botAdded(
                            createBot(
                                'uuid',
                                {
                                    value: 123,
                                },
                                <any>'delayed'
                            )
                        ),
                    ],
                ]);
            });

            it('should delay deletion of bots that are in a space that is delayed', async () => {
                uuidMock.mockReturnValue('uuid');
                runtime.botsAdded([
                    createBot('test1', {
                        delete: `@
                            let b1 = getBot('id', 'test2');
                            destroy('test2');
                            let b2 = getBot('id', 'test2');
                            expect(b1).toEqual(b2);
                        `,
                    }),
                    createBot(
                        'test2',
                        {
                            value: 123,
                        },
                        <any>'delayed'
                    ),
                ]);
                const result = runtime.shout('delete');

                await waitAsync();

                expect(result.errors).toEqual([]);
                expect(events).toEqual([[botRemoved('test2')]]);
            });
        });

        it('should use updated edit modes from the given edit mode map', async () => {
            let map = new Map<BotSpace, RealtimeEditMode>([
                ['shared', RealtimeEditMode.Immediate],
                [<any>'delayed', RealtimeEditMode.Delayed],
            ]);
            let provider = new DefaultRealtimeEditModeProvider(map);
            runtime = new AuxRuntime(version, auxDevice, undefined, provider);
            runtime.onActions.subscribe(a => events.push(a));

            uuidMock.mockReturnValueOnce('uuid').mockReturnValueOnce('uuid2');
            runtime.botsAdded([
                createBot('test1', {
                    create: `@
                        let b = create({ space: 'delayed', value: 123 });
                        expect(b).toBe(null);
                    `,
                    create2: `@
                        let b = create({ space: 'delayed', value: 123 });
                        expect(b).not.toBe(null);
                    `,
                }),
            ]);
            const result = runtime.shout('create');

            await waitAsync();

            expect(result.errors).toEqual([]);
            expect(events).toEqual([
                [
                    botAdded(
                        createBot(
                            'uuid',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ],
            ]);

            map.set(<any>'delayed', RealtimeEditMode.Immediate);

            const result2 = runtime.shout('create2');

            await waitAsync();

            expect(result2.errors).toEqual([]);
            expect(events.slice(1)).toEqual([
                [
                    botAdded(
                        createBot(
                            'uuid2',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ],
            ]);
        });

        it('should use the given provider', async () => {
            let provider = {
                getEditMode: jest.fn(),
            };
            runtime = new AuxRuntime(version, auxDevice, undefined, provider);
            runtime.onActions.subscribe(a => events.push(a));

            uuidMock.mockReturnValueOnce('uuid').mockReturnValueOnce('uuid2');
            provider.getEditMode
                .mockReturnValueOnce(RealtimeEditMode.Delayed)
                .mockReturnValueOnce(RealtimeEditMode.Immediate);
            runtime.botsAdded([
                createBot('test1', {
                    create: `@
                        let b = create({ space: 'delayed', value: 123 });
                        expect(b).toBe(null);
                    `,
                    create2: `@
                        let b = create({ space: 'delayed', value: 123 });
                        expect(b).not.toBe(null);
                    `,
                }),
            ]);
            const result = runtime.shout('create');

            await waitAsync();

            expect(result.errors).toEqual([]);
            expect(events).toEqual([
                [
                    botAdded(
                        createBot(
                            'uuid',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ],
            ]);

            const result2 = runtime.shout('create2');

            await waitAsync();

            expect(result2.errors).toEqual([]);
            expect(events.slice(1)).toEqual([
                [
                    botAdded(
                        createBot(
                            'uuid2',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ],
            ]);
        });
    });

    describe('errors', () => {
        it('should emit errors that occur in scripts', async () => {
            runtime.botsAdded([
                createBot('test', {
                    onClick: '@throw new Error("abc")',
                }),
            ]);

            runtime.shout('onClick');

            await waitAsync();

            expect(errors).toEqual([
                [
                    expect.objectContaining({
                        error: expect.any(Error),
                        bot: expect.objectContaining(
                            createBot('test', {
                                onClick: '@throw new Error("abc")',
                            })
                        ),
                        tag: 'onClick',
                    }),
                ],
            ]);
        });
    });

    describe('unsubscribe()', () => {
        it('should cancel any scheduled tasks', () => {
            const test = jest.fn();
            runtime = new AuxRuntime(
                version,
                auxDevice,
                context => ({
                    api: {
                        ...createDefaultLibrary(context).api,
                        test: test,
                    },
                }),
                new DefaultRealtimeEditModeProvider(
                    new Map<BotSpace, RealtimeEditMode>([
                        ['shared', RealtimeEditMode.Immediate],
                        [<any>'delayed', RealtimeEditMode.Delayed],
                    ])
                )
            );

            runtime.botsAdded([
                createBot('test', {
                    start: '@setInterval(() => { test() }, 100)',
                }),
            ]);
            runtime.shout('start');

            jest.advanceTimersByTime(200);

            expect(test).toBeCalledTimes(2);

            runtime.unsubscribe();

            jest.advanceTimersByTime(200);

            expect(test).toBeCalledTimes(2);
        });
    });

    it('should not leak zones to callbacks', async () => {
        let root = Zone.root;
        const zones = [] as Zone[];
        runtime.onActions.subscribe(e => {
            zones.push(Zone.current);
        });
        runtime.botsAdded([
            createBot('test', {
                start: '@player.toast("abc")',
            }),
        ]);
        runtime.shout('start');

        await waitAsync();

        expect(zones.length).toBe(1);
        expect(zones[0]).toBe(root);
    });
});

function calculateActionResults(
    state: BotsState,
    action: ShoutAction,
    device?: AuxDevice,
    version?: AuxVersion
): ActionResult {
    const runtime = new AuxRuntime(version, device);
    const bots = values(state);
    runtime.botsAdded(bots);
    runtime.userId = action.userId;
    const result = runtime.shout(
        action.eventName,
        action.botIds,
        action.argument
    );

    return result;
}

describe('original action tests', () => {
    it('should run scripts on the this bot and return the resulting actions', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    test: '@create({ creator: null }, this);',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'def',
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botAdded({
                id: 'uuid-0',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    test: '@create({ creator: null }, this);',

                    // the new bot is not destroyed
                },
            }),
        ]);
    });

    it('should pass in a bot variable which equals this', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    test: '@setTag(this, "equal", this === bot)',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'def',
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    equal: true,
                },
            }),
        ]);
    });

    it('should be able to get tag values from the bot variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    num: '=123',
                    test: '@setTag(this, "val", bot.tags.num)',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    val: 123,
                },
            }),
        ]);
    });

    it('should be able to get the space from the bot variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                space: 'tempLocal',
                tags: {
                    num: '=123',
                    test: '@setTag(this, "val", bot.space)',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    val: 'tempLocal',
                },
            }),
        ]);
    });

    it('should be able to set tag values in the bot variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    num: '=123',
                    test: '@bot.tags.num = 10;',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    num: 10,
                },
            }),
        ]);
    });

    it('should pass in a tags variable which equals this.tags', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    color: 'red',
                    test: '@setTag(this, "equal", tags === this.tags)',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    equal: true,
                },
            }),
        ]);
    });

    it('should update the tags variable when setTag() is called', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    color: 'red',
                    test: `@
                        setTag(this, "other", tags.color);
                        setTag(this, "final", tags.other);
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    other: 'red',
                    final: 'red',
                },
            }),
        ]);
    });

    it('should support updating the tags variable directly', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    color: 'red',
                    test: `@
                        tags.color = 'blue';
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    color: 'blue',
                },
            }),
        ]);
    });

    it('should pass in a raw variable which equals this.raw', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: `@
                        tags.equal = raw === this.raw;
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    equal: true,
                },
            }),
        ]);
    });

    it('should support getting formula scripts from the raw variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    formula: '=10',
                    test: `@
                        tags.calculated = tags.formula;
                        tags.normal = raw.formula;
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    calculated: 10,
                    normal: '=10',
                },
            }),
        ]);
    });

    it('should support setting formula scripts to the raw variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: `@
                        raw.formula = '=10';
                        tags.calculated = tags.formula;
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    calculated: 10,
                    formula: '=10',
                },
            }),
        ]);
    });

    it('should support setting formula scripts to the tags variable', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: `@
                        tags.formula = '=10';
                        tags.calculated = tags.formula;
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    calculated: 10,
                    formula: '=10',
                },
            }),
        ]);
    });

    describe('errors', () => {
        it('should return the error that the script threw', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@throw new Error("abc")`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.errors).toEqual([
                {
                    error: new Error('abc'),
                    bot: expect.objectContaining(state['thisBot']),
                    tag: 'test',

                    //  TODO: Improve to support correct column numbers
                    line: expect.any(Number),
                    column: expect.any(Number),
                },
            ]);
        });

        it.skip('should include the line and column number that the error occurred at in the script', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@player.toast("abc")\nthrow new Error("abc")`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.errors).toEqual([
                {
                    error: expect.any(Error),
                    bot: expect.objectContaining(state['thisBot']),
                    tag: 'test',
                    line: 2,
                    //  TODO: Improve to support correct column numbers
                    column: expect.any(Number),
                },
            ]);
        });

        // TODO: Improve to support these cases better
        it.skip('should ignore extra lines added by __energyCheck() calls', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@while(true) {
                            throw new Error('abc')
                        }`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.errors).toEqual([
                {
                    error: expect.any(Error),
                    bot: expect.objectContaining(state['thisBot']),
                    tag: 'test',

                    // It shows line 3 because it doesn't
                    // know to remove the extra line added by the energy check call
                    line: 3,
                    //  TODO: Improve to support correct column numbers
                    column: expect.any(Number),
                },
            ]);
        });

        it('should not include line numbers when Error.prepareStackTrace() is not available', () => {
            const prev = Error.prepareStackTrace;
            try {
                Error.prepareStackTrace = null;
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@while(true) {
                                throw new Error('abc')
                            }`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.errors).toEqual([
                    {
                        error: expect.any(Error),
                        bot: expect.objectContaining(state['thisBot']),
                        tag: 'test',
                    },
                ]);
            } finally {
                Error.prepareStackTrace = prev;
            }
        });
    });

    describe('creator', () => {
        it('should pass in a creator variable which equals getBot("id", tags.creator)', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        creator: 'thatBot',
                        test: '@setTag(this, "creatorId", creator.id)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        creatorId: 'thatBot',
                    },
                }),
            ]);
        });

        it('the creator variable should be null if the bot has no creator', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "hasCreator", creator !== null)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hasCreator: false,
                    },
                }),
            ]);
        });

        it('the creator variable should be null if the bot is referencing a missing creator', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        creator: 'none',
                        test: '@setTag(this, "hasCreator", creator !== null)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hasCreator: false,
                    },
                }),
            ]);
        });
    });

    describe('config', () => {
        it('should pass in a config variable which equals getBot("id", tags.configBot)', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        configBot: 'thatBot',
                        test: '@setTag(this, "configId", config.id)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        configId: 'thatBot',
                    },
                }),
            ]);
        });

        it('the config variable should be null if configBot is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "hasConfig", config !== null)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hasConfig: false,
                    },
                }),
            ]);
        });

        it('the config variable should be null if configBot is referencing a missing bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        configBot: 'none',
                        test: '@setTag(this, "hasConfig", config !== null)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hasConfig: false,
                    },
                }),
            ]);
        });
    });

    describe('tagName', () => {
        it('should pass in a tagName variable which is the name of the tag that is currently executing', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "runningTag", tagName)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        runningTag: 'test',
                    },
                }),
            ]);
        });

        it('should set the tagName variable to the name of the original tag even in formulas', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        val: '@setTag(this, "runningTag", tagName)',
                        test: '=tags.val',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        runningTag: 'test',
                    },
                }),
            ]);
        });
    });

    describe('configTag', () => {
        it('should define a configTag variable which equals config.tags[tagName]', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        configBot: 'thatBot',
                        test: '@setTag(this, "parentScript", configTag)',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        test: 'player.toast("hello")',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        parentScript: 'player.toast("hello")',
                    },
                }),
            ]);
        });

        it('should contain the value that the config bot contained when the script started', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        configBot: 'thatBot',
                        test: `@config.tags.test = "abc"; setTag(this, "parentScript", configTag)`,
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        test: 'player.toast("hello")',
                        name: 'Joe',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thatBot', {
                    tags: {
                        test: 'abc',
                    },
                }),
                botUpdated('thisBot', {
                    tags: {
                        parentScript: 'player.toast("hello")',
                    },
                }),
            ]);
        });
    });

    it('should not allow changing the ID', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: `@
                        tags.id = 'wrong';
                        raw.id = 'wrong';
                        setTag(this, 'id', 'wrong');
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([]);
    });

    it('should not allow changing the space', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: `@
                        tags.space = 'wrong';
                        raw.space = 'wrong';
                        setTag(this, 'space', 'wrong');
                    `,
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([]);
    });

    it('should preserve formulas when copying', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    num: 15,
                    formula: '=this.num',
                    test:
                        '@create({ creator: null }, this, that, { testFormula: "=this.name" });',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    name: 'Friend',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action(
            'test',
            ['thisBot'],
            undefined,
            state['thatBot']
        );
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botAdded({
                id: 'uuid-0',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    num: 15,
                    formula: '=this.num',
                    test:
                        '@create({ creator: null }, this, that, { testFormula: "=this.name" });',
                    name: 'Friend',
                    testFormula: '=this.name',

                    // the new bot is not destroyed
                },
            }),
        ]);
    });

    it('should not destroy the bots when running a non combine event', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    abcdef: '@create({ creator: null }, this)',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'def',
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('abcdef', ['thisBot', 'thatBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botAdded({
                id: 'uuid-0',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    abcdef: '@create({ creator: null }, this)',
                },
            }),
        ]);
    });

    it('should run actions when no filter is provided', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    abcdef: '@create({ creator: null }, this)',
                },
            },
            thatBot: {
                id: 'thatBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'def',
                    name: 'Joe',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('abcdef', ['thisBot', 'thatBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botAdded({
                id: 'uuid-0',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    abcdef: '@create({ creator: null }, this)',
                },
            }),
        ]);
    });

    it('should calculate events from setting property values', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    abcdef:
                        '@setTag(this, "#val", 10); setTag(this, "#nested.value", true)',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('abcdef', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    val: 10,
                    'nested.value': true,
                },
            }),
        ]);
    });

    it('should be able to set property values on bots returned from queries', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    abcdef: '@setTag(getBot("#name", "test"), "#abc", "def")',
                },
            },
            editBot: {
                id: 'editBot',
                tags: {
                    name: 'test',
                },
            },
        };

        // specify the UUID to use next
        const botAction = action('abcdef', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('editBot', {
                tags: {
                    abc: 'def',
                },
            }),
        ]);
    });

    it('should be able to set property values on bots returned from other formulas', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    formula: '=getBot("#name", "test")',
                    abcdef: '@setTag(getTag(this, "#formula"), "#abc", "def")',
                },
            },
            editBot: {
                id: 'editBot',
                tags: {
                    name: 'test',
                },
            },
        };

        // specify the UUID to use next
        const botAction = action('abcdef', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('editBot', {
                tags: {
                    abc: 'def',
                },
            }),
        ]);
    });

    it('should be able to increment values on bots returned from other formulas', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    formula: '=getBots("name", "test").first()',
                    abcdef:
                        '@setTag(getTag(this, "#formula"), "#num", getTag(this, "#formula", "#num") + 2);',
                },
            },
            editBot: {
                id: 'editBot',
                tags: {
                    name: 'test',
                    num: 1,
                },
            },
        };

        // specify the UUID to use next
        const botAction = action('abcdef', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('editBot', {
                tags: {
                    num: 3,
                },
            }),
        ]);
    });

    it('should be able to set tag values on bots returned from formulas', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    formula: '=getBots("name", "test").first()',
                    abcdef: `@let bot = tags.formula;
                         bot.tags.num += 2;`,
                },
            },
            editBot: {
                id: 'editBot',
                tags: {
                    name: 'test',
                    num: 1,
                },
            },
        };

        // specify the UUID to use next
        const botAction = action('abcdef', ['thisBot']);
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('editBot', {
                tags: {
                    num: 3,
                },
            }),
        ]);
    });

    it('should preserve the user ID in shouts', () => {
        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    abcdef: '@shout("sayHello")',
                    sayHello: '@setTag(this, "#userId", player.getBot().id)',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('abcdef', ['thisBot'], 'userBot');
        const result = calculateActionResults(state, botAction);

        expect(result.actions).toEqual([
            botUpdated('thisBot', {
                tags: {
                    userId: 'userBot',
                },
            }),
        ]);
    });

    it('should run out of energy in infinite loops', () => {
        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: '@while(true) {}',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');

        expect(() => {
            calculateActionResults(state, botAction);
        }).toThrow(new Error('Ran out of energy'));
    });

    it('should handle errors on a per-script basis', () => {
        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            aBot: {
                id: 'aBot',
                tags: {
                    test: `@throw new Error("Error: abc")`,
                },
            },
            bBot: {
                id: 'bBot',
                tags: {
                    test: `@player.toast("hello")`,
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', null, 'userBot');
        const events = calculateActionResults(state, botAction);
        expect(events.actions).toEqual([toast('hello')]);
    });

    it('should handle syntax errors on a per-script basis', () => {
        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            aBot: {
                id: 'aBot',
                tags: {
                    test: `@if (`,
                },
            },
            bBot: {
                id: 'bBot',
                tags: {
                    test: `@player.toast("hello")`,
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', null, 'userBot');
        const events = calculateActionResults(state, botAction);
        expect(events.actions).toEqual([toast('hello')]);
    });

    it('should support scripts as formulas that return non-string objects', () => {
        expect.assertions(1);

        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: '="@true"',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');
        const events = calculateActionResults(state, botAction);

        expect(events.actions).toEqual([]);
    });

    it('should support single-line scripts with a comment at the end', () => {
        expect.assertions(1);

        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: '@player.toast("test"); // this is a test',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');
        const events = calculateActionResults(state, botAction);

        expect(events.actions).toEqual([toast('test')]);
    });

    it('should support multi-line scripts with a comment at the end', () => {
        expect.assertions(1);

        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    test:
                        '@player.toast("test"); // comment 1\n// this is a test',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');
        const events = calculateActionResults(state, botAction);

        expect(events.actions).toEqual([toast('test')]);
    });

    // describe('')

    describe('onAnyListen()', () => {
        it('should send a onAnyListen() for actions', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            setTag(this, 'name', that.name);
                            setTag(this, 'that', that.that);
                            setTag(this, 'targets', that.targets.map(b => b.id));
                            setTag(this, 'listeners', that.listeners.map(b => b.id));
                            setTag(this, 'responses', that.responses);
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        test: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        test: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot2', 'bot3', 'bot4'], null, {
                abc: 'def',
            });
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot1', {
                    tags: {
                        name: 'test',
                        that: expect.objectContaining({
                            abc: 'def',
                        }),
                        targets: ['bot2', 'bot3', 'bot4'],
                        listeners: ['bot2', 'bot3'],
                        responses: [1, 2],
                    },
                }),
            ]);
        });

        it('should send a onAnyListen() for actions that dont have listeners', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            setTag(this, 'name', that.name);
                            setTag(this, 'that', that.that);
                            setTag(this, 'targets', that.targets.map(b => b.id));
                            setTag(this, 'listeners', that.listeners.map(b => b.id));
                            setTag(this, 'responses', that.responses);
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {},
                },
                bot3: {
                    id: 'bot3',
                    tags: {},
                },
                bot4: {
                    id: 'bot4',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot2', 'bot3', 'bot4'], null, {
                abc: 'def',
            });
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot1', {
                    tags: {
                        name: 'test',
                        that: expect.objectContaining({
                            abc: 'def',
                        }),
                        targets: ['bot2', 'bot3', 'bot4'],
                        listeners: [],
                        responses: [],
                    },
                }),
            ]);
        });

        it('should send a onAnyListen() for whispers', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            if (that.name !== 'whisper') {
                                return;
                            }
                            setTag(this, 'name', that.name);
                            setTag(this, 'that', that.that);
                            setTag(this, 'targets', that.targets.map(b => b.id));
                            setTag(this, 'listeners', that.listeners.map(b => b.id));
                            setTag(this, 'responses', that.responses);
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        whisper: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {},
                },
                bot4: {
                    id: 'bot4',
                    tags: {
                        test: `@whisper(getBots('id', 'bot2'), 'whisper')`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot4'], null, {
                abc: 'def',
            });
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot1', {
                    tags: {
                        name: 'whisper',
                        targets: ['bot2'],
                        listeners: ['bot2'],
                        responses: [1],
                    },
                }),
            ]);
        });

        it('should include extra events from the onAnyListen() call', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@player.toast('Hi!');`,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        test: '@return 1;',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot2']);
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([toast('Hi!')]);
        });

        it('should allow changing responses', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            if (that.name !== 'number') {
                                return;
                            }
                            for (let i = 0; i < that.responses.length; i++) {
                                that.responses[i] = that.responses[i] * 2;
                            }
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        number: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        number: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {
                        test: `@
                            setTag(this, 'responses', shout('number'))
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot4']);
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot4', {
                    tags: {
                        responses: [2, 4],
                    },
                }),
            ]);
        });

        it('should allow removing responses', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            if (that.name !== 'number') {
                                return;
                            }
                            that.responses.length = 0;
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        number: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        number: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {
                        test: `@
                            setTag(this, 'responses', shout('number'))
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot4']);
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot4', {
                    tags: {
                        responses: [],
                    },
                }),
            ]);
        });

        it('should allow adding responses', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onAnyListen: `@
                            if (that.name !== 'number') {
                                return;
                            }
                            that.responses.unshift(0);
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        number: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        number: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {
                        test: `@
                            setTag(this, 'responses', shout('number'))
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot4']);
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot4', {
                    tags: {
                        responses: [0, 1, 2],
                    },
                }),
            ]);
        });
    });

    describe('onListen()', () => {
        it('should send a onListen() for actions to the bot that was listening', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        test: '@return 1;',
                        onListen: `@
                            setTag(this, 'name', that.name);
                            setTag(this, 'that', that.that);
                            setTag(this, 'targets', that.targets.map(b => b.id));
                            setTag(this, 'listeners', that.listeners.map(b => b.id));
                            setTag(this, 'responses', that.responses);
                        `,
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        test: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot1', 'bot3', 'bot4'], null, {
                abc: 'def',
            });
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([
                botUpdated('bot1', {
                    tags: {
                        name: 'test',
                        that: expect.objectContaining({
                            abc: 'def',
                        }),
                        targets: ['bot1', 'bot3', 'bot4'],
                        listeners: ['bot1', 'bot3'],
                        responses: [1, 2],
                    },
                }),
            ]);
        });

        it('should not send a onListen() for actions every bot', () => {
            expect.assertions(1);

            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        onListen: `@
                            setTag(this, 'name', that.name);
                            setTag(this, 'that', that.that);
                            setTag(this, 'targets', that.targets.map(b => b.id));
                            setTag(this, 'listeners', that.listeners.map(b => b.id));
                            setTag(this, 'responses', that.responses);
                        `,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        test: '@return 1;',
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        test: '@return 2;',
                    },
                },
                bot4: {
                    id: 'bot4',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot2', 'bot3', 'bot4'], null, {
                abc: 'def',
            });
            const events = calculateActionResults(state, botAction);

            expect(events.actions).toEqual([]);
        });
    });

    describe('arguments', () => {
        it('should convert the argument to a script bot if it is a bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@that.tags.hi = "changed"',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, state.otherBot);
            const result = calculateActionResults(state, botAction);
            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hi: 'changed',
                    },
                }),
            ]);
        });

        const ignoreCases = [
            ['null', null],
            ['0', 0],
            ['1', 1],
            ['false', false],
            ['true', true],
            ['undefined', undefined],
            ['*empty string*', ''],
            ['*filled string*', 'a'],
            ['*array buffer*', new ArrayBuffer(255)],
            // ['*typed array*', new Int8Array([1, 2, 3])],
        ];
        it.each(ignoreCases)(
            'should not convert the argument if it is %s',
            (desc, value) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@tags.value = that',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], null, value);
                const result = calculateActionResults(state, botAction);
                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            value: value,
                        },
                    }),
                ]);
            }
        );

        it('should convert the argument to a list of script bots if it is a list of bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@that[0].tags.hi = "changed"; this.tags.l = that.length',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, [
                state.otherBot,
            ]);
            const result = calculateActionResults(state, botAction);

            // expect(result.actions).toEqual([
            //     botUpdated('thisBot', {
            //         tags: {
            //             l: 1,
            //         },
            //     }),
            // ]);
            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hi: 'changed',
                    },
                }),
                botUpdated('thisBot', {
                    tags: {
                        l: 1,
                    },
                }),
            ]);
        });

        it('should convert the argument fields to script bots if they are bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@that.bot.tags.hi = "changed";',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, {
                bot: state.otherBot,
                num: 100,
            });
            const result = calculateActionResults(state, botAction);
            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hi: 'changed',
                    },
                }),
            ]);
        });

        it('should convert bots in arrays to script bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@that.bots[0].tags.hi = "changed"',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, {
                bots: [state.otherBot],
            });
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hi: 'changed',
                    },
                }),
            ]);
        });

        it('should handle null arguments', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#hi", "test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, null);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hi: 'test',
                    },
                }),
            ]);
        });

        it('should specify a data variable which equals that', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.equal = that === data;',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], null, state.otherBot);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        equal: true,
                    },
                }),
            ]);
        });
    });

    describe('action.perform()', () => {
        it('should add the given event to the list', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: `@action.perform({
                            type: 'test',
                            message: 'abc'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                {
                    type: 'test',
                    message: 'abc',
                },
            ]);
        });

        it('should add the action even if it is already going to be performed', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: `@action.perform(player.toast('abc'))`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([toast('abc'), toast('abc')]);
        });

        it('should should add the action if it has been rejected', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: `@
                            const toast = player.toast('abc');
                            action.reject(toast);
                            action.perform(toast);
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                toast('abc'),
                reject(toast('abc')),
                toast('abc'),
            ]);
        });
    });

    describe('action.reject()', () => {
        it('should emit a reject action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: `@action.reject({
                            type: 'test',
                            message: 'abc'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                reject(<any>{
                    type: 'test',
                    message: 'abc',
                }),
            ]);
        });

        it('should resolve the original action', () => {
            const original = toast('abc');
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        transformed: {
                            type: 'show_toast',
                            message: 'def',
                            [ORIGINAL_OBJECT]: original,
                        },
                        abcdef: `@action.reject(tags.transformed)`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([reject(toast('abc'))]);
            expect((<RejectAction>result.actions[0]).action).toBe(original);
        });
    });

    const trimEventCases = [
        ['parenthesis', 'sayHello()'],
        ['hashtag', '#sayHello'],
        ['hashtag and parenthesis', '#sayHello()'],
        ['@ symbol', '@sayHello'],
        ['@ symbol and parenthesis', '@sayHello()'],
    ];

    describe('shout()', () => {
        it('should run the event on every bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@shout("sayHello")',
                        sayHello: '@setTag(this, "#hello", true)',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        sayHello: '@setTag(this, "#hello", true)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hello: true,
                    },
                }),
                botUpdated('thisBot', {
                    tags: {
                        hello: true,
                    },
                }),
            ]);
        });

        it('should set the given argument as the that variable', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@let o = { hi: "test" }; shout("sayHello", o)',
                        sayHello: '@setTag(this, "#hello", that.hi)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hello: 'test',
                    },
                }),
            ]);
        });

        it('should handle passing bots as arguments', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@shout("sayHello", getBot("#name", "other"))',
                        sayHello:
                            '@setTag(this, "#hello", getTag(that, "#hi"))',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                        hi: 'test',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hello: 'test',
                    },
                }),
            ]);
        });

        it('should be able to modify bots that are arguments', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@shout("sayHello", getBot("#name", "other"))',
                        sayHello: '@setTag(that, "#hello", "test")',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hello: 'test',
                    },
                }),
            ]);
        });

        it('should handle bots nested in an object as an argument', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef:
                            '@let o = { other: getBot("#name", "other") }; shout("sayHello", o)',
                        sayHello: '@setTag(that.other, "#hello", "test")',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hello: 'test',
                    },
                }),
            ]);
        });

        it('should handle primitive values', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@shout("sayHello", true)',
                        sayHello: '@setTag(this, "#hello", that)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hello: true,
                    },
                }),
            ]);
        });

        it('should process the message synchronously', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef:
                            '@shout("sayHello", getBot("#name", "other")); setTag(this, "#value", getTag(getBot("#name", "other"), "#hello"))',
                        sayHello: '@setTag(that, "#hello", "test")',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hello: 'test',
                    },
                }),
                botUpdated('thisBot', {
                    tags: {
                        value: 'test',
                    },
                }),
            ]);
        });

        it('should return an array of results from the other formulas', () => {
            const state: BotsState = {
                bBot: {
                    id: 'bBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef:
                            '@let results = shout("sayHello", "test"); setTag(this, "result", results);',
                        sayHello: '@return "Wrong, " + that;',
                    },
                },
                aBot: {
                    id: 'aBot',
                    tags: {
                        sayHello: '@return "Hello, " + that;',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['bBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('bBot', {
                    tags: {
                        result: ['Hello, test', 'Wrong, test'],
                    },
                }),
            ]);
        });

        it('should handle when a bot in the shout list is deleted', () => {
            const state: BotsState = {
                bBot: {
                    id: 'bBot',
                    tags: {
                        test: '@tags.hit = true',
                    },
                },
                aBot: {
                    id: 'aBot',
                    tags: {
                        test: '@destroy("bBot")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([botRemoved('bBot')]);
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            abcdef: `@shout("${eventName}")`,
                            sayHello: '@setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            }
        );
    });

    describe('superShout()', () => {
        it('should emit a super_shout local event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@superShout("sayHello")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([superShout('sayHello')]);
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            abcdef: `@superShout("${eventName}")`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([superShout('sayHello')]);
            }
        );
    });

    describe('whisper()', () => {
        it('should send an event only to the given bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@whisper(this, "sayHello")',
                        sayHello: '@setTag(this, "#hello", true)',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        sayHello: '@setTag(this, "#hello", true)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        hello: true,
                    },
                }),
            ]);
        });

        it('should send an event only to the given list of bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@whisper(getBots("#hello"), "sayHello")',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        hello: true,
                        sayHello: '@setTag(this, "#saidHello", true)',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        hello: true,
                        sayHello: '@setTag(this, "#saidHello", true)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        saidHello: true,
                    },
                }),
                botUpdated('thatBot', {
                    tags: {
                        saidHello: true,
                    },
                }),
            ]);
        });

        it('should return an array of results from the other formulas ordered by how they were given', () => {
            const state: BotsState = {
                aBot: {
                    id: 'aBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef:
                            '@let results = whisper(["bBot", "aBot"], "sayHello", "test"); setTag(this, "result", results);',
                        sayHello: '@return "Wrong, " + that',
                    },
                },
                bBot: {
                    id: 'bBot',
                    tags: {
                        sayHello: '@return "Hello, " + that',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['aBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('aBot', {
                    tags: {
                        result: ['Hello, test', 'Wrong, test'],
                    },
                }),
            ]);
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            abcdef: `@whisper(this, "${eventName}")`,
                            sayHello: '@setTag(this, "#hello", true)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hello: true,
                        },
                    }),
                ]);
            }
        );
    });

    describe('webhook()', () => {
        it('should emit a SendWebhookAction', () => {
            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        test: `@webhook({
                            method: 'POST',
                            url: 'https://example.com',
                            data: {
                                test: 'abc'
                            },
                            responseShout: 'test.response()'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot1']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                webhook(
                    {
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    },
                    1
                ),
            ]);
        });
    });

    describe('webhook.post()', () => {
        it('should emit a SendWebhookAction', () => {
            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        test: `@webhook.post('https://example.com', { test: 'abc' }, {
                            responseShout: 'test.response()'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['bot1']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                webhook(
                    {
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    },
                    1
                ),
            ]);
        });
    });

    describe('removeTags()', () => {
        it('should remove the given tag sections on the given bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        create:
                            '@let newBot = create({ creator: getID(this) }, { stay: "def", "leaveX": 0, "leaveY": 0 }); removeTags(newBot, "leave");',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('create', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        stay: 'def',
                        leaveX: null,
                        leaveY: null,
                        creator: 'thisBot',
                    },
                }),
            ]);
        });

        it('should remove the given tags from the given array of bots', () => {
            const state: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {
                        abc: true,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        abc: true,
                    },
                },
                bot3: {
                    id: 'bot3',
                    tags: {
                        abc: true,
                    },
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        create:
                            '@let bots = getBots("abc", true); removeTags(bots, "abc");',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('create', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('bot1', {
                    tags: {
                        abc: null,
                    },
                }),
                botUpdated('bot2', {
                    tags: {
                        abc: null,
                    },
                }),
                botUpdated('bot3', {
                    tags: {
                        abc: null,
                    },
                }),
            ]);
        });
    });

    createBotTests('create', 'uuid');

    describe('destroy()', () => {
        it('should destroy and bots that have creator set to the bot ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@destroy(this)',
                    },
                },
                childBot: {
                    id: 'childBot',
                    tags: {
                        creator: 'thisBot',
                    },
                },
            };

            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botRemoved('thisBot'),
                botRemoved('childBot'),
            ]);
        });

        it('should recursively destroy bots that have creator set to the bot ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@destroy(this)',
                    },
                },
                childBot: {
                    id: 'childBot',
                    tags: {
                        creator: 'thisBot',
                    },
                },
                childChildBot: {
                    id: 'childChildBot',
                    tags: {
                        creator: 'childBot',
                    },
                },
                otherChildBot: {
                    id: 'otherChildBot',
                    tags: {
                        creator: 'thisBot',
                    },
                },
                otherChildChildBot: {
                    id: 'otherChildChildBot',
                    tags: {
                        creator: 'otherChildBot',
                    },
                },
            };

            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botRemoved('thisBot'),
                botRemoved('childBot'),
                botRemoved('childChildBot'),
                botRemoved('otherChildBot'),
                botRemoved('otherChildChildBot'),
            ]);
        });

        it('should support an array of bots to destroy', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@destroy(getBots("clone"));',
                    },
                },
                bot1: {
                    id: 'bot1',
                    tags: {
                        clone: true,
                        test1: true,
                    },
                },
                bot2: {
                    id: 'bot2',
                    tags: {
                        clone: true,
                        test2: true,
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botRemoved('bot1'),
                botRemoved('bot2'),
            ]);
        });

        it('should trigger onDestroy()', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        onDestroy:
                            '@setTag(getBot("#name", "other"), "#num", 100)',
                        test: '@destroy(this)',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'other',
                    },
                },
            };

            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                // This is weird because it means that an update for a bot could happen
                // after it gets removed but I currently don't have a great solution for it at the moment.
                botRemoved('thisBot'),
                botUpdated('otherBot', {
                    tags: {
                        num: 100,
                    },
                }),
            ]);
        });

        it('should not destroy bots that are not destroyable', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@destroy(this)',
                        onDestroy:
                            '@setTag(getBot("abc", "def"), "name", "bob")',
                        destroyable: false,
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        abc: 'def',
                    },
                },
                childBot: {
                    id: 'childBot',
                    tags: {
                        creator: 'thisBot',
                    },
                },
            };

            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);
            expect(result.actions).toEqual([]);
        });

        it('should short-circut destroying child bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@destroy(this)',
                    },
                },
                childBot: {
                    id: 'childBot',
                    tags: {
                        creator: 'thisBot',
                        destroyable: false,
                    },
                },
                grandChildBot: {
                    id: 'grandChildBot',
                    tags: {
                        creator: 'childBot',
                    },
                },
            };

            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);
            expect(result.actions).toEqual([botRemoved('thisBot')]);
        });

        it('should be able to destroy a bot that was just created', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@let bot = create(); destroy(bot)',
                    },
                },
            };

            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botAdded(
                    createBot('uuid-0', {
                        creator: 'thisBot',
                    })
                ),
                botRemoved('uuid-0'),
            ]);
        });

        it('should remove the destroyed bot from searches', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: true,
                        test:
                            '@destroy(this); player.toast(getBot("abc", true));',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botRemoved('thisBot'),
                toast(undefined),
            ]);
        });
    });

    describe('changeState()', () => {
        it('should set the state tag to the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@changeState(this, "abc")',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        state: 'abc',
                    },
                }),
            ]);
        });

        it('should send an @onEnter whisper to the bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        state: 'Xyz',
                        test: '@changeState(this, "Abc")',
                        stateAbcOnEnter:
                            '@tags.enter = that.from + "-" + that.to',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        state: 'Abc',
                        enter: 'Xyz-Abc',
                    },
                }),
            ]);
        });

        it('should send an @onExit whisper to the bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        state: 'Xyz',
                        test: '@changeState(this, "Abc")',
                        stateXyzOnExit:
                            '@tags.exit = that.from + "-" + that.to',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        state: 'Abc',
                        exit: 'Xyz-Abc',
                    },
                }),
            ]);
        });

        it('should use the given group name', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        fun: 'Xyz',
                        test: '@changeState(this, "Abc", "fun")',
                        funXyzOnExit: '@tags.exit = that.from + "-" + that.to',
                        funAbcOnEnter:
                            '@tags.enter = that.from + "-" + that.to',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        fun: 'Abc',
                        enter: 'Xyz-Abc',
                        exit: 'Xyz-Abc',
                    },
                }),
            ]);
        });

        it('should do nothing if the state does not change', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        state: 'Xyz',
                        test: '@changeState(this, "Xyz")',
                        funXyzOnExit: '@tags.exit = that.from + "-" + that.to',
                        funXyzOnEnter:
                            '@tags.enter = that.from + "-" + that.to',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([]);
        });

        it('should set the state tag on a bot from an argument to the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@changeState(that, "abc")',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            const botAction = action(
                'test',
                ['thisBot'],
                null,
                state['thatBot']
            );
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thatBot', {
                    tags: {
                        state: 'abc',
                    },
                }),
            ]);
        });

        it('should be possible to use changeState() while in onCreate()', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@create({ onCreate: "@changeState(this, 'abc')" })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('newBot');
            const botAction = action('test', ['thisBot'], null);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botAdded(
                    createBot('newBot', {
                        creator: 'thisBot',
                        onCreate: "@changeState(this, 'abc')",
                        state: 'abc',
                    })
                ),
            ]);
        });
    });

    describe('player.getDimensionalDepth()', () => {
        it('should return 0 when the bot is in the given dimension', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "depth", player.getDimensionalDepth("dimension"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        dimension: true,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot', 'userBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        depth: 0,
                    },
                }),
            ]);
        });

        const portalCases = [...KNOWN_PORTALS.map(p => [p])];

        it.each(portalCases)(
            'should return 1 when the dimension is in the %s portal',
            portal => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test:
                                '@setTag(this, "depth", player.getDimensionalDepth("dimension"))',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            [portal]: 'dimension',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            depth: 1,
                        },
                    }),
                ]);
            }
        );

        it('should return -1 otherwise', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "depth", player.getDimensionalDepth("dimension"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot', 'userBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        depth: -1,
                    },
                }),
            ]);
        });
    });

    describe('player.getBot()', () => {
        it('should get the current users bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(player.getBot(), "#name", "Test")',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot', 'userBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('userBot', {
                    tags: {
                        name: 'Test',
                    },
                }),
            ]);
        });
    });

    describe('player.replaceDragBot()', () => {
        it('should send a replace_drag_bot event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: true,
                        test: '@player.replaceDragBot(this)',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([replaceDragBot(state['thisBot'])]);
        });

        it('should return a copiable bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: true,
                        test: '@player.replaceDragBot(this)',
                    },
                },
            };

            // specify the UUID to use next
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            const dragAction = result.actions[0] as ReplaceDragBotAction;
            const bot = dragAction.bot as any;
            for (let key in bot) {
                expect(types.isProxy(bot[key])).toBe(false);
            }
        });
    });

    describe('applyMod()', () => {
        it('should update the given bot with the given diff', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@applyMod(this, { abc: "def", ghi: true, num: 1 })',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        abc: 'def',
                        ghi: true,
                        num: 1,
                    },
                }),
            ]);
        });

        it('should support multiple', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@applyMod(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        abc: 'xyz',
                        ghi: true,
                        num: 1,
                    },
                }),
            ]);
        });

        it('should apply the values to the bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: 123,
                        test:
                            '@applyMod(this, { abc: "def", ghi: true, num: 1 }); applyMod(this, { "abc": getTag(this, "#abc") })',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        abc: 'def',
                        ghi: true,
                        num: 1,
                    },
                }),
            ]);
        });

        it('should not send a onModDrop() event to the affected bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: 123,
                        onModDrop: '@setTag(this, "#diffed", true)',
                        test:
                            '@applyMod(this, { abc: "def", ghi: true, num: 1 });',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        abc: 'def',
                        ghi: true,
                        num: 1,
                    },
                }),
            ]);
        });

        it('should support merging mods into mods', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@let m = { abc: true }; applyMod(m, { def: 123 }); applyMod(this, m);`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        abc: true,
                        def: 123,
                    },
                }),
            ]);
        });
    });

    describe('server.loadFile()', () => {
        it('should issue a LoadFileAction in a remote event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: true,
                        test: '@server.loadFile("path")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(
                    loadFile({
                        path: 'path',
                    }),
                    undefined,
                    undefined,
                    'uuid-0'
                ),
            ]);
        });
    });

    describe('subtractMods()', () => {
        it('should set the tags from the given mod to null', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        value1: 123,
                        value2: true,
                        value3: 'abc',
                        test: `@subtractMods(this, {
                            value1: 'anything1',
                            value2: 'anything2',
                            value3: 'anything3',
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        value1: null,
                        value2: null,
                        value3: null,
                    },
                }),
            ]);
        });

        it('should not send a onModDrop() event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        onModDrop: `@tags.modded = true`,
                        value1: 123,
                        value2: true,
                        value3: 'abc',
                        test: `@subtractMods(this, {
                            value1: 'anything1',
                            value2: 'anything2',
                            value3: 'anything3',
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        value1: null,
                        value2: null,
                        value3: null,
                    },
                }),
            ]);
        });
    });

    describe('getUserMenuDimension()', () => {
        it('should return the menuPortal tag from the user bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#dimension", player.getMenuDimension())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        menuPortal: 'abc',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot', 'userBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        dimension: 'abc',
                    },
                }),
            ]);
        });
    });

    describe('player.toast()', () => {
        it('should emit a ShowToastAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.toast("hello, world!")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([toast('hello, world!')]);
        });
    });

    describe('player.showJoinCode()', () => {
        it('should emit a ShowJoinCodeEvent', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showJoinCode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showJoinCode()]);
        });

        it('should allow linking to a specific story and dimension', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showJoinCode("story", "dimension")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showJoinCode('story', 'dimension'),
            ]);
        });
    });

    describe('player.requestFullscreenMode()', () => {
        it('should issue a request_fullscreen action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.requestFullscreenMode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([requestFullscreen()]);
        });
    });

    describe('player.exitFullscreenMode()', () => {
        it('should issue a request_fullscreen action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.exitFullscreenMode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([exitFullscreen()]);
        });
    });

    describe('player.showHtml()', () => {
        it('should issue a show_html action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showHtml("hello, world!")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([html('hello, world!')]);
        });
    });

    describe('player.hideHtml()', () => {
        it('should issue a hide_html action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.hideHtml()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([hideHtml()]);
        });
    });

    describe('player.setClipboard()', () => {
        it('should emit a SetClipboardEvent', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.setClipboard("test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([setClipboard('test')]);
        });
    });

    describe('player.tweenTo()', () => {
        it('should emit a TweenToAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.tweenTo("test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([tweenTo('test')]);
        });

        it('should handle bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.tweenTo(this)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([tweenTo('thisBot')]);
        });

        it('should support specifying a duration', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@player.tweenTo("test", undefined, undefined, undefined, 10)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                tweenTo('test', undefined, undefined, undefined, 10),
            ]);
        });
    });

    describe('player.moveTo()', () => {
        it('should emit a TweenToAction with the duration set to 0', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.moveTo("test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                {
                    type: 'tween_to',
                    botId: 'test',
                    zoomValue: null,
                    rotationValue: null,
                    duration: 0,
                },
            ]);
        });
    });

    describe('player.showChat()', () => {
        it('should emit a ShowChatBarAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showChat()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showChat()]);
        });

        it('should emit a ShowChatBarAction with the given prefill', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showChat("test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showChat({
                    placeholder: 'test',
                }),
            ]);
        });

        it('should emit a ShowChatBarAction with the given options', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@player.showChat({
                            placeholder: "abc",
                            prefill: "def"
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showChat({
                    placeholder: 'abc',
                    prefill: 'def',
                }),
            ]);
        });
    });

    describe('player.hideChat()', () => {
        it('should emit a ShowChatBarAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.hideChat()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([hideChat()]);
        });
    });

    describe('player.run()', () => {
        it('should emit a RunScriptAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.run("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([runScript('abc', 1)]);
        });
    });

    describe('player.version()', () => {
        it('should return an object with version information', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.version = player.version()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction, undefined, {
                hash: 'abc',
                version: 'v1.0.2',
                major: 1,
                minor: 0,
                patch: 2,
            });

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        version: {
                            hash: 'abc',
                            version: 'v1.0.2',
                            major: 1,
                            minor: 0,
                            patch: 2,
                        },
                    },
                }),
            ]);
        });
    });

    describe('player.device()', () => {
        it('should return an object with device information', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.device = player.device()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction, {
                supportsAR: true,
                supportsVR: false,
            });

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        device: {
                            supportsAR: true,
                            supportsVR: false,
                        },
                    },
                }),
            ]);
        });

        it('should return info with null values if not specified', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.device = player.device()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        device: {
                            supportsAR: null,
                            supportsVR: null,
                        },
                    },
                }),
            ]);
        });
    });

    describe('player.enableAR()', () => {
        it('should issue an EnableARAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.enableAR()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([enableAR()]);
        });
    });

    describe('player.disableAR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.disableAR()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([disableAR()]);
        });
    });

    describe('player.enableVR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.enableVR()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([enableVR()]);
        });
    });

    describe('player.disableVR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.disableVR()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([disableVR()]);
        });
    });

    describe('player.downloadBots()', () => {
        it('should emit a DownloadAction with the given bots formatted as JSON', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@player.downloadBots(getBots(inDimension("abc")), "test")',
                    },
                },
                funBot: {
                    id: 'funBot',
                    tags: {
                        abc: true,
                        def: 'ghi',
                    },
                },
                funBot2: {
                    id: 'funBot2',
                    tags: {
                        abc: true,
                        def: 123,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            funBot: state.funBot,
                            funBot2: state.funBot2,
                        },
                    }),
                    'test.aux',
                    'application/json'
                ),
            ]);
        });

        it('should support specifying the .aux extension manually', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@player.downloadBots(getBots(inDimension("abc")), "test.aux")',
                    },
                },
                funBot: {
                    id: 'funBot',
                    tags: {
                        abc: true,
                        def: 'ghi',
                    },
                },
                funBot2: {
                    id: 'funBot2',
                    tags: {
                        abc: true,
                        def: 123,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            funBot: state.funBot,
                            funBot2: state.funBot2,
                        },
                    }),
                    'test.aux',
                    'application/json'
                ),
            ]);
        });
    });

    describe('player.showUploadAuxFile()', () => {
        it('should emit a showUploadAuxFileAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showUploadAuxFile()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showUploadAuxFile()]);
        });
    });

    describe('player.downloadStory()', () => {
        it('should emit a DownloadAction with the current state and story name', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.downloadStory()',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        story: 'channel',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                download(
                    JSON.stringify({
                        version: 1,
                        state: state,
                    }),
                    'channel.aux',
                    'application/json'
                ),
            ]);
        });

        it('should only include bots in the shared space', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.downloadStory()',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    space: 'shared',
                    tags: {
                        name: 'that',
                    },
                },
                userBot: {
                    id: 'userBot',
                    space: 'tempLocal',
                    tags: {
                        story: 'channel',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    space: 'local',
                    tags: {
                        name: 'other',
                    },
                },
                historyBot: {
                    id: 'historyBot',
                    space: 'history',
                    tags: {
                        name: 'history',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            thatBot: state.thatBot,
                            thisBot: state.thisBot,
                        },
                    }),
                    'channel.aux',
                    'application/json'
                ),
            ]);
        });
    });

    describe('openQRCodeScanner()', () => {
        it('should emit a OpenQRCodeScannerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openQRCodeScanner()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openQRCodeScanner(true)]);
        });

        it('should use the given camera type', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openQRCodeScanner("front")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openQRCodeScanner(true, 'front')]);
        });
    });

    describe('closeQRCodeScanner()', () => {
        it('should emit a OpenQRCodeScannerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.closeQRCodeScanner()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openQRCodeScanner(false)]);
        });
    });

    describe('showQRCode()', () => {
        it('should emit a ShowQRCodeAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showQRCode("hello")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showQRCode(true, 'hello')]);
        });
    });

    describe('hideQRCode()', () => {
        it('should emit a ShowQRCodeAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.hideQRCode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showQRCode(false)]);
        });
    });

    describe('openBarcodeScanner()', () => {
        it('should emit a OpenBarcodeScannerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openBarcodeScanner()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openBarcodeScanner(true)]);
        });

        it('should use the given camera type', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openBarcodeScanner("front")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openBarcodeScanner(true, 'front')]);
        });
    });

    describe('closeBarcodeScanner()', () => {
        it('should emit a OpenBarcodeScannerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.closeBarcodeScanner()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openBarcodeScanner(false)]);
        });
    });

    describe('showBarcode()', () => {
        it('should emit a ShowBarcodeAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showBarcode("hello")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showBarcode(true, 'hello')]);
        });

        it('should include the given format', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showBarcode("hello", "format")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showBarcode(true, 'hello', <any>'format'),
            ]);
        });
    });

    describe('hideBarcode()', () => {
        it('should emit a ShowBarcodeAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.hideBarcode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showBarcode(false)]);
        });
    });

    describe('loadStory()', () => {
        it('should emit a LoadStoryAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.loadStory("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([loadSimulation('abc')]);
        });
    });

    describe('unloadStory()', () => {
        it('should emit a UnloadStoryAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.unloadStory("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([unloadSimulation('abc')]);
        });
    });

    describe('loadAUX()', () => {
        it('should emit a ImportAUXEvent', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.importAUX("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([importAUX('abc')]);
        });

        it('should emit a AddStateEvent if given JSON', () => {
            const uploadState: BotsState = {
                uploadBot: {
                    id: 'uploadBot',
                    tags: {
                        abc: 'def',
                    },
                },
            };
            const json = JSON.stringify({
                version: 1,
                state: uploadState,
            });
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@player.importAUX('${json}')`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([addState(uploadState)]);
        });
    });

    describe('player.isInDimension()', () => {
        it('should return true when pagePortal equals the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#inDimension", player.isInDimension("dimension"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        pagePortal: 'dimension',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        inDimension: true,
                    },
                }),
            ]);
        });

        it('should return false when pagePortal does not equal the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#inDimension", player.isInDimension("abc"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        pagePortal: 'dimension',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        inDimension: false,
                    },
                }),
            ]);
        });

        it('should return false when pagePortal is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#inDimension", player.isInDimension("abc"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        inDimension: false,
                    },
                }),
            ]);
        });
    });

    describe('player.getCurrentDimension()', () => {
        it('should return pagePortal', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#dimension", player.getCurrentDimension())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        pagePortal: 'dimension',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        dimension: 'dimension',
                    },
                }),
            ]);
        });

        it('should return undefined when pagePortal is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#dimension", player.getCurrentDimension())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        dimension: undefined,
                    },
                }),
            ]);
        });
    });

    describe('player.getCurrentStory()', () => {
        it('should return story', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#dimension", player.getCurrentStory())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        story: 'dimension',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        dimension: 'dimension',
                    },
                }),
            ]);
        });

        it('should return undefined when story is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#dimension", player.getCurrentStory())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        dimension: undefined,
                    },
                }),
            ]);
        });

        it.each(possibleTagValueCases)(
            'it should support %s',
            (given, actual) => {
                const expected = hasValue(actual)
                    ? actual.toString()
                    : undefined;
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test:
                                '@setTag(this, "#dimension", player.getCurrentStory())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            story: given,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            dimension: expected,
                        },
                    }),
                ]);
            }
        );
    });

    describe('player.getPortalDimension()', () => {
        const cases = [
            ['page', 'pageDimension'],
            ['pagePortal', 'pageDimension'],
            ['inventory', 'inventoryDimension'],
            ['inventoryPortal', 'inventoryDimension'],
            ['menu', 'menuDimension'],
            ['menuPortal', 'menuDimension'],
            ['sheet', 'sheetDimension'],
            ['sheetPortal', 'sheetDimension'],
            ['missing', null],
            ['falsy', null],
        ];

        it.each(cases)(
            'should get the dimension for the %s portal',
            (portal, expectedDimension) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@setTag(this, "#fun", player.getPortalDimension("${portal}"))`,
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            pagePortal: 'pageDimension',
                            inventoryPortal: 'inventoryDimension',
                            menuPortal: 'menuDimension',
                            sheetPortal: 'sheetDimension',
                            falsy: false,
                            number: 0,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            fun: expectedDimension,
                        },
                    }),
                ]);
            }
        );
    });

    describe('player.showInputForTag()', () => {
        it('should emit a ShowInputForTagAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showInputForTag(this, "abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showInputForTag('thisBot', 'abc')]);
        });

        it('should support passing a bot ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.showInputForTag("test", "abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showInputForTag('test', 'abc')]);
        });

        it('should trim the first hash from the tag', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@player.showInputForTag("test", "##abc"); player.showInputForTag("test", "#abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showInputForTag('test', '#abc'),
                showInputForTag('test', 'abc'),
            ]);
        });

        it('should support extra options', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@player.showInputForTag("test", "abc", { backgroundColor: "red", foregroundColor: "green" })',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showInputForTag('test', 'abc', {
                    backgroundColor: 'red',
                    foregroundColor: 'green',
                }),
            ]);
        });
    });

    describe('goToDimension()', () => {
        it('should issue a GoToDimension event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.goToDimension("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([goToDimension('abc')]);
        });

        it('should ignore extra parameters', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.goToDimension("sim", "abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([goToDimension('sim')]);
        });
    });

    describe('player.goToURL()', () => {
        it('should issue a GoToURL event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.goToURL("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([goToURL('abc')]);
        });
    });

    describe('player.openURL()', () => {
        it('should issue a OpenURL event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openURL("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openURL('abc')]);
        });
    });

    describe('player.openDevConsole()', () => {
        it('should issue a OpenConsole event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@player.openDevConsole()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([openConsole()]);
        });
    });

    describe('getMod()', () => {
        it('should create a diff that applies the given tags from the given bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@applyMod(this, getMod(getBot("#name", "bob"), "val", /test\\..+/))',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'bob',
                        val: 123,
                        'test.fun': true,
                        'test.works': 'yes',
                        'even.test.wow': 456,
                        'test.': 'no',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        val: 123,
                        'test.fun': true,
                        'test.works': 'yes',
                        'even.test.wow': 456,
                    },
                }),
            ]);
        });

        it('should create a diff with all tags if no filters are given', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@applyMod(this, getMod(getBots("name", "bob").first()))',
                    },
                },
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'bob',
                        val: 123,
                        'test.fun': true,
                        'test.works': 'yes',
                        'even.test.wow': 456,
                        'test.': 'no',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        name: 'bob',
                        val: 123,
                        'test.fun': true,
                        'test.works': 'yes',
                        'even.test.wow': 456,
                        'test.': 'no',
                    },
                }),
            ]);
        });

        it('should create a diff from another diff', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@applyMod(this, getMod({abc: true, val: 123}, "val"))',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        val: 123,
                    },
                }),
            ]);
        });

        it('should create a diff from JSON', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@applyMod(this, getMod('{"abc": true, "val": 123}', "val"))`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        val: 123,
                    },
                }),
            ]);
        });
    });

    describe('setTag()', () => {
        it('should issue a bot update for the given tag', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#name", "bob")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });

        it('should issue a bot update for the given tag on multiple bots', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#name", "bob")',
                    },
                },

                thatBot: {
                    id: 'thatBot',
                    tags: {
                        test: '@setTag(getBots("id"), "#name", "bob")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thatBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thatBot', {
                    tags: {
                        name: 'bob',
                    },
                }),

                botUpdated('thisBot', {
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });

        it('should make future getTag() calls use the set value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@setTag(this, "#name", "bob"); setTag(this, "#abc", getTag(this, "#name"))',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        name: 'bob',
                        abc: 'bob',
                    },
                }),
            ]);
        });

        it('should not allow setting the ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "id", "wrong")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([]);
        });

        it('should not allow setting the space', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "space", "wrong")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([]);
        });

        it('should not allow setting the space on another mod', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@
                            let mod = {};
                            setTag(mod, "space", "wrong");
                            tags.equal = mod.space === "wrong";
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        equal: false,
                    },
                }),
            ]);
        });

        it('should not allow setting the id on another mod', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@
                            let mod = {};
                            setTag(mod, "id", "wrong");
                            tags.equal = mod.id === "wrong";
                        `,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        equal: false,
                    },
                }),
            ]);
        });

        it('should allow setting a tag on a bot from an argument', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(that, "#name", "bob")',
                    },
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {
                        name: 'wrong',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action(
                'test',
                ['thisBot'],
                null,
                state['thatBot']
            );
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('thatBot', {
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });
    });

    describe('server.setupStory()', () => {
        it('should send a SetupChannelAction in a RemoteAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@server.setupStory("channel", this)',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        auxPlayerName: 'testUser',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(
                    setupStory(
                        'channel',
                        createBot('thisBot', {
                            test: '@server.setupStory("channel", this)',
                        })
                    ),
                    undefined,
                    undefined,
                    'uuid-0'
                ),
            ]);
        });
    });

    describe('server.shell()', () => {
        it('should emit a remote shell event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@server.shell("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([remote(shell('abc'))]);
        });
    });

    describe('server.backupToGithub()', () => {
        it('should emit a remote backup to github event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@server.backupToGithub("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([remote(backupToGithub('abc'))]);
        });
    });

    describe('server.backupAsDownload()', () => {
        it('should emit a remote backup as download event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test:
                            '@server.backupAsDownload({ username: "abc", device: "123", session: "def" })',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(
                    backupAsDownload({
                        username: 'abc',
                        deviceId: '123',
                        sessionId: 'def',
                    })
                ),
            ]);
        });
    });

    describe('player.checkout()', () => {
        it('should emit a start checkout event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@player.checkout({
                            publishableKey: 'key',
                            productId: 'ID1',
                            title: 'Product 1',
                            description: '$50.43',
                            processingStory: 'channel2'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingStory: 'channel2',
                }),
            ]);
        });
    });

    describe('server.finishCheckout()', () => {
        it('should emit a finish checkout event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.finishCheckout({
                            secretKey: 'key',
                            token: 'token1',
                            description: 'Test',
                            amount: 100,
                            currency: 'usd'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                finishCheckout('key', 'token1', 100, 'usd', 'Test'),
            ]);
        });

        it('should include extra info', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.finishCheckout({
                            secretKey: 'key',
                            token: 'token1',
                            description: 'Test',
                            amount: 100,
                            currency: 'usd',
                            extra: {
                                abc: 'def'
                            }
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                finishCheckout('key', 'token1', 100, 'usd', 'Test', {
                    abc: 'def',
                }),
            ]);
        });
    });

    describe('server.markHistory()', () => {
        it('should emit a mark_history event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.markHistory({
                            message: 'testMark'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(
                    markHistory({
                        message: 'testMark',
                    }),
                    undefined,
                    false
                ),
            ]);
        });
    });

    describe('server.browseHistory()', () => {
        it('should emit a browse_history event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.browseHistory()`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([remote(browseHistory())]);
        });
    });

    describe('server.restoreHistoryMark()', () => {
        it('should emit a restore_history_mark event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.restoreHistoryMark("mark")`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(restoreHistoryMark('mark')),
            ]);
        });
    });

    describe('server.restoreHistoryMarkToStory()', () => {
        it('should emit a restore_history_mark event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@server.restoreHistoryMarkToStory("mark", "story")`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(<RestoreHistoryMarkAction>{
                    type: 'restore_history_mark',
                    mark: 'mark',
                    story: 'story',
                }),
            ]);
        });
    });

    describe('remote()', () => {
        const cases = [
            ['player.toast("My Message!")', toast('My Message!')],
            ['player.goToDimension("dimension")', goToDimension('dimension')],
            ['player.openURL("url")', openURL('url')],
            ['player.goToURL("url")', goToURL('url')],
            ['player.tweenTo("id")', tweenTo('id')],
            ['player.openURL("url")', openURL('url')],
            ['player.openQRCodeScanner()', openQRCodeScanner(true)],
            ['player.closeQRCodeScanner()', openQRCodeScanner(false)],
            ['player.openBarcodeScanner()', openBarcodeScanner(true)],
            ['player.closeBarcodeScanner()', openBarcodeScanner(false)],
            ['player.showBarcode("code")', showBarcode(true, 'code')],
            ['player.hideBarcode()', showBarcode(false)],
            ['player.loadStory("channel")', loadSimulation('channel')],
            ['player.unloadStory("channel")', unloadSimulation('channel')],
            ['player.importAUX("aux")', importAUX('aux')],
            ['player.showQRCode("code")', showQRCode(true, 'code')],
            ['player.hideQRCode()', showQRCode(false)],
            [
                'player.showInputForTag(this, "abc")',
                showInputForTag('thisBot', 'abc'),
            ],
            [
                `player.checkout({
                publishableKey: 'my_key',
                productId: 'ID1',
                title: 'Product 1',
                description: '$50.43',
                processingStory: 'channel2'
            })`,
                checkout({
                    publishableKey: 'my_key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingStory: 'channel2',
                }),
            ],
            ['player.openDevConsole()', openConsole()],
        ];

        it.each(cases)('should wrap %s in a remote event', (script, event) => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@remote(${script})`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([remote(event)]);
        });

        it('should send the right selector', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@remote(player.toast("Hi!"), {
                            session: 's',
                            username: 'u',
                            device: 'd'
                        })`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                remote(toast('Hi!'), {
                    sessionId: 's',
                    username: 'u',
                    deviceId: 'd',
                }),
            ]);
        });
    });

    const nonStringScriptCases = [['true', true], ['false', false], ['0', 0]];
    it.each(nonStringScriptCases)(
        'should include scripts that are formulas but return %s',
        (val, expected) => {
            expect.assertions(2);
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `="@return ${val}"`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const { actions, results } = calculateActionResults(
                state,
                botAction
            );

            expect(actions).toEqual([]);
            expect(results).toEqual([expected]);
        }
    );

    const nullScriptCases = ['null', 'undefined', '""'];

    it.each(nullScriptCases)(
        'should skip scripts that are formulas but return %s',
        val => {
            expect.assertions(2);

            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {},
                },
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `=${val}`,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot'], 'userBot');
            const { actions, results } = calculateActionResults(
                state,
                botAction
            );

            expect(actions).toEqual([]);
            expect(results).toEqual([]);
        }
    );

    it('should return the result of the formula', () => {
        const state: BotsState = {
            userBot: {
                id: 'userBot',
                tags: {},
            },
            thisBot: {
                id: 'thisBot',
                tags: {
                    test: '@return 10',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');
        const { actions, results } = calculateActionResults(state, botAction);

        expect(results).toEqual([10]);
        expect(actions).toEqual([]);
    });

    function createBotTests(name: string, id: string, expectedId: string = id) {
        describe(`${name}()`, () => {
            it('should automatically set the creator to the current bot ID', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}({ abc: "def" })`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            creator: 'thisBot',
                        },
                    }),
                ]);
            });
            it('should ignore strings because they are no longer used to set the creator ID', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}("otherBot", { abc: "def" })`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            creator: 'thisBot',
                        },
                    }),
                ]);
            });
            it('should support multiple arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}({ abc: "def" }, { ghi: 123 })`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            ghi: 123,
                            creator: 'thisBot',
                        },
                    }),
                ]);
            });
            it('should support bots as arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}(getBots("name", "that"))`,
                        },
                    },
                    thatBot: {
                        id: 'thatBot',
                        tags: {
                            name: 'that',
                            abc: 'def',
                            formula: '=this.abc',
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            name: 'that',
                            formula: '=this.abc',
                            creator: 'thisBot',
                        },
                    }),
                ]);
            });
            it('should return the created bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@setTag(this, "#newBotId", ${name}({ creator: null }, { abc: "def" }).id)`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            newBotId: expectedId,
                        },
                    }),
                ]);
            });
            it('should support modifying the returned bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@let newBot = ${name}({ creator: null }, { abc: "def" }); setTag(newBot, "#fun", true); setTag(newBot, "#num", 123);`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            fun: true,
                            num: 123,
                        },
                    }),
                ]);
            });
            it('should add the new bot to the formulas', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}({ creator: null }, { name: "bob" }); setTag(this, "#botId", getBot("#name", "bob").id)`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            name: 'bob',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            botId: expectedId,
                        },
                    }),
                ]);
            });
            it('should support formulas on the new bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@let newBot = ${name}({ creator: null }, { formula: "=getTag(this, \\"#num\\")", num: 100 }); setTag(this, "#result", getTag(newBot, "#formula"));`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            formula: '=getTag(this, "#num")',
                            num: 100,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            result: 100,
                        },
                    }),
                ]);
            });
            it('should return normal javascript objects', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            num: 100,
                            test: `@let newBot = ${name}({ abc: getTag(this, "#num") });`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'thisBot',
                            abc: 100,
                        },
                    }),
                ]);
            });
            it('should trigger onCreate() on the created bot.', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            num: 1,
                            test: `@${name}({ abc: getTag(this, "#num"), "onCreate": "@setTag(this, \\"#num\\", 100)" });`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'thisBot',
                            abc: 1,
                            onCreate: '@setTag(this, "#num", 100)',
                            num: 100,
                        },
                    }),
                ]);
            });

            it('should trigger onAnyCreate() with the created bot as a parameter', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            num: 1,
                            test: `@${name}({ abc: getTag(this, "#num") });`,
                        },
                    },
                    shoutBot: {
                        id: 'shoutBot',
                        tags: {
                            onAnyCreate: '@setTag(this, "#num", 100)',
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'thisBot',
                            abc: 1,
                        },
                    }),
                    botUpdated('shoutBot', {
                        tags: {
                            num: 100,
                        },
                    }),
                ]);
            });
            it('should support arrays of diffs as arguments', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@setTag(this, "#num", ${name}([ { hello: true }, { hello: false } ]).length)`,
                        },
                    },
                };
                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `${id}-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            creator: 'thisBot',
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            creator: 'thisBot',
                            hello: false,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            num: 2,
                        },
                    }),
                ]);
            });
            it('should create every combination of diff', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@setTag(this, "#num", ${name}([ { hello: true }, { hello: false } ], [ { wow: 1 }, { oh: "haha" }, { test: "a" } ]).length)`,
                        },
                    },
                };
                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `${id}-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            creator: 'thisBot',
                            hello: true,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            creator: 'thisBot',
                            hello: false,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-2`,
                        tags: {
                            creator: 'thisBot',
                            hello: true,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-3`,
                        tags: {
                            creator: 'thisBot',
                            hello: false,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-4`,
                        tags: {
                            creator: 'thisBot',
                            hello: true,
                            test: 'a',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-5`,
                        tags: {
                            creator: 'thisBot',
                            hello: false,
                            test: 'a',
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            num: 6,
                        },
                    }),
                ]);
            });
            it('should duplicate each of the bots in the list', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}(getBots("test", true))`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    },
                    bBot: {
                        id: 'bBot',
                        tags: {
                            test: true,
                            hello: false,
                        },
                    },
                };
                // specify the UUID to use next
                let num = 0;
                uuidMock.mockImplementation(() => `${id}-${num++}`);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            creator: 'thisBot',
                            test: true,
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            creator: 'thisBot',
                            test: true,
                            hello: false,
                        },
                    }),
                ]);
            });
            it('should copy the space of another bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}(getBots("test", true))`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        space: 'tempLocal',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        space: 'tempLocal',
                        tags: {
                            test: true,
                            hello: true,
                        },
                    }),
                ]);
            });

            it('should be able to shout to a new bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}(getBots("test", true)); shout("abc");`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.hit = true;`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'thisBot',
                            test: true,
                            abc: `@tags.hit = true;`,
                            hit: true,
                        },
                    }),
                    botUpdated('aBot', {
                        tags: {
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should be able to shout to a new bot that is just now listening', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@${name}(getBots("test", true), { auxListening: true }); shout("abc");`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.hit = true;`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'thisBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should be able to shout to a bot that was created during another shout', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@shout("create"); shout("abc");`,
                        },
                    },
                    creatorBot: {
                        id: 'creatorBot',
                        tags: {
                            create: `@${name}(getBots("test", true), { auxListening: true });`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.hit = true;`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should be able to shout multiple times to a bot that was created during another shout', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@shout("create"); shout("abc"); shout("def")`,
                        },
                    },
                    creatorBot: {
                        id: 'creatorBot',
                        tags: {
                            create: `@${name}(getBots("test", true), { auxListening: true, space: 'custom' });`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.hit = true;`,
                            def: `@tags.hit2 = true;`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        space: <any>'custom',
                        tags: {
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                            def: `@tags.hit2 = true;`,
                            hit: true,
                            hit2: true,
                        },
                    }),
                ]);
            });

            it('should be able to whisper to a bot that was created during another shout', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@let [newBot] = shout("create"); whisper(newBot, "abc");`,
                        },
                    },
                    creatorBot: {
                        id: 'creatorBot',
                        tags: {
                            create: `@return ${name}(getBots("test", true), { auxListening: true });`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.hit = true;`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should be able to whisper to itself after being created', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@shout("create"); shout("abc");`,
                        },
                    },
                    creatorBot: {
                        id: 'creatorBot',
                        tags: {
                            create: `@return ${name}(getBots("test", true), { auxListening: true });`,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            abc: `@tags.value = 10; whisper(this, "def")`,
                            def: `@tags.hit = tags.value === 10;`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            creator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.value = 10; whisper(this, "def")`,
                            def: `@tags.hit = tags.value === 10;`,
                            hit: true,
                            value: 10,
                        },
                    }),
                ]);
            });

            it('should support complicated setup expressions', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@shout("ensureCreated"); shout("ensureCreated");`,
                        },
                    },
                    creatorBot: {
                        id: 'creatorBot',
                        tags: {
                            ensureCreated: `@
                                let b = getBot(byTag("test", true), bySpace("custom"));
                                if (!b) {
                                    b = ${name}(getBots("test", true), { auxListening: true, space: "custom" });
                                    whisper(b, "setup");
                                }

                                return b;
                            `,
                        },
                    },
                    aBot: {
                        id: 'aBot',
                        tags: {
                            test: true,
                            setup: `@whisper(this, "otherPart")`,
                            otherPart: `@tags.hitSetup = true`,
                            auxListening: false,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionResults(state, botAction);

                expect(result.actions).toEqual([
                    botAdded({
                        id: expectedId,
                        space: <any>'custom',
                        tags: {
                            test: true,
                            auxListening: true,
                            setup: `@whisper(this, "otherPart")`,
                            otherPart: `@tags.hitSetup = true`,
                            hitSetup: true,
                        },
                    }),
                ]);
            });

            describe('space', () => {
                it('should set the space of the bot', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { space: "local" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            space: 'local',
                            tags: {},
                        }),
                    ]);
                });

                it('should use the last space', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { space: "cookie" }, { space: "local" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            space: 'local',
                            tags: {},
                        }),
                    ]);
                });

                it('should use the last space even if it is null', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { space: "cookie" }, { space: null })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {},
                        }),
                    ]);
                });

                const normalCases = [
                    ['null', null],
                    ['undefined', undefined],
                    ['(empty string)', '""'],
                ];

                it.each(normalCases)(
                    'should treat %s as the default type',
                    (desc, value) => {
                        const state: BotsState = {
                            thisBot: {
                                id: 'thisBot',
                                tags: {
                                    test: `@${name}({ creator: null }, { space: ${value} })`,
                                },
                            },
                        };
                        // specify the UUID to use next
                        uuidMock.mockReturnValue(id);
                        const botAction = action('test', ['thisBot']);
                        const result = calculateActionResults(state, botAction);

                        expect(result.actions).toEqual([
                            botAdded({
                                id: expectedId,
                                tags: {},
                            }),
                        ]);
                    }
                );
            });

            describe('creator', () => {
                it('should set the creator to the given bot', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: getID(getBot("other", true)) }, { abc: "def" })`,
                            },
                        },
                        otherBot: {
                            id: 'otherBot',
                            tags: {
                                other: true,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                abc: 'def',
                                creator: 'otherBot',
                            },
                        }),
                    ]);
                });

                it('should be able to set the creator to null', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { abc: "def" })`,
                            },
                        },
                        otherBot: {
                            id: 'otherBot',
                            tags: {
                                other: true,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ]);
                });

                it('should set creator to null if it references a bot in a different space', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: "otherBot" }, { space: "def" })`,
                            },
                        },
                        otherBot: {
                            id: 'otherBot',
                            space: 'shared',
                            tags: {
                                other: true,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            space: <any>'def',
                            tags: {},
                        }),
                    ]);
                });

                it('should set creator to null if it references a bot that does not exist', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: "otherBot" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionResults(state, botAction);

                    expect(result.actions).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {},
                        }),
                    ]);
                });
            });
        });
    }
});
