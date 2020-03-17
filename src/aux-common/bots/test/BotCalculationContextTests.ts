import { BotSandboxContext } from '../BotCalculationContext';
import {
    createBot,
    objectsAtDimensionGridPosition,
    getBotShape,
    calculateFormulaValue,
    calculateBotValue,
    filterBotsBySelection,
    updateBot,
    isMergeable,
    isPickupable,
    isSimulation,
    isDestroyable,
    isEditable,
    duplicateBot,
    isBotMovable,
    getBotDragMode,
    isBotStackable,
    getUserMenuId,
    getBotsInMenu,
    addBotToMenu,
    removeBotFromMenu,
    getDimensionVisualizeMode,
    getBuilderDimensionGrid,
    getDimensionSize,
    addToDimensionDiff,
    removeFromDimensionDiff,
    isDimensionMovable,
    isDimension,
    getBotConfigDimensions,
    isDimensionLocked,
    getBotLabelAnchor,
    getBotVersion,
    isBotInDimension,
    getUserBotColor,
    calculateStringListTagValue,
    getChannelBotById,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    getChannelConnectedDevices,
    getConnectedDevices,
    getBotScale,
    calculateCopiableValue,
    isUserActive,
    calculateStringTagValue,
    isMinimized,
    getDimensionColor,
    getDimensionGridScale,
    getDimensionScale,
    getDimensionDefaultHeight,
    getBotPosition,
    getBotRotation,
    botDimensionSortOrder,
    getBotPositioningMode,
    convertToCopiableValue,
    getPortalConfigBotID,
    getBotSubShape,
    getBotOrientationMode,
    getBotAnchorPoint,
    calculatePortalPointerDragMode,
} from '../BotCalculations';
import {
    Bot,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    GLOBALS_BOT_ID,
    AuxDomain,
    DEFAULT_WORKSPACE_SCALE,
} from '../Bot';
import { buildLookupTable } from '../BotLookupTable';
import { BotLookupTableHelper } from '../BotLookupTableHelper';
import { types } from 'util';
import {
    stringTagValueTests,
    booleanTagValueTests,
    numericalTagValueTests,
    possibleTagNameCases,
} from './BotTestHelpers';

export function botCalculationContextTests(
    uuidMock: jest.Mock,
    dateNowMock: jest.Mock,
    createCalculationContext: (
        bots: Bot[],
        userId?: string
    ) => BotSandboxContext
) {
    describe('objectsAtContextGridPosition()', () => {
        it('should return bots at the given position', () => {
            const bot1 = createBot('test1', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });
            const bot2 = createBot('test2', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });
            const bot3 = createBot('test3', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });

            const context = createCalculationContext([bot2, bot1, bot3]);
            const result = objectsAtDimensionGridPosition(
                context,
                'dimension',
                {
                    x: -1,
                    y: 1,
                }
            );

            expect(result).toEqual([bot1, bot2, bot3]);
        });

        it('should cache the query and results', () => {
            const bot1 = createBot('test1', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });
            const bot2 = createBot('test2', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });
            const bot3 = createBot('test3', {
                dimension: true,
                dimensionX: -1,
                dimensionY: 1,
            });

            const context = createCalculationContext([bot2, bot1, bot3]);
            const context2 = createCalculationContext([bot2, bot1, bot3]);
            const result1 = objectsAtDimensionGridPosition(
                context,
                'dimension',
                {
                    x: -1,
                    y: 1,
                }
            );
            const result2 = objectsAtDimensionGridPosition(
                context,
                'dimension',
                {
                    x: -1,
                    y: 1,
                }
            );
            const result3 = objectsAtDimensionGridPosition(
                context2,
                'dimension',
                {
                    x: -1,
                    y: 1,
                }
            );

            expect(result1).toBe(result2);
            expect(result1).not.toBe(result3);
        });

        it('should default to 0,0 for bots without a position', () => {
            const bot1 = createBot('test1', {
                dimension: true,
            });

            const context = createCalculationContext([bot1]);
            const result = objectsAtDimensionGridPosition(
                context,
                'dimension',
                {
                    x: 0,
                    y: 0,
                }
            );

            expect(result).toEqual([bot1]);
        });
    });

    describe('calculateFormulaValue()', () => {
        it('should return the formula result', () => {
            const formula = '123.4567';
            const context = createCalculationContext([]);
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123.4567);
        });

        it('should unwrap proxy values', () => {
            const obj1 = createBot('test1', {
                name: 'test',
                num: 123,
            });
            const context = createCalculationContext([obj1]);

            const formula = '=getTag(getBots("name", "test").first(), "#num")';
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123);
        });

        it('should calculate formulas in tags', () => {
            const obj1 = createBot('test1', {
                name: 'test',
                formula: '=getTag(this, "#name")',
            });
            const context = createCalculationContext([obj1]);

            const formula = '=getTag(getBot("#name", "test"), "#formula")';
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toEqual('test');
        });
    });

    describe('calculateBotValue()', () => {
        it('should convert to a number if it is a number', () => {
            const bot = createBot();
            bot.tags.tag = '123.145';
            const context = createCalculationContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toBeCloseTo(123.145);
        });

        it('should parse numbers that dont start with a digit', () => {
            const bot = createBot();
            bot.tags.tag = '.145';
            const context = createCalculationContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toBeCloseTo(0.145);
        });

        it('should convert to a boolean if it is a boolean', () => {
            const bot = createBot();
            bot.tags.tag = 'true';

            const context = createCalculationContext([bot]);
            const trueValue = calculateBotValue(context, bot, 'tag');

            expect(trueValue).toBe(true);

            bot.tags.tag = 'false';
            const falseValue = calculateBotValue(context, bot, 'tag');

            expect(falseValue).toBe(false);
        });

        it('should convert arrays into arrays', () => {
            const bot = createBot();
            bot.tags.tag = '[test(a, b, c), 1.23, true]';
            const context = createCalculationContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toEqual(['test(a', 'b', 'c)', 1.23, true]);
        });

        it('should return the bot ID for the id tag', () => {
            const bot = createBot('test', {});

            const context = createCalculationContext([bot]);
            const value = calculateBotValue(context, bot, 'id');

            expect(value).toEqual('test');
        });

        describe('space', () => {
            it('should return shared if the space is not defined', () => {
                const bot = createBot('test', {});

                const context = createCalculationContext([bot]);
                const value = calculateBotValue(context, bot, 'space');

                expect(value).toEqual('shared');
            });

            it('should return the space if it is defined', () => {
                const bot = createBot('test', {}, 'local');

                const context = createCalculationContext([bot]);
                const value = calculateBotValue(context, bot, 'space');

                expect(value).toEqual('local');
            });
        });

        describe('filterBotsBySelection()', () => {
            it('should return the bots that have the given selection ID set to a truthy value', () => {
                const selectionId = 'abcdefg1234';
                const bot1 = createBot('test1');
                const bot2 = createBot('test2');
                const bot3 = createBot('test3');
                const bot4 = createBot('test4');
                const bot5 = createBot('test5');
                const bot6 = createBot('test6');

                bot1.tags[selectionId] = true;
                bot2.tags[selectionId] = 1;
                bot3.tags[selectionId] = -1;
                bot4.tags[selectionId] = 'hello';
                bot5.tags[selectionId] = false;

                const selected = filterBotsBySelection(
                    [bot1, bot2, bot3, bot4, bot5, bot6],
                    selectionId
                );

                expect(selected).toEqual([bot1, bot2, bot3, bot4]);
            });

            it('should return bots that have the same ID as the selection', () => {
                const selectionId = 'abcdefg1234';
                const bot1 = createBot('test1');
                const bot2 = createBot('abcdefg1234');

                bot1.tags[selectionId] = true;

                const selected = filterBotsBySelection(
                    [bot1, bot2],
                    selectionId
                );

                expect(selected).toEqual([bot1, bot2]);
            });

            it('should support the id tag', () => {
                const selectionId = 'id';
                const bot1 = createBot('test1');
                const bot2 = createBot('abcdefg1234');

                bot1.tags[selectionId] = true;

                const selected = filterBotsBySelection(
                    [bot1, bot2],
                    selectionId
                );

                expect(selected).toEqual([bot1, bot2]);
            });

            it('should support the space tag', () => {
                const selectionId = 'space';
                const bot1 = createBot('test1');
                const bot2 = createBot('abcdefg1234');

                bot1.tags[selectionId] = true;

                const selected = filterBotsBySelection(
                    [bot1, bot2],
                    selectionId
                );

                expect(selected).toEqual([bot1, bot2]);
            });
        });

        describe('formulas', () => {
            it('should unwrap proxies in arrays', () => {
                const bot = createBot('test', {
                    formula:
                        '=[getTag(this, "#num._1"),getTag(this, "#num._2")]',
                    'num._1': '1',
                    'num._2': '2',
                });

                const context = createCalculationContext([bot]);
                const value = calculateBotValue(context, bot, 'formula');

                expect(Array.isArray(value)).toBe(true);
                expect(value).toEqual([1, 2]);
            });

            const quoteCases = [['‘', '’'], ['“', '”']];

            it.each(quoteCases)(
                'should support curly quotes by converting them to normal quotes',
                (openQuote: string, closeQuote: string) => {
                    const bot1 = createBot('test1');

                    bot1.tags.formula = `=${openQuote}Hello, World${closeQuote}`;

                    const context = createCalculationContext([bot1]);
                    const value = calculateBotValue(context, bot1, 'formula');

                    // Order is based on the bot ID
                    expect(value).toEqual('Hello, World');
                }
            );

            it('should throw the error that the formula throws', () => {
                const bot = createBot('test', {
                    formula: '=throw new Error("hello")',
                });

                const context = createCalculationContext([bot]);
                expect(() => {
                    const value = calculateBotValue(context, bot, 'formula');
                }).toThrow(new Error('hello'));
            });

            it('should run out of energy in infinite loops', () => {
                const bot = createBot('test', {
                    formula: '=while(true) {}',
                });

                const context = createCalculationContext([bot]);

                expect(() => {
                    const value = calculateBotValue(context, bot, 'formula');
                }).toThrow(new Error('Ran out of energy'));
            });

            it('should run out of energy in recursive tags', () => {
                const bot = createBot('test', {
                    formula: '=getTag(this, "formula")',
                });

                const context = createCalculationContext([bot]);

                expect(() => {
                    calculateBotValue(context, bot, 'formula');
                }).toThrow();
            });

            it('should return the value from the return statement', () => {
                const bot = createBot('test', {
                    formula: '=let a = "a"; let b = "b"; a + b;',
                });

                const context = createCalculationContext([bot]);
                const value = calculateBotValue(context, bot, 'formula');

                expect(value).toEqual('ab');
            });

            it('should define a bot variable which equals this', () => {
                const bot = createBot('test', {
                    formula: '=bot === this',
                });

                const context = createCalculationContext([bot]);
                const value = calculateBotValue(context, bot, 'formula');

                expect(value).toEqual(true);
            });

            describe('getBotTagValues()', () => {
                it('should get every tag value', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 'hello';
                    bot2.tags.abc = 'world';
                    bot3.tags.abc = '!';

                    bot3.tags.formula = '=getBotTagValues("abc")';

                    const context = createCalculationContext([
                        bot4,
                        bot2,
                        bot1,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');

                    // Order is based on the bot ID
                    expect(value).toEqual(['hello', 'world', '!']);
                });

                it('should return all the values that equal the given value', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 1;
                    bot2.tags.abc = 2;
                    bot3.tags.abc = 2;

                    bot3.tags.formula = '=getBotTagValues("abc", 2)';

                    const context = createCalculationContext([
                        bot4,
                        bot2,
                        bot1,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([2, 2]);
                });

                it('should use the given filter', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 1;
                    bot2.tags.abc = 2;
                    bot3.tags.abc = 3;

                    bot3.tags.formula =
                        '=getBotTagValues("abc", num => num > 1)';

                    const context = createCalculationContext([
                        bot2,
                        bot4,
                        bot1,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should handle filters on formulas', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 1;
                    bot2.tags.abc = '=5';
                    bot3.tags.abc = 3;

                    bot3.tags.formula =
                        '=getBotTagValues("abc", num => num > 1)';

                    const context = createCalculationContext([
                        bot2,
                        bot4,
                        bot1,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([5, 3]);
                });

                it('should support tags with dots', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['abc.def'] = 1;
                    bot2.tags['abc.def'] = '=2';
                    bot3.tags['abc.def'] = 3;

                    bot3.tags.formula = '=getBotTagValues("abc.def")';
                    bot3.tags.formula1 =
                        '=getBotTagValues("abc.def", num => num >= 2)';
                    bot3.tags.formula2 =
                        '=getBotTagValues("abc.def", 2).first()';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([1, 2, 3]);

                    value = calculateBotValue(context, bot3, 'formula1');

                    expect(value).toEqual([2, 3]);

                    value = calculateBotValue(context, bot3, 'formula2');

                    expect(value).toEqual(2);
                });

                it('should support tags in strings', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['🎶🎉🦊'] = 1;
                    bot2.tags['🎶🎉🦊'] = '=2';
                    bot3.tags['🎶🎉🦊'] = 3;

                    bot3.tags.formula = '=getBotTagValues("🎶🎉🦊")';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([1, 2, 3]);
                });

                it('should support tags in strings with filters', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['🎶🎉🦊'] = 1;
                    bot2.tags['🎶🎉🦊'] = '=2';
                    bot3.tags['🎶🎉🦊'] = 3;

                    bot3.tags.formula =
                        '=getBotTagValues("🎶🎉🦊", num => num >= 2)';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should work with dots after the filter args', () => {
                    const bot1 = createBot('test1');

                    bot1.tags.num = {
                        a: 1,
                    };

                    bot1.tags.formula =
                        '=getBotTagValues("num", () => true).first().a';
                    const context = createCalculationContext([bot1]);
                    let value = calculateBotValue(context, bot1, 'formula');

                    expect(value).toBe(1);
                });

                it('should support filtering on values that contain arrays', () => {
                    const bot = createBot('test', {
                        filter:
                            '=getBotTagValues("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "#num._1"),getTag(this, "#num._2")]',
                        'num._1': '1',
                        'num._2': '2',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'filter');

                    expect(value).toEqual([[1, 2]]);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const bot = createBot('test', {
                        filter:
                            '=getBotTagValues("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "num._1"), getTag(this, "num._2")]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'filter');

                    expect(value).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("num")',
                        num: '0',
                    });

                    const bot2 = createBot('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual([0, 1]);
                });

                it('should include false in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("bool")',
                        bool: false,
                    });

                    const bot2 = createBot('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual([false, true]);
                });

                it('should include NaN in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("num")',
                        num: NaN,
                    });

                    const bot2 = createBot('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual([NaN, 1.23]);
                });

                it('should not include empty strings in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("val")',
                        val: '',
                    });

                    const bot2 = createBot('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(['Hi']);
                });

                it('should not include null in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("obj")',
                        obj: null,
                    });

                    const bot2 = createBot('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });

                it('should not include undefined in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBotTagValues("obj")',
                        obj: undefined,
                    });

                    const bot2 = createBot('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });
            });

            describe('getBots()', () => {
                it('should get every bot that has the given tag', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 'hello';
                    bot2.tags.abc = 'world';
                    bot3.tags.abc = '!';

                    bot3.tags.formula = '=getBots("abc")';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    // Order is dependent on the position in the dimension.
                    expect(unwrapped).toEqual([bot1, bot2, bot3]);
                });

                it('should run out of energy in recursive tags', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("formula", "value")',
                    });

                    const context = createCalculationContext([bot]);

                    expect(() => {
                        const val = calculateBotValue(context, bot, 'formula');
                    }).toThrow();
                });

                it('should run out of energy for recursive tags which dont check the tag value', () => {
                    const bot1 = createBot('test1', {
                        formula: '=getBots("formula")',
                    });

                    const context = createCalculationContext([bot1]);
                    expect(() => {
                        const val = calculateBotValue(context, bot1, 'formula');
                    }).toThrow();
                });

                it('should get every bot that has the given tag which matches the filter', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 1;
                    bot2.tags.abc = 2;
                    bot3.tags.abc = 3;

                    bot3.tags.formula = '=getBots("abc", (num => num >= 2))';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    // Order is dependent on the position in the dimension.
                    expect(unwrapped).toEqual([bot2, bot3]);
                });

                it('should handle filters on formulas', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags.abc = 1;
                    bot2.tags.abc = '=2';
                    bot3.tags.abc = 3;

                    bot3.tags.formula = '=getBots("abc", (num => num >= 2))';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot3, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    // Order is dependent on the position in the dimension.
                    expect(unwrapped).toEqual([bot2, bot3]);
                });

                it('should support tags with dots', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['abc.def'] = 1;
                    bot2.tags['abc.def'] = '=2';
                    bot3.tags['abc.def'] = 3;

                    bot3.tags.formula = '=getBots("abc.def")';
                    bot3.tags.formula1 =
                        '=getBots("abc.def", (num => num >= 2))';
                    bot3.tags.formula2 = '=getBots("abc.def", 2).first()';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');
                    let unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot1, bot2, bot3]);

                    value = calculateBotValue(context, bot3, 'formula1');
                    unwrapped = value.map(context.sandbox.interface.unwrapBot);

                    expect(unwrapped).toEqual([bot2, bot3]);

                    value = calculateBotValue(context, bot3, 'formula2');
                    unwrapped = context.sandbox.interface.unwrapBot(value);

                    expect(unwrapped).toEqual(bot2);
                });

                it('should support tags in strings', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['🎶🎉🦊'] = 1;
                    bot2.tags['🎶🎉🦊'] = '=2';
                    bot3.tags['🎶🎉🦊'] = 3;

                    bot3.tags.formula = '=getBots("🎶🎉🦊")';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');
                    let unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot1, bot2, bot3]);
                });

                it('should support tags in strings with filters', () => {
                    const bot1 = createBot('test1');
                    const bot2 = createBot('test2');
                    const bot3 = createBot('test3');
                    const bot4 = createBot('test4');

                    bot1.tags['🎶🎉🦊'] = 1;
                    bot2.tags['🎶🎉🦊'] = '=2';
                    bot3.tags['🎶🎉🦊'] = 3;

                    bot3.tags.formula = '=getBots("🎶🎉🦊", num => num >= 2)';

                    const context = createCalculationContext([
                        bot2,
                        bot1,
                        bot4,
                        bot3,
                    ]);
                    let value = calculateBotValue(context, bot3, 'formula');
                    let unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot2, bot3]);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const bot = createBot('test', {
                        filter:
                            '=getBots("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "num._1"), getTag(this, "num._2")]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'filter');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("num")',
                        num: '0',
                    });

                    const bot2 = createBot('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot, bot2]);
                });

                it('should include false in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("bool")',
                        bool: false,
                    });

                    const bot2 = createBot('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot, bot2]);
                });

                it('should include NaN in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("num")',
                        num: NaN,
                    });

                    const bot2 = createBot('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot, bot2]);
                });

                it('should not include empty strings in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("val")',
                        val: '',
                    });

                    const bot2 = createBot('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot2]);
                });

                it('should not include null in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("obj")',
                        obj: null,
                    });

                    const bot2 = createBot('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot2]);
                });

                it('should get the list of bots with the given tag', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBots("#name")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = result.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([botA, botB, botC]);
                });

                it('should get the list of bots with the given tag matching the given value', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBots("#name", "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = result.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([botA, botC]);
                });

                it('should get the list of bots with the given tag matching the given predicate', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBots("#name", x => x == "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = result.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([botA, botC]);
                });

                it('should not include undefined in results', () => {
                    const bot = createBot('test', {
                        formula: '=getBots("obj")',
                        obj: undefined,
                    });

                    const bot2 = createBot('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot2]);
                });

                it('should return bots matching the given filter function', () => {
                    const bot = createBot('test', {
                        formula: '=getBots(b => b.id === "test2")',
                        abc: 1,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot2]);
                });

                it('should return bots matching all the given filter functions', () => {
                    const bot = createBot('test', {
                        formula:
                            '=getBots(b => getTag(b, "abc") === 2, b => getTag(b, "def") === true)',
                        abc: 1,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                        def: false,
                    });

                    const bot3 = createBot('test3', {
                        abc: 2,
                        def: true,
                    });

                    const context = createCalculationContext([bot, bot2, bot3]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot3]);
                });

                it('should sort bots using the given sort function in the filter functions', () => {
                    const bot = createBot('test', {
                        formula:
                            '=let filter = () => true; filter.sort = b => getTag(b, "order"); getBots(filter)',
                        abc: 1,
                        order: 3,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                        def: false,
                        order: 2,
                    });

                    const bot3 = createBot('test3', {
                        abc: 2,
                        def: true,
                        order: 1,
                    });

                    const context = createCalculationContext([bot, bot2, bot3]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot3, bot2, bot]);
                });

                const falsyCases = [['false', false], ['0', 0]];

                it.each(falsyCases)(
                    'should return only the bots that match %s',
                    (desc, val) => {
                        const bot = createBot('test', {
                            formula: `=getBots("tag", ${val})`,
                        });

                        const bot2 = createBot('test2', {
                            tag: 2,
                        });

                        const bot3 = createBot('test3', {
                            tag: val,
                        });

                        const context = createCalculationContext([
                            bot,
                            bot2,
                            bot3,
                        ]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        expect(value).toMatchObject([bot3]);
                    }
                );

                it.each(falsyCases)(
                    'should return only the bots that match %s when using byTag()',
                    (desc, val) => {
                        const bot = createBot('test', {
                            formula: `=getBots(byTag("tag", ${val}))`,
                        });

                        const bot2 = createBot('test2', {
                            tag: 2,
                        });

                        const bot3 = createBot('test3', {
                            tag: val,
                        });

                        const context = createCalculationContext([
                            bot,
                            bot2,
                            bot3,
                        ]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        expect(value).toMatchObject([bot3]);
                    }
                );

                it('should return all bots if no arguments are provdided', () => {
                    const bot = createBot('test', {
                        formula: '=getBots()',
                        abc: 1,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = value.map(
                        context.sandbox.interface.unwrapBot
                    );

                    expect(unwrapped).toEqual([bot, bot2]);
                });

                const emptyCases = [['null', 'null'], ['empty string', '""']];

                it.each(emptyCases)(
                    'should return an empty array if a %s tag is provided',
                    (desc, val) => {
                        const bot = createBot('test', {
                            formula: `=getBots(${val})`,
                            abc: 1,
                        });

                        const bot2 = createBot('test2', {
                            abc: 2,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        expect(value).toEqual([]);
                    }
                );
            });

            describe('getBot()', () => {
                it('should get the first bot with the given tag', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBot("#name")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botB, botA]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should get the first bot matching the given value', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBot("#name", "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should remove the first hashtag but not the second', () => {
                    const botA = createBot('a', {
                        '#name': 'bob',
                        formula: '=getBot("##name")',
                    });
                    const botB = createBot('b', {
                        '#name': 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA, botB]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should allow using @ symbols when getting bots by tags', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBot("@name")',
                    });
                    const botB = createBot('b', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA, botB]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should remove the first @ symbol but not the second', () => {
                    const botA = createBot('a', {
                        '@name': 'bob',
                        formula: '=getBot("@@name")',
                    });
                    const botB = createBot('b', {
                        '@name': 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA, botB]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should get the first bot matching the given filter function', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBot("#name", x => x == "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        result
                    );

                    expect(unwrapped).toEqual(botA);
                });

                it('should return the first bot matching the given filter function', () => {
                    const bot = createBot('test', {
                        formula: '=getBot(b => getTag(b, "abc") === 2)',
                        abc: 2,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([bot2, bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        value
                    );

                    expect(unwrapped).toMatchObject(bot);
                });

                it('should return the first bot bot matching all the given filter functions', () => {
                    const bot = createBot('test', {
                        formula:
                            '=getBot(b => getTag(b, "abc") === 2, b => getTag(b, "def") === true)',
                        abc: 1,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                        def: false,
                    });

                    const bot3 = createBot('test3', {
                        abc: 2,
                        def: true,
                    });

                    const bot4 = createBot('test4', {
                        abc: 2,
                        def: true,
                    });

                    const context = createCalculationContext([
                        bot4,
                        bot,
                        bot2,
                        bot3,
                    ]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        value
                    );

                    expect(unwrapped).toMatchObject(bot3);
                });

                it('should return the first bot if no arguments are provdided', () => {
                    const bot = createBot('test', {
                        formula: '=getBot()',
                        abc: 1,
                    });

                    const bot2 = createBot('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const unwrapped = context.sandbox.interface.unwrapBot(
                        value
                    );

                    expect(unwrapped).toEqual(bot);
                });

                const emptyCases = [['null', 'null'], ['empty string', '""']];

                it.each(emptyCases)(
                    'should return undefined if a %s tag is provided',
                    (desc, val) => {
                        const bot = createBot('test', {
                            formula: `=getBot(${val})`,
                            abc: 1,
                        });

                        const bot2 = createBot('test2', {
                            abc: 2,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        expect(value).toEqual(undefined);
                    }
                );
            });

            describe('getBotTagValues()', () => {
                it('should get the list of values with the given tag', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual(['bob', 'alice', 'bob']);
                });

                it('should support using an @ symbol at the beginning of a tag', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("@name")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual(['bob', 'alice', 'bob']);
                });

                it('should get the list of bots with the given tag matching the given value', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name", "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual(['bob', 'bob']);
                });

                it('should get the list of bots with the given tag matching the given predicate', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name", x => x == "bob")',
                    });
                    const botB = createBot('b', {
                        name: 'alice',
                    });
                    const botC = createBot('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botB,
                        botA,
                        botC,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual(['bob', 'bob']);
                });
            });

            describe('getTag()', () => {
                it('should get the specified tag value', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getTag(this, "#name")',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual('bob');
                });

                it('should support using an @ symbol at the beginning of a tag', () => {
                    const botA = createBot('a', {
                        name: 'bob',
                        formula: '=getTag(this, "@name")',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual('bob');
                });

                it('should calculate formulas', () => {
                    const botA = createBot('a', {
                        name: '="bob"',
                        formula: '=getTag(this, "#name")',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([botA]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual('bob');
                });

                it('should be able to get a chain of tags', () => {
                    const botA = createBot('a', {
                        bot: '=getBot("#name", "bob")',
                        formula: '=getTag(this, "#bot", "#bot", "#name")',
                    });

                    const botB = createBot('b', {
                        name: 'bob',
                        bot: '=getBot("#name", "alice")',
                    });

                    const botC = createBot('c', {
                        name: 'alice',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        botC,
                        botB,
                        botA,
                    ]);
                    const result = calculateBotValue(context, botA, 'formula');

                    expect(result).toEqual('alice');
                });

                it.each(possibleTagNameCases)(
                    'should convert %s to %s',
                    (given, expected) => {
                        const botA = createBot('a', {
                            [expected]: 'bob',
                            formula: `=getTag(this, ${given})`,
                        });

                        // specify the UUID to use next
                        uuidMock.mockReturnValue('uuid-0');
                        const context = createCalculationContext([botA]);
                        const result = calculateBotValue(
                            context,
                            botA,
                            'formula'
                        );

                        expect(result).toEqual('bob');
                    }
                );
            });

            describe('byTag()', () => {
                describe('just tag', () => {
                    const cases = [
                        [true, 'a bot has the given tag', 0],
                        [false, 'a bot has null for the given tag', null],
                        [
                            false,
                            'a bot has undefined for the given tag',
                            undefined,
                        ],
                    ];

                    it.each(cases)(
                        'should return a function that returns %s if %s',
                        (expected, desc, val) => {
                            const bot = createBot('test', {
                                formula: '=byTag("red")',
                            });

                            const context = createCalculationContext([bot]);
                            const value = calculateBotValue(
                                context,
                                bot,
                                'formula'
                            );

                            const bot2 = createBot('test', {
                                red: val,
                            });

                            expect(value(bot2)).toBe(expected);
                        }
                    );

                    it('should support using a hashtag at the beginning of a tag', () => {
                        const bot = createBot('test', {
                            formula: '=byTag("#red")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 'abc',
                        });

                        expect(value(bot2)).toBe(true);
                    });

                    it('should support using a @ symbol at the beginning of a tag', () => {
                        const bot = createBot('test', {
                            formula: '=byTag("@red")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 'abc',
                        });

                        expect(value(bot2)).toBe(true);
                    });
                });

                describe('tag + value', () => {
                    it('should return a function that returns true when the value matches the tag', () => {
                        const bot = createBot('test', {
                            formula: '=byTag("red", "abc")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 'abc',
                        });

                        expect(value(bot2)).toBe(true);
                    });

                    it('should return a function that returns true when the value does not match the tag', () => {
                        const bot = createBot('test', {
                            formula: '=byTag("red", "abc")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 123,
                        });

                        expect(value(bot2)).toBe(false);
                    });

                    const falsyCases = [['zero', 0], ['false', false]];

                    it.each(falsyCases)('should work with %s', (desc, val) => {
                        const bot = createBot('test', {
                            formula: `=byTag("red", ${val})`,
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 1,
                        });
                        const bot3 = createBot('test', {
                            red: val,
                        });

                        expect(value(bot2)).toBe(false);
                        expect(value(bot3)).toBe(true);
                    });

                    it('should be able to match bots without the given tag using null', () => {
                        const bot = createBot('test', {
                            formula: `=byTag("red", null)`,
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot2 = createBot('test', {
                            red: 1,
                        });
                        const bot3 = createBot('test', {
                            abc: 'def',
                        });

                        expect(value(bot2)).toBe(false);
                        expect(value(bot3)).toBe(true);
                    });
                });

                describe('tag + filter', () => {
                    it('should return a function that returns true when the function returns true', () => {
                        const bot = createBot('test', {
                            formula:
                                '=byTag("red", tag => typeof tag === "number")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );
                        const bot2 = createBot('test', {
                            red: 123,
                        });

                        expect(value(bot2)).toBe(true);
                    });

                    it('should return a function that returns false when the function returns false', () => {
                        const bot = createBot('test', {
                            formula:
                                '=byTag("red", tag => typeof tag === "number")',
                        });

                        const context = createCalculationContext([bot]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );
                        const bot2 = createBot('test', {
                            red: 'test',
                        });

                        expect(value(bot2)).toBe(false);
                    });
                });
            });

            describe('byMod()', () => {
                it('should match bots with all of the same tags and values', () => {
                    const bot = createBot('test', {
                        formula: `=byMod({
                            "auxColor": "red",
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        auxColor: 'red',
                        number: 123,
                        other: true,
                    });

                    expect(value(bot2)).toBe(true);
                });

                it('should not match bots with wrong tag values', () => {
                    const bot = createBot('test', {
                        formula: `=byMod({
                            "auxColor": "red",
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        auxColor: 'red',
                        number: 999,
                        other: true,
                    });

                    expect(value(bot2)).toBe(false);
                });

                it('should match tags using the given filter', () => {
                    const bot = createBot('test', {
                        formula: `=byMod({
                            "auxColor": x => x.startsWith("r"),
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        auxColor: 'rubble',
                        number: 123,
                        other: true,
                    });

                    expect(value(bot2)).toBe(true);
                });

                it('should match tags with null', () => {
                    const bot = createBot('test', {
                        formula: `=byMod({
                            "auxColor": null,
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        number: 123,
                        other: true,
                    });

                    const bot3 = createBot('test', {
                        auxColor: false,
                        number: 123,
                        other: true,
                    });

                    expect(value(bot2)).toBe(true);
                    expect(value(bot3)).toBe(false);
                });
            });

            describe('inDimension()', () => {
                it('should return a function that returns true if the bot is in the given dimension', () => {
                    const bot = createBot('test', {
                        formula: '=inDimension("red")',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        red: true,
                    });

                    expect(value(bot2)).toBe(true);
                });

                it('should return a function that returns false if the bot is not in the given dimension', () => {
                    const bot = createBot('test', {
                        formula: '=inDimension("red")',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {});

                    expect(value(bot2)).toBe(false);
                });
            });

            describe('inStack()', () => {
                it('should return a function that returns true if the bot is in the same stack as another bot', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const bot2 = createBot('test2', {
                        red: true,
                        redX: 1,
                        redY: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        redX: 1,
                        redY: 2,
                    });

                    expect(value(bot3)).toBe(true);
                });

                it('should return a function that returns false if the bot is not in the same stack as another bot', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const bot2 = createBot('test2', {
                        red: true,
                        redX: 1,
                        redY: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        redX: 1,
                        redY: 3,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function that returns false if the bot is not in the same dimension as another bot', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const bot2 = createBot('test2', {
                        red: true,
                        redX: 1,
                        redY: 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: false,
                        redX: 1,
                        redY: 2,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function with a sort function that sorts the bots by their sort order', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        redX: 1,
                        redY: 2,
                        redSortOrder: 100,
                    });

                    expect(typeof value.sort).toBe('function');
                    expect(value.sort(bot3)).toBe(100);
                });
            });

            describe('atPosition()', () => {
                it('should return a function that returns true if the bot is at the given position', () => {
                    const bot = createBot('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        redX: 1,
                        redY: 2,
                    });

                    expect(value(bot3)).toBe(true);
                });

                it('should return a function that returns false if the bot is not at the given position', () => {
                    const bot = createBot('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        redX: 1,
                        redY: 3,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function that returns false if the bot is not in the given dimension', () => {
                    const bot = createBot('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: false,
                        redX: 1,
                        redY: 2,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function with a sort function that sorts the bots by their sort order', () => {
                    const bot = createBot('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: false,
                        redX: 1,
                        redY: 2,
                        redSortOrder: 100,
                    });

                    expect(typeof value.sort).toBe('function');
                    expect(value.sort(bot3)).toBe(100);
                });
            });

            describe('bySpace()', () => {
                it('should return a function that returns true if the bot is in given space', () => {
                    const bot = createBot('test', {
                        formula: '=bySpace("test")(getBot("id", "test2"))',
                    });

                    const bot2 = createBot('test2', {}, <any>'test');

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(true);
                });
            });

            describe('byCreator()', () => {
                it('should return a function that returns true if the bot is created by the given bot', () => {
                    const bot = createBot('test', {
                        formula: '=byCreator(this)(getBot("id", "test2"))',
                    });

                    const bot2 = createBot('test2', {
                        auxCreator: 'test',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(true);
                });

                it('should return a function that returns true if the bot is created by the given bot ID', () => {
                    const bot = createBot('test', {
                        formula: '=byCreator("test")(getBot("id", "test2"))',
                    });

                    const bot2 = createBot('test2', {
                        auxCreator: 'test',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(true);
                });

                it('should return a function that returns false if the bot not is created by the given bot ID', () => {
                    const bot = createBot('test', {
                        formula: '=byCreator("test")(getBot("id", "test2"))',
                    });

                    const bot2 = createBot('test2', {
                        auxCreator: 'other',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(false);
                });

                it('should return a function that returns false if the bot not is created by the given bot', () => {
                    const bot = createBot('test', {
                        formula: '=byCreator(this)(getBot("id", "test2"))',
                    });

                    const bot2 = createBot('test2', {
                        auxCreator: 'other',
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(false);
                });
            });

            describe('neighboring()', () => {
                const directionCases = [
                    ['front', 0, -1],
                    ['back', 0, 1],
                    ['left', 1, 0],
                    ['right', -1, 0],
                ];

                describe.each(directionCases)('%s', (direction, x, y) => {
                    it('should return a function that returns true if the given bot is at the correct position', () => {
                        const bot = createBot('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const bot2 = createBot('test2', {
                            red: true,
                            redX: 0,
                            redY: 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            redX: x,
                            redY: y,
                        });

                        expect(value(bot3)).toBe(true);
                    });

                    it('should return a function that returns false if the given bot is not at the correct position', () => {
                        const bot = createBot('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const bot2 = createBot('test2', {
                            red: true,
                            redX: 0,
                            redY: 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            redX: -x,
                            redY: -y,
                        });

                        expect(value(bot3)).toBe(false);
                    });

                    it('should return a function with a sort function that sorts the bots by their sort order', () => {
                        const bot = createBot('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const bot2 = createBot('test2', {
                            red: true,
                            redX: 0,
                            redY: 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            redX: x,
                            redY: y,
                            redSortOrder: 100,
                        });

                        expect(typeof value.sort).toBe('function');
                        expect(value.sort(bot3)).toBe(100);
                    });
                });
            });

            describe('either()', () => {
                it('should return a function that returns true when any of the given functions return true', () => {
                    const bot = createBot('test', {
                        formula: '=either(b => false, b => true)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {});

                    expect(value(bot2)).toBe(true);
                });

                it('should return a function that returns false when all of the given functions return false', () => {
                    const bot = createBot('test', {
                        formula: '=either(b => false, b => false)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {});

                    expect(value(bot2)).toBe(false);
                });

                it('should return a function that doesnt have a sort function', () => {
                    const bot = createBot('test', {
                        formula: `=either(b => false, b => false)`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {});

                    expect(typeof value.sort).toBe('undefined');
                });
            });

            describe('not()', () => {
                it('should return a function which negates the given function results', () => {
                    const bot = createBot('test', {
                        formula: `=not(b => b.id === "test2")`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test2', {});

                    expect(value(bot2)).toBe(false);
                    expect(value(bot)).toBe(true);
                });
            });

            describe('tags', () => {
                it('should define a tags variable which is the tags on the bot', () => {
                    const bot = createBot('test', {
                        auxColor: 'red',
                        formula: `=tags.auxColor`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('red');
                });

                it('should throw error in infinite loops', () => {
                    const bot = createBot('bot', {
                        auxColor: 'red',
                        formula: '=tags.formula',
                    });

                    const context = createCalculationContext([bot]);

                    expect(() => {
                        calculateBotValue(context, bot, 'formula');
                    }).toThrow();
                });

                it('should not throw error serializing tags', () => {
                    const bot = createBot('bot', {
                        auxColor: 'red',
                        formula: '=JSON.stringify(tags)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(
                        JSON.stringify({
                            auxColor: 'red',
                            formula: '=JSON.stringify(tags)',
                        })
                    );
                });
            });

            describe('raw', () => {
                it('should define a raw variable which is a mod of tags on the bot', () => {
                    const bot = createBot('test', {
                        auxColor: '="red"',
                        formula: `=raw.auxColor`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('="red"');
                });

                it('should throw error in infinite loops', () => {
                    const bot = createBot('bot', {
                        auxColor: 'red',
                        formula: '=tags.formula',
                    });

                    const context = createCalculationContext([bot]);

                    expect(() => {
                        calculateBotValue(context, bot, 'formula');
                    }).toThrow();
                });

                it('should not throw error serializing tags', () => {
                    const bot = createBot('bot', {
                        auxColor: 'red',
                        formula: '=JSON.stringify(raw)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(
                        JSON.stringify({
                            auxColor: 'red',
                            formula: '=JSON.stringify(raw)',
                        })
                    );
                });
            });

            describe('creator', () => {
                it('should define a creator variable which is the bot that created this', () => {
                    const bot = createBot('test', {
                        auxCreator: 'other',
                        formula: `=creator.id`,
                    });
                    const other = createBot('other', {});

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('other');
                });
            });

            describe('config', () => {
                it('should define a config variable which is the bot that referenced by auxConfigBot', () => {
                    const bot = createBot('test', {
                        auxConfigBot: 'other',
                        formula: `=config.id`,
                    });
                    const other = createBot('other', {});

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('other');
                });
            });

            describe('tagName', () => {
                it('should define a tagName variable which is equal to the current tag', () => {
                    const bot = createBot('test', {
                        formula: `=tagName`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('formula');
                });
            });

            describe('configTag', () => {
                it('should define a configTag variable which is equal to config.tags[tagName]', () => {
                    const bot = createBot('test', {
                        auxConfigBot: 'other',
                        formula: `=configTag`,
                    });
                    const other = createBot('other', {
                        formula: 'abc',
                    });

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('abc');
                });
            });

            describe('getID()', () => {
                it('should get the ID of the given bot', () => {
                    const bot = createBot('test', {
                        formula: `=getID(bot)`,
                    });
                    const other = createBot('other', {});

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('test');
                });

                it('should return the given ID', () => {
                    const bot = createBot('test', {
                        formula: `=getID("haha")`,
                    });
                    const other = createBot('other', {});

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual('haha');
                });

                it('should handle null values', () => {
                    const bot = createBot('test', {
                        formula: `=getID(null)`,
                    });
                    const other = createBot('other', {});

                    const context = createCalculationContext([bot, other]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(null);
                });
            });

            describe('getJSON()', () => {
                it('should convert objects to JSON', () => {
                    const bot = createBot('test', {
                        formula: `=getJSON({ abc: "def" })`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(
                        JSON.stringify({
                            abc: 'def',
                        })
                    );
                });

                it('should convert bots to JSON', () => {
                    const bot = createBot('test', {
                        formula: `=getJSON(this)`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toEqual(
                        JSON.stringify({
                            id: 'test',
                            tags: {
                                formula: `=getJSON(this)`,
                            },
                        })
                    );
                });

                it('should should be the same as JSON.stringify()', () => {
                    const bot = createBot('test', {
                        formula: `=getJSON(this) === JSON.stringify(this)`,
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    expect(value).toBe(true);
                });
            });
        });
    });

    describe('calculateCopiableValue()', () => {
        it('should catch errors from calculateBotValue()', () => {
            const bot1 = createBot('test1', {
                formula: '=throw new Error("Test")',
            });

            const context = createCalculationContext([bot1]);
            const result = calculateCopiableValue(
                context,
                bot1,
                'formula',
                bot1.tags['formula']
            );

            expect(result).toEqual('Error: Test');
        });

        it('should unwrap ScriptBot objects', () => {
            const bot1 = createBot('test1', {
                formula: '=getBot("name", "bob")',
            });
            const bot2 = createBot('test1', {
                name: 'bob',
                formula: '=10',
            });

            const context = createCalculationContext([bot1, bot2]);
            const result = calculateCopiableValue(
                context,
                bot1,
                'formula',
                bot1.tags['formula']
            );

            expect(result).toEqual(bot2);
        });
    });

    describe('convertToCopiableValue()', () => {
        it('should leave strings alone', () => {
            const result = convertToCopiableValue('test');
            expect(result).toBe('test');
        });

        it('should leave numbers alone', () => {
            const result = convertToCopiableValue(0.23);
            expect(result).toBe(0.23);
        });

        it('should leave booleans alone', () => {
            const result = convertToCopiableValue(true);
            expect(result).toBe(true);
        });

        it('should leave objects alone', () => {
            const obj = {
                test: 'abc',
            };
            const result = convertToCopiableValue(obj);
            expect(result).toEqual(obj);
        });

        it('should leave arrays alone', () => {
            const arr = ['abc'];
            const result = convertToCopiableValue(arr);
            expect(result).toEqual(arr);
        });

        it('should convert invalid properties in objects recursively', () => {
            const obj = {
                test: 'abc',
                func: function abc() {},
                err: new Error('qwerty'),
                nested: {
                    func: function def() {},
                    err: new SyntaxError('syntax'),
                },
                arr: [function ghi() {}, new Error('other')],
            };
            const result = convertToCopiableValue(obj);
            expect(result).toEqual({
                test: 'abc',
                func: '[Function abc]',
                err: 'Error: qwerty',
                nested: {
                    func: '[Function def]',
                    err: 'SyntaxError: syntax',
                },
                arr: ['[Function ghi]', 'Error: other'],
            });
        });

        it('should convert invalid properties in arrays recursively', () => {
            const arr = [
                'abc',
                function abc() {},
                new Error('qwerty'),
                {
                    func: function def() {},
                    err: new SyntaxError('syntax'),
                },
                [function ghi() {}, new Error('other')],
            ];
            const result = convertToCopiableValue(arr);
            expect(result).toEqual([
                'abc',
                '[Function abc]',
                'Error: qwerty',
                {
                    func: '[Function def]',
                    err: 'SyntaxError: syntax',
                },
                ['[Function ghi]', 'Error: other'],
            ]);
        });

        it('should remove the metadata property from bots', () => {
            const obj: any = {
                id: 'test',
                metadata: {
                    ref: null,
                    tags: null,
                },
                tags: {},
            };
            const result = convertToCopiableValue(obj);
            expect(result).toEqual({
                id: 'test',
                tags: {},
            });
        });

        it('should convert functions to a string', () => {
            function test() {}
            const result = convertToCopiableValue(test);

            expect(result).toBe('[Function test]');
        });

        const errorCases = [
            ['Error', new Error('abcdef'), 'Error: abcdef'],
            ['SyntaxError', new SyntaxError('xyz'), 'SyntaxError: xyz'],
        ];

        it.each(errorCases)(
            'should convert %s to a string',
            (desc, err, expected) => {
                const result = convertToCopiableValue(err);
                expect(result).toBe(expected);
            }
        );

        it('should convert script bots into normal bots', () => {
            const bot = createBot('bot1', {
                abc: 'def',
                number: 123,
                formula: '=10',
                script: '@player.toast("Hi!")',
            });

            const calc = createCalculationContext([bot]);
            const script = calc.sandbox.interface.getBot('bot1');
            const result = convertToCopiableValue(script);

            expect(result).not.toBe(bot);
            expect(result).toEqual({
                id: 'bot1',
                tags: {
                    abc: 'def',
                    number: 123,
                    formula: '=10',
                    script: '@player.toast("Hi!")',
                },
            });
        });

        it('should return an object that is structure clonable', () => {
            const bot = createBot('bot1', {
                abc: 'def',
                number: 123,
                formula: '=10',
                script: '@player.toast("Hi!")',
            });

            const calc = createCalculationContext([bot]);
            const script = calc.sandbox.interface.getBot('bot1');
            const result = convertToCopiableValue(script);

            expect(types.isProxy(result.tags)).toBe(false);
        });
    });

    describe('calculateBooleanTagValue()', () => {
        booleanTagValueTests(false, (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createCalculationContext([bot]);
            expect(calculateBooleanTagValue(calc, bot, 'tag', false)).toBe(
                expected
            );
        });
    });

    describe('calculateStringTagValue()', () => {
        stringTagValueTests('test', (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createCalculationContext([bot]);
            expect(calculateStringTagValue(calc, bot, 'tag', 'test')).toBe(
                expected
            );
        });
    });

    describe('calculateNumericalTagValue()', () => {
        numericalTagValueTests(null, (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createCalculationContext([bot]);
            expect(calculateNumericalTagValue(calc, bot, 'tag', null)).toBe(
                expected
            );
        });
    });

    describe('updateBot()', () => {
        it('should do nothing if there is no new data', () => {
            let bot: Bot = createBot();
            let newData = {};

            updateBot(bot, 'testUser', newData, () =>
                createCalculationContext([bot])
            );

            expect(newData).toEqual({});
        });

        it('should set leave falsy fields alone in newData', () => {
            let bot: Bot = createBot();
            let newData = {
                tags: {
                    a: false,
                    b: '',
                    c: 0,
                    d: <any>[],
                    e: <any>null,
                    f: <any>undefined,
                    g: NaN,
                },
            };

            updateBot(bot, 'testUser', newData, () =>
                createCalculationContext([bot])
            );

            expect(newData).toEqual({
                tags: {
                    a: false,
                    b: '',
                    c: 0,
                    d: [],
                    e: null,
                    f: undefined,
                    g: NaN,
                },
            });
        });

        it('should calculate assignment formulas', () => {
            let bot = createBot();
            bot.tags.num = 5;

            let newData: any = {
                tags: {
                    sum: ':=getTag(this, "#num") + 5',
                },
            };

            updateBot(bot, 'testUser', newData, () =>
                createCalculationContext([bot])
            );

            expect(newData.tags.sum.value).toBe(10);
            expect(newData.tags.sum.formula).toBe(':=getTag(this, "#num") + 5');
        });
    });

    describe('isMergeable()', () => {
        it('should return true if the bot is stackable', () => {
            const bot1 = createBot(undefined, { auxPositioningMode: 'stack' });
            const update1 = isMergeable(createCalculationContext([bot1]), bot1);

            expect(update1).toBe(true);
        });

        it('should return true if the bot is not stackable', () => {
            const bot1 = createBot(undefined, {
                auxPositioningMode: 'absolute',
            });
            const update1 = isMergeable(createCalculationContext([bot1]), bot1);

            expect(update1).toBe(true);
        });
    });

    describe('isPickupable()', () => {
        const cases = [
            [true, true],
            [true, 'move'],
            [true, 'any'],
            [false, 'none'],
            [true, 'drag'],
            [false, 'moveOnly'],
            [true, 'clone'],
            [true, 'pickup'],
            [true, 'pickupOnly'],
            [true, false],
        ];

        it.each(cases)('should return %s if set to %s', (expected, value) => {
            const bot1 = createBot(undefined, {
                auxDraggable: true,
                auxDraggableMode: value,
            });
            const update1 = isPickupable(
                createCalculationContext([bot1]),
                bot1
            );

            expect(update1).toBe(expected);
        });
    });

    describe('isUserActive()', () => {
        it('should return true if the auxPlayerActive tag is true', () => {
            dateNowMock.mockReturnValue(1000 * 60 + 999);
            const bot1 = createBot(undefined, {
                auxPlayerActive: true,
            });
            const calc = createCalculationContext([bot1]);
            const update1 = isUserActive(calc, bot1);

            expect(update1).toBe(true);
        });

        it('should return false if the user is not active', () => {
            dateNowMock.mockReturnValue(1000);
            const bot1 = createBot(undefined, {
                auxPlayerActive: false,
            });
            const calc = createCalculationContext([bot1]);
            const update1 = isUserActive(calc, bot1);

            expect(update1).toBe(false);
        });
    });

    describe('isSimulation()', () => {
        let cases = [
            ['', false],
            [null, false],
            [0, false],
            ['=false', false],
            ['=0', false],
            ['a', true],
            [1, true],
            [true, true],
            ['=1', true],
            ['="hello"', true],
        ];

        it.each(cases)(
            'should map auxUniverse:%s to %s',
            (value: string, expected: boolean) => {
                let bot = createBot('test', {
                    auxUniverse: value,
                });

                const calc = createCalculationContext([bot]);
                expect(isSimulation(calc, bot)).toBe(expected);
            }
        );
    });

    describe('isDestroyable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let bot = createBot('test', {
                auxDestroyable: value,
            });

            const calc = createCalculationContext([bot]);
            expect(isDestroyable(calc, bot)).toBe(expected);
        });
    });

    describe('isEditable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let bot = createBot('test', {
                auxEditable: value,
            });

            const calc = createCalculationContext([bot]);
            expect(isEditable(calc, bot)).toBe(expected);
        });
    });

    describe('isMinimized()', () => {
        it('should return true when auxPortalSurfaceMinimized is true', () => {
            let bot = createBot('test', {
                auxPortalSurfaceMinimized: true,
            });
            const context = createCalculationContext([bot]);
            expect(isMinimized(context, bot)).toBe(true);
        });

        it('should return false when auxPortalSurfaceMinimized is not true', () => {
            let bot = createBot('test', {
                auxPortalSurfaceMinimized: false,
            });
            const context = createCalculationContext([bot]);
            expect(isMinimized(context, bot)).toBe(false);
        });
    });

    describe('duplicateBot()', () => {
        beforeAll(() => {
            uuidMock.mockReturnValue('test');
        });

        it('should return a copy with a different ID', () => {
            const first: Bot = createBot('id');
            first.tags.fun = 'abc';

            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.id).toBe('test');
            expect(second.tags).toEqual(first.tags);
        });

        it('should not have any auto-generated contexts or selections', () => {
            let first: Bot = createBot('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';
            first.tags[`aux._context_abcdefg`] = true;
            first.tags[`aux._context_1234567`] = true;
            first.tags[`aux._context_1234567X`] = 1;
            first.tags[`aux._context_1234567Y`] = 2;
            first.tags[`aux._context_1234567Z`] = 3;
            first.tags[`_auxSelection99999`] = true;

            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
            });
            expect(first.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
                'aux._context_abcdefg': true,
                'aux._context_1234567': true,
                'aux._context_1234567X': 1,
                'aux._context_1234567Y': 2,
                'aux._context_1234567Z': 3,
                _auxSelection99999: true,
            });
        });

        it('should keep the tags that the new data contains', () => {
            let first: Bot = createBot('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';

            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first, {
                tags: {
                    [`_auxSelection99999`]: true,
                    [`aux._context_abcdefg`]: true,
                },
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
                'aux._context_abcdefg': true,
                _auxSelection99999: true,
            });
        });

        it('should merge in the additional changes', () => {
            let first: Bot = createBot('id', {
                testTag: 'abcdefg',
                name: 'ken',
            });
            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first, {
                tags: {
                    name: 'abcdef',
                },
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                testTag: 'abcdefg',
                name: 'abcdef',
            });
        });

        it('should not modify the original bot', () => {
            let first: Bot = createBot('id');
            first.tags['_auxHidden'] = true;
            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first);

            expect(first.tags['_auxHidden']).toBe(true);
        });

        it('should not have any contexts', () => {
            let first: Bot = createBot('id', {
                abc: true,
                abcX: 1,
                abcY: 2,
                def: true,
            });
            let dimension: Bot = createBot('dimension', {
                auxDimensionConfig: 'abc',
            });

            const calc = createCalculationContext([dimension, first]);
            const second = duplicateBot(calc, first);

            expect(second.tags).toEqual({
                def: true,
            });
        });
    });

    describe('isBotMovable()', () => {
        it('should return true when auxDraggable has no value', () => {
            let bot = createBot('test', {});
            const context = createCalculationContext([bot]);
            expect(isBotMovable(context, bot)).toBe(true);
        });

        it('should return false when auxDraggable is false', () => {
            let bot = createBot('test', {
                ['auxDraggable']: false,
            });
            const context = createCalculationContext([bot]);
            expect(isBotMovable(context, bot)).toBe(false);
        });

        it('should return false when auxDraggable calculates to false', () => {
            let bot = createBot('test', {
                ['auxDraggable']: '=false',
            });
            const context = createCalculationContext([bot]);
            expect(isBotMovable(context, bot)).toBe(false);
        });

        it('should return true when auxDraggable has any other value', () => {
            let bot = createBot('test', {
                ['auxDraggable']: 'anything',
            });
            const context = createCalculationContext([bot]);
            expect(isBotMovable(context, bot)).toBe(true);
        });
    });

    describe('getBotDragMode()', () => {
        const cases = [
            ['all', 'all'],
            ['all', 'adfsdfa'],
            ['all', true],
            ['none', 'none'],
            ['all', 0],
            ['all', 'clone'],
            ['pickupOnly', 'pickupOnly'],
            ['moveOnly', 'moveOnly'],
            ['all', 'diff'],
            ['all', 'cloneMod'],
            ['all', false],
        ];

        it.each(cases)('should return %s for %s', (expected, val) => {
            const bot1 = createBot('bot1', {
                auxDraggable: true,
                auxDraggableMode: val,
            });
            const result = getBotDragMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe(expected);
        });

        it('should return none when auxDraggable is false', () => {
            const bot1 = createBot('bot1', {
                auxDraggable: false,
                auxDraggableMode: 'all',
            });
            const result = getBotDragMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('none');
        });

        it('should default to all', () => {
            const bot1 = createBot('bot1', {});
            const result = getBotDragMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('all');
        });

        it('should return the default when given an invalid value', () => {
            const bot1 = createBot('bot1', { auxDraggable: <any>'test' });
            const result = getBotDragMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('all');
        });
    });

    describe('isBotStackable()', () => {
        it('should return true when auxPositioningMode is stackable', () => {
            let bot = createBot('test', {});
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(true);
        });

        it('should return false when auxPositioningMode is absolute', () => {
            let bot = createBot('test', {
                auxPositioningMode: 'absolute',
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(false);
        });

        it('should return false when auxPositioningMode calculates to absolute', () => {
            let bot = createBot('test', {
                auxPositioningMode: '="absolute"',
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(false);
        });

        it('should return true when auxPositioningMode has any other value', () => {
            let bot = createBot('test', {
                auxPositioningMode: 'anything',
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(true);
        });
    });

    describe('getBotPositioningMode()', () => {
        it('should return stack when auxPositioningMode is not set', () => {
            const bot1 = createBot('bot1', {});
            const result = getBotPositioningMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('stack');
        });

        it('should return absolute when auxPositioningMode is set to it', () => {
            const bot1 = createBot('bot1', {
                auxPositioningMode: 'absolute',
            });
            const result = getBotPositioningMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('absolute');
        });

        it('should return stack when auxPositioningMode is set to it', () => {
            const bot1 = createBot('bot1', {
                auxPositioningMode: 'stack',
            });
            const result = getBotPositioningMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('stack');
        });

        it('should return stack when auxPositioningMode is set to a random value', () => {
            const bot1 = createBot('bot1', {
                auxPositioningMode: <any>'abc',
            });
            const result = getBotPositioningMode(
                createCalculationContext([bot1]),
                bot1
            );

            expect(result).toBe('stack');
        });
    });

    describe('getBotShape()', () => {
        const cases = [['cube'], ['sphere'], ['sprite'], ['mesh'], ['iframe']];
        it.each(cases)('should return %s', (shape: string) => {
            const bot = createBot('test', {
                auxForm: <any>shape,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotShape(calc, bot)).toBe(shape);
        });

        it('should default to cube', () => {
            const bot = createBot();

            const calc = createCalculationContext([bot]);
            const shape = getBotShape(calc, bot);

            expect(shape).toBe('cube');
        });

        it('should return the shape from auxForm', () => {
            let bot = createBot();
            bot.tags['auxForm'] = 'sphere';

            const calc = createCalculationContext([bot]);
            const shape = getBotShape(calc, bot);

            expect(shape).toBe('sphere');
        });
    });

    describe('getBotSubShape()', () => {
        const cases = [['gltf'], ['src'], ['html']];
        it.each(cases)('should return %s', (shape: string) => {
            const bot = createBot('test', {
                auxFormSubtype: <any>shape,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotSubShape(calc, bot)).toBe(shape);
        });

        it('should default to null', () => {
            const bot = createBot();

            const calc = createCalculationContext([bot]);
            const shape = getBotSubShape(calc, bot);

            expect(shape).toBe(null);
        });
    });

    describe('getBotOrientationMode()', () => {
        const cases = [['absolute'], ['billboard'], ['billboardZ']];
        it.each(cases)('should return %s', (mode: string) => {
            const bot = createBot('test', {
                auxOrientationMode: <any>mode,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotOrientationMode(calc, bot)).toBe(mode);
        });

        it('should default to absolute', () => {
            const bot = createBot();

            const calc = createCalculationContext([bot]);
            const shape = getBotOrientationMode(calc, bot);

            expect(shape).toBe('absolute');
        });
    });

    describe('getBotAnchorPoint()', () => {
        const cases = [
            ['center'],
            ['front'],
            ['back'],
            ['bottom'],
            ['bottomFront'],
            ['bottomBack'],
            ['top'],
            ['topFront'],
            ['topBack'],
        ];

        it.each(cases)('should return %s', (mode: string) => {
            const bot = createBot('test', {
                auxAnchorPoint: <any>mode,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotAnchorPoint(calc, bot)).toBe(mode);
        });

        it('should default to bottom', () => {
            const bot = createBot();

            const calc = createCalculationContext([bot]);
            const shape = getBotAnchorPoint(calc, bot);

            expect(shape).toBe('bottom');
        });
    });

    describe('calculatePortalPointerDragMode()', () => {
        const cases = [['grid'], ['world']];
        it.each(cases)('should return %s', (mode: string) => {
            const bot = createBot('test', {
                auxPortalPointerDragMode: <any>mode,
            });

            const calc = createCalculationContext([bot]);

            expect(calculatePortalPointerDragMode(calc, bot)).toBe(mode);
        });

        it('should default to world', () => {
            const bot = createBot();

            const calc = createCalculationContext([bot]);
            const shape = calculatePortalPointerDragMode(calc, bot);

            expect(shape).toBe('world');
        });
    });

    describe('getBotPosition()', () => {
        it('should return the contextX, contextY, and contextZ values', () => {
            const bot = createBot('test', {
                dimensionX: 10,
                dimensionY: 11,
                dimensionZ: 12,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotPosition(calc, bot, 'dimension')).toEqual({
                x: 10,
                y: 11,
                z: 12,
            });
        });
    });

    describe('getBotRotation()', () => {
        it('should return the contextRotationX, contextRotationY, and contextRotationZ values', () => {
            const bot = createBot('test', {
                dimensionRotationX: 10,
                dimensionRotationY: 11,
                dimensionRotationZ: 12,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotRotation(calc, bot, 'dimension')).toEqual({
                x: 10,
                y: 11,
                z: 12,
            });
        });
    });

    describe('getBotScale()', () => {
        it('should return the scaleX, scaleY, and scaleZ values', () => {
            const bot = createBot('test', {
                auxScaleX: 10,
                auxScaleY: 11,
                auxScaleZ: 12,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotScale(calc, bot)).toEqual({
                x: 10,
                y: 11,
                z: 12,
            });
        });

        it('should cache the result', () => {
            const bot = createBot('test', {
                auxScaleX: 10,
                auxScaleY: 11,
                auxScaleZ: 12,
            });

            const calc = createCalculationContext([bot]);
            const calc2 = createCalculationContext([bot]);

            expect(getBotScale(calc, bot)).toBe(getBotScale(calc, bot));
            expect(getBotScale(calc, bot)).not.toBe(getBotScale(calc2, bot));
        });
    });

    describe('getPortalConfigBotID()', () => {
        it('should return the bot ID that the config bot tag points to', () => {
            const userBot = createBot('userBot', {
                auxPagePortal: 'abc',
                auxPagePortalConfigBot: 'test',
            });

            const calc = createCalculationContext([userBot]);
            const id = getPortalConfigBotID(calc, userBot, 'auxPagePortal');

            expect(id).toEqual('test');
        });

        it('should return null if the tag does not exist', () => {
            const userBot = createBot('userBot', {
                auxPagePortal: 'abc',
            });

            const calc = createCalculationContext([userBot]);
            const id = getPortalConfigBotID(calc, userBot, 'auxPagePortal');

            expect(id).toEqual(null);
        });
    });

    describe('interface.getBot()', () => {
        it('should return null if given null', () => {
            const calc = createCalculationContext([]);
            const bot = calc.sandbox.interface.getBot(null);
            expect(bot).toBe(null);
        });

        it('should return an object of tag values from the bot', () => {
            const test = createBot('test', {
                auxColor: 'red',
                calculated: '=getTag(this, "auxColor")',
            });

            const calc = createCalculationContext([test]);
            const bot = calc.sandbox.interface.getBot('test');

            expect(bot.tags).toEqual({
                auxColor: 'red',
                calculated: 'red',
            });
            expect(bot.raw).toEqual({
                auxColor: 'red',
                calculated: '=getTag(this, "auxColor")',
            });
        });

        it('should return the raw tag values when JSON.stringified', () => {
            const test = createBot('test', {
                auxColor: 'red',
                calculated: '=tags.auxColor',
            });

            const calc = createCalculationContext([test]);
            const bot = calc.sandbox.interface.getBot('test');
            const json = JSON.stringify(bot.tags);

            expect(json).toEqual(
                JSON.stringify({
                    auxColor: 'red',
                    calculated: '=tags.auxColor',
                })
            );
        });
    });

    describe('interface.unwrapBot()', () => {
        it('should return an object that does not include proxies', () => {
            const test = createBot('test', {
                auxColor: 'red',
            });

            const calc = createCalculationContext([test]);
            const bot = calc.sandbox.interface.getBot('test');
            const unwrapped = calc.sandbox.interface.unwrapBot(bot) as any;
            for (let key in unwrapped) {
                expect(types.isProxy(unwrapped[key])).toBe(false);
            }
        });

        it('should return an object that includes the bots space', () => {
            const test = createBot(
                'test',
                {
                    auxColor: 'red',
                },
                <any>'abc'
            );

            const calc = createCalculationContext([test]);
            const bot = calc.sandbox.interface.getBot('test');
            const unwrapped = calc.sandbox.interface.unwrapBot(bot) as any;
            expect(unwrapped).toEqual({
                id: 'test',
                space: 'abc',
                tags: {
                    auxColor: 'red',
                },
            });
        });
    });

    describe('botDimensionSortOrder()', () => {
        it('should return the dimensionSortOrder tag', () => {
            const bot = createBot('bot', {
                dimensionSortOrder: 123,
            });
            const calc = createCalculationContext([bot]);

            expect(botDimensionSortOrder(calc, bot, 'dimension')).toEqual(123);
        });
    });

    describe('getUserMenuId()', () => {
        it('should return the value from auxMenuPortal', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });

            const calc = createCalculationContext([user]);
            const id = getUserMenuId(calc, user);
            expect(id).toBe('dimension');
        });
    });

    describe('getBotsInMenu()', () => {
        it('should return the list of bots in the users menu', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });
            const bot1 = createBot('bot1', {
                dimension: true,
                dimensionSortOrder: 0,
            });
            const bot2 = createBot('bot2', {
                dimension: true,
                dimensionSortOrder: 1,
            });
            const bot3 = createBot('bot3', {
                dimension: true,
                dimensionSortOrder: 2,
            });

            const calc = createCalculationContext([user, bot2, bot1, bot3]);
            const bots = getBotsInMenu(calc, user);

            expect(bots).toEqual([bot1, bot2, bot3]);
        });
    });

    describe('getChannelBotById()', () => {
        it('should return the first bot that matches', () => {
            const channel = createBot('channel', {
                auxUniverse: 'test',
                'aux.channels': true,
            });

            const calc = createCalculationContext([channel]);
            const bot = getChannelBotById(calc, 'test');

            expect(bot).toEqual(channel);
        });

        it('should return null if there are no matches', () => {
            const channel = createBot('channel', {
                auxUniverse: 'test',
                'aux.channels': true,
            });

            const calc = createCalculationContext([channel]);
            const bot = getChannelBotById(calc, 'other');

            expect(bot).toEqual(null);
        });
    });

    describe('getChannelConnectedDevices()', () => {
        numericalTagValueTests(0, (value, expected) => {
            let bot = createBot('test', {
                auxUniverseConnectedSessions: value,
            });

            const calc = createCalculationContext([bot]);
            expect(getChannelConnectedDevices(calc, bot)).toBe(expected);
        });
    });

    describe('getConnectedDevices()', () => {
        numericalTagValueTests(0, (value, expected) => {
            let bot = createBot('test', {
                auxConnectedSessions: value,
            });

            const calc = createCalculationContext([bot]);
            expect(getConnectedDevices(calc, bot)).toBe(expected);
        });
    });

    describe('addBotToMenu()', () => {
        it('should return the update needed to add the given bot ID to the given users menu', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = addBotToMenu(calc, user, 'item');

            expect(update).toEqual({
                tags: {
                    dimension: true,
                    dimensionSortOrder: 0,
                    dimensionId: 'item',
                },
            });
        });

        it('should return the given sortOrder', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = addBotToMenu(calc, user, 'item', 5);

            expect(update).toEqual({
                tags: {
                    dimension: true,
                    dimensionSortOrder: 5,
                    dimensionId: 'item',
                },
            });
        });

        it('should return sortOrder needed to place the bot at the end of the list', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });
            const bot = createBot('bot');
            const bot2 = createBot('bot2', {
                dimension: true,
            });

            const calc = createCalculationContext([user, bot, bot2]);
            const update = addBotToMenu(calc, user, 'abc');

            expect(update).toEqual({
                tags: {
                    dimension: true,
                    dimensionSortOrder: 1,
                    dimensionId: 'abc',
                },
            });
        });
    });

    describe('removeBotFromMenu()', () => {
        it('should return the update needed to remove the given bot from the users menu', () => {
            const user = createBot('user', {
                auxMenuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = removeBotFromMenu(calc, user);

            expect(update).toEqual({
                tags: {
                    dimension: null,
                    dimensionSortOrder: null,
                    dimensionId: null,
                },
            });
        });
    });

    describe('getContextVisualizeMode()', () => {
        const cases = [
            ['surface', 'surface'],
            ['true', true],
            ['false', false],
            [0, false],
            [1, false],
            ['anything', false],
        ];

        it.each(cases)('should map %s to %s', (given: any, expected: any) => {
            const bot = createBot('bot', {
                auxDimensionVisualize: given,
            });

            const calc = createCalculationContext([bot]);
            const visible = getDimensionVisualizeMode(calc, bot);

            expect(visible).toBe(expected);
        });
    });

    describe('getContextGrid()', () => {
        it('should find all the tags that represent a grid position', () => {
            const bot = createBot('bot', {
                'auxDimensionConfig.surface.grid.0:1': 1,
                'auxDimensionConfig.surface.grid.1:1': 1,
                'auxDimensionConfig.surface.grid.2:1': 2,
                'auxDimensionConfig.surface.grid.2:2': '=3',
            });

            const calc = createCalculationContext([bot]);
            const grid = getBuilderDimensionGrid(calc, bot);

            expect(grid).toEqual({
                '0:1': 1,
                '1:1': 1,
                '2:1': 2,
                '2:2': 3,
            });
        });

        it('should not get confused by grid scale', () => {
            const bot = createBot('bot', {
                'auxDimensionConfig.surface.grid.0:1': 1,
                auxPortalGridScale: 50,
            });

            const calc = createCalculationContext([bot]);
            const grid = getBuilderDimensionGrid(calc, bot);

            expect(grid).toEqual({
                '0:1': 1,
            });
        });
    });

    describe('getContextSize()', () => {
        it('should return the default size if none exists', () => {
            const bot = createBot('bot', {
                auxDimensionVisualize: 'surface',
            });

            const calc = createCalculationContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should return the default if the bot is a user bot', () => {
            const bot = createBot('bot', {
                auxPlayerName: 'user',
                auxDimensionVisualize: 'surface',
            });

            const calc = createCalculationContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should still return the user bots dimension size', () => {
            const bot = createBot('bot', {
                auxPlayerName: 'user',
                auxDimensionVisualize: 'surface',
                auxDimensionSurfaceSize: 10,
            });

            const calc = createCalculationContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(10);
        });

        it('should return 0 if the bot is not a surface', () => {
            const bot = createBot('bot', {
                auxDimensionVisualize: true,
                auxDimensionSurfaceSize: 10,
            });

            const calc = createCalculationContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(0);
        });
    });

    describe('getContextColor()', () => {
        it('should return the auxPortalColor of the bot', () => {
            const bot = createBot('bot', {
                auxPortalColor: 'red',
            });

            const calc = createCalculationContext([bot]);
            expect(getDimensionColor(calc, bot)).toBe('red');
        });
    });

    describe('getContextGridScale()', () => {
        it('should return the auxPortalGridScale of the bot', () => {
            const bot = createBot('bot', {
                auxPortalGridScale: 10,
            });

            const calc = createCalculationContext([bot]);
            expect(getDimensionGridScale(calc, bot)).toBe(10);
        });
    });

    describe('getContextScale()', () => {
        it('should return the auxPortalSurfaceScale of the bot', () => {
            const bot = createBot('bot', {
                auxPortalSurfaceScale: 10,
            });

            const calc = createCalculationContext([bot]);
            expect(getDimensionScale(calc, bot)).toBe(10);
        });

        it('should return the default surface scale if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            expect(getDimensionScale(calc, bot)).toBe(DEFAULT_WORKSPACE_SCALE);
        });
    });

    describe('getContextDefaultHeight()', () => {
        it('should return the auxPortalSurfaceDefaultHeight of the bot', () => {
            const bot = createBot('bot', {
                auxPortalSurfaceDefaultHeight: 10.123,
            });

            const calc = createCalculationContext([bot]);
            expect(getDimensionDefaultHeight(calc, bot)).toBe(10.123);
        });

        it('should return undefined if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            expect(getDimensionDefaultHeight(calc, bot)).toBeUndefined();
        });
    });

    describe('calculateStringListTagValue()', () => {
        it('should return the list contained in the tag with each value converted to a string', () => {
            const bot = createBot('test', {
                tag: ['abc', '', {}, [], false, 0, null, undefined],
            });
            const calc = createCalculationContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', []);

            expect(result).toEqual([
                'abc',
                '',
                '[object Object]',
                '',
                'false',
                '0',
                null,
                undefined,
            ]);
        });

        it('should return the default value if the list doesnt exist', () => {
            const bot = createBot('test', {});
            const calc = createCalculationContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        it('should return the default value if the tag contains an empty string', () => {
            const bot = createBot('test', {
                tag: '',
            });
            const calc = createCalculationContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        let cases = [
            [1.1, ['1.1']],
            [false, ['false']],
            ['abc', ['abc']],
            ['[abc]', ['abc']],
        ];

        it.each(cases)('should convert %s', (value, expected) => {
            const bot = createBot('test', {
                tag: value,
            });
            const calc = createCalculationContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', []);

            expect(result).toEqual(expected);
        });
    });

    describe('addToContextDiff()', () => {
        it('should return the tags needed to add a bot to a dimension', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            const tags = addToDimensionDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                testX: 0,
                testY: 0,
                testSortOrder: 0,
            });
        });

        it('should calculate the sortOrder', () => {
            const bot = createBot('bot', {});
            const bot2 = createBot('bot2', {
                test: true,
                testSortOrder: 0,
            });

            const calc = createCalculationContext([bot, bot2]);
            const tags = addToDimensionDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                testX: 0,
                testY: 0,
                testSortOrder: 1,
            });
        });

        it('should calculate the sortOrder based on the given position', () => {
            const bot = createBot('bot', {});
            const bot2 = createBot('bot2', {
                test: true,
                testSortOrder: 0,
                testX: 0,
                testY: 0,
            });

            const calc = createCalculationContext([bot, bot2]);
            const tags = addToDimensionDiff(calc, 'test', 1, 2);

            expect(tags).toEqual({
                test: true,
                testX: 1,
                testY: 2,
                testSortOrder: 0,
            });
        });
    });

    describe('removeFromContextDiff()', () => {
        it('should return the tags needed to remove a bot from a dimension', () => {
            const calc = createCalculationContext([]);
            const tags = removeFromDimensionDiff(calc, 'test');

            expect(tags).toEqual({
                test: null,
                testX: null,
                testY: null,
                testSortOrder: null,
            });
        });
    });

    describe('isContextMovable()', () => {
        it('should return true if movable', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 'abc',
                auxDimensionSurfaceMovable: true,
            });

            const calc = createCalculationContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(true);
        });

        it('should return false if not movable', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 'abc',
                auxDimensionSurfaceMovable: false,
            });

            const calc = createCalculationContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(false);
        });

        it('should be movable by default', () => {
            const bot = createBot('test', {});

            const calc = createCalculationContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(true);
        });
    });

    describe('isContext()', () => {
        it('should return true when the given bot has auxDimensionConfig set to something', () => {
            const bot = createBot('test', {
                auxDimensionConfig: 'abc',
            });

            const calc = createCalculationContext([bot]);
            expect(isDimension(calc, bot)).toBe(true);
        });

        it('should return false when the given bot does not have auxDimensionConfig set to something', () => {
            const bot = createBot('test', {
                auxDimensionConfig: '',
            });

            const calc = createCalculationContext([bot]);
            expect(isDimension(calc, bot)).toBe(false);
        });
    });

    describe('getBotConfigContexts()', () => {
        it('should return the list of values in auxDimensionConfig', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 'abc',
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['abc']);
        });

        it('should evalulate formulas', () => {
            const bot = createBot('test', {
                auxDimensionConfig: '="abc"',
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['abc']);
        });

        it('should return the list of values when given a number', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 123,
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['123']);
        });

        it('should return the list of values when given a boolean', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: false,
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['false']);
        });
    });

    describe('isContextLocked()', () => {
        it('should default to false when the bot is a dimension', () => {
            const bot = createBot('test', {
                auxDimensionConfig: 'abc',
            });

            const calc = createCalculationContext([bot]);
            const locked = isDimensionLocked(calc, bot);

            expect(locked).toEqual(false);
        });

        it('should evaluate formulas', () => {
            const bot = createBot('test', {
                auxDimensionConfig: 'abc',
                auxPortalLocked: '=true',
            });

            const calc = createCalculationContext([bot]);
            const locked = isDimensionLocked(calc, bot);

            expect(locked).toEqual(true);
        });
    });

    describe('getBotLabelAnchor()', () => {
        it('should default to top', () => {
            const bot = createBot('bot');

            const calc = createCalculationContext([bot]);
            const anchor = getBotLabelAnchor(calc, bot);

            expect(anchor).toBe('top');
        });

        const cases = [
            ['top', 'top'],
            ['front', 'front'],
            ['back', 'back'],
            ['left', 'left'],
            ['right', 'right'],
            ['floating', 'floating'],
            ['abc', 'top'],
        ];
        it.each(cases)('given %s it should return %s', (anchor, expected) => {
            const bot = createBot('bot', {
                auxLabelPosition: anchor,
            });

            const calc = createCalculationContext([bot]);
            const a = getBotLabelAnchor(calc, bot);

            expect(a).toBe(expected);
        });

        it('should support formulas', () => {
            const bot = createBot('bot', {
                auxLabelPosition: '="front"',
            });

            const calc = createCalculationContext([bot]);
            const anchor = getBotLabelAnchor(calc, bot);

            expect(anchor).toBe('front');
        });
    });

    describe('getBotVersion()', () => {
        it('should return the auxVersion', () => {
            const bot = createBot('test', {
                auxVersion: 1,
            });

            const calc = createCalculationContext([bot]);

            expect(getBotVersion(calc, bot)).toBe(1);
        });

        it('should return undefined if not a number', () => {
            const bot = createBot('test', {
                auxVersion: 'abc',
            });

            const calc = createCalculationContext([bot]);

            expect(getBotVersion(calc, bot)).toBeUndefined();
        });
    });

    describe('hasBotInInventory()', () => {
        it('should return true if the given bot is in the users inventory dimension', () => {
            const thisBot = createBot('thisBot', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatBot = createBot('thatBot', {
                name: 'bob',
                test: true,
            });
            const user = createBot('userId', {
                auxInventoryPortal: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return true if all the given bots are in the users inventory dimension', () => {
            const thisBot = createBot('thisBot', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatBot = createBot('thatBot', {
                name: 'bob',
                test: true,
            });
            const otherBot = createBot('otherBot', {
                name: 'bob',
                test: true,
            });
            const user = createBot('userId', {
                auxInventoryPortal: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, otherBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return false if one of the given bots are not in the users inventory dimension', () => {
            const thisBot = createBot('thisBot', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatBot = createBot('thatBot', {
                name: 'bob',
                test: true,
            });
            const otherBot = createBot('otherBot', {
                name: 'bob',
                test: false,
            });
            const user = createBot('userId', {
                auxInventoryPortal: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, otherBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(false);
        });
    });

    describe('isBotInDimension()', () => {
        it('should handle boolean objects', () => {
            const thisBot = createBot('thisBot', {
                dimension: new Boolean(true),
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, 'dimension');

            expect(result).toBe(true);
        });

        it('should handle a string object as the dimension', () => {
            const thisBot = createBot('thisBot', {
                dimension: true,
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, <any>(
                new String('dimension')
            ));

            expect(result).toBe(true);
        });

        booleanTagValueTests(false, (given, expected) => {
            const thisBot = createBot('thisBot', {
                dimension: given,
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, 'dimension');

            expect(result).toBe(expected);
        });

        const cases = [
            ['true', true],
            ['false', false],
            ['abc', false],
            [0, false],
            [1, false],
            [{}, false],
            [null, false],
            [undefined, false],
            [true, true],
            [false, false],
        ];

        it.each(cases)('should handle %s', (given, expected) => {
            const thisBot = createBot('thisBot', {
                dimension: given,
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, 'dimension');

            expect(result).toBe(expected);
        });
    });

    describe('getUserBotColor()', () => {
        const defaultCases = [
            [DEFAULT_BUILDER_USER_COLOR, 'builder'],
            [DEFAULT_PLAYER_USER_COLOR, 'player'],
        ];

        it.each(defaultCases)(
            'should default to %s when in %s',
            (expected: any, domain: AuxDomain) => {
                const bot = createBot('test', {});
                const globals = createBot(GLOBALS_BOT_ID, {});

                const calc = createCalculationContext([globals, bot]);

                expect(getUserBotColor(calc, bot, globals, domain)).toBe(
                    expected
                );
            }
        );

        const globalsCases = [
            ['auxUniverseUserPlayerColor', 'player', '#40A287'],
            ['auxUniverseUserBuilderColor', 'builder', '#AAAAAA'],
        ];

        it.each(globalsCases)(
            'should use %s when in %s',
            (tag: string, domain: AuxDomain, value: any) => {
                const bot = createBot('test', {});
                const globals = createBot(GLOBALS_BOT_ID, {
                    [tag]: value,
                });

                const calc = createCalculationContext([globals, bot]);

                expect(getUserBotColor(calc, bot, globals, domain)).toBe(value);
            }
        );

        const userCases = [['player'], ['builder']];

        it.each(userCases)(
            'should use auxColor from the user bot',
            (domain: AuxDomain) => {
                const bot = createBot('test', {
                    auxColor: 'red',
                });
                const globals = createBot(GLOBALS_BOT_ID, {});

                const calc = createCalculationContext([globals, bot]);

                expect(getUserBotColor(calc, bot, globals, domain)).toBe('red');
            }
        );
    });

    describe('BotLookupTable', () => {
        describe('buildLookupTable()', () => {
            const dataTypes = [
                ['support strings', 'jkl', 'pqr'],
                ['support integers', 123, 456],
                ['support floats', 123.65, 456.789],
                ['support booleans', false, true],
                ['support nulls', null, null],
                ['support mixed types', 'hello', 987],
                ['support zero', 0, 0],
            ];

            it.each(dataTypes)('should %s (%s, %s)', (desc, first, second) => {
                const test = createBot('test', {
                    abc: 'def',
                    ghi: first,
                    mno: second,
                });
                const test2 = createBot('test2', {
                    abc: 123,
                    ghi: first,
                    mno: second,
                });
                const test3 = createBot('test3', {
                    abc: 123,
                    ghi: 'jkl',
                    mno: true,
                });
                const test4 = createBot('test4', {
                    abc: 'def',
                    ghi: 456,
                    mno: true,
                });

                const calc = createCalculationContext([
                    test,
                    test2,
                    test3,
                    test4,
                ]);
                const table = buildLookupTable(calc, ['ghi', 'mno']);
                const results = table.query([first, second]);
                expect(results).toEqual([test, test2]);
            });

            it('should use the given default values when a tag is missing', () => {
                const test = createBot('test', {
                    abc: 'def',
                });

                const calc = createCalculationContext([test]);
                const table = buildLookupTable(calc, ['missing'], [99]);
                const results = table.query([99]);
                expect(results).toEqual([test]);
            });
        });
    });

    describe('BotLookupTableHelper', () => {
        describe('query()', () => {
            it('should build a lookup table from the given list of tags', () => {
                const test = createBot('test', {
                    abc: 'def',
                    ghi: 'jkl',
                    mno: 'pqr',
                });
                const test2 = createBot('test2', {
                    abc: 123,
                    ghi: 'jkl',
                    mno: 'pqr',
                });
                const test3 = createBot('test3', {
                    abc: 123,
                    ghi: 'jkl',
                    mno: true,
                });
                const test4 = createBot('test4', {
                    abc: 'def',
                    ghi: 456,
                    mno: true,
                });

                const calc = createCalculationContext([
                    test,
                    test2,
                    test3,
                    test4,
                ]);
                const helper = new BotLookupTableHelper();
                const results = helper.query(
                    calc,
                    ['ghi', 'mno'],
                    ['jkl', 'pqr']
                );
                expect(results).toEqual([test, test2]);
            });

            it('should return the same values even if the tag order changes', () => {
                const test = createBot('test', {
                    abc: 'def',
                    ghi: 'jkl',
                    mno: 'pqr',
                });
                const test2 = createBot('test2', {
                    abc: 123,
                    ghi: 'jkl',
                    mno: 'pqr',
                });
                const test3 = createBot('test3', {
                    abc: 123,
                    ghi: 'jkl',
                    mno: true,
                });
                const test4 = createBot('test4', {
                    abc: 'def',
                    ghi: 456,
                    mno: true,
                });

                const calc = createCalculationContext([
                    test,
                    test2,
                    test3,
                    test4,
                ]);
                const helper = new BotLookupTableHelper();
                const results = helper.query(
                    calc,
                    ['mno', 'ghi'],
                    ['pqr', 'jkl']
                );
                expect(results).toEqual([test, test2]);
            });
        });
    });
}
