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
import type { MemoryPartition } from '@casual-simulation/aux-common/partitions';
import { createMemoryPartition } from '@casual-simulation/aux-common/partitions';
import { AuxRuntime, registerInterpreterModule } from './AuxRuntime';
import type {
    BotAction,
    BotsState,
    ShoutAction,
    RejectAction,
    ReplaceDragBotAction,
    BotSpace,
    StateUpdatedEvent,
    RuntimeBot,
    Bot,
    IdentifiedBotModule,
    ExportsModule,
    PartialPrecalculatedBotsState,
    DynamicListener,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    createPrecalculatedBot,
    toast,
    botAdded,
    botRemoved,
    action,
    botUpdated,
    reject,
    superShout,
    ORIGINAL_OBJECT,
    webhook,
    KNOWN_PORTALS,
    replaceDragBot,
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
    shell,
    loadSimulation,
    unloadSimulation,
    showInput,
    asyncResult,
    asyncError,
    getRemoteCount,
    stateUpdatedEvent,
    DEFAULT_TAG_MASK_SPACE,
    DNA_TAG_PREFIX,
    tagsOnBot,
    TEMPORARY_BOT_PARTITION_ID,
    registerBuiltinPortal,
    isRuntimeBot,
    registerCustomApp,
    defineGlobalBot,
    createBotLink,
    formatBotVector,
    formatBotRotation,
    STRING_TAG_PREFIX,
    NUMBER_TAG_PREFIX,
    formatBotDate,
    ON_ANY_BOTS_ADDED_ACTION_NAME,
    ON_ANY_BOTS_CHANGED_ACTION_NAME,
    ON_ANY_BOTS_REMOVED_ACTION_NAME,
    UNMAPPABLE,
    DATE_TAG_PREFIX,
    VECTOR_TAG_PREFIX,
    ROTATION_TAG_PREFIX,
    iterableNext,
    iterableComplete,
    iterableThrow,
} from '@casual-simulation/aux-common/bots';
import { v4 as uuid } from 'uuid';
import {
    waitAsync,
    allDataTypeCases,
} from '@casual-simulation/aux-common/test/TestHelpers';
import { types } from 'util';
import {
    remote,
    device,
    deviceResult,
    deviceError,
    DEFAULT_BRANCH_NAME,
    ON_RESOLVE_MODULE,
} from '@casual-simulation/aux-common';
import { possibleTagValueCases } from '@casual-simulation/aux-common/bots/test/BotTestHelpers';
import { RealtimeEditMode } from './RuntimeBot';
import { skip } from 'rxjs/operators';
import type { DebuggerInterface, DebuggerVariable } from './AuxLibrary';
import { createDefaultLibrary, GET_RUNTIME } from './AuxLibrary';
import type { ActionResult, ScriptError } from './AuxResults';
import type { AuxVersion } from './AuxVersion';
import type { AuxDevice } from './AuxDevice';
import { DefaultRealtimeEditModeProvider } from './AuxRealtimeEditModeProvider';
import { isPromise } from './Utils';
import {
    del,
    edit,
    insert,
    preserve,
} from '@casual-simulation/aux-common/bots';
import { merge } from '@casual-simulation/aux-common/utils';
import { flatMap, pickBy } from 'lodash';
import type { SubscriptionLike } from 'rxjs';
import { DateTime } from 'luxon';
import {
    Vector2,
    Vector3,
    Rotation,
    Quaternion,
} from '@casual-simulation/aux-common/math';
import { Interpreter } from '@casual-simulation/js-interpreter';
import type { RuntimeStop } from './CompiledBot';
import { DynamicImports } from './AuxRuntimeDynamicImports';
import type { RuntimeActions } from './RuntimeEvents';
import { unwindAndCaptureAsync } from '@casual-simulation/aux-records/TestUtils';

registerInterpreterModule(DynamicImports);

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.warn = jest.fn();

describe('AuxRuntime', () => {
    const typeCases = [['interpreted'] as const, ['not-interpreted'] as const];

    describe.each(typeCases)('%s', (type) => {
        let memory: MemoryPartition;
        let runtime: AuxRuntime;
        let events: RuntimeActions[][];
        let allEvents: RuntimeActions[];
        let errors: ScriptError[][];
        let allErrors: ScriptError[];
        let version: AuxVersion;
        let auxDevice: AuxDevice;
        let interpreter: Interpreter;

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
                alpha: true,
                playerMode: 'builder',
            };
            auxDevice = {
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'bootstrap',
            };

            if (type === 'interpreted') {
                interpreter = new Interpreter();
            } else {
                interpreter = null;
            }

            runtime = new AuxRuntime(
                version,
                auxDevice,
                undefined,
                new DefaultRealtimeEditModeProvider(
                    new Map<BotSpace, RealtimeEditMode>([
                        ['shared', RealtimeEditMode.Immediate],
                        [<any>'delayed', RealtimeEditMode.Delayed],
                    ])
                ),
                undefined,
                undefined,
                interpreter
            );

            events = [];
            allEvents = [];
            errors = [];
            allErrors = [];

            runtime.onActions.subscribe((a) => {
                events.push(a);
                allEvents.push(...a);
            });
            runtime.onErrors.subscribe((e) => {
                errors.push(e);
                allErrors.push(...e);
            });
        });

        afterEach(() => {
            runtime.unsubscribe();
        });

        async function captureUpdates(fn: () => void) {
            let updates = [] as StateUpdatedEvent[];

            let subs = [
                memory.onStateUpdated
                    .pipe(skip(1))
                    .subscribe((update) =>
                        updates.push(runtime.stateUpdated(update))
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

        it('should share the global object with the context', () => {
            expect(runtime.globalObject).toBe(runtime.context.global);
        });

        describe('stateUpdated()', () => {
            describe('added bots', () => {
                it('should return a state update for the new bot', () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: 123,
                            }),
                        })
                    );

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
                        version: null,
                    });
                });

                it('should return a state update that ignores bots added in a previous update', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                num: 123,
                            }),
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test2: createPrecalculatedBot('test2', {
                                num: 123,
                            }),
                        },
                        addedBots: ['test2'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should overwrite bots with the same ID', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 123,
                            }),
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: createPrecalculatedBot('test', {
                                abc: 123,
                            }),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should preserve the variables that a bot has if it is overwritten', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    runtime.context.state['test'].vars.myVar = true;

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 123,
                            }),
                        })
                    );

                    expect(runtime.context.state['test'].vars.myVar).toBe(true);
                });

                it('should preserve the dynamic listeners that a bot has if it is overwritten', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    const test = runtime.currentState['test'];
                    const listener = jest.fn();
                    runtime.addDynamicListener(test, 'abc', listener);

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 123,
                            }),
                        })
                    );

                    const listeners = runtime.getDynamicListeners(
                        runtime.currentState['test'],
                        'abc'
                    );
                    expect(listeners).toBeTruthy();
                    expect(listeners!.length).toBe(1);
                    expect(listeners![0] === listener).toBe(true);
                });

                it('should include the space the bot was in', () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot(
                                'test',
                                {
                                    abc: 'def',
                                },
                                'history'
                            ),
                        })
                    );

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
                        version: null,
                    });
                });

                it('should not modify the given bot in scripts', async () => {
                    const bot = createBot('test1', {
                        update: `@tags.abc = "def"`,
                    });
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    runtime.shout('update');
                    await waitAsync();
                    expect(bot).toEqual(
                        createBot('test1', {
                            update: `@tags.abc = "def"`,
                        })
                    );
                });

                it('should overwrite the existing bot with the new bot', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'ghi',
                            }),
                        })
                    );

                    expect(update1).toEqual({
                        state: {
                            test1: createPrecalculatedBot('test1', {
                                abc: 'def',
                            }),
                        },
                        addedBots: ['test1'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
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
                        version: null,
                    });
                });

                it('should treat array values like strings', async () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                value: '[true, false, hello, 1.23, .35]',
                            }),
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot('test', {
                                value: '[true, false, hello, 1.23, .35]',
                            }),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it.skip('should not add the bot to the runtime twice', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),

                            test2: createBot('test2', {
                                value: '=getBots("abc","def").length',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );

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
                        version: null,
                    });

                    expect(update2).toEqual({
                        state: {
                            test1: createPrecalculatedBot('test1', {
                                abc: 'def',
                            }),
                            test2: {
                                values: {
                                    value: 1,
                                },
                            },
                        },
                        addedBots: ['test1'],
                        removedBots: [],
                        updatedBots: ['test2'],
                        version: null,
                    });
                });

                it('should convert script errors into copiable values', async () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: '@broken.',
                            }),
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    abc: expect.any(String),
                                },
                                {
                                    abc: '@broken.',
                                }
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                describe('string', () => {
                    it('should support the 📝 emoji to indicate a string', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '📝123.145',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        num: '123.145',
                                    },
                                    {
                                        num: '📝123.145',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    it('should treat values as a string by default', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: 'my string',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        num: 'my string',
                                    },
                                    {
                                        num: 'my string',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });
                });

                describe('numbers', () => {
                    it('should calculate number values', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '123.145',
                                }),
                            })
                        );

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
                            version: null,
                        });
                    });

                    it('should handle numbers that start with a dot', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '.145',
                                }),
                            })
                        );

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
                            version: null,
                        });
                    });

                    it('should support tagged numbers', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '🔢123.145',
                                    num2: '🔢abc',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        num: 123.145,
                                        num2: NaN,
                                    },
                                    {
                                        num: '🔢123.145',
                                        num2: '🔢abc',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    it('should support infinity', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: 'infinity',
                                    num2: '-infinity',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        num: Infinity,
                                        num2: -Infinity,
                                    },
                                    {
                                        num: 'infinity',
                                        num2: '-infinity',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });
                });

                describe('booleans', () => {
                    it('should calculate boolean values', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: 'true',
                                    value2: 'false',
                                }),
                            })
                        );

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
                            version: null,
                        });
                    });
                });

                describe('links', () => {
                    it('should pass link values through to the tags', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔗link1',
                                    value2: '🔗link2',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '🔗link1',
                                        value2: '🔗link2',
                                    },
                                    {
                                        value1: '🔗link1',
                                        value2: '🔗link2',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });
                });

                describe('dates', () => {
                    it('should preserve date values in the returned update', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '📅2012-05-16T12:13:14Z',
                                    value2: '📅2012',
                                    value3: '📅2012 America/New_York',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '📅2012-05-16T12:13:14Z',
                                        value2: '📅2012-01-01T00:00:00Z',
                                        value3: '📅2012-01-01T00:00:00-05:00 America/New_York',
                                    },
                                    {
                                        value1: '📅2012-05-16T12:13:14Z',
                                        value2: '📅2012',
                                        value3: '📅2012 America/New_York',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: DateTime.utc(2012, 5, 16, 12, 13, 14),
                            value2: DateTime.utc(2012),
                            value3: DateTime.fromObject(
                                { year: 2012 },
                                { zone: 'America/New_York' }
                            ),
                        });
                    });

                    it('should ignore dates that are invalid', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '📅abcdef',
                                    value2: '📅',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '📅abcdef',
                                        value2: '📅',
                                    },
                                    {
                                        value1: '📅abcdef',
                                        value2: '📅',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '📅abcdef',
                            value2: '📅',
                        });
                    });
                });

                describe('vectors', () => {
                    it('should preserve vector values in the returned update', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '➡️1,2',
                                    value2: '➡️1,2,3',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '➡️1,2',
                                        value2: '➡️1,2,3',
                                    },
                                    {
                                        value1: '➡️1,2',
                                        value2: '➡️1,2,3',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: new Vector2(1, 2),
                            value2: new Vector3(1, 2, 3),
                        });
                    });

                    it('should ignore vectors that are invalid', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '➡️wrong',
                                    value2: '➡️',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '➡️wrong',
                                        value2: '➡️',
                                    },
                                    {
                                        value1: '➡️wrong',
                                        value2: '➡️',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '➡️wrong',
                            value2: '➡️',
                        });
                    });
                });

                describe('rotations', () => {
                    it('should preserve rotation values in the returned update', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔁0,0,0,1',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '🔁0,0,0,1',
                                    },
                                    {
                                        value1: '🔁0,0,0,1',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: new Rotation(),
                        });
                    });

                    it('should ignore rotations that are invalid', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔁wrong',
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot(
                                    'test',
                                    {
                                        value1: '🔁wrong',
                                    },
                                    {
                                        value1: '🔁wrong',
                                    }
                                ),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '🔁wrong',
                        });
                    });
                });

                describe('system', () => {
                    it('should add the bot to the systemMap', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    system: 'module',
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    system: 'module2',
                                    num: 123,
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot('test', {
                                    system: 'module',
                                    abc: 'def',
                                }),
                                test2: createPrecalculatedBot('test2', {
                                    system: 'module2',
                                    num: 123,
                                }),
                            },
                            addedBots: ['test', 'test2'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['module', new Set(['test'])],
                                ['module2', new Set(['test2'])],
                            ])
                        );
                    });

                    it('should keep both bots in the map', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    system: 'module',
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    system: 'module',
                                    num: 123,
                                }),
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: createPrecalculatedBot('test', {
                                    system: 'module',
                                    abc: 'def',
                                }),
                                test2: createPrecalculatedBot('test2', {
                                    system: 'module',
                                    num: 123,
                                }),
                            },
                            addedBots: ['test', 'test2'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(
                            new Map([['module', new Set(['test', 'test2'])]])
                        );
                    });
                });

                describe('onBotAdded', () => {
                    it('should send a onBotAdded event to the bots that were added', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotAdded: `@os.toast("Added 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotAdded: `@os.toast("Added 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [toast('Added 1!'), toast('Added 2!')],
                        ]);
                    });

                    it('should send a onBotAdded event after the bots were added', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotAdded: `@os.toast(getBots('abc', 'ghi').length + 10)`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotAdded: `@os.toast(getBots('abc', 'def').length + 20)`,
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(11), toast(21)]]);
                    });

                    it('should not include an argument', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotAdded: `@os.toast(that)`,
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(undefined)]]);
                    });

                    it('should not be triggered from create()', async () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    create: `@create({
                                    onBotAdded: '@os.toast("hit")'
                                })`,
                                }),
                            })
                        );

                        runtime.shout('create');

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('uuid1', {
                                        creator: 'test1',
                                        onBotAdded: '@os.toast("hit")',
                                    })
                                ),
                            ],
                        ]);
                    });

                    it('should not reset the context energy', async () => {
                        runtime.context.energy = 3;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotAdded: `@os.toast("Added 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotAdded: `@os.toast("Added 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(2);
                    });

                    it('should not crash when running out of energy', async () => {
                        runtime.context.energy = 1;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotAdded: `@os.toast("Added 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotAdded: `@os.toast("Added 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(0);
                    });
                });

                describe('onAnyBotsAdded', () => {
                    it('should send a onAnyBotsAdded event with all the bots that were added', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsAdded: `@os.toast(that.bots.length)`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(3)]]);
                    });

                    it('should send a onAnyBotsAdded to all bots', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsAdded: `@os.toast(that.bots.length)`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(1), toast(2)]]);
                    });

                    it('should allow updating the bots', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsAdded: `@for(let b of that.bots) { b.tags.hit = true; }`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                botUpdated('test1', {
                                    tags: {
                                        hit: true,
                                    },
                                }),
                                botUpdated('test2', {
                                    tags: {
                                        hit: true,
                                    },
                                }),
                                botUpdated('test3', {
                                    tags: {
                                        hit: true,
                                    },
                                }),
                            ],
                        ]);
                    });

                    it('should not reset the context energy', async () => {
                        runtime.context.energy = 3;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsAdded: `@os.toast("Added 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onAnyBotsAdded: `@os.toast("Added 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(2);
                    });

                    it('should not crash when running out of energy', async () => {
                        runtime.context.energy = 1;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsAdded: `@os.toast("Added 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onAnyBotsAdded: `@os.toast("Added 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(0);
                    });
                });

                describe('masks', () => {
                    it('should add the masks to the precalculated bot', () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        shared: {
                                            abc: 123,
                                            def: 456,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 123,
                                        def: 456,
                                    },
                                    masks: {
                                        shared: {
                                            abc: 123,
                                            def: 456,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    it('should convert script errors into copiable values', async () => {
                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        shared: {
                                            abc: '@broken.',
                                        },
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: expect.any(String),
                                    },
                                    masks: {
                                        shared: {
                                            abc: '@broken.',
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });
                });

                it('should preserve tag changes on new bots that are replaced and occur after async resolutions', async () => {
                    uuidMock.mockReturnValueOnce('newBotId');
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                run: '@let newBot = create({ num: 0, creator: null }); await Promise.resolve(); newBot.tags.num += 1; await Promise.resolve(); os.toast(newBot.tags.num)',
                                num: 1,
                            }),
                        })
                    );

                    runtime.shout('run');

                    // Note: The microtask queue now looks like this:
                    // 1. check batch (the batch check was scheduled after the create() call)
                    // 2. resume script
                    // At this point, the bot has been created and a microtask has been
                    // created for the batch.

                    expect(events).toEqual([]);

                    await Promise.resolve();

                    // Note: The microtask queue has now checked the batch and also resumed the script.
                    // It now looks like this:
                    // 1. check batch (the batch was scheduled after the tag update)
                    // 2. resume script

                    // The batch has been processed so the created bot event has been emitted.
                    // We imediately act as if the bot processed and the state updated immediately
                    // At this point, there are pending changes to the newBotId bot, but they are unbatched (meaning that the bot ID is marked as having an update, but the actual updates aren't codified yet).
                    // By sending a new bot to the runtime, it is forced to replace the bot instance and therefore we can check whether the changes are preserved.
                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            newBotId: createBot('newBotId', {
                                num: 0,
                            }),
                        })
                    );

                    await Promise.resolve();

                    // Events show up one microtask after they are emitted
                    // Here we validate that the correct bot create event was sent
                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('newBotId', {
                                    num: 0,
                                })
                            ),
                        ],
                    ]);

                    await waitAsync();

                    if (type === 'interpreted') {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                toast(1),
                                botUpdated('newBotId', {
                                    tags: {
                                        num: 1,
                                    },
                                }),
                            ],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                botUpdated('newBotId', {
                                    tags: {
                                        num: 1,
                                    },
                                }),
                            ],
                            [toast(1)],
                        ]);
                    }
                });

                it('should preserve raw tag changes on new bots that are replaced and occur after async resolutions', async () => {
                    uuidMock.mockReturnValueOnce('newBotId');
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                run: '@let newBot = create({ num: 0, creator: null }); await Promise.resolve(); newBot.raw.num = 1; await Promise.resolve(); os.toast(newBot.raw.num)',
                                num: 1,
                            }),
                        })
                    );

                    runtime.shout('run');

                    // Note: The microtask queue now looks like this:
                    // 1. check batch (the batch check was scheduled after the create() call)
                    // 2. resume script
                    // At this point, the bot has been created and a microtask has been
                    // created for the batch.

                    expect(events).toEqual([]);

                    await Promise.resolve();

                    // Note: The microtask queue has now checked the batch and also resumed the script.
                    // It now looks like this:
                    // 1. check batch (the batch was scheduled after the tag update)
                    // 2. resume script

                    // The batch has been processed so the created bot event has been emitted.
                    // We imediately act as if the bot processed and the state updated immediately
                    // At this point, there are pending changes to the newBotId bot, but they are unbatched (meaning that the bot ID is marked as having an update, but the actual updates aren't codified yet).
                    // By sending a new bot to the runtime, it is forced to replace the bot instance and therefore we can check whether the changes are preserved.
                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            newBotId: createBot('newBotId', {
                                num: 0,
                            }),
                        })
                    );

                    await Promise.resolve();

                    // Events show up one microtask after they are emitted
                    // Here we validate that the correct bot create event was sent
                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('newBotId', {
                                    num: 0,
                                })
                            ),
                        ],
                    ]);

                    await waitAsync();

                    if (type === 'interpreted') {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                toast(1),
                                botUpdated('newBotId', {
                                    tags: {
                                        num: 1,
                                    },
                                }),
                            ],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                botUpdated('newBotId', {
                                    tags: {
                                        num: 1,
                                    },
                                }),
                            ],
                            [toast(1)],
                        ]);
                    }
                });

                it('should preserve tag mask changes on new bots that are replaced and occur after async resolutions', async () => {
                    uuidMock.mockReturnValueOnce('newBotId');
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                run: '@let newBot = create({ num: 0, creator: null }); await Promise.resolve(); newBot.masks.num = 1; await Promise.resolve(); os.toast(newBot.masks.num)',
                                num: 1,
                            }),
                        })
                    );

                    runtime.shout('run');

                    // Note: The microtask queue now looks like this:
                    // 1. check batch (the batch check was scheduled after the create() call)
                    // 2. resume script
                    // At this point, the bot has been created and a microtask has been
                    // created for the batch.

                    expect(events).toEqual([]);

                    await Promise.resolve();

                    // Note: The microtask queue has now checked the batch and also resumed the script.
                    // It now looks like this:
                    // 1. check batch (the batch was scheduled after the tag update)
                    // 2. resume script

                    // The batch has been processed so the created bot event has been emitted.
                    // We imediately act as if the bot processed and the state updated immediately
                    // At this point, there are pending changes to the newBotId bot, but they are unbatched (meaning that the bot ID is marked as having an update, but the actual updates aren't codified yet).
                    // By sending a new bot to the runtime, it is forced to replace the bot instance and therefore we can check whether the changes are preserved.
                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            newBotId: createBot('newBotId', {
                                num: 0,
                            }),
                        })
                    );

                    await Promise.resolve();

                    // Events show up one microtask after they are emitted
                    // Here we validate that the correct bot create event was sent
                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('newBotId', {
                                    num: 0,
                                })
                            ),
                        ],
                    ]);

                    await waitAsync();

                    if (type === 'interpreted') {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                toast(1),
                                botUpdated('newBotId', {
                                    masks: {
                                        tempLocal: {
                                            num: 1,
                                        },
                                    },
                                }),
                            ],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('newBotId', {
                                        num: 0,
                                    })
                                ),
                            ],
                            [
                                botUpdated('newBotId', {
                                    masks: {
                                        tempLocal: {
                                            num: 1,
                                        },
                                    },
                                }),
                            ],
                            [toast(1)],
                        ]);
                    }
                });

                it('should preserve tag masks on bots that are replaced', async () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                num: 999,
                            }),
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: {
                                id: 'test',
                                precalculated: true,
                                tags: {
                                    num: 999,
                                },
                                values: {
                                    num: 999,
                                },
                            },
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: {
                                tags: {},
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                        version: null,
                    });

                    const update3 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                num: 999,
                            }),
                        })
                    );

                    expect(update3).toEqual({
                        state: {
                            test: {
                                id: 'test',
                                precalculated: true,
                                tags: {
                                    num: 999,
                                },
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should properly compile preserved tag masks on replaced bots', async () => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                num: 999,
                            }),
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: {
                                id: 'test',
                                precalculated: true,
                                tags: {
                                    num: 999,
                                },
                                values: {
                                    num: 999,
                                },
                            },
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    tempLocal: {
                                        num: '123',
                                    },
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: {
                                tags: {},
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: '123',
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                        version: null,
                    });

                    const update3 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                num: 999,
                            }),
                        })
                    );

                    expect(update3).toEqual({
                        state: {
                            test: {
                                id: 'test',
                                precalculated: true,
                                tags: {
                                    num: 999,
                                },
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: '123',
                                    },
                                },
                            },
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should preserve tag mask changes that are reordered with respect to a script-created bot', async () => {
                    uuidMock.mockReturnValueOnce('newBotId');

                    const update0 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                run: '@let newBot = create({ num: 999, creator: null }); newBot.masks.num = 123;',
                                num: 1,
                            }),
                        })
                    );

                    runtime.shout('run');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded({
                                id: 'newBotId',
                                tags: {
                                    num: 999,
                                },
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            }),
                        ],
                    ]);

                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            newBotId: {
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            newBotId: {
                                tags: {},
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['newBotId'],
                        version: null,
                    });

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            newBotId: {
                                id: 'newBotId',
                                tags: {
                                    num: 999,
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            newBotId: {
                                id: 'newBotId',
                                precalculated: true,
                                tags: {
                                    num: 999,
                                },
                                values: {
                                    num: 123,
                                },
                                masks: {
                                    tempLocal: {
                                        num: 123,
                                    },
                                },
                            },
                        },
                        addedBots: ['newBotId'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                describe('timers', () => {
                    beforeAll(() => {
                        jest.useFakeTimers({});
                    });

                    afterEach(() => {
                        jest.clearAllTimers();
                    });

                    afterAll(() => {
                        jest.useRealTimers();
                    });

                    it('should not cancel timers when an existing bot is overridden', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: '@setInterval(() => os.toast("hi"), 100);',
                                }),
                            })
                        );

                        runtime.shout('abc');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 123,
                                }),
                            })
                        );

                        jest.runAllTicks();
                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(update2).toEqual({
                            state: {
                                test: createPrecalculatedBot('test', {
                                    abc: 123,
                                }),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        expect(events).toEqual([[toast('hi')], [toast('hi')]]);
                    });

                    it('should update references to the existing bot when a new bot overwrites the existing one', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    startTimer:
                                        '@setInterval(() => os.toast(tags.abc), 100);',
                                    abc: 'def',
                                }),
                            })
                        );

                        runtime.shout('startTimer');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.runAllTicks();
                        jest.advanceTimersByTime(100);

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'ghi',
                                }),
                            })
                        );

                        jest.runAllTicks();
                        jest.advanceTimersByTime(100);
                        jest.runAllTicks();

                        expect(update2).toEqual({
                            state: {
                                test: createPrecalculatedBot('test', {
                                    abc: 'ghi',
                                }),
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        expect(events).toEqual([
                            [toast('def')],
                            [toast('ghi')],
                        ]);
                    });
                });
            });

            describe('removed bots', () => {
                it('should return a state update for the removed bots', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: 123,
                            }),
                            test3: createBot('test3', {
                                value: true,
                            }),
                            test4: createBot('test4', {
                                tag1: 'test',
                                tag2: 'other',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: null,
                            test2: null,
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: null,
                            test2: null,
                        },
                        addedBots: [],
                        removedBots: ['test', 'test2'],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should support deletes for bots that dont exist', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: null,
                        })
                    );

                    expect(update1).toEqual({
                        state: {
                            test1: null,
                        },
                        addedBots: [],
                        removedBots: ['test1'],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should trigger all the watchers for the deleted bots', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'ghi',
                            }),
                            test3: createBot('test3', {
                                abc: '999',
                                test: `@
                                    watchBot('test1', () => { os.toast("Deleted 1!"); });
                                    watchBot('test2', () => { os.toast("Deleted 2!"); });
                                `,
                            }),
                        })
                    );

                    runtime.shout('test');

                    await waitAsync();

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: null,
                            test2: null,
                        })
                    );

                    await waitAsync();

                    expect(flatMap(errors)).toEqual([]);

                    if (type === 'interpreted') {
                        // watchBot() events are executed sequentially in separate promise.then() calls,
                        // so they end up in two different microtasks which mean two different batches
                        expect(events).toEqual([
                            [toast('Deleted 1!')],
                            [toast('Deleted 2!')],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [toast('Deleted 1!'), toast('Deleted 2!')],
                        ]);
                    }
                });

                it('should not crash when a watcher errors', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'ghi',
                            }),
                            test3: createBot('test3', {
                                abc: '999',
                                test: `@
                                    watchBot('test1', () => { throw new Error('abc'); });
                                    watchBot('test2', () => { os.toast("Deleted 2!"); });
                                `,
                            }),
                        })
                    );

                    runtime.shout('test');

                    await waitAsync();

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: null,
                            test2: null,
                        })
                    );

                    await waitAsync();

                    expect(flatMap(errors)).toEqual([new Error('abc')]);

                    if (type === 'interpreted') {
                        // watchBot() events are executed sequentially in separate promise.then() calls,
                        // so they end up in two different microtasks which mean two different batches
                        expect(events).toEqual([[], [toast('Deleted 2!')]]);
                    } else {
                        expect(events).toEqual([[toast('Deleted 2!')]]);
                    }
                });

                describe('onAnyBotsRemoved', () => {
                    it('should send a onAnyBotsRemoved event with the bot IDs that were removed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    onAnyBotsRemoved: `@os.toast(that.botIDs)`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: null,
                                test2: null,
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(['test1', 'test2'])]]);
                    });

                    it('should be sent after the bot is removed from the runtime', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onAnyBotsRemoved: `@os.toast(getBots('abc').length)`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    onAnyBotsRemoved: `@os.toast(getBots('abc').length + 10)`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: null,
                                test2: null,
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(11)]]);
                    });

                    it('should not be triggered from destroy()', async () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    destroy: `@destroy(this)`,
                                    onBotDestroyed: `@os.toast("Hit")`,
                                }),
                            })
                        );

                        runtime.shout('destroy');

                        await waitAsync();

                        expect(events).toEqual([[botRemoved('test1')]]);
                    });

                    it('should not reset the context energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    onAnyBotsRemoved: `@os.toast(that.botIDs)`,
                                }),
                            })
                        );

                        runtime.context.energy = 2;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: null,
                                test2: null,
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(1);
                    });

                    it('should not crash when running out of energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    onAnyBotsRemoved: `@os.toast(that.botIDs)`,
                                }),
                            })
                        );

                        runtime.context.energy = 1;
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: null,
                                test2: null,
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(0);
                    });
                });

                describe('system', () => {
                    it('should remove the bot from the systemMap', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                    system: 'module',
                                }),
                                test2: createBot('test2', {
                                    num: 123,
                                    system: 'module',
                                }),
                                test3: createBot('test3', {
                                    value: true,
                                    system: 'module2',
                                }),
                                test4: createBot('test4', {
                                    tag1: 'test',
                                    tag2: 'other',
                                    system: 'module3',
                                }),
                            })
                        );

                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['module', new Set(['test', 'test2'])],
                                ['module2', new Set(['test3'])],
                                ['module3', new Set(['test4'])],
                            ])
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: null,
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: null,
                            },
                            addedBots: [],
                            removedBots: ['test'],
                            updatedBots: [],
                            version: null,
                        });
                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['module', new Set(['test2'])],
                                ['module2', new Set(['test3'])],
                                ['module3', new Set(['test4'])],
                            ])
                        );
                    });
                });
            });

            describe('updated bots', () => {
                it('should return a state update for the updated bot', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: 123,
                            }),
                            test3: createBot('test3', {
                                value: true,
                            }),
                            test4: createBot('test4', {
                                tag1: 'test',
                                tag2: 'other',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                tags: {
                                    other: true,
                                },
                            },
                            test2: {
                                tags: {
                                    num: 456,
                                },
                            },
                        })
                    );

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
                        version: null,
                    });
                });

                it('should re-compile changed dna tags', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                num: `${DNA_TAG_PREFIX}123`,
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: {
                                tags: {
                                    num: `${DNA_TAG_PREFIX}456`,
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test2: {
                                tags: {
                                    num: `${DNA_TAG_PREFIX}456`,
                                },
                                values: {
                                    num: 456,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test2'],
                        version: null,
                    });
                });

                it('should ignore updates for bots that dont exist', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: {
                                tags: {
                                    num: '456',
                                },
                            },
                        })
                    );

                    expect(update1).toEqual({
                        state: {},
                        addedBots: [],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                });

                it('should update raw tags', async () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                                script: '@create(bot)',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                tags: {
                                    other: true,
                                },
                            },
                        })
                    );

                    uuidMock.mockReturnValueOnce('test2');
                    const result = await runtime.shout('script');

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

                it('should handle removing tags', () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                id: 'test',
                                space: 'shared',
                                tags: {
                                    abc: 123,
                                },
                            },
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                tags: {
                                    abc: null,
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: {
                                tags: {
                                    abc: null,
                                },
                                values: {
                                    abc: null,
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                        version: null,
                    });
                });

                it('should treat array values like strings', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {}),
                        })
                    );

                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                tags: {
                                    value: '[true, false, hello, 1.23, .35]',
                                },
                            },
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: {
                                tags: {
                                    value: '[true, false, hello, 1.23, .35]',
                                },
                                values: {
                                    value: '[true, false, hello, 1.23, .35]',
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                        version: null,
                    });
                });

                it('should convert script errors into copiable values', async () => {
                    const update1 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    const update2 = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                tags: {
                                    abc: '@broken.',
                                },
                            },
                        })
                    );

                    expect(update2).toEqual({
                        state: {
                            test: {
                                tags: {
                                    abc: '@broken.',
                                },
                                values: {
                                    abc: expect.any(String),
                                },
                            },
                        },
                        addedBots: [],
                        removedBots: [],
                        updatedBots: ['test'],
                        version: null,
                    });
                });

                it('should trigger all the watchers for the changed bots', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'ghi',
                            }),
                            test3: createBot('test3', {
                                abc: '999',
                                test: `@
                                    watchBot('test1', () => { os.toast("Changed 1!"); });
                                    watchBot('test2', () => { os.toast("Changed 2!"); });
                                `,
                            }),
                        })
                    );

                    runtime.shout('test');

                    await waitAsync();

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: {
                                tags: {
                                    abc: 'def1',
                                },
                            },
                            test2: {
                                tags: {
                                    abc: 'ghi1',
                                },
                            },
                        })
                    );

                    await waitAsync();

                    expect(flatMap(errors)).toEqual([]);

                    if (type === 'interpreted') {
                        // watchBot() events are executed sequentially in separate promise.then() calls,
                        // so they end up in two different microtasks which mean two different batches
                        expect(events).toEqual([
                            [toast('Changed 1!')],
                            [toast('Changed 2!')],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [toast('Changed 1!'), toast('Changed 2!')],
                        ]);
                    }
                });

                it('should not crash when a watcher errors', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'ghi',
                            }),
                            test3: createBot('test3', {
                                abc: '999',
                                test: `@
                                    watchBot('test1', () => { throw new Error('abc'); });
                                    watchBot('test2', () => { os.toast("Changed 2!"); });
                                `,
                            }),
                        })
                    );

                    runtime.shout('test');

                    await waitAsync();

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: {
                                tags: {
                                    abc: 'def1',
                                },
                            },
                            test2: {
                                tags: {
                                    abc: 'ghi1',
                                },
                            },
                        })
                    );

                    await waitAsync();

                    expect(flatMap(errors)).toEqual([new Error('abc')]);

                    if (type === 'interpreted') {
                        // watchBot() events are executed sequentially in separate promise.then() calls,
                        // so they end up in two different microtasks which mean two different batches
                        expect(events).toEqual([[], [toast('Changed 2!')]]);
                    } else {
                        expect(events).toEqual([[toast('Changed 2!')]]);
                    }
                });

                describe('watchPortal()', () => {
                    it('should call the handler when a new bot is added to the portal', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                    home: true,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test2: createBot('test2', {
                                    home: true,
                                }),
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when a bot that is in the portal is removed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                    home: true,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: null,
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when an existing bot is added to the portal', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        home: true,
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when an existing bot is removed from the portal', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                    home: true,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        home: null,
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when the portal tag on the user bot changes', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: {
                                    tags: {
                                        testPortal: 'abc',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when the bot for the given portal changes', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        runtime.process([
                            registerCustomApp('testPortal', 'test1'),
                        ]);

                        await waitAsync();

                        expect(events.slice(1)).toEqual([]);

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        something: 'def',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events.slice(1)).toEqual([
                            [toast('Changed 1!')],
                        ]);
                    });

                    it('should call the handler when the portal tag on the user bot is added', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {}),
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: {
                                    tags: {
                                        testPortal: 'abc',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should call the handler when the portal tag on the user bot is removed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test1: createBot('test1', {
                                    abc: 'def',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: {
                                    tags: {
                                        testPortal: null,
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([[toast('Changed 1!')]]);
                    });

                    it('should not crash when a nonexistant bot is removed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                user1: createBot('user1', {
                                    testPortal: 'home',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                    test: `@
                                        watchPortal('testPortal', () => { os.toast("Changed 1!"); });
                                    `,
                                }),
                            })
                        );
                        runtime.userId = 'user1';

                        runtime.shout('test');

                        await waitAsync();

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                missing: null,
                            })
                        );

                        await waitAsync();

                        expect(flatMap(errors)).toEqual([]);

                        expect(events).toEqual([]);
                    });
                });

                describe('numbers', () => {
                    it('should calculate number values', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '123.145',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        num: '145.123',
                                    },
                                },
                            })
                        );

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
                            version: null,
                        });
                    });

                    it('should handle numbers that start with a dot', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    num: '145',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        num: '.145',
                                    },
                                },
                            })
                        );

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
                            version: null,
                        });
                    });
                });

                describe('booleans', () => {
                    it('should calculate boolean values', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: 'true',
                                    value2: 'false',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: 'false',
                                        value2: 'true',
                                    },
                                },
                            })
                        );

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
                            version: null,
                        });
                    });
                });

                describe('links', () => {
                    it('should pass link values through to the tags', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔗link1',
                                    value2: '🔗link2',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '🔗link2',
                                        value2: '🔗link1',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '🔗link2',
                                        value2: '🔗link1',
                                    },
                                    values: {
                                        value1: '🔗link2',
                                        value2: '🔗link1',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });
                });

                describe('dates', () => {
                    it('should preserve date values in the returned update', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '📅2012-05-16T12:13:14Z',
                                    value2: '📅2012',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '📅2012',
                                        value2: '📅2012-05-16T12:13:14Z',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '📅2012',
                                        value2: '📅2012-05-16T12:13:14Z',
                                    },
                                    values: {
                                        value1: '📅2012-01-01T00:00:00Z',
                                        value2: '📅2012-05-16T12:13:14Z',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: DateTime.utc(2012),
                            value2: DateTime.utc(2012, 5, 16, 12, 13, 14),
                        });
                    });

                    it('should ignore dates that are invalid', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '📅2012',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '📅abc',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '📅abc',
                                    },
                                    values: {
                                        value1: '📅abc',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '📅abc',
                        });
                    });
                });

                describe('vectors', () => {
                    it('should preserve vector values in the returned update', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '➡️1,2',
                                    value2: '➡️1,2,3',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '➡️1,2',
                                        value2: '➡️1,2,3',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '➡️1,2',
                                        value2: '➡️1,2,3',
                                    },
                                    values: {
                                        value1: '➡️1,2',
                                        value2: '➡️1,2,3',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: new Vector2(1, 2),
                            value2: new Vector3(1, 2, 3),
                        });
                    });

                    it('should ignore vectors that are invalid', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '➡️1,2',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '➡️abc',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '➡️abc',
                                    },
                                    values: {
                                        value1: '➡️abc',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '➡️abc',
                        });
                    });
                });

                describe('rotations', () => {
                    it('should preserve rotation values in the returned update', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔁0,0,0,1',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '🔁0,0,0,1',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '🔁0,0,0,1',
                                    },
                                    values: {
                                        value1: '🔁0,0,0,1',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: new Rotation(),
                        });
                    });

                    it('should ignore rotations that are invalid', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    value1: '🔁0,0,0,1',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        value1: '🔁wrong',
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        value1: '🔁wrong',
                                    },
                                    values: {
                                        value1: '🔁wrong',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                        expect(runtime.currentState['test'].values).toEqual({
                            value1: '🔁wrong',
                        });
                    });
                });

                describe('system', () => {
                    it('should add added systems to the system map', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                }),
                                test2: createBot('test2', {
                                    num: 123,
                                }),
                                test3: createBot('test3', {
                                    value: true,
                                }),
                                test4: createBot('test4', {
                                    tag1: 'test',
                                    tag2: 'other',
                                }),
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        system: 'module',
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: 'module2',
                                        num: 456,
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        system: 'module',
                                        other: true,
                                    },
                                    values: {
                                        system: 'module',
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: 'module2',
                                        num: 456,
                                    },
                                    values: {
                                        system: 'module2',
                                        num: 456,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test', 'test2'],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['module', new Set(['test'])],
                                ['module2', new Set(['test2'])],
                            ])
                        );
                    });

                    it('should update updated systems in the system map', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                    system: 'module',
                                }),
                                test2: createBot('test2', {
                                    num: 123,
                                    system: 'module2',
                                }),
                                test3: createBot('test3', {
                                    value: true,
                                }),
                                test4: createBot('test4', {
                                    tag1: 'test',
                                    tag2: 'other',
                                }),
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        system: 'different',
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: 'different2',
                                        num: 456,
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        system: 'different',
                                        other: true,
                                    },
                                    values: {
                                        system: 'different',
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: 'different2',
                                        num: 456,
                                    },
                                    values: {
                                        system: 'different2',
                                        num: 456,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test', 'test2'],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['different', new Set(['test'])],
                                ['different2', new Set(['test2'])],
                            ])
                        );
                    });

                    it('should with with tag edits', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                    system: 'module',
                                }),
                                test2: createBot('test2', {
                                    num: 123,
                                    system: 'module2',
                                }),
                                test3: createBot('test3', {
                                    value: true,
                                }),
                                test4: createBot('test4', {
                                    tag1: 'test',
                                    tag2: 'other',
                                }),
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        system: edit(
                                            {},
                                            preserve(1),
                                            insert('a')
                                        ),
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: edit(
                                            {},
                                            preserve(1),
                                            insert('a')
                                        ),
                                        num: 456,
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        system: edit(
                                            {},
                                            preserve(1),
                                            insert('a')
                                        ),
                                        other: true,
                                    },
                                    values: {
                                        system: 'maodule',
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: edit(
                                            {},
                                            preserve(1),
                                            insert('a')
                                        ),
                                        num: 456,
                                    },
                                    values: {
                                        system: 'maodule2',
                                        num: 456,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test', 'test2'],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(
                            new Map([
                                ['maodule', new Set(['test'])],
                                ['maodule2', new Set(['test2'])],
                            ])
                        );
                    });

                    it('should delete deleted systems from the system map', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                    system: 'module',
                                }),
                                test2: createBot('test2', {
                                    num: 123,
                                    system: 'module2',
                                }),
                                test3: createBot('test3', {
                                    value: true,
                                }),
                                test4: createBot('test4', {
                                    tag1: 'test',
                                    tag2: 'other',
                                }),
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        system: null,
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: null,
                                        num: 456,
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        system: null,
                                        other: true,
                                    },
                                    values: {
                                        system: null,
                                        other: true,
                                    },
                                },
                                test2: {
                                    tags: {
                                        system: null,
                                        num: 456,
                                    },
                                    values: {
                                        system: null,
                                        num: 456,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test', 'test2'],
                            version: null,
                        });

                        expect(runtime.systemMap).toEqual(new Map([]));
                    });
                });

                describe('onBotChanged', () => {
                    it('should send a onBotChanged event to the bots that were changed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotChanged: `@os.toast("Changed 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotChanged: `@os.toast("Changed 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        abc: 'ghi1',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [toast('Changed 1!'), toast('Changed 2!')],
                        ]);
                    });

                    it('should be sent after the bot has been updated', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotChanged: `@os.toast(getBots('zzz').length)`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        zzz: 'aaa',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([[toast(1)]]);
                    });

                    it('should send the tags that were updated', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotChanged: `@os.toast(that)`,
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                        zzz: 'aaa',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                toast({
                                    tags: ['abc', 'zzz'],
                                }),
                            ],
                        ]);
                    });

                    it('should not reset the context energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotChanged: `@os.toast("Changed 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotChanged: `@os.toast("Changed 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.context.energy = 3;

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        abc: 'ghi1',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        // One separate shout per individual bot listener
                        expect(runtime.context.energy).toBe(1);
                    });

                    it('should not crash when running out of energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onBotChanged: `@os.toast("Changed 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onBotChanged: `@os.toast("Changed 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.context.energy = 1;

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        abc: 'ghi1',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        // One separate shout per individual bot listener
                        expect(runtime.context.energy).toBe(0);
                    });
                });

                describe('onAnyBotsChanged', () => {
                    it('should send a onAnyBotsChanged event with the bots that were changed', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsChanged: `@os.toast(that)`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test3: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        '123': '456',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                toast([
                                    {
                                        bot: expect.any(Object),
                                        tags: ['abc'],
                                    },
                                    {
                                        bot: expect.any(Object),
                                        tags: ['123'],
                                    },
                                ]),
                            ],
                        ]);
                    });

                    it('should be able to update bots that were updated', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsChanged: `@that[0].bot.tags.abc = true;`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test3: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        '123': '456',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                botUpdated('test3', {
                                    tags: {
                                        abc: true,
                                    },
                                }),
                            ],
                        ]);
                    });

                    it('should not reset the context energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsChanged: `@os.toast("Changed 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onAnyBotsChanged: `@os.toast("Changed 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.context.energy = 2;

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        abc: 'ghi1',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        // One shout for all listeners
                        expect(runtime.context.energy).toBe(1);
                    });

                    it('should not crash when running out of energy', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    abc: 'def',
                                    onAnyBotsChanged: `@os.toast("Changed 1!")`,
                                }),
                                test2: createBot('test2', {
                                    abc: 'ghi',
                                    onAnyBotsChanged: `@os.toast("Changed 2!")`,
                                }),
                                test3: createBot('test3', {
                                    abc: '999',
                                }),
                            })
                        );

                        runtime.context.energy = 1;

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: {
                                    tags: {
                                        abc: 'def1',
                                    },
                                },
                                test2: {
                                    tags: {
                                        abc: 'ghi1',
                                    },
                                },
                            })
                        );

                        await waitAsync();

                        expect(runtime.context.energy).toBe(0);
                    });
                });

                describe('edits', () => {
                    it('should support edits on a tag', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        abc: edit(
                                            {},
                                            preserve(1),
                                            insert('1'),
                                            del(1)
                                        ),
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        abc: edit(
                                            {},
                                            preserve(1),
                                            insert('1'),
                                            del(1)
                                        ),
                                    },
                                    values: {
                                        abc: 'd1f',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should support edits on a formula', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: `${DNA_TAG_PREFIX}"abc"`,
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        abc: edit(
                                            {},
                                            preserve(4 + DNA_TAG_PREFIX.length),
                                            insert('def')
                                        ),
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        abc: edit(
                                            {},
                                            preserve(4 + DNA_TAG_PREFIX.length),
                                            insert('def')
                                        ),
                                    },
                                    values: {
                                        abc: 'abcdef',
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should delete the tag when an edit removes all text', () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                }),
                            })
                        );

                        const update = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        abc: edit({}, preserve(0), del(3)),
                                    },
                                },
                            })
                        );

                        expect(update).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        abc: edit({}, preserve(0), del(3)),
                                    },
                                    values: {
                                        abc: null,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });
                });

                describe('masks', () => {
                    it('should handle adding masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        def: 123,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should use the mask value for the tag value', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        tempLocal: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: 123,
                                    },
                                    masks: {
                                        tempLocal: {
                                            abc: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should prefer tempLocal tag masks over local ones for values', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        local: {
                                            abc: 456,
                                        },
                                        tempLocal: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: 123,
                                    },
                                    masks: {
                                        tempLocal: {
                                            abc: 123,
                                        },
                                        local: {
                                            abc: 456,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should be able to calculate formulas in tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        tempLocal: {
                                            abc: `${DNA_TAG_PREFIX}"abc"`,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: 'abc',
                                    },
                                    masks: {
                                        tempLocal: {
                                            abc: `${DNA_TAG_PREFIX}"abc"`,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should handle removing tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {},
                                    masks: {
                                        shared: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: null,
                                    },
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should handle removing multiple tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {},
                                    masks: {
                                        shared: {
                                            abc: 123,
                                        },
                                        tempLocal: {
                                            abc: 'def',
                                        },
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                        tempLocal: {
                                            abc: null,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: null,
                                    },
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                        tempLocal: {
                                            abc: null,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should be able to update normal tags that are hidden by masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        tempLocal: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    tags: {
                                        abc: 'ghi',
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {
                                        abc: 'ghi',
                                    },
                                    values: {
                                        abc: 123,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should be able to update tag masks without affecting the tag', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        tempLocal: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        tempLocal: {
                                            abc: 12,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    masks: {
                                        tempLocal: {
                                            abc: 12,
                                        },
                                    },
                                    values: {
                                        abc: 12,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should fall back to the tag value when a tag mask is deleted', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        shared: {
                                            abc: 123,
                                        },
                                    },
                                },
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    values: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        shared: {
                                            abc: null,
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });

                    it('should buffer tag masks that are added before the corresponding bot is added', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 123,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    it('should not mutate the original bot object when adding buffered tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        let originalBot: Bot = {
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                        };

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: originalBot,
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 123,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(originalBot).toEqual({
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                        });
                    });

                    it('should not mutate the original bot tag masks object when adding buffered tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        let originalBot: Bot = {
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                            masks: {},
                        };

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: originalBot,
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 123,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(originalBot).toEqual({
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                            masks: {},
                        });
                    });

                    it('should not mutate the original bot tag masks space object when adding buffered tag masks', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        let originalBot: Bot = {
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                            masks: {
                                shared: {},
                            },
                        };

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: originalBot,
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 123,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                        expect(originalBot).toEqual({
                            id: 'test',
                            space: 'shared',
                            tags: {
                                abc: 'def',
                            },
                            masks: {
                                shared: {},
                            },
                        });
                    });

                    it('should not allow buffered tag masks to overwrite tag masks that are specified when the bot is added', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        shared: {
                                            def: 987,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 987,
                                    },
                                    masks: {
                                        shared: {
                                            def: 987,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    it('should merge buffered tag masks with tag masks that are specified when the bot is added', () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update1).toEqual({
                            state: {},
                            addedBots: [],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    id: 'test',
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    masks: {
                                        tempLocal: {
                                            custom: true,
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    id: 'test',
                                    precalculated: true,
                                    space: 'shared',
                                    tags: {
                                        abc: 'def',
                                    },
                                    values: {
                                        abc: 'def',
                                        def: 123,
                                        custom: true,
                                    },
                                    masks: {
                                        shared: {
                                            def: 123,
                                        },
                                        tempLocal: {
                                            custom: true,
                                        },
                                    },
                                },
                            },
                            addedBots: ['test'],
                            removedBots: [],
                            updatedBots: [],
                            version: null,
                        });
                    });

                    describe('edits', () => {
                        it('should support edits on a tag mask', () => {
                            runtime.stateUpdated(
                                stateUpdatedEvent({
                                    test: {
                                        id: 'test',
                                        space: 'shared',
                                        tags: {},
                                        masks: {
                                            tempLocal: {
                                                abc: 'def',
                                            },
                                        },
                                    },
                                })
                            );

                            const update = runtime.stateUpdated(
                                stateUpdatedEvent({
                                    test: {
                                        masks: {
                                            tempLocal: {
                                                abc: edit(
                                                    {},
                                                    preserve(1),
                                                    insert('1'),
                                                    del(1)
                                                ),
                                            },
                                        },
                                    },
                                })
                            );

                            expect(update).toEqual({
                                state: {
                                    test: {
                                        tags: {},
                                        masks: {
                                            tempLocal: {
                                                abc: edit(
                                                    {},
                                                    preserve(1),
                                                    insert('1'),
                                                    del(1)
                                                ),
                                            },
                                        },
                                        values: {
                                            abc: 'd1f',
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test'],
                                version: null,
                            });
                        });

                        it('should support edits on a formula', () => {
                            runtime.stateUpdated(
                                stateUpdatedEvent({
                                    test: {
                                        id: 'test',
                                        space: 'shared',
                                        tags: {},
                                        masks: {
                                            tempLocal: {
                                                abc: `${DNA_TAG_PREFIX}"abc"`,
                                            },
                                        },
                                    },
                                })
                            );

                            const update = runtime.stateUpdated(
                                stateUpdatedEvent({
                                    test: {
                                        masks: {
                                            tempLocal: {
                                                abc: edit(
                                                    {},
                                                    preserve(
                                                        4 +
                                                            DNA_TAG_PREFIX.length
                                                    ),
                                                    insert('def')
                                                ),
                                            },
                                        },
                                    },
                                })
                            );

                            expect(update).toEqual({
                                state: {
                                    test: {
                                        tags: {},
                                        masks: {
                                            tempLocal: {
                                                abc: edit(
                                                    {},
                                                    preserve(
                                                        4 +
                                                            DNA_TAG_PREFIX.length
                                                    ),
                                                    insert('def')
                                                ),
                                            },
                                        },
                                        values: {
                                            abc: 'abcdef',
                                        },
                                    },
                                },
                                addedBots: [],
                                removedBots: [],
                                updatedBots: ['test'],
                                version: null,
                            });
                        });
                    });

                    it('should convert script errors into copiable values', async () => {
                        const update1 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: createBot('test', {
                                    abc: 'def',
                                }),
                            })
                        );

                        const update2 = runtime.stateUpdated(
                            stateUpdatedEvent({
                                test: {
                                    masks: {
                                        tempLocal: {
                                            abc: '@broken.',
                                        },
                                    },
                                },
                            })
                        );

                        expect(update2).toEqual({
                            state: {
                                test: {
                                    tags: {},
                                    masks: {
                                        tempLocal: {
                                            abc: '@broken.',
                                        },
                                    },
                                    values: {
                                        abc: expect.any(String),
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test'],
                            version: null,
                        });
                    });
                });
            });
        });

        describe('process()', () => {
            it('should execute shouts', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast("hi1")',
                        }),
                        test2: createBot('test2', {
                            hello: '@os.toast("hi2")',
                        }),
                        test3: createBot('test3', {}),
                    })
                );
                runtime.process([action('hello')]);

                await waitAsync();

                expect(events).toEqual([[toast('hi1'), toast('hi2')]]);
            });

            it('should flatten shout events into the given batch', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast("hi1")',
                        }),
                        test2: createBot('test2', {
                            hello: '@os.toast("hi2")',
                        }),
                        test3: createBot('test3', {}),
                    })
                );
                runtime.process([toast('hi0'), action('hello'), toast('hi3')]);

                await waitAsync();

                expect(events).toEqual([
                    [toast('hi0'), toast('hi1'), toast('hi2'), toast('hi3')],
                ]);
            });

            it('should flatten run script events into the given batch', async () => {
                runtime.process([
                    toast('hi0'),
                    runScript('os.toast("hi1")'),
                    toast('hi2'),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [toast('hi0'), toast('hi1'), toast('hi2')],
                ]);
            });

            it('should send onAnyAction() shouts for each event', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: '@os.toast(that.action.message)',
                        }),
                    })
                );
                runtime.process([
                    toast('hi0'),
                    runScript('os.toast("hi1")'),
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

            it('should not map objects that are set to be UNMAPPABLE', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: '@action.perform(that.action)',
                        }),
                    })
                );
                const myAction = {
                    type: 'custom_action',
                    [UNMAPPABLE]: true,
                } as any;
                runtime.process([myAction]);

                await waitAsync();

                expect(events.length).toEqual(1);
                expect(events[0].length).toEqual(2);

                expect(events[0][0]).toBe(myAction);
                expect(events[0][1]).toBe(myAction);
            });

            it('should resolve rejected events', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: '@action.reject(that.action)',
                        }),
                    })
                );
                runtime.process([
                    toast('hi0'),
                    runScript('os.toast("hi1")'),
                    toast('hi2'),
                ]);

                await waitAsync();

                expect(events).toEqual([]);
            });

            it('should call onAnyAction() once per action in a batch', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: '@tags.count += 1',
                            wow: '@os.toast("hi")',
                            count: 0,
                        }),
                    })
                );
                runtime.process([
                    toast('hi0'),
                    action('wow'),
                    runScript('os.toast("hi1")'),
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
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: `@if(that.action.type === "action") action.reject(that.action);`,
                            test: '@os.toast("hi")',
                        }),
                    })
                );
                runtime.process([action('test')]);

                await waitAsync();

                expect(events).toEqual([]);
            });

            it('should be able to filter runScript actions before they are executed', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: `@if(that.action.type === "run_script") action.reject(that.action);`,
                        }),
                    })
                );
                runtime.process([runScript('os.toast("hi")')]);

                await waitAsync();

                expect(events).toEqual([]);
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

            it('should support dispatching a new shout from inside onAnyAction()', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: `@if(that.action.type === "device") action.perform(that.action.event);`,
                            test: '@tags.hit = true',
                        }),
                    })
                );
                runtime.process([device(<any>{}, action('test'))]);

                await waitAsync();

                expect(events).toEqual([
                    [
                        // onAnyAction is executed before
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

            it('should support dispatching a new script from inside onAnyAction()', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: `@if(that.action.type === "device") action.perform(that.action.event);`,
                        }),
                    })
                );
                runtime.process([device(<any>{}, runScript('os.toast("hi")'))]);

                await waitAsync();

                expect(events).toEqual([
                    [
                        // onAnyAction is executed before
                        // the device action is executed
                        toast('hi'),
                        device(<any>{}, runScript('os.toast("hi")')),
                    ],
                ]);
            });

            it('should support resolving async actions', async () => {
                runtime.process([
                    runScript(
                        'os.showInput().then(result => os.toast(result))'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [showInput(undefined, undefined, expect.any(Number))],
                ]);

                const taskId = (<any>events[0][0]).taskId as number;

                runtime.process([asyncResult(taskId, 'abc')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([[toast('abc')]]);
            });

            it('should emit async result actions that are not handled by the context', async () => {
                runtime.process([asyncResult(99, null)]);

                await waitAsync();

                expect(events).toEqual([[asyncResult(99, null)]]);
            });

            it('should emit async error actions that are not handled by the context', async () => {
                runtime.process([asyncError(99, 'error')]);

                await waitAsync();

                expect(events).toEqual([[asyncError(99, 'error')]]);
            });

            it('should support mapping bots in async actions results', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            abc: 'def',
                        }),
                    })
                );

                runtime.process([
                    runScript(
                        'os.showInput().then(result => os.toast(result.tags.abc))'
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

                expect(events.slice(1)).toEqual([[toast('def')]]);
            });

            it('should support rejecting async actions', async () => {
                runtime.process([
                    runScript(
                        'os.showInput().catch(result => os.toast(result))'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [showInput(undefined, undefined, expect.any(Number))],
                ]);

                const taskId = (<any>events[0][0]).taskId as number;

                runtime.process([asyncError(taskId, 'abc')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([[toast('abc')]]);
            });

            it('should support resolving device async actions', async () => {
                uuidMock.mockReturnValueOnce('task1');
                runtime.process([
                    runScript(
                        'os.remoteCount("test").then(result => os.toast(result))'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [
                        remote(
                            getRemoteCount(null, 'test', DEFAULT_BRANCH_NAME),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ],
                ]);

                runtime.process([deviceResult(null, 123, 'task1')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([[toast(123)]]);
            });

            it('should support rejecting device async actions', async () => {
                uuidMock.mockReturnValueOnce('task1');
                runtime.process([
                    runScript(
                        'os.remoteCount("test").catch(err => os.toast(err))'
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [
                        remote(
                            getRemoteCount(null, 'test', DEFAULT_BRANCH_NAME),
                            undefined,
                            undefined,
                            'task1'
                        ),
                    ],
                ]);

                runtime.process([deviceError(null, 'bad', 'task1')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([[toast('bad')]]);
            });

            it('should emit device result actions that are not handled by the context', async () => {
                runtime.process([deviceResult(null, 123, 'task2')]);

                await waitAsync();

                expect(events).toEqual([[deviceResult(null, 123, 'task2')]]);
            });

            it('should emit device error actions that are not handled by the context', async () => {
                runtime.process([deviceError(null, 'error', 'task2')]);

                await waitAsync();

                expect(events).toEqual([[deviceError(null, 'error', 'task2')]]);
            });

            it('should support using await for async actions', async () => {
                runtime.process([
                    runScript(
                        `const result = await os.showInput();
                        os.toast(result);`
                    ),
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [showInput(undefined, undefined, expect.any(Number))],
                ]);

                const taskId = (<any>events[0][0]).taskId as number;

                runtime.process([asyncResult(taskId, 'abc')]);

                await waitAsync();

                expect(events.slice(1)).toEqual([[toast('abc')]]);
            });

            it('should support resolving async iterators', async () => {
                const task = runtime.context.createIterable();

                runtime.process([asyncResult(task.taskId, 'abc')]);

                await waitAsync();
                const result = await task.promise;
                expect(result.result).toEqual('abc');
                expect(Symbol.asyncIterator in result.iterable).toBe(true);
            });

            it('should support providing next values to iterators', async () => {
                const task = runtime.context.createIterable();

                runtime.process([
                    asyncResult(task.taskId, 'abc'),
                    iterableNext(task.taskId, 'def'),
                    iterableNext(task.taskId, 'ghi'),
                    iterableComplete(task.taskId),
                ]);

                await waitAsync();
                const result = await task.promise;
                expect(result.result).toEqual('abc');
                expect(Symbol.asyncIterator in result.iterable).toBe(true);

                const results = await unwindAndCaptureAsync(
                    result.iterable[Symbol.asyncIterator]()
                );

                expect(results).toEqual({
                    states: ['def', 'ghi'],
                });
            });

            it('should support throwing values in iterators', async () => {
                const task = runtime.context.createIterable();

                runtime.process([
                    asyncResult(task.taskId, 'abc'),
                    iterableNext(task.taskId, 'def'),
                    iterableNext(task.taskId, 'ghi'),
                    iterableThrow(task.taskId, 'error'),
                ]);

                await waitAsync();
                const result = await task.promise;
                expect(result.result).toEqual('abc');
                expect(Symbol.asyncIterator in result.iterable).toBe(true);

                let states: any[] = [];
                await expect(async () => {
                    for await (const state of result.iterable) {
                        states.push(state);
                    }
                }).rejects.toEqual('error');

                expect(states).toEqual(['def', 'ghi']);
            });

            it('should not crash if given a run_script that doesnt compile', async () => {
                runtime.process([runScript('os.toast('), toast('abc')]);

                await waitAsync();

                expect(events).toEqual([[toast('abc')]]);
            });

            it('should resolve run_script tasks', async () => {
                const result = await runtime.execute(
                    'return await os.run("return 123");'
                );

                runtime.process(result.actions);

                expect(await result.result).toBe(123);
            });

            it('should unwrap async run_script tasks', async () => {
                const result = await runtime.execute(
                    'return await os.run("return Promise.resolve(123);");'
                );

                runtime.process(result.actions);

                expect(await result.result).toBe(123);
            });

            it('should emit onAnyAction() calls for bot updates that are enqueued for a batch when process() is called', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            onAnyAction: '@tags.count += 1',
                            count: 0,
                        }),
                    })
                );

                runtime.currentState['test1'].script.tags.myTag = 'hello!';

                runtime.process([toast('123')]);

                await waitAsync();
                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                count: 1,
                            },
                        }),
                        // Updates become logically separated because
                        // the tag update has to have been created in order for @onAnyAction to process it.
                        botUpdated('test1', {
                            tags: {
                                myTag: 'hello!',
                            },
                        }),
                    ],
                    [
                        botUpdated('test1', {
                            tags: {
                                count: 2,
                            },
                        }),
                        toast('123'),
                    ],
                ]);
            });

            it('should return the list of results from each action', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast("hi1")',
                        }),
                        test2: createBot('test2', {
                            hello: '@os.toast("hi2")',
                        }),
                        test3: createBot('test3', {}),
                    })
                );
                const results = runtime.process([
                    toast('hi0'),
                    action('hello'),
                    toast('hi3'),
                ]);

                expect(results).toEqual([
                    null,
                    {
                        results: [undefined, undefined],
                        errors: [],
                        actions: [toast('hi1'), toast('hi2')],
                        listeners: expect.any(Array),
                    },
                    null,
                ]);

                await waitAsync();

                expect(events).toEqual([
                    [toast('hi0'), toast('hi1'), toast('hi2'), toast('hi3')],
                ]);
            });

            describe('onError', () => {
                let actions = [] as any[];
                let sub: SubscriptionLike;

                beforeEach(() => {
                    sub = runtime.onActions.subscribe((a) =>
                        actions.push(...a)
                    );
                });

                afterEach(() => {
                    sub.unsubscribe();
                });

                it('should emit a onError shout when an error in a script occurs', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@throw new Error("My Error");',
                            }),
                            test3: createBot('test3', {
                                onError: '@action.perform(that);',
                            }),
                        })
                    );

                    runtime.process([action('hello')]);

                    await waitAsync();

                    const errorParam: any = actions[0] as any;

                    expect(errorParam).toBeTruthy();
                    expect(isRuntimeBot(errorParam.bot)).toBe(true);
                    expect(errorParam.tag).toBe('hello');
                    expect(errorParam.error).toEqual(new Error('My Error'));
                });

                it('should update the error stack trace to use the correct line numbers', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@throw new Error("My Error");',
                            }),
                            test3: createBot('test3', {
                                onError: '@action.perform(that)',
                            }),
                        })
                    );
                    runtime.process([action('hello')]);

                    await waitAsync();

                    const error = actions[0];

                    expect(error).toBeTruthy();
                    expect(isRuntimeBot(error.bot)).toBe(true);
                    expect(error.tag).toBe('hello');
                    expect(error.error).toEqual(new Error('My Error'));

                    const lines = error.error.stack.split('\n');

                    expect(lines).toEqual([
                        'Error: My Error',
                        '   at hello (test1.hello:1:7)',
                        '   at <CasualOS> ([Native CasualOS Code]::)',
                    ]);
                });

                it('should not emit errors that occur inside an onError tag', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                onError: '@throw new Error("My Error");',
                            }),
                            test3: createBot('test3', {
                                calledCount: 0,
                                onError: '@tags.calledCount += 1;',
                            }),
                        })
                    );
                    runtime.process([action('onError')]);

                    await waitAsync();

                    const bot = runtime.currentState['test3'];
                    expect(bot.tags.calledCount).toBe(1);
                });

                it('should not emit errors that occur inside an shout called from an onError', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                onError: '@shout("other")',
                                other: '@throw new Error("My Error")',
                            }),
                            test3: createBot('test3', {
                                calledCount: 0,
                                onError: '@tags.calledCount += 1;',
                            }),
                        })
                    );
                    runtime.process([action('other')]);

                    await waitAsync();

                    const bot = runtime.currentState['test3'];
                    expect(bot.tags.calledCount).toBe(1);
                });

                describe('timers', () => {
                    beforeAll(() => {
                        jest.useFakeTimers();
                    });

                    beforeEach(() => {
                        jest.clearAllTimers();
                    });

                    afterAll(() => {
                        jest.useRealTimers();
                    });

                    it('should disable onError for listeners that have thrown a lot of errors', () => {
                        runtime.repeatedErrorLimit = 2;

                        let errors: ScriptError[] = [];
                        runtime.onErrors.subscribe((e) => errors.push(...e));

                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    error: '@throw new Error("My Error")',
                                }),
                                test3: createBot('test3', {
                                    calledCount: 0,
                                    onError:
                                        '@tags.calledCount += 1; setTimeout(() => { shout("error"); } );',
                                }),
                            })
                        );

                        runtime.process([action('error')]);

                        const bot = runtime.currentState['test3'];
                        expect(bot.tags.calledCount).toBe(1);

                        jest.runOnlyPendingTimers();

                        expect(bot.tags.calledCount).toBe(2);

                        jest.runOnlyPendingTimers();

                        // should not call onError again because of the limit
                        expect(bot.tags.calledCount).toBe(2);
                    });

                    it('should default to a repeated error limit of 1000', () => {
                        expect(runtime.repeatedErrorLimit).toBe(1000);
                    });
                });
            });

            describe('register_builtin_portal', () => {
                it('should add a global variable with a new tempLocal bot for the bot included in the action', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.process([registerBuiltinPortal('grid')]);

                    await waitAsync();

                    expect(allEvents).toEqual([
                        defineGlobalBot('grid', 'uuid'),
                        botAdded(createBot('uuid', {}, 'tempLocal')),
                    ]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['uuid']);
                });

                it('should not override previous variables', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'other',
                            }),
                        })
                    );
                    runtime.process([defineGlobalBot('grid', 'test1')]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);

                    expect(allEvents).toEqual([
                        defineGlobalBot('grid', 'test1'),
                    ]);

                    runtime.process([registerBuiltinPortal('grid')]);

                    await waitAsync();

                    expect(allEvents).toEqual([
                        defineGlobalBot('grid', 'test1'),

                        // It should emit another define_global_bot event in response to the register_builtin_portal_event
                        // but with the current portal bot ID.
                        defineGlobalBot('grid', 'test1'),
                    ]);

                    const result2 = await runtime.execute('return gridBot;');
                    expect(result2.result).toBe(runtime.context.state['test1']);
                });

                it('should not create global variables', () => {
                    uuidMock.mockReturnValueOnce('uuid');

                    runtime.process([registerBuiltinPortal('grid')]);

                    expect(
                        Object.getOwnPropertyDescriptor(globalThis, 'gridBot')
                    ).toBeUndefined();
                });

                it('should recompile scripts when a new portal bot is registered', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                run: '@return gridBot;',
                            }),
                        })
                    );

                    const result1 = await runtime.shout('run');

                    expect(result1.results[0]).toBeUndefined();

                    runtime.process([registerBuiltinPortal('grid')]);

                    await waitAsync();

                    const result2 = await runtime.shout('run');
                    expect(result2.results[0]).toBe(
                        runtime.context.state['uuid']
                    );
                });
            });

            describe('register_custom_app', () => {
                it('should add a global variable for the bot included in a register portal action', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );
                    runtime.process([registerCustomApp('grid', 'test1')]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);
                });

                it('should override previous variables', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 'other',
                            }),
                        })
                    );
                    runtime.process([registerCustomApp('grid', 'test1')]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);

                    runtime.process([registerCustomApp('grid', 'test2')]);

                    const result2 = await runtime.execute('return gridBot;');
                    expect(result2.result).toBe(runtime.context.state['test2']);
                });

                it('should remove the variable if given no bot to use for configuration', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );
                    runtime.process([registerCustomApp('grid', 'test1')]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);

                    runtime.process([registerCustomApp('grid', null)]);

                    const result2 = await runtime.execute('return gridBot;');
                    expect(result2.result).toBeUndefined();
                });

                it('should not create variables on globalThis', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );
                    runtime.process([registerCustomApp('grid', 'test1')]);

                    expect(
                        Object.getOwnPropertyDescriptor(globalThis, 'gridBot')
                    ).toBeUndefined();
                });

                it('should emit register portal actions', async () => {
                    let actions = [] as RuntimeActions[];
                    runtime.onActions.subscribe((a) => actions.push(...a));

                    runtime.process([registerCustomApp('grid', 'test1')]);

                    await waitAsync();

                    expect(actions).toEqual([
                        registerCustomApp('grid', 'test1'),
                    ]);
                });
            });

            describe('define_global_bot', () => {
                it('should add a global variable for the given bot', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );
                    runtime.process([defineGlobalBot('grid', 'test1')]);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);
                });

                it('should resolve the task when the bot is defined', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );

                    const task = runtime.context.createTask();
                    let resolved: boolean = false;
                    task.promise.then(() => {
                        resolved = true;
                    });

                    runtime.process([
                        defineGlobalBot('grid', 'test1', task.taskId),
                    ]);

                    await waitAsync();

                    expect(resolved).toBe(true);
                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);
                });

                it('should resolve the task even if the bot is already globally defined', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                        })
                    );

                    const task1 = runtime.context.createTask();
                    const task2 = runtime.context.createTask();
                    let resolved: boolean = false;
                    task2.promise.then(() => {
                        resolved = true;
                    });

                    runtime.process([
                        defineGlobalBot('grid', 'test1', task1.taskId),
                        defineGlobalBot('grid', 'test1', task2.taskId),
                    ]);

                    await waitAsync();

                    expect(resolved).toBe(true);
                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test1']);
                });

                it('should be able to re-define a global bot', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: 'def',
                            }),
                            test2: createBot('test2', {
                                abc: 123,
                            }),
                        })
                    );

                    const task1 = runtime.context.createTask();
                    const task2 = runtime.context.createTask();
                    let resolved: boolean = false;
                    task2.promise.then(() => {
                        resolved = true;
                    });

                    runtime.process([
                        defineGlobalBot('grid', 'test1', task1.taskId),
                        defineGlobalBot('grid', 'test2', task2.taskId),
                    ]);

                    await waitAsync();

                    expect(resolved).toBe(true);

                    const result = await runtime.execute('return gridBot;');
                    expect(result.result).toBe(runtime.context.state['test2']);
                });

                it('should be able to resolve the task when completed via an async result', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                abc: '@await os.requestAuthBot(); os.toast("Hello");',
                            }),
                        })
                    );

                    let actions: any[] = [];
                    runtime.onActions.subscribe((a) => actions.push(...a));

                    runtime.shout('abc');

                    await waitAsync();

                    expect(actions.length).toBe(1);

                    runtime.process([
                        asyncResult(actions[0].taskId, {
                            userId: 'myUser',
                            token: 'token',
                            service: 'service',
                        }),
                    ]);

                    await waitAsync();

                    expect(actions.length).toBe(4);
                    expect(actions[3]).toEqual(toast('Hello'));
                });
            });
        });

        describe('execute()', () => {
            it('should compile and run the given script', async () => {
                await runtime.execute('os.toast("hello")');

                await waitAsync();

                expect(events).toEqual([[toast('hello')]]);
            });

            it('should emit an error if the script has a syntax error', async () => {
                await runtime.execute('os.toast(');

                await waitAsync();

                expect(errors).toEqual([
                    [
                        {
                            error: expect.any(SyntaxError),
                            script: 'os.toast(',
                            bot: null,
                            tag: null,
                        },
                    ],
                ]);
            });

            it('should return the compiler error if the script was unable to be compiled', async () => {
                const result = await runtime.execute('os.toast(');

                await waitAsync();

                expect(result).toEqual({
                    result: undefined,
                    actions: [],
                    errors: [
                        {
                            error: expect.any(SyntaxError),
                            script: 'os.toast(',
                            bot: null,
                            tag: null,
                        },
                    ],
                });
            });
        });

        describe('shout()', () => {
            it('should execute all the listeners that match the given event name and produce the resulting actions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast("hi1")',
                        }),
                        test2: createBot('test2', {
                            hello: '@os.toast("hi2")',
                        }),
                        test3: createBot('test3', {}),
                    })
                );
                await runtime.shout('hello', null);

                await waitAsync();

                expect(events).toEqual([[toast('hi1'), toast('hi2')]]);
            });

            it('should execute all the listeners that match the given event name among the given IDs and produce the resulting actions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast("hi1")',
                        }),
                        test2: createBot('test2', {
                            hello: '@os.toast("hi2")',
                        }),
                        test3: createBot('test3', {}),
                    })
                );
                await runtime.shout('hello', ['test2', 'test3']);

                await waitAsync();

                expect(events).toEqual([[toast('hi2')]]);
            });

            it('should map argument objects to bots if they have the right tags', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that.toJSON())',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, {
                    id: 'test2',
                    tags: {},
                });

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0].type).toBe('show_toast');
                expect((<any>events[0][0]).message).toEqual(
                    createBot('test2', {
                        abc: 'def',
                    })
                );
            });

            it('should map bot links to bots', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                        test3: createBot('test3', {
                            bool: true,
                        }),
                    })
                );
                await runtime.shout('hello', null, {
                    link1: createBotLink(['test2']),
                    link2: createBotLink(['test3', 'test2']),
                    link3: createBotLink([]),
                });

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(
                    (events[0][0] as any).link1 ===
                        runtime.currentState['test2'].script
                ).toBe(true);

                const link2 = (events[0][0] as any).link2;
                expect(link2[0] === runtime.currentState['test3'].script).toBe(
                    true
                );
                expect(link2[1] === runtime.currentState['test2'].script).toBe(
                    true
                );

                const link3 = (events[0][0] as any).link3;
                expect(link3).toBe(null);
            });

            it('should map argument objects to Vector2 objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout(
                    'hello',
                    null,
                    formatBotVector(new Vector2(1, 2))
                );

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Vector2(1, 2));
            });

            it('should be able to create Vector2 objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(new Vector2(1, 2))',
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Vector2(1, 2));
            });

            it('should map argument objects to Vector3 objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout(
                    'hello',
                    null,
                    formatBotVector(new Vector3(1, 2))
                );

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Vector3(1, 2));
            });

            it('should be able to create Vector3 objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(new Vector3(1, 2, 3))',
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Vector3(1, 2, 3));
            });

            it('should map argument objects to Rotation objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout(
                    'hello',
                    null,
                    formatBotRotation(new Rotation())
                );

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Rotation());
            });

            it('should be able to create Rotation objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(new Rotation())',
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(new Rotation());
            });

            it('should map argument tagged strings to strings', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout(
                    'hello',
                    null,
                    `${STRING_TAG_PREFIX}mystring`
                );

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual('mystring');
            });

            it('should map argument tagged numbers to numbers', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, `${NUMBER_TAG_PREFIX}123`);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(123);
            });

            it('should map argument tagged dates to date objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout(
                    'hello',
                    null,
                    formatBotDate(DateTime.utc(2022, 11, 11))
                );

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(DateTime.utc(2022, 11, 11));
            });

            it('should be able to create DateTime objects', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(DateTime.utc(2022, 11, 11))',
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(DateTime.utc(2022, 11, 11));
            });

            it('should preserve string arguments', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, 'mystring');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual('mystring');
            });

            it('should preserve number arguments', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, 123);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(123);
            });

            it('should preserve boolean arguments', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, true);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual(true);
            });

            it('should not convert strings that look like numbers', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, '123');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual('123');
            });

            it('should not convert strings that look like booleans', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@action.perform(that)',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );
                await runtime.shout('hello', null, 'false');

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0]).toEqual('false');
            });

            it('should handle mapping recursive objects', async () => {
                let obj1 = {
                    obj2: null as any,
                };

                let obj2 = {
                    obj3: null as any,
                };

                let obj3 = {
                    obj1: obj1,
                };

                obj1.obj2 = obj2;
                obj2.obj3 = obj3;

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                await runtime.shout('hello', null, obj1);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0].type).toBe('show_toast');
                expect((<any>events[0][0]).message).toEqual(obj1);
            });

            it('should handle mapping recursive arrays', async () => {
                let arr1 = [] as any[];
                let arr2 = [] as any[];
                let arr3 = [] as any[];

                arr1.push(arr2);
                arr2.push(arr3);
                arr3.push(arr1);

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                await runtime.shout('hello', null, arr1);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0].type).toBe('show_toast');
                expect((<any>events[0][0]).message).toEqual(arr1);
            });

            it('should fail to convert deep objects', async () => {
                let obj = {} as any;
                let current = obj;
                for (let i = 0; i < 10000; i++) {
                    current = current['deep'] = {};
                }

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                const result = await runtime.shout('hello', null, obj);

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0].type).toBe('show_toast');
                expect((<any>events[0][0]).message).toEqual(
                    'Error: Object too deeply nested.'
                );
            });

            it('should not map argument objects that have a custom prototype', async () => {
                class MyClass {}

                const obj = new MyClass();

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                await runtime.shout('hello', null, {
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
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                await runtime.shout('hello', null, {
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
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@os.toast(that)',
                        }),
                    })
                );
                await runtime.shout('hello', null, {
                    value: [obj],
                });

                await waitAsync();

                expect(events.length).toBe(1);
                expect(events[0].length).toBe(1);
                expect(events[0][0].type).toBe('show_toast');
                expect((<any>events[0][0]).message.value[0]).toEqual(obj);
            });

            describe('timers', () => {
                beforeAll(() => {
                    jest.useFakeTimers({});
                });

                afterEach(() => {
                    jest.clearAllTimers();
                });

                afterAll(() => {
                    jest.useRealTimers();
                });

                it('should dispatch events from setInterval() callbacks', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@setInterval(() => os.toast("abc"), 100)',
                            }),
                        })
                    );
                    runtime.shout('hello');
                    jest.runAllTicks();

                    expect(events).toEqual([]);

                    jest.advanceTimersByTime(200);
                    jest.runAllTicks();

                    expect(events).toEqual([[toast('abc')], [toast('abc')]]);
                });

                it('should cancel setInterval() timers with clearInterval()', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@const abc = setInterval(() => os.toast("abc"), 100); clearInterval(abc);',
                            }),
                        })
                    );
                    runtime.shout('hello');
                    jest.runAllTicks();

                    expect(events).toEqual([]);

                    jest.advanceTimersByTime(200);
                    jest.runAllTicks();

                    expect(events).toEqual([]);
                });

                it('should dispatch events from setTimeout() callbacks', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@setTimeout(() => os.toast("abc"), 100)',
                            }),
                        })
                    );
                    runtime.shout('hello');

                    jest.runAllTicks();

                    expect(events).toEqual([]);

                    jest.advanceTimersByTime(200);

                    jest.runAllTicks();

                    expect(events).toEqual([[toast('abc')]]);
                });

                it('should be able to cancel setTimeout() timers with clearTimeout()', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@let abc = setTimeout(() => os.toast("abc"), 100); clearTimeout(abc);',
                            }),
                        })
                    );
                    runtime.shout('hello');

                    jest.runAllTicks();

                    expect(events).toEqual([]);

                    jest.advanceTimersByTime(200);

                    jest.runAllTicks();

                    expect(events).toEqual([]);
                });

                it('should handle a bot getting destroyed twice due to a setTimeout() callback', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@setTimeout(() => destroy(this), 100)',
                                destroy: '@destroy(this)',
                            }),
                        })
                    );
                    runtime.shout('hello');
                    runtime.shout('destroy');

                    jest.runAllTicks();

                    expect(events).toEqual([[botRemoved('test1')]]);

                    jest.advanceTimersByTime(200);
                    jest.runAllTicks();

                    expect(events).toEqual([[botRemoved('test1')]]);
                });

                it('should emit errors that occur inside a shout from timer started from an onError', () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                onError:
                                    '@setTimeout(() => { shout("other"); }, 100);',
                                other: '@throw new Error("My Error")',
                            }),
                            test3: createBot('test3', {
                                calledCount: 0,
                                onError: '@tags.calledCount += 1;',
                            }),
                        })
                    );
                    runtime.process([action('onError')]);

                    jest.runAllTicks();
                    jest.advanceTimersByTime(200);
                    jest.runAllTicks();

                    const bot = runtime.currentState['test3'];
                    expect(bot.tags.calledCount).toBe(2);
                });
            });

            it('should dispatch events from promise callbacks', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: '@Promise.resolve(0).then(() => os.toast("abc")).then(() => os.toast("abc2"))',
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                if (type === 'interpreted') {
                    // Events happen in the same batch because the interpreted jobs
                    // are executed during the same real microtask.
                    expect(events).toEqual([[toast('abc'), toast('abc2')]]);
                } else {
                    expect(events).toEqual([[toast('abc')], [toast('abc2')]]);
                }
            });

            it('should dispatch events from promise callbacks when using await', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: `@await Promise.resolve(0);
                            os.toast("abc");`,
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[toast('abc')]]);
            });

            it('should dispatch events that happen between async events', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: `@await Promise.resolve(0);
                            os.toast("abc");

                            // Never gets resolved but that is fine because we
                            // want to ensure that the toast happens
                            await new Promise(() => {});`,
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([[toast('abc')]]);
            });

            it('should dispatch changes that happen between async events', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            hello: `@await Promise.resolve(0);
                            bot.tags.abc = true;

                            // Never gets resolved but that is fine because we
                            // want to ensure that the toast happens
                            await new Promise(() => {});`,
                        }),
                    })
                );
                await runtime.shout('hello');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botUpdated('test1', {
                            tags: {
                                abc: true,
                            },
                        }),
                    ],
                ]);
            });

            it('should handle a bot getting destroyed twice', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {}),
                        test2: createBot('test2', {
                            destroyBot1: '@destroy("test1")',
                        }),
                    })
                );
                await runtime.shout('destroyBot1');
                await runtime.shout('destroyBot1');

                await waitAsync();

                expect(events).toEqual([[botRemoved('test1')]]);
            });

            it('should handle a bot destroying itself twice', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            destroy: '@destroy(this);destroy(this)',
                        }),
                    })
                );
                await runtime.shout('destroy');

                await waitAsync();

                expect(events).toEqual([[botRemoved('test1')]]);
            });

            it('should handle setting a tag mask on a new bot', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            create: '@let newBot = create({ test: true }); newBot.tags.abc = 456; setTagMask(newBot, "myTag", 123);',
                        }),
                    })
                );
                await runtime.shout('create');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botAdded({
                            id: 'uuid',
                            tags: {
                                creator: 'test1',
                                test: true,
                                abc: 456,
                            },
                            masks: {
                                [TEMPORARY_BOT_PARTITION_ID]: {
                                    myTag: 123,
                                },
                            },
                        }),
                    ],
                ]);
            });

            it('should compile listeners to use the html.h() function for JSX', async () => {
                uuidMock.mockReturnValueOnce('uuid');
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@return (<div></div>)',
                        }),
                    })
                );
                let result = await runtime.shout('test');

                expect(
                    result.results.map((r) =>
                        pickBy(r, (value, key) => !key.startsWith('__'))
                    )
                ).toMatchSnapshot();
            });

            describe('globalThis', () => {
                it('should intercept changes to globalThis', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                test: '@globalThis.testValue = true;',
                                test2: '@return globalThis.testValue;',
                            }),
                        })
                    );
                    await runtime.shout('test');
                    let result = await runtime.shout('test2');

                    expect('testValue' in globalThis).toBe(false);
                    expect(result.results).toEqual([true]);
                });

                it('should be able to get properties from the normal globalThis', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                test: '@return globalThis.Map;',
                            }),
                        })
                    );
                    let result = await runtime.shout('test');

                    if (type === 'interpreted') {
                        const interpretedMap = interpreter.reverseProxyObject(
                            interpreter.realm.Intrinsics['%Map%']
                        );
                        expect(result.results[0] === interpretedMap).toBe(true);
                    } else {
                        expect(result.results[0]).toBe(Map);
                    }
                });

                it('should not allow deleting properties from globalThis', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                test: '@delete globalThis.Map;',
                            }),
                        })
                    );
                    let result = await runtime.shout('test');
                    expect(result).toMatchSnapshot();
                });

                it('should be able to test if a added property is in globalThis', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                test: `@globalThis.testValue = true; return [
                                    "testValue" in globalThis,
                                    "otherValue" in globalThis
                                ];`,
                            }),
                        })
                    );
                    let result = await runtime.shout('test');
                    expect(result.results[0]).toEqual([true, false]);
                });

                it('should be able to list added properties with Object.keys()', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                test: `@globalThis.testValue = true; return Object.keys(globalThis)`,
                            }),
                        })
                    );
                    let result = await runtime.shout('test');
                    let keys = result.results[0];
                    keys.sort();

                    if (type === 'interpreted') {
                        expect(keys).toEqual(['console', 'testValue'].sort());
                    } else {
                        expect(keys).toEqual(
                            [...Object.keys(globalThis), 'testValue'].sort()
                        );
                    }
                });

                if (type !== 'interpreted') {
                    it('should allow getting properties from globalThis', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    test: `@return globalThis.process;`,
                                }),
                            })
                        );
                        let result = await runtime.shout('test');
                        let p = result.results[0];

                        expect(p === process).toBe(true);
                    });
                } else {
                    it('should not allow getting properties from globalThis', async () => {
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    test: `@return globalThis.process;`,
                                }),
                            })
                        );
                        let result = await runtime.shout('test');
                        let p = result.results[0];

                        expect(p).toBeUndefined();
                    });
                }
            });

            describe('bot_added', () => {
                it('should produce an event when a bot is created', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@create({ abc: "def" })',
                            }),
                        })
                    );
                    await runtime.shout('create');

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

                it('should not change the tags in the created event if the bot is changed after the event is emitted', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@let b = create({ abc: "def" }); Promise.resolve().then(() => { b.tags.newTag = true })',
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

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
                        [
                            botUpdated('uuid', {
                                tags: {
                                    newTag: true,
                                },
                            }),
                        ],
                    ]);
                });

                it('should add the created bot to the runtime state', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: `@create({ "shout": "@os.toast('abc')" })`,
                            }),
                        })
                    );
                    await runtime.shout('create');
                    await runtime.shout('shout');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    shout: "@os.toast('abc')",
                                })
                            ),
                        ],
                        [toast('abc')],
                    ]);
                });

                it('should be able to integrate new bots which get accepted to the partition', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: `@create({ abc: "def", "shout": "@os.toast('abc')" })`,
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

                    const updates = await captureUpdates(async () => {
                        for (let e of events) {
                            await memory.applyEvents(e as BotAction[]);
                        }
                        await waitAsync();
                    });

                    expect(updates).toEqual([
                        {
                            state: {
                                uuid: createPrecalculatedBot('uuid', {
                                    creator: 'test1',
                                    shout: "@os.toast('abc')",
                                    abc: 'def',
                                }),
                            },
                            addedBots: ['uuid'],
                            removedBots: [],
                            updatedBots: [],
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should produce an event from promise callbacks', async () => {
                    uuidMock
                        .mockReturnValueOnce('uuid1')
                        .mockReturnValueOnce('uuid2');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@Promise.resolve(0).then(() => create({ abc: "def" })).then(() => create({ abc: "def" }))',
                            }),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    if (type === 'interpreted') {
                        // Events happen in the same batch because the interpreted
                        // job queue executes during the same real microtask.
                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('uuid1', {
                                        creator: 'test1',
                                        abc: 'def',
                                    })
                                ),
                                botAdded(
                                    createBot('uuid2', {
                                        creator: 'test1',
                                        abc: 'def',
                                    })
                                ),
                            ],
                        ]);
                    } else {
                        expect(events).toEqual([
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
                    }
                });

                it('should be able to create multiple bots with the same script', async () => {
                    uuidMock
                        .mockReturnValueOnce('uuid1')
                        .mockReturnValueOnce('uuid2')
                        .mockReturnValueOnce('uuid3');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@
                                    for (let i = 0; i < 3; i++) {
                                        create({ script: "@destroy(this);" });
                                    }`,
                            }),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid1', {
                                    creator: 'test1',
                                    script: '@destroy(this);',
                                })
                            ),
                            botAdded(
                                createBot('uuid2', {
                                    creator: 'test1',
                                    script: '@destroy(this);',
                                })
                            ),
                            botAdded(
                                createBot('uuid3', {
                                    creator: 'test1',
                                    script: '@destroy(this);',
                                })
                            ),
                        ],
                    ]);

                    await runtime.shout('script');

                    await waitAsync();

                    expect(events.slice(1)).toEqual([
                        [
                            botRemoved('uuid1'),
                            botRemoved('uuid2'),
                            botRemoved('uuid3'),
                        ],
                    ]);
                });

                it('should be able to shout to a bot that is created in a shout', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@create({ abc: "@os.toast(`Hi`);" }); shout("abc");',
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: '@os.toast(`Hi`);',
                                })
                            ),
                            toast('Hi'),
                        ],
                    ]);
                });

                it('should be able to whisper to a bot that is created in a shout', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@let created = create({ abc: "@os.toast(`Hi`);" }); whisper(created, "abc");',
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: '@os.toast(`Hi`);',
                                })
                            ),
                            toast('Hi'),
                        ],
                    ]);
                });

                it('should be able to update new bots', async () => {
                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@let created = create({ abc: 123 }); created.tags.abc = 456; created.tags.def = true;',
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: 456,
                                    def: true,
                                })
                            ),
                        ],
                    ]);
                });

                it('should be able to whisper to a bot that is created in an async shout', async () => {
                    let resolve: (val?: any) => void;
                    const promise = new Promise((r, reject) => {
                        resolve = r;
                    });
                    runtime = new AuxRuntime(
                        version,
                        auxDevice,
                        (context) =>
                            merge(createDefaultLibrary(context), {
                                api: {
                                    testPromise: promise,
                                },
                            }),
                        new DefaultRealtimeEditModeProvider(
                            new Map<BotSpace, RealtimeEditMode>([
                                ['shared', RealtimeEditMode.Immediate],
                                [<any>'delayed', RealtimeEditMode.Delayed],
                            ])
                        )
                    );
                    runtime.onActions.subscribe((a) => {
                        events.push(a);
                        allEvents.push(...a);
                    });
                    runtime.onErrors.subscribe((e) => {
                        errors.push(e);
                        allErrors.push(...e);
                    });

                    uuidMock.mockReturnValueOnce('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: '@await testPromise; let created = create({ abc: "@os.toast(`Hi`);" }); whisper(created, "abc");',
                            }),
                        })
                    );
                    await runtime.shout('create');

                    await waitAsync();

                    expect(events).toEqual([]);

                    resolve();

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: '@os.toast(`Hi`);',
                                })
                            ),
                            toast('Hi'),
                        ],
                    ]);
                });

                describe('timers', () => {
                    beforeAll(() => {
                        jest.useFakeTimers({});
                    });

                    afterEach(() => {
                        jest.clearAllTimers();
                    });

                    afterAll(() => {
                        jest.useRealTimers();
                    });

                    it('should preserve the current bot in callbacks', () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setTimeout(() => create({ abc: "def" }), 100)',
                                }),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(100);
                        jest.runAllTicks();

                        expect(events).toEqual([
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

                    it('should produce an event from setInterval() callbacks', () => {
                        uuidMock
                            .mockReturnValueOnce('uuid1')
                            .mockReturnValueOnce('uuid2');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setInterval(() => create({ abc: "def" }), 100)',
                                }),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(events).toEqual([
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

                    it('should produce an event from setTimeout() callbacks', () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setTimeout(() => create({ abc: "def" }), 100)',
                                }),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(events).toEqual([
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
                });

                describe('custom data types', () => {
                    describe.each(allDataTypeCases)(
                        '%s',
                        (desc, given, expected) => {
                            it('should be able to update bots with %s tags', async () => {
                                uuidMock.mockReturnValueOnce('uuid');
                                runtime.stateUpdated(
                                    stateUpdatedEvent({
                                        test1: createBot('test1', {
                                            create: '@let created = create({ abc: that.value }); created.tags.newTag = 456; created.tags.def = true;',
                                        }),
                                    })
                                );
                                runtime.shout('create', undefined, {
                                    value: given,
                                });

                                await waitAsync();

                                expect(events).toEqual([
                                    [
                                        botAdded(
                                            createBot('uuid', {
                                                creator: 'test1',
                                                abc: expected,
                                                newTag: 456,
                                                def: true,
                                            })
                                        ),
                                    ],
                                ]);

                                expect(
                                    runtime.currentState['uuid'].script.tags
                                ).toEqual({
                                    creator: 'test1',
                                    abc: given,
                                    newTag: 456,
                                    def: true,
                                });
                            });

                            it('should support creating bots with %s tags', async () => {
                                if (
                                    type !== 'not-interpreted' ||
                                    desc !== 'Object'
                                ) {
                                    return;
                                }
                                uuidMock.mockReturnValueOnce('uuid');
                                runtime.stateUpdated(
                                    stateUpdatedEvent({
                                        test1: createBot('test1', {
                                            create: '@create({ value: that.value })',
                                        }),
                                    })
                                );
                                await runtime.shout('create', null, {
                                    value: given,
                                });

                                await waitAsync();

                                expect(events).toEqual([
                                    [
                                        botAdded(
                                            createBot('uuid', {
                                                creator: 'test1',
                                                value: expected,
                                            })
                                        ),
                                    ],
                                ]);
                            });

                            it('should support updating new bots with %s tags', async () => {
                                uuidMock.mockReturnValueOnce('uuid');
                                runtime.stateUpdated(
                                    stateUpdatedEvent({
                                        test1: createBot('test1', {
                                            create: '@let b = create({ value: 999 }); b.tags.value = that.value;',
                                        }),
                                    })
                                );
                                await runtime.shout('create', null, {
                                    value: given,
                                });

                                await waitAsync();

                                expect(events).toEqual([
                                    [
                                        botAdded(
                                            createBot('uuid', {
                                                creator: 'test1',
                                                value: expected,
                                            })
                                        ),
                                    ],
                                ]);
                            });

                            it('should support adding %s tags to new bots', async () => {
                                uuidMock.mockReturnValueOnce('uuid');
                                runtime.stateUpdated(
                                    stateUpdatedEvent({
                                        test1: createBot('test1', {
                                            create: '@let b = create({ value: 999 }); b.tags.newTag = that.value;',
                                        }),
                                    })
                                );
                                await runtime.shout('create', null, {
                                    value: given,
                                });

                                await waitAsync();

                                expect(events).toEqual([
                                    [
                                        botAdded(
                                            createBot('uuid', {
                                                creator: 'test1',
                                                value: 999,
                                                newTag: expected,
                                            })
                                        ),
                                    ],
                                ]);
                            });
                        }
                    );

                    it('should support creating bots with arrays from another bot', async () => {
                        uuidMock.mockReturnValueOnce('uuid');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    array: [1, 2, 3],
                                    create: '@create({ array: tags.array })',
                                }),
                            })
                        );
                        await runtime.shout('create');

                        await waitAsync();

                        expect(events).toEqual([
                            [
                                botAdded(
                                    createBot('uuid', {
                                        creator: 'test1',
                                        array: [1, 2, 3],
                                    })
                                ),
                            ],
                        ]);

                        expect(runtime.currentState['uuid'].tags.array).toEqual(
                            [1, 2, 3]
                        );
                    });
                });
            });

            describe('bot_removed', () => {
                it('should produce an event when a bot is deleted', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                delete: '@destroy(this)',
                            }),
                        })
                    );
                    await runtime.shout('delete');

                    await waitAsync();

                    expect(events).toEqual([[botRemoved('test1')]]);
                });

                it('should remove the bot from the runtime state', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                delete: '@destroy(this)',
                                hello: '@os.toast("hi")',
                            }),
                        })
                    );
                    await runtime.shout('delete');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[botRemoved('test1')]]);
                });

                it('should be able to delete bots which get accepted to the partition', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                delete: `@destroy(this)`,
                                abc: 'def',
                            }),
                        })
                    );
                    await runtime.shout('delete');

                    await waitAsync();

                    const updates = await captureUpdates(async () => {
                        for (let e of events) {
                            await memory.applyEvents(e as BotAction[]);
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
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should delete bots from promise callbacks', async () => {
                    uuidMock
                        .mockReturnValueOnce('uuid1')
                        .mockReturnValueOnce('uuid2');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@Promise.resolve(0).then(() => destroy("test2")).then(() => destroy("test3"))',
                            }),
                            test2: createBot('test2'),
                            test3: createBot('test3'),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    if (type === 'interpreted') {
                        // Events happen in the same batch because the interpreted
                        // job queue executes during the same real microtask.
                        expect(events).toEqual([
                            [botRemoved('test2'), botRemoved('test3')],
                        ]);
                    } else {
                        expect(events).toEqual([
                            [botRemoved('test2')],
                            [botRemoved('test3')],
                        ]);
                    }
                });

                describe('timers', () => {
                    beforeAll(() => {
                        jest.useFakeTimers({});
                    });

                    afterEach(() => {
                        jest.clearAllTimers();
                    });

                    afterAll(() => {
                        jest.useRealTimers();
                    });

                    it('should delete bots from setInterval() callbacks', () => {
                        uuidMock
                            .mockReturnValueOnce('uuid1')
                            .mockReturnValueOnce('uuid2');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setInterval(() => destroy("test2"), 100)',
                                }),
                                test2: createBot('test2'),
                                test3: createBot('test3'),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(events).toEqual([[botRemoved('test2')]]);
                    });

                    it('should delete bots from setTimeout() callbacks', () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setTimeout(() => destroy("test2"), 100)',
                                }),
                                test2: createBot('test2'),
                                test3: createBot('test3'),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(events).toEqual([[botRemoved('test2')]]);
                    });
                });
            });

            describe('bot_updated', () => {
                it('should produce an event when a bot is modified', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                update: '@tags.value = 123',
                            }),
                        })
                    );
                    await runtime.shout('update');

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
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    await memory.applyEvents([botAdded(bot)]);
                    await runtime.shout('update');

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
                            await memory.applyEvents(e as BotAction[]);
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
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should be able to update tag masks which get accepted to the partition', async () => {
                    uuidMock.mockReturnValue('uuid');
                    memory.space = DEFAULT_TAG_MASK_SPACE;
                    const bot = createBot('test1', {
                        update: `@bot.masks.abc = "def"`,
                    });
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    await memory.applyEvents([botAdded(bot)]);
                    await runtime.shout('update');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botUpdated('test1', {
                                masks: {
                                    [DEFAULT_TAG_MASK_SPACE]: {
                                        abc: 'def',
                                    },
                                },
                            }),
                        ],
                    ]);

                    const updates = await captureUpdates(async () => {
                        for (let e of events) {
                            await memory.applyEvents(e as BotAction[]);
                        }
                        await waitAsync();
                    });

                    expect(updates).toEqual([
                        {
                            state: {
                                test1: {
                                    values: {
                                        abc: 'def',
                                    },
                                    tags: {},
                                    masks: {
                                        [DEFAULT_TAG_MASK_SPACE]: {
                                            abc: 'def',
                                        },
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test1'],
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should be able to update formulas which get accepted to the partition', async () => {
                    uuidMock.mockReturnValue('uuid');
                    const bot = createBot('test1', {
                        update: `@tags.formula = "${DNA_TAG_PREFIX}456"`,
                        formula: `${DNA_TAG_PREFIX}1`,
                    });
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    await memory.applyEvents([botAdded(bot)]);
                    await runtime.shout('update');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botUpdated('test1', {
                                tags: {
                                    formula: `${DNA_TAG_PREFIX}456`,
                                },
                            }),
                        ],
                    ]);

                    const updates = await captureUpdates(async () => {
                        for (let e of events) {
                            await memory.applyEvents(e as BotAction[]);
                        }
                        await waitAsync();
                    });

                    expect(updates).toEqual([
                        {
                            state: {
                                test1: {
                                    tags: {
                                        formula: `${DNA_TAG_PREFIX}456`,
                                    },
                                    values: {
                                        formula: 456,
                                    },
                                },
                            },
                            addedBots: [],
                            removedBots: [],
                            updatedBots: ['test1'],
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should handle updates in separate shouts', async () => {
                    uuidMock.mockReturnValue('uuid');
                    const bot = createBot('test1', {
                        update1: `@tags.abc = 123`,
                        update2: `@tags.abc = 456`,
                    });
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    await memory.applyEvents([botAdded(bot)]);

                    await runtime.shout('update1');
                    await waitAsync();

                    await runtime.shout('update2');
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
                            await memory.applyEvents(e as BotAction[]);
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
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
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
                            version: {
                                currentSite: undefined,
                                remoteSite: undefined,
                                vector: {},
                            },
                        },
                    ]);
                });

                it('should update bots from promise callbacks', async () => {
                    uuidMock
                        .mockReturnValueOnce('uuid1')
                        .mockReturnValueOnce('uuid2');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: '@Promise.resolve(0).then(() => tags.hit = 1).then(() => tags.hit = 2)',
                            }),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    if (type === 'interpreted') {
                        // Both updates get batched as a single update since
                        // the interpreted job queue runs during the same real microtask
                        expect(events).toEqual([
                            [
                                botUpdated('test1', {
                                    tags: {
                                        hit: 2,
                                    },
                                }),
                            ],
                        ]);
                    } else {
                        expect(events).toEqual([
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
                    }
                });

                it('should not update a bot that was deleted', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                update: '@tags.value = 123; destroy(this);',
                            }),
                        })
                    );
                    await runtime.shout('update');

                    await waitAsync();

                    expect(events).toEqual([[botRemoved('test1')]]);
                });

                it('should not update a bot that was updated after being deleted', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                update: '@destroy(this); tags.value = 123;',
                            }),
                        })
                    );
                    await runtime.shout('update');

                    await waitAsync();

                    expect(events).toEqual([[botRemoved('test1')]]);
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
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: bot,
                        })
                    );
                    await memory.applyEvents([botAdded(bot)]);

                    await runtime.shout('update1');
                    await waitAsync();

                    await runtime.shout('update2');
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
                        await memory.applyEvents(events[0] as BotAction[]);
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
                            version: null,
                        },
                    ]);

                    await runtime.shout('update3');

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

                describe('timers', () => {
                    beforeAll(() => {
                        jest.useFakeTimers({});
                    });

                    afterEach(() => {
                        jest.clearAllTimers();
                    });

                    afterAll(() => {
                        jest.useRealTimers();
                    });

                    it('should update bots from setInterval() callbacks', () => {
                        uuidMock
                            .mockReturnValueOnce('uuid1')
                            .mockReturnValueOnce('uuid2');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setInterval(() => tags.count += 1, 100)',
                                    count: 0,
                                }),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(100);
                        jest.runAllTicks();

                        jest.advanceTimersByTime(100);
                        jest.runAllTicks();

                        expect(events).toEqual([
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

                    it('should update bots from setTimeout() callbacks', () => {
                        uuidMock.mockReturnValueOnce('uuid1');
                        runtime.stateUpdated(
                            stateUpdatedEvent({
                                test1: createBot('test1', {
                                    hello: '@setTimeout(() => tags.hit = true, 100)',
                                }),
                            })
                        );
                        runtime.shout('hello');
                        jest.runAllTicks();

                        expect(events).toEqual([]);

                        jest.advanceTimersByTime(200);
                        jest.runAllTicks();

                        expect(events).toEqual([
                            [
                                botUpdated('test1', {
                                    tags: {
                                        hit: true,
                                    },
                                }),
                            ],
                        ]);
                    });
                });
            });

            describe('imports', () => {
                it('should be able to import scripts by system tag', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export const abc = 'def';`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should be able to resolve imports when called directly', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(that + abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export const abc = 'def';`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    const b = runtime.context.bots.find(
                        (b) => b.id === 'test1'
                    );
                    await b.hello('111');

                    await waitAsync();

                    expect(events).toEqual([[toast('111def')]]);
                });

                it('should be able to import listeners by system tag', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `@export const abc = 'def';`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should support default imports', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import abc from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄const abc = 'def'; export default abc;`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should support dynamic imports', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@const abc = (await import('module.library')).default; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄const abc = 'def'; export default abc;`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should cache a module between imports', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `@export const abc = 'def'; os.toast('side-effect');`,
                            }),
                            test3: createBot('test3', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc + '2');`,
                            }),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    // There should only be one side-effect
                    expect(events).toEqual([
                        [toast('side-effect')],
                        [toast('def'), toast('def2')],
                    ]);

                    events.splice(0, events.length);

                    await runtime.shout('hello');

                    await waitAsync();
                    expect(events).toEqual([[toast('def'), toast('def2')]]);
                });

                it('should clear the cache for a module if the bot is changed', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `@export const abc = 'def'; os.toast('side-effect');`,
                            }),
                            test3: createBot('test3', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc + '2');`,
                            }),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    // There should only be one side-effect
                    expect(events).toEqual([
                        [toast('side-effect')],
                        [toast('def'), toast('def2')],
                    ]);

                    events.splice(0, events.length);

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: {
                                tags: {
                                    library: `@export const abc = 'ghi'; os.toast('side-effect2');`,
                                },
                            },
                        })
                    );

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [toast('side-effect2')],
                        [toast('ghi'), toast('ghi2')],
                    ]);
                });

                it('should be able to export other modules', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export * from 'module.library2';`,
                                library2: `📄export const abc = 'def';`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should be able to export specific variables from other modules', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export { abc } from 'module.library2';`,
                                library2: `📄export const abc = 'def'; export const num = 123;`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should be able to resolve an import using an async @onResolveModule', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); return '📄export const abc = "def";';`,
                            }),
                        })
                    );
                    await waitAsync();

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should be able to resolve the casualos module', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { create } from 'casualos'; create({ abc: 123 });`,
                            }),
                        })
                    );
                    await waitAsync();

                    uuidMock.mockReturnValue('uuid');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: 123,
                                })
                            ),
                        ],
                    ]);
                });

                it('should be able to import tag-specific APIs from casualos in library modules', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { test } from '.library'; test();`,
                                library: `📄import { create } from 'casualos'; export function test() { create({ abc: 123 }); };`,
                            }),
                        })
                    );
                    await waitAsync();

                    uuidMock.mockReturnValue('uuid');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            botAdded(
                                createBot('uuid', {
                                    creator: 'test1',
                                    abc: 123,
                                })
                            ),
                        ],
                    ]);
                });

                it('should be able to use import.meta', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@os.toast(import.meta)`,
                            }),
                        })
                    );
                    await waitAsync();

                    uuidMock.mockReturnValue('uuid');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            toast({
                                botId: 'test1',
                                tag: 'hello',
                            }),
                        ],
                    ]);
                });

                it('should be able to use import.meta.resolve()', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@os.toast(await import.meta.resolve('module.library'))`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export const abc = 'def';`,
                            }),
                        })
                    );
                    await waitAsync();

                    uuidMock.mockReturnValue('uuid');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            toast({
                                id: 'module.library',
                                botId: 'test2',
                                tag: 'library',
                            }),
                        ],
                    ]);
                });

                it('should be able to dynamically import modules resolved from import.meta.resolve()', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@const resolved = await import.meta.resolve('module.library'); const { abc } = await import(resolved); os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export const abc = 'def';`,
                            }),
                        })
                    );
                    await waitAsync();

                    uuidMock.mockReturnValue('uuid');
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should use dynamic imports on modules that are URLs', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'https://example.com'; os.toast(abc);`,
                            }),
                        })
                    );

                    runtime.dynamicImport = jest.fn().mockResolvedValue({
                        abc: 123,
                    });

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast(123)]]);
                });

                it('should not propogate changes to exported variables', async () => {
                    // TODO: This is a limitation of the current implementation
                    // The native ES module system would cause 123 to be toasted instead of "def".
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc, test } from 'module.library'; test(); os.toast(abc);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export let abc = 'def'; export function test() { abc = 123 ; }`,
                            }),
                        })
                    );

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should reject when a circular dependency is detected', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; import { num } from "module.library2"; os.toast(abc); os.toast(num);`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄import { test2 } from ".library2"; export function test1() { return 1; }; export const abc = test2();`,
                                library2: `📄import { test1 } from ".library"; export function test2() { return 2; }; export const num = test1();`,
                            }),
                        })
                    );

                    const result = await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[]]);

                    let error: any;
                    try {
                        await result.results[0];
                    } catch (err) {
                        error = err;
                    }

                    expect(error?.error?.error.error.message).toEqual(
                        'Circular dependency detected: module.library -> module.library2 -> module.library'
                    );
                });

                it('should require that library modules import API functions from casualos', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; abc();`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄import { os } from "casualos"; export function abc() { os.toast("def"); }`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should support loops in library modules', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; abc();`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄import { os } from "casualos"; export function abc() { for(let i = 0; i < 3; i++) { os.toast("def" + i) } }`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [toast('def0'), toast('def1'), toast('def2')],
                    ]);
                });

                it('should throw an error if os functions are not imported from the casualos module', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import { abc } from 'module.library'; abc();`,
                            }),
                            test2: createBot('test2', {
                                system: 'module',
                                library: `📄export function abc() { os.toast("def"); }`,
                            }),
                            test3: createBot('test3', {}),
                        })
                    );
                    await runtime.shout('hello');

                    await waitAsync();

                    expect(errors.length).toBe(1);
                    expect(errors[0].length).toBe(1);
                    expect(errors[0][0].bot.id).toBe('test1');
                    expect(errors[0][0].tag).toBe('hello');
                    expect(errors[0][0].error).toBeInstanceOf(Error);

                    expect(events.length).toBe(1);
                    expect(events[0].length).toBe(0);
                });

                it('should compile scripts with dynamic imports as non-async scripts', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@import(".test"); os.toast("def"); return 123;`,
                                test: '📄export default 999;',
                            }),
                        })
                    );
                    const result = await runtime.shout('hello');

                    await waitAsync();

                    expect(result.results).toEqual([123]);
                    expect(events).toEqual([[toast('def')]]);
                });
            });

            describe('typescript', () => {
                it('should support basic typescript syntax', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                hello: `@
                                    const abc: string = 'def';
                                    const num: number = 123;
                                    const b: boolean = true;
                                    const a: any = 123;
                                    const obj: { a: number } = { a: 123 };

                                    os.toast(abc);
                                    os.toast(num);
                                    os.toast(b);
                                    os.toast(a);
                                    os.toast(obj);
                                `,
                            }),
                        })
                    );

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            toast('def'),
                            toast(123),
                            toast(true),
                            toast(123),
                            toast({ a: 123 }),
                        ],
                    ]);
                });

                it('should support TypeScript interfaces', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                hello: `@
                                    interface MyObj {
                                        a: number;
                                    }
                                    const obj: MyObj = { a: 123 };
                                    os.toast(obj);
                                `,
                            }),
                        })
                    );

                    await runtime.shout('hello');

                    await waitAsync();

                    expect(events).toEqual([[toast({ a: 123 })]]);
                });
            });

            describe('listeners', () => {
                it('should support adding dynamic listeners to bots', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@os.addBotListener(thisBot, 'onClick', (arg, bot, tag) => os.toast('clicked: ' + arg + ',' + bot.id + ',' + tag));`,
                            }),
                        })
                    );
                    await runtime.shout('hello');
                    await runtime.shout('onClick', null, 'arg');

                    await waitAsync();

                    expect(events).toEqual([
                        [toast('clicked: arg,test1,onClick')],
                    ]);
                });

                it('should not override module imports', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@os.addBotListener(thisBot, 'abc', (arg, bot, tag) => "wrong");`,
                                test: `@import val from ".abc"; os.toast(val);`,
                                abc: '📄export default "def";',
                            }),
                        })
                    );
                    await runtime.shout('hello');
                    await runtime.shout('test');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should be able to import from other bots', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@os.addBotListener(thisBot, 'onClick', async (arg, bot, tag) => {
                                    const { default: value } = await import('.abc');
                                    os.toast(value);
                                });`,
                                abc: '📄export default "def";',
                            }),
                        })
                    );
                    await runtime.shout('hello');
                    await runtime.shout('onClick');

                    await waitAsync();

                    expect(events).toEqual([[toast('def')]]);
                });

                it('should not be able to export for the module', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `📄os.addBotListener(thisBot, 'module', async (arg, bot, tag) => {
                                    export default "wrong";
                                    os.toast(123);
                                });`,
                                test: `@import value from ".hello"; os.toast('first:' + (value ?? 'correct'));`,
                                onClick: `@import value from ".module"; os.toast('second:' + value);`,
                                module: '📄export default "def";',
                            }),
                        })
                    );
                    await runtime.shout('test');
                    await runtime.shout('onClick');

                    await waitAsync();

                    // should not have called the listener when importing "module"
                    expect(events).toEqual([
                        [toast('first:correct')],
                        [toast('second:def')],
                    ]);
                });

                it('should support removing dynamic listeners from bots', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                hello: `@
                                const func = () => os.toast('clicked');
                                os.addBotListener(thisBot, 'onClick', func);
                                os.removeBotListener(thisBot, 'onClick', func);`,
                            }),
                        })
                    );
                    await runtime.shout('hello');
                    await runtime.shout('onClick');

                    await waitAsync();

                    expect(events).toEqual([]);
                });
            });
        });

        describe('resolveModule()', () => {
            it('should resolve modules based on system and tag', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def';`,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('module.library');

                expect(m).toMatchObject({
                    id: 'module.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should resolve the first module that exists from bots that have the same system', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            system: 'module',
                        }),
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def';`,
                        }),
                        test3: createBot('test3', {
                            system: 'module',
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('module.library');

                expect(m).toMatchObject({
                    id: 'module.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should resolve modules based on ID and tag if the bot does not have a system', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            library: `📄export const abc = 'def';`,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('🔗test2.library');

                expect(m).toMatchObject({
                    id: '🔗test2.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on the same bot by relative import', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module.component',
                            library: `📄export const abc = 'def';`,
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('.library', {
                    botId: 'test2',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'module.component.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on the same bot even if they dont have a system', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            library: `📄export const abc = 'def';`,
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('.library', {
                    botId: 'test2',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: '🔗test2.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on different bots by relative import', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module.component',
                            library: `📄export const abc = 'def';`,
                        }),
                        test1: createBot('test1', {
                            system: 'module.component',
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('.library', {
                    botId: 'test1',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'module.component.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on parent systems by relative import', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def';`,
                        }),
                        test1: createBot('test1', {
                            system: 'module.component',
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule(':library', {
                    botId: 'test1',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'module.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on grandparent systems by relative import', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def';`,
                        }),
                        test1: createBot('test1', {
                            system: 'module.component.child',
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('::library', {
                    botId: 'test1',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'module.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should be able to resolve modules on adjacent systems by relative import', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module.other',
                            library: `📄export const abc = 'def';`,
                        }),
                        test1: createBot('test1', {
                            system: 'module.component',
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule(':other.library', {
                    botId: 'test1',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'module.other.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should use dynamic imports on modules that are URLs', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            system: 'module.component',
                            test: 123,
                        }),
                    })
                );
                await waitAsync();

                runtime.dynamicImport = jest.fn().mockResolvedValue({
                    default: {
                        value: 123,
                    },
                });

                const m = await runtime.resolveModule('https://example.com', {
                    botId: 'test1',
                    tag: 'test',
                });

                expect(m).toMatchObject({
                    id: 'https://example.com',
                    url: 'https://example.com',
                });
            });

            it('should be able to resolve regular scripts as modules', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `@export const abc = 'def';`,
                        }),
                    })
                );
                await waitAsync();

                const m = await runtime.resolveModule('module.library');

                expect(m).toMatchObject({
                    id: 'module.library',
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it('should resolve a special module for the "casualos" module', async () => {
                const m = (await runtime.resolveModule(
                    'casualos'
                )) as ExportsModule;
                expect(m.id).toBe('casualos');
                expect(Object.keys(m.exports)).toMatchSnapshot();
            });

            it('should be able to resolve tag-specific API functions when given import metadata', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {}),
                    })
                );
                await waitAsync();
                const m = (await runtime.resolveModule('casualos', {
                    botId: 'test2',
                    tag: null,
                })) as ExportsModule;
                expect(m.id).toBe('casualos');
                expect(Object.keys(m.exports)).toMatchSnapshot();

                expect(typeof m.exports.create).toBe('function');

                uuidMock.mockReturnValue('uuid');
                const b = m.exports.create({ abc: 'def' });

                expect(isRuntimeBot(b)).toBe(true);
                expect(b.id).toBe('uuid');
                expect(b.tags.creator).toBe('test2');
                expect(b.tags.abc).toBe('def');

                await waitAsync();

                expect(events).toEqual([
                    [
                        botAdded(
                            createBot('uuid', { creator: 'test2', abc: 'def' })
                        ),
                    ],
                ]);
            });

            describe('@onResolveModule', () => {
                it('should shout @onResolveModule if a system could not be found', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@os.toast(that); return { botId: 'test3', tag: 'library' };`,
                            }),
                            test3: createBot('test3', {
                                library: '📄export const abc = "def";',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        botId: 'test3',
                        tag: 'library',
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });

                it('should not shout @onResolveModule if attempting to resolve from inside a @onResolveModule', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@os.toast(that); return { botId: 'test3', tag: 'library' };`,
                            }),
                            test3: createBot('test3', {
                                library: '📄export const abc = "def";',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library', {
                        botId: 'random',
                        tag: ON_RESOLVE_MODULE,
                    });

                    await waitAsync();

                    expect(m === null).toBe(true);
                    expect(events).toEqual([]);
                });

                it('should not shout @onResolveModule for imports that @onResolveModule has', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@import { abc } from 'module.library'; os.toast(abc); return { botId: 'test4', tag: 'tag' };`,
                            }),
                            test3: createBot('test3', {
                                system: 'module',
                                library: '📄export const abc = "def";',
                            }),
                            test4: createBot('test4', {
                                tag: '📄export const num = 123;',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('custom.module');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'custom.module',
                        botId: 'test4',
                        tag: 'tag',
                    });
                    expect(events).toEqual([[toast('def')]]);
                });

                it('should not shout @onResolveModule when using import.meta.resolve()', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@const resolved = await import.meta.resolve('module.library'); os.toast(resolved); return { botId: 'test4', tag: 'tag' };`,
                            }),
                            test3: createBot('test3', {
                                system: 'module',
                                library: '📄export const abc = "def";',
                            }),
                            test4: createBot('test4', {
                                tag: '📄export const num = 123;',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('custom.module');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'custom.module',
                        botId: 'test4',
                        tag: 'tag',
                    });
                    expect(events).toEqual([
                        [
                            toast({
                                id: 'module.library',
                                botId: 'test3',
                                tag: 'library',
                            }),
                        ],
                    ]);
                });

                it('should include import metadata in the shout', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@os.toast(that); return { botId: 'test3', tag: 'library' };`,
                            }),
                            test3: createBot('test3', {
                                library: '📄export const abc = "def";',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library', {
                        botId: 'test99',
                        tag: 'custom',
                    });

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        botId: 'test3',
                        tag: 'library',
                    });

                    expect(events).toEqual([
                        [
                            toast({
                                module: 'module.library',
                                meta: { botId: 'test99', tag: 'custom' },
                            }),
                        ],
                    ]);
                });

                it('should support resolving modules with a promise', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); os.toast(that); return { botId: 'test3', tag: 'library' };`,
                            }),
                            test3: createBot('test3', {
                                library: '📄export const abc = "def";',
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        botId: 'test3',
                        tag: 'library',
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });

                it('should support resolving a module with a script', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); os.toast(that); return '📄export default 123;';`,
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        source: '📄export default 123;',
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });

                it('should support resolving a module with a URL', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); os.toast(that); return 'https://example.com';`,
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        url: 'https://example.com',
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });

                it('should support resolving a module with direct exports', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); os.toast(that); return { exports: { abc: 'def', ghi: 123 } };`,
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        exports: {
                            abc: 'def',
                            ghi: 123,
                        },
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });

                it('should prefer @onResolveModule over the system tag', async () => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test2: createBot('test2', {
                                onResolveModule: `@await Promise.resolve(0); os.toast(that); return '📄export default 123;';`,
                            }),
                            test3: createBot('test3', {
                                system: 'module',
                                library: `📄export const abc = 'def';`,
                            }),
                        })
                    );
                    await waitAsync();

                    const m = await runtime.resolveModule('module.library');

                    await waitAsync();

                    expect(m).toMatchObject({
                        id: 'module.library',
                        source: '📄export default 123;',
                    });

                    expect(events).toEqual([
                        [toast({ module: 'module.library' })],
                    ]);
                });
            });

            it('should call the given export function for exports', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def';`,
                        }),
                    })
                );
                await waitAsync();

                const m = (await runtime.resolveModule(
                    'module.library'
                )) as IdentifiedBotModule;

                expect(m?.id).toBe('module.library');
                expect(m?.botId).toBe('test2');
                expect(m?.tag).toBe('library');

                const imp = jest.fn();
                const exp = jest.fn();

                const bot = runtime.currentState[m.botId];
                const mod = bot.modules[m.tag];
                await mod.moduleFunc(imp, exp);

                expect(exp).toHaveBeenCalledWith(
                    {
                        abc: 'def',
                    },
                    undefined,
                    {
                        botId: 'test2',
                        tag: 'library',
                    }
                );
            });

            it('should resolve with the returned value from the function', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄export const abc = 'def'; return 123;`,
                        }),
                    })
                );
                await waitAsync();

                const m = (await runtime.resolveModule(
                    'module.library'
                )) as IdentifiedBotModule;

                expect(m?.id).toBe('module.library');
                expect(m?.botId).toBe('test2');
                expect(m?.tag).toBe('library');

                const imp = jest.fn();
                const exp = jest.fn();
                const bot = runtime.currentState[m.botId];
                const mod = bot.modules[m.tag];
                const result = await mod.moduleFunc(imp, exp);
                expect(result).toBe(123);

                expect(exp).toHaveBeenCalledWith(
                    {
                        abc: 'def',
                    },
                    undefined,
                    {
                        botId: 'test2',
                        tag: 'library',
                    }
                );
            });

            it('should call the given import function when importing something', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            system: 'module',
                            library: `📄import { abc } from "test"; return abc;`,
                        }),
                    })
                );
                await waitAsync();

                const m = (await runtime.resolveModule(
                    'module.library'
                )) as IdentifiedBotModule;

                expect(m?.id).toBe('module.library');
                expect(m?.botId).toBe('test2');
                expect(m?.tag).toBe('library');

                const imp = jest.fn(async (name) => {
                    if (name === 'test') {
                        return {
                            abc: 'def',
                        };
                    }
                });
                const exp = jest.fn();
                const bot = runtime.currentState[m.botId];
                const mod = bot.modules[m.tag];
                const result = await mod.moduleFunc(imp as any, exp);
                expect(result).toBe('def');

                expect(imp).toHaveBeenCalledWith('test', {
                    botId: 'test2',
                    tag: 'library',
                });
            });

            it.skip('should be able to resolve modules based on system quickly', async () => {
                let state: PartialPrecalculatedBotsState = {};
                for (let i = 0; i < 1000; i++) {
                    state[`test${i}`] = createBot(`test${i}`, {
                        system: 'module.' + i,
                        library: `📄export const abc = 'def${i}';`,
                    });
                }
                runtime.stateUpdated(stateUpdatedEvent(state));
                await waitAsync();

                const startTime = Date.now();
                for (let i = 0; i < 10000; i++) {
                    const m = await runtime.resolveModule('module.999.library');

                    expect(m).toMatchObject({
                        id: 'module.999.library',
                        botId: 'test999',
                        tag: 'library',
                    });
                }
                const endTime = Date.now();

                // Each resolve should take less than 0.5 milliseconds on average
                expect(endTime - startTime).toBeLessThan(5000);
            });
        });

        describe('dna tags', () => {
            const jsonPrimitiveCases = [
                ['strings', '"abc"', 'abc'],
                ['true', 'true', true],
                ['false', 'false', false],
                ['integer numbers', '123456', 123456],
                ['floating point numbers', '123.456', 123.456],
                ['null', 'null', undefined as any],
            ];

            it.each(jsonPrimitiveCases)(
                'should support %s',
                (desc, json, expected) => {
                    const update = runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: `${DNA_TAG_PREFIX}${json}`,
                            }),
                        })
                    );

                    expect(update).toEqual({
                        state: {
                            test: createPrecalculatedBot(
                                'test',
                                {
                                    abc: expected,
                                },
                                {
                                    abc: `${DNA_TAG_PREFIX}${json}`,
                                }
                            ),
                        },
                        addedBots: ['test'],
                        removedBots: [],
                        updatedBots: [],
                        version: null,
                    });
                }
            );

            it('should support simple JSON objects', () => {
                const data = {
                    abc: 'def',
                    bool: true,
                    num: 123,
                    obj: null as any,
                };
                const update = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: `${DNA_TAG_PREFIX}${JSON.stringify(data)}`,
                        }),
                    })
                );

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                abc: data,
                            },
                            {
                                abc: `${DNA_TAG_PREFIX}${JSON.stringify(data)}`,
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                    version: null,
                });
            });

            it('should be an error if the JSON is invalid', () => {
                const update = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: `${DNA_TAG_PREFIX}{`,
                        }),
                    })
                );

                expect(update).toEqual({
                    state: {
                        test: createPrecalculatedBot(
                            'test',
                            {
                                abc: expect.any(String),
                            },
                            {
                                abc: `${DNA_TAG_PREFIX}{`,
                            }
                        ),
                    },
                    addedBots: ['test'],
                    removedBots: [],
                    updatedBots: [],
                    version: null,
                });
            });
        });

        describe('listeners', () => {
            it('should return the listener script for precalculated bots', () => {
                const update = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            onClick: '@123',
                        }),
                    })
                );

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
                    version: null,
                });

                const bot = runtime.currentState['test'];
                const listener = bot.listeners.onClick;

                expect(listener).toBeInstanceOf(Function);
            });

            it('should be able to set a listener override', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            onClick: '@123',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const func = () => {
                    return 456;
                };
                bot.script.listeners.onClick = func;

                const listener = bot.listenerOverrides.onClick;

                expect(listener === func).toBe(true);

                const result = bot.script.onClick();

                expect(result).toBe(456);
            });
        });

        describe('edit modes', () => {
            // The delayed realtime edit mode disallows
            // edits from being immediately observed in the realtime space.
            describe('delayed', () => {
                it('should delay updates for bots that are in a space that is delayed', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot(
                                'test1',
                                {
                                    update: `@
                                tags.value = 123;
                                // value is not updated to 123 because
                                // the update is delayed
                                os.toast(tags.value);
                            `,
                                },
                                <any>'delayed'
                            ),
                        })
                    );
                    await runtime.shout('update');

                    await waitAsync();

                    expect(allEvents).toEqual([
                        // value should not have been updated
                        toast(undefined),

                        // but it should emit a bot update
                        // so the partition can choose to propagate it.
                        botUpdated('test1', {
                            tags: {
                                value: 123,
                            },
                        }),
                    ]);
                });

                it('should delay creation of bots that are in a space that is delayed', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                create: `@
                                let b = create({ space: 'delayed', value: 123 });
                                expect(b).toBe(null);
                            `,
                            }),
                        })
                    );
                    const result = await runtime.shout('create');

                    await waitAsync();

                    expect(result.errors).toEqual([]);
                    expect(allEvents).toEqual([
                        botAdded(
                            createBot(
                                'uuid',
                                {
                                    value: 123,
                                },
                                <any>'delayed'
                            )
                        ),
                    ]);
                });

                it('should delay deletion of bots that are in a space that is delayed', async () => {
                    uuidMock.mockReturnValue('uuid');
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test1: createBot('test1', {
                                delete: `@
                                let b1 = getBot('id', 'test2');
                                destroy('test2');
                                let b2 = getBot('id', 'test2');
                                expect(b1).toEqual(b2);
                            `,
                            }),
                            test2: createBot(
                                'test2',
                                {
                                    value: 123,
                                },
                                <any>'delayed'
                            ),
                        })
                    );
                    const result = await runtime.shout('delete');

                    await waitAsync();

                    expect(result.errors).toEqual([]);
                    expect(allEvents).toEqual([botRemoved('test2')]);
                });
            });

            it('should use updated edit modes from the given edit mode map', async () => {
                let map = new Map<BotSpace, RealtimeEditMode>([
                    ['shared', RealtimeEditMode.Immediate],
                    [<any>'delayed', RealtimeEditMode.Delayed],
                ]);
                let provider = new DefaultRealtimeEditModeProvider(map);
                runtime = new AuxRuntime(
                    version,
                    auxDevice,
                    undefined,
                    provider
                );
                runtime.onActions.subscribe((a) => events.push(a));

                uuidMock
                    .mockReturnValueOnce('uuid')
                    .mockReturnValueOnce('uuid2');
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            create: `@
                            let b = create({ space: 'delayed', value: 123 });
                            expect(b).toBe(null);
                        `,
                            create2: `@
                            let b = create({ space: 'delayed', value: 123 });
                            expect(b).not.toBe(null);
                        `,
                        }),
                    })
                );
                const result = await runtime.shout('create');

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

                const result2 = await runtime.shout('create2');

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
                runtime = new AuxRuntime(
                    version,
                    auxDevice,
                    undefined,
                    provider
                );
                runtime.onActions.subscribe((a) => {
                    allEvents.push(...a);
                });

                uuidMock
                    .mockReturnValueOnce('uuid')
                    .mockReturnValueOnce('uuid2');
                provider.getEditMode
                    .mockReturnValueOnce(RealtimeEditMode.Delayed)
                    .mockReturnValueOnce(RealtimeEditMode.Immediate);
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            create: `@
                            let b = create({ space: 'delayed', value: 123 });
                            expect(b).toBe(null);
                        `,
                            create2: `@
                            let b = create({ space: 'delayed', value: 123 });
                            expect(b).not.toBe(null);
                        `,
                        }),
                    })
                );
                const result = await runtime.shout('create');

                await waitAsync();

                expect(result.errors).toEqual([]);
                expect(allEvents).toEqual([
                    botAdded(
                        createBot(
                            'uuid',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ]);

                const result2 = await runtime.shout('create2');

                await waitAsync();

                expect(result2.errors).toEqual([]);
                expect(allEvents.slice(1)).toEqual([
                    botAdded(
                        createBot(
                            'uuid2',
                            {
                                value: 123,
                            },
                            <any>'delayed'
                        )
                    ),
                ]);
            });
        });

        describe('errors', () => {
            it('should emit errors that occur in scripts', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            onClick: '@throw new Error("abc")',
                        }),
                    })
                );

                await runtime.shout('onClick');

                await waitAsync();

                expect(allErrors).toEqual([
                    expect.objectContaining({
                        error: expect.any(Error),
                        bot: expect.objectContaining(
                            createBot('test', {
                                onClick: '@throw new Error("abc")',
                            })
                        ),
                        tag: 'onClick',
                    }),
                ]);
            });
        });

        describe('updateTag()', () => {
            it('should set the tag value on the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', 99);

                expect(bot.tags.abc).toEqual(99);
                expect(bot.values.abc).toEqual(99);
                expect(runtime.getValue(bot, 'abc')).toEqual(99);
            });

            it('should be able to remove the tag by setting it to null', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', null);

                expect(bot.tags.abc).toBeUndefined();
                expect(bot.values.abc).toBeUndefined();
                expect(runtime.getValue(bot, 'abc')).toBeUndefined();
            });

            it('should support tag edits', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(
                    bot,
                    'abc',
                    edit({}, preserve(1), insert('1'), del(1))
                );

                expect(bot.tags.abc).toEqual('d1f');
                expect(bot.values.abc).toEqual('d1f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d1f');
            });

            it('should support setting the tag after editing it', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(
                    bot,
                    'abc',
                    edit({}, preserve(1), insert('1'), del(1))
                );

                expect(bot.tags.abc).toEqual('d1f');
                expect(bot.values.abc).toEqual('d1f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d1f');

                runtime.updateTag(bot, 'abc', 'def');

                expect(bot.tags.abc).toEqual('def');
                expect(bot.values.abc).toEqual('def');
                expect(runtime.getValue(bot, 'abc')).toEqual('def');
            });

            it('should not apply a tag edit multiple times when it is recieved back from the partition', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const e = edit({}, preserve(1), del(1), insert('123456'));

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', e);

                expect(bot.tags.abc).toEqual('d123456f');
                expect(bot.values.abc).toEqual('d123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d123456f');

                const result = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: e,
                            },
                        },
                    })
                );

                expect(result).toEqual({
                    state: {
                        test: {
                            tags: {
                                abc: e,
                            },
                            values: {
                                abc: 'd123456f',
                            },
                        },
                    },
                    updatedBots: ['test'],
                    addedBots: [],
                    removedBots: [],
                    version: null,
                });
                expect(bot.tags.abc).toEqual('d123456f');
                expect(bot.values.abc).toEqual('d123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d123456f');
            });

            it('should not apply a tag edit multiple times when an edit was applied to a null tag', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const e = edit({}, preserve(1), del(1), insert('a123456'));

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', e);

                expect(bot.tags.abc).toEqual('a123456');
                expect(bot.values.abc).toEqual('a123456');
                expect(runtime.getValue(bot, 'abc')).toEqual('a123456');

                const result = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            tags: {
                                abc: e,
                            },
                        },
                    })
                );

                expect(result).toEqual({
                    state: {
                        test: {
                            tags: {
                                abc: e,
                            },
                            values: {
                                abc: 'a123456',
                            },
                        },
                    },
                    updatedBots: ['test'],
                    addedBots: [],
                    removedBots: [],
                    version: null,
                });
                expect(bot.tags.abc).toEqual('a123456');
                expect(bot.values.abc).toEqual('a123456');
                expect(runtime.getValue(bot, 'abc')).toEqual('a123456');
            });

            it('should support setting a tag to a DateTime', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTag(
                    bot,
                    'abc',
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );

                await waitAsync();

                expect(bot.tags.abc).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );
                expect(bot.values.abc).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );
                expect(runtime.getValue(bot, 'abc')).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('📅2021-03-05T11:12:13Z');
            });

            it('should support setting a tag to a Vector2', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTag(bot, 'abc', new Vector2(1, 2));

                await waitAsync();

                expect(bot.tags.abc).toEqual(new Vector2(1, 2));
                expect(bot.values.abc).toEqual(new Vector2(1, 2));
                expect(runtime.getValue(bot, 'abc')).toEqual(new Vector2(1, 2));

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('➡️1,2');
            });

            it('should support setting a tag to a Vector3', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTag(
                    bot,
                    'abc',
                    new Vector3(1, 2, 3)
                );

                await waitAsync();

                expect(bot.tags.abc).toEqual(new Vector3(1, 2, 3));
                expect(bot.values.abc).toEqual(new Vector3(1, 2, 3));
                expect(runtime.getValue(bot, 'abc')).toEqual(
                    new Vector3(1, 2, 3)
                );

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('➡️1,2,3');
            });

            it('should support setting a tag to a Rotation', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTag(bot, 'abc', new Rotation());

                await waitAsync();

                expect(bot.tags.abc).toEqual(new Rotation());
                expect(bot.values.abc).toEqual(new Rotation());
                expect(runtime.getValue(bot, 'abc')).toEqual(new Rotation());

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('🔁0,0,0,1');
            });

            it('should support multiple tag edits in a row', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                let bot = runtime.currentState['test'];
                runtime.updateTag(
                    bot,
                    'abc',
                    edit({}, preserve(1), insert('123456'), del(1))
                );

                expect(bot.tags.abc).toEqual('d123456f');
                expect(bot.values.abc).toEqual('d123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d123456f');

                bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', edit({}, preserve(0), del(1)));

                expect(bot.tags.abc).toEqual('123456f');
                expect(bot.values.abc).toEqual('123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('123456f');
            });

            it('should support creating a listener in a tag', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', '@return 55 + 9');

                expect(bot.tags.abc).toEqual('@return 55 + 9');
                expect(bot.values.abc).toEqual('@return 55 + 9');
                expect(bot.listeners.abc).toBeInstanceOf(Function);

                const listener = runtime.getListener(bot, 'abc');
                expect(listener).toBeInstanceOf(Function);

                expect(listener!(undefined, bot.script, 'abc')).toEqual(55 + 9);
            });

            it('should support setting a tag to null to clear the listener', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: '@return 55 + 9',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTag(bot, 'abc', null);

                expect(bot.tags.abc).toBeUndefined();
                expect(bot.values.abc).toBeUndefined();
                expect(bot.listeners.abc).toBeUndefined();

                const listener = runtime.getListener(bot, 'abc');
                expect(listener).toEqual(null);
            });

            it('should throw an error when setting the tag value to a bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const bot2 = runtime.context.state['test2'];

                expect(() => {
                    runtime.updateTag(bot, 'abc', bot2);
                }).toThrow();
            });
        });

        describe('updateTagMask()', () => {
            it('should set the tag value on the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTagMask(bot, 'abc', ['tempLocal'], 99);

                expect(bot.masks.tempLocal.abc).toEqual(99);
                expect(bot.values.abc).toEqual(99);
                expect(runtime.getValue(bot, 'abc')).toEqual(99);
            });

            it('should support setting a tag to a DateTime', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );

                await waitAsync();

                expect(bot.masks.tempLocal.abc).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );
                expect(bot.values.abc).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );
                expect(runtime.getValue(bot, 'abc')).toEqual(
                    DateTime.utc(2021, 3, 5, 11, 12, 13)
                );

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('📅2021-03-05T11:12:13Z');
            });

            it('should support setting a tag to a Vector2', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    new Vector2(1, 2)
                );

                await waitAsync();

                expect(bot.masks.tempLocal.abc).toEqual(new Vector2(1, 2));
                expect(bot.values.abc).toEqual(new Vector2(1, 2));
                expect(runtime.getValue(bot, 'abc')).toEqual(new Vector2(1, 2));

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('➡️1,2');
            });

            it('should support setting a tag to a Vector3', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    new Vector3(1, 2, 3)
                );

                await waitAsync();

                expect(bot.masks.tempLocal.abc).toEqual(new Vector3(1, 2, 3));
                expect(bot.values.abc).toEqual(new Vector3(1, 2, 3));
                expect(runtime.getValue(bot, 'abc')).toEqual(
                    new Vector3(1, 2, 3)
                );

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('➡️1,2,3');
            });

            it('should support setting a tag to a Rotation', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const config = runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    new Rotation()
                );

                await waitAsync();

                expect(bot.masks.tempLocal.abc).toEqual(new Rotation());
                expect(bot.values.abc).toEqual(new Rotation());
                expect(runtime.getValue(bot, 'abc')).toEqual(new Rotation());

                // It should return that the changed value should be formatted
                expect(config.changedValue).toEqual('🔁0,0,0,1');
            });

            it('should throw an error when setting the tag value to a bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                        test2: createBot('test2', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const bot2 = runtime.context.state['test2'];

                expect(() => {
                    runtime.updateTagMask(bot, 'abc', ['tempLocal'], bot2);
                }).toThrow();
            });

            it('should support tag edits', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                tempLocal: {
                                    abc: 'def',
                                },
                            },
                        },
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    edit({}, preserve(1), insert('1'), del(1))
                );

                expect(bot.masks.tempLocal.abc).toEqual('d1f');
                expect(bot.values.abc).toEqual('d1f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d1f');
            });

            it('should support setting the tag after editing it', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                tempLocal: {
                                    abc: 'def',
                                },
                            },
                        },
                    })
                );

                const bot = runtime.currentState['test'];
                runtime.updateTagMask(
                    bot,
                    'abc',
                    ['tempLocal'],
                    edit({}, preserve(1), insert('1'), del(1))
                );

                expect(bot.masks.tempLocal.abc).toEqual('d1f');
                expect(bot.values.abc).toEqual('d1f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d1f');

                runtime.updateTagMask(bot, 'abc', ['tempLocal'], 'def');

                expect(bot.masks.tempLocal.abc).toEqual('def');
                expect(bot.values.abc).toEqual('def');
                expect(runtime.getValue(bot, 'abc')).toEqual('def');
            });

            it('should not apply a tag edit multiple times when it is recieved back from the partition', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                tempLocal: {
                                    abc: 'def',
                                },
                            },
                        },
                    })
                );

                const e = edit({}, preserve(1), del(1), insert('123456'));

                const bot = runtime.currentState['test'];
                runtime.updateTagMask(bot, 'abc', ['tempLocal'], e);

                expect(bot.masks.tempLocal.abc).toEqual('d123456f');
                expect(bot.values.abc).toEqual('d123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d123456f');

                const result = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                tempLocal: {
                                    abc: e,
                                },
                            },
                        },
                    })
                );

                expect(result).toEqual({
                    state: {
                        test: {
                            tags: {},
                            masks: {
                                tempLocal: {
                                    abc: e,
                                },
                            },
                            values: {
                                abc: 'd123456f',
                            },
                        },
                    },
                    updatedBots: ['test'],
                    addedBots: [],
                    removedBots: [],
                    version: null,
                });
                expect(bot.masks.tempLocal.abc).toEqual('d123456f');
                expect(bot.values.abc).toEqual('d123456f');
                expect(runtime.getValue(bot, 'abc')).toEqual('d123456f');
            });

            it('should not apply a tag edit multiple times when an edit was applied to a null tag', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const e = edit({}, preserve(1), del(1), insert('a123456'));

                const bot = runtime.currentState['test'];
                runtime.updateTagMask(bot, 'abc', ['tempLocal'], e);

                expect(bot.masks.tempLocal.abc).toEqual('a123456');
                expect(bot.values.abc).toEqual('a123456');
                expect(runtime.getValue(bot, 'abc')).toEqual('a123456');

                const result = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                tempLocal: {
                                    abc: e,
                                },
                            },
                        },
                    })
                );

                expect(result).toEqual({
                    state: {
                        test: {
                            tags: {},
                            masks: {
                                tempLocal: {
                                    abc: e,
                                },
                            },
                            values: {
                                abc: 'a123456',
                            },
                        },
                    },
                    updatedBots: ['test'],
                    addedBots: [],
                    removedBots: [],
                    version: null,
                });
                expect(bot.masks.tempLocal.abc).toEqual('a123456');
                expect(bot.values.abc).toEqual('a123456');
                expect(runtime.getValue(bot, 'abc')).toEqual('a123456');
            });
        });

        describe('getTagMask()', () => {
            it('should get the tag mask value from the bot', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: {
                            masks: {
                                [TEMPORARY_BOT_PARTITION_ID]: {
                                    test: 123,
                                },
                            },
                        },
                    })
                );

                const bot = runtime.currentState['test'];
                const value = runtime.getTagMask(bot, 'test');

                expect(value).toBe(123);
            });

            const noConvertValueCases = [
                ['string', 'abc'] as const,
                ['string as number', '123'] as const,
                ['string as true', 'true'] as const,
                ['string as false', 'false'] as const,
                ['string as true', 'true'] as const,
                ['number', 123] as const,
                ['boolean', 456] as const,
                ['object', { hello: 123 }] as const,
                ['array', [123, 'hello']] as const,
                ['undefined', undefined as any] as const,
            ];

            it.each(noConvertValueCases)(
                'should not convert %s',
                (desc, value) => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    [TEMPORARY_BOT_PARTITION_ID]: {
                                        test: value,
                                    },
                                },
                            },
                        })
                    );

                    const bot = runtime.currentState['test'];
                    const result = runtime.getTagMask(bot, 'test');

                    expect(result).toBe(value);
                }
            );

            const convertCases = [
                [
                    'string as tagged string',
                    `${STRING_TAG_PREFIX}abc`,
                    'abc',
                ] as const,
                [
                    'string as tagged number',
                    `${NUMBER_TAG_PREFIX}123`,
                    123,
                ] as const,
                [
                    'string as DNA true tag',
                    `${DNA_TAG_PREFIX}true`,
                    true,
                ] as const,
                [
                    'string as DNA false tag',
                    `${DNA_TAG_PREFIX}false`,
                    false,
                ] as const,
                [
                    'string as DNA number tag',
                    `${DNA_TAG_PREFIX}123`,
                    123,
                ] as const,
                [
                    'string as DNA object tag',
                    `${DNA_TAG_PREFIX}{ "hello": true }`,
                    { hello: true },
                ] as const,
                [
                    'string as DNA array tag',
                    `${DNA_TAG_PREFIX}[123, "hello"]`,
                    [123, 'hello'],
                ] as const,
                [
                    'string as date tag',
                    formatBotDate(DateTime.utc(2023, 2, 15, 2, 3, 4, 5)),
                    DateTime.utc(2023, 2, 15, 2, 3, 4, 5),
                ] as const,
                [
                    'string as Vector2 tag',
                    formatBotVector(new Vector2(1, 2)),
                    new Vector2(1, 2),
                ] as const,
                [
                    'string as Vector3 tag',
                    formatBotVector(new Vector3(1, 2, 3)),
                    new Vector3(1, 2, 3),
                ] as const,
                [
                    'string as Rotation tag',
                    formatBotRotation(new Rotation(new Quaternion(1, 2, 3, 1))),
                    new Rotation(new Quaternion(1, 2, 3, 1)),
                ] as const,
                ['null to undefined', null as any, undefined as any] as const,
            ];

            it.each(convertCases)(
                'should convert %s',
                (desc, given, expected) => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    [TEMPORARY_BOT_PARTITION_ID]: {
                                        test: given,
                                    },
                                },
                            },
                        })
                    );

                    const bot = runtime.currentState['test'];
                    const value1 = runtime.getTagMask(bot, 'test');
                    const value2 = runtime.getTagMask(bot, 'test');

                    expect(value1).toEqual(expected);
                    expect(value1 === value2).toBe(true);
                }
            );

            const invalidCases = [
                ['JSON', `${DNA_TAG_PREFIX}{ "wrong": 123 `],
                ['dates', `${DATE_TAG_PREFIX}wrong`],
                ['numbers', `${NUMBER_TAG_PREFIX}not a number`],
                ['vectors', `${VECTOR_TAG_PREFIX}not a vector`],
                ['rotations', `${ROTATION_TAG_PREFIX}not a rotation`],
            ];

            it.each(invalidCases)(
                'should properly handle invalid %s',
                (desc, value) => {
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                abc: 'def',
                            }),
                        })
                    );

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: {
                                masks: {
                                    [TEMPORARY_BOT_PARTITION_ID]: {
                                        test: value,
                                    },
                                },
                            },
                        })
                    );

                    const bot = runtime.currentState['test'];
                    const result = runtime.getTagMask(bot, 'test');

                    expect(result).toEqual(value);
                }
            );
        });

        describe('getListener()', () => {
            it('should not create a key on the bot tags when getting a listener that does not exist', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const bot = runtime.currentState['test'];
                const listener = runtime.getListener(bot, 'missing');

                expect(listener).toEqual(null);
                expect(Object.keys(bot.tags)).toEqual([]);
                expect(Object.keys(bot.values)).toEqual([]);
                expect(tagsOnBot(bot)).toEqual([]);
                expect(runtime.getValue(bot, 'missing')).toBeUndefined();
            });

            it('should return the listener for the bot', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            hello: '@os.toast("def");',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const listener = runtime.getListener(bot, 'hello');

                expect(!!listener).toBe(true);

                listener!(undefined, bot.script, 'hello');

                await waitAsync();

                expect(events).toEqual([[toast('def')]]);
            });

            it('listeners should be able to import modules', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            hello: '@import { abc } from ".mod"; os.toast(abc);',
                            mod: '@export const abc = "def";',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const listener = runtime.getListener(bot, 'hello');

                expect(!!listener).toBe(true);

                listener!(undefined, bot.script, 'hello');

                await waitAsync();

                expect(events).toEqual([[toast('def')]]);
            });

            it('should return the override first', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            hello: '@os.toast("def");',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const func = () => {
                    runtime.context.enqueueAction(toast('other'));
                };
                runtime.setListener(bot, 'hello', func);

                const listener = runtime.getListener(bot, 'hello');

                expect(!!listener).toBe(true);
                expect(listener === func).toBe(true);

                listener!(undefined, bot.script, 'hello');

                await waitAsync();

                expect(events).toEqual([[toast('other')]]);
            });
        });

        describe('setListener()', () => {
            it('should set a listener override on the bot', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            hello: '@os.toast("def");',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const func = () => {
                    runtime.context.enqueueAction(toast('other'));
                };
                runtime.setListener(bot, 'hello', func);

                expect(bot.listenerOverrides.hello === func).toBe(true);

                const result = await runtime.shout('hello', [bot.id]);

                await waitAsync();

                expect(result.actions).toEqual([toast('other')]);
                expect(events).toEqual([[toast('other')]]);
            });

            it('should be able to clear a listener override by setting it to null', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            hello: '@os.toast("def");',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const func = () => {
                    runtime.context.enqueueAction(toast('other'));
                };
                runtime.setListener(bot, 'hello', func);
                runtime.setListener(bot, 'hello', null);

                expect(bot.listenerOverrides.hello).toBeUndefined();

                const result = await runtime.shout('hello', [bot.id]);

                await waitAsync();

                expect(result.actions).toEqual([toast('def')]);
                expect(events).toEqual([[toast('def')]]);
            });
        });

        describe('addDynamicListener()', () => {
            it('should add a dynamic listener to the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);

                expect(b.dynamicListeners.abc).toBeDefined();
                const listeners = b.dynamicListeners.abc;
                expect(listeners.length).toBe(1);
                expect(listeners[0] === listener).toBe(true);
            });

            it('should add the bot to the list of listeners for the tag', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);

                const ids = runtime.context.getBotIdsWithListener('abc');
                expect(ids).toEqual(['test']);
            });

            it('should do nothing if the listener has already been added to the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);
                runtime.addDynamicListener(b, 'abc', listener);

                expect(b.dynamicListeners.abc).toBeDefined();
                const listeners = b.dynamicListeners.abc;
                expect(listeners.length).toBe(1);
                expect(listeners[0] === listener).toBe(true);
            });
        });

        describe('removeDynamicListener()', () => {
            it('should remove a dynamic listener from the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                const listener2: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);
                runtime.addDynamicListener(b, 'abc', listener2);
                runtime.removeDynamicListener(b, 'abc', listener);

                expect(b.dynamicListeners.abc).toBeDefined();
                const listeners = b.dynamicListeners.abc;
                expect(listeners.length).toBe(1);
                expect(listeners[0] === listener2).toBe(true);
            });

            it('should remove the bot from the list of listeners for the tag', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);
                runtime.removeDynamicListener(b, 'abc', listener);

                const ids = runtime.context.getBotIdsWithListener('abc');
                expect(ids).toEqual([]);
            });

            it('should do nothing if the listener was not on the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                runtime.removeDynamicListener(b, 'abc', listener);

                expect(b.dynamicListeners).not.toHaveProperty('abc');
            });
        });

        describe('getDynamicListeners()', () => {
            it('should return the dynamic listeners for the bot', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];

                const listener: DynamicListener = jest.fn();
                const listener2: DynamicListener = jest.fn();
                runtime.addDynamicListener(b, 'abc', listener);
                runtime.addDynamicListener(b, 'abc', listener2);

                const listeners = runtime.getDynamicListeners(b, 'abc');

                expect(listeners).toBeDefined();
                expect(listeners!.length).toBe(2);
                expect(listeners![0] === listener).toBe(true);
                expect(listeners![1] === listener2).toBe(true);
            });

            it('should return null if the bot has no dynamic listeners', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {}),
                    })
                );

                const b = runtime.currentState['test'];
                const listeners = runtime.getDynamicListeners(b, 'abc');

                expect(listeners).toBeNull();
            });
        });

        describe('getTagLink()', () => {
            it('should return undefined if the bot link doesnt exist', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const link = runtime.getTagLink(bot, 'abc');

                expect(link).toBeUndefined();
            });

            it('should return the bot that was linked to', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: '🔗test2',
                        }),
                        test2: createBot('test2', {}),
                    })
                );

                const bot = runtime.currentState['test'];
                const link = runtime.getTagLink(bot, 'abc');

                expect(link).toBe(runtime.context.state['test2']);
            });

            it('should return the array of bots that were linked to', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: '🔗test2,test3,test4',
                        }),
                        test2: createBot('test2', {}),
                        test3: createBot('test3', {}),
                        test4: createBot('test4', {}),
                    })
                );

                const bot = runtime.currentState['test'];
                const link = runtime.getTagLink(bot, 'abc') as RuntimeBot[];

                expect(Array.isArray(link)).toBe(true);
                expect(link.length).toBe(3);
                expect(link[0]).toBe(runtime.context.state['test2']);
                expect(link[1]).toBe(runtime.context.state['test3']);
                expect(link[2]).toBe(runtime.context.state['test4']);
            });

            it('should return null if the linked bot does not exist', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: '🔗test2',
                        }),
                    })
                );

                const bot = runtime.currentState['test'];
                const link = runtime.getTagLink(bot, 'abc');

                expect(link).toBe(null);
            });

            it('should include null if a linked bot in an array does not exist', () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            abc: '🔗test2,test3',
                        }),
                        test2: createBot('test2', {}),
                    })
                );

                const bot = runtime.currentState['test'];
                const link = runtime.getTagLink(bot, 'abc') as RuntimeBot[];

                expect(Array.isArray(link)).toBe(true);
                expect(link.length).toBe(2);
                expect(link[0]).toBe(runtime.context.state['test2']);
                expect(link[1]).toBe(null);
            });
        });

        describe('unsubscribe()', () => {
            beforeAll(() => {
                jest.useFakeTimers({});
            });

            afterEach(() => {
                jest.clearAllTimers();
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            it('should cancel any scheduled tasks', () => {
                const test = jest.fn();
                runtime = new AuxRuntime(
                    version,
                    auxDevice,
                    (context) =>
                        merge(createDefaultLibrary(context), {
                            api: {
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

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            start: '@setInterval(() => { test() }, 100)',
                        }),
                    })
                );
                runtime.shout('start');

                jest.advanceTimersByTime(200);

                expect(test).toBeCalledTimes(2);

                runtime.unsubscribe();

                jest.advanceTimersByTime(200);

                expect(test).toBeCalledTimes(2);
            });
        });

        describe('os.createDebugger()', () => {
            it('should return a promise that resolves with an object that contains library functions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@return os.createDebugger();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');

                expect(isPromise(result.results[0])).toBe(true);

                const debug = await result.results[0];
                expect(typeof debug).toBe('object');
            });

            it('should use fake UUIDs', async () => {
                uuidMock.mockReturnValueOnce('myUUID');
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); return d.uuid();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');

                expect(isPromise(result.results[0])).toBe(true);
                expect(await result.results[0]).toBe('uuid-1');
            });

            it('should use real UUIDs when specified', async () => {
                uuidMock
                    .mockReturnValueOnce('configBotId')
                    .mockReturnValueOnce('myUUID');
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger({ useRealUUIDs: true }); return d.uuid();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                expect(await result.results[0]).toBe('myUUID');
            });

            it('should be able to create bots in the debugger', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); d.create({ color: 'red' }); return d.getAllActions();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([
                    // fake UUIDs for bots
                    botAdded(
                        createBot('uuid-1', {
                            color: 'red',
                        })
                    ),
                ]);
            });

            it('should be able to get actions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); d.os.toast("abc"); return d.getAllActions();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([toast('abc')]);
            });

            it('should be able to update new bots', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ color: 'red' }); b.tags.num = 123; return d.getAllActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            color: 'red',
                            num: 123,
                        })
                    ),
                ]);
            });

            it('should be able to shout in the debugger', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: '@os.toast("hello")' }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            test: '@os.toast("hello")',
                        })
                    ),
                    toast('hello'),
                ]);
            });

            it('should be able to get only common actions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: '@os.toast("hello")' }); d.shout('test'); return d.getCommonActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([toast('hello')]);
            });

            it('should be able to get only bot actions', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: '@os.toast("hello")' }); d.shout('test'); return d.getBotActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let updates = await result.results[0];
                expect(updates).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            test: '@os.toast("hello")',
                        })
                    ),
                ]);
            });

            it('should be able to get errors', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: '@throw new Error("abc");' }); d.shout('test'); return d.getErrors()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let errors = await result.results[0];
                expect(errors).toEqual([
                    {
                        bot: expect.any(Object),
                        tag: 'test',
                        error: new Error('abc'),
                    },
                ]);
            });

            it('should make async listeners synchronous if specified', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@await 123; throw new Error("abc")',
                            test: `@let d = await os.createDebugger({ allowAsynchronousScripts: false }); let b = d.create({ test: tags.error }); d.shout('test'); return d.getErrors()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let errors = await result.results[0];
                expect(errors).toEqual([
                    {
                        bot: expect.any(Object),
                        tag: 'test',
                        error: new Error('abc'),
                    },
                ]);
            });

            it('should allow async listeners by default', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@await 123; throw new Error("abc")',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return d.getErrors()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let errors = await result.results[0];

                // error does not get listed because it doesn't get caught by d.shout()
                // because it is wrapped in a promise
                expect(errors).toEqual([]);
            });

            it('should define variables for builtin portals', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@gridPortalBot.tags.hit = true;',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                runtime.process([registerBuiltinPortal('gridPortal')]);

                const result = await runtime.shout('test');
                let actions = await result.results[0];

                expect(actions).toEqual([
                    botAdded(
                        createBot('uuid-2', {
                            test: '@gridPortalBot.tags.hit = true;',
                        })
                    ),
                    botUpdated('uuid-1', {
                        tags: {
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should not define variables for custom portals', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@tags.hasBot = typeof testPortalBot !== "undefined";',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                runtime.process([defineGlobalBot('testPortal', 'test')]);

                const result = await runtime.shout('test');
                let actions = await result.results[0];

                expect(actions).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            hasBot: false,
                            test: '@tags.hasBot = typeof testPortalBot !== "undefined";',
                        })
                    ),
                ]);
            });

            it('should define a configBot', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@configBot.tags.hit = true;',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let actions = await result.results[0];

                expect(actions).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            test: '@configBot.tags.hit = true;',
                        })
                    ),
                    botUpdated('uuid-0', {
                        tags: {
                            hit: true,
                        },
                    }),
                ]);
            });

            it('should be able to create the configBot with specific tags', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@action.perform(configBot.tags.abc)',
                            test: `@let d = await os.createDebugger({
                                configBot: {
                                    abc: 'def'
                                }
                            }); let b = d.create({ test: tags.error }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let actions = await result.results[0];

                expect(actions).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            test: '@action.perform(configBot.tags.abc)',
                        })
                    ),
                    'def',
                ]);
            });

            it('should be able to create the configBot with another bot', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        other: createBot('other', {
                            abc: 'def',
                        }),
                        test: createBot('test', {
                            error: '@action.perform(configBot.tags.abc)',
                            test: `@let d = await os.createDebugger({
                                configBot: getBot('id', 'other')
                            }); let b = d.create({ test: tags.error }); d.shout('test'); return d.getAllActions()`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                let actions = await result.results[0];

                expect(actions).toEqual([
                    botAdded(
                        createBot('uuid-1', {
                            test: '@action.perform(configBot.tags.abc)',
                        })
                    ),
                    'def',
                ]);
            });

            it('should allow setting globalThis variables without affecting everything else', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@globalThis.testValue = 123;',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return globalThis.testValue;`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                expect(await result.results[0]).toBeUndefined();
            });

            it('should allow defining globalThis properties without affecting everything else', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            error: '@Object.defineProperty(globalThis, "testValue", { value: 42, writable: false });',
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: tags.error }); d.shout('test'); return globalThis.testValue;`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                expect(await result.results[0]).toBeUndefined();
            });

            describe('onBeforeUserAction()', () => {
                it('should call the listener when an action is sent through the process() function', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                d.onBeforeUserAction((a) => {
                                    action.perform({ myAction: a });
                                });

                                await d.shout('onShout');

                                return d;
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await waitAsync();

                    const debug: DebuggerInterface = await result.results[0];
                    const r = debug[GET_RUNTIME]();

                    r.process([
                        {
                            type: 'test_action',
                        } as any,
                    ]);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: { type: 'test_action' },
                            },
                        ],
                    ]);
                });
            });

            describe('onScriptActionEnqueued()', () => {
                it('should be able to call the given function after an action is enqueued', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@os.toast("Hello"); bot.tags.tagValue = 123;'
                                });

                                d.onScriptActionEnqueued((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                await d.shout('onShout');
                                action.perform({ tagValue: b.tags.tagValue });
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: toast('Hello'),
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                tagValue: 123,
                            },
                        ],
                    ]);
                });
            });

            describe('onAfterScriptUpdatedTag()', () => {
                it('should be able to call the given function after a tag is updated', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@os.toast("Hello"); bot.tags.tagValue = 123;'
                                });

                                d.onAfterScriptUpdatedTag((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                action.perform({ tagValue: b.tags.tagValue });
                                await d.shout('onShout');
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'tagValue',
                                    oldValue: 'abc',
                                    newValue: 123,
                                },
                                tagValue: 123,
                            },
                        ],
                    ]);
                });
            });

            describe('onAfterScriptUpdatedTagMask()', () => {
                it('should be able to call the given function after a tag is updated', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    onShout: '@os.toast("Hello"); bot.masks.tagValue = 123;'
                                });

                                d.onAfterScriptUpdatedTagMask((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                action.perform({ tagValue: b.masks.tagValue });
                                await d.shout('onShout');
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                tagValue: undefined,
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'tagValue',
                                    oldValue: undefined,
                                    newValue: 123,
                                    space: 'tempLocal',
                                },
                                tagValue: 123,
                            },
                        ],
                    ]);
                });
            });

            describe('getCallStack()', () => {
                it('should throw an error if using a non-pausable debugger', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({});
                                
                                const callStack = d.getCallStack();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.results.length).toBe(1);

                    let error: ScriptError = null;
                    try {
                        await Promise.all(result.results);
                    } catch (err) {
                        error = err;
                    }

                    expect(error !== null).toBe(true);
                    expect(error.error).toEqual(
                        new Error(
                            'getCallStack() is only supported on pausable debuggers.'
                        )
                    );
                });

                it('should return the current call stack for the debugger', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });
                                
                                let b = await d.create({
                                    onShout: '@os.toast("Hello"); bot.masks.tagValue = 123;'
                                });

                                d.onScriptActionEnqueued((a) => {
                                    action.perform({ myAction: a, callStack: d.getCallStack() });
                                });

                                await d.shout('onShout');
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events.length).toBe(1);
                    expect(events[0].length).toBe(1);
                    const event = events[0][0] as any;

                    expect(event.myAction).toEqual(toast('Hello'));
                    expect(event.callStack).toMatchSnapshot();
                });
            });

            describe('performUserAction()', () => {
                it('should allow performing an action as if a user performed it themselves', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();

                                d.onBeforeUserAction((a) => {
                                    action.perform({ myAction: a });
                                });

                                d.performUserAction({
                                    test: true
                                });
                                `,
                            }),
                        })
                    );

                    await runtime.shout('test');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: { test: true },
                            },
                        ],
                    ]);
                });

                it('should support executing async results in response to async requests', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                let b = await d.create({
                                    onShout: '@let result = await os.showInput(""); os.toast(result);'
                                })

                                d.onScriptActionEnqueued(a => {
                                    if ('taskId' in a) {
                                        d.performUserAction({
                                            type: 'async_result',
                                            taskId: a.taskId,
                                            result: 123
                                        });
                                    } else {
                                        action.perform({ myAction: a });
                                    }
                                });

                                await d.shout('onShout');
                                `,
                            }),
                        })
                    );

                    await runtime.shout('test');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: toast(123),
                            },
                        ],
                    ]);
                });

                it('should return a promise that resolves with the action results', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();

                                const b = await d.create({
                                    onShout: '@return 123;'
                                });

                                // d.onBeforeUserAction((a) => {
                                //     action.perform({ myAction: a });
                                // });

                                const results = await d.performUserAction({
                                    test: true
                                }, { type: 'action', eventName: 'onShout', botIds: [b.id] });

                                action.perform({ results: results });
                                `,
                            }),
                        })
                    );

                    await runtime.shout('test');

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                results: [null, [123]],
                            },
                        ],
                    ]);
                });
            });

            describe.skip('onBeforeScriptEnter()', () => {
                it('should call the given function before a script is entered', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@shout("otherShout");',
                                    otherShout: '@bot.tags.tagValue = 123;'
                                });

                                d.onBeforeScriptEnter((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                await d.shout('onShout');
                                action.perform({ tagValue: b.tags.tagValue });
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    enterType: 'call',
                                },
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    enterType: 'call',
                                },
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                tagValue: 123,
                            },
                        ],
                    ]);
                });

                it('should call the given function before a script is re-entered from a promise when using a pausable debugger', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@bot.otherShout();',
                                    otherShout: '@await Promise.resolve(); bot.tags.tagValue = 123;'
                                });

                                d.onBeforeScriptEnter((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                const results = await d.shout('onShout');
                                action.perform({ tagValue: b.tags.tagValue });

                                // await Promise.all(results);

                                // b.vars.resolve();

                                await Promise.resolve();

                                action.perform({ tagValue: b.tags.tagValue });
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    enterType: 'call',
                                },
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    enterType: 'call',
                                },
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    enterType: 'task',
                                },
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                tagValue: 123,
                            },
                        ],
                    ]);
                });
            });

            describe.skip('onAfterScriptExit()', () => {
                it('should call the given function after a script returns', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger();
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@shout("otherShout");',
                                    otherShout: '@bot.tags.tagValue = 123;'
                                });

                                d.onAfterScriptExit((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                action.perform({ tagValue: b.tags.tagValue });
                                await d.shout('onShout');
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    exitType: 'return',
                                },
                                tagValue: 123,
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    exitType: 'return',
                                },
                                tagValue: 123,
                            },
                        ],
                    ]);
                });

                it('should call the given function after a script exits because of waiting for a promise', async () => {
                    if (type === 'interpreted') {
                        return;
                    }

                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });
                                
                                let b = await d.create({
                                    tagValue: 'abc',
                                    onShout: '@bot.otherShout();',
                                    otherShout: '@await Promise.resolve(); bot.tags.tagValue = 123;'
                                });

                                d.onAfterScriptExit((a) => {
                                    action.perform({ myAction: a, tagValue: b.tags.tagValue });
                                });

                                action.perform({ tagValue: b.tags.tagValue });
                                const results = await d.shout('onShout');

                                // await Promise.all(results);

                                // b.vars.resolve();

                                await Promise.resolve();
                                action.perform({ tagValue: b.tags.tagValue });
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    await Promise.all(result.results);

                    await waitAsync();

                    expect(events).toEqual([
                        [
                            {
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    enterType: 'return',
                                },
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    exitType: 'return',
                                },
                                tagValue: 'abc',
                            },
                        ],
                        [
                            {
                                tagValue: 'abc',
                            },
                            {
                                myAction: {
                                    botId: 'uuid-1',
                                    tag: 'otherShout',
                                    enterType: 'return',
                                },
                                tagValue: 'abc',
                            },
                        ],
                    ]);
                });
            });

            describe('interpreter', () => {
                it('should be able to create a debugger that interprets scripts', async () => {
                    uuidMock.mockReturnValueOnce('trigger-id');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                d.onPause((pause) => {
                                    action.perform(pause);
                                    d.resume(pause);
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                const trigger = d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                await d.shout('onShout');

                                return {
                                    trigger: trigger,
                                    actions: d.getCommonActions()
                                };
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual({
                        trigger: {
                            triggerId: 'trigger-id',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['before'],
                        },
                        actions: [toast('Hello')],
                    });

                    expect(events.length).toBe(1);
                    expect(events[0].length).toBe(1);
                    expect(events[0][0]).toEqual({
                        pauseId: 1,
                        trigger: {
                            triggerId: 'trigger-id',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['before'],
                        },
                        state: 'before',
                        callStack: [
                            {
                                location: null,
                                listVariables: expect.any(Function),
                                setVariableValue: expect.any(Function),
                            },
                            {
                                location: {
                                    name: 'onShout',
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    lineNumber: 1,
                                    columnNumber: 1,
                                },
                                listVariables: expect.any(Function),
                                setVariableValue: expect.any(Function),
                            },
                        ],
                    });
                });

                it('should be able to update a pause trigger', async () => {
                    uuidMock.mockReturnValueOnce('trigger-id');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                d.onPause((pause) => {
                                    action.perform(pause);
                                    d.resume(pause);
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                const trigger = d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                trigger.states = ['after'];

                                d.setPauseTrigger(trigger);

                                await d.shout('onShout');

                                return {
                                    trigger: trigger,
                                    actions: d.getCommonActions()
                                };
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual({
                        trigger: {
                            triggerId: 'trigger-id',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['after'],
                        },
                        actions: [toast('Hello')],
                    });

                    expect(events.length).toBe(1);
                    expect(events[0].length).toBe(1);
                    expect(events[0][0]).toEqual({
                        pauseId: 1,
                        trigger: {
                            triggerId: 'trigger-id',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['after'],
                        },
                        state: 'after',
                        result: undefined,
                        callStack: [
                            {
                                location: null,
                                listVariables: expect.any(Function),
                                setVariableValue: expect.any(Function),
                            },
                            {
                                location: {
                                    name: 'onShout',
                                    botId: 'uuid-1',
                                    tag: 'onShout',
                                    lineNumber: 1,
                                    columnNumber: 1,
                                },
                                listVariables: expect.any(Function),
                                setVariableValue: expect.any(Function),
                            },
                        ],
                    });
                });

                it('should be able clear a pause trigger', async () => {
                    uuidMock.mockReturnValueOnce('trigger-id');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                d.onPause((pause) => {
                                    action.perform(pause);
                                    d.resume(pause);
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                d.removePauseTrigger('trigger-id');

                                await d.shout('onShout');

                                return d.getCommonActions();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult.length).toBe(1);
                    expect(finalResult[0].type).toBe('show_toast');
                    expect(finalResult[0]).toEqual(toast('Hello'));

                    expect(events.length).toBe(0);
                });

                it('should be able to list pause triggers', async () => {
                    uuidMock
                        .mockReturnValueOnce('trigger-1')
                        .mockReturnValueOnce('trigger-2');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['after']
                                });

                                return d.listPauseTriggers();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual([
                        {
                            triggerId: 'trigger-1',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['before'],
                            enabled: true,
                        },
                        {
                            triggerId: 'trigger-2',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['after'],
                            enabled: true,
                        },
                    ]);

                    expect(events.length).toBe(0);
                });

                it('should be able to disable pause triggers', async () => {
                    uuidMock
                        .mockReturnValueOnce('trigger-1')
                        .mockReturnValueOnce('trigger-2');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                d.disablePauseTrigger('trigger-1');

                                return d.listPauseTriggers();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual([
                        {
                            triggerId: 'trigger-1',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['before'],
                            enabled: false,
                        },
                    ]);

                    expect(events.length).toBe(0);
                });

                it('should be able to re-enable pause triggers', async () => {
                    uuidMock
                        .mockReturnValueOnce('trigger-1')
                        .mockReturnValueOnce('trigger-2');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                let b = await d.create({
                                    onShout: '@os.toast("Hello")'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 1,
                                    states: ['before']
                                });

                                d.disablePauseTrigger('trigger1');
                                d.enablePauseTrigger('trigger1');

                                return d.listPauseTriggers();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual([
                        {
                            triggerId: 'trigger-1',
                            botId: 'uuid-1',
                            tag: 'onShout',
                            lineNumber: 1,
                            columnNumber: 1,
                            states: ['before'],
                            enabled: true,
                        },
                    ]);

                    expect(events.length).toBe(0);
                });

                it('should be able to list variables ', async () => {
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                d.onPause((pause) => {
                                    debugger;
                                    action.perform(pause.callStack[1].listVariables());
                                    d.resume(pause);
                                });

                                let b = await d.create({
                                    onShout: '@let abc = 123; const cool = true; os.toast("Hello"); let other = "def";'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 35,
                                    states: ['before']
                                });

                                await d.shout('onShout');

                                return d.getCommonActions();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult.length).toBe(1);
                    expect(finalResult[0].type).toBe('show_toast');
                    expect(finalResult[0]).toEqual(toast('Hello'));

                    expect(events.length).toBe(1);
                    expect(events[0].length).toBe(1);

                    const variables =
                        events[0][0] as unknown as DebuggerVariable[];

                    const localVariables = variables.filter(
                        (v) => v.scope === 'block'
                    );
                    expect(localVariables).toEqual([
                        {
                            name: 'abc',
                            value: 123,
                            scope: 'block',
                            writable: true,
                        },
                        {
                            name: 'cool',
                            value: true,
                            scope: 'block',
                            writable: false,
                        },
                        {
                            name: 'other',
                            value: undefined,
                            scope: 'block',
                            writable: true,
                            initialized: false,
                        },
                    ]);

                    const frameVariables = variables.filter(
                        (v) => v.scope === 'frame'
                    );
                    expect(frameVariables.map((v) => v.name)).toMatchSnapshot();

                    const closureVariables = variables.filter(
                        (v) => v.scope === 'closure'
                    );
                    expect(
                        closureVariables.map((v) => v.name)
                    ).toMatchSnapshot();
                });

                it('should be able to set variable values', async () => {
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                d.onPause((pause) => {
                                    debugger;
                                    pause.callStack[1].setVariableValue('abc', 555);
                                    d.resume(pause);
                                });

                                let b = await d.create({
                                    onShout: '@let abc = 123; os.toast(abc);'
                                });

                                d.setPauseTrigger(b, 'onShout', {
                                    lineNumber: 1,
                                    columnNumber: 16,
                                    states: ['before']
                                });

                                await d.shout('onShout');

                                return d.getCommonActions();
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult.length).toBe(1);
                    expect(finalResult[0].type).toBe('show_toast');
                    expect(finalResult[0]).toEqual(toast(555));
                });

                it('should be able to list common trigger locations', async () => {
                    uuidMock
                        .mockReturnValueOnce('trigger-1')
                        .mockReturnValueOnce('trigger-2');
                    if (type === 'interpreted') {
                        return;
                    }
                    runtime.stateUpdated(
                        stateUpdatedEvent({
                            test: createBot('test', {
                                test: `@let d = await os.createDebugger({
                                    pausable: true
                                });

                                let b = await d.create({
                                    onShout: '@let abc = 123; os.toast("Hello")'
                                });

                                return d.listCommonPauseTriggers(b, 'onShout');
                                `,
                            }),
                        })
                    );

                    const result = await runtime.shout('test');

                    expect(result.errors).toEqual([]);
                    expect(result.results.length).toBe(1);
                    expect(isPromise(result.results[0])).toBe(true);

                    const finalResult: any[] = await result.results[0];

                    expect(finalResult).toEqual([
                        {
                            lineNumber: 1,
                            columnNumber: 1,
                            possibleStates: ['after'],
                        },
                        {
                            lineNumber: 1,
                            columnNumber: 16,
                            possibleStates: ['before', 'after'],
                        },
                    ]);

                    expect(events.length).toBe(0);
                });

                // describe('onTraceEvent()', () => {
                //     it('should be able to call the given function after some code is executed', async () => {
                //         if (type === 'interpreted') {
                //             return;
                //         }

                //         runtime.stateUpdated(
                //             stateUpdatedEvent({
                //                 test: createBot('test', {
                //                     test: `@let d = await os.createDebugger({
                //                         pausable: true
                //                     });

                //                     let b = await d.create({
                //                         onShout: '@os.toast("Hello")'
                //                     });

                //                     d.onTraceEvent((e) => {
                //                         action.perform({ myEvent: e });
                //                     });

                //                     await d.shout('onShout');
                //                     `,
                //                 }),
                //             })
                //         );

                //         const result = await runtime.shout('test');

                //         await Promise.all(result.results);

                //         await waitAsync();

                //         expect(events).toEqual([
                //             [
                //                 {
                //                     myEvent: {
                //                         type: 'script_enter',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                     }
                //                 },
                //                 {
                //                     myEvent: {
                //                         type: 'script_exit',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                         exitType: 'return'
                //                     }
                //                 }
                //             ]
                //         ]);
                //     });

                //     it('should be able to call the given function after each part of an async script is executed', async () => {
                //         if (type === 'interpreted') {
                //             return;
                //         }

                //         runtime.stateUpdated(
                //             stateUpdatedEvent({
                //                 test: createBot('test', {
                //                     test: `@let d = await os.createDebugger({
                //                         pausable: true
                //                     });

                //                     let b = await d.create({
                //                         onShout: '@os.toast("First"); await new Promise((resolve) => bot.vars.resolve = resolve); os.toast("Fourth");'
                //                     });

                //                     d.onTraceEvent((e) => {
                //                         action.perform({ myEvent: e });
                //                     });

                //                     let results = await d.shout('onShout');

                //                     action.perform(os.toast("Second"));
                //                     b.vars.resolve();
                //                     action.perform(os.toast("Third"));

                //                     await Promise.all(results);
                //                     `,
                //                 }),
                //             })
                //         );

                //         const result = await runtime.shout('test');

                //         await Promise.all(result.results);

                //         await waitAsync();

                //         expect(events).toEqual([
                //             [
                //                 {
                //                     myEvent: {
                //                         type: 'script_enter',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                     }
                //                 },
                //                 {
                //                     myEvent: {
                //                         type: 'script_exit',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                     }
                //                 },
                //                 toast('Second'),
                //                 toast("Third"),
                //                 {
                //                     myEvent: {
                //                         type: 'script_enter',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                     }
                //                 },
                //                 {
                //                     myEvent: {
                //                         type: 'script_exit',
                //                         botId: 'uuid-0',
                //                         tag: 'onShout',
                //                     }
                //                 },
                //             ]
                //         ]);
                //     });
                // });
            });

            it('should be able to get the runtime for the debugger', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@return os.createDebugger();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');

                expect(isPromise(result.results[0])).toBe(true);

                const debug = await result.results[0];
                expect(typeof debug).toBe('object');

                const runF = debug[GET_RUNTIME];
                expect(typeof runF === 'function').toBe(true);

                const run = runF();
                expect(run).toBeInstanceOf(AuxRuntime);
                expect(run === runtime).toBe(false);
            });
        });

        describe('os.getExecutingDebugger()', () => {
            it('should return null when this script is not running inside a debugger', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@return os.getExecutingDebugger();`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                expect(result.results[0]).toBe(null);
            });

            it('should return the debugger object that is in use', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test: createBot('test', {
                            test: `@let d = await os.createDebugger(); let b = d.create({ test: '@action.perform(os.getExecutingDebugger())' }); d.shout('test'); return d.getAllActions()[1] === d`,
                        }),
                    })
                );

                const result = await runtime.shout('test');
                expect(await result.results[0]).toBe(true);
            });
        });
    });

    describe('debugging', () => {
        let memory: MemoryPartition;
        let runtime: AuxRuntime;
        let events: RuntimeActions[][];
        let allEvents: RuntimeActions[];
        let errors: ScriptError[][];
        let allErrors: ScriptError[];
        let stops: RuntimeStop[];
        let version: AuxVersion;
        let auxDevice: AuxDevice;
        let interpreter: Interpreter;

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
                alpha: true,
                playerMode: 'builder',
            };
            auxDevice = {
                supportsAR: false,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'bootstrap',
            };

            interpreter = new Interpreter();
            interpreter.debugging = true;

            runtime = new AuxRuntime(
                version,
                auxDevice,
                undefined,
                new DefaultRealtimeEditModeProvider(
                    new Map<BotSpace, RealtimeEditMode>([
                        ['shared', RealtimeEditMode.Immediate],
                        [<any>'delayed', RealtimeEditMode.Delayed],
                    ])
                ),
                undefined,
                undefined,
                interpreter
            );

            events = [];
            allEvents = [];
            errors = [];
            allErrors = [];
            stops = [];

            runtime.onActions.subscribe((a) => {
                events.push(a);
                allEvents.push(...a);
            });
            runtime.onErrors.subscribe((e) => {
                errors.push(e);
                allErrors.push(...e);
            });

            runtime.onRuntimeStop.subscribe((stop) => {
                stops.push(stop);
            });
        });

        describe('shout()', () => {
            it('should support debugging shouts', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@os.toast("Hello!"); return 99;',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                await waitAsync();

                const result = runtime.shout('test');

                expect(isPromise(result)).toBe(true);

                let final: ActionResult = null;
                (result as Promise<ActionResult>).then((r) => {
                    final = r;
                });

                expect(stops.length).toBe(1);

                expect(events).toEqual([]);

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(final.results).toEqual([99]);
                expect(events).toEqual([[toast('Hello!')]]);
            });

            it('should serialize shouts that happen concurrently', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test1: '@os.toast("Hello test1!"); return 99;',
                            test2: '@os.toast("Hello test2!"); return 101;',
                        }),
                    })
                );

                await waitAsync();

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test1',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                const result1 = runtime.shout('test1');
                const result2 = runtime.shout('test2');

                expect(isPromise(result1)).toBe(true);
                expect(isPromise(result2)).toBe(true);

                expect(stops.length).toBe(1);
                expect(events).toEqual([]);

                let final1: ActionResult = null;
                (result1 as Promise<ActionResult>).then((r) => (final1 = r));

                let final2: ActionResult = null;
                (result2 as Promise<ActionResult>).then((r) => (final2 = r));

                await waitAsync();

                expect(final1 === null).toBe(true);
                expect(final2 === null).toBe(true);

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(final1.actions).toEqual([toast('Hello test1!')]);
                expect(final2.actions).toEqual([toast('Hello test2!')]);
                expect(events).toEqual([
                    [toast('Hello test1!')],
                    [toast('Hello test2!')],
                ]);
            });

            it('should execute onAnyBotsAdded events synchronously when there is a breakpoint in one of them', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            [ON_ANY_BOTS_ADDED_ACTION_NAME]:
                                '@os.toast("Hello " + that.bots[0].id);',
                        }),
                    })
                );

                await waitAsync();

                expect(events).toEqual([[toast('Hello test1')]]);
                events.splice(0, events.length);

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: ON_ANY_BOTS_ADDED_ACTION_NAME,
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                const result1 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            num: 123,
                        }),
                    })
                );
                const result2 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test3: createBot('test3', {
                            abc: 'def',
                        }),
                    })
                );

                expect(result1).toEqual(
                    stateUpdatedEvent({
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                    })
                );
                expect(result2).toEqual(
                    stateUpdatedEvent({
                        test3: createPrecalculatedBot('test3', {
                            abc: 'def',
                        }),
                    })
                );

                await waitAsync();

                expect(stops.length).toBe(1);
                expect(stops[0].breakpoint.botId).toBe('test1');
                expect(stops[0].breakpoint.tag).toBe(
                    ON_ANY_BOTS_ADDED_ACTION_NAME
                );
                expect(stops[0].stopId).toBe(1);
                expect(events).toEqual([]);

                await waitAsync();

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(stops.length).toBe(2);
                expect(stops[1].breakpoint.botId).toBe('test1');
                expect(stops[1].breakpoint.tag).toBe(
                    ON_ANY_BOTS_ADDED_ACTION_NAME
                );
                expect(stops[1].stopId).toBe(2);
                expect(events).toEqual([[toast('Hello test2')]]);

                runtime.continueAfterStop(stops[1].stopId);

                await waitAsync();

                expect(events).toEqual([
                    [toast('Hello test2')],
                    [toast('Hello test3')],
                ]);
            });

            it('should execute onAnyBotsChanged events synchronously when there is a breakpoint in one of them', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            [ON_ANY_BOTS_CHANGED_ACTION_NAME]:
                                '@os.toast("Hello " + that[0].tags[0]);',
                        }),
                    })
                );

                await waitAsync();

                expect(events).toEqual([]);

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: ON_ANY_BOTS_CHANGED_ACTION_NAME,
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                const result1 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                abc: 'def',
                            },
                        },
                    })
                );
                const result2 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                num: 123,
                            },
                        },
                    })
                );

                expect(result1).toEqual(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                abc: 'def',
                            },
                            values: {
                                abc: 'def',
                            },
                        },
                    })
                );
                expect(result2).toEqual(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                num: 123,
                            },
                            values: {
                                num: 123,
                            },
                        },
                    })
                );

                await waitAsync();

                expect(stops.length).toBe(1);
                expect(stops[0].breakpoint.botId).toBe('test1');
                expect(stops[0].breakpoint.tag).toBe(
                    ON_ANY_BOTS_CHANGED_ACTION_NAME
                );
                expect(stops[0].stopId).toBe(1);
                expect(events).toEqual([]);

                await waitAsync();

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(stops.length).toBe(2);
                expect(stops[1].breakpoint.botId).toBe('test1');
                expect(stops[1].breakpoint.tag).toBe(
                    ON_ANY_BOTS_CHANGED_ACTION_NAME
                );
                expect(stops[1].stopId).toBe(2);
                expect(events).toEqual([[toast('Hello abc')]]);

                runtime.continueAfterStop(stops[1].stopId);

                await waitAsync();

                expect(events).toEqual([
                    [toast('Hello abc')],
                    [toast('Hello num')],
                ]);
            });

            it('should execute onAnyBotsRemoved events synchronously when there is a breakpoint in one of them', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            [ON_ANY_BOTS_REMOVED_ACTION_NAME]:
                                '@os.toast("Hello " + that.botIDs[0]);',
                        }),
                    })
                );

                await waitAsync();

                expect(events).toEqual([]);

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: ON_ANY_BOTS_REMOVED_ACTION_NAME,
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                const result1 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: createBot('test2', {
                            num: 123,
                        }),
                        test3: createBot('test3', {
                            abc: 'def',
                        }),
                    })
                );
                const result2 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test2: null,
                    })
                );
                const result3 = runtime.stateUpdated(
                    stateUpdatedEvent({
                        test3: null,
                    })
                );

                expect(result1).toEqual(
                    stateUpdatedEvent({
                        test2: createPrecalculatedBot('test2', {
                            num: 123,
                        }),
                        test3: createPrecalculatedBot('test3', {
                            abc: 'def',
                        }),
                    })
                );
                expect(result2).toEqual(
                    stateUpdatedEvent({
                        test2: null,
                    })
                );
                expect(result3).toEqual(
                    stateUpdatedEvent({
                        test3: null,
                    })
                );

                await waitAsync();

                expect(stops.length).toBe(1);
                expect(stops[0].breakpoint.botId).toBe('test1');
                expect(stops[0].breakpoint.tag).toBe(
                    ON_ANY_BOTS_REMOVED_ACTION_NAME
                );
                expect(stops[0].stopId).toBe(1);
                expect(events).toEqual([]);

                await waitAsync();

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(stops.length).toBe(2);
                expect(stops[1].breakpoint.botId).toBe('test1');
                expect(stops[1].breakpoint.tag).toBe(
                    ON_ANY_BOTS_REMOVED_ACTION_NAME
                );
                expect(stops[1].stopId).toBe(2);
                expect(events).toEqual([[toast('Hello test2')]]);

                runtime.continueAfterStop(stops[1].stopId);

                await waitAsync();

                expect(events).toEqual([
                    [toast('Hello test2')],
                    [toast('Hello test3')],
                ]);
            });

            it('should update breakpoints when the script is updated', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@os.toast("Hello!"); return 99;',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                test: '@os.toast("Hello Changed!"); return 1000;',
                            },
                        },
                    })
                );

                await waitAsync();

                const result = runtime.shout('test');

                expect(isPromise(result)).toBe(true);

                let final: ActionResult = null;
                (result as Promise<ActionResult>).then((r) => {
                    final = r;
                });

                expect(stops.length).toBe(1);

                expect(events).toEqual([]);

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(final.results).toEqual([1000]);
                expect(events).toEqual([[toast('Hello Changed!')]]);
            });

            it('should remove breakpoints when the script is removed', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@os.toast("Hello!"); return 99;',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: {
                            tags: {
                                test: null,
                            },
                        },
                    })
                );

                await waitAsync();

                expect(interpreter.breakpoints.length).toEqual(0);
            });

            it('should remove breakpoints when the bot is removed', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@os.toast("Hello!"); return 99;',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: null,
                    })
                );

                await waitAsync();

                expect(interpreter.breakpoints.length).toEqual(0);
            });

            it('should be able to pause in @onCreate scripts', async () => {
                uuidMock.mockReturnValueOnce('test2');

                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@create({ onCreate: "@shout(\'duringCreate\')" }); return 99;',
                            duringCreate: '@os.toast("Hello!");',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'duringCreate',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                await waitAsync();

                const result = runtime.shout('test');

                expect(isPromise(result)).toBe(true);

                let final: ActionResult = null;
                (result as Promise<ActionResult>).then((r) => {
                    final = r;
                });

                await waitAsync();

                expect(stops.length).toBe(1);
                expect(stops[0].breakpoint.botId).toBe('test1');
                expect(stops[0].breakpoint.tag).toBe('duringCreate');
                expect(stops[0].stopId).toBe(1);

                expect(events).toEqual([]);

                runtime.continueAfterStop(stops[0].stopId);

                await waitAsync();

                expect(final.results).toEqual([99]);
                expect(events).toEqual([
                    [
                        botAdded(
                            createBot('test2', {
                                creator: 'test1',
                                onCreate: "@shout('duringCreate')",
                            })
                        ),
                        toast('Hello!'),
                    ],
                ]);
            });

            it('should be able to remove breakpoints', async () => {
                runtime.stateUpdated(
                    stateUpdatedEvent({
                        test1: createBot('test1', {
                            test: '@os.toast("Hello!"); return 99;',
                        }),
                    })
                );

                runtime.setBreakpoint({
                    id: 'breakpoint-1',
                    botId: 'test1',
                    tag: 'test',
                    lineNumber: 1,
                    columnNumber: 1,
                    states: ['before'],
                });

                runtime.removeBreakpoint('breakpoint-1');

                await waitAsync();

                const result = runtime.shout('test');

                expect(isPromise(result)).toBe(true);

                let final: ActionResult = null;
                (result as Promise<ActionResult>).then((r) => {
                    final = r;
                });

                await waitAsync();

                expect(stops.length).toBe(0);
                expect(events).toEqual([[toast('Hello!')]]);
            });
        });
    });
});

function calculateActionResults(
    state: BotsState,
    action: ShoutAction,
    device?: AuxDevice,
    version?: AuxVersion
): ActionResult {
    const runtime = new AuxRuntime(version, device);
    runtime.stateUpdated(stateUpdatedEvent(state));
    runtime.userId = action.userId;
    const result = runtime.shout(
        action.eventName,
        action.botIds,
        action.argument
    );

    runtime.unsubscribe();

    return result as ActionResult;
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
                    num: `${DNA_TAG_PREFIX}123`,
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
                    num: `${DNA_TAG_PREFIX}123`,
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
                    num: 123,
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
                    formula: `${DNA_TAG_PREFIX}10`,
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
                    normal: `${DNA_TAG_PREFIX}10`,
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
                        raw.formula = '${DNA_TAG_PREFIX}10';
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
                    formula: `${DNA_TAG_PREFIX}10`,
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
                        tags.formula = '${DNA_TAG_PREFIX}10';
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
                    formula: `${DNA_TAG_PREFIX}10`,
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
                },
            ]);
        });

        it.skip('should include the line and column number that the error occurred at in the script', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: `@os.toast("abc")\nthrow new Error("abc")`,
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

    describe('creatorBot', () => {
        it('should pass in a creator variable which equals getBot("id", tags.creator)', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        creator: 'thatBot',
                        test: '@setTag(this, "creatorId", creatorBot.id)',
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
                        test: '@setTag(this, "hasCreator", creatorBot !== null)',
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
                        test: '@setTag(this, "hasCreator", creatorBot !== null)',
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

    describe('configBot', () => {
        it('should get the current users bot', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(configBot, "#name", "Test")',
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
    });

    describe('thisBot', () => {
        it('should pass in a thisBot variable which is the bot that is currently executing', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(thisBot, "runningTag", tagName)',
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

    describe('links', () => {
        it('should pass in a links variable which is bot.links', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        otherBot: createBotLink(['otherBot']),
                        test: '@setTag(links.otherBot, "hit", true)',
                    },
                },

                otherBot: {
                    id: 'otherBot',
                    tags: {},
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        hit: true,
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

    it('should preserve DNA tags when copying', () => {
        const state: BotsState = {
            thisBot: {
                id: 'thisBot',
                tags: {
                    _position: { x: 0, y: 0, z: 0 },
                    _workspace: 'abc',
                    num: 15,
                    formula: `${DNA_TAG_PREFIX}this.num`,
                    test: `@create({ creator: null }, this, that, { testFormula: "${DNA_TAG_PREFIX}this.name" });`,
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
                    formula: `${DNA_TAG_PREFIX}this.num`,
                    test: `@create({ creator: null }, this, that, { testFormula: "${DNA_TAG_PREFIX}this.name" });`,
                    name: 'Friend',
                    testFormula: `${DNA_TAG_PREFIX}this.name`,

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
                    abcdef: '@setTag(this, "#val", 10); setTag(this, "#nested.value", true)',
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
                    sayHello: '@setTag(this, "#userId", configBot.id)',
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
                    test: `@os.toast("hello")`,
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
                    test: `@os.toast("hello")`,
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', null, 'userBot');
        const events = calculateActionResults(state, botAction);
        expect(events.actions).toEqual([toast('hello')]);
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
                    test: '@os.toast("test"); // this is a test',
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
                    test: '@os.toast("test"); // comment 1\n// this is a test',
                },
            },
        };

        // specify the UUID to use next
        uuidMock.mockReturnValue('uuid-0');
        const botAction = action('test', ['thisBot'], 'userBot');
        const events = calculateActionResults(state, botAction);

        expect(events.actions).toEqual([toast('test')]);
    });

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
                        onAnyListen: `@os.toast('Hi!');`,
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
            ['null', null as any] as const,
            ['0', 0] as const,
            ['1', 1] as const,
            ['false', false] as const,
            ['true', true] as const,
            ['undefined', undefined as any] as const,
            ['*empty string*', ''] as const,
            ['*filled string*', 'a'] as const,
            ['*array buffer*', new ArrayBuffer(255)] as const,
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
                        test: '@that[0].tags.hi = "changed"; this.tags.l = that.length',
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
                        abcdef: `@action.perform(os.toast('abc'))`,
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
                            const toast = os.toast('abc');
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
            expect((<RejectAction>result.actions[0]).actions).toEqual([
                original,
            ]);
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
                        abcdef: '@let o = { other: getBot("#name", "other") }; shout("sayHello", o)',
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
                        abcdef: '@shout("sayHello", getBot("#name", "other")); setTag(this, "#value", getTag(getBot("#name", "other"), "#hello"))',
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
                        abcdef: '@let results = shout("sayHello", "test"); setTag(this, "result", results);',
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
                        abcdef: '@let results = whisper(["bBot", "aBot"], "sayHello", "test"); setTag(this, "result", results);',
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
                        create: '@let newBot = create({ creator: getID(this) }, { stay: "def", "leaveX": 0, "leaveY": 0 }); removeTags(newBot, "leave");',
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
                        create: '@let bots = getBots("abc", true); removeTags(bots, "abc");',
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
                        test: '@destroy(this); os.toast(getBot("abc", true));',
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

    describe('os.getDimensionalDepth()', () => {
        it('should return 0 when the bot is in the given dimension', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "depth", os.getDimensionalDepth("dimension"))',
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

        const portalCases = [...KNOWN_PORTALS.map((p) => [p])];

        it.each(portalCases)(
            'should return 1 when the dimension is in the %s portal',
            (portal) => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@setTag(this, "depth", os.getDimensionalDepth("dimension"))',
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
                        test: '@setTag(this, "depth", os.getDimensionalDepth("dimension"))',
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

    describe('player.getBot()', () => {});

    describe('os.replaceDragBot()', () => {
        it('should send a replace_drag_bot event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        abc: true,
                        test: '@os.replaceDragBot(this)',
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
                        test: '@os.replaceDragBot(this)',
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
                        test: '@applyMod(this, { abc: "def", ghi: true, num: 1 })',
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
                        test: '@applyMod(this, { abc: "def", ghi: true, num: 1 }, { abc: "xyz" });',
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
                        test: '@applyMod(this, { abc: "def", ghi: true, num: 1 }); applyMod(this, { "abc": getTag(this, "#abc") })',
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
                        test: '@applyMod(this, { abc: "def", ghi: true, num: 1 });',
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
                        test: '@setTag(this, "#dimension", os.getMenuDimension())',
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

    describe('os.toast()', () => {
        it('should emit a ShowToastAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.toast("hello, world!")',
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

    describe('os.showJoinCode()', () => {
        it('should emit a ShowJoinCodeEvent', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showJoinCode()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([showJoinCode()]);
        });

        it('should allow linking to a specific instance and dimension', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showJoinCode("instance", "dimension")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                showJoinCode('instance', 'dimension'),
            ]);
        });
    });

    describe('os.requestFullscreenMode()', () => {
        it('should issue a request_fullscreen action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.requestFullscreenMode()',
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

    describe('os.exitFullscreenMode()', () => {
        it('should issue a request_fullscreen action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.exitFullscreenMode()',
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

    describe('os.showHtml()', () => {
        it('should issue a show_html action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showHtml("hello, world!")',
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

    describe('os.hideHtml()', () => {
        it('should issue a hide_html action', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.hideHtml()',
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

    describe('os.setClipboard()', () => {
        it('should emit a SetClipboardEvent', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.setClipboard("test")',
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

    describe('os.tweenTo()', () => {
        it('should emit a FocusOnBotAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.tweenTo("test")',
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
                        test: '@os.tweenTo(this)',
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
                        test: '@os.tweenTo("test", undefined, undefined, undefined, 10)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                tweenTo('test', {
                    duration: 10,
                }),
            ]);
        });
    });

    describe('os.moveTo()', () => {
        it('should emit a FocusOnBotAction with the duration set to 0', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.moveTo("test")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([
                tweenTo('test', {
                    duration: 0,
                }),
            ]);
        });
    });

    describe('os.showChat()', () => {
        it('should emit a ShowChatBarAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showChat()',
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
                        test: '@os.showChat("test")',
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
                        test: `@os.showChat({
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

    describe('os.hideChat()', () => {
        it('should emit a ShowChatBarAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.hideChat()',
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

    describe('os.run()', () => {
        it('should emit a RunScriptAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.run("abc")',
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

    describe('os.version()', () => {
        it('should return an object with version information', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.version = os.version()',
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
                alpha: true,
                playerMode: 'builder',
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
                            alpha: true,
                            playerMode: 'builder',
                        },
                    },
                }),
            ]);
        });
    });

    describe('os.device()', () => {
        it('should return an object with device information', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@tags.device = os.device()',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction, {
                supportsAR: true,
                supportsVR: false,
                supportsDOM: false,
                isCollaborative: true,
                allowCollaborationUpgrade: true,
                ab1BootstrapUrl: 'bootstrap',
            });

            expect(result.actions).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        device: {
                            supportsAR: true,
                            supportsVR: false,
                            supportsDOM: false,
                            isCollaborative: true,
                            allowCollaborationUpgrade: true,
                            ab1BootstrapUrl: 'bootstrap',
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
                        test: '@tags.device = os.device()',
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
                            supportsDOM: null,
                            isCollaborative: null,
                            allowCollaborationUpgrade: null,
                            ab1BootstrapUrl: null,
                        },
                    },
                }),
            ]);
        });
    });

    describe('os.enableAR()', () => {
        it('should issue an EnableARAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.enableAR()',
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

    describe('os.disableAR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.disableAR()',
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

    describe('os.enableVR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.enableVR()',
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

    describe('os.disableVR()', () => {
        it('should issue an EnableVRAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.disableVR()',
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

    describe('os.downloadBots()', () => {
        it('should emit a DownloadAction with the given bots formatted as JSON', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.downloadBots(getBots(inDimension("abc")), "test")',
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
                        test: '@os.downloadBots(getBots(inDimension("abc")), "test.aux")',
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

    describe('os.showUploadAuxFile()', () => {
        it('should emit a showUploadAuxFileAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showUploadAuxFile()',
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

    describe('os.downloadServer()', () => {
        it('should emit a DownloadAction with the current state and server name', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.downloadServer()',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        inst: 'channel',
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
                        test: '@os.downloadServer()',
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
                        inst: 'channel',
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

    describe('os.downloadInst()', () => {
        it('should emit a DownloadAction with the current state and inst name', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.downloadInst()',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        inst: 'channel',
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
                        test: '@os.downloadInst()',
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
                        inst: 'channel',
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
                        test: '@os.openQRCodeScanner()',
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
                        test: '@os.openQRCodeScanner("front")',
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
                        test: '@os.closeQRCodeScanner()',
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
                        test: '@os.showQRCode("hello")',
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
                        test: '@os.hideQRCode()',
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
                        test: '@os.openBarcodeScanner()',
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
                        test: '@os.openBarcodeScanner("front")',
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
                        test: '@os.closeBarcodeScanner()',
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
                        test: '@os.showBarcode("hello")',
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
                        test: '@os.showBarcode("hello", "format")',
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
                        test: '@os.hideBarcode()',
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

    describe('loadServer()', () => {
        it('should emit a LoadServerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.loadServer("abc")',
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

    describe('unloadServer()', () => {
        it('should emit a UnloadServerAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.unloadServer("abc")',
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
                        test: '@os.importAUX("abc")',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('test', ['thisBot']);
            const result = calculateActionResults(state, botAction);

            expect(result.actions).toEqual([importAUX('abc', 1)]);
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
                        test: `@os.importAUX('${json}')`,
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

    describe('os.isInDimension()', () => {
        it('should return true when gridPortal equals the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#inDimension", os.isInDimension("dimension"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        gridPortal: 'dimension',
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

        it('should return false when gridPortal does not equal the given value', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#inDimension", os.isInDimension("abc"))',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        gridPortal: 'dimension',
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

        it('should return false when gridPortal is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#inDimension", os.isInDimension("abc"))',
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

    describe('os.getCurrentDimension()', () => {
        it('should return gridPortal', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentDimension())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        gridPortal: 'dimension',
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

        it('should return undefined when gridPortal is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentDimension())',
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

    describe('os.getCurrentServer()', () => {
        it('should return inst', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentServer())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        inst: 'dimension',
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

        it('should return undefined when server is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentServer())',
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
                            test: '@setTag(this, "#dimension", os.getCurrentServer())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            inst: given,
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

    describe('os.getCurrentInst()', () => {
        it('should return inst', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentInst())',
                    },
                },
                userBot: {
                    id: 'userBot',
                    tags: {
                        inst: 'dimension',
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

        it('should return undefined when inst is not set', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@setTag(this, "#dimension", os.getCurrentInst())',
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
                            test: '@setTag(this, "#dimension", os.getCurrentInst())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            inst: given,
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

    describe('os.getPortalDimension()', () => {
        const cases = [
            ['grid', 'gridDimension'],
            ['gridPortal', 'gridDimension'],
            ['inventory', 'inventoryDimension'],
            ['inventoryPortal', 'inventoryDimension'],
            ['miniGrid', 'miniDimension'],
            ['miniGridPortal', 'miniDimension'],
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
                            test: `@setTag(this, "#fun", os.getPortalDimension("${portal}"))`,
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            gridPortal: 'gridDimension',
                            inventoryPortal: 'inventoryDimension',
                            miniGridPortal: 'miniDimension',
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

    describe('os.showInputForTag()', () => {
        it('should emit a ShowInputForTagAction', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.showInputForTag(this, "abc")',
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
                        test: '@os.showInputForTag("test", "abc")',
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
                        test: '@os.showInputForTag("test", "##abc"); os.showInputForTag("test", "#abc")',
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
                        test: '@os.showInputForTag("test", "abc", { backgroundColor: "red", foregroundColor: "green" })',
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
                        test: '@os.goToDimension("abc")',
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
                        test: '@os.goToDimension("sim", "abc")',
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

    describe('os.goToURL()', () => {
        it('should issue a GoToURL event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.goToURL("abc")',
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

    describe('os.openURL()', () => {
        it('should issue a OpenURL event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.openURL("abc")',
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

    describe('os.openDevConsole()', () => {
        it('should issue a OpenConsole event', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        test: '@os.openDevConsole()',
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
                        test: '@applyMod(this, getMod(getBot("#name", "bob"), "val", /test\\..+/))',
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
                        test: '@applyMod(this, getMod(getBots("name", "bob").first()))',
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
                        test: '@applyMod(this, getMod({abc: true, val: 123}, "val"))',
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
                        test: '@setTag(this, "#name", "bob"); setTag(this, "#abc", getTag(this, "#name"))',
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

    describe('remote()', () => {
        const cases = [
            ['os.toast("My Message!")', toast('My Message!')] as const,
            [
                'os.goToDimension("dimension")',
                goToDimension('dimension'),
            ] as const,
            ['os.openURL("url")', openURL('url')] as const,
            ['os.goToURL("url")', goToURL('url')] as const,
            ['os.tweenTo("id")', tweenTo('id')] as const,
            ['os.openURL("url")', openURL('url')] as const,
            ['os.openQRCodeScanner()', openQRCodeScanner(true)] as const,
            ['os.closeQRCodeScanner()', openQRCodeScanner(false)] as const,
            ['os.openBarcodeScanner()', openBarcodeScanner(true)] as const,
            ['os.closeBarcodeScanner()', openBarcodeScanner(false)] as const,
            ['os.showBarcode("code")', showBarcode(true, 'code')] as const,
            ['os.hideBarcode()', showBarcode(false)] as const,
            ['os.loadServer("channel")', loadSimulation('channel')] as const,
            [
                'os.unloadServer("channel")',
                unloadSimulation('channel'),
            ] as const,
            ['os.importAUX("aux")', importAUX('aux', 1)] as const,
            ['os.showQRCode("code")', showQRCode(true, 'code')] as const,
            ['os.hideQRCode()', showQRCode(false)] as const,
            [
                'os.showInputForTag(this, "abc")',
                showInputForTag('thisBot', 'abc'),
            ] as const,
            ['os.openDevConsole()', openConsole()] as const,
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
                        test: `@remote(os.toast("Hi!"), {
                            sessionId: 's',
                            userId: 'u',
                            connectionId: 'd'
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
                    userId: 'u',
                    connectionId: 'd',
                }),
            ]);
        });
    });

    it('should return the result of the script', () => {
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
            it('should support DNA tags on the new bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@let newBot = ${name}({ creator: null }, { formula: "${DNA_TAG_PREFIX}{ \\"abc\\": \\"def\\" }", num: 100 }); setTag(this, "#result", getTag(newBot, "#formula"));`,
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
                            formula: `${DNA_TAG_PREFIX}{ "abc": "def" }`,
                            num: 100,
                        },
                    }),
                    botUpdated('thisBot', {
                        tags: {
                            result: {
                                abc: 'def',
                            },
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
                                test: `@${name}({ creator: null }, { space: "local" }, { abc: "def" })`,
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
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ]);
                });

                it('should use the last space', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { space: "cookie" }, { space: "local" }, { abc: "def" })`,
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
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ]);
                });

                it('should use the last space even if it is null', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: null }, { space: "cookie" }, { space: null }, { abc: "def" })`,
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
                                    test: `@${name}({ creator: null }, { space: ${value} }, { abc: "def" })`,
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
                                test: `@${name}({ creator: "otherBot" }, { space: "def" }, { abc: "def" })`,
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
                            tags: {
                                abc: 'def',
                            },
                        }),
                    ]);
                });

                it('should set creator to null if it references a bot that does not exist', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ creator: "otherBot" }, { abc: "def" })`,
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
            });
        });
    }
});
