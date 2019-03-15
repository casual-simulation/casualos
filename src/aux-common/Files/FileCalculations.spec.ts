import {
    isFormula, 
    isNumber,
    isArray,
    updateFile,
    createCalculationContext,
    createFile,
    tagsMatchingFilter,
    calculateFileValue,
    parseFilterTag,
    validateTag,
    fileTags,
    isHiddenTag,
    getActiveObjects,
    tagMatchesFilter,
    parseArray,
    duplicateFile,
    doFilesAppearEqual,
    isTagWellKnown,
    calculateStateDiff,
    tagsOnFile,
    createWorkspace,
    isFileMovable,
    isFileStackable,
    newSelectionId
} from './FileCalculations';
import {
    cloneDeep
} from 'lodash';
import { File, Object, PartialFile } from './File';
import { FilesState, cleanFile } from './FilesChannel';

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

    
    describe('calculateStateDiff()', () => {

        it('should return no changes', () => {
            const prevState: FilesState = {
                'test': {
                    id: 'test',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test']
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
        });

        it('should detect that a file was added', () => {
            const prevState: FilesState = {
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                }
            };
            const currState: FilesState = {
                'new': {
                    id: 'new',
                    tags: {
                        _position: {x:0,y:0,z:0},
                        _workspace: 'test',
                    }
                },
                'test': prevState['test']
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.addedFiles.length).toBe(1);
            expect(result.addedFiles[0]).toBe(currState['new']);
        });

        it('should detect that a file was removed', () => {
            const prevState: FilesState = {
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                }
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
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: 'test'
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: null
                    }
                }
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it('should use deep equality for updates', () => {
            const prevState: FilesState = {
                'test': {
                    id: 'test',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: 'test'
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: 'test'
                    }
                }
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
        });

        it('should handle multiple changes at once', () => {
            const prevState: FilesState = {
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'removed': {
                    id: 'removed',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: 'test'
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: null
                    }
                },
                'new': {
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                },
                'new2': {
                    id: 'new',
                    tags: {
                        _position: {x:1, y:15, z:3},
                        _workspace: 'test'
                    }
                }
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
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'new': {
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                }
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
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'old': {
                    id: 'old',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test'],
                
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
                'updated': {
                    id: 'updated',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
            };
            const currState: FilesState = {
                'updated': {
                    id: 'updated',
                    tags: {
                        position: {x:2, y:1, z:3},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
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
                'test': {
                    id: 'test',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'removed': {
                    id: 'removed',
                    tags: {
                        position: {x:0, y:0, z:0},
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                },
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: 'test'
                    }
                }
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'updated': {
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: null
                    }
                },
                'new': {
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                },
                'new2': {
                    id: 'new',
                    tags: {
                        _position: {x:1, y:15, z:3},
                        _workspace: 'test'
                    }
                }
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

            expect(tagsOnFile(createFile('test', {
                _position: { x: 0, y: 0, z: 0 },
                _workspace: null,
                test: 123,
                abc: undefined
            }))).toEqual([
                '_position',
                '_workspace',
                'test',
                'abc'
            ]);
        });

        it('should return the property names that are on workspaces', () => {
            expect(tagsOnFile(createWorkspace('test', 'testContext'))).toEqual([
                'aux.builder.context',
                'aux.builder.context.x',
                'aux.builder.context.y',
                'aux.builder.context.z',
                'aux.builder.context.size',
                'aux.builder.context.grid',
                'aux.builder.context.scale',
                'aux.builder.context.defaultHeight',
                'aux.builder.context.grid.scale',
                'aux.builder.context.color',
                'testContext',
                'testContext.x',
                'testContext.y',
                'testContext.z',
            ]);
        });
    });

    describe('getActiveObjects()', () => {
        it('should return only objects', () => {
            const state: FilesState = {
                first: {
                    id: 'first',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test'
                    }
                },
                second: {
                    id: 'second',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test'
                    }
                },
                workspace: {
                    id: 'workspace',
                    tags: {
                        defaultHeight: 1,
                        grid: {},
                        gridScale: 1,
                        position: { x:0, y: 0, z: 0},
                        size: 1,
                        scale: 1,
                        color: "#999999"
                    }
                }
            };

            const objects = getActiveObjects(state);

            expect(objects).toEqual([
                state['first'],
                state['second'],
                state['workspace']
            ]);
        });

        it('should exclude destroyed objects', () => {
            const state: FilesState = {
                first: {
                    id: 'first',
                    tags: {
                        _destroyed: true,
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test'
                    }
                },
                second: {
                    id: 'second',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test'
                    }
                },
            };

            const objects = getActiveObjects(state);

            expect(objects).toEqual([
                state['second']
            ]);
        });
    });

    describe('calculateFileValue()', () => {
        it('should convert to a number if it is a number', () => {
            const file = createFile();
            file.tags.tag = '123.145'
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
            file.tags.tag = '[test(a, b, c), 1.23, true]'
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toEqual([
                'test(a',
                'b',
                'c)',
                1.23,
                true
            ]);
        });
    });

    describe('updateFile()', () => {
        it('should do nothing if there is no new data', () => {

            let file: Object = createFile();
            let newData = {};

            updateFile(file, 'testUser', newData, () => createCalculationContext([file]));

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
                    g: NaN
                }
            };

            updateFile(file, 'testUser', newData, () => createCalculationContext([file]));

            expect(newData).toEqual({
                tags: {
                    a: false,
                    b: '',
                    c: 0,
                    d: [],
                    e: null,
                    f: undefined,
                    g: NaN,
                    _lastEditedBy: 'testUser'
                }
            });
        });

        it('should calculate assignment formulas', () => {
            let file = createFile();
            file.tags.num = 5;

            let newData: any = {
                tags: {
                    sum: ":=this.num + 5"
                }
            };

            updateFile(file, 'testUser', newData, () => createCalculationContext([file]));

            expect(newData.tags.sum.value).toBe(10);
            expect(newData.tags.sum.formula).toBe(':=this.num + 5');
        });
    });

    describe('tagsMatchingFilter()', () => {
        it('should return an empty array if no tags match', () => {
            let file = createFile();
            let other = createFile();
            
            const context = createCalculationContext([ file, other ]);
            const tags = tagsMatchingFilter(file, other, '+', context);

            expect(tags).toEqual([]);
        });

        it('should match based on tag and exact value', () => {
            let file = createFile();
            file.tags.name = "Test";
            file.tags.val = "";

            let other = createFile();
            other.tags['+(#name:"Test")'] = 'abc';
            other.tags['+(#val:"")'] = 'abc';
            other.tags['+(#name:"test")'] = 'def';
            
            const context = createCalculationContext([ file, other ]);
            const tags = tagsMatchingFilter(file, other, '+', context);

            expect(tags).toEqual([
                '+(#name:"Test")',
                '+(#val:"")'
            ]);
        });

        it('should only match tags in the "other" file', () => {
            let file = createFile();
            file.tags['+(#name:"Test")'] = 'abc';

            let other = createFile();
            other.tags.name = "Test";
            
            const context = createCalculationContext([ file, other ]);
            const tags = tagsMatchingFilter(file, other, '+', context);

            expect(tags).toEqual([]);
        });
    });

    describe('tagMatchesFilter()', () => {
        it('should match string values', () => {
            let other = createFile();
            other.tags.name = 'test';

            const context = createCalculationContext([ other ]);
            expect(tagMatchesFilter('+(#name:"test")', other, '+', context)).toBe(true);
        });

        it('should match number values', () => {
            let other = createFile();
            other.tags.num = 123456;

            const context = createCalculationContext([ other ]);

            expect(tagMatchesFilter('+(#num:"123456")', other, '+', context)).toBe(true);

            other.tags.num = 3.14159;

            expect(tagMatchesFilter('+(#num:"3.14159")', other, '+', context)).toBe(true);
        });

        it('should match boolean values', () => {
            let other = createFile();
            other.tags.bool = true;
            const context = createCalculationContext([ other ]);
            expect(tagMatchesFilter('+(#bool:"true")', other, '+', context)).toBe(true);

            other.tags.bool = false;

            expect(tagMatchesFilter('+(#bool:"false")', other, '+', context)).toBe(true);
        });

        it('should match array values', () => {
            let other = createFile();
            other.tags.array = [];
            const context = createCalculationContext([ other ]);

            expect(tagMatchesFilter('+(#array:"[]")', other, '+', context)).toBe(true);
            expect(tagMatchesFilter('+(#array:"[\"anything\"]")', other, '+', context)).toBe(false);

            other.tags.array = [1];
            expect(tagMatchesFilter('+(#array:"[1]")', other, '+', context)).toBe(true);

            other.tags.array = ['hello', 'world'];
            expect(tagMatchesFilter('+(#array:"[hello, world]")', other, '+', context)).toBe(true);

            other.tags.array = ['hello', 'world', 12.34];
            expect(tagMatchesFilter('+(#array:"[hello, world, 12.34]")', other, '+', context)).toBe(true);
        });

        it('should evaluate the value filters', () => {
            let other = createFile();
            other.tags.name = "=this.cool";
            other.tags.cool = "Test";

            const context = createCalculationContext([ other, other ]);
            expect(tagMatchesFilter('+(#name:"Test")', other, '+', context)).toBe(true);
            
            other.tags.value = "10.15";
            expect(tagMatchesFilter("+(#value:10.15)", other, '+', context)).toBe(true);

            other.tags.value = "true";
            expect(tagMatchesFilter("+(#value:true)", other, '+', context)).toBe(true);
            expect(tagMatchesFilter("+(#value:false)", other, '+', context)).toBe(false);

            other.tags.value = "false";
            expect(tagMatchesFilter("+(#value:true)", other, '+', context)).toBe(false);
            expect(tagMatchesFilter("+(#value:false)", other, '+', context)).toBe(true);

            let newData: PartialFile = {
                tags: {
                    assign: ":=this.cool"
                }
            };
            updateFile(other, 'testId', newData, () => context);
            other.tags.assign = newData.tags.assign;
            expect(tagMatchesFilter('+(#assign:"Test")', other, '+', context)).toBe(true);
        });
    });

    describe('isTagWellKnown()', () => {
        it('should return true for some builtin tags', () => {
            expect(isTagWellKnown('abc.index')).toBe(true);
            expect(isTagWellKnown('_hidden')).toBe(true);
            expect(isTagWellKnown('_destroyed')).toBe(true);
            expect(isTagWellKnown('_lastEditedBy')).toBe(true);
            expect(isTagWellKnown('_lastActiveTime')).toBe(true);
        });

        it('should return true for autogenerated context tags', () => {
            expect(isTagWellKnown('aux._context_test')).toBe(true);
            expect(isTagWellKnown('aux._context_ something else')).toBe(true);
            expect(isTagWellKnown('aux._context_ 😊😜😢')).toBe(true);
        });

        it('should return true for selection tags', () => {
            expect(isTagWellKnown('aux._selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8')).toBe(true);
            expect(isTagWellKnown('aux._selection_6a7aa1c5-807c-4390-9982-ff8b2dd5b54e')).toBe(true);
            expect(isTagWellKnown('aux._selection_83e80481-13a1-439e-94e6-f3b73942288f')).toBe(true);
        });

        it('should return false for selection tags when they should be ignored', () => {
            expect(isTagWellKnown('aux._selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8', false)).toBe(false);
            expect(isTagWellKnown('aux._selection_6a7aa1c5-807c-4390-9982-ff8b2dd5b54e', false)).toBe(false);
            expect(isTagWellKnown('aux._selection_83e80481-13a1-439e-94e6-f3b73942288f', false)).toBe(false);
        });

        it('should return false for normal tags', () => {
            expect(isTagWellKnown('aux.movable')).toBe(false);
            expect(isTagWellKnown('aux.stackable')).toBe(false);
            expect(isTagWellKnown('aux.color')).toBe(false);
            expect(isTagWellKnown('aux.label.color')).toBe(false);
            expect(isTagWellKnown('aux.line')).toBe(false);
            expect(isTagWellKnown('+(#tag:"value")')).toBe(false);
            expect(isTagWellKnown('_context_test')).toBe(false);
            expect(isTagWellKnown('_context_ something else')).toBe(false);
            expect(isTagWellKnown('_context_ 😊😜😢')).toBe(false);
            expect(isTagWellKnown('_selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8')).toBe(false);
            expect(isTagWellKnown('📦')).toBe(false);
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
            let first = createFile();
            let second = createFile();

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags by default', () => {
            let first = createFile();
            let second = createFile();

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] = 'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] = 'b';

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore context tags', () => {
            let first = createFile();
            let second = createFile();

            first.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] = 'a';
            second.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] = 'b';

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should use selection tags if specified', () => {
            let first = createFile();
            let second = createFile();

            first.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] = 'a';
            second.tags['aux._selection_83e80481-13a1-439e-94e6-f3b73942288f'] = 'b';

            const result = doFilesAppearEqual(first, second, { ignoreSelectionTags: false });

            expect(result).toBe(false);
        });

        it('should use the ignoreId option for checking file IDs', () => {
            let first = createFile('testID');
            let second = createFile('testID');

            first.tags.a = true;
            second.tags.a = false;

            // Defaults to using the ID as a shortcut
            expect(doFilesAppearEqual(first, second)).toBe(true);
            
            expect(doFilesAppearEqual(first, second, { ignoreId: true })).toBe(false);
        });

        it('should should ignore default hidden tags', () => {
            let first = createFile();
            let second = createFile();

            first.tags['_context_A.x'] = 1;
            second.tags['_context_B.x'] = 0;

            const result = doFilesAppearEqual(first, second);

            expect(result).toBe(true);
        });
    });

    describe('newSelectionId()', () => {
        it('should return IDs that are well known', () => {
            expect(isTagWellKnown(newSelectionId())).toBe(true);
        });
    });

    describe('duplicateFile()', () => {
        it('should return a copy with a different ID', () => {
            const first: Object = createFile();
            first.tags._workspace = 'abc';
            const second = duplicateFile(first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual(first.tags);
        });

        it('should not be destroyed', () => {
            let first: Object = createFile();
            first.tags._destroyed = true;
            first.tags._workspace = 'abc';

            const second = duplicateFile(first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags._destroyed).toBe(undefined);
        });

        it('should not have any auto-generated contexts or selections', () => {
            let first: Object = createFile();
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
                'myTag': 'Hello'
            });
            expect(first.tags).toEqual({
                'aux.other': 100,
                'myTag': 'Hello',
                'aux._context_abcdefg': true,
                'aux._context_1234567': true,
                'aux._context_1234567.x': 1,
                'aux._context_1234567.y': 2,
                'aux._context_1234567.z': 3,
                'aux._selection_99999': true,
            });
        });

        it('should keep the tags that the new data contains', () => {
            let first: Object = createFile();
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';

            const second = duplicateFile(first, {
                tags: {
                    [`aux._selection_99999`]: true,
                    [`aux._context_abcdefg`]: true
                }
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                'myTag': 'Hello',
                'aux._context_abcdefg': true,
                'aux._selection_99999': true
            });
        });

        it('should merge in the additional changes', () => {
            let first: Object = createFile('test', {
                testTag: 'abcdefg',
                name: 'ken'
            });
            const second = duplicateFile(first, {
                tags: {
                    name: 'abcdef'
                }
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                testTag: 'abcdefg',
                name: 'abcdef'
            });
        });

        it('should not modify the original file', () => {
            let first: Object = createFile();
            first.tags._destroyed = true;

            const second = duplicateFile(first);

            expect(first.tags._destroyed).toBe(true);
        });
    });

    describe('cleanFile()', () => {
        it('should remove null and undefined tags', () => {
            let file = createFile('test', {
                'testTag': 'abcdefg',
                'other': 0,
                'falsy': false,
                'truthy': true,
                _workspace: null,
                _test: undefined
            });

            const result = cleanFile(file);

            expect(result).toEqual({
                id: 'test',
                tags: {
                    'testTag': 'abcdefg',
                    'other': 0,
                    'falsy': false,
                    'truthy': true,
                }
            });
        });

        it('should not modify the given file', () => {
            let file = createFile('test', {
                'testTag': 'abcdefg',
                'other': 0,
                'falsy': false,
                'truthy': true,
                _workspace: null,
                _test: undefined
            });

            const result = cleanFile(file);

            expect(file).toEqual({
                id: 'test',
                tags: {
                    'testTag': 'abcdefg',
                    'other': 0,
                    'falsy': false,
                    'truthy': true,
                    _workspace: null,
                    _test: undefined
                }
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
                ['aux.movable']: false
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return false when aux.movable calculates to false', () => {
            let file = createFile('test', {
                ['aux.movable']: '=false'
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return true when aux.movable has any other value', () => {
            let file = createFile('test', {
                ['aux.movable']: 'anything'
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(true);
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
                ['aux.stackable']: false
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return false when aux.stackable calculates to false', () => {
            let file = createFile('test', {
                ['aux.stackable']: '=false'
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return true when aux.stackable has any other value', () => {
            let file = createFile('test', {
                ['aux.stackable']: 'anything'
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(true);
        });
    });

    describe('parseFilterTag()', () => {
        it('should return unsucessful if not in the formula syntax', () => {
            let result = parseFilterTag('myTag');
            expect(result.success).toBe(false);

            result = parseFilterTag('+myTag');
            expect(result.success).toBe(false);
            
            result = parseFilterTag('+(myTag)');
            expect(result.success).toBe(false);

            result = parseFilterTag('+(myTag:"")');
            expect(result.success).toBe(false);

            result = parseFilterTag('#myTag');
            expect(result.success).toBe(false);
        });

        it('should return sucessful if in the formula syntax', () => {
            let result = parseFilterTag('+(#name:"")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'name',
                    value: ''
                }
            });

            result = parseFilterTag('+(#name:"abc")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'name',
                    value: 'abc'
                }
            });

            result = parseFilterTag('-(#name:"abc")');
            expect(result).toEqual({
                success: true,
                eventName: '-',
                filter: {
                    tag: 'name',
                    value: 'abc'
                }
            });

            result = parseFilterTag('craziness(#lalalal:"abc")');
            expect(result).toEqual({
                success: true,
                eventName: 'craziness',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });

            result = parseFilterTag('+ ( #lalalal : "abc" )');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });
            
            result = parseFilterTag('+ ( #lalalal : "abc"');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });

            result = parseFilterTag('+ ( #lalalal : "abc');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });

            result = parseFilterTag('+ ( #lalalal : "abc  ');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc  '
                }
            });

            result = parseFilterTag('+ ( # lalalal : "abc  ');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc  '
                }
            });

            result = parseFilterTag('+ ( # lal alal : "abc  ');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lal alal',
                    value: 'abc  '
                }
            });

            result = parseFilterTag('+(#lalalal:abc)');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });

            result = parseFilterTag('+(#lalalal:abc');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: 'abc'
                }
            });

            result = parseFilterTag('+(#lalalal: abc\t');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'lalalal',
                    value: ' abc\t'
                }
            });
        });

        it('should return partial success if it was able to parse the event name', () => {
            const result = parseFilterTag('+ (');
            expect(result).toEqual({
                success: false,
                partialSuccess: true,
                eventName: '+'
            });
        });

        it('should parse numbers', () => {
            let result = parseFilterTag('+(#abc:"123.45")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'abc',
                    value: 123.45
                }
            });
        });

        it('should parse booleans', () => {
            let result = parseFilterTag('+(#abc:"true")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'abc',
                    value: true
                }
            });
        });

        it('should parse arrays', () => {
            let result = parseFilterTag('+(#abc:"[hello, world, 12.34]")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'abc',
                    value: ['hello', 'world', 12.34]
                }
            });

            result = parseFilterTag('+(#abc:"[]")');
            expect(result).toEqual({
                success: true,
                eventName: '+',
                filter: {
                    tag: 'abc',
                    value: []
                }
            });
        });
    });

    describe('validateTag()', () => {
        it('should return invalid when tag is empty or null', () => {
            let errors = validateTag('');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {}
            });

            errors = validateTag(null);
            expect(errors).toEqual({
                valid: false,
                'tag.required': {}
            });

            errors = validateTag('  \t\n');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {}
            });
        });

        it('should return invalid when tag contains #', () => {
            let errors = validateTag('#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' }
            });

            errors = validateTag('abc#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' }
            });

            errors = validateTag(' #def');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' }
            });
        });

        it('should allow # when it is a filter', () => {
            let errors = validateTag('+');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('+(');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('+(#');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('+(#tag:"###test');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('+(#tag:"###test")');
            expect(errors).toEqual({
                valid: true
            });
        });

        it('should be valid when tag is fine', () => {
            let errors = validateTag('abcdef');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('  abcdef');
            expect(errors).toEqual({
                valid: true
            });

            errors = validateTag('abcdef  ');
            expect(errors).toEqual({
                valid: true
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
                        _workspace: 'abc'
                    }
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello'
                    }
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again'
                    }
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag'
                    }
                }
            ];

            const tags = fileTags(files, [], []);

            expect(tags).toEqual([
                'tag',
                'other'
            ]);
        });

        it('should preserve the order of the current tags', () => {
            const files: File[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc'
                    }
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello'
                    }
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again'
                    }
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag'
                    }
                }
            ];

            const tags = fileTags(files, [
                'other',
                'tag'
            ], []);

            expect(tags).toEqual([
                'other',
                'tag'
            ]);
        });

        it('should include the given extra tags', () => {
            const files: File[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc'
                    }
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello'
                    }
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again'
                    }
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag'
                    }
                }
            ];

            const tags = fileTags(files, [], [
                'abc',
                '_position'
            ]);

            expect(tags).toEqual([
                'tag',
                'other',
                'abc',
                '_position'
            ]);
        });

        it('should not include extra tags that are given in the currrentTags array', () => {
            const files: File[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc'
                    }
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello'
                    }
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again'
                    }
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag'
                    }
                }
            ];

            const tags = fileTags(files, [
                'notIncluded'
            ], []);

            expect(tags).toEqual([
                'tag',
                'other'
            ]);
        });
    });
});