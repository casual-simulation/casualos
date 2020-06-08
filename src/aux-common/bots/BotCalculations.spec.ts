import {
    isFormula,
    isNumber,
    isArray,
    createBot,
    calculateBotValue,
    validateTag,
    botTags,
    isHiddenTag,
    getActiveObjects,
    parseArray,
    doBotsAppearEqual,
    isTagWellKnown,
    calculateStateDiff,
    tagsOnBot,
    createWorkspace,
    isBot,
    createDimensionId,
    formatValue,
    parseSimulationId,
    SimulationIdParseSuccess,
    simulationIdToString,
    normalizeAUXBotURL,
    cleanBot,
    isScript,
    parseScript,
    getBotTag,
    getPortalTag,
    getUploadState,
    botHasLOD,
    calculateBotLOD,
} from './BotCalculations';
import { Bot, BotsState } from './Bot';
import uuid from 'uuid/v4';
import { botCalculationContextTests } from './test/BotCalculationContextTests';
import { BotLookupTableHelper } from './BotLookupTableHelper';
import { BotCalculationContext } from './BotCalculationContext';
import { createPrecalculatedContext } from './BotCalculationContextFactory';

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

    describe('isScript()', () => {
        it('should be true when value starts with a "@" sign', () => {
            expect(isScript('@')).toBeTruthy();
            expect(isScript('a@')).toBeFalsy();
        });

        it('should be false when value does not start with a "@" sign', () => {
            expect(isScript('abc')).toBeFalsy();
        });
    });

    describe('parseScript()', () => {
        it('should return the script when value starts with a "@" sign', () => {
            expect(parseScript('@')).toBe('');
            expect(parseScript('@abc')).toBe('abc');
        });

        it('should return null when the value does not start with an "@" sign', () => {
            expect(parseScript('abc')).toBe(null);
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

    describe('getBotTag()', () => {
        it('should return the bot ID', () => {
            const bot = createBot('test');

            expect(getBotTag(bot, 'id')).toEqual('test');
        });

        it('should return the bot space', () => {
            const bot = createBot('test', {}, <any>'abc');

            expect(getBotTag(bot, 'space')).toEqual('abc');
        });

        it('should return the given tag', () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            expect(getBotTag(bot, 'abc')).toEqual('def');
        });
    });

    describe('getPortalTag()', () => {
        const cases = [
            ['page', 'pagePortal'],
            ['inventory', 'inventoryPortal'],
            ['menu', 'menuPortal'],
            ['sheet', 'sheetPortal'],
            ['other', 'auxOtherPortal'],
            ['page', 'pagePortal'],
            ['inventoryPortal', 'inventoryPortal'],
            ['menuPortal', 'menuPortal'],
            ['sheetPortal', 'sheetPortal'],
            ['auxOtherPortal', 'auxOtherPortal'],
        ];
        it.each(cases)(
            'should return the corresponding tag for the portal type',
            (type, expected) => {
                const tag = getPortalTag(type);
                expect(tag).toBe(expected);
            }
        );
    });

    describe('botHasLOD()', () => {
        const lodListeners = [
            ['onMaxLODEnter'],
            ['onMaxLODExit'],
            ['onMinLODEnter'],
            ['onMinLODExit'],
            ['auxMaxLODThreshold'],
            ['auxMinLODThreshold'],
            ['maxLODThreshold'],
            ['minLODThreshold'],
        ];

        describe.each(lodListeners)('%s', (tag: string) => {
            it('should return true if the bot has a script', () => {
                const bot = createBot('test', {
                    [tag]: '@abc',
                });

                const calc = createPrecalculatedContext([bot]);
                const hasLod = botHasLOD(calc, bot);

                expect(hasLod).toBe(true);
            });

            it('should return false if it does not have a script', () => {
                const bot = createBot('test', {
                    [tag]: 'abc',
                });

                const calc = createPrecalculatedContext([bot]);
                const hasLod = botHasLOD(calc, bot);

                expect(hasLod).toBe(false);
            });
        });
    });

    describe('calculateBotLOD()', () => {
        it('should return normal when the virtual distance is between the min and max', () => {
            expect(calculateBotLOD(0.5, 0.1, 0.9)).toBe('normal');
        });

        it('should return max when the virtual distance is above the max', () => {
            expect(calculateBotLOD(1, 0.1, 0.9)).toBe('max');
        });

        it('should return min when the virtual distance is below the min', () => {
            expect(calculateBotLOD(0, 0.1, 0.9)).toBe('min');
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

        it('should fallback to the prefix-less tag name when getting an AUX tag', () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                auxAbc: '123',
            });

            const result1 = calculateBotValue(null, bot1, 'auxAbc');
            const result2 = calculateBotValue(null, bot2, 'auxAbc');
            expect(result1).toEqual('def');
            expect(result2).toEqual(123);
        });

        it('should handle fallback with characters that are surrogate pairs', () => {
            const bot1 = createBot('test1', {
                '😀': '123',
            });

            const result1 = calculateBotValue(null, bot1, 'aux😀');
            expect(result1).toEqual(123);
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
                'auxDimensionX',
                'auxDimensionY',
                'auxDimensionZ',
                'auxDimensionVisualize',
                'auxDimensionConfig',
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
    });

    describe('createWorkspace()', () => {
        it('should create new random dimension id if empty', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', '');

            expect(workspace.tags['auxDimensionConfig']).toEqual('uuid');
        });

        it('should create new random dimension id if undefined', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', undefined);

            expect(workspace.tags['auxDimensionConfig']).toEqual('uuid');
        });

        it('should create new random dimension id if whitespace', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', ' ');

            expect(workspace.tags['auxDimensionConfig']).toEqual('uuid');
        });

        it('should use input dimension id if given', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID');

            expect(workspace.tags['auxDimensionConfig']).toEqual('userSetID');
        });

        // Test for the dimension type changes
        it('should lock the workspace by default', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID');

            expect(workspace.tags['portalLocked']).toEqual(undefined);
        });

        it('should allow setting the workspace to be unlocked', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID', false);

            expect(workspace.tags['portalLocked']).toEqual(undefined);
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

        const contextCases = [[createDimensionId()]];
        it.each(contextCases)(
            'should return false for autogenerated dimension tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(false);
            }
        );

        const selectionCases = [
            ['_auxSelection09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            ['_auxSelection6a7aa1c5-807c-4390-9982-ff8b2dd5b54e'],
            ['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'],
        ];
        it.each(selectionCases)(
            'should return true for selection tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const normalCases = [
            [false, 'auxDraggable'],
            [false, 'auxStackable'],
            [false, 'auxColor'],
            [false, 'auxLabelColor'],
            [false, 'aux.line'],
            [false, 'auxScaleX'],
            [false, 'auxScaleY'],
            [false, 'auxScaleZ'],
            [false, 'auxScale'],
            [true, 'aux._hidden'],
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

            first.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore dimension tags', () => {
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

            first.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
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

            first.tags['aux._context_AX'] = 1;
            second.tags['aux._context_BX'] = 0;

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
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

        it('should not fill in the dimension', () => {
            let result = parseSimulationId('abc/def');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def',
            });

            result = parseSimulationId('!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '!@#$%/@@a*987',
            });

            result = parseSimulationId('abc/def/ghi/');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def/ghi/',
            });

            result = parseSimulationId('abc/def/ghi/.hello');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def/ghi/.hello',
            });
        });

        it('should not fill in the host when given an incomplete URL', () => {
            let result = parseSimulationId('auxplayer.com/abc/def');
            expect(result).toEqual({
                success: true,
                channel: 'auxplayer.com/abc/def',
            });

            result = parseSimulationId('abc.test.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: 'abc.test.local/!@#$%/@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '.local/!@#$%/@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '.local/!@#$%/@@a*987',
            });
        });

        it('should use the given URL', () => {
            let result = parseSimulationId('https://example.com');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
            });

            result = parseSimulationId('https://example.com/sim');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
            });

            result = parseSimulationId('https://example.com?auxStory=sim');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
                channel: 'sim',
            });

            result = parseSimulationId(
                'https://example.com:3000?auxStory=sim/dimension'
            );
            expect(result).toEqual({
                success: true,
                host: 'https://example.com:3000',
                channel: 'sim/dimension',
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

        it('should encode the channel without the dimension', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                channel: 'test',
            };

            expect(simulationIdToString(id)).toBe('test');
        });

        it('should encode the host', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                host: 'https://example.com',
                channel: 'test/abc',
            };

            expect(simulationIdToString(id)).toBe(
                `https://example.com?auxStory=${encodeURIComponent('test/abc')}`
            );
        });

        it('should support the host without a channel', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                host: 'https://example.com',
            };

            expect(simulationIdToString(id)).toBe(`https://example.com`);
        });
    });

    describe('normalizeAUXBotURL()', () => {
        const cases = [
            ['http://example.com/path', 'http://example.com/path.aux'],
            ['http://example.com/', 'http://example.com/.aux'],
            ['http://example.com', 'http://example.com/.aux'],
            ['https://example.com/*/test', 'https://example.com/*/test.aux'],
            [
                'http://example.com/dimension/channel',
                'http://example.com/dimension/channel.aux',
            ],
            [
                'http://example.com/dimension/channel.aux',
                'http://example.com/dimension/channel.aux',
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

        it('should not allow # when it is a filter', () => {
            let errors = validateTag('onCombine()');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(#');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
            });

            errors = validateTag('onCombine(#tag:"###test');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
            });

            errors = validateTag('onCombine(#tag:"###test")');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
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
            expect(isHiddenTag('_auxSelection')).toBe(true);
            expect(isHiddenTag('domain._hidden')).toBe(true);

            expect(isHiddenTag('._')).toBe(false);
            expect(isHiddenTag('-._')).toBe(false);
            expect(isHiddenTag('\\._')).toBe(false);
            expect(isHiddenTag('abc,_context_')).toBe(false);
            expect(isHiddenTag('aux.test_')).toBe(false);
        });
    });

    describe('botTags()', () => {
        it('should return the list of tags that the bots have', () => {
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

            expect(tags).toEqual(['_position', '_workspace', 'tag', 'other']);
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

            expect(tags).toEqual(['other', 'tag', '_position', '_workspace']);
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

            expect(tags).toEqual([
                '_position',
                '_workspace',
                'tag',
                'other',
                'abc',
            ]);
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

            expect(tags).toEqual(['_position', '_workspace', 'tag', 'other']);
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

            const tags = botTags(bots, ['notIncluded'], []);

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
            expect(createDimensionId()).toBe(id);
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

    describe('getUploadState()', () => {
        it('should support aux files that are just bot state', () => {
            const data = {
                test: createBot('test'),
                test2: createBot('test2'),
            };

            const result = getUploadState(data);

            expect(result).toEqual(data);
        });

        it('should support aux files that contain a version number', () => {
            const data = {
                version: 1,
                state: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            };

            const result = getUploadState(data);

            expect(result).toEqual(data.state);
        });
    });

    botCalculationContextTests(uuidMock, dateNowMock, (bots, userId) =>
        createPrecalculatedContext(bots)
    );
});
