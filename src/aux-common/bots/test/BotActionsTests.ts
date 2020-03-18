import {
    action,
    botAdded,
    botRemoved,
    botUpdated,
    superShout,
    toast,
    tweenTo,
    openQRCodeScanner,
    showQRCode,
    loadSimulation as loadUniverse,
    unloadSimulation as unloadUniverse,
    importAUX,
    showInputForTag,
    goToDimension,
    goToURL,
    openURL,
    shell,
    openConsole,
    backupToGithub,
    backupAsDownload,
    openBarcodeScanner,
    showBarcode,
    checkout,
    finishCheckout,
    webhook,
    reject,
    html,
    loadFile,
    saveFile,
    replaceDragBot,
    setupUniverse,
    hideHtml,
    ReplaceDragBotAction,
    setClipboard,
    showChat,
    hideChat,
    runScript,
    download,
    showUploadAuxFile,
    markHistory,
    browseHistory,
    restoreHistoryMark,
    RestoreHistoryMarkAction,
    enableAR,
    enableVR,
    disableVR,
    disableAR,
    showJoinCode,
    requestFullscreen,
    exitFullscreen,
} from '../BotEvents';
import {
    createBot,
    getActiveObjects,
    isBot,
    hasValue,
} from '../BotCalculations';
import { getBotsForAction } from '../BotsChannel';
import {
    calculateActionEvents,
    calculateActionResults,
    calculateDestroyBotEvents,
    calculateFormulaEvents,
    resolveRejectedActions,
} from '../BotActions';
import { BotsState, DEVICE_BOT_ID, Bot, KNOWN_PORTALS } from '../Bot';
import {
    createCalculationContext,
    createFormulaLibrary,
} from '../BotCalculationContextFactories';
import { SandboxFactory } from '../../Formulas/Sandbox';
import { remote } from '@casual-simulation/causal-trees';
import { types } from 'util';
import {
    numericalTagValueTests,
    possibleTagValueCases,
} from './BotTestHelpers';

export function botActionsTests(
    uuidMock: jest.Mock,
    createSandbox?: SandboxFactory
) {
    describe('calculateActionEvents()', () => {
        it('should run scripts on the this bot and return the resulting actions', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        test: '@create({ auxCreator: null }, this);',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        test: '@create({ auxCreator: null }, this);',
                        auxCreator: null,

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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        auxColor: 'red',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        auxColor: 'red',
                        test: `@
                            setTag(this, "other", tags.auxColor);
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        auxColor: 'red',
                        test: `@
                            tags.auxColor = 'blue';
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        auxColor: 'blue',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botUpdated('thisBot', {
                    tags: {
                        calculated: 10,
                        formula: '=10',
                    },
                }),
            ]);
        });

        describe('creator', () => {
            it('should pass in a creator variable which equals getBot("id", tags.auxCreator)', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            _position: { x: 0, y: 0, z: 0 },
                            _workspace: 'abc',
                            auxCreator: 'thatBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            test:
                                '@setTag(this, "hasCreator", creator !== null)',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            auxCreator: 'none',
                            test:
                                '@setTag(this, "hasCreator", creator !== null)',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hasCreator: false,
                        },
                    }),
                ]);
            });
        });

        describe('config', () => {
            it('should pass in a config variable which equals getBot("id", tags.auxConfigBot)', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            auxConfigBot: 'thatBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            configId: 'thatBot',
                        },
                    }),
                ]);
            });

            it('the config variable should be null if auxConfigBot is not set', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            hasConfig: false,
                        },
                    }),
                ]);
            });

            it('the config variable should be null if auxConfigBot is referencing a missing bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            auxConfigBot: 'none',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            auxConfigBot: 'thatBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            auxConfigBot: 'thatBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(false);
            expect(result.events).toEqual([]);
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(false);
            expect(result.events).toEqual([]);
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
                            '@create({ auxCreator: null }, this, that, { testFormula: "=this.name" });',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        test:
                            '@create({ auxCreator: null }, this, that, { testFormula: "=this.name" });',
                        name: 'Friend',
                        testFormula: '=this.name',
                        auxCreator: null,

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
                        abcdef: '@create({ auxCreator: null }, this)',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@create({ auxCreator: null }, this)',
                        auxCreator: null,
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
                        abcdef: '@create({ auxCreator: null }, this)',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        abcdef: '@create({ auxCreator: null }, this)',
                        auxCreator: null,
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        abcdef:
                            '@setTag(getBot("#name", "test"), "#abc", "def")',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        abcdef:
                            '@setTag(getTag(this, "#formula"), "#abc", "def")',
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                        sayHello:
                            '@setTag(this, "#userId", player.getBot().id)',
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const botAction = action('abcdef', ['thisBot'], 'userBot');
            const result = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(result.hasUserDefinedEvents).toBe(true);

            expect(result.events).toEqual([
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
                calculateActionEvents(state, botAction, createSandbox);
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
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );
            expect(events.events).toEqual([toast('hello')]);
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
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );
            expect(events.events).toEqual([toast('hello')]);
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
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([]);
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
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
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
            const events = calculateActionEvents(
                state,
                botAction,
                createSandbox
            );

            expect(events.events).toEqual([toast('test')]);
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
                const botAction = action(
                    'test',
                    ['bot2', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'test',
                            that: {
                                abc: 'def',
                            },
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
                const botAction = action(
                    'test',
                    ['bot2', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'test',
                            that: {
                                abc: 'def',
                            },
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
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
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
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([toast('Hi!')]);
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
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
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
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
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
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
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
                const botAction = action(
                    'test',
                    ['bot1', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([
                    botUpdated('bot1', {
                        tags: {
                            name: 'test',
                            that: {
                                abc: 'def',
                            },
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
                const botAction = action(
                    'test',
                    ['bot2', 'bot3', 'bot4'],
                    null,
                    {
                        abc: 'def',
                    }
                );
                const events = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events.events).toEqual([]);
            });
        });

        describe('arguments', () => {
            it('should not convert the argument to a script bot if it is a bot', () => {
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
                const botAction = action(
                    'test',
                    ['thisBot'],
                    null,
                    state.otherBot
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);

                // expect(result.hasUserDefinedEvents).toBe(true);
                // expect(result.events).toEqual([
                //     botUpdated('otherBot', {
                //         tags: {
                //             hi: 'changed',
                //         },
                //     }),
                // ]);
            });

            it('should not convert the argument to a list of script bots if it is a list of bots', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            l: 1,
                        },
                    }),
                ]);

                // expect(result.hasUserDefinedEvents).toBe(true);
                // expect(result.events).toEqual([
                //     botUpdated('otherBot', {
                //         tags: {
                //             hi: 'changed',
                //         },
                //     }),
                //     botUpdated('thisBot', {
                //         tags: {
                //             l: 1,
                //         },
                //     }),
                // ]);
            });

            it.skip('should convert the argument fields to script bots if they are bots', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botUpdated('otherBot', {
                        tags: {
                            hi: 'changed',
                        },
                    }),
                ]);
            });

            it('should not convert bots in arrays to script bots', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);

                // expect(result.hasUserDefinedEvents).toBe(true);
                // expect(result.events).toEqual([
                //     botUpdated('otherBot', {
                //         tags: {
                //             hi: 'changed',
                //         },
                //     }),
                // ]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const botAction = action(
                    'test',
                    ['thisBot'],
                    null,
                    state.otherBot
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([toast('abc'), toast('abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    reject(<any>{
                        type: 'test',
                        message: 'abc',
                    }),
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            abcdef:
                                '@let o = { hi: "test" }; shout("sayHello", o)',
                            sayHello: '@setTag(this, "#hello", that.hi)',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('abcdef', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            abcdef:
                                '@shout("sayHello", getBot("#name", "other"))',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            abcdef:
                                '@shout("sayHello", getBot("#name", "other"))',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([botRemoved('bBot')]);
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([superShout('sayHello')]);
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([superShout('sayHello')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    webhook({
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    }),
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    webhook({
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    }),
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
                                '@let newBot = create({ auxCreator: getID(this) }, { stay: "def", "leaveX": 0, "leaveY": 0 }); removeTags(newBot, "leave");',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('create', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.events).toEqual([
                    botAdded({
                        id: 'uuid-0',
                        tags: {
                            stay: 'def',
                            leaveX: 0,
                            leaveY: 0,
                            auxCreator: 'thisBot',
                        },
                    }),
                    botUpdated('uuid-0', {
                        tags: {
                            leaveX: null,
                            leaveY: null,
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.events).toEqual([
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
            it('should destroy and bots that have auxCreator set to the bot ID', () => {
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
                            auxCreator: 'thisBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botRemoved('thisBot'),
                    botRemoved('childBot'),
                ]);
            });

            it('should recursively destroy bots that have auxCreator set to the bot ID', () => {
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
                            auxCreator: 'thisBot',
                        },
                    },
                    childChildBot: {
                        id: 'childChildBot',
                        tags: {
                            auxCreator: 'childBot',
                        },
                    },
                    otherChildBot: {
                        id: 'otherChildBot',
                        tags: {
                            auxCreator: 'thisBot',
                        },
                    },
                    otherChildChildBot: {
                        id: 'otherChildChildBot',
                        tags: {
                            auxCreator: 'otherChildBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            auxDestroyable: false,
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
                            auxCreator: 'thisBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
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
                            auxCreator: 'thisBot',
                            auxDestroyable: false,
                        },
                    },
                    grandChildBot: {
                        id: 'grandChildBot',
                        tags: {
                            auxCreator: 'childBot',
                        },
                    },
                };

                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([botRemoved('thisBot')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded(
                        createBot('uuid-0', {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            funXyzOnExit:
                                '@tags.exit = that.from + "-" + that.to',
                            funAbcOnEnter:
                                '@tags.enter = that.from + "-" + that.to',
                        },
                    },
                };

                // specify the UUID to use next
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            funXyzOnExit:
                                '@tags.exit = that.from + "-" + that.to',
                            funXyzOnEnter:
                                '@tags.enter = that.from + "-" + that.to',
                        },
                    },
                };

                // specify the UUID to use next
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botAdded(
                        createBot('newBot', {
                            auxCreator: 'thisBot',
                            onCreate: "@changeState(this, 'abc')",
                        })
                    ),
                    botUpdated('newBot', {
                        tags: {
                            state: 'abc',
                        },
                    }),
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
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
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
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const botAction = action(
                    'test',
                    ['thisBot', 'userBot'],
                    'userBot'
                );
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    replaceDragBot(state['thisBot']),
                ]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                const dragAction = result.events[0] as ReplaceDragBotAction;
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(
                        loadFile({
                            path: 'path',
                        })
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
            it('should return the auxMenuPortal tag from the user bot', () => {
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
                            auxMenuPortal: 'abc',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([toast('hello, world!')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showJoinCode()]);
            });

            it('should allow linking to a specific universe and dimension', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test:
                                '@player.showJoinCode("universe", "dimension")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showJoinCode('universe', 'dimension'),
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([requestFullscreen()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([exitFullscreen()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([html('hello, world!')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([hideHtml()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([setClipboard('test')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('test')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([tweenTo('thisBot')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showChat()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([hideChat()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([runScript('abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({
                        version: {
                            hash: 'abc',
                            version: 'v1.0.2',
                            major: 1,
                            minor: 0,
                            patch: 2,
                        },
                    })
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({
                        device: {
                            supportsAR: true,
                            supportsVR: false,
                        },
                    })
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({})
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({})
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([enableAR()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({})
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([disableAR()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({})
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([enableVR()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox,
                    createFormulaLibrary({})
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([disableVR()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showUploadAuxFile()]);
            });
        });

        describe('player.downloadUniverse()', () => {
            it('should emit a DownloadAction with the current state and universe name', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@player.downloadUniverse()',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            auxUniverse: 'channel',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                            test: '@player.downloadUniverse()',
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
                            auxUniverse: 'channel',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(true)]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    openQRCodeScanner(true, 'front'),
                ]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openQRCodeScanner(false)]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(true, 'hello')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showQRCode(false)]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(true)]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    openBarcodeScanner(true, 'front'),
                ]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openBarcodeScanner(false)]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(true, 'hello')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showBarcode(false)]);
            });
        });

        describe('loadUniverse()', () => {
            it('should emit a LoadUniverseAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@player.loadUniverse("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([loadUniverse('abc')]);
            });
        });

        describe('unloadUniverse()', () => {
            it('should emit a UnloadUniverseAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@player.unloadUniverse("abc")',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([unloadUniverse('abc')]);
            });
        });

        describe('loadAUX()', () => {
            it('should emit a ImportdAUXEvent', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([importAUX('abc')]);
            });
        });

        describe('player.isInDimension()', () => {
            it('should return true when auxPagePortal equals the given value', () => {
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
                            auxPagePortal: 'dimension',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inDimension: true,
                        },
                    }),
                ]);
            });

            it('should return false when auxPagePortal does not equal the given value', () => {
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
                            auxPagePortal: 'dimension',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inDimension: false,
                        },
                    }),
                ]);
            });

            it('should return false when auxPagePortal is not set', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            inDimension: false,
                        },
                    }),
                ]);
            });
        });

        describe('player.getCurrentDimension()', () => {
            it('should return auxPagePortal', () => {
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
                            auxPagePortal: 'dimension',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            dimension: 'dimension',
                        },
                    }),
                ]);
            });

            it('should return undefined when auxPagePortal is not set', () => {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            dimension: undefined,
                        },
                    }),
                ]);
            });
        });

        describe('player.getCurrentUniverse()', () => {
            it('should return auxUniverse', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test:
                                '@setTag(this, "#dimension", player.getCurrentUniverse())',
                        },
                    },
                    userBot: {
                        id: 'userBot',
                        tags: {
                            auxUniverse: 'dimension',
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thisBot', {
                        tags: {
                            dimension: 'dimension',
                        },
                    }),
                ]);
            });

            it('should return undefined when auxUniverse is not set', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test:
                                '@setTag(this, "#dimension", player.getCurrentUniverse())',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                                    '@setTag(this, "#dimension", player.getCurrentUniverse())',
                            },
                        },
                        userBot: {
                            id: 'userBot',
                            tags: {
                                auxUniverse: given,
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('test', ['thisBot'], 'userBot');
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
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
                ['auxPagePortal', 'pageDimension'],
                ['inventory', 'inventoryDimension'],
                ['auxInventoryPortal', 'inventoryDimension'],
                ['menu', 'menuDimension'],
                ['auxMenuPortal', 'menuDimension'],
                ['sheet', 'sheetDimension'],
                ['auxSheetPortal', 'sheetDimension'],
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
                                auxPagePortal: 'pageDimension',
                                auxInventoryPortal: 'inventoryDimension',
                                auxMenuPortal: 'menuDimension',
                                auxSheetPortal: 'sheetDimension',
                                falsy: false,
                                number: 0,
                            },
                        },
                    };

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const botAction = action('test', ['thisBot'], 'userBot');
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    showInputForTag('thisBot', 'abc'),
                ]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([showInputForTag('test', 'abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToDimension('abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToDimension('sim')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([goToURL('abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([openURL('abc')]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([openConsole()]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(false);
                expect(result.events).toEqual([]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    botUpdated('thatBot', {
                        tags: {
                            name: 'bob',
                        },
                    }),
                ]);
            });
        });

        describe('server.setupUniverse()', () => {
            it('should send a SetupChannelAction in a RemoteAction', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: '@server.setupUniverse("channel", this)',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(
                        setupUniverse(
                            'channel',
                            createBot('thisBot', {
                                test: '@server.setupUniverse("channel", this)',
                            })
                        )
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(shell('abc'))]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(backupToGithub('abc'))]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                                processingUniverse: 'channel2'
                            })`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    checkout({
                        publishableKey: 'key',
                        productId: 'ID1',
                        title: 'Product 1',
                        description: '$50.43',
                        processingUniverse: 'channel2',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([remote(browseHistory())]);
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(restoreHistoryMark('mark')),
                ]);
            });
        });

        describe('server.restoreHistoryMarkToUniverse()', () => {
            it('should emit a restore_history_mark event', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@server.restoreHistoryMarkToUniverse("mark", "universe")`,
                        },
                    },
                };

                // specify the UUID to use next
                uuidMock.mockReturnValue('uuid-0');
                const botAction = action('test', ['thisBot'], 'userBot');
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(<RestoreHistoryMarkAction>{
                        type: 'restore_history_mark',
                        mark: 'mark',
                        universe: 'universe',
                    }),
                ]);
            });
        });

        describe('remote()', () => {
            const cases = [
                ['player.toast("My Message!")', toast('My Message!')],
                [
                    'player.goToDimension("dimension")',
                    goToDimension('dimension'),
                ],
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
                ['player.loadUniverse("channel")', loadUniverse('channel')],
                ['player.unloadUniverse("channel")', unloadUniverse('channel')],
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
                    processingUniverse: 'channel2'
                })`,
                    checkout({
                        publishableKey: 'my_key',
                        productId: 'ID1',
                        title: 'Product 1',
                        description: '$50.43',
                        processingUniverse: 'channel2',
                    }),
                ],
                ['player.openDevConsole()', openConsole()],
            ];

            it.each(cases)(
                'should wrap %s in a remote event',
                (script, event) => {
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );

                    expect(result.hasUserDefinedEvents).toBe(true);

                    expect(result.events).toEqual([remote(event)]);
                }
            );

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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );

                expect(result.hasUserDefinedEvents).toBe(true);

                expect(result.events).toEqual([
                    remote(toast('Hi!'), {
                        sessionId: 's',
                        username: 'u',
                        deviceId: 'd',
                    }),
                ]);
            });
        });
    });

    describe('calculateActionResults()', () => {
        const nonStringScriptCases = [
            ['true', true],
            ['false', false],
            ['0', 0],
        ];
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
                const [events, results] = calculateActionResults(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events).toEqual([]);
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
                const [events, results] = calculateActionResults(
                    state,
                    botAction,
                    createSandbox
                );

                expect(events).toEqual([]);
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
            const [events, results] = calculateActionResults(
                state,
                botAction,
                createSandbox
            );

            expect(results).toEqual([10]);
            expect(events).toEqual([]);
        });
    });

    describe('calculateDestroyBotEvents()', () => {
        it('should return a list of events needed to destroy the given bot', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                auxCreator: 'bot1',
            });
            const bot3 = createBot('bot3', {
                auxCreator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                auxCreator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                botRemoved('bot2'),
                botRemoved('bot3'),
                botRemoved('bot4'),
            ]);
        });

        it('should not return a destroy event for bots that are not destroyable', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                auxCreator: 'bot1',
                auxDestroyable: false,
            });
            const bot3 = createBot('bot3', {
                auxCreator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                auxCreator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createCalculationContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined,
                undefined,
                createSandbox
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                // bot2 and bot3 are not destroyed because they are not destroyable
                botRemoved('bot4'),
            ]);
        });
    });

    describe('calculateFormulaEvents()', () => {
        it('should return the list of events that the formula produced', () => {
            const state: BotsState = {};

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'create(null, { name: "bob" })',
                undefined,
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        name: 'bob',
                    },
                }),
            ]);
        });

        it('should support updating bots', () => {
            const state: BotsState = {
                otherBot: {
                    id: 'otherBot',
                    tags: {
                        name: 'bob',
                        test: false,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'setTag(getBot("#name", "bob"), "#test", true)',
                undefined,
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botUpdated('otherBot', {
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });

        it('should use the given user id', () => {
            const state: BotsState = {
                userBot: {
                    id: 'userBot',
                    tags: {
                        test: true,
                    },
                },
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const result = calculateFormulaEvents(
                state,
                'create(null, player.getBot())',
                'userBot',
                undefined,
                createSandbox
            );

            expect(result).toEqual([
                botAdded({
                    id: 'uuid-0',
                    tags: {
                        test: true,
                    },
                }),
            ]);
        });
    });

    describe('getBotsForAction()', () => {
        it('should return the list of bots sorted by ID', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action('test', ['thisBot', 'thatBot']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([state['thatBot'], state['thisBot']]);
        });

        it('should not sort IDs if the action specifies not to', () => {
            const state: BotsState = {
                thisBot: {
                    id: 'thisBot',
                    tags: {},
                },
                thatBot: {
                    id: 'thatBot',
                    tags: {},
                },
            };

            const botAction = action(
                'test',
                ['thisBot', 'thatBot'],
                undefined,
                undefined,
                false
            );
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([state['thisBot'], state['thatBot']]);
        });

        it('should filter out bots which are not in the state', () => {
            const state: BotsState = {};

            const botAction = action('test', ['badBot']);
            const calc = createCalculationContext(
                getActiveObjects(state),
                null,
                undefined,
                createSandbox
            );
            const { bots } = getBotsForAction(botAction, calc);

            expect(bots).toEqual([]);
        });
    });

    describe('resolveRejectedActions()', () => {
        it('should remove an action if it has been rejected after it was issued', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, reject(toastAction)];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([]);
        });

        it('should keep an action if it has been rejected before it was issued', () => {
            let toastAction = toast('abc');
            let actions = [reject(toastAction), toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc')]);
        });

        it('should be able to remove a rejection', () => {
            let toastAction = toast('abc');
            let rejection = reject(toastAction);
            let actions = [toastAction, rejection, reject(rejection)];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc')]);
        });

        it('should preserve the order of the original actions', () => {
            let actions = [toast('abc'), toast('def')];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toast('abc'), toast('def')]);
        });

        it('should handle rejecting an action twice', () => {
            let toastAction = toast('abc');
            let actions = [
                toastAction,
                reject(toastAction),
                reject(toastAction),
            ];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([]);
        });

        it('should remove duplicate actions', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toastAction]);
        });

        it('should allow an action if it is re-added after it is rejected', () => {
            let toastAction = toast('abc');
            let actions = [toastAction, reject(toastAction), toastAction];

            const final = resolveRejectedActions(actions);

            expect(final).toEqual([toastAction]);
        });
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            ghi: 123,
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            name: 'that',
                            formula: '=this.abc',
                            auxCreator: 'thisBot',
                        },
                    }),
                ]);
            });
            it('should return the created bot', () => {
                const state: BotsState = {
                    thisBot: {
                        id: 'thisBot',
                        tags: {
                            test: `@setTag(this, "#newBotId", ${name}({ auxCreator: null }, { abc: "def" }).id)`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            auxCreator: null,
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
                            test: `@let newBot = ${name}({ auxCreator: null }, { abc: "def" }); setTag(newBot, "#fun", true); setTag(newBot, "#num", 123);`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            abc: 'def',
                            auxCreator: null,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                            test: `@${name}({ auxCreator: null }, { name: "bob" }); setTag(this, "#botId", getBot("#name", "bob").id)`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            name: 'bob',
                            auxCreator: null,
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
                            test: `@let newBot = ${name}({ auxCreator: null }, { formula: "=getTag(this, \\"#num\\")", num: 100 }); setTag(this, "#result", getTag(newBot, "#formula"));`,
                        },
                    },
                };
                // specify the UUID to use next
                uuidMock.mockReturnValue(id);
                const botAction = action('test', ['thisBot']);
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            formula: '=getTag(this, "#num")',
                            num: 100,
                            auxCreator: null,
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'thisBot',
                            abc: 1,
                            onCreate: '@setTag(this, "#num", 100)',
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: true,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: false,
                            wow: 1,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-2`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: true,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-3`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: false,
                            oh: 'haha',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-4`,
                        tags: {
                            auxCreator: 'thisBot',
                            hello: true,
                            test: 'a',
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-5`,
                        tags: {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: `${expectedId}-0`,
                        tags: {
                            auxCreator: 'thisBot',
                            test: true,
                            hello: true,
                        },
                    }),
                    botAdded({
                        id: `${expectedId}-1`,
                        tags: {
                            auxCreator: 'thisBot',
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        space: 'tempLocal',
                        tags: {
                            auxCreator: null,
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'thisBot',
                            test: true,
                            abc: `@tags.hit = true;`,
                        },
                    }),
                    botUpdated('aBot', {
                        tags: {
                            hit: true,
                        },
                    }),
                    botUpdated(expectedId, {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'thisBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        space: <any>'custom',
                        tags: {
                            auxCreator: null,
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                            def: `@tags.hit2 = true;`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.hit = true;`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        tags: {
                            auxCreator: 'creatorBot',
                            test: true,
                            auxListening: true,
                            abc: `@tags.value = 10; whisper(this, "def")`,
                            def: `@tags.hit = tags.value === 10;`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                const result = calculateActionEvents(
                    state,
                    botAction,
                    createSandbox
                );
                expect(result.hasUserDefinedEvents).toBe(true);
                expect(result.events).toEqual([
                    botAdded({
                        id: expectedId,
                        space: <any>'custom',
                        tags: {
                            auxCreator: null,
                            test: true,
                            auxListening: true,
                            setup: `@whisper(this, "otherPart")`,
                            otherPart: `@tags.hitSetup = true`,
                        },
                    }),
                    botUpdated(expectedId, {
                        tags: {
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
                                test: `@${name}({ auxCreator: null }, { space: "local" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            space: 'local',
                            tags: {
                                auxCreator: null,
                            },
                        }),
                    ]);
                });

                it('should use the last space', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: null }, { space: "cookie" }, { space: "local" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            space: 'local',
                            tags: {
                                auxCreator: null,
                            },
                        }),
                    ]);
                });

                it('should use the last space even if it is null', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: null }, { space: "cookie" }, { space: null })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                auxCreator: null,
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
                                    test: `@${name}({ auxCreator: null }, { space: ${value} })`,
                                },
                            },
                        };
                        // specify the UUID to use next
                        uuidMock.mockReturnValue(id);
                        const botAction = action('test', ['thisBot']);
                        const result = calculateActionEvents(
                            state,
                            botAction,
                            createSandbox
                        );
                        expect(result.hasUserDefinedEvents).toBe(true);
                        expect(result.events).toEqual([
                            botAdded({
                                id: expectedId,
                                tags: {
                                    auxCreator: null,
                                },
                            }),
                        ]);
                    }
                );
            });

            describe('auxCreator', () => {
                it('should set the auxCreator to the given bot', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: getID(getBot("other", true)) }, { abc: "def" })`,
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                abc: 'def',
                                auxCreator: 'otherBot',
                            },
                        }),
                    ]);
                });

                it('should be able to set the auxCreator to null', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: null }, { abc: "def" })`,
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                abc: 'def',
                                auxCreator: null,
                            },
                        }),
                    ]);
                });

                it('should set auxCreator to null if it references a bot in a different space', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: "otherBot" }, { space: "def" })`,
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
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            space: <any>'def',
                            tags: {
                                auxCreator: null,
                            },
                        }),
                    ]);
                });

                it('should set auxCreator to null if it references a bot that does not exist', () => {
                    const state: BotsState = {
                        thisBot: {
                            id: 'thisBot',
                            tags: {
                                test: `@${name}({ auxCreator: "otherBot" })`,
                            },
                        },
                    };
                    // specify the UUID to use next
                    uuidMock.mockReturnValue(id);
                    const botAction = action('test', ['thisBot']);
                    const result = calculateActionEvents(
                        state,
                        botAction,
                        createSandbox
                    );
                    expect(result.hasUserDefinedEvents).toBe(true);
                    expect(result.events).toEqual([
                        botAdded({
                            id: expectedId,
                            tags: {
                                auxCreator: null,
                            },
                        }),
                    ]);
                });
            });
        });
    }
}
