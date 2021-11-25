import {
    createBot,
    objectsAtDimensionGridPosition,
    getBotShape,
    calculateBotValue,
    filterBotsBySelection,
    isSimulation,
    isDestroyable,
    isEditable,
    duplicateBot,
    isBotMovable,
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
    getBotScale,
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
    getPortalConfigBotID,
    getBotSubShape,
    getBotOrientationMode,
    getBotAnchorPoint,
    getAnchorPointOffset,
    isBotPointable,
    isBotFocusable,
    getBotLabelAlignment,
    getBotScaleMode,
    getBotMeetPortalAnchorPoint,
    getBotMeetPortalAnchorPointOffset,
    calculateBotIdTagValue,
    getBotTagPortalAnchorPoint,
    getBotTagPortalAnchorPointOffset,
    createPrecalculatedBot,
    calculateLabelFontSize,
    calculateLabelWordWrapMode,
    getMenuBotForm,
    calculatePortalCameraControlsMode,
    getMenuBotHoverStyle,
    getCameraType,
    getBotCursor,
    getPortalCursor,
    getBotLabelPadding,
    getCursorCSS,
    calculateGridScale,
    calculateBotIds,
} from '../BotCalculations';
import {
    Bot,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    AuxDomain,
    DEFAULT_WORKSPACE_SCALE,
    BotCursorType,
} from '../Bot';
import { buildLookupTable } from '../BotLookupTable';
import { BotLookupTableHelper } from '../BotLookupTableHelper';
import {
    stringTagValueTests,
    booleanTagValueTests,
    numericalTagValueTests,
} from './BotTestHelpers';
import { reject, botRemoved, toast } from '../BotEvents';
import {
    calculateDestroyBotEvents,
    resolveRejectedActions,
} from '../BotActions';
import { BotCalculationContext } from '../BotCalculationContext';

export function botCalculationContextTests(
    uuidMock: jest.Mock,
    dateNowMock: jest.Mock,
    createPrecalculatedContext: (
        bots: Bot[],
        userId?: string
    ) => BotCalculationContext
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

            const context = createPrecalculatedContext([bot2, bot1, bot3]);
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

            const context = createPrecalculatedContext([bot2, bot1, bot3]);
            const context2 = createPrecalculatedContext([bot2, bot1, bot3]);
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

            const context = createPrecalculatedContext([bot1]);
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

    describe('calculateGridScale()', () => {
        it('should return the default grid scale', () => {
            const bot = createBot('test');
            const context = createPrecalculatedContext([bot]);

            const result = calculateGridScale(context, bot);

            expect(result).toBe(0.4);
        });

        it('should portalSurfaceScale', () => {
            const bot = createBot('test', {
                portalSurfaceScale: 4,
            });
            const context = createPrecalculatedContext([bot]);

            const result = calculateGridScale(context, bot);

            expect(result).toBe(0.8);
        });

        it('should support portalGridScale', () => {
            const bot = createBot('test', {
                portalGridScale: 1,
            });
            const context = createPrecalculatedContext([bot]);

            const result = calculateGridScale(context, bot);

            expect(result).toBe(2);
        });

        it('should support both portalSurfaceScale and portalGridScale', () => {
            const bot = createBot('test', {
                portalGridScale: 1,
                portalSurfaceScale: 4,
            });
            const context = createPrecalculatedContext([bot]);

            const result = calculateGridScale(context, bot);

            expect(result).toBe(4);
        });

        it('should support custom defaults', () => {
            const bot = createBot('test', {});
            const context = createPrecalculatedContext([bot]);

            const result = calculateGridScale(context, bot, 1, 4);

            expect(result).toBe(4);
        });

        it('should support null bots', () => {
            const context = createPrecalculatedContext([]);

            const result = calculateGridScale(context, null, 1, 4);

            expect(result).toBe(4);
        });
    });

    describe('calculateBotValue()', () => {
        it('should convert to a number if it is a number', () => {
            const bot = createBot();
            bot.tags.tag = '123.145';
            const context = createPrecalculatedContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toBeCloseTo(123.145);
        });

        it('should parse numbers that dont start with a digit', () => {
            const bot = createBot();
            bot.tags.tag = '.145';
            const context = createPrecalculatedContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toBeCloseTo(0.145);
        });

        it('should convert to a boolean if it is a boolean', () => {
            const bot = createBot();
            bot.tags.tag = 'true';

            const context = createPrecalculatedContext([bot]);
            const trueValue = calculateBotValue(context, bot, 'tag');

            expect(trueValue).toBe(true);

            bot.tags.tag = 'false';
            const falseValue = calculateBotValue(context, bot, 'tag');

            expect(falseValue).toBe(false);
        });

        it('should keep arrays as strings', () => {
            const bot = createBot();
            bot.tags.tag = '[test(a, b, c), 1.23, true]';
            const context = createPrecalculatedContext([bot]);
            const value = calculateBotValue(context, bot, 'tag');

            expect(value).toEqual('[test(a, b, c), 1.23, true]');
        });

        it('should return the bot ID for the id tag', () => {
            const bot = createBot('test', {});

            const context = createPrecalculatedContext([bot]);
            const value = calculateBotValue(context, bot, 'id');

            expect(value).toEqual('test');
        });

        describe('space', () => {
            it('should return shared if the space is not defined', () => {
                const bot = createBot('test', {});

                const context = createPrecalculatedContext([bot]);
                const value = calculateBotValue(context, bot, 'space');

                expect(value).toEqual('shared');
            });

            it('should return the space if it is defined', () => {
                const bot = createBot('test', {}, 'local');

                const context = createPrecalculatedContext([bot]);
                const value = calculateBotValue(context, bot, 'space');

                expect(value).toEqual('local');
            });
        });
    });

    describe('filterBotsBySelection()', () => {
        it('should return the bots that have the given selection ID set in a tag', () => {
            const selectionId = 'abcdefg1234';
            const bot1 = createBot('test1');
            const bot2 = createBot('test2');
            const bot3 = createBot('test3');
            const bot4 = createBot('test4');
            const bot5 = createBot('test5');
            const bot6 = createBot('test6');
            const bot7 = createBot('test7');

            bot1.tags[selectionId] = true;
            bot2.tags[selectionId] = 1;
            bot3.tags[selectionId] = -1;
            bot4.tags[selectionId] = 'hello';
            bot5.tags[selectionId] = false;
            bot6.tags[selectionId] = '';

            const selected = filterBotsBySelection(
                [bot1, bot2, bot3, bot4, bot5, bot6, bot7],
                selectionId
            );

            expect(selected).toEqual([bot1, bot2, bot3, bot4, bot5]);
        });

        it('should return bots that have the same ID as the selection', () => {
            const selectionId = 'abcdefg1234';
            const bot1 = createBot('test1');
            const bot2 = createBot('abcdefg1234');

            bot1.tags[selectionId] = true;

            const selected = filterBotsBySelection([bot1, bot2], selectionId);

            expect(selected).toEqual([bot1, bot2]);
        });

        it('should support the id tag', () => {
            const selectionId = 'id';
            const bot1 = createBot('test1');
            const bot2 = createBot('abcdefg1234');

            bot1.tags[selectionId] = true;

            const selected = filterBotsBySelection([bot1, bot2], selectionId);

            expect(selected).toEqual([bot1, bot2]);
        });

        it('should support the space tag', () => {
            const selectionId = 'space';
            const bot1 = createBot('test1');
            const bot2 = createBot('abcdefg1234');

            bot1.tags[selectionId] = true;

            const selected = filterBotsBySelection([bot1, bot2], selectionId);

            expect(selected).toEqual([bot1, bot2]);
        });

        it('should support tag masks', () => {
            const selectionId = 'abc';
            const bot1 = createPrecalculatedBot('test1', {}, {});
            const bot2 = createPrecalculatedBot('abcdefg1234', {}, {});

            bot1.values[selectionId] = true;
            bot1.masks = {
                tempLocal: {
                    [selectionId]: true,
                },
            };

            const selected = filterBotsBySelection([bot1, bot2], selectionId);

            expect(selected).toEqual([bot1]);
        });

        it('should include bots that have a tag but no value', () => {
            const selectionId = 'abc';
            const bot1 = createPrecalculatedBot(
                'test1',
                {
                    [selectionId]: null,
                },
                {
                    [selectionId]: 'abc',
                }
            );
            const bot2 = createPrecalculatedBot('abcdefg1234', {}, {});

            const selected = filterBotsBySelection([bot1, bot2], selectionId);

            expect(selected).toEqual([bot1]);
        });
    });

    describe('calculateBooleanTagValue()', () => {
        booleanTagValueTests(false, (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBooleanTagValue(calc, bot, 'tag', false)).toBe(
                expected
            );
        });

        it('should support fallback from aux prefixed tags', () => {
            let bot = createBot('test', {
                tag: true,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBooleanTagValue(calc, bot, 'auxTag', false)).toBe(
                true
            );
        });
    });

    describe('calculateStringTagValue()', () => {
        stringTagValueTests('test', (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateStringTagValue(calc, bot, 'tag', 'test')).toBe(
                expected
            );
        });

        it('should support fallback from aux prefixed tags', () => {
            let bot = createBot('test', {
                tag: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateStringTagValue(calc, bot, 'auxTag', 'empty')).toBe(
                'abc'
            );
        });
    });

    describe('calculateBotIdTagValue()', () => {
        stringTagValueTests('test', (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBotIdTagValue(calc, bot, 'tag', 'test')).toBe(
                expected
            );
        });

        it('should return the ID of the bot', () => {
            let bot = createBot('test', {
                tag: createBot('botId'),
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBotIdTagValue(calc, bot, 'tag', 'empty')).toBe(
                'botId'
            );
        });

        it('should return the default if the object is not a bot', () => {
            let bot = createBot('test', {
                tag: {},
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBotIdTagValue(calc, bot, 'tag', 'empty')).toBe(
                'empty'
            );
        });

        it('should support fallback from aux prefixed tags', () => {
            let bot = createBot('test', {
                tag: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBotIdTagValue(calc, bot, 'auxTag', 'empty')).toBe(
                'abc'
            );
        });

        it('should support bot links', () => {
            let bot = createBot('test', {
                tag: '🔗abc',
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateBotIdTagValue(calc, bot, 'tag', 'empty')).toBe(
                'abc'
            );
        });
    });

    describe('calculateNumericalTagValue()', () => {
        numericalTagValueTests(null, (value, expected) => {
            let bot = createBot('test', {
                tag: value,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateNumericalTagValue(calc, bot, 'tag', null)).toBe(
                expected
            );
        });

        it('should support fallback from aux prefixed tags', () => {
            let bot = createBot('test', {
                tag: 123,
            });

            const calc = createPrecalculatedContext([bot]);
            expect(calculateNumericalTagValue(calc, bot, 'auxTag', 0)).toBe(
                123
            );
        });
    });

    describe('isUserActive()', () => {
        const tags = ['auxPlayerActive', 'playerActive'];

        describe.each(tags)('%s', (tag) => {
            it(`should return true if the ${tag} tag is true`, () => {
                dateNowMock.mockReturnValue(1000 * 60 + 999);
                const bot1 = createBot(undefined, {
                    [tag]: true,
                });
                const calc = createPrecalculatedContext([bot1]);
                const update1 = isUserActive(calc, bot1);

                expect(update1).toBe(true);
            });

            it('should return false if the user is not active', () => {
                dateNowMock.mockReturnValue(1000);
                const bot1 = createBot(undefined, {
                    [tag]: false,
                });
                const calc = createPrecalculatedContext([bot1]);
                const update1 = isUserActive(calc, bot1);

                expect(update1).toBe(false);
            });
        });
    });

    describe('isSimulation()', () => {
        let cases = [
            ['', false],
            [null, false],
            [0, false],
            ['false', false],
            ['0', false],
            ['a', true],
            [1, true],
            [true, true],
            ['=1', true],
            ['="hello"', true],
        ];

        it.each(cases)(
            'should map server:%s to %s',
            (value: string, expected: boolean) => {
                let bot = createBot('test', {
                    server: value,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(isSimulation(calc, bot)).toBe(expected);
            }
        );
    });

    describe('isDestroyable()', () => {
        describe('auxDestroyable', () => {
            booleanTagValueTests(true, (value, expected) => {
                let bot = createBot('test', {
                    auxDestroyable: value,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(isDestroyable(calc, bot)).toBe(expected);
            });
        });

        describe('destroyable', () => {
            booleanTagValueTests(true, (value, expected) => {
                let bot = createBot('test', {
                    destroyable: value,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(isDestroyable(calc, bot)).toBe(expected);
            });
        });
    });

    describe('isEditable()', () => {
        describe('auxEditable', () => {
            booleanTagValueTests(true, (value, expected) => {
                let bot = createBot('test', {
                    auxEditable: value,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(isEditable(calc, bot)).toBe(expected);
            });
        });

        describe('editable', () => {
            booleanTagValueTests(true, (value, expected) => {
                let bot = createBot('test', {
                    editable: value,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(isEditable(calc, bot)).toBe(expected);
            });
        });
    });

    describe('isMinimized()', () => {
        it('should return true when auxPortalSurfaceMinimized is true', () => {
            let bot = createBot('test', {
                auxPortalSurfaceMinimized: true,
            });
            const context = createPrecalculatedContext([bot]);
            expect(isMinimized(context, bot)).toBe(true);
        });

        it('should return false when auxPortalSurfaceMinimized is not true', () => {
            let bot = createBot('test', {
                auxPortalSurfaceMinimized: false,
            });
            const context = createPrecalculatedContext([bot]);
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

            const calc = createPrecalculatedContext([first]);
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

            const calc = createPrecalculatedContext([first]);
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

            const calc = createPrecalculatedContext([first]);
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
            const calc = createPrecalculatedContext([first]);
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
            const calc = createPrecalculatedContext([first]);

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

            const calc = createPrecalculatedContext([dimension, first]);
            const second = duplicateBot(calc, first);

            expect(second.tags).toEqual({
                def: true,
            });
        });
    });

    describe('isBotMovable()', () => {
        it('should return true when draggable has no value', () => {
            let bot = createBot('test', {});
            const context = createPrecalculatedContext([bot]);
            expect(isBotMovable(context, bot)).toBe(true);
        });

        it('should return false when draggable is false', () => {
            let bot = createBot('test', {
                ['draggable']: false,
            });
            const context = createPrecalculatedContext([bot]);
            expect(isBotMovable(context, bot)).toBe(false);
        });

        it('should return true when draggable has any other value', () => {
            let bot = createBot('test', {
                ['draggable']: 'anything',
            });
            const context = createPrecalculatedContext([bot]);
            expect(isBotMovable(context, bot)).toBe(true);
        });
    });

    describe('getBotShape()', () => {
        const cases = [
            ['cube'],
            ['sphere'],
            ['sprite'],
            ['mesh'],
            ['iframe'],
            ['nothing'],
            ['frustum'],
            ['egg'],
            ['helix'],
            ['hex'],
            ['cursor'],
            ['portal'],
            ['dimension'],
        ];
        const tagCases = ['auxForm', 'form'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (shape: string) => {
                const bot = createBot('test', {
                    [tag]: <any>shape,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotShape(calc, bot)).toBe(shape);
            });

            it('should return the shape from the tag', () => {
                let bot = createBot();
                bot.tags[tag] = 'sphere';

                const calc = createPrecalculatedContext([bot]);
                const shape = getBotShape(calc, bot);

                expect(shape).toBe('sphere');
            });
        });

        it('should default to cube', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotShape(calc, bot);

            expect(shape).toBe('cube');
        });
    });

    describe('getMenuBotForm()', () => {
        const cases = [['button'], ['input']];
        const tagCases = ['auxForm', 'form'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (shape: string) => {
                const bot = createBot('test', {
                    [tag]: <any>shape,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getMenuBotForm(calc, bot)).toBe(shape);
            });

            it('should return the shape from the tag', () => {
                let bot = createBot();
                bot.tags[tag] = 'input';

                const calc = createPrecalculatedContext([bot]);
                const shape = getMenuBotForm(calc, bot);

                expect(shape).toBe('input');
            });
        });

        it('should default to button', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getMenuBotForm(calc, bot);

            expect(shape).toBe('button');
        });
    });

    describe('getMenuBotHoverStyle()', () => {
        const cases = [['hover'], ['none']];
        const tagCases = ['auxMenuItemHoverMode', 'menuItemHoverMode'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (shape: string) => {
                const bot = createBot('test', {
                    [tag]: <any>shape,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getMenuBotHoverStyle(calc, bot)).toBe(shape);
            });

            it('should return the shape from the tag', () => {
                let bot = createBot();
                bot.tags[tag] = 'hover';

                const calc = createPrecalculatedContext([bot]);
                const shape = getMenuBotHoverStyle(calc, bot);

                expect(shape).toBe('hover');
            });
        });

        it('should default to hover if the bot has an onClick', () => {
            const bot = createBot('test', {
                onClick: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            const shape = getMenuBotHoverStyle(calc, bot);

            expect(shape).toBe('hover');
        });

        it('should default to none if the bot does not have an onClick', () => {
            const bot = createBot('test', {});

            const calc = createPrecalculatedContext([bot]);
            const shape = getMenuBotHoverStyle(calc, bot);

            expect(shape).toBe('none');
        });
    });

    describe('getBotSubShape()', () => {
        const cases = [['gltf'], ['src'], ['html']];
        const tagCases = ['auxFormSubtype', 'formSubtype'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (shape: string) => {
                const bot = createBot('test', {
                    [tag]: <any>shape,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotSubShape(calc, bot)).toBe(shape);
            });
        });

        it('should default to null', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotSubShape(calc, bot);

            expect(shape).toBe(null);
        });
    });

    describe('getBotOrientationMode()', () => {
        const cases = [
            ['absolute'],
            ['billboard'],
            ['billboardTop'],
            ['billboardFront'],
        ];
        const tagCases = ['auxOrientationMode', 'orientationMode'];
        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (mode: string) => {
                const bot = createBot('test', {
                    [tag]: <any>mode,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotOrientationMode(calc, bot)).toBe(mode);
            });
        });

        it('should default to absolute', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotOrientationMode(calc, bot);

            expect(shape).toBe('absolute');
        });
    });

    describe('getBotAnchorPoint()', () => {
        const cases = [
            ['center', 'center'],
            ['front', 'front'],
            ['back', 'back'],
            ['bottom', 'bottom'],
            ['top', 'top'],
            ['left', 'left'],
            ['right', 'right'],
            [
                [1, 2, 3],
                [1, 2, 3],
            ],
        ];
        const tagCases = ['auxAnchorPoint', 'anchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotAnchorPoint(calc, bot)).toEqual(expected);
                }
            );
        });

        it('should default to bottom', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotAnchorPoint(calc, bot);

            expect(shape).toBe('bottom');
        });
    });

    const portalAnchorPointCases = [
        ['fullscreen', 'fullscreen'],
        ['top', 'top'],
        ['topRight', 'topRight'],
        ['topLeft', 'topLeft'],
        ['bottom', 'bottom'],
        ['bottomRight', 'bottomRight'],
        ['bottomLeft', 'bottomLeft'],
        [[1], [1, 0, 0, 0]],
        [
            [1, 2],
            [1, 2, 0, 0],
        ],
        [
            [1, 2, 3],
            [1, 2, 3, 0],
        ],
        [
            [1, 2, 3, 4],
            [1, 2, 3, 4],
        ],
        [
            [1, 2, 3, 4, 5],
            [1, 2, 3, 4],
        ],
        [['a'], ['a', 0, 0, 0]],
        [
            ['a', 'b'],
            ['a', 'b', 0, 0],
        ],
        [
            ['a', 'b', 'c'],
            ['a', 'b', 'c', 0],
        ],
        [
            ['a', 'b', 'c', 'd'],
            ['a', 'b', 'c', 'd'],
        ],
        [
            ['a', 'b', 'c', 'd', 'e'],
            ['a', 'b', 'c', 'd'],
        ],
    ];

    describe('getMeetPortalAnchorPoint()', () => {
        const tagCases = ['auxMeetPortalAnchorPoint', 'meetPortalAnchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(portalAnchorPointCases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotMeetPortalAnchorPoint(calc, bot)).toEqual(
                        expected
                    );
                }
            );
        });

        it('should default to fullscreen', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotMeetPortalAnchorPoint(calc, bot);

            expect(shape).toBe('fullscreen');
        });
    });

    describe('getTagPortalAnchorPoint()', () => {
        const tagCases = ['auxTagPortalAnchorPoint', 'tagPortalAnchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(portalAnchorPointCases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotTagPortalAnchorPoint(calc, bot)).toEqual(
                        expected
                    );
                }
            );
        });

        it('should default to fullscreen', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotTagPortalAnchorPoint(calc, bot);

            expect(shape).toBe('fullscreen');
        });
    });

    describe('getCameraType()', () => {
        const tagCases = ['auxPortalCameraType', 'portalCameraType'];

        const cameraTypeCases = [
            ['orthographic', 'orthographic'],
            ['perspective', 'perspective'],
            ['other', null],
        ];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cameraTypeCases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getCameraType(calc, bot)).toEqual(expected);
                }
            );
        });

        it('should default to fullscreen', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = getBotTagPortalAnchorPoint(calc, bot);

            expect(shape).toBe('fullscreen');
        });
    });

    describe('getAnchorPointOffset()', () => {
        const cases = [
            ['center', { x: 0, y: 0, z: 0 }],
            ['front', { x: 0, y: -0.5, z: 0 }],
            ['back', { x: 0, y: 0.5, z: 0 }],
            ['bottom', { x: 0, y: 0, z: 0.5 }],
            ['top', { x: 0, y: 0, z: -0.5 }],
            ['left', { x: 0.5, y: 0, z: 0 }],
            ['right', { x: -0.5, y: 0, z: 0 }],

            // Should mirror the coordinates when using literals
            [[1, 2, 3], { x: -1, y: -2, z: -3 }],
        ];
        const tagCases = ['auxAnchorPoint', 'anchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should support %s', (mode: any, expected: any) => {
                const bot = createBot('test', {
                    [tag]: <any>mode,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getAnchorPointOffset(calc, bot)).toEqual(expected);
            });
        });

        it('should default to bottom', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const offset = getAnchorPointOffset(calc, bot);

            expect(offset).toEqual({
                x: 0,
                y: 0,
                z: 0.5,
            });
        });
    });

    const portalAnchorPointOffsetCases = [
        [
            'fullscreen',
            { top: '0px', bottom: '0px', left: '0px', right: '0px' },
        ],
        [[1, 2, 3], { top: '1px', bottom: '3px', left: '0px', right: '2px' }],
        [
            ['1%', '2%', '3%'],
            { top: '1%', bottom: '3%', left: '0px', right: '2%' },
        ],

        [
            'top',
            {
                top: '0px',
                height: '50%',
                'min-height': '250px',
                left: '0px',
                right: '0px',
            },
        ],
        [
            'topRight',
            {
                top: '25px',
                height: '25%',
                'min-height': '250px',
                width: '25%',
                'min-width': '250px',
                right: '25px',
            },
        ],
        [
            'topLeft',
            {
                top: '25px',
                height: '25%',
                'min-height': '250px',
                width: '25%',
                'min-width': '250px',
                left: '25px',
            },
        ],
        [
            'bottom',
            {
                bottom: '0px',
                height: '50%',
                'min-height': '250px',
                left: '0px',
                right: '0px',
            },
        ],
        [
            'bottomRight',
            {
                bottom: '25px',
                height: '25%',
                'min-height': '250px',
                width: '25%',
                'min-width': '250px',
                right: '25px',
            },
        ],
        [
            'bottomLeft',
            {
                bottom: '25px',
                height: '25%',
                'min-height': '250px',
                width: '25%',
                'min-width': '250px',
                left: '25px',
            },
        ],
        [
            'left',
            {
                bottom: '0px',
                height: '100%',
                'min-height': '250px',
                width: '50%',
                'min-width': '250px',
                left: '0px',
            },
        ],
        [
            'right',
            {
                bottom: '0px',
                height: '100%',
                'min-height': '250px',
                width: '50%',
                'min-width': '250px',
                right: '0px',
            },
        ],
    ];

    describe('getBotMeetPortalAnchorPointOffset()', () => {
        const tagCases = ['auxMeetPortalAnchorPoint', 'meetPortalAnchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(portalAnchorPointOffsetCases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(
                        getBotMeetPortalAnchorPointOffset(calc, bot)
                    ).toEqual(expected);
                }
            );
        });

        it('should default to fullscreen', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const offset = getBotMeetPortalAnchorPointOffset(calc, bot);

            expect(offset).toEqual({
                bottom: '0px',
                left: '0px',
                right: '0px',
                top: '0px',
            });
        });
    });

    const cursorCases = [
        ['auto', 'auto'],
        ['default', 'default'],
        ['none', 'none'],
        ['context-menu', 'context-menu'],
        ['help', 'help'],
        ['pointer', 'pointer'],
        ['progress', 'progress'],
        ['wait', 'wait'],
        ['cell', 'cell'],
        ['crosshair', 'crosshair'],
        ['text', 'text'],
        ['vertical-text', 'vertical-text'],
        ['alias', 'alias'],
        ['copy', 'copy'],
        ['move', 'move'],
        ['no-drop', 'no-drop'],
        ['not-allowed', 'not-allowed'],
        ['grab', 'grab'],
        ['grabbing', 'grabbing'],
        ['all-scroll', 'all-scroll'],
        ['col-resize', 'col-resize'],
        ['row-resize', 'row-resize'],
        ['n-resize', 'n-resize'],
        ['e-resize', 'e-resize'],
        ['s-resize', 's-resize'],
        ['w-resize', 'w-resize'],
        ['ne-resize', 'ne-resize'],
        ['nw-resize', 'nw-resize'],
        ['se-resize', 'se-resize'],
        ['sw-resize', 'sw-resize'],
        ['ew-resize', 'ew-resize'],
        ['ns-resize', 'ns-resize'],
        ['nesw-resize', 'nesw-resize'],
        ['nwse-resize', 'nwse-resize'],
        ['zoom-in', 'zoom-in'],
        ['zoom-out', 'zoom-out'],

        ['missing', 'auto'],
        ['', null],
        [123, null],
        [true, null],
        [
            'http://example.com',
            { type: 'link', url: 'http://example.com', x: 0, y: 0 },
        ],
    ];

    describe('getBotCursor()', () => {
        const tagCases = ['auxCursor', 'cursor'];

        describe.each(tagCases)('%s', (tag) => {
            it.each(cursorCases)(
                'should support %s',
                (value: any, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: value,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotCursor(calc, bot)).toEqual(expected);
                }
            );

            it('should support X and Y offsets for cursors', () => {
                const bot = createBot('test', {
                    [tag]: 'http://example.com',
                    cursorHotspotX: 5,
                    cursorHotspotY: 1,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotCursor(calc, bot)).toEqual({
                    type: 'link',
                    url: 'http://example.com',
                    x: 5,
                    y: 1,
                });
            });
        });
    });

    describe('getPortalCursor()', () => {
        const tagCases = ['auxPortalCursor', 'portalCursor'];

        describe.each(tagCases)('%s', (tag) => {
            it.each(cursorCases)(
                'should support %s',
                (value: any, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: value,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getPortalCursor(calc, bot)).toEqual(expected);
                }
            );

            it('should support X and Y offsets for cursors', () => {
                const bot = createBot('test', {
                    [tag]: 'http://example.com',
                    portalCursorHotspotX: 5,
                    portalCursorHotspotY: 1,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getPortalCursor(calc, bot)).toEqual({
                    type: 'link',
                    url: 'http://example.com',
                    x: 5,
                    y: 1,
                });
            });
        });
    });

    describe('getCursorCSS()', () => {
        const cursorCases: [BotCursorType, string][] = [
            ['auto', 'auto'],
            ['default', 'default'],
            ['none', 'none'],
            ['context-menu', 'context-menu'],
            ['help', 'help'],
            ['pointer', 'pointer'],
            ['progress', 'progress'],
            ['wait', 'wait'],
            ['cell', 'cell'],
            ['crosshair', 'crosshair'],
            ['text', 'text'],
            ['vertical-text', 'vertical-text'],
            ['alias', 'alias'],
            ['copy', 'copy'],
            ['move', 'move'],
            ['no-drop', 'no-drop'],
            ['not-allowed', 'not-allowed'],
            ['grab', 'grab'],
            ['grabbing', 'grabbing'],
            ['all-scroll', 'all-scroll'],
            ['col-resize', 'col-resize'],
            ['row-resize', 'row-resize'],
            ['n-resize', 'n-resize'],
            ['e-resize', 'e-resize'],
            ['s-resize', 's-resize'],
            ['w-resize', 'w-resize'],
            ['ne-resize', 'ne-resize'],
            ['nw-resize', 'nw-resize'],
            ['se-resize', 'se-resize'],
            ['sw-resize', 'sw-resize'],
            ['ew-resize', 'ew-resize'],
            ['ns-resize', 'ns-resize'],
            ['nesw-resize', 'nesw-resize'],
            ['nwse-resize', 'nwse-resize'],
            ['zoom-in', 'zoom-in'],
            ['zoom-out', 'zoom-out'],
            [
                { type: 'link', url: 'myUrl', x: 0, y: 0 },
                'url("myUrl") 0 0, auto',
            ],
        ];
        it.each(cursorCases)(
            'should support %s',
            (value: any, expected: any) => {
                expect(getCursorCSS(value)).toEqual(expected);
            }
        );
    });

    describe('getTagPortalAnchorPointOffset()', () => {
        const tagCases = ['auxTagPortalAnchorPoint', 'tagPortalAnchorPoint'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(portalAnchorPointOffsetCases)(
                'should support %s',
                (mode: string, expected: any) => {
                    const bot = createBot('test', {
                        [tag]: <any>mode,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotTagPortalAnchorPointOffset(calc, bot)).toEqual(
                        expected
                    );
                }
            );
        });

        it('should default to fullscreen', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const offset = getBotTagPortalAnchorPointOffset(calc, bot);

            expect(offset).toEqual({
                bottom: '0px',
                left: '0px',
                right: '0px',
                top: '0px',
            });
        });
    });

    describe('calculatePortalCameraControlsMode()', () => {
        const cases = [['player'], [false]];
        const tagCases = ['auxPortalCameraControls', 'portalCameraControls'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (mode: string) => {
                const bot = createBot('test', {
                    [tag]: <any>mode,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(calculatePortalCameraControlsMode(calc, bot)).toBe(mode);
            });
        });

        it('should default to player', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = calculatePortalCameraControlsMode(calc, bot);

            expect(shape).toBe('player');
        });
    });

    describe('calculateLabelFontSize()', () => {
        const cases = [['auto'] as const, [10] as const, [1] as const];
        const tagCases = ['auxLabelFontSize', 'labelFontSize'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (mode: string | number) => {
                const bot = createBot('test', {
                    [tag]: <any>mode,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(calculateLabelFontSize(calc, bot)).toBe(mode);
            });

            it('should return 0.001 for 0', () => {
                const bot = createBot('test', {
                    [tag]: 0,
                });

                const calc = createPrecalculatedContext([bot]);
                const shape = calculateLabelFontSize(calc, bot);

                expect(shape).toBe(0.001);
            });

            it('should return 0.001 for 0.0001', () => {
                const bot = createBot('test', {
                    [tag]: 0.0001,
                });

                const calc = createPrecalculatedContext([bot]);
                const shape = calculateLabelFontSize(calc, bot);

                expect(shape).toBe(0.001);
            });
        });

        it('should default to auto', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = calculateLabelFontSize(calc, bot);

            expect(shape).toBe('auto');
        });
    });

    describe('calculateLabelWordWrapMode()', () => {
        const cases = [['breakCharacters'], ['breakWords'], ['none']];
        const tagCases = ['auxLabelWordWrapMode', 'labelWordWrapMode'];

        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)('should return %s', (mode: string) => {
                const bot = createBot('test', {
                    [tag]: <any>mode,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(calculateLabelWordWrapMode(calc, bot)).toBe(mode);
            });
        });

        it('should default to breakCharacters', () => {
            const bot = createBot();

            const calc = createPrecalculatedContext([bot]);
            const shape = calculateLabelWordWrapMode(calc, bot);

            expect(shape).toBe('breakCharacters');
        });
    });

    describe('getBotPosition()', () => {
        it('should return the contextX, contextY, and contextZ values', () => {
            const bot = createBot('test', {
                dimensionX: 10,
                dimensionY: 11,
                dimensionZ: 12,
            });

            const calc = createPrecalculatedContext([bot]);

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

            const calc = createPrecalculatedContext([bot]);

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
                scaleX: 10,
                scaleY: 11,
                scaleZ: 12,
            });

            const calc = createPrecalculatedContext([bot]);

            expect(getBotScale(calc, bot)).toEqual({
                x: 10,
                y: 11,
                z: 12,
            });
        });

        it('should cache the result', () => {
            const bot = createBot('test', {
                scaleX: 10,
                scaleY: 11,
                scaleZ: 12,
            });

            const calc = createPrecalculatedContext([bot]);
            const calc2 = createPrecalculatedContext([bot]);

            expect(getBotScale(calc, bot)).toBe(getBotScale(calc, bot));
            expect(getBotScale(calc, bot)).not.toBe(getBotScale(calc2, bot));
        });
    });

    describe('getPortalConfigBotID()', () => {
        it('should return the bot ID that the config bot tag points to', () => {
            const userBot = createBot('userBot', {
                gridPortal: 'abc',
                gridPortalConfigBot: 'test',
            });

            const calc = createPrecalculatedContext([userBot]);
            const id = getPortalConfigBotID(calc, userBot, 'gridPortal');

            expect(id).toEqual('test');
        });

        it('should return null if the tag does not exist', () => {
            const userBot = createBot('userBot', {
                gridPortal: 'abc',
            });

            const calc = createPrecalculatedContext([userBot]);
            const id = getPortalConfigBotID(calc, userBot, 'gridPortal');

            expect(id).toEqual(null);
        });
    });

    describe('botDimensionSortOrder()', () => {
        it('should return the dimensionSortOrder tag', () => {
            const bot = createBot('bot', {
                dimensionSortOrder: 123,
            });
            const calc = createPrecalculatedContext([bot]);

            expect(botDimensionSortOrder(calc, bot, 'dimension')).toEqual(123);
        });
    });

    describe('getUserMenuId()', () => {
        it('should return the value from menuPortal', () => {
            const user = createBot('user', {
                menuPortal: 'dimension',
            });

            const calc = createPrecalculatedContext([user]);
            const id = getUserMenuId(calc, user);
            expect(id).toBe('dimension');
        });
    });

    describe('getBotsInMenu()', () => {
        it('should return the list of bots in the users menu', () => {
            const user = createBot('user', {
                menuPortal: 'dimension',
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

            const calc = createPrecalculatedContext([user, bot2, bot1, bot3]);
            const bots = getBotsInMenu(calc, user);

            expect(bots).toEqual([bot1, bot2, bot3]);
        });
    });

    describe('getChannelBotById()', () => {
        it('should return the first bot that matches', () => {
            const channel = createBot('channel', {
                server: 'test',
                'aux.channels': true,
            });

            const calc = createPrecalculatedContext([channel]);
            const bot = getChannelBotById(calc, 'test');

            expect(bot).toEqual(channel);
        });

        it('should return null if there are no matches', () => {
            const channel = createBot('channel', {
                server: 'test',
                'aux.channels': true,
            });

            const calc = createPrecalculatedContext([channel]);
            const bot = getChannelBotById(calc, 'other');

            expect(bot).toEqual(null);
        });
    });

    describe('addBotToMenu()', () => {
        it('should return the update needed to add the given bot ID to the given users menu', () => {
            const user = createBot('user', {
                menuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([user, bot]);
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
                menuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([user, bot]);
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
                menuPortal: 'dimension',
            });
            const bot = createBot('bot');
            const bot2 = createBot('bot2', {
                dimension: true,
            });

            const calc = createPrecalculatedContext([user, bot, bot2]);
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
                menuPortal: 'dimension',
            });
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([user, bot]);
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

            const calc = createPrecalculatedContext([bot]);
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
                'auxDimensionConfig.surface.grid.2:2': '3',
            });

            const calc = createPrecalculatedContext([bot]);
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

            const calc = createPrecalculatedContext([bot]);
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

            const calc = createPrecalculatedContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should return the default if the bot is a user bot', () => {
            const bot = createBot('bot', {
                auxPlayerName: 'user',
                auxDimensionVisualize: 'surface',
            });

            const calc = createPrecalculatedContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(1);
        });

        it('should still return the user bots dimension size', () => {
            const bot = createBot('bot', {
                auxPlayerName: 'user',
                auxDimensionVisualize: 'surface',
                auxDimensionSurfaceSize: 10,
            });

            const calc = createPrecalculatedContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(10);
        });

        it('should return 0 if the bot is not a surface', () => {
            const bot = createBot('bot', {
                auxDimensionVisualize: true,
                auxDimensionSurfaceSize: 10,
            });

            const calc = createPrecalculatedContext([bot]);
            const size = getDimensionSize(calc, bot);

            expect(size).toBe(0);
        });
    });

    describe('getContextColor()', () => {
        const tagCases = ['auxPortalColor', 'portalColor'];

        describe.each(tagCases)('%s', (tag: string) => {
            it('should return the auxPortalColor of the bot', () => {
                const bot = createBot('bot', {
                    [tag]: 'red',
                });

                const calc = createPrecalculatedContext([bot]);
                expect(getDimensionColor(calc, bot)).toBe('red');
            });
        });
    });

    describe('getContextGridScale()', () => {
        const tagCases = ['auxPortalGridScale', 'portalGridScale'];

        describe.each(tagCases)('%s', (tag: string) => {
            it('should return the auxPortalGridScale of the bot', () => {
                const bot = createBot('bot', {
                    [tag]: 10,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(getDimensionGridScale(calc, bot)).toBe(10);
            });
        });
    });

    describe('getContextScale()', () => {
        const tagCases = ['auxPortalSurfaceScale', 'portalSurfaceScale'];

        describe.each(tagCases)('%s', (tag: string) => {
            it('should return the auxPortalSurfaceScale of the bot', () => {
                const bot = createBot('bot', {
                    [tag]: 10,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(getDimensionScale(calc, bot)).toBe(10);
            });
        });

        it('should return the default surface scale if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createPrecalculatedContext([bot]);
            expect(getDimensionScale(calc, bot)).toBe(DEFAULT_WORKSPACE_SCALE);
        });
    });

    describe('getContextDefaultHeight()', () => {
        const tagCases = [
            'auxPortalSurfaceDefaultHeight',
            'portalSurfaceDefaultHeight',
        ];

        describe.each(tagCases)('%s', (tag: string) => {
            it('should return the auxPortalSurfaceDefaultHeight of the bot', () => {
                const bot = createBot('bot', {
                    auxPortalSurfaceDefaultHeight: 10.123,
                });

                const calc = createPrecalculatedContext([bot]);
                expect(getDimensionDefaultHeight(calc, bot)).toBe(10.123);
            });
        });

        it('should return undefined if the tag is not set', () => {
            const bot = createBot('bot', {});

            const calc = createPrecalculatedContext([bot]);
            expect(getDimensionDefaultHeight(calc, bot)).toBeUndefined();
        });
    });

    describe('calculateStringListTagValue()', () => {
        it('should return the list contained in the tag with each value converted to a string', () => {
            const bot = createBot('test', {
                tag: ['abc', '', {}, [], false, 0, null, undefined],
            });
            const calc = createPrecalculatedContext([bot]);
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
            const calc = createPrecalculatedContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        it('should return the default value if the tag contains an empty string', () => {
            const bot = createBot('test', {
                tag: '',
            });
            const calc = createPrecalculatedContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        let cases = [
            [1.1, ['1.1']] as const,
            [false, ['false']] as const,
            ['abc', ['abc']] as const,
            [['abc'], ['abc']] as const,
        ];

        it.each(cases)('should convert %s', (value, expected) => {
            const bot = createBot('test', {
                tag: value,
            });
            const calc = createPrecalculatedContext([bot]);
            const result = calculateStringListTagValue(calc, bot, 'tag', []);

            expect(result).toEqual(expected);
        });
    });

    describe('addToContextDiff()', () => {
        it('should return the tags needed to add a bot to a dimension', () => {
            const bot = createBot('bot', {});

            const calc = createPrecalculatedContext([bot]);
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

            const calc = createPrecalculatedContext([bot, bot2]);
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

            const calc = createPrecalculatedContext([bot, bot2]);
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
            const calc = createPrecalculatedContext([]);
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

            const calc = createPrecalculatedContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(true);
        });

        it('should return false if not movable', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 'abc',
                auxDimensionSurfaceMovable: false,
            });

            const calc = createPrecalculatedContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(false);
        });

        it('should be movable by default', () => {
            const bot = createBot('test', {});

            const calc = createPrecalculatedContext([bot]);

            expect(isDimensionMovable(calc, bot)).toBe(true);
        });
    });

    describe('isContext()', () => {
        it('should return true when the given bot has auxDimensionConfig set to something', () => {
            const bot = createBot('test', {
                auxDimensionConfig: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            expect(isDimension(calc, bot)).toBe(true);
        });

        it('should return false when the given bot does not have auxDimensionConfig set to something', () => {
            const bot = createBot('test', {
                auxDimensionConfig: '',
            });

            const calc = createPrecalculatedContext([bot]);
            expect(isDimension(calc, bot)).toBe(false);
        });
    });

    describe('getBotConfigContexts()', () => {
        it('should return the list of values in auxDimensionConfig', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['abc']);
        });

        it('should return the list of values when given a number', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: 123,
            });

            const calc = createPrecalculatedContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['123']);
        });

        it('should return the list of values when given a boolean', () => {
            const bot = createBot('test', {
                abc: true,
                auxDimensionConfig: false,
            });

            const calc = createPrecalculatedContext([bot]);
            const tags = getBotConfigDimensions(calc, bot);

            expect(tags).toEqual(['false']);
        });
    });

    describe('isContextLocked()', () => {
        it('should default to false when the bot is a dimension', () => {
            const bot = createBot('test', {
                auxDimensionConfig: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);
            const locked = isDimensionLocked(calc, bot);

            expect(locked).toEqual(false);
        });
    });

    describe('getBotLabelAnchor()', () => {
        it('should default to top', () => {
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([bot]);
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

        describe('auxLabelPosition', () => {
            it.each(cases)(
                'given %s it should return %s',
                (anchor, expected) => {
                    const bot = createBot('bot', {
                        auxLabelPosition: anchor,
                    });

                    const calc = createPrecalculatedContext([bot]);
                    const a = getBotLabelAnchor(calc, bot);

                    expect(a).toBe(expected);
                }
            );
        });

        describe('labelPosition', () => {
            it.each(cases)(
                'given %s it should return %s',
                (anchor, expected) => {
                    const bot = createBot('bot', {
                        labelPosition: anchor,
                    });

                    const calc = createPrecalculatedContext([bot]);
                    const a = getBotLabelAnchor(calc, bot);

                    expect(a).toBe(expected);
                }
            );
        });
    });

    describe('getBotLabelAlignment()', () => {
        it('should default to center', () => {
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([bot]);
            const anchor = getBotLabelAlignment(calc, bot);

            expect(anchor).toBe('center');
        });

        const cases = [
            ['center', 'center'],
            ['left', 'left'],
            ['right', 'right'],
            ['abc', 'center'],
        ];

        describe('auxLabelAlignment', () => {
            it.each(cases)(
                'given %s it should return %s',
                (anchor, expected) => {
                    const bot = createBot('bot', {
                        auxLabelAlignment: anchor,
                    });

                    const calc = createPrecalculatedContext([bot]);
                    const a = getBotLabelAlignment(calc, bot);

                    expect(a).toBe(expected);
                }
            );
        });

        describe('labelAlignment', () => {
            it.each(cases)(
                'given %s it should return %s',
                (anchor, expected) => {
                    const bot = createBot('bot', {
                        labelAlignment: anchor,
                    });

                    const calc = createPrecalculatedContext([bot]);
                    const a = getBotLabelAlignment(calc, bot);

                    expect(a).toBe(expected);
                }
            );
        });
    });

    describe('getBotLabelPadding()', () => {
        const tagCases = ['auxLabelPadding', 'labelPadding'];

        describe.each(tagCases)('%s', (tag) => {
            numericalTagValueTests(0, (given, expected) => {
                const bot = createBot('test', {
                    [tag]: given,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotLabelPadding(calc, bot)).toEqual({
                    horizontal: expected,
                    vertical: expected,
                });
            });

            const outOfBoundsTests = [
                ['Infinity', Infinity],
                ['Negative Infinity', -Infinity],
                ['NaN', NaN],
            ];

            it.each(outOfBoundsTests)(
                'should map %s to 0',
                (desc: string, value: number) => {
                    const bot = createBot('test', {
                        [tag]: value,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotLabelPadding(calc, bot)).toEqual({
                        horizontal: 0,
                        vertical: 0,
                    });
                }
            );

            it('should return 1 by default', () => {
                const bot = createBot('test', {
                    [tag]: null,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotLabelPadding(calc, bot)).toEqual({
                    horizontal: 0,
                    vertical: 0,
                });
            });

            it('should add the builtin and vertical/horizontal paddings together', () => {
                const bot = createBot('test', {
                    [tag]: 2,
                    [tag + 'Y']: 1,
                    [tag + 'X']: 3,
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getBotLabelPadding(calc, bot)).toEqual({
                    horizontal: 5,
                    vertical: 3,
                });
            });

            const separatePaddingValuesTests = [
                [13, 21, { vertical: 13, horizontal: 21 }],
                [3.14159, 0.2, { vertical: 3.14159, horizontal: 0.2 }],
                [3.14159, null, { vertical: 3.14159, horizontal: 0 }],
                [0.123, 1000, { vertical: 0.123, horizontal: 1000 }],
                [null, 1000, { vertical: 0, horizontal: 1000 }],
                [1000, 0, { vertical: 1000, horizontal: 0 }],
                [1000, 123, { vertical: 1000, horizontal: 123 }],
            ];

            it.each(separatePaddingValuesTests)(
                'should support %s',
                (vertical: number, horizontal: number, expected: any) => {
                    const bot = createBot('test', {
                        [tag + 'Y']: vertical,
                        [tag + 'X']: horizontal,
                    });

                    const calc = createPrecalculatedContext([bot]);

                    expect(getBotLabelPadding(calc, bot)).toEqual(expected);
                }
            );
        });
    });

    describe('getBotScaleMode()', () => {
        it('should default to fit', () => {
            const bot = createBot('bot');

            const calc = createPrecalculatedContext([bot]);
            const anchor = getBotScaleMode(calc, bot);

            expect(anchor).toBe('fit');
        });

        const cases = [
            ['fit', 'fit'],
            ['absolute', 'absolute'],
            ['abc', 'fit'],
        ];
        const tagCases = ['auxScaleMode', 'scaleMode'];
        describe.each(tagCases)('%s', (tag: string) => {
            it.each(cases)(
                'given %s it should return %s',
                (anchor, expected) => {
                    const bot = createBot('bot', {
                        [tag]: anchor,
                    });

                    const calc = createPrecalculatedContext([bot]);
                    const a = getBotScaleMode(calc, bot);

                    expect(a).toBe(expected);
                }
            );
        });
    });

    describe('getBotVersion()', () => {
        it('should return the auxVersion', () => {
            const bot = createBot('test', {
                auxVersion: 1,
            });

            const calc = createPrecalculatedContext([bot]);

            expect(getBotVersion(calc, bot)).toBe(1);
        });

        it('should return undefined if not a number', () => {
            const bot = createBot('test', {
                auxVersion: 'abc',
            });

            const calc = createPrecalculatedContext([bot]);

            expect(getBotVersion(calc, bot)).toBeUndefined();
        });
    });

    describe('isBotInDimension()', () => {
        it('should handle boolean objects', () => {
            const thisBot = createBot('thisBot', {
                dimension: new Boolean(true),
            });

            const calc = createPrecalculatedContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, 'dimension');

            expect(result).toBe(true);
        });

        it('should handle a string object as the dimension', () => {
            const thisBot = createBot('thisBot', {
                dimension: true,
            });

            const calc = createPrecalculatedContext([thisBot]);
            const result = isBotInDimension(
                calc,
                thisBot,
                <any>new String('dimension')
            );

            expect(result).toBe(true);
        });

        booleanTagValueTests(false, (given, expected) => {
            const thisBot = createBot('thisBot', {
                dimension: given,
            });

            const calc = createPrecalculatedContext([thisBot]);
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

            const calc = createPrecalculatedContext([thisBot]);
            const result = isBotInDimension(calc, thisBot, 'dimension');

            expect(result).toBe(expected);
        });
    });

    describe('isBotPointable()', () => {
        const tagCases = ['auxPointable', 'pointable'];
        describe.each(tagCases)('%s', (tag: string) => {
            booleanTagValueTests(true, (given, expected) => {
                const thisBot = createBot('thisBot', {
                    [tag]: given,
                });

                const calc = createPrecalculatedContext([thisBot]);
                const result = isBotPointable(calc, thisBot);

                expect(result).toBe(expected);
            });
        });
    });

    describe('isBotFocusable()', () => {
        const tagCases = ['auxFocusable', 'focusable'];
        describe.each(tagCases)('%s', (tag: string) => {
            booleanTagValueTests(true, (given, expected) => {
                const thisBot = createBot('thisBot', {
                    [tag]: given,
                });

                const calc = createPrecalculatedContext([thisBot]);
                const result = isBotFocusable(calc, thisBot);

                expect(result).toBe(expected);
            });
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

                const calc = createPrecalculatedContext([bot]);

                expect(getUserBotColor(calc, bot, domain)).toBe(expected);
            }
        );

        const userCases = [['player'], ['builder']];

        it.each(userCases)(
            'should use auxColor from the user bot',
            (domain: AuxDomain) => {
                const bot = createBot('test', {
                    auxColor: 'red',
                });

                const calc = createPrecalculatedContext([bot]);

                expect(getUserBotColor(calc, bot, domain)).toBe('red');
            }
        );
    });

    describe('calculateDestroyBotEvents()', () => {
        it('should return a list of events needed to destroy the given bot', () => {
            const bot1 = createBot('bot1');
            const bot2 = createBot('bot2', {
                creator: 'bot1',
            });
            const bot3 = createBot('bot3', {
                creator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                creator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createPrecalculatedContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined
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
                creator: 'bot1',
                destroyable: false,
            });
            const bot3 = createBot('bot3', {
                creator: 'bot2',
            });
            const bot4 = createBot('bot4', {
                creator: 'bot1',
            });
            const bot5 = createBot('bot5');

            const calc = createPrecalculatedContext(
                [bot1, bot2, bot3, bot4, bot5],
                undefined
            );
            const events = calculateDestroyBotEvents(calc, bot1);

            expect(events).toEqual([
                botRemoved('bot1'),
                // bot2 and bot3 are not destroyed because they are not destroyable
                botRemoved('bot4'),
            ]);
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

    describe('BotLookupTable', () => {
        describe('buildLookupTable()', () => {
            const dataTypes = [
                ['support strings', 'jkl', 'pqr'] as const,
                ['support integers', 123, 456] as const,
                ['support floats', 123.65, 456.789] as const,
                ['support booleans', false, true] as const,
                ['support nulls', null as any, null as any] as const,
                ['support mixed types', 'hello', 987] as const,
                ['support zero', 0, 0] as const,
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

                const calc = createPrecalculatedContext([
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

                const calc = createPrecalculatedContext([test]);
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

                const calc = createPrecalculatedContext([
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

                const calc = createPrecalculatedContext([
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
