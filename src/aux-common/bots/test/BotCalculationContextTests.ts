import { BotSandboxContext } from '../BotCalculationContext';
import {
    createBot,
    objectsAtContextGridPosition,
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
    filtersMatchingArguments,
    COMBINE_ACTION_NAME,
    parseFilterTag,
    filterMatchesArguments,
    duplicateBot,
    isBotMovable,
    getBotDragMode,
    isBotStackable,
    getUserMenuId,
    getBotsInMenu,
    addBotToMenu,
    removeBotFromMenu,
    getContextVisualizeMode,
    getBuilderContextGrid,
    getContextSize,
    addToContextDiff,
    removeFromContextDiff,
    isContextMovable,
    isContext,
    getBotConfigContexts,
    isContextLocked,
    getBotLabelAnchor,
    getBotVersion,
    isBotInContext,
    getBotUsernameList,
    isInUsernameList,
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
    getContextColor,
    getContextGridScale,
    getContextScale,
    getContextDefaultHeight,
} from '../BotCalculations';
import {
    Bot,
    PartialBot,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    GLOBALS_BOT_ID,
    AuxDomain,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_HEIGHT,
} from '../Bot';
import { buildLookupTable } from '../BotLookupTable';
import { BotLookupTableHelper } from '../BotLookupTableHelper';

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
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const bot2 = createBot('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const bot3 = createBot('test3', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([bot2, bot1, bot3]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([bot1, bot2, bot3]);
        });

        it('should ignore user bots', () => {
            const bot1 = createBot('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
                _auxUser: 'abc',
            });
            const bot2 = createBot('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([bot1, bot2]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([bot2]);
        });

        it('should cache the query and results', () => {
            const bot1 = createBot('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const bot2 = createBot('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const bot3 = createBot('test3', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([bot2, bot1, bot3]);
            const context2 = createCalculationContext([bot2, bot1, bot3]);
            const result1 = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });
            const result2 = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });
            const result3 = objectsAtContextGridPosition(context2, 'context', {
                x: -1,
                y: 1,
            });

            expect(result1).toBe(result2);
            expect(result1).not.toBe(result3);
        });

        it('should default to 0,0 for bots without a position', () => {
            const bot1 = createBot('test1', {
                context: true,
            });

            const context = createCalculationContext([bot1]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: 0,
                y: 0,
            });

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

        it('should unwrap proxies in arrays', () => {
            const bot = createBot('test', {
                formula: '=[getTag(this, "#num._1"),getTag(this, "#num._2")]',
                'num._1': '1',
                'num._2': '2',
            });

            const context = createCalculationContext([bot]);
            const value = calculateBotValue(context, bot, 'formula');

            expect(Array.isArray(value)).toBe(true);
            expect(value).toEqual([1, 2]);
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
        });

        describe('formulas', () => {
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

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([bot1, bot2, bot3]);
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

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([bot2, bot3]);
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

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([bot2, bot3]);
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

                    expect(value).toEqual([bot1, bot2, bot3]);

                    value = calculateBotValue(context, bot3, 'formula1');

                    expect(value).toEqual([bot2, bot3]);

                    value = calculateBotValue(context, bot3, 'formula2');

                    expect(value).toEqual(bot2);
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

                    expect(value).toEqual([bot1, bot2, bot3]);
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

                    expect(value).toEqual([bot2, bot3]);
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

                    expect(value).toEqual([]);
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

                    expect(value).toEqual([bot, bot2]);
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

                    expect(value).toEqual([bot, bot2]);
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

                    expect(value).toEqual([bot, bot2]);
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

                    expect(value).toEqual([bot2]);
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

                    expect(value).toEqual([bot2]);
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

                    expect(result).toEqual([botA, botB, botC]);
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

                    expect(result).toEqual([botA, botC]);
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

                    expect(result).toEqual([botA, botC]);
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

                    expect(value).toEqual([bot2]);
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

                    expect(value).toEqual([bot2]);
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

                    expect(value).toEqual([bot3]);
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

                    expect(value).toEqual([bot3, bot2, bot]);
                });

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

                    expect(value).toEqual([bot, bot2]);
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

                    expect(result).toEqual(botA);
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

                    expect(result).toEqual(botA);
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

                    expect(result).toEqual(botA);
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

                    expect(result).toEqual(botA);
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

                    expect(value).toEqual(bot);
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

                    expect(value).toEqual(bot3);
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

                    expect(value).toEqual(bot);
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

            describe('inContext()', () => {
                it('should return a function that returns true if the bot is in the given context', () => {
                    const bot = createBot('test', {
                        formula: '=inContext("red")',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');
                    const bot2 = createBot('test', {
                        red: true,
                    });

                    expect(value(bot2)).toBe(true);
                });

                it('should return a function that returns false if the bot is not in the given context', () => {
                    const bot = createBot('test', {
                        formula: '=inContext("red")',
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
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    expect(value(bot3)).toBe(true);
                });

                it('should return a function that returns false if the bot is not in the same stack as another bot', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const bot2 = createBot('test2', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 3,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function that returns false if the bot is not in the same context as another bot', () => {
                    const bot = createBot('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const bot2 = createBot('test2', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([bot, bot2]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: false,
                        'red.x': 1,
                        'red.y': 2,
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
                        'red.x': 1,
                        'red.y': 2,
                        'red.sortOrder': 100,
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
                        'red.x': 1,
                        'red.y': 2,
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
                        'red.x': 1,
                        'red.y': 3,
                    });

                    expect(value(bot3)).toBe(false);
                });

                it('should return a function that returns false if the bot is not in the given context', () => {
                    const bot = createBot('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([bot]);
                    const value = calculateBotValue(context, bot, 'formula');

                    const bot3 = createBot('test3', {
                        red: false,
                        'red.x': 1,
                        'red.y': 2,
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
                        'red.x': 1,
                        'red.y': 2,
                        'red.sortOrder': 100,
                    });

                    expect(typeof value.sort).toBe('function');
                    expect(value.sort(bot3)).toBe(100);
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
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            'red.x': x,
                            'red.y': y,
                        });

                        expect(value(bot3)).toBe(true);
                    });

                    it('should return a function that returns false if the given bot is not at the correct position', () => {
                        const bot = createBot('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const bot2 = createBot('test2', {
                            red: true,
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            'red.x': -x,
                            'red.y': -y,
                        });

                        expect(value(bot3)).toBe(false);
                    });

                    it('should return a function with a sort function that sorts the bots by their sort order', () => {
                        const bot = createBot('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const bot2 = createBot('test2', {
                            red: true,
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([bot, bot2]);
                        const value = calculateBotValue(
                            context,
                            bot,
                            'formula'
                        );

                        const bot3 = createBot('test3', {
                            red: true,
                            'red.x': x,
                            'red.y': y,
                            'red.sortOrder': 100,
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
            const bot1 = createBot(undefined, { auxStackable: true });
            const update1 = isMergeable(createCalculationContext([bot1]), bot1);

            expect(update1).toBe(true);
        });

        it('should return false if the bot is not stackable', () => {
            const bot1 = createBot(undefined, { auxStackable: false });
            const update1 = isMergeable(createCalculationContext([bot1]), bot1);

            expect(update1).toBe(false);
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
        it('should return true if the last active time is within 60 seconds', () => {
            dateNowMock.mockReturnValue(1000 * 60 + 999);
            const bot1 = createBot(undefined, {
                'aux._lastActiveTime': 1000,
                auxUserActive: true,
            });
            const calc = createCalculationContext([bot1]);
            const update1 = isUserActive(calc, bot1);

            expect(update1).toBe(true);
        });

        it('should return true if the last active time is within 60 seconds', () => {
            dateNowMock.mockReturnValue(1000 * 61);
            const bot1 = createBot(undefined, {
                'aux._lastActiveTime': 1000,
                auxUserActive: true,
            });
            const calc = createCalculationContext([bot1]);
            const update1 = isUserActive(calc, bot1);

            expect(update1).toBe(false);
        });

        it('should return false if the user is not active', () => {
            dateNowMock.mockReturnValue(1000);
            const bot1 = createBot(undefined, {
                'aux._lastActiveTime': 1000,
                auxUserActive: false,
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
            'should map auxChannel:%s to %s',
            (value: string, expected: boolean) => {
                let bot = createBot('test', {
                    auxChannel: value,
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
        it('should return true when auxContextSurfaceMinimized is true', () => {
            let bot = createBot('test', {
                auxContextSurfaceMinimized: true,
            });
            const context = createCalculationContext([bot]);
            expect(isMinimized(context, bot)).toBe(true);
        });

        it('should return false when auxContextSurfaceMinimized is not true', () => {
            let bot = createBot('test', {
                auxContextSurfaceMinimized: false,
            });
            const context = createCalculationContext([bot]);
            expect(isMinimized(context, bot)).toBe(false);
        });
    });

    describe('filtersMatchingArguments()', () => {
        it('should return an empty array if no tags match', () => {
            let bot = createBot();
            let other = createBot();

            const context = createCalculationContext([bot, other]);
            const tags = filtersMatchingArguments(
                context,
                bot,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags).toEqual([]);
        });

        it('should match based on tag and exact value', () => {
            let other = createBot();
            other.tags.name = 'Test';
            other.tags.val = '';

            let bot = createBot();
            bot.tags['onCombine(#name:"Test")'] = 'abc';
            bot.tags['onCombine(#val:"")'] = 'abc';
            bot.tags['onCombine(#name:"test")'] = 'def';

            const context = createCalculationContext([bot, other]);
            const tags = filtersMatchingArguments(
                context,
                bot,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual([
                'onCombine(#name:"Test")',
                'onCombine(#val:"")',
            ]);
        });

        it('should only match tags in the given bot', () => {
            let bot = createBot();
            bot.tags['onCombine(#name:"Test")'] = 'abc';

            let other = createBot();
            other.tags.name = 'Test';

            const context = createCalculationContext([bot, other]);
            const tags = filtersMatchingArguments(
                context,
                bot,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual(['onCombine(#name:"Test")']);
        });
    });

    describe('filterMatchesArguments()', () => {
        it('should match string values', () => {
            let other = createBot();
            other.tags.name = 'test';

            const context = createCalculationContext([other]);
            const filter = parseFilterTag('onCombine(#name:"test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match number values', () => {
            let other = createBot();
            other.tags.num = 123456;

            const context = createCalculationContext([other]);
            let filter = parseFilterTag('onCombine(#num:"123456")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.num = 3.14159;
            filter = parseFilterTag('onCombine(#num:"3.14159")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match boolean values', () => {
            let other = createBot();
            other.tags.bool = true;
            const context = createCalculationContext([other]);
            let filter = parseFilterTag('onCombine(#bool:"true")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.bool = false;

            filter = parseFilterTag('onCombine(#bool:"false")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match array values', () => {
            let other = createBot();
            other.tags.array = [];
            const context = createCalculationContext([other]);

            let filter = parseFilterTag('onCombine(#array:"[]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            filter = parseFilterTag('onCombine(#array:"["anything"]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            other.tags.array = [1];
            filter = parseFilterTag('onCombine(#array:"[1]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.array = ['hello', 'world'];
            filter = parseFilterTag('onCombine(#array:"[hello, world]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.array = ['hello', 'world', 12.34];
            filter = parseFilterTag(
                'onCombine(#array:"[hello, world, 12.34]")'
            );
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should evaluate the value filters', () => {
            let other = createBot();
            other.tags.name = '=getTag(this, "#cool")';
            other.tags.cool = 'Test';

            const context = createCalculationContext([other, other]);
            let filter = parseFilterTag('onCombine(#name:"Test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.value = '10.15';
            filter = parseFilterTag('onCombine(#value:10.15)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.value = 'true';
            filter = parseFilterTag('onCombine(#value:true)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            filter = parseFilterTag('onCombine(#value:false)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            other.tags.value = 'false';
            filter = parseFilterTag('onCombine(#value:true)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            filter = parseFilterTag('onCombine(#value:false)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            let newData: PartialBot = {
                tags: {
                    assign: ':=getTag(this, "#cool")',
                },
            };
            updateBot(other, 'testId', newData, () => context);
            other.tags.assign = newData.tags.assign;
            filter = parseFilterTag('onCombine(#assign:"Test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
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

        it('should not be destroyed', () => {
            let first: Bot = createBot('id');
            first.tags['aux._destroyed'] = true;
            first.tags._workspace = 'abc';

            uuidMock.mockReturnValue('test');
            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags['aux._destroyed']).toBeUndefined();
        });

        it('should not have any auto-generated contexts or selections', () => {
            let first: Bot = createBot('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';
            first.tags[`aux._context_abcdefg`] = true;
            first.tags[`aux._context_1234567`] = true;
            first.tags[`aux._context_1234567.x`] = 1;
            first.tags[`aux._context_1234567.y`] = 2;
            first.tags[`aux._context_1234567.z`] = 3;
            first.tags[`aux._selection_99999`] = true;

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
                'aux._context_1234567.x': 1,
                'aux._context_1234567.y': 2,
                'aux._context_1234567.z': 3,
                'aux._selection_99999': true,
            });
        });

        it('should keep the tags that the new data contains', () => {
            let first: Bot = createBot('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';

            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first, {
                tags: {
                    [`aux._selection_99999`]: true,
                    [`aux._context_abcdefg`]: true,
                },
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
                'aux._context_abcdefg': true,
                'aux._selection_99999': true,
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
            first.tags['aux._destroyed'] = true;
            const calc = createCalculationContext([first]);
            const second = duplicateBot(calc, first);

            expect(first.tags['aux._destroyed']).toBe(true);
        });

        it('should not have any contexts', () => {
            let first: Bot = createBot('id', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                def: true,
            });
            let context: Bot = createBot('context', {
                auxContext: 'abc',
            });

            const calc = createCalculationContext([context, first]);
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
        it('should return true when auxStackable has no value', () => {
            let bot = createBot('test', {});
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(true);
        });

        it('should return false when auxStackable is false', () => {
            let bot = createBot('test', {
                ['auxStackable']: false,
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(false);
        });

        it('should return false when auxStackable calculates to false', () => {
            let bot = createBot('test', {
                ['auxStackable']: '=false',
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(false);
        });

        it('should return true when auxStackable has any other value', () => {
            let bot = createBot('test', {
                ['auxStackable']: 'anything',
            });
            const context = createCalculationContext([bot]);
            expect(isBotStackable(context, bot)).toBe(true);
        });
    });

    describe('getBotShape()', () => {
        const cases = [['cube'], ['sphere'], ['sprite']];
        it.each(cases)('should return %s', (shape: string) => {
            const bot = createBot('test', {
                auxShape: <any>shape,
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

        it('should return the shape from auxShape', () => {
            let bot = createBot();
            bot.tags['auxShape'] = 'sphere';

            const calc = createCalculationContext([bot]);
            const shape = getBotShape(calc, bot);

            expect(shape).toBe('sphere');
        });
    });

    describe('getBotScale()', () => {
        it('should return the scale.x, scale.y, and scale.z values', () => {
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

    describe('getUserMenuId()', () => {
        it('should return the value from _auxUserMenuContext', () => {
            const user = createBot('user', {
                _auxUserMenuContext: 'context',
            });

            const calc = createCalculationContext([user]);
            const id = getUserMenuId(calc, user);
            expect(id).toBe('context');
        });
    });

    describe('getBotsInMenu()', () => {
        it('should return the list of bots in the users menu', () => {
            const user = createBot('user', {
                _auxUserMenuContext: 'context',
            });
            const bot1 = createBot('bot1', {
                context: true,
                'context.sortOrder': 0,
            });
            const bot2 = createBot('bot2', {
                context: true,
                'context.sortOrder': 1,
            });
            const bot3 = createBot('bot3', {
                context: true,
                'context.sortOrder': 2,
            });

            const calc = createCalculationContext([user, bot2, bot1, bot3]);
            const bots = getBotsInMenu(calc, user);

            expect(bots).toEqual([bot1, bot2, bot3]);
        });
    });

    describe('getChannelBotById()', () => {
        it('should return the first bot that matches', () => {
            const channel = createBot('channel', {
                auxChannel: 'test',
                'aux.channels': true,
            });

            const calc = createCalculationContext([channel]);
            const bot = getChannelBotById(calc, 'test');

            expect(bot).toEqual(channel);
        });

        it('should return null if there are no matches', () => {
            const channel = createBot('channel', {
                auxChannel: 'test',
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
                auxChannelConnectedSessions: value,
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
                _auxUserMenuContext: 'context',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = addBotToMenu(calc, user, 'item');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 0,
                    'context.id': 'item',
                },
            });
        });

        it('should return the given sortOrder', () => {
            const user = createBot('user', {
                _auxUserMenuContext: 'context',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = addBotToMenu(calc, user, 'item', 5);

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 5,
                    'context.id': 'item',
                },
            });
        });

        it('should return sortOrder needed to place the bot at the end of the list', () => {
            const user = createBot('user', {
                _auxUserMenuContext: 'context',
            });
            const bot = createBot('bot');
            const bot2 = createBot('bot2', {
                context: 0,
            });

            const calc = createCalculationContext([user, bot, bot2]);
            const update = addBotToMenu(calc, user, 'abc');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 1,
                    'context.id': 'abc',
                },
            });
        });
    });

    describe('removeBotFromMenu()', () => {
        it('should return the update needed to remove the given bot from the users menu', () => {
            const user = createBot('user', {
                _auxUserMenuContext: 'context',
            });
            const bot = createBot('bot');

            const calc = createCalculationContext([user, bot]);
            const update = removeBotFromMenu(calc, user);

            expect(update).toEqual({
                tags: {
                    context: null,
                    'context.sortOrder': null,
                    'context.id': null,
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
                auxContextVisualize: given,
            });

            const calc = createCalculationContext([bot]);
            const visible = getContextVisualizeMode(calc, bot);

            expect(visible).toBe(expected);
        });
    });

    describe('getContextGrid()', () => {
        it('should find all the tags that represent a grid position', () => {
            const bot = createBot('bot', {
                'auxContext.surface.grid.0:1': 1,
                'auxContext.surface.grid.1:1': 1,
                'auxContext.surface.grid.2:1': 2,
                'auxContext.surface.grid.2:2': '=3',
            });

            const calc = createCalculationContext([bot]);
            const grid = getBuilderContextGrid(calc, bot);

            expect(grid).toEqual({
                '0:1': 1,
                '1:1': 1,
                '2:1': 2,
                '2:2': 3,
            });
        });

        it('should not get confused by grid scale', () => {
            const bot = createBot('bot', {
                'auxContext.surface.grid.0:1': 1,
                auxContextGridScale: 50,
            });

            const calc = createCalculationContext([bot]);
            const grid = getBuilderContextGrid(calc, bot);

            expect(grid).toEqual({
                '0:1': 1,
            });
        });
    });

    describe('getContextSize()', () => {
        it('should return the default size if none exists', () => {
            const bot = createBot('bot', {
                auxContextVisualize: 'surface',
            });

            const calc = createCalculationContext([bot]);
            const size = getContextSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should return the default if the bot is a user bot', () => {
            const bot = createBot('bot', {
                _auxUser: 'user',
                auxContextVisualize: 'surface',
            });

            const calc = createCalculationContext([bot]);
            const size = getContextSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should still return the user bots context size', () => {
            const bot = createBot('bot', {
                _auxUser: 'user',
                auxContextVisualize: 'surface',
                auxContextSurfaceSize: 10,
            });

            const calc = createCalculationContext([bot]);
            const size = getContextSize(calc, bot);

            expect(size).toBe(10);
        });

        it('should return 0 if the bot is not a surface', () => {
            const bot = createBot('bot', {
                auxContextVisualize: true,
                auxContextSurfaceSize: 10,
            });

            const calc = createCalculationContext([bot]);
            const size = getContextSize(calc, bot);

            expect(size).toBe(0);
        });
    });

    describe('getContextColor()', () => {
        it('should return the auxContextColor of the bot', () => {
            const bot = createBot('bot', {
                auxContextColor: 'red',
            });

            const calc = createCalculationContext([bot]);
            expect(getContextColor(calc, bot)).toBe('red');
        });
    });

    describe('getContextGridScale()', () => {
        it('should return the auxContextGridScale of the bot', () => {
            const bot = createBot('bot', {
                auxContextGridScale: 10,
            });

            const calc = createCalculationContext([bot]);
            expect(getContextGridScale(calc, bot)).toBe(10);
        });
    });

    describe('getContextScale()', () => {
        it('should return the auxContextSurfaceScale of the bot', () => {
            const bot = createBot('bot', {
                auxContextSurfaceScale: 10,
            });

            const calc = createCalculationContext([bot]);
            expect(getContextScale(calc, bot)).toBe(10);
        });

        it('should return the default surface scale if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            expect(getContextScale(calc, bot)).toBe(DEFAULT_WORKSPACE_SCALE);
        });
    });

    describe('getContextDefaultHeight()', () => {
        it('should return the auxContextSurfaceDefaultHeight of the bot', () => {
            const bot = createBot('bot', {
                auxContextSurfaceDefaultHeight: 10.123,
            });

            const calc = createCalculationContext([bot]);
            expect(getContextDefaultHeight(calc, bot)).toBe(10.123);
        });

        it('should return undefined if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            expect(getContextDefaultHeight(calc, bot)).toBeUndefined();
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
        it('should return the tags needed to add a bot to a context', () => {
            const bot = createBot('bot', {});

            const calc = createCalculationContext([bot]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.sortOrder': 0,
            });
        });

        it('should calculate the sortOrder', () => {
            const bot = createBot('bot', {});
            const bot2 = createBot('bot2', {
                test: true,
                'test.sortOrder': 0,
            });

            const calc = createCalculationContext([bot, bot2]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.sortOrder': 1,
            });
        });

        it('should calculate the sortOrder based on the given position', () => {
            const bot = createBot('bot', {});
            const bot2 = createBot('bot2', {
                test: true,
                'test.sortOrder': 0,
                'test.x': 0,
                'test.y': 0,
            });

            const calc = createCalculationContext([bot, bot2]);
            const tags = addToContextDiff(calc, 'test', 1, 2);

            expect(tags).toEqual({
                test: true,
                'test.x': 1,
                'test.y': 2,
                'test.sortOrder': 0,
            });
        });
    });

    describe('removeFromContextDiff()', () => {
        it('should return the tags needed to remove a bot from a context', () => {
            const calc = createCalculationContext([]);
            const tags = removeFromContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: null,
                'test.x': null,
                'test.y': null,
                'test.sortOrder': null,
            });
        });
    });

    describe('isContextMovable()', () => {
        it('should return true if movable', () => {
            const bot = createBot('test', {
                abc: true,
                auxContext: 'abc',
                auxContextSurfaceMovable: true,
            });

            const calc = createCalculationContext([bot]);

            expect(isContextMovable(calc, bot)).toBe(true);
        });

        it('should return false if not movable', () => {
            const bot = createBot('test', {
                abc: true,
                auxContext: 'abc',
                auxContextSurfaceMovable: false,
            });

            const calc = createCalculationContext([bot]);

            expect(isContextMovable(calc, bot)).toBe(false);
        });

        it('should be movable by default', () => {
            const bot = createBot('test', {});

            const calc = createCalculationContext([bot]);

            expect(isContextMovable(calc, bot)).toBe(true);
        });
    });

    describe('isContext()', () => {
        it('should return true when the given bot has auxContext set to something', () => {
            const bot = createBot('test', {
                auxContext: 'abc',
            });

            const calc = createCalculationContext([bot]);
            expect(isContext(calc, bot)).toBe(true);
        });

        it('should return false when the given bot does not have auxContext set to something', () => {
            const bot = createBot('test', {
                auxContext: '',
            });

            const calc = createCalculationContext([bot]);
            expect(isContext(calc, bot)).toBe(false);
        });
    });

    describe('getBotConfigContexts()', () => {
        it('should return the list of values in auxContext', () => {
            const bot = createBot('test', {
                abc: true,
                auxContext: 'abc',
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigContexts(calc, bot);

            expect(tags).toEqual(['abc']);
        });

        it('should evalulate formulas', () => {
            const bot = createBot('test', {
                auxContext: '="abc"',
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigContexts(calc, bot);

            expect(tags).toEqual(['abc']);
        });

        it('should return the list of values when given a number', () => {
            const bot = createBot('test', {
                abc: true,
                auxContext: 123,
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigContexts(calc, bot);

            expect(tags).toEqual(['123']);
        });

        it('should return the list of values when given a boolean', () => {
            const bot = createBot('test', {
                abc: true,
                auxContext: false,
            });

            const calc = createCalculationContext([bot]);
            const tags = getBotConfigContexts(calc, bot);

            expect(tags).toEqual(['false']);
        });
    });

    describe('isContextLocked()', () => {
        it('should default to false when the bot is a context', () => {
            const bot = createBot('test', {
                auxContext: 'abc',
            });

            const calc = createCalculationContext([bot]);
            const locked = isContextLocked(calc, bot);

            expect(locked).toEqual(false);
        });

        it('should default to true when the bot is not a context', () => {
            const bot = createBot('test', {});

            const calc = createCalculationContext([bot]);
            const locked = isContextLocked(calc, bot);

            expect(locked).toEqual(true);
        });

        it('should evaluate formulas', () => {
            const bot = createBot('test', {
                auxContext: 'abc',
                auxContextLocked: '=true',
            });

            const calc = createCalculationContext([bot]);
            const locked = isContextLocked(calc, bot);

            expect(locked).toEqual(true);
        });
    });

    describe('getLabelAnchor()', () => {
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
                auxLabelAnchor: anchor,
            });

            const calc = createCalculationContext([bot]);
            const a = getBotLabelAnchor(calc, bot);

            expect(a).toBe(expected);
        });

        it('should support formulas', () => {
            const bot = createBot('bot', {
                auxLabelAnchor: '="front"',
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
        it('should return true if the given bot is in the users inventory context', () => {
            const thisBot = createBot('thisBot', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatBot = createBot('thatBot', {
                name: 'bob',
                test: true,
            });
            const user = createBot('userId', {
                _auxUserInventoryContext: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return true if all the given bots are in the users inventory context', () => {
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
                _auxUserInventoryContext: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, otherBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return false if one of the given bots are not in the users inventory context', () => {
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
                _auxUserInventoryContext: 'test',
            });

            const calc = createCalculationContext(
                [thisBot, thatBot, otherBot, user],
                'userId'
            );
            const result = calculateBotValue(calc, thisBot, 'isInInventory');

            expect(result).toBe(false);
        });
    });

    describe('isBotInContext()', () => {
        it('should handle boolean objects', () => {
            const thisBot = createBot('thisBot', {
                context: new Boolean(true),
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInContext(calc, thisBot, 'context');

            expect(result).toBe(true);
        });

        it('should handle string objects', () => {
            const thisBot = createBot('thisBot', {
                context: new String('true'),
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInContext(calc, thisBot, 'context');

            expect(result).toBe(true);
        });

        it('should handle a string object as the context', () => {
            const thisBot = createBot('thisBot', {
                context: true,
            });

            const calc = createCalculationContext([thisBot]);
            const result = isBotInContext(calc, thisBot, <any>(
                new String('context')
            ));

            expect(result).toBe(true);
        });
    });

    describe('getBotUsernameList()', () => {
        const tag = 'list';

        it(`should return the ${tag}`, () => {
            const bot = createBot('test', {
                [tag]: '[Test, Test2]',
            });

            const calc = createCalculationContext([bot]);

            expect(getBotUsernameList(calc, bot, tag)).toEqual([
                'Test',
                'Test2',
            ]);
        });

        it('should always return an array', () => {
            const bot = createBot('test', {
                [tag]: 'Test',
            });

            const calc = createCalculationContext([bot]);

            expect(getBotUsernameList(calc, bot, tag)).toEqual(['Test']);
        });

        it('should handle falsy values', () => {
            const bot = createBot('test', {
                [tag]: '',
            });

            const calc = createCalculationContext([bot]);

            expect(getBotUsernameList(calc, bot, tag)).toBeFalsy();
        });

        it('should get the aux._user tag from bots', () => {
            const bot = createBot('test', {
                [tag]: '=getBots("name", "bob")',
            });
            const user = createBot('user', {
                name: 'bob',
                _auxUser: 'a',
            });
            const bad = createBot('user2', {
                name: 'bob',
            });

            const calc = createCalculationContext([bot, user, bad]);

            expect(getBotUsernameList(calc, bot, tag)).toEqual(['a', 'user2']);
        });
    });

    describe('isInUsernameList()', () => {
        const extraCases = [
            ['Test', '[Test, Test2]', true],
            ['Test', '[Test2]', false],
            ['Test', 'Test2', false],
            ['Test2', 'Test2', true],
            ['Test2', '', false],
        ];

        it.each(extraCases)(
            'should determine if %s is in the list',
            (username, list, expected) => {
                const bot = createBot('test', {
                    list: list,
                });

                const calc = createCalculationContext([bot]);

                expect(isInUsernameList(calc, bot, 'list', username)).toBe(
                    expected
                );
            }
        );
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
            ['auxChannelUserPlayerColor', 'player', '#40A287'],
            ['auxChannelUserBuilderColor', 'builder', '#AAAAAA'],
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

function booleanTagValueTests(
    defaultValue: boolean,
    testFunc: (given: any, expected: boolean) => void
) {
    let cases = [
        ['', defaultValue],
        [null, defaultValue],
        [0, defaultValue],
        ['=false', false],
        ['=0', defaultValue],
        ['a', defaultValue],
        [1, defaultValue],
        [false, false],
        ['false', false],
        [true, true],
        ['true', true],
        ['=1', defaultValue],
        ['="hello"', defaultValue],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}

function numericalTagValueTests(
    defaultValue: number,
    testFunc: (given: any, expected: number) => void
) {
    let cases = [
        ['', defaultValue],
        [null, defaultValue],
        [0, 0],
        ['=false', defaultValue],
        ['=0', 0],
        ['a', defaultValue],
        [1, 1],
        [-10, -10],
        ['1', 1],
        ['.5', 0.5],
        [false, defaultValue],
        ['false', defaultValue],
        [true, defaultValue],
        ['true', defaultValue],
        ['=1', 1],
        ['="hello"', defaultValue],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}

function stringTagValueTests(
    defaultValue: string,
    testFunc: (given: any, expected: string) => void
) {
    let cases = [
        ['', ''],
        [null, defaultValue],
        [0, defaultValue],
        ['=false', defaultValue],
        ['=0', defaultValue],
        ['a', 'a'],
        [1, defaultValue],
        ['1', defaultValue],
        ['.5', defaultValue],
        [false, defaultValue],
        ['false', defaultValue],
        [true, defaultValue],
        ['true', defaultValue],
        ['=1', defaultValue],
        ['="hello"', 'hello'],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}
