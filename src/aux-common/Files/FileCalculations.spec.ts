import {
    isFormula,
    isNumber,
    isArray,
    updateFile,
    createCalculationContext,
    createFile,
    filtersMatchingArguments,
    calculateFileValue,
    parseFilterTag,
    validateTag,
    fileTags,
    isHiddenTag,
    getActiveObjects,
    filterMatchesArguments,
    parseArray,
    duplicateFile,
    doFilesAppearEqual,
    isTagWellKnown,
    calculateStateDiff,
    tagsOnFile,
    createWorkspace,
    isFileMovable,
    isFileStackable,
    newSelectionId,
    objectsAtContextGridPosition,
    calculateFormulaValue,
    filterFilesBySelection,
    isFile,
    getFileShape,
    getDiffUpdate,
    COMBINE_ACTION_NAME,
    getUserMenuId,
    getFilesInMenu,
    addFileToMenu,
    removeFileFromMenu,
    getContextSize,
    addToContextDiff,
    removeFromContextDiff,
    getFileConfigContexts,
    isContext,
    createContextId,
    isMergeable,
    getFileLabelAnchor,
    formatValue,
    isContextMovable,
    isPickupable,
    isSimulation,
    parseSimulationId,
    getFileVersion,
    isFileInContext,
    getFileUsernameList,
    isInUsernameList,
    whitelistAllowsAccess,
    blacklistAllowsAccess,
    getFileDragMode,
    whitelistOrBlacklistAllowsAccess,
    getBuilderContextGrid,
    SimulationIdParseSuccess,
    simulationIdToString,
    isContextSurfaceVisible,
    isContextLocked,
    isDestroyable,
    isEditable,
    normalizeAUXFileURL,
} from './FileCalculations';
import { cloneDeep } from 'lodash';
import { File, Object, PartialFile } from './File';
import { FilesState, cleanFile, fileRemoved } from './FilesChannel';
import { file } from '../aux-format';
import uuid from 'uuid/v4';
import { select } from 'd3';
import { tsExpressionWithTypeArguments } from '@babel/types';
import { isProxy, createFileProxy } from './FileProxy';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FileCalculations', () => {
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
        it('should be true if the value is a number without symbols', () => {
            expect(isNumber('123')).toBeTruthy();
            expect(isNumber('0')).toBeTruthy();
            expect(isNumber('-12')).toBeTruthy();
            expect(isNumber('19.325')).toBeTruthy();
            expect(isNumber('-27.981')).toBeTruthy();
            expect(isNumber('27.0')).toBeTruthy();
            expect(isNumber('1.')).toBeTruthy();
            expect(isNumber('infinity')).toBeTruthy();
            expect(isNumber('Infinity')).toBeTruthy();
            expect(isNumber('InFIniTy')).toBeTruthy();
        });

        it('should be false if the value is not a number or has symbols', () => {
            expect(isNumber('$123')).toBeFalsy();
            expect(isNumber('abc')).toBeFalsy();
            expect(isNumber('.')).toBeFalsy();
        });
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

    describe('isFile()', () => {
        it('should return true if the object has an ID and tags', () => {
            expect(
                isFile({
                    id: 'test',
                    tags: {},
                })
            ).toBe(true);

            expect(
                isFile({
                    id: 'false',
                    tags: {
                        test: 'abc',
                    },
                })
            ).toBe(true);

            expect(
                isFile({
                    id: '',
                    tags: {},
                })
            ).toBe(false);

            expect(isFile(null)).toBe(false);
            expect(isFile({})).toBe(false);
        });

        it('should return false for a non file proxy', () => {
            const file = createFile('test', {
                val: 'abc',
            });

            const calc = createCalculationContext([file]);
            const proxy = createFileProxy(calc, file);

            expect(isFile(proxy.val)).toBe(false);
        });

        it('should return true for a file proxy', () => {
            const file = createFile('test', {
                val: 'abc',
            });

            const calc = createCalculationContext([file]);
            const proxy = createFileProxy(calc, file);

            expect(isFile(proxy)).toBe(true);
        });
    });

    describe('objectsAtContextGridPosition()', () => {
        it('should return files at the given position', () => {
            const file1 = createFile('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file2 = createFile('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file3 = createFile('test3', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([file2, file1, file3]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([file1, file2, file3]);
        });

        it('should ignore user files', () => {
            const file1 = createFile('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
                'aux._user': 'abc',
            });
            const file2 = createFile('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([file1, file2]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([file2]);
        });
    });

    describe('calculateStateDiff()', () => {
        it('should return no changes', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
                test: prevState['test'],
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
        });

        it('should detect that a file was added', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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

            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.addedFiles.length).toBe(1);
            expect(result.addedFiles[0]).toBe(currState['new']);
        });

        it('should detect that a file was removed', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {};

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(1);
            expect(result.removedFiles[0]).toBe('test');
        });

        it('should detect that a file was updated', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it('should use deep equality for updates', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
        });

        it('should handle multiple changes at once', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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

            expect(result.addedFiles.length).toBe(2);
            expect(result.addedFiles[0]).toBe(currState['new']);
            expect(result.addedFiles[1]).toBe(currState['new2']);
            expect(result.removedFiles.length).toBe(1);
            expect(result.removedFiles[0]).toBe('removed');
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it.skip('should short-circut when a file_added event is given', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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
            //     type: 'file_added',
            //     creation_time: new Date(),
            //     file: currState['new'],
            //     id: 'new'
            // });

            // expect(result.removedFiles.length).toBe(0);
            // expect(result.updatedFiles.length).toBe(0);
            // expect(result.addedFiles.length).toBe(1);
            // expect(result.addedFiles[0]).toBe(currState['new']);
        });

        it.skip('should short-circut when a file_removed event is given', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
                test: prevState['test'],
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'file_removed',
            //     creation_time: new Date(),
            //     id: 'old'
            // });

            // expect(result.addedFiles.length).toBe(0);
            // expect(result.updatedFiles.length).toBe(0);
            // expect(result.removedFiles.length).toBe(1);
            // expect(result.removedFiles[0]).toBe(prevState['old']);
        });

        it.skip('should short-circut when a file_updated event is given', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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
            //     type: 'file_updated',
            //     creation_time: new Date(),
            //     id: 'updated',
            //     update: {
            //         position: {x:2, y:1, z:3},
            //     }
            // });

            // expect(result.addedFiles.length).toBe(0);
            // expect(result.removedFiles.length).toBe(0);
            // expect(result.updatedFiles.length).toBe(1);
            // expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it.skip('should not short-circut when a action event is given', () => {
            const prevState: FilesState = {
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
            const currState: FilesState = {
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

            // expect(result.addedFiles.length).toBe(2);
            // expect(result.addedFiles[0]).toBe(currState['new']);
            // expect(result.addedFiles[1]).toBe(currState['new2']);
            // expect(result.removedFiles.length).toBe(1);
            // expect(result.removedFiles[0]).toBe(prevState['removed']);
            // expect(result.updatedFiles.length).toBe(1);
            // expect(result.updatedFiles[0]).toBe(currState['updated']);
        });
    });

    describe('tagsOnFile()', () => {
        it('should return the tag names that are on objects', () => {
            expect(tagsOnFile(createFile('test'))).toEqual([]);

            expect(
                tagsOnFile(
                    createFile('test', {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: 123,
                        abc: undefined,
                    })
                )
            ).toEqual(['_position', '_workspace', 'test', 'abc']);
        });

        it('should return the property names that are on workspaces', () => {
            expect(tagsOnFile(createWorkspace('test', 'testContext'))).toEqual([
                'aux.context.surface.x',
                'aux.context.surface.y',
                'aux.context.surface.z',
                'aux.context.surface',
                'aux.context.locked',
                'aux.context',
            ]);
        });
    });

    describe('getFileShape()', () => {
        it('should default to cube', () => {
            const file = createFile();

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('cube');
        });

        it('should return the shape from aux.shape', () => {
            let file = createFile();
            file.tags['aux.shape'] = 'sphere';

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('sphere');
        });

        it('should return value when aux._diff is true', () => {
            let file = createFile();
            file.tags['aux._diff'] = true;
            file.tags['aux.shape'] = 'cube';

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('cube');
        });
    });

    describe('getActiveObjects()', () => {
        it('should return only objects', () => {
            const state: FilesState = {
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
            const state: FilesState = {
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

    describe('calculateFormulaValue()', () => {
        it('should return the formula result', () => {
            const formula = '123.4567';
            const context = createCalculationContext([]);
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123.4567);
        });

        it('should unwrap proxy values', () => {
            const obj1 = createFile('test1', {
                name: 'test',
                num: 123,
            });
            const context = createCalculationContext([obj1]);

            const formula = '=@name("test").first().num';
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123);
        });
    });

    describe('calculateFileValue()', () => {
        it('should convert to a number if it is a number', () => {
            const file = createFile();
            file.tags.tag = '123.145';
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toBeCloseTo(123.145);
        });

        it('should convert to a boolean if it is a boolean', () => {
            const file = createFile();
            file.tags.tag = 'true';

            const context = createCalculationContext([file]);
            const trueValue = calculateFileValue(context, file, 'tag');

            expect(trueValue).toBe(true);

            file.tags.tag = 'false';
            const falseValue = calculateFileValue(context, file, 'tag');

            expect(falseValue).toBe(false);
        });

        it('should convert arrays into arrays', () => {
            const file = createFile();
            file.tags.tag = '[test(a, b, c), 1.23, true]';
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toEqual(['test(a', 'b', 'c)', 1.23, true]);
        });

        it('should unwrap proxies in arrays', () => {
            const file = createFile('test', {
                formula: '=[this.num._1,this.num._2]',
                'num._1': '1',
                'num._2': '2',
            });

            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'formula');

            expect(value[isProxy]).toBeFalsy();
            expect(Array.isArray(value)).toBe(true);
            expect(value).toEqual([1, 2]);
        });

        describe('filterFilesBySelection()', () => {
            it('should return the files that have the given selection ID set to a truthy value', () => {
                const selectionId = 'abcdefg1234';
                const file1 = createFile('test1');
                const file2 = createFile('test2');
                const file3 = createFile('test3');
                const file4 = createFile('test4');
                const file5 = createFile('test5');
                const file6 = createFile('test6');

                file1.tags[selectionId] = true;
                file2.tags[selectionId] = 1;
                file3.tags[selectionId] = -1;
                file4.tags[selectionId] = 'hello';
                file5.tags[selectionId] = false;

                const selected = filterFilesBySelection(
                    [file1, file2, file3, file4, file5, file6],
                    selectionId
                );

                expect(selected).toEqual([file1, file2, file3, file4]);
            });

            it('should return files that have the same ID as the selection', () => {
                const selectionId = 'abcdefg1234';
                const file1 = createFile('test1');
                const file2 = createFile('abcdefg1234');

                file1.tags[selectionId] = true;

                const selected = filterFilesBySelection(
                    [file1, file2],
                    selectionId
                );

                expect(selected).toEqual([file1, file2]);
            });
        });

        describe('formulas', () => {
            describe('# syntax', () => {
                it('should get every tag value', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 'hello';
                    file2.tags.abc = 'world';
                    file3.tags.abc = '!';

                    file3.tags.formula = '=#abc';

                    const context = createCalculationContext([
                        file4,
                        file2,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is based on the file ID
                    expect(value).toEqual(['hello', 'world', '!']);
                });

                it('should return all the values that equal the given value', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 2;

                    file3.tags.formula = '=#abc(2)';

                    const context = createCalculationContext([
                        file4,
                        file2,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 2]);
                });

                it('should use the given filter', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 3;

                    file3.tags.formula = '=#abc(num => num > 1)';

                    const context = createCalculationContext([
                        file2,
                        file4,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should handle filters on formulas', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = '=5';
                    file3.tags.abc = 3;

                    file3.tags.formula = '=#abc(num => num > 1)';

                    const context = createCalculationContext([
                        file2,
                        file4,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([5, 3]);
                });

                it('should support tags with dots', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['abc.def'] = 1;
                    file2.tags['abc.def'] = '=2';
                    file3.tags['abc.def'] = 3;

                    file3.tags.formula = '=#abc.def';
                    file3.tags.formula1 = '=#abc.def(num => num >= 2)';
                    file3.tags.formula2 = '=#abc.def(2).first()';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([1, 2, 3]);

                    value = calculateFileValue(context, file3, 'formula1');

                    expect(value).toEqual([2, 3]);

                    value = calculateFileValue(context, file3, 'formula2');

                    expect(value).toEqual(2);
                });

                it('should support tags in strings', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=#"🎶🎉🦊"';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([1, 2, 3]);
                });

                it('should support tags in strings with filters', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=#"🎶🎉🦊"(num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should work with dots after the filter args', () => {
                    const file1 = createFile('test1');

                    file1.tags.num = {
                        a: 1,
                    };

                    file1.tags.formula = '=#num(() => true).first().a';
                    const context = createCalculationContext([file1]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should support filtering on values that contain arrays', () => {
                    const file = createFile('test', {
                        filter: '=#formula(x => x[0] == 1 && x[1] == 2)',
                        formula: '=[this.num._1,this.num._2]',
                        'num._1': '1',
                        'num._2': '2',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value[isProxy]).toBeFalsy();
                    expect(value).toEqual([[1, 2]]);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const file = createFile('test', {
                        filter: '=#formula(x => x[0] == 1 && x[1] == 2)',
                        formula: '=[this.num._1,this.num._2]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const file = createFile('test', {
                        formula: '=#num',
                        num: '0',
                    });

                    const file2 = createFile('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([0, 1]);
                });

                it('should include false in results', () => {
                    const file = createFile('test', {
                        formula: '=#bool',
                        bool: false,
                    });

                    const file2 = createFile('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([false, true]);
                });

                it('should include NaN in results', () => {
                    const file = createFile('test', {
                        formula: '=#num',
                        num: NaN,
                    });

                    const file2 = createFile('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([NaN, 1.23]);
                });

                it('should not include empty strings in results', () => {
                    const file = createFile('test', {
                        formula: '=#val',
                        val: '',
                    });

                    const file2 = createFile('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual(['Hi']);
                });

                it('should not include null in results', () => {
                    const file = createFile('test', {
                        formula: '=#obj',
                        obj: null,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });

                it('should not include undefined in results', () => {
                    const file = createFile('test', {
                        formula: '=#obj',
                        obj: undefined,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });
            });

            describe('@ syntax', () => {
                it('should get every file that has the given tag', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 'hello';
                    file2.tags.abc = 'world';
                    file3.tags.abc = '!';

                    file3.tags.formula = '=@abc';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file1, file2, file3]);
                });

                it('should get every file that has the given tag which matches the filter', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 3;

                    file3.tags.formula = '=@abc(num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file2, file3]);
                });

                it('should handle filters on formulas', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = '=2';
                    file3.tags.abc = 3;

                    file3.tags.formula = '=@abc(num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file2, file3]);
                });

                it('should support tags with dots', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['abc.def'] = 1;
                    file2.tags['abc.def'] = '=2';
                    file3.tags['abc.def'] = 3;

                    file3.tags.formula = '=@abc.def';
                    file3.tags.formula1 = '=@abc.def(num => num >= 2)';
                    file3.tags.formula2 = '=@abc.def(2).first()';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file1, file2, file3]);

                    value = calculateFileValue(context, file3, 'formula1');

                    expect(value).toEqual([file2, file3]);

                    value = calculateFileValue(context, file3, 'formula2');

                    expect(value).toEqual(file2);
                });

                it('should support tags in strings', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=@"🎶🎉🦊"';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file1, file2, file3]);
                });

                it('should support tags in strings with filters', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=@"🎶🎉🦊"(num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file2, file3]);
                });

                it('should work with dots after the filter args', () => {
                    const file1 = createFile('test1');

                    file1.tags.num = {
                        a: 1,
                    };
                    file1.tags.name = 'test';

                    file1.tags.formula = '=@name("test").first().num.a';
                    const context = createCalculationContext([file1]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should be able to use proxy magic after the filter args', () => {
                    const file1 = createFile('test1');

                    file1.tags['num.a'] = 1;
                    file1.tags.name = 'test';

                    file1.tags.formula = '=@name("test").first().num.a';
                    const context = createCalculationContext([file1]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should be able to use indexer expressions after the filter args', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');

                    file1.tags['num.a'] = 1;
                    file1.tags.name = 'test';
                    file2.tags.name = 'test';

                    file1.tags.formula = '=@name("test")[0].num.a';
                    const context = createCalculationContext([file1, file2]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should be able to use expressions in indexers after filter args', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');

                    file1.tags['num.a'] = 1;
                    file1.tags.name = 'test';
                    file2.tags.name = 'test';

                    file1.tags.formula =
                        '=@name("test")[( (1 + 1 - 2) * 10 + 1 - 1)].num.a';
                    const context = createCalculationContext([file1, file2]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should be able to use functions on returned lists', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');

                    file1.tags.num = 1;
                    file2.tags.num = 3;
                    file1.tags.name = 'test';
                    file2.tags.name = 'test';

                    file1.tags.formula = '=@name("test").map(a => a.num)';
                    const context = createCalculationContext([file1, file2]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toEqual([1, 3]);
                });

                it('should support filtering on values that contain arrays', () => {
                    const file = createFile('test', {
                        filter:
                            '=@formula(x => x[0] == 1 && x[1] == 2).first()',
                        formula: '=[this.num._1,this.num._2]',
                        'num._1': '1',
                        'num._2': '2',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value[isProxy]).toBeFalsy();
                    expect(value).toEqual(file);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const file = createFile('test', {
                        filter: '=@formula(x => x[0] == 1 && x[1] == 2)',
                        formula: '=[this.num._1,this.num._2]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const file = createFile('test', {
                        formula: '=@num',
                        num: '0',
                    });

                    const file2 = createFile('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should include false in results', () => {
                    const file = createFile('test', {
                        formula: '=@bool',
                        bool: false,
                    });

                    const file2 = createFile('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should include NaN in results', () => {
                    const file = createFile('test', {
                        formula: '=@num',
                        num: NaN,
                    });

                    const file2 = createFile('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should not include empty strings in results', () => {
                    const file = createFile('test', {
                        formula: '=@val',
                        val: '',
                    });

                    const file2 = createFile('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should not include null in results', () => {
                    const file = createFile('test', {
                        formula: '=@obj',
                        obj: null,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should not include undefined in results', () => {
                    const file = createFile('test', {
                        formula: '=@obj',
                        obj: undefined,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });
            });
        });
    });

    describe('updateFile()', () => {
        it('should do nothing if there is no new data', () => {
            let file: Object = createFile();
            let newData = {};

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
            );

            expect(newData).toEqual({});
        });

        it('should set leave falsy fields alone in newData', () => {
            let file: Object = createFile();
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

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
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
                    'aux._lastEditedBy': 'testUser',
                },
            });
        });

        it('should calculate assignment formulas', () => {
            let file = createFile();
            file.tags.num = 5;

            let newData: any = {
                tags: {
                    sum: ':=this.num + 5',
                },
            };

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
            );

            expect(newData.tags.sum.value).toBe(10);
            expect(newData.tags.sum.formula).toBe(':=this.num + 5');
        });
    });

    describe('isMergeable()', () => {
        it('should return true if the file is mergeable', () => {
            const file1 = createFile(undefined, { 'aux.mergeable': true });
            const update1 = isMergeable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(true);
        });

        it('should return false if the file is not mergeable', () => {
            const file1 = createFile(undefined, { 'aux.mergeable': false });
            const update1 = isMergeable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(false);
        });
    });

    describe('isPickupable()', () => {
        const cases = [
            [true, true],
            [true, 'move'],
            [true, 'any'],
            [false, 'drag'],
            [false, 'clone'],
            [true, 'pickup'],
            [false, false],
        ];

        it.each(cases)('should return %s if set to %s', (expected, value) => {
            const file1 = createFile(undefined, { 'aux.movable': value });
            const update1 = isPickupable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(expected);
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
            'should map aux.channel:%s to %s',
            (value: string, expected: boolean) => {
                let file = createFile('test', {
                    'aux.channel': value,
                });

                const calc = createCalculationContext([file]);
                expect(isSimulation(calc, file)).toBe(expected);
            }
        );
    });

    describe('isDestroyable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let file = createFile('test', {
                'aux.destroyable': value,
            });

            const calc = createCalculationContext([file]);
            expect(isDestroyable(calc, file)).toBe(expected);
        });
    });

    describe('isEditable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let file = createFile('test', {
                'aux.editable': value,
            });

            const calc = createCalculationContext([file]);
            expect(isEditable(calc, file)).toBe(expected);
        });
    });

    describe('createWorkspace()', () => {
        it('should create new random context id if empty', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', '');

            expect(workspace.tags['aux.context']).toEqual('context_uuid');
        });

        it('should create new random context id if undefined', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', undefined);

            expect(workspace.tags['aux.context']).toEqual('context_uuid');
        });

        it('should create new random context id if whitespace', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', ' ');

            expect(workspace.tags['aux.context']).toEqual('context_uuid');
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

            expect(workspace.tags['aux.context.locked']).toEqual(true);
        });

        it('should allow setting the workspace to be unlocked', () => {
            uuidMock.mockReturnValue('uuid');
            const workspace = createWorkspace('test', 'userSetID', false);

            expect(workspace.tags['aux.context.locked']).toEqual(false);
        });
    });

    describe('getDiffUpdate()', () => {
        it('should return null if the file is not a diff', () => {
            const file1 = createFile();
            const update1 = getDiffUpdate(file1);

            // not a diff because it doesn't have any tags
            const file2 = createFile(undefined, {
                tags: { 'aux._diff': true },
            });
            const update2 = getDiffUpdate(file2);

            expect(update1).toBe(null);
            expect(update2).toBe(null);
        });

        it('should return a partial file that contains the specified tags', () => {
            let file1 = createFile();
            file1.tags['aux._diff'] = true;
            file1.tags['aux._diffTags'] = [
                'aux.label',
                'name',
                'zero',
                'false',
                'gone',
                'empty',
                'null',
            ];

            file1.tags.name = 'test';
            file1.tags['aux.label'] = 'label';
            file1.tags['zero'] = 0;
            file1.tags['false'] = false;
            file1.tags['empty'] = '';
            file1.tags['null'] = null;
            file1.tags['other'] = 'heheh';

            const update = getDiffUpdate(file1);

            expect(update).toEqual({
                tags: {
                    'aux.label': 'label',
                    name: 'test',
                    zero: 0,
                    false: false,
                },
            });
        });
    });

    describe('filtersMatchingArguments()', () => {
        it('should return an empty array if no tags match', () => {
            let file = createFile();
            let other = createFile();

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags).toEqual([]);
        });

        it('should match based on tag and exact value', () => {
            let other = createFile();
            other.tags.name = 'Test';
            other.tags.val = '';

            let file = createFile();
            file.tags['onCombine(#name:"Test")'] = 'abc';
            file.tags['onCombine(#val:"")'] = 'abc';
            file.tags['onCombine(#name:"test")'] = 'def';

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual([
                'onCombine(#name:"Test")',
                'onCombine(#val:"")',
            ]);
        });

        it('should only match tags in the given file', () => {
            let file = createFile();
            file.tags['onCombine(#name:"Test")'] = 'abc';

            let other = createFile();
            other.tags.name = 'Test';

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual(['onCombine(#name:"Test")']);
        });
    });

    describe('filterMatchesArguments()', () => {
        it('should match string values', () => {
            let other = createFile();
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
            let other = createFile();
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
            let other = createFile();
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
            let other = createFile();
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
            let other = createFile();
            other.tags.name = '=this.cool';
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

            let newData: PartialFile = {
                tags: {
                    assign: ':=this.cool',
                },
            };
            updateFile(other, 'testId', newData, () => context);
            other.tags.assign = newData.tags.assign;
            filter = parseFilterTag('onCombine(#assign:"Test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });
    });

    describe('isTagWellKnown()', () => {
        uuidMock.mockReturnValue('test');

        const builtinTagCases = [
            ['abc.index'],
            ['_hidden'],
            ['aux._lastEditedBy'],
            ['abc._lastActiveTime'],
        ];
        it.each(builtinTagCases)(
            'should return true for some builtin tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const contextCases = [
            [createContextId()],
            ['aux._context_test'],
            ['aux._context_ something else'],
            ['aux._context_ 😊😜😢'],
            ['context_test'],
            ['context_ something else'],
            ['context_ 😊😜😢'],
        ];
        it.each(contextCases)(
            'should return true for autogenerated context tag %s',
            tag => {
                expect(isTagWellKnown(tag)).toBe(true);
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

        const ingoreSelectionCases = [
            ['aux._selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            ['aux._selection_6a7aa1c5-807c-4390-9982-ff8b2dd5b54e'],
            ['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'],
        ];
        it.each(ingoreSelectionCases)(
            'should return false for selection tag %s when they should be ignored',
            tag => {
                expect(isTagWellKnown(tag, false)).toBe(false);
            }
        );

        const normalCases = [
            ['aux.movable'],
            ['aux.stackable'],
            ['aux.color'],
            ['aux.label.color'],
            ['aux.line'],
            ['aux.scale.x'],
            ['aux.scale.y'],
            ['aux.scale.z'],
            ['aux.scale'],
            ['aux._destroyed'],
            ['+(#tag:"value")'],
            ['onCombine(#tag:"value")'],
            ['_context_test'],
            ['_context_ something else'],
            ['_context_ 😊😜😢'],
            ['_selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            ['📦'],
        ];
        it.each(normalCases)('should return false for %', tag => {
            expect(isTagWellKnown(tag)).toBe(false);
        });
    });

    describe('doFilesAppearEqual()', () => {
        it('should return true if both null', () => {
            const result = doFilesAppearEqual(null, null);

            expect(result).toBe(true);
        });

        it('should return false if one null', () => {
            expect(doFilesAppearEqual(createFile(), null)).toBe(false);
            expect(doFilesAppearEqual(null, createFile())).toBe(false);
        });

        it('should ignore IDs if theyre not the same', () => {
            let first = createFile('id1');
            let second = createFile('id2');

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags by default', () => {
            let first = createFile('id1');
            let second = createFile('id2');

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore context tags', () => {
            let first = createFile('id1');
            let second = createFile('id2');

            first.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should use selection tags if specified', () => {
            let first = createFile('id1');
            let second = createFile('id2');

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doFilesAppearEqual(first, second, {
                ignoreSelectionTags: false,
            });

            expect(result).toBe(false);
        });

        it('should use the ignoreId option for checking file IDs', () => {
            let first = createFile('testID');
            let second = createFile('testID');

            first.tags.a = true;
            second.tags.a = false;

            // Defaults to using the ID as a shortcut
            expect(doFilesAppearEqual(first, second)).toBe(true);

            expect(doFilesAppearEqual(first, second, { ignoreId: true })).toBe(
                false
            );
        });

        it('should should ignore default hidden tags', () => {
            let first = createFile('id1');
            let second = createFile('id2');

            first.tags['aux._context_A.x'] = 1;
            second.tags['aux._context_B.x'] = 0;

            const result = doFilesAppearEqual(first, second);

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

    describe('duplicateFile()', () => {
        beforeAll(() => {
            uuidMock.mockReturnValue('test');
        });

        it('should return a copy with a different ID', () => {
            const first: Object = createFile('id');
            first.tags._workspace = 'abc';
            const second = duplicateFile(first);

            expect(second.id).not.toEqual(first.id);
            expect(second.id).toBe('test');
            expect(second.tags).toEqual(first.tags);
        });

        it('should not be destroyed', () => {
            let first: Object = createFile('id');
            first.tags['aux._destroyed'] = true;
            first.tags._workspace = 'abc';

            uuidMock.mockReturnValue('test');
            const second = duplicateFile(first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags['aux._destroyed']).toBe(true);
        });

        it('should not have any auto-generated contexts or selections', () => {
            let first: Object = createFile('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';
            first.tags[`aux._context_abcdefg`] = true;
            first.tags[`aux._context_1234567`] = true;
            first.tags[`aux._context_1234567.x`] = 1;
            first.tags[`aux._context_1234567.y`] = 2;
            first.tags[`aux._context_1234567.z`] = 3;
            first.tags[`aux._selection_99999`] = true;

            const second = duplicateFile(first);

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
            let first: Object = createFile('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';

            const second = duplicateFile(first, {
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
            let first: Object = createFile('id', {
                testTag: 'abcdefg',
                name: 'ken',
            });
            const second = duplicateFile(first, {
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

        it('should not modify the original file', () => {
            let first: Object = createFile('id');
            first.tags['aux._destroyed'] = true;

            const second = duplicateFile(first);

            expect(first.tags['aux._destroyed']).toBe(true);
        });

        it('should not clear aux._diff', () => {
            let first: Object = createFile('id');
            first.tags['aux._diff'] = true;
            first.tags['aux._diffTags'] = ['abvc'];

            const second = duplicateFile(first);

            expect(second.tags['aux._diff']).toBe(true);
            expect(second.tags['aux._diffTags']).toEqual(['abvc']);
        });
    });

    describe('cleanFile()', () => {
        it('should remove null and undefined tags', () => {
            let file = createFile('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanFile(file);

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

        it('should not modify the given file', () => {
            let file = createFile('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanFile(file);

            expect(file).toEqual({
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

    describe('isFileMovable()', () => {
        it('should return true when aux.movable has no value', () => {
            let file = createFile('test', {});
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(true);
        });

        it('should return false when aux.movable is false', () => {
            let file = createFile('test', {
                ['aux.movable']: false,
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return false when aux.movable calculates to false', () => {
            let file = createFile('test', {
                ['aux.movable']: '=false',
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return true when aux.movable has any other value', () => {
            let file = createFile('test', {
                ['aux.movable']: 'anything',
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(true);
        });
    });

    describe('getFileDragMode()', () => {
        const cases = [
            ['all', 'all'],
            ['all', 'adfsdfa'],
            ['all', true],
            ['all', 'none'],
            ['all', 0],
            ['clone', 'clone'],
            ['pickup', 'pickup'],
            ['drag', 'drag'],
            ['none', false],
        ];

        it.each(cases)('should return %s for %s', (expected, val) => {
            const file1 = createFile('file1', { 'aux.movable': val });
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe(expected);
        });

        it('should default to all', () => {
            const file1 = createFile('file1', {});
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe('all');
        });

        it('should return the default when given an invalid value', () => {
            const file1 = createFile('file1', { 'aux.movable': <any>'test' });
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe('all');
        });
    });

    describe('isFileStackable()', () => {
        it('should return true when aux.stackable has no value', () => {
            let file = createFile('test', {});
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(true);
        });

        it('should return false when aux.stackable is false', () => {
            let file = createFile('test', {
                ['aux.stackable']: false,
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return false when aux.stackable calculates to false', () => {
            let file = createFile('test', {
                ['aux.stackable']: '=false',
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return true when aux.stackable has any other value', () => {
            let file = createFile('test', {
                ['aux.stackable']: 'anything',
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(true);
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

    describe('normalizeAUXFileURL()', () => {
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
            expect(normalizeAUXFileURL(given)).toBe(expected);
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

    describe('fileTags()', () => {
        it('should return the list of tags that the files have minus ones that start with underscores', () => {
            const files: File[] = [
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

            const tags = fileTags(files, [], []);

            expect(tags).toEqual(['tag', 'other']);
        });

        it('should preserve the order of the current tags', () => {
            const files: File[] = [
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

            const tags = fileTags(files, ['other', 'tag'], []);

            expect(tags).toEqual(['other', 'tag']);
        });

        it('should include the given extra tags', () => {
            const files: File[] = [
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

            const tags = fileTags(files, [], ['abc', '_position']);

            expect(tags).toEqual(['tag', 'other', 'abc', '_position']);
        });

        it('should not include extra tags that are given in the currrentTags array', () => {
            const files: File[] = [
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

            const tags = fileTags(files, ['notIncluded'], []);

            expect(tags).toEqual(['tag', 'other']);
        });

        it('should include hidden tags if specified', () => {
            const files: File[] = [
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

            const tags = fileTags(files, ['notIncluded'], [], true);

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

    describe('getFileShape()', () => {
        const cases = [['cube'], ['sphere'], ['sprite']];
        it.each(cases)('should return %s', (shape: string) => {
            const file = createFile('test', {
                'aux.shape': <any>shape,
            });

            const calc = createCalculationContext([file]);

            expect(getFileShape(calc, file)).toBe(shape);
        });

        it('should return sphere when the file is a diff', () => {
            const file = createFile('test', {
                'aux.shape': 'cube',
                'aux._diff': true,
                'aux._diffTags': ['aux.shape'],
            });

            const calc = createCalculationContext([file]);

            expect(getFileShape(calc, file)).toBe('sphere');
        });
    });

    describe('getUserMenuId()', () => {
        it('should return the value from aux._userMenuContext', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });

            const calc = createCalculationContext([user]);
            const id = getUserMenuId(calc, user);
            expect(id).toBe('context');
        });
    });

    describe('getFilesInMenu()', () => {
        it('should return the list of files in the users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file1 = createFile('file1', {
                context: true,
                'context.index': 0,
            });
            const file2 = createFile('file2', {
                context: true,
                'context.index': 1,
            });
            const file3 = createFile('file3', {
                context: true,
                'context.index': 2,
            });

            const calc = createCalculationContext([user, file2, file1, file3]);
            const files = getFilesInMenu(calc, user);

            expect(files).toEqual([file1, file2, file3]);
        });
    });

    describe('addFileToMenu()', () => {
        it('should return the update needed to add the given file ID to the given users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = addFileToMenu(calc, user, 'item');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.index': 0,
                    'context.id': 'item',
                },
            });
        });

        it('should return the given index', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = addFileToMenu(calc, user, 'item', 5);

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.index': 5,
                    'context.id': 'item',
                },
            });
        });

        it('should return index needed to place the file at the end of the list', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');
            const file2 = createFile('file2', {
                context: 0,
            });

            const calc = createCalculationContext([user, file, file2]);
            const update = addFileToMenu(calc, user, 'abc');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.index': 1,
                    'context.id': 'abc',
                },
            });
        });
    });

    describe('removeFileFromMenu()', () => {
        it('should return the update needed to remove the given file from the users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = removeFileFromMenu(calc, user);

            expect(update).toEqual({
                tags: {
                    context: null,
                    'context.index': null,
                    'context.id': null,
                },
            });
        });
    });

    describe('isContextSurfaceVisible()', () => {
        it('should determine if aux.context.surface is set to true', () => {
            const file = createFile('file', {
                'aux.context.surface': true,
            });

            const calc = createCalculationContext([file]);
            const visible = isContextSurfaceVisible(calc, file);

            expect(visible).toBe(true);
        });

        it('should default to false', () => {
            const file = createFile('file', {});

            const calc = createCalculationContext([file]);
            const visible = isContextSurfaceVisible(calc, file);

            expect(visible).toBe(false);
        });
    });

    describe('getContextGrid()', () => {
        it('should find all the tags that represent a grid position', () => {
            const file = createFile('file', {
                'aux.context.surface.grid.0:1': 1,
                'aux.context.surface.grid.1:1': 1,
                'aux.context.surface.grid.2:1': 2,
                'aux.context.surface.grid.2:2': '=3',
            });

            const calc = createCalculationContext([file]);
            const grid = getBuilderContextGrid(calc, file);

            expect(grid).toEqual({
                '0:1': 1,
                '1:1': 1,
                '2:1': 2,
                '2:2': 3,
            });
        });

        it('should not get confused by grid scale', () => {
            const file = createFile('file', {
                'aux.context.surface.grid.0:1': 1,
                'aux.context.grid.scale': 50,
            });

            const calc = createCalculationContext([file]);
            const grid = getBuilderContextGrid(calc, file);

            expect(grid).toEqual({
                '0:1': 1,
            });
        });
    });

    describe('getContextSize()', () => {
        it('should return the default size if none exists', () => {
            const file = createFile('file');

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(1);
        });

        it('should default to 0 if the file is a user file', () => {
            const file = createFile('file', {
                'aux._user': 'user',
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(0);
        });

        it('should still return the user files context size', () => {
            const file = createFile('file', {
                'aux._user': 'user',
                'aux.context.surface.size': 10,
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(10);
        });
    });

    describe('addToContextDiff()', () => {
        it('should return the tags needed to add a file to a context', () => {
            const file = createFile('file', {});

            const calc = createCalculationContext([file]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.index': 0,
            });
        });

        it('should calculate the index', () => {
            const file = createFile('file', {});
            const file2 = createFile('file2', {
                test: true,
                'test.index': 0,
            });

            const calc = createCalculationContext([file, file2]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.index': 1,
            });
        });

        it('should calculate the index based on the given position', () => {
            const file = createFile('file', {});
            const file2 = createFile('file2', {
                test: true,
                'test.index': 0,
                'test.x': 0,
                'test.y': 0,
            });

            const calc = createCalculationContext([file, file2]);
            const tags = addToContextDiff(calc, 'test', 1, 2);

            expect(tags).toEqual({
                test: true,
                'test.x': 1,
                'test.y': 2,
                'test.index': 0,
            });
        });
    });

    describe('addToContextDiff()', () => {
        it('should return the tags needed to add a file to a context', () => {
            const calc = createCalculationContext([]);
            const tags = removeFromContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: null,
                'test.x': null,
                'test.y': null,
                'test.index': null,
            });
        });
    });

    describe('isContextMovable()', () => {
        it('should return true if movable', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
                'aux.context.surface.movable': true,
            });

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(true);
        });

        it('should return false if not movable', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
                'aux.context.surface.movable': false,
            });

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(false);
        });

        it('should be movable by default', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(true);
        });
    });

    describe('isContext()', () => {
        it('should return true when the given file has aux.context set to something', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            expect(isContext(calc, file)).toBe(true);
        });

        it('should return false when the given file does not have aux.context set to something', () => {
            const file = createFile('test', {
                'aux.context': '',
            });

            const calc = createCalculationContext([file]);
            expect(isContext(calc, file)).toBe(false);
        });
    });

    describe('getFileConfigContexts()', () => {
        it('should return the list of values in aux.context', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['abc']);
        });

        it('should evalulate formulas', () => {
            const file = createFile('test', {
                'aux.context': '="abc"',
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['abc']);
        });
    });

    describe('isContextLocked()', () => {
        it('should default to false when the file is a context', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(false);
        });

        it('should default to true when the file is not a context', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(true);
        });

        it('should evaluate formulas', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
                'aux.context.locked': '=true',
            });

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(true);
        });
    });

    describe('createContextId()', () => {
        const cases = [['abcdefghi', 'context_abcdefgh']];
        it.each(cases)('should convert %s to %s', (uuid, id) => {
            uuidMock.mockReturnValue(uuid);
            expect(createContextId()).toBe(id);
        });
    });

    describe('getLabelAnchor()', () => {
        it('should default to top', () => {
            const file = createFile('file');

            const calc = createCalculationContext([file]);
            const anchor = getFileLabelAnchor(calc, file);

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
            const file = createFile('file', {
                'aux.label.anchor': anchor,
            });

            const calc = createCalculationContext([file]);
            const a = getFileLabelAnchor(calc, file);

            expect(a).toBe(expected);
        });

        it('should support formulas', () => {
            const file = createFile('file', {
                'aux.label.anchor': '="front"',
            });

            const calc = createCalculationContext([file]);
            const anchor = getFileLabelAnchor(calc, file);

            expect(anchor).toBe('front');
        });
    });

    describe('formatValue()', () => {
        it('should format files to a short ID', () => {
            const file = createFile('abcdefghijklmnopqrstuvwxyz');
            expect(formatValue(file)).toBe('abcde');
        });

        it('should format file arrays', () => {
            const file1 = createFile('abcdefghijklmnopqrstuvwxyz');
            const file2 = createFile('zyxwvutsrqponmlkjighfedcba');
            expect(formatValue([file1, file2])).toBe('[abcde,zyxwv]');
        });
    });

    describe('getFileVersion()', () => {
        it('should return the aux.version', () => {
            const file = createFile('test', {
                'aux.version': 1,
            });

            const calc = createCalculationContext([file]);

            expect(getFileVersion(calc, file)).toBe(1);
        });

        it('should return undefined if not a number', () => {
            const file = createFile('test', {
                'aux.version': 'abc',
            });

            const calc = createCalculationContext([file]);

            expect(getFileVersion(calc, file)).toBeUndefined();
        });
    });

    describe('hasFileInInventory()', () => {
        it('should return true if the given file is in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory: '=player.hasFileInInventory(@name("bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return true if all the given files are in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory: '=player.hasFileInInventory(@name("bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const otherFile = createFile('otherFile', {
                name: 'bob',
                test: true,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, otherFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return false if one of the given files are not in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory: '=player.hasFileInInventory(@name("bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const otherFile = createFile('otherFile', {
                name: 'bob',
                test: false,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, otherFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(false);
        });
    });

    describe('isFileInContext()', () => {
        it('should handle boolean objects', () => {
            const thisFile = createFile('thisFile', {
                context: new Boolean(true),
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, 'context');

            expect(result).toBe(true);
        });

        it('should handle string objects', () => {
            const thisFile = createFile('thisFile', {
                context: new String('true'),
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, 'context');

            expect(result).toBe(true);
        });

        it('should handle a string object as the context', () => {
            const thisFile = createFile('thisFile', {
                context: true,
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, <any>(
                new String('context')
            ));

            expect(result).toBe(true);
        });
    });

    describe('getFileUsernameList()', () => {
        const cases = [['aux.whitelist'], ['aux.blacklist']];

        describe.each(cases)('%s', tag => {
            it(`should return the ${tag}`, () => {
                const file = createFile('test', {
                    [tag]: '[Test, Test2]',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toEqual([
                    'Test',
                    'Test2',
                ]);
            });

            it('should always return an array', () => {
                const file = createFile('test', {
                    [tag]: 'Test',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toEqual(['Test']);
            });

            it('should handle falsy values', () => {
                const file = createFile('test', {
                    [tag]: '',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toBeFalsy();
            });

            it('should get the aux._user tag from files', () => {
                const file = createFile('test', {
                    [tag]: '=@name("bob")',
                });
                const user = createFile('user', {
                    name: 'bob',
                    'aux._user': 'a',
                });
                const bad = createFile('user2', {
                    name: 'bob',
                });

                const calc = createCalculationContext([file, user, bad]);

                expect(getFileUsernameList(calc, file, tag)).toEqual([
                    'a',
                    'user2',
                ]);
            });
        });
    });

    describe('isInUsernameList()', () => {
        const cases = [['aux.whitelist'], ['aux.blacklist']];

        describe.each(cases)('%s', tag => {
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
                    const file = createFile('test', {
                        [tag]: list,
                    });

                    const calc = createCalculationContext([file]);

                    expect(isInUsernameList(calc, file, tag, username)).toBe(
                        expected
                    );
                }
            );
        });
    });

    describe('whitelistAllowsAccess()', () => {
        it('should check the whitelist to determine if the username is allowed access', () => {
            const file = createFile('test', {
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should always allow access if no usernames are specified', () => {
            const file = createFile('test', {
                'aux.whitelist': '',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should deny access if the username is not in the list', () => {
            const file = createFile('test', {
                'aux.whitelist': 'Test',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(false);
        });
    });

    describe('blacklistAllowsAccess()', () => {
        it('should check the blacklist to determine if the username is allowed access', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'DEF')).toBe(true);
        });

        it('should always allow access if no usernames are specified', () => {
            const file = createFile('test', {
                'aux.blacklist': '',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should deny access if the username is in the list', () => {
            const file = createFile('test', {
                'aux.blacklist': 'ABC',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'ABC')).toBe(false);
        });
    });

    describe('whitelistOrBlacklistAllowsAccess()', () => {
        it('should allow access if the name is in the whitelist and the blacklist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                true
            );
        });

        it('should allow access if neither list exists', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                true
            );
        });

        it('should deny access if the name is not in the whitelist and not in the blacklist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                false
            );
        });

        it('should deny access if the name is in the blacklist and not in the whitelist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[DEF]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                false
            );
        });

        it('should deny access if the name is in the blacklist the whitelist doesnt exist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                false
            );
        });

        it('should allow access if the name is not in the blacklist the whitelist doesnt exist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                true
            );
        });
    });
});

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
