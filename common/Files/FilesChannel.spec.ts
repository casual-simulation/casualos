import { filesReducer, fileAdded, FilesState, fileRemoved, action, calculateStateDiff } from './FilesChannel';
import { Workspace, Object } from './File';
import { values } from 'lodash';
import uuid from 'uuid/v4';

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
                    size: 10
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
                        size: 10
                    }
                };
                const newState = filesReducer(state, fileRemoved('test'));

                expect(newState).toEqual({});
            });
        });

        describe('action', () => {

            it('should run scripts on the this file and then execute the resulting actions', () => {
                
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
                const newState = filesReducer(state, action('thisFile', 'thatFile', '+'));

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
                    size: 1
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
                    size: 1
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
                    size: 1
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
                    size: 1
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
                    size: 1
                },
                'removed': {
                    type: 'workspace',
                    id: 'removed',
                    position: {x:0, y:0, z:0},
                    size: 2
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
                    size: 1
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
                    size: 1
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
                    size: 1
                },
            };
            const currState: FilesState = {
                'updated': {
                    type: 'workspace',
                    id: 'updated',
                    position: {x:2, y:1, z:3},
                    size: 1
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
                    size: 1
                },
                'removed': {
                    type: 'workspace',
                    id: 'removed',
                    position: {x:0, y:0, z:0},
                    size: 2
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
                type: 'action',
                creation_time: new Date(),
                senderFileId: 'sender',
                receiverFileId: 'receiver',
                eventName: 'eventName'
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
});