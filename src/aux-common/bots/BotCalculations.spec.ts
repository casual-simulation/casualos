import {
    isFormula,
    isNumber,
    isArray,
    updateBot,
    createBot,
    filtersMatchingArguments,
    calculateBotValue,
    parseFilterTag,
    validateTag,
    botTags,
    isHiddenTag,
    getActiveObjects,
    filterMatchesArguments,
    parseArray,
    duplicateBot,
    doBotsAppearEqual,
    isTagWellKnown,
    calculateStateDiff,
    tagsOnBot,
    createWorkspace,
    isBotMovable,
    isBotStackable,
    newSelectionId,
    objectsAtContextGridPosition,
    calculateFormulaValue,
    filterBotsBySelection,
    isBot,
    getBotShape,
    getDiffUpdate,
    COMBINE_ACTION_NAME,
    getUserMenuId,
    getBotsInMenu,
    addBotToMenu,
    removeBotFromMenu,
    getContextSize,
    addToContextDiff,
    removeFromContextDiff,
    getBotConfigContexts,
    isContext,
    createContextId,
    isMergeable,
    getBotLabelAnchor,
    formatValue,
    isContextMovable,
    isPickupable,
    isSimulation,
    parseSimulationId,
    getBotVersion,
    isBotInContext,
    getBotUsernameList,
    isInUsernameList,
    whitelistAllowsAccess,
    blacklistAllowsAccess,
    getBotDragMode,
    whitelistOrBlacklistAllowsAccess,
    getBuilderContextGrid,
    SimulationIdParseSuccess,
    simulationIdToString,
    isContextLocked,
    isDestroyable,
    isEditable,
    normalizeAUXBotURL,
    getContextVisualizeMode,
    getUserBotColor,
    cleanBot,
    convertToCopiableValue,
} from './BotCalculations';
import { cloneDeep } from 'lodash';
import {
    Bot,
    Object,
    PartialBot,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    AuxDomain,
    GLOBALS_BOT_ID,
    BotsState,
} from './Bot';
import { createCalculationContext } from './BotCalculationContextFactories';
import uuid from 'uuid/v4';
import { AuxObject, AuxBot } from '../aux-format';
import { botCalculationContextTests } from './test/BotCalculationContextTests';
import { BotCalculationContext } from '.';
import { BotLookupTableHelper } from './BotLookupTableHelper';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

const dateNowMock = (Date.now = jest.fn());

describe('BotCalculations', () => {
    describe('isFormula()', () => {
        it('should be true when value starts with a "=" sign', () => {
            expect(isFormula('=')).toBeTruthy();
            expect(isFormula('a=')).toBeFalsy();
        });

        it('should be false when value does not start with a "=" sign', () => {
            expect(isFormula('abc')).toBeFalsy();
        });
    });

    describe('isNumber()', () => {
        const cases = [
            [true, '123'],
            [true, '0'],
            [true, '-12'],
            [true, '19.325'],
            [true, '-27.981'],
            [true, '27.0'],
            [false, '1.'],
            [true, '.01'],
            [true, '.567'],
            [true, 'infinity'],
            [true, 'Infinity'],
            [true, 'InFIniTy'],
            [false, '$123'],
            [false, 'abc'],
            [false, '.'],
        ];

        it.each(cases)(
            'be %s when given %s',
            (expected: boolean, value: string) => {
                expect(isNumber(value)).toBe(expected);
            }
        );
    });

    describe('isArray()', () => {
        it('should be true if the value is a simple list surrounded by square brackets', () => {
            expect(isArray('[1,2,3]')).toBeTruthy();
            expect(isArray('[1]')).toBeTruthy();
            expect(isArray('[]')).toBeTruthy();
            expect(isArray('[eggs, milk, ham]')).toBeTruthy();
            expect(isArray('[(eggs), milk, ham]')).toBeTruthy();
            expect(isArray('[(eggs), (milk, -ham)]')).toBeTruthy();

            expect(isArray('')).toBeFalsy();
            expect(isArray('abc, def, ghi')).toBeFalsy();
            expect(isArray('1,2,3')).toBeFalsy();
            expect(isArray('clone(this, { something: true })')).toBeFalsy();
        });
    });

    describe('parseArray()', () => {
        it('should handle empty arrays properly', () => {
            expect(parseArray('[]')).toEqual([]);
        });
    });

    describe('isBot()', () => {
        it('should return true if the object has an ID and tags', () => {
            expect(
                isBot({
                    id: 'test',
                    tags: {},
                })
            ).toBe(true);

            expect(
                isBot({
                    id: 'false',
                    tags: {
                        test: 'abc',
                    },
                })
            ).toBe(true);

            expect(
                isBot({
                    id: '',
                    tags: {},
                })
            ).toBe(false);

            expect(isBot(null)).toBe(false);
            expect(isBot({})).toBe(false);
        });
    });

    describe('calculateStateDiff()', () => {
        it('should return no changes', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
        });

        it('should detect that a bot was added', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                test: prevState['test'],
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
            expect(result.addedBots.length).toBe(1);
            expect(result.addedBots[0]).toBe(currState['new']);
        });

        it('should detect that a bot was removed', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {};

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(1);
            expect(result.removedBots[0]).toBe('test');
        });

        it('should detect that a bot was updated', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(1);
            expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it('should use deep equality for updates', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
        });

        it('should handle multiple changes at once', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                removed: {
                    id: 'removed',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
                new2: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 15, z: 3 },
                        _workspace: 'test',
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(2);
            expect(result.addedBots[0]).toBe(currState['new']);
            expect(result.addedBots[1]).toBe(currState['new2']);
            expect(result.removedBots.length).toBe(1);
            expect(result.removedBots[0]).toBe('removed');
            expect(result.updatedBots.length).toBe(1);
            expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it.skip('should short-circut when a add_bot event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'add_bot',
            //     creation_time: new Date(),
            //     bot: currState['new'],
            //     id: 'new'
            // });

            // expect(result.removedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(0);
            // expect(result.addedBots.length).toBe(1);
            // expect(result.addedBots[0]).toBe(currState['new']);
        });

        it.skip('should short-circut when a remove_bot event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                old: {
                    id: 'old',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'remove_bot',
            //     creation_time: new Date(),
            //     id: 'old'
            // });

            // expect(result.addedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(0);
            // expect(result.removedBots.length).toBe(1);
            // expect(result.removedBots[0]).toBe(prevState['old']);
        });

        it.skip('should short-circut when a update_bot event is given', () => {
            const prevState: BotsState = {
                updated: {
                    id: 'updated',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                updated: {
                    id: 'updated',
                    tags: {
                        position: { x: 2, y: 1, z: 3 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'update_bot',
            //     creation_time: new Date(),
            //     id: 'updated',
            //     update: {
            //         position: {x:2, y:1, z:3},
            //     }
            // });

            // expect(result.addedBots.length).toBe(0);
            // expect(result.removedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(1);
            // expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it.skip('should not short-circut when a action event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                removed: {
                    id: 'removed',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
                new2: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 15, z: 3 },
                        _workspace: 'test',
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'transaction',
            //     creation_time: new Date(),
            //     events: []
            // });

            // expect(result.addedBots.length).toBe(2);
            // expect(result.addedBots[0]).toBe(currState['new']);
            // expect(result.addedBots[1]).toBe(currState['new2']);
            // expect(result.removedBots.length).toBe(1);
            // expect(result.removedBots[0]).toBe(prevState['removed']);
            // expect(result.updatedBots.length).toBe(1);
            // expect(result.updatedBots[0]).toBe(currState['updated']);
        });
    });

    describe('calculateBotValue()', () => {
        it('should return the raw tag when evaluating a formula with a context without a sandbox', () => {
            const bot1 = createBot('test');
            const bot2 = createBot('test2', {
                abc: 'def',
                formula: '="haha"',
            });
            const context: BotCalculationContext = {
                objects: [bot1, bot2],
                cache: new Map(),
                lookup: new BotLookupTableHelper(),
            };

            const result = calculateBotValue(context, bot2, 'formula');

            expect(result).toEqual('="haha"');
        });

        it('should return the raw tag when a formula with a null context', () => {
            const bot1 = createBot('test');
            const bot2 = createBot('test2', {
                abc: 'def',
                formula: '="haha"',
            });

            const result = calculateBotValue(null, bot2, 'formula');

            expect(result).toEqual('="haha"');
        });
    });

    describe('tagsOnBot()', () => {
        it('should return the tag names that are on objects', () => {
            expect(tagsOnBot(createBot('test'))).toEqual([]);

            expect(
                tagsOnBot(
                    createBot('test', {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: 123,
                        abc: undefined,
                    })
                )
            ).toEqual(['_position', '_workspace', 'test', 'abc']);
        });

        it('should return the property names that are on workspaces', () => {
            expect(tagsOnBot(createWorkspace('test', 'testContext'))).toEqual([
                'aux.context.x',
                'aux.context.y',
                'aux.context.z',
                'aux.context.visualize',
                'aux.context',
            ]);
        });
    });

    describe('getActiveObjects()', () => {
        it('should return only objects', () => {
            const state: BotsState = {
                first: {
                    id: 'first',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                second: {
                    id: 'second',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                workspace: {
                    id: 'workspace',
                    tags: {
                        defaultHeight: 1,
                        grid: {},
                        gridScale: 1,
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        scale: 1,
                        color: '#999999',
                    },
                },
            };

            const objects = getActiveObjects(state);

            expect(objects).toEqual([
                state['first'],
                state['second'],
                state['workspace'],
            ]);
        });

        it('should include destroyed objects', () => {
            const state: BotsState = {
                first: {
                    id: 'first',
                    tags: {
                        'aux._destroyed': true,
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                second: {
                    id: 'second',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };

            const objects = getActiveObjects(state);

            expect(objects).toEqual([state['first'], state['second']]);
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
            const obj: AuxBot = {
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
    });

    describe('createWorkspace()', () => {
        it('should create new random context id if empty', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', '');

            expect(workspace.tags['aux.context']).toEqual('uuid');
        });

        it('should create new random context id if undefined', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', undefined);

            expect(workspace.tags['aux.context']).toEqual('uuid');
        });

        it('should create new random context id if whitespace', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', ' ');

            expect(workspace.tags['aux.context']).toEqual('uuid');
        });

        it('should use input context id if given', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID');

            expect(workspace.tags['aux.context']).toEqual('userSetID');
        });

        // Test for the context type changes
        it('should lock the workspace by default', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID');

            expect(workspace.tags['aux.context.locked']).toEqual(undefined);
        });

        it('should allow setting the workspace to be unlocked', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID', false);

            expect(workspace.tags['aux.context.locked']).toEqual(undefined);
        });
    });

    describe('isTagWellKnown()', () => {
        uuidMock.mockReturnValue('test');

        const builtinTagCases = [
            ['abc._index'],
            ['_hidden'],
            ['aux._lastEditedBy'],
            ['abc._lastActiveTime'],
            ['aux._context_test'],
            ['aux._context_ something else'],
            ['aux._context_ 😊😜😢'],
            ['_context_test'],
            ['_context_ something else'],
            ['_context_ 😊😜😢'],
        ];
        it.each(builtinTagCases)(
            'should return true for some hidden tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const contextCases = [[createContextId()]];
        it.each(contextCases)(
            'should return false for autogenerated context tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(false);
            }
        );

        const selectionCases = [
            ['aux._selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            ['aux._selection_6a7aa1c5-807c-4390-9982-ff8b2dd5b54e'],
            ['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'],
        ];
        it.each(selectionCases)(
            'should return true for selection tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const normalCases = [
            [false, 'aux.movable'],
            [false, 'aux.stackable'],
            [false, 'aux.color'],
            [false, 'aux.label.color'],
            [false, 'aux.line'],
            [false, 'aux.scale.x'],
            [false, 'aux.scale.y'],
            [false, 'aux.scale.z'],
            [false, 'aux.scale'],
            [true, 'aux._destroyed'],
            [false, '+(#tag:"value")'],
            [false, 'onCombine(#tag:"value")'],
            [true, '_context_test'],
            [true, '_context_ something else'],
            [true, '_context_ 😊😜😢'],
            [true, '_selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            [false, '📦'],
        ];
        it.each(normalCases)(
            'should return %s for %',
            (expected: boolean, tag: string) => {
                expect(isTagWellKnown(tag)).toBe(expected);
            }
        );
    });

    describe('doBotsAppearEqual()', () => {
        it('should return true if both null', () => {
            const result = doBotsAppearEqual(null, null);

            expect(result).toBe(true);
        });

        it('should return false if one null', () => {
            expect(doBotsAppearEqual(createBot(), null)).toBe(false);
            expect(doBotsAppearEqual(null, createBot())).toBe(false);
        });

        it('should ignore IDs if theyre not the same', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags by default', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore context tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should use the ignoreId option for checking bot IDs', () => {
            let first = createBot('testID');
            let second = createBot('testID');

            first.tags.a = true;
            second.tags.a = false;

            // Defaults to using the ID as a shortcut
            expect(doBotsAppearEqual(first, second)).toBe(true);

            expect(doBotsAppearEqual(first, second, { ignoreId: true })).toBe(
                false
            );
        });

        it('should should ignore default hidden tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._context_A.x'] = 1;
            second.tags['aux._context_B.x'] = 0;

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });
    });

    describe('newSelectionId()', () => {
        beforeAll(() => {
            uuidMock.mockReturnValue('test');
        });

        it('should return IDs that are well known', () => {
            expect(isTagWellKnown(newSelectionId())).toBe(true);
        });
    });

    describe('cleanBot()', () => {
        it('should remove null and undefined tags', () => {
            let bot = createBot('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanBot(bot);

            expect(result).toEqual({
                id: 'test',
                tags: {
                    testTag: 'abcdefg',
                    other: 0,
                    falsy: false,
                    truthy: true,
                },
            });
        });

        it('should not modify the given bot', () => {
            let bot = createBot('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanBot(bot);

            expect(bot).toEqual({
                id: 'test',
                tags: {
                    testTag: 'abcdefg',
                    other: 0,
                    falsy: false,
                    truthy: true,
                    _workspace: null,
                    _test: undefined,
                },
            });
        });
    });

    describe('parseFilterTag()', () => {
        it('should return unsucessful if not in the formula syntax', () => {
            let result = parseFilterTag('myTag');
            expect(result.success).toBe(false);

            result = parseFilterTag('onCombinemyTag');
            expect(result.success).toBe(false);

            result = parseFilterTag('onCombine(myTag)');
            expect(result.success).toBe(false);

            result = parseFilterTag('onCombine(myTag:"")');
            expect(result.success).toBe(false);

            result = parseFilterTag('#myTag');
            expect(result.success).toBe(false);
        });

        it('should return sucessful if in the formula syntax', () => {
            let result = parseFilterTag('onCombine(#name:"")');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'name',
                    value: '',
                },
            });

            result = parseFilterTag('onCombine(#name:"abc")');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'name',
                    value: 'abc',
                },
            });

            result = parseFilterTag('-(#name:"abc")');
            expect(result).toMatchObject({
                success: true,
                eventName: '-',
                filter: {
                    tag: 'name',
                    value: 'abc',
                },
            });

            result = parseFilterTag('craziness(#lalalal:"abc")');
            expect(result).toMatchObject({
                success: true,
                eventName: 'craziness',
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine ( #lalalal : "abc" )');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine ( #lalalal : "abc"');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine ( #lalalal : "abc');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine ( #lalalal : "abc  ');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc  ',
                },
            });

            result = parseFilterTag('onCombine ( # lalalal : "abc  ');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc  ',
                },
            });

            result = parseFilterTag('onCombine ( # lal alal : "abc  ');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lal alal',
                    value: 'abc  ',
                },
            });

            result = parseFilterTag('onCombine(#lalalal:abc)');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine(#lalalal:abc');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: 'abc',
                },
            });

            result = parseFilterTag('onCombine(#lalalal: abc\t');
            expect(result).toMatchObject({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                filter: {
                    tag: 'lalalal',
                    value: ' abc\t',
                },
            });
        });

        it('should return success if filter is empty', () => {
            let result = parseFilterTag('event()');
            expect(result).toEqual({
                success: true,
                tag: 'event()',
                eventName: 'event',
                filter: null,
            });

            result = parseFilterTag('event( )');
            expect(result).toEqual({
                success: true,
                tag: 'event( )',
                eventName: 'event',
                filter: null,
            });

            result = parseFilterTag('event( ab)');
            expect(result).toEqual({
                success: false,
                tag: 'event( ab)',
                eventName: 'event',
                partialSuccess: true,
            });
        });

        let quoteCases = [['“', '”'], ['‘', '’'], ['‘', '”'], ['“', '’']];
        it.each(quoteCases)(
            'should return success if using %s%s quotes',
            (startQuote, endQuote) => {
                let tag = `onCombine(#name:${startQuote}abc${endQuote})`;
                let result = parseFilterTag(tag);
                expect(result).toEqual({
                    success: true,
                    tag: tag,
                    eventName: 'onCombine',
                    filter: {
                        tag: 'name',
                        value: 'abc',
                    },
                });
            }
        );

        it('should return partial success if it was able to parse the event name', () => {
            const result = parseFilterTag('onCombine (');
            expect(result).toEqual({
                success: false,
                tag: 'onCombine (',
                partialSuccess: true,
                eventName: COMBINE_ACTION_NAME,
            });
        });

        it('should parse numbers', () => {
            let result = parseFilterTag('onCombine(#abc:"123.45")');
            expect(result).toEqual({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                tag: 'onCombine(#abc:"123.45")',
                filter: {
                    tag: 'abc',
                    value: 123.45,
                },
            });
        });

        it('should parse booleans', () => {
            let result = parseFilterTag('onCombine(#abc:"true")');
            expect(result).toEqual({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                tag: 'onCombine(#abc:"true")',
                filter: {
                    tag: 'abc',
                    value: true,
                },
            });
        });

        it('should parse arrays', () => {
            let result = parseFilterTag(
                'onCombine(#abc:"[hello, world, 12.34]")'
            );
            expect(result).toEqual({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                tag: 'onCombine(#abc:"[hello, world, 12.34]")',
                filter: {
                    tag: 'abc',
                    value: ['hello', 'world', 12.34],
                },
            });

            result = parseFilterTag('onCombine(#abc:"[]")');
            expect(result).toEqual({
                success: true,
                eventName: COMBINE_ACTION_NAME,
                tag: 'onCombine(#abc:"[]")',
                filter: {
                    tag: 'abc',
                    value: [],
                },
            });
        });
    });

    describe('parseSimulationId()', () => {
        it('should default to filling the channel ID', () => {
            let result = parseSimulationId('abc');
            expect(result).toEqual({
                success: true,
                channel: 'abc',
            });

            result = parseSimulationId('!@#$%');
            expect(result).toEqual({
                success: true,
                channel: '!@#$%',
            });

            result = parseSimulationId('.test');
            expect(result).toEqual({
                success: true,
                channel: '.test',
            });

            result = parseSimulationId('test.');
            expect(result).toEqual({
                success: true,
                channel: 'test.',
            });
        });

        it('should fill in the context', () => {
            let result = parseSimulationId('abc/def');
            expect(result).toEqual({
                success: true,
                context: 'abc',
                channel: 'def',
            });

            result = parseSimulationId('!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                context: '!@#$%',
                channel: '@@a*987',
            });

            result = parseSimulationId('abc/def/ghi/');
            expect(result).toEqual({
                success: true,
                context: 'abc',
                channel: 'def/ghi/',
            });

            result = parseSimulationId('abc/def/ghi/.hello');
            expect(result).toEqual({
                success: true,
                context: 'abc',
                channel: 'def/ghi/.hello',
            });
        });

        it('should fill in the host', () => {
            let result = parseSimulationId('auxplayer.com/abc/def');
            expect(result).toEqual({
                success: true,
                host: 'auxplayer.com',
                context: 'abc',
                channel: 'def',
            });

            result = parseSimulationId('abc.test.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                host: 'abc.test.local',
                context: '!@#$%',
                channel: '@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                host: '.local',
                context: '!@#$%',
                channel: '@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                host: '.local',
                context: '!@#$%',
                channel: '@@a*987',
            });
        });

        it('should use the given URL', () => {
            let result = parseSimulationId('https://example.com');
            expect(result).toEqual({
                success: true,
                host: 'example.com',
            });

            result = parseSimulationId('https://example.com/sim');
            expect(result).toEqual({
                success: true,
                host: 'example.com',
                context: 'sim',
            });

            result = parseSimulationId('https://example.com/sim/context');
            expect(result).toEqual({
                success: true,
                host: 'example.com',
                context: 'sim',
                channel: 'context',
            });

            result = parseSimulationId('https://example.com:3000/sim/context');
            expect(result).toEqual({
                success: true,
                host: 'example.com:3000',
                context: 'sim',
                channel: 'context',
            });
        });
    });

    describe('simulationIdToString()', () => {
        it('should encode the channel', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                channel: 'test',
            };

            expect(simulationIdToString(id)).toBe('test');
        });

        it('should encode the channel without the context', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                channel: 'test',
                context: 'abc',
            };

            expect(simulationIdToString(id)).toBe('test');
        });

        it('should encode the host', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                host: 'example.com',
                channel: 'test',
                context: 'abc',
            };

            expect(simulationIdToString(id)).toBe('example.com/*/test');
        });
    });

    describe('normalizeAUXBotURL()', () => {
        const cases = [
            ['http://example.com/path', 'http://example.com/path.aux'],
            ['http://example.com/', 'http://example.com/.aux'],
            ['http://example.com', 'http://example.com/.aux'],
            ['https://example.com/*/test', 'https://example.com/*/test.aux'],
            [
                'http://example.com/context/channel',
                'http://example.com/context/channel.aux',
            ],
            [
                'http://example.com/context/channel.aux',
                'http://example.com/context/channel.aux',
            ],
            ['http://example.com/.aux', 'http://example.com/.aux'],
        ];

        it.each(cases)('should map %s to %s', (given, expected) => {
            expect(normalizeAUXBotURL(given)).toBe(expected);
        });
    });

    describe('validateTag()', () => {
        it('should return invalid when tag is empty or null', () => {
            let errors = validateTag('');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });

            errors = validateTag(null);
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });

            errors = validateTag('  \t\n');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });
        });

        it('should return invalid when tag contains #', () => {
            let errors = validateTag('#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });

            errors = validateTag('abc#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });

            errors = validateTag(' #def');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });
        });

        it('should allow # when it is a filter', () => {
            let errors = validateTag(COMBINE_ACTION_NAME);
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(#');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(#tag:"###test');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(#tag:"###test")');
            expect(errors).toEqual({
                valid: true,
            });
        });

        it('should be valid when tag is fine', () => {
            let errors = validateTag('abcdef');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('  abcdef');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('abcdef  ');
            expect(errors).toEqual({
                valid: true,
            });
        });
    });

    describe('isHiddenTag()', () => {
        it('should be true for tags that start with underscores', () => {
            expect(isHiddenTag('_')).toBe(true);
            expect(isHiddenTag('__')).toBe(true);
            expect(isHiddenTag('_abc')).toBe(true);
            expect(isHiddenTag('_position')).toBe(true);
            expect(isHiddenTag('_workspace')).toBe(true);
            expect(isHiddenTag('_ test')).toBe(true);
            expect(isHiddenTag('_+abc')).toBe(true);

            expect(isHiddenTag('lalala_')).toBe(false);
            expect(isHiddenTag('a_')).toBe(false);
            expect(isHiddenTag('in_middle')).toBe(false);
            expect(isHiddenTag(' _underscored')).toBe(false);
            expect(isHiddenTag('+tag')).toBe(false);
        });

        it('should be true for tags that start with underscores after dots', () => {
            expect(isHiddenTag('aux._')).toBe(true);
            expect(isHiddenTag('aux._context_')).toBe(true);
            expect(isHiddenTag('aux._selection')).toBe(true);
            expect(isHiddenTag('domain._hidden')).toBe(true);

            expect(isHiddenTag('._')).toBe(false);
            expect(isHiddenTag('-._')).toBe(false);
            expect(isHiddenTag('\\._')).toBe(false);
            expect(isHiddenTag('abc,_context_')).toBe(false);
            expect(isHiddenTag('aux.test_')).toBe(false);
        });
    });

    describe('botTags()', () => {
        it('should return the list of tags that the bots have minus ones that start with underscores', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], []);

            expect(tags).toEqual(['tag', 'other']);
        });

        it('should preserve the order of the current tags', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['other', 'tag'], []);

            expect(tags).toEqual(['other', 'tag']);
        });

        it('should include the given extra tags', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], ['abc', '_position']);

            expect(tags).toEqual(['tag', 'other', 'abc', '_position']);
        });

        it('should not include extra tags that are given in the currrentTags array', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['notIncluded'], []);

            expect(tags).toEqual(['tag', 'other']);
        });

        it('should include hidden tags if specified', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _hiddenTag1: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _hiddenTag2: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _hiddenTag3: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _hiddenTag4: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['notIncluded'], [], true);

            expect(tags).toEqual([
                '_hiddenTag1',
                '_hiddenTag2',
                'tag',
                '_hiddenTag3',
                '_hiddenTag4',
                'other',
            ]);
        });
    });

    describe('createContextId()', () => {
        const cases = [['abcdefghi', 'abcdefgh']];
        it.each(cases)('should convert %s to %s', (uuid, id) => {
            uuidMock.mockReturnValue(uuid);
            expect(createContextId()).toBe(id);
        });
    });

    describe('formatValue()', () => {
        it('should format bots to a short ID', () => {
            const bot = createBot('abcdefghijklmnopqrstuvwxyz');
            expect(formatValue(bot)).toBe('abcde');
        });

        it('should format bot arrays', () => {
            const bot1 = createBot('abcdefghijklmnopqrstuvwxyz');
            const bot2 = createBot('zyxwvutsrqponmlkjighfedcba');
            expect(formatValue([bot1, bot2])).toBe('[abcde,zyxwv]');
        });

        it('should convert errors to strings', () => {
            const error = new Error('test');
            expect(formatValue(error)).toBe(error.toString());
        });
    });

    botCalculationContextTests(uuidMock, dateNowMock, (bots, userId) =>
        createCalculationContext(bots, userId)
    );
});
