import { 
    filesReducer, 
    fileAdded, 
    FilesState,
    fileRemoved, 
    action, 
    calculateStateDiff, 
    calculateActionEvents, 
    transaction, 
    mergeFiles, 
    objDiff, 
    applyMerge, 
    MergedObject, 
    resolveConflicts, 
    ConflictDetails, 
    first,
    second,
    listMergeConflicts,
    ResolvedConflict,
    fileUpdated,
    FileEvent,
    FilesStateStore,
    fileChangeObservables
} from './FilesChannel';
import { Workspace, Object, File } from './File';
import { values, assign, merge } from 'lodash';
import uuid from 'uuid/v4';
import { objectsAtGridPosition } from './FileCalculations';
import { TestConnector } from 'common/channels-core/test/TestConnector';
import { Subject } from 'rxjs';
import { ChannelClient, StoreFactory, ReducingStateStore } from 'common/channels-core';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('FilesChannel', () => {
    describe('filesReducer()', () => {
        describe('file_added', () => {
            it('should add the given file to the state', () => {
                const file: Workspace = {
                    id: 'test',
                    type: 'workspace',
                    position: { x: 1, y: 2, z: 3 },
                    size: 10,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                };
                const state = {};
                const newState = filesReducer(state, fileAdded(file));

                expect(newState).toEqual({
                    test: file
                });
            });
        });

        describe('file_removed', () => {
            it('should remove the given file from the state', () => {
                const state: FilesState = {
                    test: {
                        id: 'test',
                        type: 'workspace',
                        position: { x: 1, y: 2, z: 3 },
                        size: 10,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: "#999999"
                    }
                };
                const newState = filesReducer(state, fileRemoved('test'));

                expect(newState).toEqual({});
            });
        });

        describe('file_updated', () => {
            it('should not change values that dont change', () => {
                const test: Workspace = {
                    id: 'test',
                    type: 'workspace',
                    position: { x: 1, y: 2, z: 3 },
                    size: 10,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                };
                const state: FilesState = {
                    test: test
                };

                const newState = filesReducer(state, fileUpdated('test', {
                    size: 2
                }));

                const newTest = <Workspace>newState['test'];

                expect(newTest.grid).toBe(test.grid);
            });

            it('should remove null, undefined, and empty string properties', () => {
                const test: Object = {
                    id: 'test',
                    type: 'object',
                    tags: {
                        _position: { x: 1, y: 2, z: 3 },
                        _workspace: 'abc',
                        isNull: null,
                        isUndefined: undefined,
                        isEmpty: '',
                        isZero: 0,
                        isEmptyArray: <any>[],
                        isNaN: NaN
                    }
                };
                const state: FilesState = {
                    test: test
                };

                const newState = filesReducer(state, fileUpdated('test', {
                    tags: {
                        fun: 'cool',
                        test: undefined,
                        other: null,
                        empty: '',
                        zero: 0,
                        emptyArray: <any>[],
                        nan: NaN
                    }
                }));

                const newTest = <Object>newState['test'];

                expect(newTest).toEqual({
                    id: 'test',
                    type: 'object',
                    tags: {
                        _position: { x: 1, y: 2, z: 3 },
                        _workspace: 'abc',
                        fun: 'cool',
                        isZero: 0,
                        zero: 0,
                        isEmptyArray: [],
                        emptyArray: [],
                        isNaN: NaN,
                        nan: NaN
                    }
                });
            });
        });

    });

    describe('fileChangeObservables()', () => {
        it('should sort added files so workspaces are first', async () => {
            const defaultState: FilesState = {};
            const serverEvents = new Subject<FileEvent>();
            const connector = new TestConnector(defaultState, serverEvents);
            const factory = new StoreFactory({
                'files': () => new FilesStateStore({})
            });
            const client = new ChannelClient(connector, factory);
            const channel = client.getChannel<FilesState>({
                id: 'test',
                type: 'files',
                name: 'Test'
            });
            const connection = await channel.subscribe();

            const { fileAdded } = fileChangeObservables(connection);

            const fileIds: string[] = [];

            fileAdded.subscribe(file => {
                fileIds.push(file.id);
            });

            const newState: FilesState = {
                'test': {
                    id: 'test',
                    type: 'object',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'zdf'
                    }
                },
                'zdf': {
                    id: 'zdf',
                    type: 'workspace',
                    defaultHeight: 1,
                    grid: {},
                    gridScale: 1,
                    scale: 1,
                    size: 1,
                    position: { x: 0, y: 0, z: 0 },
                    color: "#999999"
                }
            };

            serverEvents.next({
                type: 'apply_state',
                state: newState,
                creation_time: new Date()
            });

            expect(fileIds).toEqual([
                'zdf',
                'test'
            ]);
        });
    });

    describe('calculateActionEvents()', () => {

        it('should run scripts on the this file and return the resulting actions', () => {
            
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        '+(#name:"Joe")': 'copy(this)',
                        '+(#name:"Friend")': 'copy(this, { bad: true })',
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'def',
                        name: 'Joe'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('thisFile', 'thatFile', '+');
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            const newState = filesReducer(state, transaction(result.events));

            expect(newState).toEqual({
                // should create a new value from "thisFile"
                'uuid-0': {
                    id: 'uuid-0',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        '+(#name:"Joe")': 'copy(this)',
                        '+(#name:"Friend")': 'copy(this, { bad: true })',

                        // the new file is not destroyed
                    }
                },
                thisFile: {
                    id: 'thisFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        '+(#name:"Joe")': 'copy(this)',
                        '+(#name:"Friend")': 'copy(this, { bad: true })',

                        // The original files should be destroyed by default.
                        _destroyed: true,
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'def',
                        _destroyed: true,
                        name: 'Joe'
                    }
                }
            });
        });

        it('should preserve formulas when copying', () => {
            
            const state: FilesState = {
                thisFile: {
                    id: 'thisFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        '+(#name:"Friend")': 'copy(this, that, { testFormula: "=this.name" })',
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        name: 'Friend'
                    }
                }
            };

            // specify the UUID to use next
            uuidMock.mockReturnValue('uuid-0');
            const fileAction = action('thisFile', 'thatFile', '+');
            const result = calculateActionEvents(state, fileAction);

            expect(result.hasUserDefinedEvents).toBe(true);
            
            const newState = filesReducer(state, transaction(result.events));

            expect(newState).toEqual({
                // should create a new value from "thisFile"
                'uuid-0': {
                    id: 'uuid-0',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        '+(#name:"Friend")': 'copy(this, that, { testFormula: "=this.name" })',
                        name: 'Friend',
                        testFormula: '=this.name'

                        // the new file is not destroyed
                    }
                },
                thisFile: {
                    id: 'thisFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        num: 15,
                        formula: '=this.num',
                        '+(#name:"Friend")': 'copy(this, that, { testFormula: "=this.name" })',

                        // The original files should be destroyed by default.
                        _destroyed: true,
                    }
                },
                thatFile: {
                    id: 'thatFile',
                    type: 'object',
                    tags: {
                        _position: { x:0, y: 0, z: 0 },
                        _workspace: 'abc',
                        _destroyed: true,
                        name: 'Friend'
                    }
                }
            });
        });
    });

    describe('calculateStateDiff()', () => {

        it('should return the same previous and current states', () => {
            const prevState: FilesState = {};
            const currState: FilesState = {};

            const result = calculateStateDiff(prevState, currState);

            expect(result.prev).toBe(prevState);
            expect(result.current).toBe(currState);
            expect(prevState).not.toBe(currState);
        });

        it('should return no changes', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
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
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                }
            };
            const currState: FilesState = {
                'new': {
                    type:'object',
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
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                }
            };
            const currState: FilesState = {};

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(1);
            expect(result.removedFiles[0]).toBe(prevState['test']);
        });

        it('should detect that a file was updated', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'updated': {
                    type: 'object',
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
                    type: 'object',
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

        it('should handle multiple changes at once', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'removed': {
                    type: 'workspace',
                    id: 'removed',
                    position: {x:0, y:0, z:0},
                    size: 2,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'updated': {
                    type: 'object',
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
                    type: 'object',
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: null
                    }
                },
                'new': {
                    type: 'object',
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                },
                'new2': {
                    type: 'object',
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
            expect(result.removedFiles[0]).toBe(prevState['removed']);
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it('should short-circut when a file_added event is given', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
            };
            const currState: FilesState = {
                'test': prevState['test'],
                'new': {
                    type: 'object',
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                }
            };

            const result = calculateStateDiff(prevState, currState, {
                type: 'file_added',
                creation_time: new Date(),
                file: currState['new'],
                id: 'new'
            });

            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.addedFiles.length).toBe(1);
            expect(result.addedFiles[0]).toBe(currState['new']);
        });

        it('should short-circut when a file_removed event is given', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'old': {
                    type: 'object',
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

            const result = calculateStateDiff(prevState, currState, {
                type: 'file_removed',
                creation_time: new Date(),
                id: 'old'
            });

            expect(result.addedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(1);
            expect(result.removedFiles[0]).toBe(prevState['old']);
        });

        it('should short-circut when a file_updated event is given', () => {
            const prevState: FilesState = {
                'updated': {
                    type: 'workspace',
                    id: 'updated',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
            };
            const currState: FilesState = {
                'updated': {
                    type: 'workspace',
                    id: 'updated',
                    position: {x:2, y:1, z:3},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
            };

            const result = calculateStateDiff(prevState, currState, {
                type: 'file_updated',
                creation_time: new Date(),
                id: 'updated',
                update: { 
                    position: {x:2, y:1, z:3},
                }
            });

            expect(result.addedFiles.length).toBe(0);
            expect(result.removedFiles.length).toBe(0);
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });

        it('should not short-circut when a action event is given', () => {
            const prevState: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'removed': {
                    type: 'workspace',
                    id: 'removed',
                    position: {x:0, y:0, z:0},
                    size: 2,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                },
                'updated': {
                    type: 'object',
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
                    type: 'object',
                    id: 'updated',
                    tags: {
                        _position: {x:0, y:0, z:0},
                        _workspace: null
                    }
                },
                'new': {
                    type: 'object',
                    id: 'new',
                    tags: {
                        _position: {x:1, y:0, z:3},
                        _workspace: null
                    }
                },
                'new2': {
                    type: 'object',
                    id: 'new',
                    tags: {
                        _position: {x:1, y:15, z:3},
                        _workspace: 'test'
                    }
                }
            };

            const result = calculateStateDiff(prevState, currState, {
                type: 'transaction',
                creation_time: new Date(),
                events: []
            });

            expect(result.addedFiles.length).toBe(2);
            expect(result.addedFiles[0]).toBe(currState['new']);
            expect(result.addedFiles[1]).toBe(currState['new2']);
            expect(result.removedFiles.length).toBe(1);
            expect(result.removedFiles[0]).toBe(prevState['removed']);
            expect(result.updatedFiles.length).toBe(1);
            expect(result.updatedFiles[0]).toBe(currState['updated']);
        });
    });

    describe('fileDiff', () => {
        it('should return a partial file containing the difference between file1 and file2', () => {
            const file1: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    removedTag: 50,
                    updatedTag: -1000,
                    obj: { cool: 'fun' },
                    objNotChanged: { test: 'test' },
                    array: ['abc', 'def']
                }
            };
            const file2: File = assign({}, file1, {
                tags: {
                    _position: {x: 100, y: 0, z: -50},
                    _workspace: 'abc',
                    newTag: 100,
                    removedTag: null,
                    updatedTag: 'this is cool!',
                    obj: 'not an object',
                    objNotChanged: { test: 'test' },
                    array: ['abc']
                }
            });

            const file1Id = 'file1';
            const file2Id = 'file2';
            const diff = objDiff(file1Id, file1, file2Id, file2);

            expect(diff).toEqual({
                tags: {
                    _position: {
                        x: {
                            [file1Id]: 0,
                            [file2Id]: 100
                        },
                        z: {
                            [file1Id]: 0,
                            [file2Id]: -50
                        }
                    },
                    newTag: {
                        [file1Id]: undefined,
                        [file2Id]: 100
                    },
                    removedTag: {
                        [file1Id]: 50,
                        [file2Id]: null
                    },
                    updatedTag: {
                        [file1Id]: -1000,
                        [file2Id]: 'this is cool!'
                    },
                    obj: {
                        [file1Id]: { cool: 'fun' },
                        [file2Id]: 'not an object'
                    },
                    array: {
                        [file1Id]: ['abc', 'def'],
                        [file2Id]: ['abc']
                    }
                }
            });
        });
        it('should return file1 if file2 is null', () => {
            const file1: any = {
                test: 'abcdef',
                num: 15
            };
            const file2: any = null;

            const file1Id = 'file1';
            const file2Id = 'file2';
            const diff = objDiff(file1Id, file1, file2Id, file2);

            expect(diff).toEqual({
                test: {
                    [file1Id]: 'abcdef',
                    [file2Id]: undefined
                },
                num: {
                    [file1Id]: 15,
                    [file2Id]: undefined
                }
            });
        });

        it('should return null if file2 is null and doing partial diff', () => {
            const file1: any = {
                test: 'abcdef',
                num: 15
            };
            const file2: any = null;

            const file1Id = 'file1';
            const file2Id = 'file2';
            const diff = objDiff(file1Id, file1, file2Id, file2, {
                fullDiff: false
            });

            expect(diff).toBe(null);
        });
    });

    describe('mergeFile', () => {
        it('should successfully merge files with a single addition', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc'
                }
            };
            const parent1: File = JSON.parse(JSON.stringify(base));
            const parent2: File = merge({}, base, {
                tags: {
                    newTag: 100
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        newTag: 100
                    }
                }
            });
        });

        it('should successfully merge files with a single removal', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    removedTag: 100
                }
            };
            const parent1: File = JSON.parse(JSON.stringify(base));
            const parent2: File = merge({}, base, {
                tags: {
                    removedTag: null
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        removedTag: null
                    }
                }
            });
        });

        it('should successfully merge files with a single update', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    updatedTag: 100
                }
            };
            const parent1: File = JSON.parse(JSON.stringify(base));
            const parent2: File = merge({}, base, {
                tags: {
                    updatedTag: 250
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        updatedTag: 250
                    }
                }
            });
        });

        it('should successfully merge files with a update to an object', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                }
            };
            const parent1: File = JSON.parse(JSON.stringify(base));
            const parent2: File = merge({}, base, {
                tags: {
                    _position: { x: 100, y: 0, z: -12 }
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        _position: { x: 100, z: -12 }
                    }
                }
            });
        });

        it('should successfully merge files that add tags with the same values', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    newTag: 'abcdefgh'
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    newTag: 'abcdefgh'
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: null
            });
        });

        it('should successfully merge files that both remove tags', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    removedTag: 1234,
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    removedTag: undefined,
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    removedTag: null,
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        // TODO: This should probably not be here
                        removedTag: null
                    }
                }
            });
        });

        it('should successfully merge files that both update a tag with the same value', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    updatedTag: 1234,
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    updatedTag: 987654,
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    updatedTag: 987654,
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: null
            });
        });

        it('should successfully merge files with multiple updates', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    updatedTag: 1234,
                    otherTag: 321,
                    removedTag: 'removed',
                    removedTag2: 'qwerty'
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    updatedTag: 987654,
                    newTag: 15,
                    newTag2: 30,
                    removedTag2: null
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    otherTag: 'test',
                    newTag: 15,
                    newTag3: 'fun',
                    removedTag: null
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    tags: {
                        updatedTag: 987654,
                        otherTag: 'test',
                        newTag2: 30,
                        newTag3: 'fun',
                        removedTag: null,
                        removedTag2: null
                    }
                }
            });
        });

        it('should fail merge files when changing the same values', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    conflict1: 1234,
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    conflict1: 'changed',
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    conflict1: 'uh oh',
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    tags: {
                        conflict1: {
                            [first]: 'changed',
                            [second]: 'uh oh'
                        }
                    }
                },
                final: {}
            });
        });

        it('should fail merging files adding tags with different values', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    newTag: 'new',
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    newTag: 'wrong',
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    tags: {
                        newTag: {
                            [first]: 'new',
                            [second]: 'wrong'
                        }
                    }
                },
                final: {}
            });
        });

        it('should fail merging files when one deletes the tag and the other modifies it', () => {
            const base: File = {
                type: 'object',
                id: 'test',
                tags: {
                    _position: {x: 0, y: 0, z: 0},
                    _workspace: 'abc',
                    removedTag: 'tag'
                }
            };
            const parent1: File = merge({}, base, {
                tags: {
                    removedTag: 'changed',
                }
            });
            const parent2: File = merge({}, base, {
                tags: {
                    removedTag: null,
                }
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    tags: {
                        removedTag: {
                            [first]: 'changed',
                            [second]: null
                        }
                    }
                },
                final: {}
            });
        });

        it('should work on file state', () => {
            const base: FilesState = {
                'test': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                        updatedTag: 'test'
                    }
                },
                'removedFile': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                    }
                },
                'conflictFile': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                    }
                },
            };
            const parent1: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        newTag: 'new',
                    }
                },
                'newFile': {
                    type: 'object',
                    id: 'newFile',
                    tags: {
                        _position: {x: 10, y: 0, z: -3},
                        _workspace: 'def'
                    }
                },
                'conflictFile': {
                    tags: {
                        _workspace: 'qrstuv',
                    }
                },
            });
            const parent2: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        updatedTag: 'abcdef',
                    }
                },
                'removedFile': null,
                'conflictFile': {
                    tags: {
                        _workspace: 'poiuy',
                    }
                },
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    'conflictFile': {
                        tags: {
                            _workspace: {
                                [first]: 'qrstuv',
                                [second]: 'poiuy'
                            }
                        }
                    },
                },
                final: {
                    'test': {
                        tags: {
                            updatedTag: 'abcdef',
                            newTag: 'new'
                        }
                    },
                    'newFile': {
                        type: 'object',
                        id: 'newFile',
                        tags: {
                            _position: {x: 10, y: 0, z: -3},
                            _workspace: 'def'
                        }
                    },
                    'removedFile': null
                }
            });
        });

        it('should fail if files have moved to different spots', () => {
            const base: FilesState = {
                'test': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                    }
                }
            };
            const parent1: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 10, y: 10, z: 0},
                    }
                },
            });
            const parent2: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 5, y: 5, z: 0},
                    }
                },
            });

            const merged = mergeFiles(base, parent1, parent2);

            expect(merged).toEqual({
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    'test': {
                        tags: {
                            _position: {
                                x: {
                                    [first]: 10,
                                    [second]: 5
                                },
                                y: {
                                    [first]: 10,
                                    [second]: 5
                                }
                            }
                        }
                    },
                },
                final: {}
            });
        });
    });

    describe('merge', () => {
        it('should produce file added events for new files', () => {
            const base: FilesState = {};
            const parent1: FilesState = {
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                }
            };
            const parent2: FilesState = {};

            let result = mergeFiles(base, parent1, parent2);

            expect(result.success).toBe(true);
            expect(result.final).toEqual({
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                }
            });

            let finalState = applyMerge(result);

            expect(finalState).toEqual({
                'test': {
                    type: 'workspace',
                    id: 'test',
                    position: {x:0, y:0, z:0},
                    size: 1,
                    grid: {},
                    scale: 0.5,
                    defaultHeight: 0.1,
                    gridScale: 0.2,
                    color: "#999999"
                }
            });
        });
    });

    describe('listMergeConflicts()', () => {
        it('should return a list of conflicts with their path and values', async () => {
            const base: FilesState = {
                'test': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                    }
                }
            };
            const parent1: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 10, y: 10, z: 0},
                    }
                },
            });
            const parent2: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 5, y: 5, z: 0},
                    }
                },
            });

            const result = {
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    'test': {
                        tags: {
                            _position: {
                                x: {
                                    [first]: 10,
                                    [second]: 5
                                },
                                y: {
                                    [first]: 10,
                                    [second]: 5
                                }
                            }
                        }
                    },
                },
                final: {}
            };

            let conflicts: ConflictDetails[] = listMergeConflicts(result);

            expect(conflicts).toEqual([
                {
                    path: ['test', 'tags', '_position', 'x'],
                    conflict: {
                        [first]: 10,
                        [second]: 5
                    }
                },
                {
                    path: ['test', 'tags', '_position', 'y'],
                    conflict: {
                        [first]: 10,
                        [second]: 5
                    }
                }
            ]);
        });
    });

    describe('resolveConflicts()', () => {
        it('should apply the given conflict resolutions to the merge state and return a new merge state', async () => {
            const base: FilesState = {
                'test': {
                    type: 'object',
                    id: 'test',
                    tags: {
                        _position: {x: 0, y: 0, z: 0},
                        _workspace: 'abc',
                    }
                }
            };
            const parent1: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 10, y: 10, z: 0},
                    }
                },
            });
            const parent2: FilesState = merge({}, base, {
                'test': {
                    tags: {
                        _position: {x: 5, y: 5, z: 0},
                    }
                },
            });

            const result = {
                success: false,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: {
                    'test': {
                        tags: {
                            _position: {
                                x: {
                                    [first]: 10,
                                    [second]: 5
                                },
                                y: {
                                    [first]: 10,
                                    [second]: 5
                                }
                            }
                        }
                    },
                },
                final: {}
            };

            let conflicts: ResolvedConflict[] = [
                {
                    details: {
                        path: ['test', 'tags', '_position', 'x'],
                        conflict: {
                            [first]: 10,
                            [second]: 5
                        }
                    },
                    value: 10
                },
                {
                    details: {
                        path: ['test', 'tags', '_position', 'y'],
                        conflict: {
                            [first]: 10,
                            [second]: 5
                        }
                    },
                    value: 5
                }
            ];

            const newResult = resolveConflicts(result, conflicts);

            expect(newResult).toEqual({
                success: true,
                base: base,
                first: parent1,
                second: parent2,
                conflicts: null,
                final: {
                    'test': {
                        tags: {
                            _position: {
                                x: 10,
                                y: 5
                            }
                        }
                    },
                }
            })
        });

        describe('objectsAtGridPosition', () => {
            it('should return objects that are at the same grid position and workspace', () => {
                const objs: Object[] = [
                    {
                        id: 'test',
                        type: 'object',
                        tags: {
                            _position: {
                                x: 0,
                                y: 0,
                                z: 1
                            },
                            _workspace: 'abc',
                        },
                    },
                    {
                        id: 'test2',
                        type: 'object',
                        tags: {
                            _position: {
                                x: 0,
                                y: 0,
                                z: 0
                            },
                            _workspace: 'abc',
                        },
                    },
                    {
                        id: 'test3',
                        type: 'object',
                        tags: {
                            _position: {
                                x: 1,
                                y: 0,
                                z: 0
                            },
                            _workspace: 'abc',
                        },
                    },
                    {
                        id: 'test4',
                        type: 'object',
                        tags: {
                            _position: {
                                x: 0,
                                y: 1,
                                z: 0
                            },
                            _workspace: 'abc',
                        },
                    },
                    {
                        id: 'test5',
                        type: 'object',
                        tags: {
                            _position: {
                                x: 0,
                                y: 0,
                                z: 0
                            },
                            _workspace: 'def',
                        },
                    }
                ];

                const matching = objectsAtGridPosition(objs, 'abc', {
                    x: 0,
                    y: 0,
                    z: 10
                });

                expect(matching).toEqual([
                    objs[0],
                    objs[1]
                ]);
            });
        });
    });
});